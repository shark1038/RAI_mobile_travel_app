import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantMessages } from "@/db/schema";
import { getAuthUserId, unauthorized } from "@/lib/auth";

// Returns the current user's saved assistant transcript, oldest first.
export async function GET(request: Request) {
  const auth = await getAuthUserId(request);
  if (!auth.userId) return unauthorized(auth.reason);

  const rows = await db
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      createdAt: assistantMessages.createdAt,
    })
    .from(assistantMessages)
    .where(eq(assistantMessages.userId, auth.userId))
    .orderBy(asc(assistantMessages.createdAt));

  return Response.json({ messages: rows });
}

// Clears the current user's assistant transcript.
export async function DELETE(request: Request) {
  const auth = await getAuthUserId(request);
  if (!auth.userId) return unauthorized(auth.reason);

  await db.delete(assistantMessages).where(eq(assistantMessages.userId, auth.userId));
  return new Response(null, { status: 204 });
}
