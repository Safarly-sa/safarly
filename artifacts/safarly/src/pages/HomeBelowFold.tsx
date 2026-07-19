/**
 * HomeBelowFold — sections 2-6 of the landing page.
 * Lazy-imported by home.tsx so they don't block initial paint.
 */
import { useTranslation } from "@/providers/translation-context";
import { motion } from "framer-motion";
import {
  MapPin, MessageCircle, Camera, Languages, Compass, ArrowRight, Globe, BookOpen,
} from "lucide-react";
import { Link } from "wouter";

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
];

export function HomeBelowFold() {
  const { t } = useTranslation();

  return (
    <>
      <DottedDivider />

      {/* ── 2. Feature Cards ─────────────────────────────────────────── */}
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
      <section className="py-24 px-4 bg-muted/20">
        <FadeUp>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              {t("how.title")}
            </h2>
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
                  <div className="absolute -start-[9px] top-1.5 w-4 h-4 rounded-full bg-[var(--sf-accent)] border-[3px] border-background shadow-[0_0_12px_rgba(0,216,164,0.55)]" />
                  <h3 className="text-xl font-bold mb-2">
                    <span className="text-[var(--sf-text-accent)] text-sm me-2 font-mono tabular-nums">
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
