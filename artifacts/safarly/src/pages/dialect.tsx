import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Mic, CheckCircle2, VolumeX } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import phrasesRaw from "@/data/phrases.json";

/* ── Types ──────────────────────────────────────────────────────────── */
type DialectKey = "najdi" | "hijazi" | "janubi" | "shamali";

interface Phrase {
  id: string; dialect: DialectKey;
  situation: string; arabic: string;
  transliteration: string; english: string;
}

type PracticePhase = "idle" | "playing" | "listening" | "done";

/* ── Static data ────────────────────────────────────────────────────── */
const ALL_PHRASES = phrasesRaw as Phrase[];

const SITUATION_ORDER = ["greeting","ordering","taxi","tickets","bargaining","thanks","directions"];

const SIT_KEY: Record<string, string> = {
  greeting:    "dialect.sit.greeting",
  tickets:     "dialect.sit.tickets",
  taxi:        "dialect.sit.taxi",
  ordering:    "dialect.sit.ordering",
  bargaining:  "dialect.sit.bargaining",
  thanks:      "dialect.sit.thanks",
  directions:  "dialect.sit.directions",
};

/* ── Progress ring ──────────────────────────────────────────────────── */
function ProgressRing({ learned, total }: { learned: number; total: number }) {
  const size = 52, stroke = 4, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? learned / total : 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sf-surface-alt)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--sf-accent)" strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

/* ── Style injection ────────────────────────────────────────────────── */
function useDialectStyles() {
  useEffect(() => {
    const id = "sf-dialect-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes sf-pulse-ring {
        0%   { transform: scale(1);   opacity: 0.8; }
        100% { transform: scale(1.5); opacity: 0;   }
      }
      .sf-pulse-outer {
        position: absolute; inset: 0;
        border-radius: 50%;
        border: 2px solid var(--sf-accent);
        animation: sf-pulse-ring 1.1s ease-out infinite;
      }
      .sf-phrase-card {
        background: var(--sf-surface);
        border: 1px solid var(--sf-border);
        border-radius: 14px;
        padding: 18px 16px;
        transition: border-color 0.15s;
      }
      .sf-phrase-card.learned-card {
        border-color: color-mix(in srgb, var(--sf-accent) 30%, var(--sf-border));
        background: color-mix(in srgb, var(--sf-accent) 4%, var(--sf-surface));
      }
      .sf-sit-label {
        display: inline-flex; align-items: center;
        padding: 3px 10px; border-radius: 999px;
        background: color-mix(in srgb, var(--sf-indigo) 12%, var(--sf-surface));
        color: var(--sf-indigo); font-size: 0.6875rem; font-weight: 700;
        letter-spacing: 0.05em; text-transform: uppercase;
        border: 1px solid color-mix(in srgb, var(--sf-indigo) 25%, transparent);
        flex-shrink: 0;
      }
      .sf-play-btn {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; padding: 9px 16px; border-radius: 999px;
        border: 1px solid var(--sf-border); background: var(--sf-surface);
        color: var(--sf-text-muted); font-size: 0.8125rem; font-weight: 600;
        cursor: pointer; min-height: 40px; white-space: nowrap;
        transition: border-color 0.15s, color 0.15s;
      }
      .sf-play-btn:hover { border-color: var(--sf-text-accent); color: var(--sf-text-accent); }
      .sf-play-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .sf-practice-btn {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; padding: 9px 16px; border-radius: 999px;
        border: none; background: var(--sf-indigo); color: #fff;
        font-size: 0.8125rem; font-weight: 700;
        cursor: pointer; min-height: 40px; white-space: nowrap;
        transition: opacity 0.15s;
      }
      .sf-practice-btn:hover { opacity: 0.85; }
      .sf-practice-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .sf-confirm-btn {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; padding: 11px 20px; border-radius: 10px;
        border: none; background: var(--sf-accent); color: #0A0E16;
        font-size: 0.9rem; font-weight: 700; cursor: pointer;
        min-height: 44px; width: 100%; transition: opacity 0.15s;
      }
      .sf-confirm-btn:hover { opacity: 0.85; }
      .sf-learned-badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 999px;
        background: color-mix(in srgb, var(--sf-accent) 14%, var(--sf-surface));
        color: var(--sf-text-accent); font-size: 0.6875rem; font-weight: 700;
        border: 1px solid color-mix(in srgb, var(--sf-accent) 28%, transparent);
      }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Phrase card ────────────────────────────────────────────────────── */
function PhraseCard({ phrase, practicePhase, hasAudio, t, language, onPlay, onPractice, onConfirm }: {
  phrase: Phrase; practicePhase: PracticePhase; hasAudio: boolean;
  t: (k: string) => string; language: string;
  onPlay: () => void; onPractice: () => void; onConfirm: () => void;
}) {
  const isLearned   = practicePhase === "done";
  const isListening = practicePhase === "listening";
  const isPlaying   = practicePhase === "playing";

  const listenLabel = isPlaying ? t("dialect.playing") : t("dialect.play");

  return (
    <div className={`sf-phrase-card${isLearned ? " learned-card" : ""}`}>
      {/* Top row: situation tag + learned badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <span className="sf-sit-label">{t(SIT_KEY[phrase.situation] ?? phrase.situation)}</span>
        {isLearned && (
          <span className="sf-learned-badge">
            <CheckCircle2 size={11} aria-hidden />
            {t("dialect.learned")}
          </span>
        )}
      </div>

      {/* Arabic script */}
      <div style={{
        fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 700,
        color: "var(--sf-text)", direction: "rtl", textAlign: "end",
        lineHeight: 1.4, marginBottom: 8,
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
      }}>
        {phrase.arabic}
      </div>

      {/* Transliteration */}
      <div style={{ fontSize: "0.9375rem", color: "var(--sf-text-accent)", fontStyle: "italic", marginBottom: 4 }}>
        {phrase.transliteration}
      </div>

      {/* English meaning */}
      <div style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", marginBottom: 18 }}>
        {phrase.english}
      </div>

      {/* Practice panel */}
      {isListening && (
        <div style={{
          background: "color-mix(in srgb, var(--sf-indigo) 8%, var(--sf-surface))",
          border: "1px solid color-mix(in srgb, var(--sf-indigo) 20%, var(--sf-border))",
          borderRadius: 12, padding: "16px 14px", marginBottom: 14,
          textAlign: "center",
        }}>
          {/* Pulse ring */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ position: "relative", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="sf-pulse-outer" />
              <div style={{ position: "relative", zIndex: 1 }}>
                <Mic size={22} style={{ color: "var(--sf-indigo)" }} aria-hidden />
              </div>
            </div>
          </div>
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--sf-indigo)", marginBottom: 12 }}>
            {t("dialect.now_say")}
          </p>
          <button
            className="sf-confirm-btn"
            onClick={onConfirm}
            aria-label={t("dialect.i_said")}
          >
            <CheckCircle2 size={16} aria-hidden />
            {t("dialect.i_said")}
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!isListening && !isLearned && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="sf-play-btn"
            onClick={onPlay}
            disabled={isPlaying || !hasAudio}
            title={!hasAudio ? t("dialect.no_audio") : undefined}
            aria-label={`${listenLabel}: ${phrase.transliteration}`}
            style={isPlaying ? { borderColor: "var(--sf-text-accent)", color: "var(--sf-text-accent)" } : undefined}
          >
            {hasAudio
              ? <Volume2 size={14} aria-hidden style={isPlaying ? { animation: "sf-pulse-ring 1s ease-out infinite" } : undefined} />
              : <VolumeX size={14} aria-hidden />}
            {listenLabel}
          </button>
          <button
            className="sf-practice-btn"
            onClick={onPractice}
            disabled={isPlaying}
            aria-label={`${t("dialect.practice")}: ${phrase.transliteration}`}
          >
            <Mic size={14} aria-hidden />
            {t("dialect.practice")}
          </button>
        </div>
      )}

      {isLearned && (
        <button
          className="sf-play-btn"
          onClick={onPlay}
          disabled={isPlaying || !hasAudio}
          title={!hasAudio ? t("dialect.no_audio") : undefined}
          aria-label={`${listenLabel}: ${phrase.transliteration}`}
          style={{ marginTop: 4, ...(isPlaying ? { borderColor: "var(--sf-text-accent)", color: "var(--sf-text-accent)" } : {}) }}
        >
          {hasAudio ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
          {listenLabel}
        </button>
      )}
    </div>
  );
}

/* ── Main Dialect page ──────────────────────────────────────────────── */
export function Dialect() {
  const { t, language } = useTranslation();
  usePageMeta("Dialect Tutor", "Learn Najdi and Hijazi Arabic phrases for your Saudi destination.");
  useDialectStyles();

  const [dialect,      setDialect]   = useState<DialectKey>("najdi");
  const [learnedIds,   setLearned]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("safarly_learned") ?? "[]"); } catch { return []; }
  });
  const [practiceMap,  setPMap]      = useState<Record<string, PracticePhase>>({});
  const [hasAudio,     setHasAudio]  = useState(false);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* ── Determine dialect from trip ──────────────────────────────────── */
  useEffect(() => {
    try {
      const trip = JSON.parse(localStorage.getItem("safarly_trip") ?? "{}");
      if (trip.city === "jeddah" || trip.city === "madinah" || trip.city === "taif") setDialect("hijazi");
      else if (trip.city === "abha") setDialect("janubi");
      else setDialect("najdi");
    } catch { /* default najdi */ }
  }, []);

  /* ── Check for SpeechSynthesis API availability ──────────────────── */
  useEffect(() => {
    setHasAudio(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  /* ── Pre-populate practice map from learned IDs ───────────────────── */
  useEffect(() => {
    setPMap(prev => {
      const next = { ...prev };
      learnedIds.forEach(id => { if (!next[id] || next[id] !== "done") next[id] = "done"; });
      return next;
    });
  }, []); // eslint-disable-line

  /* ── Filtered + grouped phrases ───────────────────────────────────── */
  const phrases = useMemo(
    () => ALL_PHRASES.filter(p => p.dialect === dialect),
    [dialect]
  );

  const grouped = useMemo(() => {
    const g: Record<string, Phrase[]> = {};
    for (const sit of SITUATION_ORDER) {
      const ps = phrases.filter(p => p.situation === sit);
      if (ps.length) g[sit] = ps;
    }
    return g;
  }, [phrases]);

  /* ── Sort: unlearned first ────────────────────────────────────────── */
  const sortedGroups = useMemo(
    () => Object.entries(grouped).map(([sit, ps]) => ({
      sit,
      phrases: [...ps].sort((a, b) => {
        const la = practiceMap[a.id] === "done" ? 1 : 0;
        const lb = practiceMap[b.id] === "done" ? 1 : 0;
        return la - lb;
      }),
    })),
    [grouped, practiceMap]
  );

  const learnedCount = phrases.filter(p => practiceMap[p.id] === "done").length;

  /* ── Audio helpers ────────────────────────────────────────────────── */
  function speak(arabic: string): Promise<void> {
    return new Promise(resolve => {
      try {
        window.speechSynthesis.cancel(); // stop anything already playing
        const u = new SpeechSynthesisUtterance(arabic);
        u.lang = "ar-SA"; u.rate = 0.8;
        // Prefer an explicit Arabic voice if the browser has one
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(v => v.lang.startsWith("ar"));
        if (arVoice) u.voice = arVoice;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
        // Safety timeout – some browsers never fire onend
        setTimeout(resolve, 5000);
      } catch { resolve(); }
    });
  }

  function handlePlay(phrase: Phrase) {
    setPMap(m => ({ ...m, [phrase.id]: "playing" }));
    speak(phrase.arabic).then(() => {
      setPMap(m => ({ ...m, [phrase.id]: m[phrase.id] === "playing" ? "idle" : m[phrase.id] }));
    });
  }

  function handlePractice(phrase: Phrase) {
    setPMap(m => ({ ...m, [phrase.id]: "playing" }));
    speak(phrase.arabic).then(() => {
      setPMap(m => ({ ...m, [phrase.id]: "listening" }));
    });
  }

  function handleConfirm(phraseId: string) {
    clearTimeout(timerRefs.current[phraseId]);
    setPMap(m => ({ ...m, [phraseId]: "done" }));
    const next = [...new Set([...learnedIds, phraseId])];
    setLearned(next);
    localStorage.setItem("safarly_learned", JSON.stringify(next));
  }

  const DIALECT_I18N: Record<DialectKey, { name: string; desc: string }> = {
    najdi:   { name: "dialect.najdi_name",   desc: "dialect.najdi_desc"   },
    hijazi:  { name: "dialect.hijazi_name",  desc: "dialect.hijazi_desc"  },
    janubi:  { name: "dialect.janubi_name",  desc: "dialect.janubi_desc"  },
    shamali: { name: "dialect.shamali_name", desc: "dialect.shamali_desc" },
  };
  const dialectName = t(DIALECT_I18N[dialect].name);
  const dialectDesc = t(DIALECT_I18N[dialect].desc);

  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--sf-border)", padding: "20px 20px 16px", background: "var(--sf-bg)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(1.25rem,4vw,1.625rem)", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                {t("page.dialect.title")}
              </h1>
              <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", lineHeight: 1.5 }}>
                {dialectDesc}
              </p>
            </div>

            {/* Progress ring */}
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <ProgressRing learned={learnedCount} total={phrases.length} />
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "0.6875rem", fontWeight: 800, color: "var(--sf-text)",
                }}>
                  {learnedCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--sf-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t("dialect.progress").replace("{n}", String(learnedCount)).replace("{total}", String(phrases.length))}
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-indigo)" }}>
                  {dialectName}
                </div>
              </div>
            </div>
          </div>

          {/* Dialect switcher */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {(["najdi","hijazi","janubi","shamali"] as const).map(d => (
              <button
                key={d}
                onClick={() => setDialect(d)}
                style={{
                  padding: "7px 16px", borderRadius: 999, border: "1px solid",
                  fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", minHeight: 36,
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  background: dialect === d ? "var(--sf-indigo)" : "var(--sf-surface)",
                  color:      dialect === d ? "#fff" : "var(--sf-text-muted)",
                  borderColor:dialect === d ? "var(--sf-indigo)" : "var(--sf-border)",
                }}
              >
                {t(DIALECT_I18N[d].name)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phrase groups */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {sortedGroups.map(({ sit, phrases: ps }) => (
          <section key={sit} style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "var(--sf-text-muted)",
              marginBottom: 12, paddingInlineStart: 4,
            }}>
              {t(SIT_KEY[sit] ?? sit)}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ps.map(p => (
                <PhraseCard
                  key={p.id} phrase={p}
                  practicePhase={practiceMap[p.id] ?? "idle"}
                  hasAudio={hasAudio}
                  t={t} language={language}
                  onPlay={() => handlePlay(p)}
                  onPractice={() => handlePractice(p)}
                  onConfirm={() => handleConfirm(p.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
