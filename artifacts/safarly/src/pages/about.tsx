import { Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { ArrowRight, Compass, Utensils, Wallet, ShieldCheck, Leaf, CheckCircle2, Camera, Languages, Map, LayoutDashboard } from "lucide-react";

const AGENTS = [
  { icon: "🎯", title: "Goal Analyzer",        desc: "Reads your travel goals and builds a weighted preference model to guide every downstream decision." },
  { icon: "🗺️", title: "Destination Scout",    desc: "Discovers attractions, hidden gems, and must-see sites perfectly matched to your interests and schedule." },
  { icon: "🍽️", title: "Restaurant Scout",     desc: "Curates local dining from hole-in-the-wall teahouses to fine Saudi cuisine, always halal-verified." },
  { icon: "💰", title: "Budget Optimizer",     desc: "Keeps your spend inside your SAR budget across transport, entry fees, and dining — day by day." },
  { icon: "🕌", title: "Cultural Advisor",     desc: "Flags prayer times, dress guidance, local customs, and etiquette so every interaction is respectful." },
  { icon: "🛡️", title: "Safety Monitor",       desc: "Monitors advisories and ensures every stop meets current travel-safety standards." },
  { icon: "🌱", title: "Sustainability Tracker", desc: "Prioritises eco-certified sites and low-impact experiences aligned with Saudi Vision 2030." },
  { icon: "✓",  title: "Verification Engine",  desc: "Cross-checks opening hours, prices, and availability in real time so your plan is always accurate." },
];

const FEATURES = [
  { Icon: Camera,        title: "Live Lens",        desc: "Point your camera at a dish, landmark, or street sign. AI identifies it and gives you cultural context instantly.", href: "/lens" },
  { Icon: Languages,     title: "Dialect Tutor",    desc: "Practice Najdi, Hijazi, Janubi, and Shamali Arabic phrases with pronunciation coaching.", href: "/dialect" },
  { Icon: Map,           title: "Smart Itinerary",  desc: "A day-by-day plan built around your goals — with real-time replanning if a venue closes.", href: "/trip" },
  { Icon: LayoutDashboard, title: "Travel Dashboard", desc: "Track your ongoing and past trips, spending, and progress all in one place.", href: "/dashboard" },
];

export function About() {
  const { t } = useTranslation();
  usePageMeta("About Safarly", "Learn how eight AI agents work together to craft your perfect Saudi journey.");

  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section style={{
        textAlign: "center",
        padding: "clamp(48px, 8vw, 96px) 20px 48px",
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
          marginBottom: 20,
        }}>
          How Safarly works
        </span>
        <h1 style={{
          fontSize: "clamp(2rem, 6vw, 3.5rem)",
          fontWeight: 900,
          color: "var(--sf-text)",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 20,
        }}>
          Your Saudi journey,<br />
          <span style={{ color: "var(--sf-accent)" }}>intelligently crafted</span>
        </h1>
        <p style={{
          fontSize: "clamp(1rem, 2.5vw, 1.1875rem)",
          color: "var(--sf-text-muted)",
          lineHeight: 1.7,
          maxWidth: 600,
          margin: "0 auto 36px",
        }}>
          Safarly is Saudi Arabia's first multi-agent AI travel companion. Eight specialised agents
          collaborate behind the scenes — each one an expert — to plan, guide, translate, and enrich
          every moment of your journey.
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
            transition: "box-shadow 0.2s, opacity 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          {t("cta.start")}
          <ArrowRight size={18} />
        </Link>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── 8 Agents ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 72px" }}>
        <h2 style={{
          textAlign: "center",
          fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
          fontWeight: 800,
          color: "var(--sf-text)",
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}>
          {t("agents.title")}
        </h2>
        <p style={{ textAlign: "center", color: "var(--sf-text-muted)", marginBottom: 44, maxWidth: 520, margin: "0 auto 44px" }}>
          Each agent is purpose-built. Together they reason, verify, and optimise in real time.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}>
          {AGENTS.map(a => (
            <div
              key={a.title}
              style={{
                background: "var(--sf-surface)",
                border: "1px solid var(--sf-border)",
                borderRadius: 14,
                padding: "20px 18px",
              }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: 10, lineHeight: 1 }}>{a.icon}</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--sf-text)", marginBottom: 6 }}>
                {a.title}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.55 }}>
                {a.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Key features ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 72px" }}>
        <h2 style={{
          textAlign: "center",
          fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
          fontWeight: 800,
          color: "var(--sf-text)",
          letterSpacing: "-0.02em",
          marginBottom: 44,
        }}>
          Everything you need on the ground
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {FEATURES.map(f => (
            <Link
              key={f.title}
              href={f.href}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--sf-surface)",
                  border: "1px solid var(--sf-border)",
                  borderRadius: 14,
                  padding: "24px 20px",
                  height: "100%",
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--sf-indigo)";
                  el.style.boxShadow = "0 0 20px rgba(92,108,255,0.12)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--sf-border)";
                  el.style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "color-mix(in srgb, var(--sf-indigo) 14%, var(--sf-surface-alt))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}>
                  <f.Icon size={20} style={{ color: "var(--sf-indigo)" }} aria-hidden />
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--sf-text)", marginBottom: 6 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.55 }}>
                  {f.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--sf-border)", maxWidth: 900, margin: "0 auto 64px" }} />

      {/* ── Vision 2030 band ──────────────────────────────────────────── */}
      <section style={{
        maxWidth: 680, margin: "0 auto 72px",
        padding: "28px 32px",
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        borderRadius: 16,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>🇸🇦</div>
        <p style={{ fontSize: "0.9375rem", color: "var(--sf-text-muted)", lineHeight: 1.7 }}>
          {t("vision.text")}
        </p>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "0 20px 32px" }}>
        <h2 style={{
          fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
          fontWeight: 800,
          color: "var(--sf-text)",
          marginBottom: 12,
          letterSpacing: "-0.02em",
        }}>
          Ready to explore?
        </h2>
        <p style={{ color: "var(--sf-text-muted)", marginBottom: 28 }}>
          Let eight AI agents plan every detail of your perfect journey.
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
