import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { getAuthUserId, unauthorized } from "@/lib/auth";
import { TRIP_GENERATE, inngest } from "@/inngest/client";
import { refundGeneration, reserveGeneration, usageDay } from "@/lib/usage";

// Lists the authenticated user's trips for the Trips tab, newest first. Returns
// only the lightweight fields the cards need (not the full itinerary jsonb).
export async function GET(request: Request) {
  const auth = await getAuthUserId(request);
  if (!auth.userId) return unauthorized(auth.reason);

  const rows = await db
    .select({
      id: trips.id,
      destination: trips.destination,
      numDays: trips.numDays,
      status: trips.status,
      coverImageUrl: trips.coverImageUrl,
      budgetBreakdown: trips.budgetBreakdown,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.userId, auth.userId))
    .orderBy(desc(trips.createdAt));

  return Response.json({ trips: rows });
}

// Body sent by the generate-trip form. Kept in sync with the client payload in
// `@/lib/api`. Server-side validation is authoritative regardless of client checks.
const createTripSchema = z.object({
  destination: z.string().trim().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  numDays: z.number().int().min(1).max(30),
  numTravelers: z.number().int().min(1).max(20),
  budgetTier: z.enum(["budget", "comfort", "luxury"]),
  interests: z.array(z.string().trim().min(1)).max(20).default([]),
  pace: z.string().trim().min(1).max(40).nullable().default(null),
});

export async function POST(request: Request) {
  const auth = await getAuthUserId(request);
  if (!auth.userId) return unauthorized(auth.reason);
  const userId = auth.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Silent safety cap — reserve one generation for today (see PLAN A3).
  const reserved = await reserveGeneration(userId);
  if (!reserved) {
    return Response.json(
      { error: "You've reached the daily limit for generating trips. Try again tomorrow." },
      { status: 429 },
    );
  }

  const tripId = crypto.randomUUID();
  const { destination, startDate, numDays, numTravelers, budgetTier, interests, pace } =
    parsed.data;

  try {
    await db.insert(trips).values({
      id: tripId,
      userId,
      destination,
      startDate,
      numDays,
      numTravelers,
      budgetTier,
      interests,
      pace,
      status: "pending",
    });

    // Kick off the durable generation pipeline.
    await inngest.send({ name: TRIP_GENERATE, data: { tripId, userId } });
  } catch (error) {
    // Roll back the reserved quota if we couldn't actually start the job.
    await refundGeneration(userId, usageDay()).catch(() => {});
    // Clean up the trip row if it was inserted but the queue start failed, so we
    // don't leave stale `status: "pending"` data behind. No-op if insert failed.
    await db.delete(trips).where(eq(trips.id, tripId)).catch(() => {});
    console.error("[POST /api/trips] failed to create trip:", error);
    return Response.json({ error: "Failed to start trip generation" }, { status: 500 });
  }

  return Response.json({ id: tripId, status: "pending" }, { status: 201 });
}
