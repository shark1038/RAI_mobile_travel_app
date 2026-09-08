import { relations } from "drizzle-orm";
import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BudgetBreakdown, Itinerary } from "@/lib/itinerary";

// Mirrors the relevant Clerk user fields. `id` is the Clerk user id (e.g. "user_abc123").
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Budget tier the user picks in the form. Values match the AI prompt vocabulary.
export const budgetTierEnum = pgEnum("budget_tier", ["budget", "comfort", "luxury"]);

// Lifecycle of a trip's generation. `pending` → `generating` → `ready` | `failed`.
export const tripStatusEnum = pgEnum("trip_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

// Chat message author.
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

// One row per generated trip. `itinerary` / `budgetBreakdown` are AI-produced JSON
// blobs (see `@/lib/itinerary` for their shapes); they're null until status is `ready`.
export const trips = pgTable("trips", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  startDate: date("start_date").notNull(),
  numDays: integer("num_days").notNull(),
  numTravelers: integer("num_travelers").notNull(),
  budgetTier: budgetTierEnum("budget_tier").notNull(),
  // Interest/style tags picked in the form (e.g. ["Beaches", "Food & drink"]).
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  // Travel pace (e.g. "Relaxed"); feeds the prompt, not a hard schema field in the plan.
  pace: text("pace"),
  status: tripStatusEnum("status").notNull().default("pending"),
  coverImageUrl: text("cover_image_url"),
  // Unsplash attribution for the cover photo (required by Unsplash ToS, see R6).
  coverPhotographer: text("cover_photographer"),
  coverPhotographerUrl: text("cover_photographer_url"),
  itinerary: jsonb("itinerary").$type<Itinerary>(),
  budgetBreakdown: jsonb("budget_breakdown").$type<BudgetBreakdown>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

// Chat transcript used by the "refine" flow (Phase 5). Cascades with its trip.
export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

// Standalone transcript for the AI travel-companion assistant screen. Per-user
// (not tied to a trip, unlike `chatMessages`) and cascades when the user is deleted.
export const assistantMessages = pgTable("assistant_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AssistantMessageRow = typeof assistantMessages.$inferSelect;
export type NewAssistantMessageRow = typeof assistantMessages.$inferInsert;

// Per-user, per-day generation counter backing the silent safety cap.
// Composite PK (userId, day) so each user has at most one row per calendar day.
export const generationUsage = pgTable(
  "generation_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Calendar day in YYYY-MM-DD (UTC), stored as a date.
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);

export type GenerationUsage = typeof generationUsage.$inferSelect;

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  assistantMessages: many(assistantMessages),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({ one }) => ({
  user: one(users, { fields: [assistantMessages.userId], references: [users.id] }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  trip: one(trips, { fields: [chatMessages.tripId], references: [trips.id] }),
}));
