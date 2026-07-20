/**
 * Per-user throttle for agent routes.
 *
 * The Gemini free tier is 10 requests/minute and 250/day across the WHOLE key,
 * not per user. So one enthusiastic user can exhaust the quota for everybody.
 * This caps each user well below the shared ceiling, and also caps the total,
 * so a burst degrades into "try again shortly" rather than Google 429s
 * surfacing as broken features.
 *
 * In-memory, so it resets on restart and is per-instance — same trade-off the
 * login throttle in routes/auth.ts makes. Replace with a shared store before
 * running more than one instance.
 */
import type { Request, Response, NextFunction } from "express";
import { isDemoMode } from "./agent-mode";

const USER_PER_MINUTE = 4;
const USER_PER_DAY = 40;

/** Held below the real 10 RPM so concurrent users don't collide at the ceiling. */
const GLOBAL_PER_MINUTE = 8;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  minuteCount: number;
  minuteStart: number;
  dayCount: number;
  dayStart: number;
}

const buckets = new Map<string, Bucket>();
let globalMinuteCount = 0;
let globalMinuteStart = Date.now();

function rollWindows(b: Bucket, now: number): void {
  if (now - b.minuteStart >= MINUTE_MS) {
    b.minuteCount = 0;
    b.minuteStart = now;
  }
  if (now - b.dayStart >= DAY_MS) {
    b.dayCount = 0;
    b.dayStart = now;
  }
}

export interface QuotaResult {
  allowed: boolean;
  reason?: "user-minute" | "user-day" | "global-minute";
  retryAfterSeconds: number;
}

export function consumeQuota(userId: string): QuotaResult {
  const now = Date.now();

  if (now - globalMinuteStart >= MINUTE_MS) {
    globalMinuteCount = 0;
    globalMinuteStart = now;
  }

  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = { minuteCount: 0, minuteStart: now, dayCount: 0, dayStart: now };
    buckets.set(userId, bucket);
  }
  rollWindows(bucket, now);

  const secondsLeftInMinute = () =>
    Math.max(1, Math.ceil((MINUTE_MS - (now - bucket.minuteStart)) / 1000));

  if (bucket.dayCount >= USER_PER_DAY) {
    return {
      allowed: false,
      reason: "user-day",
      retryAfterSeconds: Math.max(1, Math.ceil((DAY_MS - (now - bucket.dayStart)) / 1000)),
    };
  }
  if (bucket.minuteCount >= USER_PER_MINUTE) {
    return { allowed: false, reason: "user-minute", retryAfterSeconds: secondsLeftInMinute() };
  }
  if (globalMinuteCount >= GLOBAL_PER_MINUTE) {
    return {
      allowed: false,
      reason: "global-minute",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((MINUTE_MS - (now - globalMinuteStart)) / 1000),
      ),
    };
  }

  bucket.minuteCount++;
  bucket.dayCount++;
  globalMinuteCount++;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Must run after requireSession — quota is attributed to `req.user`. */
export function enforceQuota(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Sign in to use this feature." });
    return;
  }

  const result = consumeQuota(userId);
  if (result.allowed) {
    next();
    return;
  }

  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  res.status(429).json({
    error:
      result.reason === "user-day"
        ? "You've reached today's limit for AI features. It resets in 24 hours."
        : "Too many AI requests at once. Try again in a moment.",
    retryAfterSeconds: result.retryAfterSeconds,
  });
}

/**
 * Demo-mode responses cost nothing, so there is nothing to protect them from —
 * gating them behind the same throttle would only add rate-limit friction to
 * local development and preview deploys, the two cases demo mode exists for.
 */
export function enforceQuotaUnlessDemo(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isDemoMode()) {
    next();
    return;
  }
  enforceQuota(req, res, next);
}
