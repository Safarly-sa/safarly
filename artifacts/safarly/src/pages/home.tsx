import { lazy, Suspense } from "react";
import { useTranslation } from "@/providers/translation-context";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";

/* Below-fold sections (Features, Agents, How It Works, Vision, CTA)
   are lazy-loaded so the hero paints on first frame. */
const LazyBelowFold = lazy(() =>
  import("./HomeBelowFold").then(m => ({ default: m.HomeBelowFold }))
);

/* ── Landing page ──────────────────────────────────────────────────── */
export function Home() {
  const { t } = useTranslation();

  usePageMeta(
    "Plan Your Saudi Journey",
    "Eight AI agents plan, guide, translate and enrich every moment of your Saudi journey.",
  );

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-10 md:pt-28 md:pb-16 overflow-hidden px-4">
        {/* Geometric background rings */}
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
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
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
                className="w-full sm:w-auto px-8 py-4 bg-[var(--sf-accent)] hover:bg-[var(--sf-accent-hover)] text-[#0A0E16] font-semibold text-lg transition-all duration-200 shadow-[0_0_20px_rgba(0,216,164,0.28)] hover:shadow-[0_0_32px_rgba(0,216,164,0.5)] flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ borderRadius: "10px" }}
              >
                {t("cta.start")}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </Link>
              <Link
                href="/lens"
                data-testid="link-see-how"
                className="w-full sm:w-auto px-8 py-4 border border-[var(--sf-indigo)] text-[var(--sf-indigo)] hover:bg-[var(--sf-indigo)] hover:text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ borderRadius: "10px" }}
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

      {/* ── Sections 2-6 (lazy-loaded, don't block hero paint) ─────── */}
      <Suspense fallback={<div style={{ minHeight: "40vh" }} aria-hidden />}>
        <LazyBelowFold />
      </Suspense>

    </div>
  );
}

/* @keyframes spin is referenced via inline style above.
   Keeping this const so bundlers don't tree-shake the comment. */
const _spinKeyframe = `@keyframes spin { to { transform: rotate(360deg); } }`;
void _spinKeyframe;
