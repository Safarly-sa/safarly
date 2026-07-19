/**
 * DestinationCarousel — full-bleed hero background carousel.
 * Ken Burns zoom-pan (CSS only, GPU-composited), cross-fade via AnimatePresence,
 * dot indicators, pause-on-hover, prefers-reduced-motion safe.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { getStartPath } from "@/lib/auth";

interface HeroSlide {
  id: string;
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  region: string;
  imageUrl: string;
  alt: string;
  /** fallback bg colour if image fails to load */
  fallback: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "alula",
    nameEn: "AlUla — Hegra",
    nameAr: "العُلا — الحِجر",
    taglineEn: "Nabataean tombs carved into rose-red sandstone",
    taglineAr: "مقابر نبطية محفورة في الحجر الرملي الوردي",
    region: "Western",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/alula-banner-new?wid=1920&fit=constrain&fmt=webp",
    alt: "AlUla — official Visit Saudi hero image",
    fallback: "#1A1008",
  },
  {
    id: "edge",
    nameEn: "Edge of the World",
    nameAr: "حافة العالم",
    taglineEn: "Stand at the rim of a 300 m cliff above an endless horizon",
    taglineAr: "قف على حافة جرف ارتفاعه ٣٠٠ متر فوق الأفق اللانهائي",
    region: "Central",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/New-Tabuk_Image-Banner?wid=1920&fit=constrain&fmt=webp",
    alt: "Edge of the World — dramatic escarpment near Riyadh, official Visit Saudi",
    fallback: "#0D1520",
  },
  {
    id: "abha",
    nameEn: "Abha — Soudah",
    nameAr: "أبها — السودة",
    taglineEn: "Emerald Aseer highlands above the clouds",
    taglineAr: "مرتفعات عسير الزمردية فوق الغيوم",
    region: "Southern",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/about-abha_hero_banner_desktop-1?wid=1920&fit=constrain&fmt=webp",
    alt: "Abha — official Visit Saudi hero image",
    fallback: "#0A1A0E",
  },
  {
    id: "farasan",
    nameEn: "Farasan Islands",
    nameAr: "جزر فرسان",
    taglineEn: "Pristine coral reefs and turquoise Red Sea waters",
    taglineAr: "شعاب مرجانية نقية ومياه حمراء فيروزية",
    region: "Southern",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/yanbu-new-hero-banner?wid=1920&fit=constrain&fmt=webp",
    alt: "Yanbu Red Sea coast — official Visit Saudi hero image",
    fallback: "#031822",
  },
  {
    id: "umluj",
    nameEn: "Umluj",
    nameAr: "أملج",
    taglineEn: "The Maldives of Saudi — white sand, calm lagoons",
    taglineAr: "جزر المالديف السعودية — رمال بيضاء وبحيرات هادئة",
    region: "Northern",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/new-alahsa-banner?wid=1920&fit=constrain&fmt=webp",
    alt: "Al-Ahsa Oasis — official Visit Saudi hero image",
    fallback: "#031A20",
  },
  {
    id: "diriyah",
    nameEn: "Diriyah",
    nameAr: "الدرعية",
    taglineEn: "UNESCO At-Turaif — birthplace of the Saudi state",
    taglineAr: "التراث العالمي لليونسكو — الدرعية مهد الدولة السعودية",
    region: "Central",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/diriyah-hero-banner?wid=1920&fit=constrain&fmt=webp",
    alt: "Diriyah At-Turaif — official Visit Saudi hero image",
    fallback: "#1A0D05",
  },
  {
    id: "jeddah",
    nameEn: "Al-Balad, Jeddah",
    nameAr: "البلد — جدة",
    taglineEn: "UNESCO coral-stone heritage district by the Red Sea",
    taglineAr: "منطقة التراث العالمي من الحجر المرجاني على البحر الأحمر",
    region: "Western",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/jeddah-banner?wid=1920&fit=constrain&fmt=webp",
    alt: "Jeddah — official Visit Saudi hero image",
    fallback: "#12100A",
  },
  {
    id: "ahsa",
    nameEn: "Al-Ahsa Oasis",
    nameAr: "واحة الأحساء",
    taglineEn: "UNESCO world's largest date-palm oasis",
    taglineAr: "أكبر واحة نخيل في العالم — تراث إنساني يونسكو",
    region: "Eastern",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/New-Najran-Banner-Image?wid=1920&fit=constrain&fmt=webp",
    alt: "Najran — official Visit Saudi hero image",
    fallback: "#0C1608",
  },
  {
    id: "taif",
    nameEn: "Taif",
    nameAr: "الطائف",
    taglineEn: "City of roses, cable cars, and cool mountain air",
    taglineAr: "مدينة الورود والتلفريك والهواء الجبلي البارد",
    region: "Western",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/Taif-banner-new?wid=1920&fit=constrain&fmt=webp",
    alt: "Taif — official Visit Saudi hero image",
    fallback: "#1A0815",
  },
  {
    id: "neom",
    nameEn: "NEOM — The Red Sea Project",
    nameAr: "نيوم — مشروع البحر الأحمر",
    taglineEn: "Saudi Arabia's bold new frontier on the Red Sea coast",
    taglineAr: "الحدود السعودية الجديدة الجريئة على ساحل البحر الأحمر",
    region: "Northern",
    imageUrl:
      "https://scth.scene7.com/is/image/scth/redsea-new?wid=1920&fit=constrain&fmt=webp",
    alt: "NEOM & Red Sea Project — official Visit Saudi hero image",
    fallback: "#0A0C14",
  },
];

const INTERVAL_MS = 6000;

export function DestinationCarousel({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { t, dir } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Check for prefers-reduced-motion */
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const advance = useCallback(() => {
    setCurrent((c) => (c + 1) % HERO_SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(advance, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, advance]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    /* Reset timer so we get a full interval from the clicked slide */
    if (timerRef.current) clearInterval(timerRef.current);
    if (!paused) {
      timerRef.current = setInterval(advance, INTERVAL_MS);
    }
  };

  const slide = HERO_SLIDES[current];
  const isAr = dir === "rtl";

  return (
    <section
      className="relative w-full min-h-[92vh] flex flex-col items-center justify-center overflow-hidden"
      aria-label={isAr ? "عرض الوجهات" : "Destination showcase"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* ── Background images with Ken Burns ────────────────────────── */}
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            prefersReduced
              ? { duration: 0 }
              : { duration: 1.4, ease: "easeInOut" }
          }
          aria-hidden
        >
          {imgErrors[slide.id] ? (
            <div
              className="absolute inset-0"
              style={{ background: slide.fallback }}
            />
          ) : (
            <img
              src={slide.imageUrl}
              alt={slide.alt}
              className="absolute inset-0 w-full h-full object-cover"
              style={
                prefersReduced
                  ? {}
                  : {
                      animation: "sf-kenburns 6s ease-out forwards",
                      transformOrigin: "center center",
                    }
              }
              onError={() =>
                setImgErrors((prev) => ({ ...prev, [slide.id]: true }))
              }
              loading="eager"
              decoding="async"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Gradient overlays ────────────────────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,14,22,0.55) 0%, rgba(10,14,22,0.18) 40%, rgba(10,14,22,0.62) 80%, rgba(10,14,22,0.9) 100%)",
        }}
      />

      {/* ── Hero copy + CTAs ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center px-4 pt-24 pb-32">
        {/* Slide label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`label-${slide.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.4 }}
            className="mb-6 flex items-center justify-center gap-2"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border"
              style={{
                background: "rgba(0,216,164,0.12)",
                borderColor: "rgba(0,216,164,0.35)",
                color: "var(--sf-accent)",
              }}
            >
              {slide.region}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {slide.nameEn}
            </span>
            <span
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
              dir="rtl"
              lang="ar"
            >
              {slide.nameAr}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Main headline — always visible, children or default.
            The Safarly lockup used to sit here at up to 240px with a glow, but it
            out-sized the headline and duplicated the Navbar logo already visible
            in the same viewport. The headline is the hero's primary message. */}
        {children ?? (
          <motion.h1
            className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-[-0.02em] leading-tight mb-6"
            style={{ color: "#FFFFFF" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            {t("hero.headline")}
          </motion.h1>
        )}

        {/* Tagline that changes per slide */}
        <AnimatePresence mode="wait">
          <motion.p
            key={`tag-${slide.id}`}
            className="text-base md:text-lg mb-10 max-w-xl mx-auto italic"
            style={{ color: "rgba(255,255,255,0.72)" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.4 }}
          >
            {isAr ? slide.taglineAr : slide.taglineEn}
          </motion.p>
        </AnimatePresence>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link
            href={getStartPath()}
            data-testid="link-start-planning"
            className="w-full sm:w-auto px-8 py-4 bg-[var(--sf-accent)] hover:bg-[var(--sf-accent-hover)] text-[#0A0E16] font-semibold text-lg transition-all duration-200 shadow-[0_0_20px_rgba(0,216,164,0.4)] hover:shadow-[0_0_36px_rgba(0,216,164,0.65)] flex items-center justify-center gap-2 active:scale-[0.98]"
            style={{ borderRadius: "10px" }}
          >
            {t("cta.start")}
            <ArrowRight className="w-5 h-5 rtl:rotate-180" />
          </Link>
          <Link
            href="/about"
            data-testid="link-see-how"
            className="w-full sm:w-auto px-8 py-4 font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
            style={{
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "rgba(255,255,255,0.9)",
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            }}
          >
            {t("cta.howItWorks")}
          </Link>
        </motion.div>
      </div>

      {/* ── Dot indicators ───────────────────────────────────────────── */}
      {/* `left-1/2` is deliberately physical, not the logical `start-1/2`.
          Pairing `start-1/2` with `-translate-x-1/2` breaks under RTL: `start`
          flips to `right: 50%` but `translate-x` does not flip, so the row lands
          a full width left of centre. Centring is direction-neutral — keep both
          halves physical. */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10"
        role="tablist"
        aria-label={isAr ? "مؤشرات الشرائح" : "Slide indicators"}
      >
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === current}
            aria-label={`${isAr ? "انتقل إلى الشريحة" : "Go to slide"} ${i + 1}: ${s.nameEn}`}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              width: i === current ? "28px" : "8px",
              height: "8px",
              background:
                i === current
                  ? "var(--sf-accent)"
                  : "rgba(255,255,255,0.38)",
              outline: "none",
            }}
          />
        ))}
      </div>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      {!prefersReduced && (
        <div
          aria-hidden
          className="absolute bottom-0 start-0 h-[2px] w-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <motion.div
            key={`${slide.id}-${paused}`}
            className="h-full"
            style={{ background: "var(--sf-accent)", originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: paused ? 0 : 1 }}
            transition={
              paused ? { duration: 0 } : { duration: INTERVAL_MS / 1000, ease: "linear" }
            }
          />
        </div>
      )}
    </section>
  );
}
