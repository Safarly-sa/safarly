import { useTranslation } from "@/providers/I18nProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  MapPin,
  MessageCircle,
  Camera,
  Languages,
  Compass,
  ArrowRight,
  Globe,
} from "lucide-react";
import safarlyLogo from "@assets/safarly-transparent_1784408718766.png";

/* ── Scroll-reveal wrapper ─────────────────────────────────────────── */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Dotted-grid section divider ───────────────────────────────────── */
function DottedDivider() {
  return (
    <div
      aria-hidden
      className="w-full h-10 border-y border-border overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(130,145,165,0.22) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        backgroundPosition: "center",
      }}
    />
  );
}

/* ── Landing page ──────────────────────────────────────────────────── */
export function Home() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const features = [
    {
      id: "planner",
      icon: MapPin,
      titleKey: "feature.planner.title",
      descKey: "feature.planner.desc",
    },
    {
      id: "dialect",
      icon: MessageCircle,
      titleKey: "feature.dialect.title",
      descKey: "feature.dialect.desc",
    },
    {
      id: "lens",
      icon: Camera,
      titleKey: "feature.lens.title",
      descKey: "feature.lens.desc",
    },
    {
      id: "translation",
      icon: Languages,
      titleKey: "feature.translation.title",
      descKey: "feature.translation.desc",
    },
    {
      id: "guides",
      icon: Compass,
      titleKey: "feature.guides.title",
      descKey: "feature.guides.desc",
    },
  ];

  const agentChips = [
    "agents.chips.goal",
    "agents.chips.discovery",
    "agents.chips.restaurant",
    "agents.chips.budget",
    "agents.chips.culture",
    "agents.chips.safety",
    "agents.chips.sustainability",
    "agents.chips.verification",
  ];

  /* Glow filter applied to hero logo in dark mode only */
  const heroLogoStyle =
    theme === "dark"
      ? {
          filter:
            "drop-shadow(0 0 18px rgba(0,216,164,0.5)) drop-shadow(0 0 42px rgba(92,108,255,0.22))",
        }
      : undefined;

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 md:pt-44 md:pb-32 overflow-hidden px-4">
        {/* Geometric background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03] dark:opacity-[0.05]">
          <svg
            viewBox="0 0 800 800"
            className="w-[150%] h-[150%] md:w-full md:h-full text-foreground"
            style={{ animation: "spin 120s linear infinite" }}
          >
            <circle cx="400" cy="400" r="300" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="10 20" />
            <polygon points="400,150 616,525 184,525" fill="none" stroke="currentColor" strokeWidth="1" />
            <polygon points="400,650 184,275 616,275" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Hero logo mark with dark-mode glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center mb-8"
          >
            <img
              src={safarlyLogo}
              alt="Safarly logo"
              className="h-28 md:h-36 w-auto object-contain transition-[filter] duration-500"
              style={heroLogoStyle}
              data-testid="img-hero-logo"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <p className="text-accent font-bold text-lg mb-4 tracking-wider" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
              {t("hero.greeting")}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-[-0.02em] leading-tight mb-6 text-foreground">
              {t("hero.headline")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {t("hero.subtext")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/onboarding"
                data-testid="link-start-planning"
                className="w-full sm:w-auto px-8 py-4 bg-[var(--sf-accent)] hover:bg-[var(--sf-accent-hover)] text-[#0A0E16] rounded font-semibold text-lg transition-all duration-200 shadow-[0_0_20px_rgba(0,216,164,0.28)] hover:shadow-[0_0_32px_rgba(0,216,164,0.5)] flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {t("cta.start")}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </Link>
              <Link
                href="/lens"
                data-testid="link-see-how"
                className="w-full sm:w-auto px-8 py-4 border border-[var(--sf-indigo)] text-[var(--sf-indigo)] hover:bg-[var(--sf-indigo)] hover:text-white rounded font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {t("cta.howItWorks")}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 start-1/2 -translate-x-1/2 flex-col items-center gap-2 text-muted-foreground hidden md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.2, duration: 1 }}
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-current to-transparent animate-pulse" />
        </motion.div>
      </section>

      <DottedDivider />

      {/* ── 2. Feature Cards ─────────────────────────────────────────── */}
      <section className="py-20 bg-muted/30 px-4">
        <div className="max-w-7xl mx-auto">
          <FadeUp className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">What we offer</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Your Complete Journey, Covered</h2>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="feature-card group p-6 rounded-lg bg-card border border-border transition-[border-color,box-shadow] duration-300 shadow-sm relative overflow-hidden"
                data-testid={`card-feature-${feature.id}`}
              >
                {/* hover overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--sf-indigo)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <feature.icon className="w-8 h-8 text-[var(--sf-indigo)] mb-4 relative z-10" />
                <h3 className="text-xl font-bold mb-2 text-foreground relative z-10">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-muted-foreground relative z-10">{t(feature.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <DottedDivider />

      {/* ── 3. Agents at Work ────────────────────────────────────────── */}
      <section className="py-16 px-4 overflow-hidden">
        <FadeUp>
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-8">
              {t("agents.title")}
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {agentChips.map((chipKey, i) => (
                <motion.div
                  key={chipKey}
                  initial={{ opacity: 0, scale: 0.88 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.055 }}
                  className="px-4 py-2 rounded bg-[var(--sf-primary-soft)] border border-border text-sm font-semibold text-foreground whitespace-nowrap hover:border-[var(--sf-indigo)] transition-colors duration-200"
                  data-testid={`chip-agent-${i}`}
                >
                  {t(chipKey)}
                </motion.div>
              ))}
            </div>
          </div>
        </FadeUp>
      </section>

      <DottedDivider />

      {/* ── 4. How It Works ──────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-muted/20">
        <FadeUp>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t("how.title")}</h2>

            <div className="relative border-s-2 border-border ms-4 md:ms-8 space-y-12">
              {[1, 2, 3].map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.18 }}
                  className="relative ps-8"
                  data-testid={`step-how-${step}`}
                >
                  {/* Accent node on timeline */}
                  <div className="absolute -start-[9px] top-1.5 w-4 h-4 rounded-full bg-[var(--sf-accent)] border-[3px] border-background shadow-[0_0_12px_rgba(0,216,164,0.55)]" />
                  <h3 className="text-xl font-bold mb-2">
                    <span className="text-[var(--sf-accent)] text-sm me-2 font-mono tabular-nums">
                      0{step}
                    </span>
                    {t(`how.step${step}`)}
                  </h3>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeUp>
      </section>

      <DottedDivider />

      {/* ── 5. Vision 2030 Band ──────────────────────────────────────── */}
      <section className="w-full py-10 bg-muted relative overflow-hidden">
        {/* Dot texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
        <FadeUp>
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-4 relative z-10 text-center">
            <Globe className="w-6 h-6 text-muted-foreground shrink-0" />
            <p className="text-sm md:text-base font-medium text-foreground max-w-2xl">
              {t("vision.text")}
            </p>
          </div>
        </FadeUp>
      </section>

      <DottedDivider />

      {/* ── 6. Final CTA ─────────────────────────────────────────────── */}
      <section className="py-32 px-4 text-center">
        <FadeUp>
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
              Ready to explore Saudi Arabia?
            </h2>
            <p className="text-muted-foreground mb-10 text-lg">
              Let eight AI agents plan every detail of your perfect journey.
            </p>
            <Link
              href="/onboarding"
              data-testid="link-cta-bottom"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-[var(--sf-accent)] hover:bg-[var(--sf-accent-hover)] text-[#0A0E16] rounded font-semibold text-lg transition-all duration-200 shadow-[0_0_24px_rgba(0,216,164,0.28)] hover:shadow-[0_0_40px_rgba(0,216,164,0.5)] active:scale-[0.98]"
            >
              {t("cta.start")}
              <ArrowRight className="w-5 h-5 rtl:rotate-180" />
            </Link>
          </div>
        </FadeUp>
      </section>

    </div>
  );
}

/* Tailwind needs a @keyframes spin referenced in className — provide it inline */
const _spinStyle = `@keyframes spin { to { transform: rotate(360deg); } }`;
