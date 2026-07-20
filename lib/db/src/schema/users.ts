import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Registered accounts.
 *
 * `passwordHash` holds a self-describing scrypt digest (see the api-server's
 * lib/password.ts) — never a plaintext or reversibly-encrypted password. No
 * code outside the auth routes should read this column, and it must never be
 * included in an API response.
 *
 * `email` is stored lowercased and is the login identifier, so it carries a
 * unique index. Normalise with `email.trim().toLowerCase()` before any lookup
 * or insert, or duplicate accounts differing only by case become possible.
 */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_email_idx").on(table.email)],
);

/**
 * Server-side sessions.
 *
 * The cookie carries only an opaque random id; everything authoritative lives
 * here, so a session can be revoked server-side (which a self-contained JWT
 * cannot do without extra machinery). Deleting the user cascades to their
 * sessions.
 *
 * Expired rows are rejected at lookup time, so a sweeper is a housekeeping
 * task rather than a security control.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/**
 * Password-reset tokens.
 *
 * The token itself is the primary key (same convention as `sessionsTable`'s
 * session id) — an opaque, high-entropy random string generated with
 * `generateSessionId()`, so knowing it is equivalent to proving control of
 * the reset request. `usedAt` is set the moment it's redeemed so a captured
 * link can't be replayed; expired or already-used rows are rejected at
 * lookup time regardless of `usedAt`/`expiresAt` housekeeping.
 */
export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("password_reset_tokens_user_id_idx").on(table.userId)],
);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;

/** A user with the password hash stripped — the only shape safe to serialise. */
export type PublicUser = Pick<User, "id" | "email" | "name" | "createdAt">;

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
