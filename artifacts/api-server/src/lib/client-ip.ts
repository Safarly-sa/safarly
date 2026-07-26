/**
 * The caller's real IP, for the login throttle in routes/auth.ts.
 *
 * `req.ip` is the socket's peer address, which behind a reverse proxy is the
 * proxy — identical for every caller. The throttle keys on `ip:email`, so
 * that does not disable it (per-email throttling, the main defence against
 * brute-forcing one account, still works) but it does erase the IP
 * dimension: one source can walk a list of different addresses and never
 * trip a limit, because each email gets its own fresh bucket.
 *
 * Express's `trust proxy` is the usual answer and is deliberately not used.
 * Setting it `true` makes `req.ip` the *leftmost* X-Forwarded-For entry,
 * which the client writes — so it would hand an attacker a rate-limit bypass
 * via a forged header, worse than the problem. Setting it to a hop count
 * means hardcoding how many proxies are in front, which changes with the
 * hosting and fails silently when it drifts.
 *
 * Instead the header is named explicitly per deployment via
 * CLIENT_IP_HEADER, and only ever read when configured. On Render (fronted
 * by Cloudflare) that is `cf-connecting-ip`, which the edge overwrites on
 * every request, so a client cannot forge it. Unset — including all local
 * development — falls back to `req.ip` and behaves exactly as before.
 *
 * This is only sound while the origin is unreachable except through that
 * proxy. If the app is ever exposed directly, a client can send the header
 * itself and the value becomes attacker-controlled; unset the variable if
 * that happens.
 */
const CLIENT_IP_HEADER = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();

/** `headerName` is injectable so the behaviour is testable without touching process.env. */
export function resolveClientIp(
  headers: Record<string, string | string[] | undefined>,
  socketIp: string | undefined,
  headerName: string | undefined = CLIENT_IP_HEADER,
): string {
  if (headerName) {
    const raw = headers[headerName];
    // A repeated header arrives as an array; only a single value is
    // meaningful for an identity, so anything else is treated as absent
    // rather than guessed at.
    const value = typeof raw === "string" ? raw.trim() : undefined;
    if (value) return value;
  }
  return socketIp ?? "unknown";
}
