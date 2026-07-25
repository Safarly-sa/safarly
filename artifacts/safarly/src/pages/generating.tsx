import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  generateItinerary,
  CITY_NAMES_AR,
  type ItineraryResult,
  type TravelerProfile,
  type TripSpec,
} from "@/lib/engine";
import {
  applyEnrichment,
  buildEnrichRequest,
  enrichTrip,
  type TripEnrichment,
} from "@/lib/trip-api";
import { languageNameOf } from "@/lib/language-names";
import { getAuth } from "@/lib/auth";

/**
 * Used when someone reaches this screen without having filled in a traveller
 * profile — which is now the normal path, not an error: anyone can plan a trip
 * before they have an account, and profile-setup lives behind the sign-in wall.
 *
 * Every field the engine reads is optional in practice (`profile.interests ??
 * []`, `profile.allergies ?? []`, and `travelType` only ever compared against
 * "family"), so a neutral profile costs nothing but the personalisation layer:
 * objectives still come from the trip's own goals, moods and travel context.
 *
 * Deliberately NOT allergy-safe-by-guessing: an empty `allergies` array means
 * "none declared", and the itinerary's dish filtering treats it that way. That
 * is the honest default — inventing restrictions nobody asked for would be just
 * as wrong as dropping real ones.
 */
const DEFAULT_PROFILE: TravelerProfile = {
  nationality:   "",
  language:      "en",
  ageRange:      "",
  dietary:       "",
  allergies:     [],
  travelType:    "",
  accessibility: false,
  interests:     [],
};

/* ── Animation constants ────────────────────────────────────────────── */
const TYPING_MS   = 14;  // ms per character
const PAUSE_TICKS = 13;  // ticks between consecutive lines (~182 ms)
const DONE_TICKS  = 30;  // ticks after final line before isComplete

/* ── Enrichment constants ───────────────────────────────────────────── */
/**
 * How long to wait on the enrichment trio before showing the itinerary anyway.
 * Enrichment is additive: a slow or wedged agent must never strand someone on a
 * loading screen when their itinerary is already built and sitting in memory.
 */
const ENRICH_TIMEOUT_MS = 25_000;

/**
 * The line appended when an enrichment agent finishes. Text is deliberately
 * count-free — the three agents run concurrently server-side and report
 * completion individually, but the payload itself only arrives once all three
 * are done, so a count here would either be a lie or force the line to wait for
 * data it doesn't need. The actual numbers show on the itinerary.
 */
const ENRICH_LINES: Record<string, { nameKey: string; msgKey: string }> = {
  events:        { nameKey: "gen.agent.events",        msgKey: "gen.msg.events" },
  transport:     { nameKey: "gen.agent.transport",     msgKey: "gen.msg.transport" },
  accommodation: { nameKey: "gen.agent.accommodation", msgKey: "gen.msg.accommodation" },
};

/* ── Text-part types ────────────────────────────────────────────────── */
interface TextPart  { text: string; accent?: boolean }
interface AgentLine { nameKey: string; parts: TextPart[] }

/* ── Helpers ────────────────────────────────────────────────────────── */
function totalChars(parts: TextPart[]): number {
  return parts.reduce((s, p) => s + p.text.length, 0);
}

function TypedParts({
  parts,
  visibleChars,
}: {
  parts: TextPart[];
  visibleChars: number;
}) {
  let remaining = visibleChars;
  return (
    <>
      {parts.map((part, i) => {
        if (remaining <= 0) return null;
        const visible = part.text.slice(0, remaining);
        remaining = Math.max(0, remaining - part.text.length);
        return (
          <span
            key={i}
            style={{ color: part.accent ? "var(--sf-accent)" : "inherit" }}
          >
            {visible}
          </span>
        );
      })}
    </>
  );
}

/* ── Style injection ────────────────────────────────────────────────── */
function useGenStyles() {
  useEffect(() => {
    const id = "sf-gen-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes sf-blink {
        0%,100% { opacity: 1; }
        50%      { opacity: 0; }
      }
      @keyframes sf-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes sf-line-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .sf-cursor {
        display: inline-block;
        animation: sf-blink 0.85s step-end infinite;
        color: var(--sf-accent);
        margin-inline-start: 1px;
        line-height: 1;
        vertical-align: text-bottom;
      }
      .sf-spinner {
        animation: sf-spin 1.1s linear infinite;
      }
      .sf-line-row {
        animation: sf-line-in 0.18s ease both;
      }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Build agent lines from engine result ───────────────────────────── */
function buildAgentLines(
  result: ItineraryResult,
  trip: TripSpec,
  t: (k: string) => string,
  language: string,
): AgentLine[] {
  const o = result.objectives;

  // Top 3 objectives by weight
  const topObj = (Object.entries(o) as [string, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // For AI-chosen city, use the resolved city from the engine result
  const effectiveCity = trip.city === "ai" ? (result.resolvedCity ?? "riyadh") : trip.city;
  const cityDisplay =
    language === "ar" ? (CITY_NAMES_AR[effectiveCity] ?? effectiveCity) : result.cityName;

  const totalStops  = result.days.reduce((s, d) => s + d.stops.length, 0);
  const hiddenCount = Math.round(result.hiddenGemShare * totalStops);
  const pct         = Math.round(result.hiddenGemShare * 100);
  const est         = Math.round(result.estimatedDailyAvg).toLocaleString();
  const budgetStr   = trip.budget.toLocaleString();
  const budgetOk    = result.budgetStatus === "ok";

  const objLabel: Record<string, string> = {
    culture:     t("gen.obj.culture"),
    budget:      t("gen.obj.budget"),
    hiddenGems:  t("gen.obj.hiddenGems"),
    food:        t("gen.obj.food"),
    family:      t("gen.obj.family"),
    photography: t("gen.obj.photography"),
  };

  // Objectives line
  const objParts: TextPart[] = [{ text: t("gen.msg.goal") + " " }];
  topObj.forEach(([k, v], i) => {
    if (i > 0) objParts.push({ text: " · " });
    objParts.push({ text: objLabel[k] + " " });
    objParts.push({ text: v.toFixed(2), accent: true });
  });

  // Budget line differs slightly per language (SAR placement)
  const budgetParts: TextPart[] =
    language === "ar"
      ? [
          { text: "تقدير " },
          { text: est, accent: true },
          { text: " ريال/يوم مقابل " + budgetStr + " ريال/يوم — " },
          {
            text:   budgetOk ? t("gen.msg.budget.ok") : t("gen.msg.budget.over"),
            accent: !budgetOk,
          },
        ]
      : [
          { text: "Est. SAR " },
          { text: est, accent: true },
          { text: "/day vs SAR " + budgetStr + "/day — " },
          {
            text:   budgetOk ? t("gen.msg.budget.ok") : t("gen.msg.budget.over"),
            accent: !budgetOk,
          },
        ];

  return [
    { nameKey: "gen.agent.goal",     parts: objParts },
    {
      nameKey: "gen.agent.discovery",
      parts: [
        { text: String(result.candidateCount), accent: true },
        { text: " " + t("gen.msg.discovery.pre") + " " + cityDisplay },
      ],
    },
    {
      nameKey: "gen.agent.restaurant",
      parts: [
        { text: String(result.allergenSafeDishCount), accent: true },
        { text: " " + t("gen.msg.restaurant.pre") },
      ],
    },
    { nameKey: "gen.agent.budget",   parts: budgetParts },
    {
      nameKey: "gen.agent.culture",
      parts: [
        { text: String(result.cultureNoteCount), accent: true },
        { text: " " + t("gen.msg.culture.pre") },
      ],
    },
    {
      nameKey: "gen.agent.safety",
      parts: [{ text: t("gen.msg.safety") }],
    },
    {
      nameKey: "gen.agent.sustainability",
      parts: [
        { text: t("gen.msg.sustainability.pre") + " " },
        { text: String(hiddenCount), accent: true },
        {
          text:
            " " +
            t("gen.msg.sustainability.of") +
            " " +
            totalStops +
            " " +
            t("gen.msg.sustainability.stops") +
            " (",
        },
        { text: pct + "%", accent: true },
        { text: ")" },
      ],
    },
    {
      nameKey: "gen.agent.verification",
      parts: [
        { text: t("gen.msg.verification.pre") + " " },
        { text: String(result.verifiedCount), accent: true },
        { text: " " + t("gen.msg.verification.end") },
      ],
    },
  ];
}

/* ── AgentLineRow ───────────────────────────────────────────────────── */
function AgentLineRow({
  line,
  charCount,
  t,
  isActive,
  language,
}: {
  line:      AgentLine;
  charCount: number;   // –1 = fully visible
  t:         (k: string) => string;
  isActive:  boolean;
  language:  string;
}) {
  const total   = totalChars(line.parts);
  const visible = charCount === -1 ? total : charCount;

  return (
    <div
      className="sf-line-row"
      style={{
        display:       "flex",
        alignItems:    "flex-start",
        gap:           "10px",
        padding:       "10px 0",
        borderBottom:  "1px solid var(--sf-border)",
      }}
    >
      {/* Agent name in indigo */}
      <span
        style={{
          color:          "var(--sf-indigo)",
          fontWeight:     700,
          fontSize:       "0.6875rem",
          letterSpacing:  "0.06em",
          textTransform:  "uppercase",
          flexShrink:     0,
          width:          "clamp(100px, 28%, 160px)",
          paddingTop:     "2px",
          lineHeight:     1.4,
        }}
      >
        {t(line.nameKey)}
      </span>

      {/* Separator arrow (mirrors in RTL via bidi) */}
      <span
        aria-hidden
        style={{
          color:      "var(--sf-text-muted)",
          flexShrink: 0,
          paddingTop: "1px",
          fontSize:   "0.875rem",
          userSelect: "none",
        }}
      >
        {language === "ar" ? "‹" : "›"}
      </span>

      {/* Typed message */}
      <span
        style={{
          fontSize:   "0.8125rem",
          lineHeight: 1.65,
          color:      "var(--sf-text)",
          flex:       1,
          wordBreak:  "break-word",
          minWidth:   0,
        }}
      >
        <TypedParts parts={line.parts} visibleChars={visible} />
        {isActive && (
          <span className="sf-cursor" aria-hidden>
            ▋
          </span>
        )}
      </span>
    </div>
  );
}

/* ── Main page component ────────────────────────────────────────────── */
export function Generating() {
  const [, navigate]    = useLocation();
  const { t, language } = useTranslation();
  usePageMeta("Crafting Your Itinerary", "Safarly's AI agents are building your personalised Saudi journey.");
  useGenStyles();

  const [tick, setTick]         = useState(0);
  const [agentLines, setLines]  = useState<AgentLine[]>([]);
  const [engineReady, setReady] = useState(false);
  /**
   * Whether the enrichment call has finished, one way or the other. Navigation
   * waits on this as well as the animation, so a fast typing pass can't sail
   * past a still-running agent and persist an itinerary missing its events.
   */
  const [enrichSettled, setEnrichSettled] = useState(false);

  const resultRef     = useRef<ItineraryResult | null>(null);
  const profileRef    = useRef<TravelerProfile | null>(null);
  const tripRef       = useRef<TripSpec | null>(null);
  const enrichmentRef = useRef<TripEnrichment | null>(null);
  const completedRef  = useRef(false);
  const navigateRef   = useRef(navigate);
  navigateRef.current = navigate;

  // Read through refs inside the enrichment effect so it can depend on
  // `engineReady` alone — re-running it because a translation function changed
  // identity would fire a second billable round of agent calls.
  const tRef = useRef(t);
  tRef.current = t;
  const languageRef = useRef(language);
  languageRef.current = language;

  /* ── Run engine once on mount ─────────────────────────────────────── */
  useEffect(() => {
    const profileRaw = localStorage.getItem("safarly_profile");
    const tripRaw    = localStorage.getItem("safarly_trip");

    /* The trip spec is genuinely required — it names the city and the dates,
       and there is no sane default for either. The profile is not: see
       DEFAULT_PROFILE. */
    if (!tripRaw) {
      navigateRef.current("/planner");
      return;
    }

    let result:  ItineraryResult;
    let trip:    TripSpec;
    let profile: TravelerProfile;

    try {
      profile = profileRaw
        ? { ...DEFAULT_PROFILE, ...(JSON.parse(profileRaw) as Partial<TravelerProfile>) }
        : DEFAULT_PROFILE;
      trip    = JSON.parse(tripRaw) as TripSpec;
      result  = generateItinerary(profile, trip);
    } catch {
      navigateRef.current("/planner");
      return;
    }

    resultRef.current  = result;
    profileRef.current = profile;
    tripRef.current    = trip;
    setLines(buildAgentLines(result, trip, t, language));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Enrich the itinerary while the local lines type out ──────────── */
  useEffect(() => {
    if (!engineReady) return undefined;

    const itinerary = resultRef.current;
    const trip      = tripRef.current;
    const profile   = profileRef.current;

    if (!itinerary || !trip || !profile) {
      setEnrichSettled(true);
      return undefined;
    }

    /* Every enrichment route is session-guarded, so signed out this call can
       only ever 401. Skipping it keeps three doomed agent lines off the screen
       and saves the round trip — the traveller still gets their full local
       itinerary, then meets the wall on the itinerary page itself. */
    if (!getAuth()) {
      setEnrichSettled(true);
      return undefined;
    }

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
    let cancelled    = false;

    const request = buildEnrichRequest({
      itinerary,
      dateStart:       trip.dateStart,
      dateEnd:         trip.dateEnd,
      budgetSarPerDay: trip.budget,
      travelType:      profile.travelType || trip.travelContext || "solo",
      languageName:    languageNameOf(languageRef.current),
    });

    void enrichTrip(request, {
      signal: controller.signal,
      onStage: (event) => {
        // "planning" is the server acknowledging the request, and "start" only
        // says an agent began — neither is a result worth a line of its own.
        if (cancelled || event.status === "start") return;

        const line = ENRICH_LINES[event.stage];
        if (!line) return;

        // A failed agent still gets a line: silently dropping it would leave
        // the traveller wondering why the screen promised something it skipped.
        const message = event.status === "done"
          ? tRef.current(line.msgKey)
          : tRef.current("gen.msg.unavailable");

        setLines(prev => [...prev, { nameKey: line.nameKey, parts: [{ text: message }] }]);
      },
    }).then((outcome) => {
      if (cancelled) return;
      if (outcome.ok) enrichmentRef.current = outcome.data;
      setEnrichSettled(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [engineReady]);

  /**
   * Ticks needed to type everything currently queued. The timer clamps to this
   * so `tick` can't race ahead of the content: enrichment lines are appended
   * mid-animation, and an unclamped counter would have already "spent" the
   * ticks that should have typed them, making them appear fully-formed instead.
   */
  const maxTick = useMemo(
    () => agentLines.reduce((sum, line) => sum + totalChars(line.parts) + PAUSE_TICKS, 0) + DONE_TICKS,
    [agentLines],
  );

  /* ── Tick timer — starts only after engine is ready ──────────────── */
  useEffect(() => {
    if (!engineReady) return;
    const id = setInterval(() => setTick(prev => (prev >= maxTick ? prev : prev + 1)), TYPING_MS);
    return () => clearInterval(id);
  }, [engineReady, maxTick]);

  /* ── Derive per-tick animation state ─────────────────────────────── */
  const anim = useMemo(() => {
    if (agentLines.length === 0) {
      return { visibleLines: 0, activeIdx: -1, activeChars: 0, isComplete: false };
    }

    let rem = tick;

    for (let i = 0; i < agentLines.length; i++) {
      const len = totalChars(agentLines[i].parts);

      if (rem < len) {
        // Currently typing line i
        return { visibleLines: i, activeIdx: i, activeChars: rem, isComplete: false };
      }
      rem -= len;

      // Pause ticks after line i
      if (rem < PAUSE_TICKS) {
        return { visibleLines: i + 1, activeIdx: -1, activeChars: 0, isComplete: false };
      }
      rem -= PAUSE_TICKS;
    }

    // Tail pause — show all lines before declaring done
    if (rem < DONE_TICKS) {
      return { visibleLines: agentLines.length, activeIdx: -1, activeChars: 0, isComplete: false };
    }

    return { visibleLines: agentLines.length, activeIdx: -1, activeChars: 0, isComplete: true };
  }, [tick, agentLines]);

  /* ── Save result + navigate when animation completes ─────────────── */
  useEffect(() => {
    if (anim.isComplete && enrichSettled && !completedRef.current && resultRef.current) {
      completedRef.current = true;

      // Enrichment is layered on only if it actually arrived. Every failure
      // path — offline, signed out, quota, timeout — persists the itinerary the
      // engine already built, so the traveller still gets their full trip.
      const enriched = enrichmentRef.current
        ? applyEnrichment(resultRef.current, enrichmentRef.current)
        : resultRef.current;

      localStorage.setItem("safarly_itinerary", JSON.stringify(enriched));
      const timer = setTimeout(() => navigateRef.current("/itinerary"), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [anim.isComplete, enrichSettled]);

  /* ── Progress 0–1 ────────────────────────────────────────────────── */
  const progress = useMemo(() => {
    if (anim.isComplete || agentLines.length === 0) return anim.isComplete ? 1 : 0;
    const lineFraction =
      anim.activeIdx >= 0 && agentLines[anim.activeIdx]
        ? anim.activeChars / Math.max(1, totalChars(agentLines[anim.activeIdx].parts))
        : 0;
    return (anim.visibleLines + lineFraction) / agentLines.length;
  }, [anim, agentLines]);

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        paddingTop:    "68px",
        paddingBottom: "80px",   // clear bottom-nav
        background:    "var(--sf-bg)",
        minHeight:     "100dvh",
        display:       "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding:      "24px 20px 20px",
          borderBottom: "1px solid var(--sf-border)",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          {/* Spinner */}
          <div
            className="sf-spinner"
            aria-hidden
            style={{
              width:        "40px",
              height:       "40px",
              borderRadius: "50%",
              border:       "3px solid var(--sf-border)",
              borderTopColor: "var(--sf-accent)",
              marginBottom: "16px",
            }}
          />

          <h1
            style={{
              fontSize:      "clamp(1.25rem, 4vw, 1.75rem)",
              fontWeight:    800,
              color:         "var(--sf-text)",
              letterSpacing: "-0.02em",
              marginBottom:  "6px",
            }}
          >
            {t("gen.title")}
          </h1>

          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem" }}>
            {t("gen.subtitle")}
          </p>
        </div>
      </div>

      {/* ── Agent feed ──────────────────────────────────────────────── */}
      <div
        style={{
          flex:       1,
          padding:    "0 20px",
          overflowX:  "hidden",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>

          {/* Fully-revealed lines */}
          {agentLines.slice(0, anim.visibleLines).map((line, i) => (
            <AgentLineRow
              key={i}
              line={line}
              charCount={-1}
              t={t}
              isActive={false}
              language={language}
            />
          ))}

          {/* Currently typing line */}
          {anim.activeIdx >= 0 && anim.activeIdx < agentLines.length && (
            <AgentLineRow
              key={`active-${anim.activeIdx}`}
              line={agentLines[anim.activeIdx]}
              charCount={anim.activeChars}
              t={t}
              isActive={true}
              language={language}
            />
          )}

          {/* Done message */}
          {anim.isComplete && (
            <p
              style={{
                padding:       "16px 0 0",
                color:         "var(--sf-text-accent)",
                fontWeight:    600,
                fontSize:      "0.875rem",
                letterSpacing: "0.01em",
              }}
            >
              {t("gen.ready")}
            </p>
          )}
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      <div
        style={{
          padding:      "16px 20px 12px",
          borderTop:    "1px solid var(--sf-border)",
          background:   "var(--sf-bg)",
          marginTop:    "auto",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          {/* Track */}
          <div
            style={{
              height:       "4px",
              background:   "var(--sf-surface-alt)",
              borderRadius: "4px",
              overflow:     "hidden",
            }}
          >
            {/* Fill */}
            <div
              style={{
                height:     "100%",
                borderRadius: "4px",
                background: "linear-gradient(90deg, var(--sf-indigo), var(--sf-accent))",
                width:      `${Math.round(progress * 100)}%`,
                transition: "width 0.12s linear",
                boxShadow:  progress > 0.05 ? "0 0 8px rgba(0,216,164,0.35)" : "none",
              }}
            />
          </div>

          {/* Labels */}
          <div
            style={{
              display:        "flex",
              justifyContent: "space-between",
              marginTop:      "8px",
              fontSize:       "0.75rem",
              color:          "var(--sf-text-muted)",
            }}
          >
            <span>{Math.round(progress * 100)}%</span>
            <span>
              {Math.min(anim.visibleLines + (anim.activeIdx >= 0 ? 1 : 0), agentLines.length || 8)}
              &thinsp;/&thinsp;{agentLines.length || 8}&nbsp;agents
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
