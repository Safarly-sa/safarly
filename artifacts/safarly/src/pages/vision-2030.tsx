import { useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { useTheme } from "@/providers/ThemeProvider";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  ArrowRight, Cpu, Bot, TrendingUp, Coins, Building2,
  Leaf, Landmark, Sparkles, Store, Briefcase,
} from "lucide-react";
import vision2030Light from "@assets/vision2030-light.png";
import vision2030Dark from "@assets/vision2030-dark.png";
import vision2030Hero from "@assets/vision2030-riyadh-hero.jpg";

/**
 * Accent rhythm sampled from the official Vision 2030 emblem's mosaic
 * pattern (teal, sky blue, lime, deep navy) — the pillars cycle through it
 * instead of Safarly's usual two-tone accent/indigo pair, so this page reads
 * as "the emblem's colors extended into the UI" rather than a generic card
 * grid that happens to mention Vision 2030.
 */
const MOSAIC = ["#2FB8C6", "#4A90D9", "#8DC63F", "#1B3A5C"] as const;

const PILLARS = [
  { Icon: Cpu,       key: "digital" },
  { Icon: Bot,       key: "ai" },
  { Icon: TrendingUp,key: "tourism" },
  { Icon: Coins,     key: "economy" },
  { Icon: Building2, key: "smartcities" },
  { Icon: Leaf,      key: "sustainability" },
  { Icon: Landmark,  key: "culture" },
  { Icon: Sparkles,  key: "experience" },
  { Icon: Store,     key: "local" },
  { Icon: Briefcase, key: "employment" },
];

/* ── Style injection ────────────────────────────────────────────────── */
function useVisionStyles() {
  useEffect(() => {
    const id = "sf-vision2030-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .sf-v30-pillar {
        background: var(--sf-surface);
        border: 1px solid var(--sf-border);
        border-radius: 14px;
        padding: 20px 18px;
        transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .sf-v30-pillar:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 28px rgba(0,0,0,0.16);
      }
      .sf-v30-node {
        position: relative;
      }
      .sf-v30-node::before {
        content: "";
        position: absolute;
        inset-inline-start: 15px;
        top: 40px;
        bottom: -28px;
        width: 2px;
        background: var(--sf-border);
      }
      .sf-v30-node:last-child::before { display: none; }
      .sf-v30-dot {
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-family: monospace; font-weight: 800; font-size: 0.8125rem;
        flex-shrink: 0; position: relative; z-index: 1;
      }
    `;
    document.head.appendChild(s);
  }, []);
}

export function Vision2030() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  useVisionStyles();
  usePageMeta(
    "2030 Vision",
    "How Safarly's AI travel planning aligns with Saudi Vision 2030 — the problem it solves, who feels it most, and how every agent ties back to the Kingdom's plan.",
  );

  const sections = [
    { eyebrowKey: "vision2030.problem.eyebrow",  titleKey: "vision2030.problem.title",  bodyKey: "vision2030.problem.body" },
    { eyebrowKey: "vision2030.who.eyebrow",      titleKey: "vision2030.who.title",      bodyKey: "vision2030.who.body" },
    { eyebrowKey: "vision2030.solution.eyebrow", titleKey: "vision2030.solution.title", bodyKey: "vision2030.solution.body" },
  ];

  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh", overflowX: "hidden" }}>

      {/* ── Hero — full-bleed Riyadh skyline photo ───────────────────────
          Breaks out to the viewport edge regardless of where this page's
          content column sits, then folds back via a bottom gradient scrim
          that lands exactly on --sf-bg, so the photo reads as part of the
          page rather than a banner dropped on top of it. Text is pinned to
          white regardless of theme — the photo's own tone is dark enough at
          the scrim line that light-mode text would fail contrast otherwise. */}
      <section style={{
        position: "relative",
        width: "100vw",
        insetInlineStart: "calc(-50vw + 50%)",
      }}>
        <div style={{ position: "relative", height: "clamp(420px, 58vw, 620px)", overflow: "hidden" }}>
          <img
            src={vision2030Hero}
            alt="Riyadh's skyline at night, with the Kingdom Centre tower and the Saudi Vision 2030 emblem"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%" }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(10,14,22,0.05) 0%, rgba(10,14,22,0.5) 60%, var(--sf-bg) 100%)",
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-end",
            textAlign: "center",
            padding: "20px clamp(20px, 6vw, 60px) clamp(28px, 6vw, 52px)",
          }}>
            <span style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.32)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}>
              {t("vision2030.badge")}
            </span>

            <h1 style={{
              fontSize: "clamp(1.75rem, 5.5vw, 3.25rem)",
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: 14,
              textShadow: "0 2px 20px rgba(0,0,0,0.35)",
            }}>
              {t("vision2030.title")}
            </h1>
            <p style={{
              fontSize: "clamp(0.9375rem, 2.2vw, 1.125rem)",
              color: "rgba(255,255,255,0.88)",
              lineHeight: 1.7,
              maxWidth: 640,
              margin: 0,
            }}>
              {t("vision2030.subtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Problem / Who / Solution — connected narrative timeline ────── */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {sections.map((s, i) => (
            <div key={s.titleKey} className="sf-v30-node" style={{ display: "flex", gap: 20 }}>
              <div
                className="sf-v30-dot"
                style={{
                  background: `color-mix(in srgb, ${MOSAIC[i]} 16%, var(--sf-surface))`,
                  border: `1px solid color-mix(in srgb, ${MOSAIC[i]} 45%, transparent)`,
                  color: MOSAIC[i],
                }}
                aria-hidden
              >
                0{i + 1}
              </div>
              <div style={{ paddingTop: 2 }}>
                <span style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--sf-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 8,
                }}>
                  {t(s.eyebrowKey)}
                </span>
                <h2 style={{ fontSize: "1.1875rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 10, letterSpacing: "-0.01em" }}>
                  {t(s.titleKey)}
                </h2>
                <p style={{ fontSize: "0.9375rem", color: "var(--sf-text-muted)", lineHeight: 1.75 }}>
                  {t(s.bodyKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Vision 2030 pillars ──────────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 72px" }}>
        <h2 style={{
          textAlign: "center",
          fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
          fontWeight: 800,
          color: "var(--sf-text)",
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          {t("vision2030.pillars.title")}
        </h2>
        <p style={{ textAlign: "center", color: "var(--sf-text-muted)", marginBottom: 44, maxWidth: 520, margin: "0 auto 44px" }}>
          {t("vision2030.pillars.subtitle")}
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}>
          {PILLARS.map((p, i) => {
            const color = MOSAIC[i % MOSAIC.length];
            return (
              <div key={p.key} className="sf-v30-pillar">
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `color-mix(in srgb, ${color} 14%, var(--sf-surface))`,
                  border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
                  marginBottom: 14,
                }}>
                  <p.Icon size={19} aria-hidden style={{ color }} />
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--sf-text)", marginBottom: 6 }}>
                  {t(`vision2030.pillar.${p.key}.title`)}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.55 }}>
                  {t(`vision2030.pillar.${p.key}.desc`)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "0 20px 32px" }}>
        <img
          src={theme === "dark" ? vision2030Dark : vision2030Light}
          alt=""
          aria-hidden
          style={{ height: 36, width: "auto", objectFit: "contain", opacity: 0.7, margin: "0 auto 20px" }}
        />
        <h2 style={{
          fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
          fontWeight: 800,
          color: "var(--sf-text)",
          marginBottom: 12,
          letterSpacing: "-0.02em",
        }}>
          {t("vision2030.cta.title")}
        </h2>
        <p style={{ color: "var(--sf-text-muted)", marginBottom: 28 }}>
          {t("vision2030.cta.body")}
        </p>
        <Link
          href="/trip"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 32px", borderRadius: 12,
            background: "var(--sf-accent)", color: "#0A0E16",
            fontWeight: 700, fontSize: "1rem",
            textDecoration: "none",
            boxShadow: "0 0 24px rgba(0,216,164,0.35)",
            transition: "opacity 0.2s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          {t("cta.start")}
          <ArrowRight size={18} className="rtl:hidden" aria-hidden />
        </Link>
      </section>

    </div>
  );
}
