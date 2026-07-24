import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Mic, CheckCircle2, VolumeX } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { languageNameOf } from "@/lib/language-names";
import { AuroraHero } from "@/components/AuroraHero";
import { evaluateAttempt } from "@/lib/dialect-api";
import phrasesRaw from "@/data/phrases.json";

/* ── Types ──────────────────────────────────────────────────────────── */
type DialectKey = "najdi" | "hijazi" | "janubi" | "shamali" | "sharqi";

interface Phrase {
  id: string; dialect: DialectKey;
  situation: string; arabic: string;
  transliteration: string; english: string;
}

type PracticePhase = "idle" | "playing" | "listening" | "recording" | "result" | "done";

// Why practice fell back to manual "I said it" confirmation instead of live recognition.
type MicErrorReason = "unsupported" | "denied" | "no-device" | "insecure" | "generic";

/**
 * The outcome of one practice attempt.
 *
 * `passed` and `heard` come from the offline arabicMatch() check and are always
 * present immediately. `coaching` is the Dialect Coach's tip, which arrives
 * later or not at all — the verdict never waits on the network, so practice
 * still works exactly as before when the API is unreachable.
 */
interface PracticeResult {
  passed: boolean;
  heard?: string;
  coachingState?: "loading" | "ready";
  coaching?: string;
  correctedTransliteration?: string;
}

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
      @keyframes sf-mic-pulse {
        0%   { transform: scale(1);   opacity: 0.7; }
        50%  { transform: scale(1.35); opacity: 0; }
        100% { transform: scale(1);   opacity: 0; }
      }
      .sf-mic-outer {
        position: absolute; inset: 0; border-radius: 50%;
        border: 2px solid #EF4444;
        animation: sf-mic-pulse 1.2s ease-out infinite;
      }
      .sf-result-pass {
        background: color-mix(in srgb, var(--sf-accent) 8%, var(--sf-surface));
        border: 1px solid color-mix(in srgb, var(--sf-accent) 30%, var(--sf-border));
        border-radius: 12px; padding: 16px 14px; margin-bottom: 14px; text-align: center;
      }
      .sf-result-fail {
        background: color-mix(in srgb, #EF4444 6%, var(--sf-surface));
        border: 1px solid color-mix(in srgb, #EF4444 25%, var(--sf-border));
        border-radius: 12px; padding: 16px 14px; margin-bottom: 14px; text-align: center;
      }
      .sf-skip-btn {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; padding: 9px 16px; border-radius: 999px;
        border: 1px solid var(--sf-border); background: transparent;
        color: var(--sf-text-muted); font-size: 0.8125rem; font-weight: 600;
        cursor: pointer; min-height: 40px; white-space: nowrap;
        transition: border-color 0.15s, color 0.15s;
      }
      .sf-skip-btn:hover { border-color: var(--sf-text-muted); color: var(--sf-text); }
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

/* ── Arabic comparison helpers ──────────────────────────────────────── */
// Normalizes tashkeel/diacritics, alef/hamza variants, and taa marbuta so that
// spelling variation the recognizer introduces doesn't count against the user.
function normalizeArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // tashkeel + diacritics
    .replace(/[\u0623\u0625\u0622\u0627]/g, "\u0627")   // alef/hamza variants -> bare alef
    .replace(/\u0649/g, "\u064A")                       // alef maksura -> yaa
    .replace(/\u0629/g, "\u0647")                       // taa marbuta -> haa
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
// A word "fuzzy matches" if it's an exact hit or within ~30% edit distance \u2014
// tolerant of the small substitutions ASR commonly makes.
function fuzzyWordMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return levenshtein(a, b) <= Math.max(1, Math.ceil(Math.min(a.length, b.length) * 0.3));
}

function arabicMatch(transcript: string, expected: string): boolean {
  const t = normalizeArabic(transcript);
  const e = normalizeArabic(expected);
  if (!e) return false;
  if (t === e) return true;

  // Whole-phrase closeness, for short phrases spoken as one run.
  const wholeDist = levenshtein(t, e);
  if (wholeDist <= Math.max(2, Math.ceil(e.length * 0.3))) return true;

  // Word-level closeness, for longer phrases or ones split differently by the recognizer.
  const tWords = t.split(" ").filter(w => w.length > 1);
  const eWords = e.split(" ").filter(w => w.length > 1);
  if (eWords.length === 0) return false;
  const matched = eWords.filter(ew => tWords.some(tw => fuzzyWordMatch(tw, ew)));
  return matched.length >= Math.max(1, Math.ceil(eWords.length * 0.6));
}

/* ── Phrase card ────────────────────────────────────────────────────── */
const MIC_ERROR_KEY: Record<MicErrorReason, string> = {
  unsupported: "dialect.mic_unsupported",
  denied:      "dialect.mic_denied",
  "no-device": "dialect.mic_no_device",
  insecure:    "dialect.mic_insecure",
  generic:     "dialect.mic_error",
};

function PhraseCard({ phrase, practicePhase, hasAudio, t, language, onPlay, onPractice, onConfirm, onRetry, onSkip, practiceResult, micError }: {
  phrase: Phrase; practicePhase: PracticePhase; hasAudio: boolean;
  t: (k: string) => string; language: string;
  onPlay: () => void; onPractice: () => void; onConfirm: () => void;
  onRetry: () => void; onSkip: () => void;
  practiceResult: PracticeResult | null;
  micError: MicErrorReason | null;
}) {
  const isLearned    = practicePhase === "done";
  const isListening  = practicePhase === "listening"; // fallback: no mic
  const isPlaying    = practicePhase === "playing";
  const isRecording  = practicePhase === "recording";
  const isResult     = practicePhase === "result";

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

      {/* Recording panel — mic is active */}
      {isRecording && (
        <div style={{
          background: "color-mix(in srgb, #EF4444 6%, var(--sf-surface))",
          border: "1px solid color-mix(in srgb, #EF4444 20%, var(--sf-border))",
          borderRadius: 12, padding: "16px 14px", marginBottom: 14, textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{ position: "relative", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="sf-mic-outer" />
              <Mic size={22} style={{ color: "#EF4444", position: "relative", zIndex: 1 }} aria-hidden />
            </div>
          </div>
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#EF4444", marginBottom: 4 }}>{t("dialect.listening")}</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>{t("dialect.now_say")}</p>
        </div>
      )}

      {/* Result panel — pass */}
      {isResult && practiceResult?.passed && (
        <div className="sf-result-pass" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "2rem", marginBottom: 6 }}>✓</div>
          <p style={{ fontSize: "1rem", fontWeight: 800, color: "var(--sf-text-accent)", marginBottom: 4 }}>{t("dialect.pass_title")}</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginBottom: 14 }}>{t("dialect.pass_sub")}</p>
          <button className="sf-confirm-btn" onClick={onConfirm}>
            <CheckCircle2 size={16} aria-hidden />
            {t("dialect.mark_learned")}
          </button>
        </div>
      )}

      {/* Result panel — fail: show what was heard vs. what was expected */}
      {isResult && practiceResult && !practiceResult.passed && (
        <div className="sf-result-fail" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "1.75rem", marginBottom: 6 }}>✗</div>
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#EF4444", marginBottom: 4 }}>{t("dialect.try_again")}</p>
          {practiceResult.heard && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginBottom: 4 }}>
              {t("dialect.heard")}{" "}
              <span dir="rtl" style={{ color: "var(--sf-text)", fontWeight: 600 }}>{practiceResult.heard}</span>
            </p>
          )}
          <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginBottom: 14 }}>
            {t("dialect.expected")} <span style={{ color: "var(--sf-text-accent)", fontStyle: "italic" }}>{phrase.transliteration}</span>
          </p>

          {/* Coach's tip — arrives after the verdict, or not at all. Absent
              silently when the API is unreachable, so nothing here is load-bearing. */}
          {practiceResult.coachingState === "loading" && (
            <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginBottom: 14, fontStyle: "italic" }}>
              {t("dialect.coach.loading")}
            </p>
          )}
          {practiceResult.coachingState === "ready" && practiceResult.coaching && (
            <div
              aria-live="polite"
              style={{
                background:   "color-mix(in srgb, var(--sf-indigo) 8%, var(--sf-surface))",
                border:       "1px solid color-mix(in srgb, var(--sf-indigo) 22%, var(--sf-border))",
                borderRadius: 10,
                padding:      "10px 12px",
                marginBottom: 14,
                textAlign:    "start",
              }}
            >
              <p style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em",
                textTransform: "uppercase", color: "var(--sf-indigo)", marginBottom: 4,
              }}>
                {t("dialect.coach.title")}
              </p>
              <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: "var(--sf-text)" }}>
                {practiceResult.coaching}
              </p>
              {practiceResult.correctedTransliteration && (
                <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 6, fontStyle: "italic" }}>
                  {practiceResult.correctedTransliteration}
                </p>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="sf-play-btn" onClick={onPlay} disabled={!hasAudio} style={{ minWidth: 90 }}>
              <Volume2 size={13} aria-hidden /> {t("dialect.listen_first")}
            </button>
            <button className="sf-practice-btn" onClick={onRetry} style={{ minWidth: 90 }}>
              <Mic size={13} aria-hidden /> {t("dialect.try_again")}
            </button>
            <button className="sf-skip-btn" onClick={onSkip}>{t("dialect.skip")}</button>
          </div>
        </div>
      )}

      {/* Fallback panel — mic unsupported/blocked/missing; user self-confirms instead */}
      {isListening && (
        <div style={{
          background: "color-mix(in srgb, var(--sf-indigo) 8%, var(--sf-surface))",
          border: "1px solid color-mix(in srgb, var(--sf-indigo) 20%, var(--sf-border))",
          borderRadius: 12, padding: "16px 14px", marginBottom: 14, textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{ position: "relative", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="sf-pulse-outer" />
              <Mic size={22} style={{ color: "var(--sf-indigo)", position: "relative", zIndex: 1 }} aria-hidden />
            </div>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginBottom: 14 }}>
            {t(MIC_ERROR_KEY[micError ?? "generic"])}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="sf-confirm-btn" onClick={onConfirm} style={{ flex: 1 }}>
              <CheckCircle2 size={16} aria-hidden /> {t("dialect.i_said")}
            </button>
            <button className="sf-skip-btn" onClick={onSkip}>{t("dialect.skip")}</button>
          </div>
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
  const [resultMap,    setResultMap] = useState<Record<string, PracticeResult>>({});
  const [micErrorMap,  setMicErrorMap] = useState<Record<string, MicErrorReason>>({});
  const coachAborts = useRef<Record<string, AbortController>>({});
  const [hasAudio,     setHasAudio]  = useState(false);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); 

  /* ── Determine dialect from trip ──────────────────────────────────── */
  useEffect(() => {
    try {
      const trip = JSON.parse(localStorage.getItem("safarly_trip") ?? "{}");
      if (trip.city === "jeddah" || trip.city === "madinah" || trip.city === "taif") setDialect("hijazi");
      else if (trip.city === "abha") setDialect("janubi");
      else if (trip.city === "al_khobar") setDialect("sharqi");
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

  /**
   * Asks the Dialect Coach for a tip on a failed attempt.
   *
   * Fire-and-forget and entirely optional: the verdict is already on screen, so
   * every failure path here just leaves the panel as it was before the coach
   * existed. Aborted when the learner retries or skips, so a stale tip can't
   * land on a fresh attempt.
   */
  function requestCoaching(phrase: Phrase, heard: string) {
    if (!heard.trim()) return;   // nothing to evaluate — the mic caught nothing

    coachAborts.current[phrase.id]?.abort();
    const controller = new AbortController();
    coachAborts.current[phrase.id] = controller;

    setResultMap(prev => prev[phrase.id]
      ? { ...prev, [phrase.id]: { ...prev[phrase.id], coachingState: "loading" } }
      : prev);

    void evaluateAttempt({
      dialect,
      targetArabic: phrase.arabic,
      targetTransliteration: phrase.transliteration,
      targetEnglish: phrase.english,
      userAttempt: heard,
      languageName: languageNameOf(language),
    }, controller.signal).then(outcome => {
      if (controller.signal.aborted) return;
      setResultMap(prev => {
        const current = prev[phrase.id];
        // The learner moved on, or this reply belongs to a superseded attempt.
        if (!current || current.heard !== heard) return prev;
        if (!outcome.ok) {
          const { coachingState, ...rest } = current;   // drop the spinner, say nothing
          void coachingState;
          return { ...prev, [phrase.id]: rest };
        }
        return {
          ...prev,
          [phrase.id]: {
            ...current,
            coachingState: "ready",
            coaching: outcome.data.feedback,
            correctedTransliteration: outcome.data.correctedTransliteration,
          },
        };
      });
    });
  }

  function fallbackToManual(phraseId: string, reason: MicErrorReason) {
    setMicErrorMap(m => ({ ...m, [phraseId]: reason }));
    setPMap(m => ({ ...m, [phraseId]: "listening" }));
  }

  function handlePractice(phrase: Phrase) {
    // (d) non-secure context — getUserMedia/SpeechRecognition are unavailable outside https/localhost.
    if (!window.isSecureContext) {
      fallbackToManual(phrase.id, "insecure");
      return;
    }

    // (a) prefer the standard name, fall back to the webkit-prefixed one; (c) no support at all.
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      fallbackToManual(phrase.id, "unsupported");
      return;
    }

    setMicErrorMap(m => { const next = { ...m }; delete next[phrase.id]; return next; });
    setPMap(m => ({ ...m, [phrase.id]: "recording" }));

    let handled = false;
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.maxAlternatives = 5;
    rec.interimResults = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      handled = true;
      const alternatives = Array.from({ length: event.results[0].length }, (_, i) => event.results[0][i].transcript);
      const passed = alternatives.some(alt => arabicMatch(alt, phrase.arabic));
      if (passed) {
        // Auto-mark as learned on correct pronunciation
        handleConfirm(phrase.id);
      } else {
        const heard = alternatives[0] ?? "";
        setResultMap(prev => ({ ...prev, [phrase.id]: { passed: false, heard } }));
        setPMap(m => ({ ...m, [phrase.id]: "result" }));
        requestCoaching(phrase, heard);
      }
    };

    // (b) permission prompt/denial and other recognition errors, distinguished by reason.
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (handled) return;
      handled = true;

      if (event.error === "no-speech") {
        // Nothing to fall back for — just didn't catch an attempt; let them retry normally.
        setResultMap(prev => ({ ...prev, [phrase.id]: { passed: false, heard: "" } }));
        setPMap(m => ({ ...m, [phrase.id]: "result" }));
        return;
      }
      if (event.error === "aborted") {
        setPMap(m => ({ ...m, [phrase.id]: "idle" }));
        return;
      }

      const reason: MicErrorReason =
        event.error === "not-allowed" || event.error === "permission-denied" ? "denied" :
        event.error === "audio-capture" ? "no-device" :
        "generic";
      fallbackToManual(phrase.id, reason);
    };

    rec.onend = () => {
      if (!handled) {
        handled = true;
        // No speech detected — treat as failed attempt
        setResultMap(prev => ({ ...prev, [phrase.id]: { passed: false, heard: "" } }));
        setPMap(m => ({ ...m, [phrase.id]: "result" }));
      }
    };

    try { rec.start(); }
    catch {
      fallbackToManual(phrase.id, "generic");
    }
  }

  function handleRetry(phraseId: string) {
    coachAborts.current[phraseId]?.abort();
    setResultMap(prev => { const next = { ...prev }; delete next[phraseId]; return next; });
    setPMap(m => ({ ...m, [phraseId]: "idle" }));
  }

  // Skip only exits the retry loop — it must not fake progress by marking the phrase learned.
  function handleSkip(phraseId: string) {
    coachAborts.current[phraseId]?.abort();
    setResultMap(prev => { const next = { ...prev }; delete next[phraseId]; return next; });
    setMicErrorMap(prev => { const next = { ...prev }; delete next[phraseId]; return next; });
    setPMap(m => ({ ...m, [phraseId]: "idle" }));
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
    sharqi:  { name: "dialect.sharqi_name",  desc: "dialect.sharqi_desc"  },
  };
  const dialectName = t(DIALECT_I18N[dialect].name);
  const dialectDesc = t(DIALECT_I18N[dialect].desc);

  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* Header */}
      <AuroraHero minHeight="auto" className="sf-aurora-band">
        <div style={{ borderBottom: "1px solid var(--sf-border)", padding: "20px 20px 16px" }}>
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
              {(["najdi","hijazi","janubi","shamali","sharqi"] as const).map(d => (
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
      </AuroraHero>

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
                  onRetry={() => handleRetry(p.id)}
                  onSkip={() => handleSkip(p.id)}
                  practiceResult={resultMap[p.id] ?? null}
                  micError={micErrorMap[p.id] ?? null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
