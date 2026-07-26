import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { buildPreviewPatterns, isOriginAllowed } from "./lib/cors-origin";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
/**
 * Session cookies require `credentials: true`, and a credentialed CORS
 * response may not use a wildcard origin — so the allowed origins must be
 * listed explicitly. CORS_ORIGIN takes a comma-separated list; the defaults
 * cover the Vite dev server, including the random port it picks when 5173 is
 * taken.
 */
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Carries a status so the error handler answers 403 rather than 500. A
 * disallowed origin is a normal thing for a public API to be sent — bots and
 * scanners do it constantly — and reporting it as a server fault buries real
 * failures in the same bucket.
 */
class CorsOriginError extends Error {
  readonly status = 403;
  constructor(origin: string) {
    super(`Origin not allowed by CORS: ${origin}`);
    this.name = "CorsOriginError";
  }
}

/**
 * Preview subdomains are allowed alongside the exact origins — see
 * lib/cors-origin.ts for how the patterns are derived and what that trusts.
 * Built once at startup rather than per request; the allowlist cannot change
 * without a restart.
 */
const previewOriginPatterns = buildPreviewPatterns(allowedOrigins);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin/non-browser callers (curl, health checks) send no Origin.
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin, allowedOrigins, previewOriginPatterns, !isProduction)) {
        return callback(null, true);
      }
      return callback(new CorsOriginError(origin));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
/**
 * JSON only, deliberately. The session cookie is `SameSite=None` in
 * production (it has to be — see routes/auth.ts), so the CORS allowlist above
 * is what stands between a foreign origin and an authenticated request. That
 * only works against body types the browser preflights: parsing form encoding
 * or text/plain would let a cross-site form POST through with cookies
 * attached and no preflight to block it. `express.urlencoded` was removed for
 * exactly this reason — no route needs it. Reintroducing form parsing means
 * adding CSRF tokens first.
 */
app.use(express.json({ limit: "100kb" }));

app.use("/api", router);

/**
 * Final error handler. Without this, an error thrown anywhere upstream —
 * including the CORS `origin` callback rejecting a disallowed origin, or any
 * route handler that forgets a try/catch — falls through to Express's default
 * handler, which renders a full stack trace with absolute filesystem paths as
 * an HTML page. That page is reachable by any non-browser client (curl,
 * server-to-server, bots); a browser's CORS enforcement blocks *reading* the
 * response but never blocks the request from being sent and answered.
 *
 * Must be registered last and keep all four parameters — Express identifies
 * error-handling middleware by arity, not by name.
 */
const handleError: ErrorRequestHandler = (err, req, res, _next) => {
  const status = err?.status ?? 500;
  // A 4xx here is the app rejecting a request on purpose; only 5xx means
  // something actually broke. Logging both at error level made a scanner
  // hitting a disallowed origin look identical to a genuine fault.
  if (status >= 500) req.log?.error({ err }, "Unhandled error");
  else req.log?.warn({ err }, "Request rejected");
  if (res.headersSent) return;
  res.status(status).json({ error: "Something went wrong. Please try again." });
};
app.use(handleError);

export default app;
