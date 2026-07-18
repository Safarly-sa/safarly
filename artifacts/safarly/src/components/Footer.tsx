import safarlyLogo from "@assets/safarly-transparent_1784408718766.png";
import { useTranslation } from "@/providers/translation-context";
import { Link } from "wouter";

/* Hardcoded dark-mode palette — footer is always dark regardless of theme */
const C = {
  bg:      "#0A0E16",
  border:  "#232C3D",
  text:    "#EDEFF3",
  muted:   "#8A93A6",
  surface: "#1A2233",
};

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer
      className="pt-16 pb-24 md:pb-16 mt-auto"
      style={{ backgroundColor: C.bg, borderTop: `1px solid ${C.border}`, color: C.text }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">

          {/* Brand column */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 group outline-none inline-flex mb-4">
              <img
                src={safarlyLogo}
                alt="Safarly"
                className="h-8 w-auto object-contain transition-opacity duration-300"
                style={{ opacity: 0.8 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
              />
            </Link>

            <p className="font-bold text-lg tracking-tight mb-1" style={{ color: C.text }}>
              Safarly —{" "}
              <span className="font-normal" style={{ color: C.muted }}>Travel Companion</span>
            </p>

            <p className="text-sm max-w-sm mb-6" style={{ color: C.muted }}>
              {t("footer.tagline")}
            </p>

            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
              style={{
                borderRadius: "10px",
                backgroundColor: C.surface,
                border: `1px solid ${C.border}`,
                color: C.muted,
              }}
            >
              <span>🇸🇦</span>
              {t("footer.built")}
            </div>
          </div>

          {/* Plan links */}
          <div>
            <h4 className="font-semibold text-sm mb-4" style={{ color: C.text }}>
              {t("nav.plan")}
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/onboarding", label: "Onboarding" },
                { href: "/generating", label: "Trip Crafting" },
                { href: "/itinerary",  label: "Your Itinerary" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors duration-200"
                    style={{ color: C.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Feature links */}
          <div>
            <h4 className="font-semibold text-sm mb-4" style={{ color: C.text }}>
              Features
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/lens",      label: t("nav.lens") },
                { href: "/dialect",   label: t("nav.dialect") },
                { href: "/dashboard", label: t("nav.dashboard") },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors duration-200"
                    style={{ color: C.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <p className="text-xs" style={{ color: C.muted }}>{t("footer.rights")}</p>
          <div className="flex gap-4">
            {["Privacy", "Terms"].map((label) => (
              <span
                key={label}
                className="text-xs cursor-pointer transition-colors duration-200"
                style={{ color: C.muted }}
                onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
