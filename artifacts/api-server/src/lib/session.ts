/**
 * Session lookup shared by any route that needs the signed-in user.
 *
 * The same query lives inline in `GET /auth/me`; this is the reusable form for
 * routes that need to *guard* rather than report. Kept in one place so the
 * expiry check (`expiresAt > now`) can never be forgotten at a call site —
 * a session row existing is not the same as a session being valid.
 */
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";

export const SESSION_COOKIE = "safarly_session";

export interface SessionUser {
  id: string;
  email: string;
}

/** Express augmentation so handlers can read `req.user` after requireSession. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export async function readSessionUser(req: Request): Promise<SessionUser | null> {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;

  const [row] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(eq(sessionsTable.id, sessionId), gt(sessionsTable.expiresAt, new Date())),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Rejects unauthenticated requests. Agent routes spend real API quota, so they
 * are never open to anonymous callers — quota is attributable to a user.
 */
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await readSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to use this feature." });
    return;
  }
  req.user = user;
  next();
}
