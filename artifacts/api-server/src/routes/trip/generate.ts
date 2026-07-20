/**
 * POST /api/trip/generate (SSE) — orchestrates the trip-generation trio.
 *
 * Does NOT generate the itinerary itself. The day-by-day stop/meal selection
 * already exists as a free, deterministic, offline-capable client-side engine
 * (artifacts/safarly/src/lib/engine.ts) that picks from a curated POI dataset —
 * reimplementing that via an LLM would be strictly worse: slower, quota-costly,
 * and able to hallucinate places that don't exist, for something that already
 * works. This endpoint receives the itinerary the client already built and
 * enriches it with the three things a curated dataset genuinely can't provide:
 * real-world events, transport reasoning, and accommodation recommendations.
 *
 * The three sub-agents are independent of each other, so they run concurrently
 * rather than one-after-another — faster, and each agent's own failure doesn't
 * block or delay the other two. "stage: done/error" is emitted as each one
 * actually finishes, in whatever order that happens to be, not a scripted
 * sequence — the staged-progress UI should reflect real completion, not
 * theatre.
 */
import { Router, type IRouter } from "express";
import { requireSession } from "../../lib/session";
import { enforceQuotaUnlessDemo } from "../../lib/agent-quota";
import { isDemoMode } from "../../lib/agent-mode";
import { SseWriter } from "../../lib/sse";
import { logger } from "../../lib/logger";
import type { TripGenerateResult } from "./trip-types";
import { validateRequest } from "./trip-validate";
import { runEventsAgent } from "./events-agent";
import { runTransportAgent } from "./transport-agent";
import { runAccommodationAgent } from "./accommodation-agent";

const router: IRouter = Router();

router.post("/trip/generate", requireSession, enforceQuotaUnlessDemo, async (req, res) => {
  const parsed = validateRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid trip/generate request body." });
    return;
  }

  const demo = isDemoMode();
  const sse = new SseWriter(res);
  let clientGone = false;
  sse.onClientClose(() => { clientGone = true; });

  sse.send("stage", { stage: "planning", status: "start" });
  sse.send("stage", { stage: "planning", status: "done" });

  const result: TripGenerateResult = {
    events: [],
    arrival: { legs: [], summary: "" },
    dayTransport: [],
    accommodation: [],
  };

  sse.send("stage", { stage: "events", status: "start" });
  sse.send("stage", { stage: "transport", status: "start" });
  sse.send("stage", { stage: "accommodation", status: "start" });

  const eventsPromise = runEventsAgent(parsed, demo).then((outcome) => {
    if (clientGone) return;
    if (outcome.ok) {
      result.events = outcome.data;
      sse.send("stage", { stage: "events", status: "done" });
    } else {
      logger.error({ error: outcome.error }, "Events agent did not produce a result");
      sse.send("stage", { stage: "events", status: "error" });
    }
  });

  const transportPromise = runTransportAgent(parsed, demo).then((outcome) => {
    if (clientGone) return;
    if (outcome.ok) {
      result.arrival = outcome.data.arrival;
      result.dayTransport = outcome.data.dayTransport;
      sse.send("stage", { stage: "transport", status: "done" });
    } else {
      logger.error({ error: outcome.error }, "Transportation agent did not produce a result");
      sse.send("stage", { stage: "transport", status: "error" });
    }
  });

  const accommodationPromise = runAccommodationAgent(parsed, demo).then((outcome) => {
    if (clientGone) return;
    if (outcome.ok) {
      result.accommodation = outcome.data;
      sse.send("stage", { stage: "accommodation", status: "done" });
    } else {
      logger.error({ error: outcome.error }, "Accommodation agent did not produce a result");
      sse.send("stage", { stage: "accommodation", status: "error" });
    }
  });

  await Promise.all([eventsPromise, transportPromise, accommodationPromise]);

  if (!clientGone) {
    sse.send("result", result);
  }
  sse.close();
});

export default router;
