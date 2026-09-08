# Triply — Build Plan & Checklist

> AI trip planner (iOS, Expo SDK 56). This is the living checklist for v1.
> Check items off (`[x]`) as they're completed. Full spec lives at the bottom.

---

## Legend

- `[ ]` not started · `[~]` in progress · `[x]` done
- Each phase has a **Definition of Done** so we know when to check the header.

---

## Phase 0 — Foundations

- [ ] Read Expo v56 docs for API routes / server output (per `AGENTS.md`)
- [x] Set `web.output: "server"` in `app.json` (enables API routes)
- [x] Install Expo-native deps: `@sentry/react-native`, `react-native-maps`, `expo-secure-store`, `expo-web-browser`, `expo-auth-session`, `expo-crypto`, `expo-apple-authentication`
- [~] Install JS/server deps: `@clerk/expo` ✅ · `drizzle-orm` ✅ · `@neondatabase/serverless` ✅ · `inngest` ✅ · `svix` ✅ · `openai`, `imagekit`, `zod` (deferred to their phases)
- [x] Install dev deps: `drizzle-kit`, `dotenv`
- [x] Create `.env` + `.env.example` with all keys (Clerk, Neon, OpenAI, ImageKit, Unsplash, Sentry, Inngest)
- [x] Add Clerk + relevant config plugins to `app.json` (`@clerk/expo`, `expo-secure-store`, `expo-web-browser`, Sentry)
- [~] Initialize Sentry (client done in `_layout.tsx`; API routes pending — no `+api.ts` routes yet)
- [ ] Set up `src/lib/env.ts` for typed env access
- **DoD:** App boots on iOS simulator; server API route returns 200; Sentry receives a test event.

## Phase 1 — Auth & User Sync

- [x] `ClerkProvider` + `tokenCache` wired into `src/app/_layout.tsx`
- [x] Route protection: redirect signed-out → auth, signed-in → app (`(auth)/_layout.tsx` + `(home)/_layout.tsx`)
- [x] Single auth screen (`(auth)/sign-in.tsx`) — **Google** + **Apple** both live on one page via `useSSO` (`hooks/useSSOAuth.ts`)
  - [x] **Google** (`oauth_google`)
  - [x] **Apple** (`oauth_apple`)
- [x] Configure redirect URI / scheme (`triply`) for native SSO (`AuthSession.makeRedirectUri()`)
- [x] Sign-out action (`(home)/index.tsx` via `useClerk().signOut`)
- [x] Clerk webhook API route (`/api/webhooks/clerk+api.ts`) verifying with `svix`
- [x] Webhook upserts `user.created` / `user.updated` → Neon `users`
- [x] Webhook handles `user.deleted` → remove/soft-delete user
- [ ] Lazy-create fallback: first authed request upserts user if missing
- **DoD:** Sign in with Google AND Apple; a `users` row appears in Neon via webhook; sign-out works.

## Phase 2 — Schema & Data Layer

- [x] Drizzle config (`drizzle.config.ts`) pointed at Neon
- [x] Neon serverless client (`src/db/index.ts`)
- [x] `users` table (Clerk userId PK, email, name, imageUrl, timestamps)
- [x] `trips` table (userId FK, destination, startDate, numDays, numTravelers, budgetTier enum, interests, status enum, coverImageUrl, itinerary jsonb, budgetBreakdown jsonb, errorMessage, timestamps)
- [x] `chat_messages` table (tripId FK cascade, role, content, createdAt)
- [x] `generation_usage` table/counter (per user per day) for safety cap
- [x] Zod schemas / TS types for `itinerary` and `budgetBreakdown` jsonb shapes (`src/lib/itinerary.ts`)
- [x] Generate + run migrations against Neon (`db:push`)
- [x] Typed DB helpers, all scoped by authenticated `userId` (routes filter by `userId`; `src/lib/usage.ts`)
- **DoD:** Migrations applied on Neon; helper can create/read a trip scoped to a user.

## Phase 3 — Generation Pipeline

- [x] Generate-trip form screen: destination, travel dates, # days, # travelers, budget tier (Low/Med/Luxury), interests/style tags
- [x] Client-side validation of the form (button gated on destination + start date; server re-validates via Zod)
- [x] `POST /api/trips+api.ts`: auth → safety-cap check → create `trip` (status `pending`) → trigger Inngest event
- [x] Inngest client (`src/inngest/client.ts`) + endpoint route (`/api/inngest+api.ts`)
- [x] Inngest `generate-trip` function:
  - [x] Set status `generating`
  - [x] Call OpenAI (mini) with structured itinerary schema (`src/lib/openai.ts`, `gpt-4o-mini`)
  - [x] Validate AI output against Zod schema (Structured Outputs + `tripGenerationSchema.parse`)
  - [x] Fetch destination cover image (Unsplash) → upload/optimize via ImageKit (`src/lib/images.ts`)
  - [x] Persist itinerary + budgetBreakdown + coverImageUrl → status `ready`
  - [x] Retries on failure; terminal failure → status `failed` + errorMessage (quota refunded via `onFailure`)
- [x] Silent safety cap (20 generations/user/day) enforced in `POST /api/trips` (`src/lib/usage.ts`)
- [x] Loading screen polls `GET /api/trips/[id]/status+api.ts` (`src/app/trip-loading.tsx`)
- [x] On `ready` → navigate to trip detail; on `failed` → error + "Try again"
- [ ] Run against **local Inngest dev server** (no EAS Hosting in v1) — needs manual run: `npm run ios` + `npm run inngest`
- **DoD:** Submitting the form generates a real trip end-to-end locally; status flips pending→generating→ready; forced failure shows graceful error.

## Phase 4 — Trip Detail & Management

- [ ] Home screen: list of user's trips + "Generate trip" entry (functional; styling later)
- [ ] `GET /api/trips+api.ts` (list) and `GET /api/trips/[id]+api.ts` (detail)
- [ ] Trip detail: cover image (ImageKit), day-by-day itinerary
- [ ] Places per day (attractions/restaurants) with descriptions
- [ ] Hotel suggestions section
- [ ] Budget breakdown section
- [ ] Apple Maps (`react-native-maps` default provider) with place pins (LLM lat/lng)
- [ ] Delete trip (`DELETE /api/trips/[id]+api.ts`) → cascade chat + cleanup
- [ ] Empty state for no trips
- **DoD:** A generated trip renders fully (itinerary/places/hotels/budget/cover/map); delete removes it everywhere.

## Phase 5 — AI Chat Refine

- [ ] Chat UI on trip detail (message list + input)
- [ ] `POST /api/trips/[id]/chat+api.ts`: synchronous OpenAI (mini) call returning **targeted edits**
- [ ] Apply edits to `itinerary` jsonb in place
- [ ] Persist user + assistant `chat_messages`
- [ ] Load chat history on open; context carries across sessions
- [ ] Detail screen reflects updated itinerary after an edit
- **DoD:** "Make day 2 more relaxed" mutates the stored itinerary in place; history persists across reopen.

## Phase 6 — Hardening & Observability

- [ ] Empty / error / slow-network states across screens
- [ ] Sentry coverage on client + all API routes
- [ ] Safety-cap soft-error behavior verified
- [ ] Profile photo upload/optimization via ImageKit (avatar)
- [ ] Loading/skeleton states polished
- [ ] Final end-to-end verification pass on iOS simulator
- **DoD:** All verification steps below pass; no unhandled errors; Sentry clean.
- _(EAS Hosting deploy + staging deferred to a post-v1 phase.)_

---

## Deferred / Out of Scope (v1)

- Android & Web · Email/password auth · Payments / paywall / user-facing quota
- Google Places (real venue data/photos) · Push notifications · Manual itinerary editing
- Regenerate-from-scratch · Favorites/bookmarks · Sharing/social · EAS Hosting deploy

---

## Open Risks (watch these)

- **R1** Inngest runs on local dev server in v1 (no EAS Hosting yet); validate hosting/timeouts only when we deploy.
- **R2** Mini-tier + LLM-only place data → hallucination risk (Google Places is the v2 fix).
- **R3** Apple-only maps/auth hard-codes iOS-only.
- **R4** DB polling during loading is chatty; tune interval/backoff if generation is slow.
- **R5** Mini-tier JSON may violate schema → rely on Zod validation + Inngest retry/`failed` path.
- **R6** Unsplash/Pexels attribution/ToS for storing+serving via ImageKit must be checked.
- **R7** Soft cap only — an abuser within 20/day still costs money; rely on Sentry alerts.

## Key Assumptions

- **A1** Map pins use LLM-provided lat/lng (approximate, unverified).
- **A2** Stock covers from Unsplash, one per trip, keyed by destination.
- **A3** Safety cap = 20 generations/user/day, no UI surfaced.
- **A4** Budget tiers = Low / Medium / Luxury; breakdown is AI-estimated.
- **A5** Visual design provided later by user; v1 builds functional screens.
- **A6** Local dev only for v1 (Expo API routes + Inngest dev server); no prod deploy.
- **A7** Chat edits mutate `itinerary` jsonb in place; no versioning beyond chat transcript.

---

## Spec Summary

**Product:** AI travel-itinerary generator. User inputs constraints → AI produces a structured
multi-day plan → user refines via chat. Single role, consumer travelers, iOS-only.

**Stack:**

- **Auth:** Clerk (Google + Apple only), webhook syncs users → Neon
- **Backend:** Expo Router API routes (`+api.ts`), local dev + Inngest dev server (no EAS Hosting v1)
- **DB:** Neon Postgres + Drizzle ORM
- **AI:** OpenAI, mini tier everywhere, structured JSON itineraries
- **Background jobs:** Inngest (durable generation + retries)
- **Images:** ImageKit (profile photos + per-trip cover images); covers sourced from Unsplash
- **Maps:** Apple Maps via `react-native-maps`, no API key
- **Monitoring:** Sentry

**Core journeys:**

1. First run → Clerk sign-in (Google/Apple) → webhook upserts user → home (empty).
2. Generate → form → `POST /trips` (status `pending`) + Inngest → loading polls status → `ready` → detail. Failure → retries → `failed` → "Try again" (quota untouched).
3. Refine → chat → synchronous OpenAI targeted edits → trip updated in place + history persisted.
4. Manage → home lists trips → view → delete (cascade).

**Data model:**

- `users` (Clerk userId PK, email, name, imageUrl, timestamps)
- `trips` (userId FK, destination, startDate, numDays, numTravelers, budgetTier, interests, status, coverImageUrl, itinerary jsonb, budgetBreakdown jsonb, errorMessage, timestamps)
- `chat_messages` (tripId FK cascade, role, content, createdAt)
- `generation_usage` (per user/day counter for safety cap)

**Verification (final):**

- Sign in with Google + Apple → `users` row in Neon via webhook.
- Submit form → status `pending`→`generating`→`ready` → detail renders itinerary/budget/cover/map.
- Force OpenAI failure → retries → `failed` → "Try again", quota untouched.
- Delete removes trip + chat.
- Chat edit ("make day 2 more relaxed") mutates itinerary in place; history persists.
- Exceed per-day cap → soft error; Sentry receives events.
- Runs on iOS simulator via `npm run ios` + local Inngest dev server.
