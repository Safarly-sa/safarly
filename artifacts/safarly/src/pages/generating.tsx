/**
 * /generating — Animated agent activity feed
 *
 * 1. Reads safarly_profile + safarly_trip from localStorage
 * 2. Runs generateItinerary() synchronously (all local data)
 * 3. Reveals 8 agent lines with computed output over ~7 s
 * 4. Saves safarly_itinerary → localStorage → navigates to /itinerary
 *
 * Design: mobile-first 390px, RTL-safe (logical CSS only), theme-agnostic
 * (pure CSS variables — no hardcoded colours).
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { generateItinerary, type ItineraryResult, type Objectives } from "@/lib/engine";
import { useTranslation } from "@/providers/I18nProvider";

// ── Style injection ──────────────────────────────────────────────────────────

function useGenStyles() {
  useEffect(() => {
    const id = "sf-gen-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes sf-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      .sf-cursor {
        display: inline-block;
        width: 2px;
        height: 1em;
        background: var(--sf-accent);
        margin-inline-start: 3px;
        vertical-align: middle;
        animation: sf-blink 0.9s step-start infinite;
        border-radius: 1px;
      }
      @keyframes sf-spin-slow {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      .sf-spin { animation: sf-spin-slow 3s linear infinite; }
      @keyframes sf-pulse-ring {
        0%   { transform: scale(1);   opacity: 0.6; }
        70%  { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      .sf-pulse-ring {
        position: absolute; inset: -8px;
        border-radius: 50%;
        border: 2px solid var(--sf-accent);
        animation: sf-pulse-ring 2s ease-out infinite;
        pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  }, []);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentLine {
  /** i18n key for the agent chip label */
  agentKey: string;
  /** Parsed segments: alternate plain text and highlighted (accent) runs */
  segments: Array<{ text: string; highlight: boolean }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format 0–1 fraction as "nn%" */
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

/** Format SAR number with comma separator */
function sar(v: number) {
  return `SAR ${Math.round(v).toLocaleString()}`;
}

/**
 * Build a tagged segment list from a template string.
 * Tokens wrapped in ** are rendered in --sf-accent colour.
 * e.g. "Found **18** candidates" → [{text:"Found ", h:false},{text:"18", h:true},{text:" candidates", h:false}]
 */
function seg(template: string): AgentLine["segments"] {
  const parts = template.split(/\*\*(.*?)\*\*/);
  return parts.map((t, i) => ({ text: t, highlight: i % 2 === 1 }));
}

function buildAgentLines(
  result: ItineraryResult,
  trip: { budget: number; city: string },
  t: (k: string) => string,
): AgentLine[] {
  const { objectives: obj } = result;

  // Top 3 objectives sorted by weight
  const topObj = (Object.entries(obj) as [keyof Objectives, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${t(`gen.obj.${k}`)} **${pct(v)}**`)
    .join(" · ");

  const totalStops = result.days.reduce((n, d) => n + d.stops.length, 0);
  const budgetFlag = result.totalCostSar <= trip.budget * result.days.length ? "✓" : "⚠";

  return [
    {
      agentKey: "agents.chips.goal",
      segments: seg(`${t("gen.agent.goal_prefix")} ${topObj}`),
    },
    {
      agentKey: "agents.chips.discovery",
      segments: seg(
        t("gen.agent.discovery")
          .replace("{city}", `**${trip.city.charAt(0).toUpperCase() + trip.city.slice(1)}**`)
          .replace("{total}", `**${result.candidateCount}**`)
          .replace("{matched}", `**${totalStops}**`),
      ),
    },
    {
      agentKey: "agents.chips.restaurant",
      segments: seg(
        t("gen.agent.restaurant").replace("{count}", `**${result.safeDishCount}**`),
      ),
    },
    {
      agentKey: "agents.chips.budget",
      segments: seg(
        t("gen.agent.budget")
          .replace("{total}", `**${sar(result.totalCostSar)}**`)
          .replace("{daily}", `**${sar(trip.budget)}**`)
          .replace("{flag}", `**${budgetFlag}**`),
      ),
    },
    {
      agentKey: "agents.chips.culture",
      segments: seg(
        t("gen.agent.culture").replace("{count}", `**${result.culturalNotesCount}**`),
      ),
    },
    {
      agentKey: "agents.chips.safety",
      segments: seg(t("gen.agent.safety")),
    },
    {
      agentKey: "agents.chips.sustainability",
      segments: seg(
        t("gen.agent.sustainability").replace("{pct}", `**${result.hiddenGemShare}%**`),
      ),
    },
    {
      agentKey: "agents.chips.verification",
      segments: seg(
        t("gen.agent.verification").replace("{count}", `**${result.verifiedCount}**`),
      ),
    },
  ];
}

// ── Typewriter hook ──────────────────────────────────────────────────────────

/**
 * Returns the number of full characters to display, incrementing at `cps`
 * characters per second starting as soon as the hook mounts.
 */
function useTypewriter(fullText: string, cps = 60): number {
  const [charCount, setCharCount] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCharCount(0);
    const interval = Math.round(1000 / cps);
    ref.current = setInterval(() => {
      setCharCount((c) => {
        if (c >= fullText.length) {
          if (ref.current) clearInterval(ref.current);
          return c;
        }
        return c + 1;
      });
    }, interval);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [fullText, cps]);

  return charCount;
}

// ── AgentLine component ──────────────────────────────────────────────────────

function AgentFeedLine({
  line,
  isLast,
  agentLabel,
}: {
  line: AgentLine;
  isLast: boolean;
  agentLabel: string;
}) {
  // Build the full plain-text version for the typewriter character count
  const fullText = line.segments.map((s) => s.text).join("");
  const charCount = useTypewriter(fullText, 55);

  // Distribute char count across segments
  let remaining = charCount;
  const renderedSegments = line.segments.map((seg) => {
    const visible = Math.max(0, Math.min(seg.text.length, remaining));
    remaining -= visible;
    return { ...seg, visible: seg.text.slice(0, visible) };
  });

  const done = charCount >= fullText.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        padding: "10px 14px",
        borderRadius: "10px",
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        fontSize: "0.8125rem",
        lineHeight: 1.5,
      }}
    >
      {/* Agent name */}
      <span
        style={{
          color: "var(--sf-indigo)",
          fontWeight: 700,
          fontSize: "0.6875rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {agentLabel}
      </span>

      {/* Output line */}
      <span style={{ color: "var(--sf-text-muted)" }}>
        {renderedSegments.map((seg, i) => (
          <span
            key={i}
            style={
              seg.highlight
                ? { color: "var(--sf-accent)", fontWeight: 600 }
                : undefined
            }
          >
            {seg.visible}
          </span>
        ))}
        {/* Blinking cursor on the active last line only */}
        {isLast && !done && <span className="sf-cursor" aria-hidden="true" />}
      </span>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function Generating() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  useGenStyles();

  const [visibleLines, setVisibleLines] = useState<AgentLine[]>([]);
  const [agentLabels, setAgentLabels] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Load saved data
    let profile: ReturnType<typeof JSON.parse> | null = null;
    let trip: ReturnType<typeof JSON.parse> | null = null;
    try {
      profile = JSON.parse(localStorage.getItem("safarly_profile") ?? "null");
      trip = JSON.parse(localStorage.getItem("safarly_trip") ?? "null");
    } catch {
      // ignore parse errors
    }

    if (!profile || !trip) {
      navigate("/");
      return;
    }

    // Run engine (synchronous, ~1 ms)
    const result = generateItinerary(profile, trip);

    // Build agent lines from actual computed output
    const lines = buildAgentLines(result, trip, t);
    const labels = lines.map((l) => t(l.agentKey));

    // Reveal schedule: 8 agents over ~6.4 s
    const DELAYS_MS = [500, 1250, 2000, 2750, 3500, 4250, 5000, 5750];
    const TOTAL_AGENTS = lines.length;
    const timers: ReturnType<typeof setTimeout>[] = [];

    DELAYS_MS.forEach((delay, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines((prev) => [...prev, lines[i]]);
          setAgentLabels((prev) => [...prev, labels[i]]);
          setProgress(Math.round(((i + 1) / TOTAL_AGENTS) * 100));
        }, delay),
      );
    });

    // Save result + redirect after last agent finishes typing
    timers.push(
      setTimeout(() => {
        localStorage.setItem("safarly_itinerary", JSON.stringify(result));
        setRedirecting(true);
      }, 6600),
    );

    timers.push(
      setTimeout(() => {
        navigate("/itinerary");
      }, 7200),
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 96px",
        background: "var(--sf-bg)",
        boxSizing: "border-box",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          marginBottom: "32px",
          textAlign: "center",
        }}
      >
        {/* Animated logo ring */}
        <div style={{ position: "relative", width: 64, height: 64 }}>
          <span className="sf-pulse-ring" />
          <div
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--sf-surface)",
              border: "2px solid var(--sf-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", zIndex: 1,
            }}
          >
            <svg
              viewBox="0 0 40 40"
              fill="none"
              className="sf-spin"
              style={{ width: 28, height: 28 }}
              aria-hidden="true"
            >
              {/* Outer ring with gaps — looks like a processing spinner */}
              <circle cx="20" cy="20" r="17" stroke="var(--sf-border)" strokeWidth="2" />
              <path
                d="M20 3 A17 17 0 0 1 37 20"
                stroke="var(--sf-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M20 37 A17 17 0 0 1 3 20"
                stroke="var(--sf-indigo)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="20" cy="20" r="4" fill="var(--sf-accent)" opacity="0.9" />
            </svg>
          </div>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(1.25rem, 5vw, 1.75rem)",
            fontWeight: 700,
            color: "var(--sf-text)",
            lineHeight: 1.2,
          }}
        >
          {t("gen.title")}
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--sf-text-muted)",
            maxWidth: 340,
          }}
        >
          {t("gen.subtitle")}
        </p>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "6px",
            fontSize: "0.75rem",
            color: "var(--sf-text-muted)",
          }}
        >
          <span>{t("gen.progress_label")}</span>
          <span style={{ color: "var(--sf-accent)", fontWeight: 600 }}>
            {progress}%
          </span>
        </div>

        {/* Track */}
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--sf-surface-alt)",
            overflow: "hidden",
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("gen.progress_label")}
        >
          {/* Fill */}
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              height: "100%",
              borderRadius: 3,
              background: `linear-gradient(90deg, var(--sf-indigo), var(--sf-accent))`,
              minWidth: progress > 0 ? 6 : 0,
            }}
          />
        </div>
      </div>

      {/* ── Agent feed ────────────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <AnimatePresence>
          {visibleLines.map((line, i) => (
            <AgentFeedLine
              key={i}
              line={line}
              isLast={i === visibleLines.length - 1}
              agentLabel={agentLabels[i] ?? ""}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Redirecting notice ────────────────────────────────────────── */}
      <AnimatePresence>
        {redirecting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 28,
              fontSize: "0.875rem",
              color: "var(--sf-accent)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8, height: 8,
                borderRadius: "50%",
                background: "var(--sf-accent)",
                animation: "sf-blink 0.8s step-start infinite",
              }}
            />
            {t("gen.redirecting")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
