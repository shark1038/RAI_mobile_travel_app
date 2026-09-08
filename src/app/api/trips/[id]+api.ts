import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { getAuthUserId, unauthorized } from "@/lib/auth";

// Returns the full trip (itinerary, budget, cover, etc.) for the detail screen,
// scoped to the authenticated owner.
export async function GET(request: Request, { id }: Record<string, string>) {
  const auth = await getAuthUserId(request);
  if (!auth.userId) return unauthorized(auth.reason);
  const userId = auth.userId;

  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)));

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  return Response.json(trip);
}

// Deletes a trip owned by the authenticated user. Chat messages cascade via the
// `chat_messages.trip_id` FK (onDelete: "cascade").
export async function DELETE(request: Request, { id }: Record<string, string>) {
  const auth = await getAuthUserId(request);
  if (!auth.userId) return unauthorized(auth.reason);
  const userId = auth.userId;

  const deleted = await db
    .delete(trips)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning({ id: trips.id });

  if (deleted.length === 0) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
