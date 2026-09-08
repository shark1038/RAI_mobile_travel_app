import { serve } from "inngest/edge";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// `inngest/edge` works with standard Web Request/Response, which is what
// Expo Router API routes use. The returned handler dispatches GET/POST/PUT
// itself, so we bind it to each method export.
const handler = serve({ client: inngest, functions });

export function GET(request: Request) {
  return handler(request);
}

export function POST(request: Request) {
  return handler(request);
}

export function PUT(request: Request) {
  return handler(request);
}
