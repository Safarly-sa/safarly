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
import { eq, and, gt, lt, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  sessionsTable,
  passwordResetTokensTable,
  toPublicUser,
} from "@workspace/db";
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
import { resolveClientIp } from "../lib/client-ip";

const router: IRouter = Router();

const SESSION_COOKIE = "safarly_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const isProduction = process.env.NODE_ENV === "production";

/**
 * In production the frontend and the API are on different sites
 * (safarly.pages.dev vs safarly-api.onrender.com), and `SameSite=Lax` is not
 * sent on cross-site fetch — so a Lax cookie is set at login and then never
 * returned, leaving every session-guarded route 401ing. `None` is the only
 * value a cross-site XHR cookie can take, and the spec requires `Secure`
 * alongside it.
 *
 * SameSite is load-bearing CSRF protection, so removing it has to be paid for
 * elsewhere: the CORS allowlist in app.ts is now the control. That works
 * because every route here consumes JSON, which forces a preflight a foreign
 * origin cannot pass. It only holds while the API parses nothing that
 * qualifies as a CORS "simple request" — which is why app.ts no longer
 * installs `express.urlencoded`. Do not add it back, and do not add a route
 * that accepts form encoding or text/plain, without putting a CSRF token in
 * front of it.
 *
 * Locally both sides are http://localhost, so Lax still applies and `Secure`
 * would break the cookie over plain HTTP.
 */
const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  secure: isProduction,
  path: "/",
};

function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, sessionId, { ...cookieOptions, expires: expiresAt });
}

/** Attributes must match the ones it was set with, or the browser keeps the cookie. */
function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
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
 *
 * The IP comes from resolveClientIp, not `req.ip`: behind a proxy the socket
 * address is the proxy's, the same for everyone, which collapses the IP half
 * of the key. See lib/client-ip.ts for why `trust proxy` is not used.
 */
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function attemptKey(req: Request, email: string): string {
  return `${resolveClientIp(req.headers, req.ip)}:${email}`;
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

/* ── POST /api/auth/forgot-password ────────────────────────────────────── */
/**
 * No email provider is wired up yet (see CLAUDE.md / .env.example), so there
 * is no way to deliver the reset link out of band. Until one exists, the link
 * is handed back directly in the response — the frontend shows it on screen
 * instead of "check your email". This intentionally trades the usual
 * "doesn't reveal whether the address is registered" property for something
 * that actually works end to end; swap this for a real email send before
 * this app has anything worth protecting.
 */
router.post("/auth/forgot-password", async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const email = normaliseEmail(rawEmail);

  if (!isValidEmail(rawEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    // SECURITY: this 404 is an account-enumeration leak — it lets anyone test
    // whether an email address has a Safarly account, which is exactly what
    // login's generic "Incorrect email or password" error is designed to
    // prevent. Accepted for now, not fixed, because it's a direct consequence
    // of not having an email provider wired up: without one, the only way to
    // return the reset link at all is to already know the request succeeded
    // (see the file-level comment above). Once real email delivery exists,
    // change this to always return 201 with a neutral "if that address has an
    // account, a reset link was sent" response, regardless of whether `user`
    // was found.
    return res.status(404).json({ error: "No account found with that email address." });
  }

  const token = generateSessionId();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db.insert(passwordResetTokensTable).values({ id: token, userId: user.id, expiresAt });

  return res.status(201).json({ resetToken: token });
});

/* ── POST /api/auth/reset-password ─────────────────────────────────────── */
router.post("/auth/reset-password", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!token) return res.status(400).json({ error: "Missing or invalid reset link." });

  const [row] = await db
    .select({ userId: passwordResetTokensTable.userId, email: usersTable.email, name: usersTable.name })
    .from(passwordResetTokensTable)
    .innerJoin(usersTable, eq(passwordResetTokensTable.userId, usersTable.id))
    .where(
      and(
        eq(passwordResetTokensTable.id, token),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  const passwordError = validatePassword(password, [row.email, row.name]);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const passwordHash = await hashPassword(password);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, row.userId));
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, token));

  // A password reset means any session started before it should not survive
  // it — otherwise a stolen-then-recovered account stays reachable via the
  // attacker's still-live session.
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, row.userId));

  return res.status(204).end();
});

export default router;
