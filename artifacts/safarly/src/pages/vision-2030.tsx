import { Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { useTheme } from "@/providers/ThemeProvider";
import { usePageMeta } from "@/lib/usePageMeta";
import { ArrowRight } from "lucide-react";
import vision2030Light from "@assets/vision2030-light.png";
import vision2030Dark from "@assets/vision2030-dark.png";

const PILLARS = [
  { icon: "💻", key: "digital" },
  { icon: "🤖", key: "ai" },
  { icon: "📈", key: "tourism" },
  { icon: "💰", key: "economy" },
  { icon: "🏙️", key: "smartcities" },
  { icon: "🌱", key: "sustainability" },
  { icon: "🕌", key: "culture" },
  { icon: "⭐", key: "experience" },
  { icon: "🏪", key: "local" },
  { icon: "💼", key: "employment" },
];

export function Vision2030() {
  const { t } = useTranslation();
  const { theme } = useTheme();
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
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section style={{
        textAlign: "center",
        padding: "clamp(48px, 8vw, 96px) 20px 40px",
        maxWidth: 760,
        margin: "0 auto",
      }}>
        <span style={{
          display: "inline-block",
          padding: "4px 14px",
          borderRadius: 999,
          background: "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
          border: "1px solid color-mix(in srgb, var(--sf-accent) 28%, transparent)",
          color: "var(--sf-text-accent)",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 24,
        }}>
          {t("vision2030.badge")}
        </span>

        <img
          src={theme === "dark" ? vision2030Dark : vision2030Light}
          alt="Saudi Vision 2030"
          style={{ height: "88px", width: "auto", objectFit: "contain", margin: "0 auto 28px" }}
        />

        <h1 style={{
          fontSize: "clamp(2rem, 6vw, 3.5rem)",
          fontWeight: 900,
          color: "var(--sf-text)",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 20,
        }}>
          {t("vision2030.title")}
        </h1>
        <p style={{
          fontSize: "clamp(1rem, 2.5vw, 1.1875rem)",
          color: "var(--sf-text-muted)",
          lineHeight: 1.7,
          maxWidth: 640,
          margin: "0 auto",
        }}>
          {t("vision2030.subtitle")}
        </p>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Problem / Who / Solution ─────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 72px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}>
          {sections.map((s, i) => (
            <div
              key={s.titleKey}
              style={{
                background: "var(--sf-surface)",
                border: "1px solid var(--sf-border)",
                borderRadius: 16,
                padding: "24px 22px",
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--sf-text-accent)",
                  fontFamily: "monospace",
                }}>
                  0{i + 1}
                </span>
                <span style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--sf-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>
                  {t(s.eyebrowKey)}
                </span>
              </div>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 10 }}>
                {t(s.titleKey)}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", lineHeight: 1.7 }}>
                {t(s.bodyKey)}
              </p>
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
          {PILLARS.map(p => (
            <div
              key={p.key}
              style={{
                background: "var(--sf-surface)",
                border: "1px solid var(--sf-border)",
                borderRadius: 14,
                padding: "20px 18px",
              }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: 10, lineHeight: 1 }}>{p.icon}</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--sf-text)", marginBottom: 6 }}>
                {t(`vision2030.pillar.${p.key}.title`)}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.55 }}>
                {t(`vision2030.pillar.${p.key}.desc`)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "0 20px 32px" }}>
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
          }}
        >
          {t("cta.start")}
          <ArrowRight size={18} />
        </Link>
      </section>

    </div>
  );
}
