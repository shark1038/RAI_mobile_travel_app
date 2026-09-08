import { Webhook } from "svix";
import {
  CLERK_USER_CREATED,
  CLERK_USER_DELETED,
  CLERK_USER_UPDATED,
  inngest,
} from "@/inngest/client";

// Minimal shape of the Clerk user webhook payloads (only the fields we use).
// user.created / user.updated carry the full user; user.deleted only the id.
type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
};

const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

export async function POST(request: Request) {
  if (!signingSecret) {
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", { status: 500 });
  }

  // svix needs the raw body + the three svix-* headers to verify the signature.
  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  let event: ClerkUserEvent;
  try {
    event = new Webhook(signingSecret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const data = event.data;

  // Hand off to Inngest; the background functions do the DB writes.
  if (event.type === "user.created" || event.type === "user.updated") {
    const emails = data.email_addresses ?? [];
    const primaryEmail =
      emails.find((e) => e.id === data.primary_email_address_id) ?? emails[0];
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await inngest.send({
      name: event.type === "user.created" ? CLERK_USER_CREATED : CLERK_USER_UPDATED,
      data: {
        id: data.id,
        email: primaryEmail?.email_address ?? "",
        name,
        imageUrl: data.image_url ?? null,
      },
    });
  } else if (event.type === "user.deleted") {
    await inngest.send({
      name: CLERK_USER_DELETED,
      data: { id: data.id },
    });
  }

  return new Response("ok", { status: 200 });
}
