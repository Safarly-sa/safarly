/**
 * Email + password authentication.
 *
 * Sessions are server-side: the cookie carries only an opaque random id, and
 * every authoritative fact lives in the sessions table, so a session can be
 * revoked immediately. The cookie is httpOnly, which keeps the token out of
 * reach of any JavaScript on the page — the reason this cannot be done in
 * localStorage.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gt, lt } from "drizzle-orm";
import { db, usersTable, sessionsTable, toPublicUser } from "@workspace/db";
import {
  hashPassword,
  verifyPassword,
  generateSessionId,
} from "../lib/password";
import {
  isValidEmail,
  normaliseEmail,
  validatePassword,
  NAME_MAX_LENGTH,
} from "../lib/validation";

const router: IRouter = Router();

const SESSION_COOKIE = "safarly_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const isProduction = process.env.NODE_ENV === "production";

function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    // Lax still sends the cookie on top-level navigation, so returning from an
    // email link keeps you signed in, while blocking cross-site POSTs (CSRF).
    sameSite: "lax",
    secure: isProduction,
    expires: expiresAt,
    path: "/",
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  });
}

async function createSession(userId: string, res: Response): Promise<void> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ id: sessionId, userId, expiresAt });

  // Opportunistic cleanup; expired sessions are rejected on read regardless.
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));

  setSessionCookie(res, sessionId, expiresAt);
}

/**
 * Throttles repeated failures per email+IP. In-memory, so it resets on restart
 * and is per-instance — enough to blunt online guessing in this single-process
 * deployment, but replace with a shared store before running multiple
 * instances behind a load balancer.
 */
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function attemptKey(req: Request, email: string): string {
  return `${req.ip ?? "unknown"}:${email}`;
}

function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count++;
}

/* ── POST /api/auth/signup ─────────────────────────────────────────────── */
router.post("/auth/signup", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (name.length > NAME_MAX_LENGTH) {
    return res.status(400).json({ error: `Name must be at most ${NAME_MAX_LENGTH} characters.` });
  }
  if (!isValidEmail(rawEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const email = normaliseEmail(rawEmail);
  const passwordError = validatePassword(password, [email, name]);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    // Signup unavoidably reveals that an address is taken — the user has to be
    // told why they cannot proceed. Login deliberately does not.
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, name, passwordHash })
    .returning();

  await createSession(user.id, res);
  return res.status(201).json({ user: toPublicUser(user) });
});

/* ── POST /api/auth/login ──────────────────────────────────────────────── */
router.post("/auth/login", async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const email = normaliseEmail(rawEmail);

  const key = attemptKey(req, email);
  if (isRateLimited(key)) {
    return res.status(429).json({ error: "Too many attempts. Please try again in 15 minutes." });
  }

  if (!email || !password) {
    return res.status(400).json({ error: "Please enter your email and password." });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  // One message for "no such user" and "wrong password" so the response cannot
  // be used to discover which addresses are registered.
  const invalid = { error: "Incorrect email or password." };

  if (!user) {
    // Hash anyway so a missing user does not return measurably faster.
    await hashPassword(password);
    recordFailure(key);
    return res.status(401).json(invalid);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    recordFailure(key);
    return res.status(401).json(invalid);
  }

  attempts.delete(key);
  await createSession(user.id, res);
  return res.json({ user: toPublicUser(user) });
});

/* ── POST /api/auth/logout ─────────────────────────────────────────────── */
router.post("/auth/logout", async (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (typeof sessionId === "string" && sessionId.length > 0) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  }
  clearSessionCookie(res);
  return res.status(204).end();
});

/* ── GET /api/auth/me ──────────────────────────────────────────────────── */
router.get("/auth/me", async (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return res.status(401).json({ error: "Not signed in." });
  }

  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.id, sessionId), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Not signed in." });
  }

  return res.json({ user: toPublicUser(row.user) });
});

export default router;
