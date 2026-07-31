/**
 * HomeBelowFold — sections 2-7 of the landing page.
 * Lazy-imported by home.tsx so they don't block initial paint.
 */
import { useTranslation } from "@/providers/translation-context";
import { useTheme } from "@/providers/ThemeProvider";
import { useRef } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";

/** Shared easing so the whole entrance reads as one movement. */
const EASE = [0.16, 1, 0.3, 1] as const;
import {
  MapPin, MessageCircle, Camera, Languages, Compass, ArrowRight, BookOpen,
} from "lucide-react";
import { Link } from "wouter";
import { DestinationGallery } from "@/components/DestinationGallery";
import vision2030Light from "@assets/vision2030-light.png";
import vision2030Dark from "@assets/vision2030-dark.png";

function FadeUp({
  children, delay = 0, className = "",
}: { children: React.ReactNode; delay?: number; className?: string }) {
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

/**
 * How It Works — a three-column row that assembles itself as it scrolls in.
 *
 * One orchestrated entrance rather than three independent ones: a mint-to-indigo
 * rail draws across the row, its nodes pop as it passes, then each step's
 * numeral, rule, title and copy cascade in behind it. The shared easing and a
 * single stagger are what make it read as one movement rather than four.
 *
 * Bilingual by design: the step title renders in the active locale and the
 * opposite script sits quietly beneath it. Arabic is the fixed counterpart
 * (English when the locale already is Arabic) — the same device
 * DestinationGallery uses when it shows nameAr on every card regardless of
 * locale. Those Arabic strings are held here rather than fetched through t(),
 * which only ever returns the active locale.
 *
 * Mirrored for RTL: transformOrigin on the rail and rules follows dir, so the
 * draw runs right-to-left in Arabic and Urdu instead of against the reading
 * direction.
 *
 * Honours prefers-reduced-motion by collapsing every variant to a plain fade —
 * a drawing line and popping nodes are exactly the sweeping motion that setting
 * exists to suppress.
 */

/** Arabic step titles, for the secondary line under non-Arabic locales.
 *  Kept in sync with how.step* in locales/ar.json. */
const STEPS_AR: Record<number, string> = {
  1: "شاركنا أهداف رحلتك",
  2: "نصمم خطة رحلتك المثالية",
  3: "سافر بإرشاد ذكي في الوقت الفعلي",
};
/** English counterpart, shown when the active locale is Arabic. */
const STEPS_EN: Record<number, string> = {
  1: "Share your travel goals",
  2: "Agents craft your perfect itinerary",
  3: "Travel with real-time AI guidance",
};

function HowItWorks() {
  const { t, dir } = useTranslation();
  const reduceMotion = useReducedMotion();
  const isRtl = dir === "rtl";

  const sectionRef = useRef<HTMLElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-15%" });

  const container: Variants = {
    hidden: {},
    show: {
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.14, delayChildren: 0.22 },
    },
  };
  const maskUp: Variants = {
    hidden: { y: reduceMotion ? 0 : "110%", opacity: reduceMotion ? 0 : 1 },
    show: { y: 0, opacity: 1, transition: { duration: reduceMotion ? 0.3 : 0.85, ease: EASE } },
  };
  const rail: Variants = {
    hidden: { scaleX: reduceMotion ? 1 : 0, opacity: reduceMotion ? 0 : 1 },
    show: { scaleX: 1, opacity: 1, transition: { duration: reduceMotion ? 0.3 : 1.15, ease: EASE } },
  };
  const node: Variants = {
    hidden: { scale: reduceMotion ? 1 : 0, opacity: 0 },
    show: { scale: 1, opacity: 1, transition: { duration: reduceMotion ? 0.3 : 0.5, ease: EASE } },
  };
  const numeral: Variants = {
    hidden: { y: reduceMotion ? 0 : 28, opacity: 0 },
    // Full opacity: the numeral's colour is already text-foreground, i.e.
    // --sf-text — near-black in light mode, near-white in dark. At the
    // previous 0.1 opacity both read as the same faint grey, which erased
    // that per-theme contrast rather than showing it.
    show: { y: 0, opacity: 1, transition: { duration: reduceMotion ? 0.3 : 0.9, ease: EASE } },
  };
  const rule: Variants = {
    hidden: { scaleX: reduceMotion ? 1 : 0, opacity: reduceMotion ? 0 : 1 },
    show: { scaleX: 1, opacity: 1, transition: { duration: reduceMotion ? 0.3 : 0.6, ease: EASE } },
  };
  const fade: Variants = {
    hidden: { y: reduceMotion ? 0 : 14, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: reduceMotion ? 0.3 : 0.6, ease: EASE } },
  };

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-muted/20 relative overflow-hidden">
      {/* Soft mint bloom anchored behind the rail, for depth */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineStart: "50%",
          top: "58%",
          width: "min(1100px, 90vw)",
          height: 380,
          transform: `translate(${isRtl ? "50%" : "-50%"}, -50%)`,
          background: "radial-gradient(ellipse at center, rgba(0,216,164,0.07), transparent 68%)",
        }}
      />

      <motion.div
        className="max-w-7xl mx-auto relative"
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
      >
        {/* Heading — slides out from behind a clipping mask */}
        <div className="mb-16 md:mb-20 max-w-[30ch]">
          <span className="block overflow-hidden">
            <motion.span
              className="block text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground mb-4"
              variants={maskUp}
            >
              {t("how.overline")}
            </motion.span>
          </span>
          <h2 className="m-0">
            <span className="block overflow-hidden">
              <motion.span
                className="block font-extrabold text-foreground"
                style={{
                  fontSize: "clamp(2.1rem, 5.4vw, 4.2rem)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.042em",
                  paddingBottom: "0.08em", // keeps descenders inside the mask
                }}
                variants={maskUp}
              >
                {t("how.title")}
                <span style={{ color: "var(--sf-accent)" }}>.</span>
              </motion.span>
            </span>
          </h2>
        </div>

        {/* Steps. The rail lives inside the grid so it lines up with the node
            row whatever the column widths resolve to. */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-y-14 md:gap-y-0 md:gap-x-12">
          {/* A horizontal thread only reads as one across a row — drop it once
              the steps stack on mobile. */}
          <div
            aria-hidden
            className="hidden md:block absolute top-[7px] inset-x-0 h-px bg-border"
            style={{
              WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
              maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
            }}
          >
            <motion.span
              className="block h-full w-full"
              style={{
                background: "linear-gradient(90deg, var(--sf-accent), var(--sf-indigo))",
                transformOrigin: isRtl ? "right center" : "left center",
                willChange: "transform",
              }}
              variants={rail}
            />
          </div>

          {[1, 2, 3].map((step) => (
            <motion.div key={step} variants={container} data-testid={`step-how-${step}`}>
              <div aria-hidden className="hidden md:flex items-center h-[15px] mb-8">
                <motion.span
                  className="grid place-items-center w-[15px] h-[15px] rounded-full bg-background shadow-[0_0_0_1px_var(--sf-border)]"
                  variants={node}
                >
                  <span className="w-[7px] h-[7px] rounded-full bg-[var(--sf-accent)] shadow-[0_0_12px_rgba(0,216,164,0.85)]" />
                </motion.span>
              </div>

              {/* Ghost numeral watermark — step order is already carried by
                  reading order, so keep it out of the a11y tree. */}
              <motion.span
                aria-hidden
                className="block font-black text-foreground select-none"
                style={{
                  fontSize: "clamp(4.2rem, 8.5vw, 7rem)",
                  lineHeight: 0.8,
                  letterSpacing: "-0.06em",
                  marginBottom: "1.35rem",
                }}
                variants={numeral}
              >
                {step}
              </motion.span>

              <motion.span
                aria-hidden
                className="block w-[46px] h-[3px] rounded-full bg-[var(--sf-accent)] shadow-[0_0_14px_rgba(0,216,164,0.5)] mb-5"
                style={{ transformOrigin: isRtl ? "right center" : "left center" }}
                variants={rule}
              />

              <h3 className="m-0 mb-3.5">
                <span className="block overflow-hidden">
                  <motion.span
                    className="block font-extrabold text-foreground"
                    style={{
                      fontSize: "clamp(1.2rem, 1.9vw, 1.5rem)",
                      lineHeight: 1.25,
                      letterSpacing: "-0.022em",
                      paddingBottom: "0.08em",
                    }}
                    variants={maskUp}
                  >
                    {t(`how.step${step}`)}
                  </motion.span>
                </span>
              </h3>

              <motion.p
                className="m-0 mb-3.5 text-[0.96rem] leading-relaxed text-muted-foreground max-w-[30ch]"
                variants={fade}
              >
                {t(`how.step${step}.desc`)}
              </motion.p>

              {/* Opposite script, quiet, underneath. dir is set so bidi renders
                  correctly, but alignment follows the PAGE — text-align:start
                  would resolve against this element's own dir and float it away
                  from the line it belongs under. */}
              <motion.p
                className={`m-0 text-[0.88rem] font-semibold leading-normal text-muted-foreground/70 max-w-[30ch] ${isRtl ? "text-right" : "text-left"}`}
                dir={isRtl ? "ltr" : "rtl"}
                lang={isRtl ? "en" : "ar"}
                variants={fade}
              >
                {isRtl ? STEPS_EN[step] : STEPS_AR[step]}
              </motion.p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

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

const FEATURES = [
  { id: "planner",     icon: MapPin,       titleKey: "feature.planner.title",     descKey: "feature.planner.desc",     comingSoon: false },
  { id: "dialect",     icon: MessageCircle,titleKey: "feature.dialect.title",      descKey: "feature.dialect.desc",     comingSoon: false },
  { id: "lens",        icon: Camera,       titleKey: "feature.lens.title",         descKey: "feature.lens.desc",        comingSoon: false },
  { id: "translation", icon: Languages,    titleKey: "feature.translation.title",  descKey: "feature.translation.desc", comingSoon: false },
  { id: "guides",      icon: Compass,      titleKey: "feature.guides.title",       descKey: "feature.guides.desc",      comingSoon: true  },
  { id: "culture",     icon: BookOpen,     titleKey: "feature.culture.title",      descKey: "feature.culture.desc",     comingSoon: false },
];

const AGENT_CHIPS = [
  "agents.chips.goal", "agents.chips.discovery", "agents.chips.restaurant",
  "agents.chips.budget", "agents.chips.culture", "agents.chips.safety",
  "agents.chips.sustainability", "agents.chips.verification",
  "agents.chips.events", "agents.chips.transport", "agents.chips.accommodation",
  "agents.chips.concierge", "agents.chips.dialect", "agents.chips.vision",
];

export function HomeBelowFold() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <>
      <DottedDivider />

      {/* ── 2. Destination Gallery ───────────────────────────────────── */}
      <DestinationGallery />

      <DottedDivider />

      {/* ── 3. Feature Cards ─────────────────────────────────────────── */}
      <section className="py-20 bg-muted/30 px-4">
        <div className="max-w-7xl mx-auto">
          <FadeUp className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              What we offer
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Your Complete Journey, Covered
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="feature-card group p-6 bg-card border border-border transition-[border-color,box-shadow] duration-300 shadow-sm relative overflow-hidden"
                style={{ borderRadius: "10px" }}
                data-testid={`card-feature-${feature.id}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--sf-indigo)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                {feature.comingSoon && (
                  <span
                    className="absolute top-4 end-4 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full z-10"
                    style={{ background: "rgba(92,108,255,0.15)", color: "var(--sf-indigo)", border: "1px solid rgba(92,108,255,0.3)" }}
                  >
                    Coming soon
                  </span>
                )}
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
              {AGENT_CHIPS.map((chipKey, i) => (
                <motion.div
                  key={chipKey}
                  initial={{ opacity: 0, scale: 0.88 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.055 }}
                  className="px-4 py-2 bg-[var(--sf-primary-soft)] border border-border text-sm font-semibold text-foreground whitespace-nowrap hover:border-[var(--sf-indigo)] transition-colors duration-200"
                  style={{ borderRadius: "10px" }}
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
      <HowItWorks />

      <DottedDivider />

      {/* ── 5. Vision 2030 Band ──────────────────────────────────────── */}
      <section className="w-full py-10 bg-muted relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize:  "12px 12px",
          }}
        />
        <FadeUp>
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-4 relative z-10 text-center">
            <img
              src={theme === "dark" ? vision2030Dark : vision2030Light}
              alt="Saudi Vision 2030"
              className="h-16 md:h-20 w-auto shrink-0"
            />
            <p className="text-sm md:text-base font-medium text-foreground max-w-2xl">
              {t("vision.text")}
            </p>
            <Link
              href="/vision-2030"
              className="text-sm font-semibold shrink-0 inline-flex items-center gap-1 text-[var(--sf-text-accent)] hover:opacity-80 transition-opacity"
              data-testid="link-vision2030-learn-more"
            >
              {t("vision2030.learn_more")}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
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
              Let Safarly's AI agents plan every detail of your perfect journey.
            </p>
            <Link
              href="/onboarding"
              data-testid="link-cta-bottom"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-[var(--sf-accent)] hover:bg-[var(--sf-accent-hover)] text-[#0A0E16] font-semibold text-lg transition-all duration-200 shadow-[0_0_24px_rgba(0,216,164,0.28)] hover:shadow-[0_0_40px_rgba(0,216,164,0.5)] active:scale-[0.98]"
              style={{ borderRadius: "10px" }}
            >
              {t("cta.start")}
              <ArrowRight className="w-5 h-5 rtl:rotate-180" />
            </Link>
          </div>
        </FadeUp>
      </section>
    </>
  );
}
