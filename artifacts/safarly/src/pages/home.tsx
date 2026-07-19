import { lazy, Suspense } from "react";
import { useTranslation } from "@/providers/translation-context";
import { motion } from "framer-motion";
import { usePageMeta } from "@/lib/usePageMeta";
import { DestinationCarousel } from "@/components/DestinationCarousel";

/* Below-fold sections (Features, Agents, How It Works, Vision, CTA)
   are lazy-loaded so the hero paints on first frame. */
const LazyBelowFold = lazy(() =>
  import("./HomeBelowFold").then(m => ({ default: m.HomeBelowFold }))
);

/* ── Landing page ──────────────────────────────────────────────────── */
export function Home() {
  usePageMeta(
    "Plan Your Saudi Journey",
    "Eight AI agents plan, guide, translate and enrich every moment of your Saudi journey.",
  );

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── 1. Hero carousel (full-bleed, with headline + CTAs inside) ── */}
      <DestinationCarousel />

      {/* ── Sections 2+ (lazy-loaded, don't block hero paint) ───────── */}
      <Suspense fallback={<div style={{ minHeight: "40vh" }} aria-hidden />}>
        <LazyBelowFold />
      </Suspense>

    </div>
  );
}
