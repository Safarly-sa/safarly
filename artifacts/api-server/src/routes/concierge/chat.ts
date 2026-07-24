/**
 * POST /api/concierge/chat (SSE) — the orchestrator and only conversational
 * surface. Reads the trip state the client sends (itinerary, dates,
 * candidate POIs), tool-calls edit_itinerary / search_events as needed, and
 * streams a reply.
 *
 * Streaming note: the underlying Gemini calls in the tool-decision loop are
 * NOT streamed — generateContentStream's chunk-by-chunk function-call
 * disambiguation isn't something this environment can verify without a live
 * key, and getting that wrong would be a silent correctness bug, not a
 * cosmetic one. Once the final round produces plain text with no more tool
 * calls, THAT text is sent to the client in small SSE chunks with a short
 * delay between them, so the SSE connection still delivers a genuine
 * incremental-arrival experience — it's server-side chunking of a complete
 * response, not token-level model streaming. Upgrade to real streaming once
 * this has run against a real key and the round-trip shape is confirmed.
 *
 * No server-side trip persistence: trips live in localStorage today (see
 * CLAUDE.md's "Auth is localStorage-only" — the same is true of trip data).
 * This endpoint is stateless per request; the client sends chat history and
 * itinerary state each turn, and applies the returned patch to its own copy.
 */
import { Router, type IRouter, type Response } from "express";
import type { Content, Part } from "@google/genai";
import { getGemini, GEMINI_MODEL } from "../../lib/gemini";
import { requireSession } from "../../lib/session";
import { enforceQuotaUnlessDemo } from "../../lib/agent-quota";
import { isDemoMode } from "../../lib/agent-mode";
import { SseWriter } from "../../lib/sse";
import { logger } from "../../lib/logger";
import { CONCIERGE_TOOLS, buildPatch, runEventsSearch } from "./concierge-tools";
import { validateChatRequest } from "./chat-validate";
import type { ConciergeChatRequest, ConciergePatch, ConciergePoi } from "./concierge-types";
import { runDemoChat } from "./chat-demo";

const router: IRouter = Router();

const MAX_TOOL_ROUNDS = 4;

/** One line per stop/candidate, "id — name" — the exact vocabulary edit_itinerary's poiId/addPoiId/stopOrder must be drawn from. */
function poiLine(poi: ConciergePoi): string {
  return `${poi.id} — ${poi.name}`;
}

function itineraryContext(req: ConciergeChatRequest): string {
  const days = req.days
    .map((d) => `Day ${d.dayNumber}:\n${d.stops.map((s) => `  - ${poiLine(s)}`).join("\n") || "  (no stops)"}`)
    .join("\n");
  const candidates = req.candidatePois.map((p) => `  - ${poiLine(p)}`).join("\n") || "  (none)";

  return `Current itinerary (use these exact ids for poiId/removePoiId/stopOrder — never invent one from a name):
${days}

Candidate POIs available to add (use these exact ids for addPoiId — the only valid targets for add_stop/swap_stop):
${candidates}`;
}

function systemPrompt(req: ConciergeChatRequest): string {
  return `You are Safarly's travel concierge for a trip to ${req.cityDisplayName}, Saudi Arabia, ${req.dateStart} to ${req.dateEnd}.

You can change the traveller's itinerary with the edit_itinerary tool, and look up events with search_events. Only call edit_itinerary when they've actually asked for a change — answering a question is not a change. When you do call it, keep changes proportionate to what they asked for (a request to make one day lighter should remove or swap one or two stops on that day, not restructure the whole trip).

${itineraryContext(req)}

You have no live access to current prices, exact travel times, or confirmed event dates — be genuinely helpful but honest about that uncertainty rather than inventing precision you don't have. Keep replies conversational and brief. Respond in ${req.languageName}.`;
}

/** Sends `text` as a handful of SSE chunks rather than one blob — see the module doc comment. */
async function streamReplyText(sse: SseWriter, text: string): Promise<void> {
  const words = text.split(/(\s+)/); // keep whitespace so rejoining is exact
  const CHUNK_WORDS = 6;
  for (let i = 0; i < words.length; i += CHUNK_WORDS) {
    sse.send("token", { text: words.slice(i, i + CHUNK_WORDS).join("") });
    await new Promise((r) => setTimeout(r, 40));
  }
}

async function runLiveChat(req: ConciergeChatRequest, sse: SseWriter): Promise<void> {
  const ai = getGemini();

  const contents: Content[] = [
    ...req.history.map((h): Content => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: req.message }] },
  ];

  let patch: ConciergePatch | null = null;
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt(req),
        tools: [{ functionDeclarations: CONCIERGE_TOOLS }],
        temperature: 0.5,
      },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      finalText = response.text ?? "";
      break;
    }

    const modelTurn = response.candidates?.[0]?.content;
    if (modelTurn) contents.push(modelTurn);

    const responseParts: Part[] = [];
    for (const call of calls) {
      sse.send("tool_call", { name: call.name });

      if (call.name === "edit_itinerary") {
        patch = buildPatch(call.args, req.days, req.candidatePois);
        sse.send("patch", patch);
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: { output: { appliedActions: patch.actions.length, summary: patch.summary } },
          },
        });
      } else if (call.name === "search_events") {
        const query = typeof call.args?.query === "string" ? call.args.query : req.message;
        const events = await runEventsSearch(
          query,
          req.cityDisplayName,
          req.dateStart,
          req.dateEnd,
          req.languageName,
          false,
        );
        responseParts.push({
          functionResponse: { name: call.name, response: { output: { events } } },
        });
      } else {
        responseParts.push({
          functionResponse: { name: call.name ?? "unknown", response: { error: "unrecognised tool" } },
        });
      }
    }
    contents.push({ role: "user", parts: responseParts });
  }

  if (!finalText) {
    finalText = patch
      ? patch.summary || "Done — I've updated your itinerary."
      : "I couldn't quite finish that thought — could you rephrase?";
  }

  await streamReplyText(sse, finalText);
}

router.post("/concierge/chat", requireSession, enforceQuotaUnlessDemo, async (req, res: Response) => {
  const parsed = validateChatRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid concierge/chat request body." });
    return;
  }

  const sse = new SseWriter(res);
  let clientGone = false;
  sse.onClientClose(() => { clientGone = true; });

  try {
    if (isDemoMode()) {
      await runDemoChat(parsed, sse);
    } else {
      await runLiveChat(parsed, sse);
    }
  } catch (err) {
    logger.error({ err }, "Concierge chat failed");
    if (!clientGone) sse.send("error", { error: "The concierge couldn't respond. Try again." });
  }

  sse.close();
});

export default router;
