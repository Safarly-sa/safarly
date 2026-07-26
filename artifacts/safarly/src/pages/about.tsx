import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { AuroraHero } from "@/components/AuroraHero";
import { ArrowRight, ArrowDown, Camera, Languages, Map, LayoutDashboard } from "lucide-react";

const AGENTS = [
  { icon: "🎯", title: "Goal Analyzer",        desc: "Reads your travel goals and builds a weighted preference model to guide every downstream decision." },
  { icon: "🗺️", title: "Destination Scout",    desc: "Discovers attractions, hidden gems, and must-see sites perfectly matched to your interests and schedule." },
  { icon: "🍽️", title: "Restaurant Scout",     desc: "Curates local dining from hole-in-the-wall teahouses to fine Saudi cuisine, always halal-verified." },
  { icon: "💰", title: "Budget Optimizer",     desc: "Keeps your spend inside your SAR budget across transport, entry fees, and dining — day by day." },
  { icon: "🕌", title: "Cultural Advisor",     desc: "Flags prayer times, dress guidance, local customs, and etiquette so every interaction is respectful." },
  { icon: "🛡️", title: "Safety Monitor",       desc: "Monitors advisories and ensures every stop meets current travel-safety standards." },
  { icon: "🌱", title: "Sustainability Tracker", desc: "Prioritises eco-certified sites and low-impact experiences aligned with Saudi Vision 2030." },
  { icon: "✓",  title: "Verification Engine",  desc: "Cross-checks opening hours, prices, and availability in real time so your plan is always accurate." },
  { icon: "🎉", title: "Events Curator",        desc: "Surfaces festivals, exhibitions, and local events happening during your stay so nothing worth attending gets missed." },
  { icon: "🚗", title: "Transportation Planner", desc: "Plans the fastest, most comfortable way between every stop — rideshare, transit, or rental — matched to your budget." },
  { icon: "🏨", title: "Accommodation Finder",  desc: "Matches you to stays that fit your budget, location, and travel style, from boutique riads to major hotel chains." },
  { icon: "🛎️", title: "Personal Concierge",    desc: "Answers questions and adjusts your plan on the fly, day or night, like a concierge who never sleeps." },
  { icon: "🗣️", title: "Dialect Coach",         desc: "Teaches Najdi, Hijazi, and other regional phrases with pronunciation practice so you can speak like a local." },
  { icon: "👁️", title: "Vision & Translation",  desc: "Reads menus, signs, and landmarks through your camera, translating and explaining them in real time." },
];

const FEATURES = [
  { Icon: Camera,        title: "Live Lens",        desc: "Point your camera at a dish, landmark, or street sign. AI identifies it and gives you cultural context instantly.", href: "/lens" },
  { Icon: Languages,     title: "Dialect Tutor",    desc: "Practice Najdi, Hijazi, Janubi, and Shamali Arabic phrases with pronunciation coaching.", href: "/dialect" },
  { Icon: Map,           title: "Smart Itinerary",  desc: "A day-by-day plan built around your goals — with real-time replanning if a venue closes.", href: "/planner" },
  { Icon: LayoutDashboard, title: "Travel Dashboard", desc: "Track your ongoing and past trips, spending, and progress all in one place.", href: "/dashboard" },
];

export function About() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  usePageMeta("About Safarly", "Learn how Safarly's AI agents work together to craft your perfect Saudi journey.");

  /* Staggered entrance. Reduced motion keeps the fade but drops the rise, so
     the reveal still reads as sequential without any spatial movement. */
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.11, delayChildren: 0.04 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
  };

  function scrollToAgents() {
    document.getElementById("agents")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <div style={{ paddingTop: "var(--sf-navbar-h)", paddingBottom: "calc(24px + var(--sf-bottomnav-h))", background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <AuroraHero minHeight="clamp(520px, 80vh, 780px)">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ textAlign: "center", maxWidth: 780, margin: "0 auto", padding: "88px 20px 56px" }}
        >
          <motion.span variants={item} style={{
            display: "inline-block",
            padding: "5px 15px",
            borderRadius: 999,
            background: "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
            border: "1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)",
            color: "var(--sf-text-accent)",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 22,
            backdropFilter: "blur(6px)",
          }}>
            How Safarly works
          </motion.span>

          <motion.h1 variants={item} style={{
            fontSize: "clamp(2.1rem, 6.5vw, 3.75rem)",
            fontWeight: 900,
            color: "var(--sf-text)",
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            marginBottom: 22,
          }}>
            Your Saudi journey,<br />
            <span style={{
              background: "linear-gradient(100deg, var(--sf-accent), var(--sf-indigo))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}>
              intelligently crafted
            </span>
          </motion.h1>

          <motion.p variants={item} style={{
            fontSize: "clamp(1rem, 2.5vw, 1.1875rem)",
            color: "var(--sf-text-muted)",
            lineHeight: 1.7,
            maxWidth: 600,
            margin: "0 auto 36px",
          }}>
            {/* Two agents, six specialists — the real count. The old copy claimed
                14, which was never true of the running system and is the kind of
                number a curious reader can disprove in one click. */}
            Safarly is Saudi Arabia's first multi-agent AI travel companion. Two agents — the Smart
            Travel Planner and the Smart Companion — coordinate six specialists behind the scenes to
            plan, guide, translate, and enrich every moment of your journey.
          </motion.p>

          <motion.div variants={item} style={{
            display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center",
          }}>
            <Link
              href="/planner"
              className="sf-hero-cta-primary"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 30px", borderRadius: 12,
                background: "var(--sf-accent)", color: "#0A0E16",
                fontWeight: 700, fontSize: "1rem", textDecoration: "none",
                boxShadow: "0 8px 28px rgba(0,216,164,0.32)",
              }}
            >
              {t("cta.start")}
              <ArrowRight size={18} className="rtl:rotate-180" />
            </Link>
            <button
              type="button"
              onClick={scrollToAgents}
              className="sf-hero-cta-secondary"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 26px", borderRadius: 12,
                background: "color-mix(in srgb, var(--sf-surface) 70%, transparent)",
                border: "1px solid var(--sf-border)",
                color: "var(--sf-text)", fontWeight: 700, fontSize: "1rem",
                cursor: "pointer", backdropFilter: "blur(8px)",
              }}
            >
              Meet the agents
              <ArrowDown size={17} />
            </button>
          </motion.div>
        </motion.div>
      </AuroraHero>

      {/* ── 14 Agents ─────────────────────────────────────────────────── */}
      <section id="agents" style={{ maxWidth: 960, margin: "0 auto", padding: "64px 20px 72px", scrollMarginTop: 76 }}>
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
          Let Safarly's AI agents plan every detail of your perfect journey.
        </p>
        <Link
          href="/planner"
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
