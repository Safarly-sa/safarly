/**
 * The Personal Concierge — a floating chat panel over the itinerary.
 *
 * Deliberately non-modal. The whole point of this surface is that you watch
 * your itinerary change while you talk to it, so the panel sits beside the trip
 * rather than covering it, and the page underneath stays scrollable. That rules
 * out `aria-modal` and a focus trap: both would tell assistive tech the rest of
 * the page had gone away, when in fact it's the thing being edited.
 *
 * Conversation state lives here and nowhere else. The endpoint is stateless, so
 * this component owns the history it replays each turn; the ITINERARY, by
 * contrast, is owned by the page and only ever changed through
 * `onItineraryChange` — the concierge proposes, the page persists.
 */
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Wand2 } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { languageNameOf } from "@/lib/language-names";
import {
  applyConciergePatch,
  buildConciergeState,
  sendConciergeMessage,
  type ConciergeChatTurn,
  type ConciergeErrorCode,
} from "@/lib/concierge-api";
import type { ItineraryResult, POI, TripSpec } from "@/lib/engine";

interface Message {
  id: number;
  role: "user" | "model";
  text: string;
  /** Which tool the server reported running for this turn, if any. */
  tool?: string;
  /** How many itinerary actions actually landed, for the "updated" chip. */
  applied?: number;
  errorCode?: ConciergeErrorCode;
}

const TOOL_LABEL_KEYS: Record<string, string> = {
  edit_itinerary: "concierge.tool.edit_itinerary",
  search_events:  "concierge.tool.search_events",
};

function errorKey(code: ConciergeErrorCode): string {
  // bad-request means this client sent something malformed — nothing the
  // traveller can act on, so it reads as a generic failure rather than
  // blaming their input.
  if (code === "bad-request") return "concierge.err.unknown";
  return `concierge.err.${code}`;
}

export function ConciergeChat({
  itinerary, trip, cityPois, onItineraryChange,
}: {
  itinerary: ItineraryResult;
  trip: TripSpec;
  cityPois: POI[];
  onItineraryChange: (next: ItineraryResult, summary: string) => void;
}) {
  const { t, language, dir } = useTranslation();

  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const logRef      = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const nextId      = useRef(0);

  // The page re-renders this component with a fresh itinerary after every
  // patch, but the request builder needs whatever is current at SEND time —
  // reading through a ref avoids sending a stale trip on a fast second turn.
  const itineraryRef = useRef(itinerary);
  itineraryRef.current = itinerary;

  /* ── Open/close: focus, Escape, and cancelling an in-flight turn ──── */
  useEffect(() => {
    if (!open) return undefined;

    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Focus has to go somewhere deliberate. Without this it falls to <body>,
      // which drops a keyboard user out of the tab order entirely — they'd have
      // to tab from the top of the page to get back to the launcher.
      launcherRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Abort any streaming turn when the panel closes or the page unmounts, so a
  // reply can't keep arriving into a component nobody is looking at.
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* ── Keep the newest text in view as it streams ──────────────────── */
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function closeAndRestoreFocus() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    // History is the conversation BEFORE this turn, and only turns that
    // actually carry content — an errored turn never reached the model, so
    // replaying it would describe a conversation that didn't happen.
    const history: ConciergeChatTurn[] = messages
      .filter((m) => !m.errorCode && m.text.trim())
      .map((m) => ({ role: m.role, text: m.text }));

    const userId  = nextId.current++;
    const replyId = nextId.current++;

    setMessages((prev) => [
      ...prev,
      { id: userId,  role: "user",  text },
      { id: replyId, role: "model", text: "" },
    ]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const current = itineraryRef.current;
    const state   = buildConciergeState(current, cityPois);

    const outcome = await sendConciergeMessage(
      {
        message: text,
        history,
        languageName: languageNameOf(language),
        dateStart: trip.dateStart,
        dateEnd: trip.dateEnd,
        ...state,
      },
      {
        signal: controller.signal,
        onToken: (chunk) => {
          setMessages((prev) => prev.map((m) =>
            m.id === replyId ? { ...m, text: m.text + chunk } : m));
        },
        onToolCall: (name) => {
          setMessages((prev) => prev.map((m) =>
            m.id === replyId ? { ...m, tool: name } : m));
        },
        onPatch: (patch) => {
          const poisById = new Map(cityPois.map((p) => [p.id, p]));
          const { result, appliedCount } = applyConciergePatch(
            itineraryRef.current, patch, poisById, trip.budget,
          );
          if (appliedCount === 0) return;

          itineraryRef.current = result;
          onItineraryChange(result, patch.summary);
          setMessages((prev) => prev.map((m) =>
            m.id === replyId ? { ...m, applied: appliedCount } : m));
        },
      },
    );

    // A turn the traveller cancelled by closing the panel isn't a failure and
    // must not render as one.
    if (controller.signal.aborted) return;

    abortRef.current = null;
    setBusy(false);

    if (!outcome.ok) {
      setMessages((prev) => prev.map((m) =>
        m.id === replyId ? { ...m, errorCode: outcome.code } : m));
    }
  }

  const isRtl = dir === "rtl";

  return (
    <>
      {/* ── Launcher ─────────────────────────────────────────────────── */}
      <button
        ref={launcherRef}
        type="button"
        className="sf-concierge-launch"
        aria-label={t("concierge.launch")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} aria-hidden /> : <MessageCircle size={20} aria-hidden />}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="sf-concierge-panel"
          role="dialog"
          aria-label={t("concierge.title")}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 16px", borderBottom: "1px solid var(--sf-border)",
          }}>
            <MessageCircle size={17} aria-hidden style={{ color: "var(--sf-indigo)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--sf-text)" }}>
                {t("concierge.title")}
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)" }}>
                {t("concierge.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={closeAndRestoreFocus}
              aria-label={t("concierge.close")}
              style={{
                minWidth: 44, minHeight: 44, display: "flex", alignItems: "center",
                justifyContent: "center", background: "none", border: "none",
                color: "var(--sf-text-muted)", cursor: "pointer", flexShrink: 0,
              }}
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          {/* Message log */}
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}
          >
            {messages.length === 0 && (
              <p style={{ fontSize: "0.8125rem", lineHeight: 1.65, color: "var(--sf-text-muted)" }}>
                {t("concierge.greeting")}
              </p>
            )}

            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    display: "flex", flexDirection: "column", gap: 4,
                    alignItems: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{
                    background:   isUser ? "var(--sf-indigo)" : "var(--sf-surface-alt)",
                    color:        isUser ? "#fff" : "var(--sf-text)",
                    border:       isUser ? "none" : "1px solid var(--sf-border)",
                    borderRadius: 12,
                    padding:      "9px 12px",
                    fontSize:     "0.8125rem",
                    lineHeight:   1.6,
                    whiteSpace:   "pre-wrap",
                    wordBreak:    "break-word",
                  }}>
                    {m.errorCode
                      ? t(errorKey(m.errorCode))
                      : m.text || (m.tool ? t(TOOL_LABEL_KEYS[m.tool] ?? "concierge.thinking") : t("concierge.thinking"))}
                  </div>

                  {/* Only claim the itinerary changed when actions actually landed. */}
                  {m.applied !== undefined && m.applied > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: "0.6875rem", fontWeight: 700,
                      color: "var(--sf-success)",
                      background: "color-mix(in srgb, var(--sf-success) 12%, var(--sf-surface))",
                      padding: "2px 8px", borderRadius: 999,
                    }}>
                      <Wand2 size={11} aria-hidden />
                      {t("concierge.applied").replace("{n}", String(m.applied))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            style={{
              display: "flex", gap: 8, padding: "12px 16px",
              borderTop: "1px solid var(--sf-border)",
            }}
          >
            <label htmlFor="concierge-input" className="sf-sr-only">
              {t("concierge.placeholder")}
            </label>
            <input
              id="concierge-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("concierge.placeholder")}
              disabled={busy}
              maxLength={1000}
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0, minHeight: 44,
                padding: "0 12px", borderRadius: 10,
                border: "1px solid var(--sf-border)",
                background: "var(--sf-bg)", color: "var(--sf-text)",
                fontSize: "0.875rem",
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t("concierge.send")}
              style={{
                minWidth: 44, minHeight: 44, borderRadius: 10, border: "none",
                background: busy || !input.trim() ? "var(--sf-surface-alt)" : "var(--sf-indigo)",
                color: busy || !input.trim() ? "var(--sf-text-muted)" : "#fff",
                cursor: busy || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {busy
                ? <Loader2 size={17} aria-hidden className="sf-concierge-spin" />
                : <Send size={17} aria-hidden style={isRtl ? { transform: "scaleX(-1)" } : undefined} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
