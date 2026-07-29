/**
 * Ranking inputs and scoring constants for the "top rated" feeds.
 *
 * Split from the route for the same reason as posts-validate: the query
 * parsing is a trust boundary (`limit` goes straight into a LIMIT clause) and
 * is worth testing without a DB or an Express boot.
 */

export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 50;
const MAX_CITY = 80;

/**
 * Hacker-News-style decay: score = likes / (age_hours + offset) ^ gravity.
 *
 * Sorting on raw like counts would freeze the leaderboard — the first story to
 * accumulate likes stays on top forever and nothing new can displace it, which
 * is fatal for a feed meant to surface current travel content. The offset stops
 * a minutes-old post with one like from dividing by ~0 and rocketing to the
 * top.
 *
 * These are conventional starting values, not tuned against real traffic.
 * Revisit once there is enough volume to tell whether the feed turns over too
 * fast or too slowly.
 */
export const GRAVITY = 1.5;
export const AGE_OFFSET_HOURS = 2;

export interface RankingQuery {
  /** Null means "all cities" rather than a city literally named "null". */
  city: string | null;
  limit: number;
}

/**
 * Never throws — a malformed limit falls back to the default rather than
 * 400ing a read that is otherwise perfectly serviceable. Reads here are
 * public and cheap; being forgiving costs nothing and being strict would turn
 * a stray query string into an empty page.
 *
 * City is lowercased to match how posts-validate stores it. An unknown city is
 * not rejected: it simply matches no rows, which is the same answer as a real
 * city with no stories yet.
 */
export function parseRankingQuery(query: Record<string, unknown> | undefined): RankingQuery {
  const rawCity = query?.city;
  const city =
    typeof rawCity === "string" && rawCity.trim().length > 0
      ? rawCity.trim().toLowerCase().slice(0, MAX_CITY)
      : null;

  const rawLimit = query?.limit;
  const parsed = typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : Number.NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;

  return { city, limit };
}
