/**
 * Demo-mode chat: no Gemini call, just enough keyword matching to make the
 * frontend's real acceptance scenarios testable without a key — specifically
 * "move day 2 to be more relaxed", which the spec calls out explicitly as
 * something that must actually edit the stored trip. This is a heuristic for
 * demo purposes only, not a stand-in for real language understanding.
 */
import type { ConciergeChatRequest, ConciergeAction } from "./concierge-types";
import { SseWriter } from "../../lib/sse";

const RELAX_WORDS = /\b(relax|relaxed|lighter|less busy|easier|slower|calmer)\b/i;
const EVENT_WORDS = /\b(event|festival|happening|things to do|what'?s on)\b/i;
const DAY_NUMBER_RE = /day\s*(\d+)/i;

function findDayNumber(message: string, days: ConciergeChatRequest["days"]): number | null {
  const match = message.match(DAY_NUMBER_RE);
  if (match) {
    const n = Number(match[1]);
    if (days.some((d) => d.dayNumber === n)) return n;
  }
  // No explicit day mentioned — fall back to the first day that actually has stops to remove.
  return days.find((d) => d.stops.length > 0)?.dayNumber ?? null;
}

export async function runDemoChat(req: ConciergeChatRequest, sse: SseWriter): Promise<void> {
  await new Promise((r) => setTimeout(r, 500));

  if (RELAX_WORDS.test(req.message)) {
    const dayNumber = findDayNumber(req.message, req.days);
    const day = req.days.find((d) => d.dayNumber === dayNumber);

    if (day && day.stops.length > 1) {
      // Demo heuristic: drop the last-scheduled stop, the one most likely to
      // feel like "one too many" rather than a hard split of the day.
      const toRemove = day.stops[day.stops.length - 1];
      const action: ConciergeAction = { type: "remove_stop", dayNumber: day.dayNumber, poiId: toRemove.id };
      const summary = `Removed ${toRemove.name} from day ${day.dayNumber} to leave more downtime.`;

      sse.send("tool_call", { name: "edit_itinerary" });
      sse.send("patch", { actions: [action], summary });
      await sendText(sse, summary + " Let me know if you'd like anything else adjusted.");
      return;
    }

    await sendText(
      sse,
      "I'd like to lighten that day, but I don't see enough stops on it to safely remove one — want to tell me which day?",
    );
    return;
  }

  if (EVENT_WORDS.test(req.message)) {
    sse.send("tool_call", { name: "search_events" });
    await sendText(
      sse,
      `I don't have live listings in demo mode, but ${req.cityDisplayName} usually has seasonal festivals and markets running — worth checking the city's official tourism season program for exact dates during your trip.`,
    );
    return;
  }

  await sendText(
    sse,
    "I'm running in demo mode right now, so I can't reason freely, but I can still adjust your itinerary — try asking me to make a specific day more relaxed.",
  );
}

async function sendText(sse: SseWriter, text: string): Promise<void> {
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 6) {
    sse.send("token", { text: words.slice(i, i + 6).join("") });
    await new Promise((r) => setTimeout(r, 40));
  }
}
