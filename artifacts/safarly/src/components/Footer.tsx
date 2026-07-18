import safarlyLogo from "@assets/safarly-transparent_1784408718766.png";
import { useTranslation } from "@/providers/I18nProvider";
import { Link } from "wouter";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-background pt-16 pb-24 md:pb-16 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 group outline-none inline-flex mb-4">
              <img
                src={safarlyLogo}
                alt="Safarly"
                className="h-8 w-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-300"
              />
            </Link>
            {/* Brand name + tagline */}
            <p className="font-bold text-lg text-foreground tracking-tight mb-1">
              Safarly —{" "}
              <span className="font-normal text-muted-foreground">Travel Companion</span>
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {t("footer.tagline")}
            </p>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted border border-border text-xs font-medium text-muted-foreground"
              style={{ borderRadius: "10px" }}
            >
              <span>🇸🇦</span>
              {t("footer.built")}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">{t("nav.plan")}</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Onboarding
                </Link>
              </li>
              <li>
                <Link href="/generating" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Trip Crafting
                </Link>
              </li>
              <li>
                <Link href="/itinerary" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Your Itinerary
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Features</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/lens" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("nav.lens")}
                </Link>
              </li>
              <li>
                <Link href="/dialect" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("nav.dialect")}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("nav.dashboard")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{t("footer.rights")}</p>
          <div className="flex gap-4">
            <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Privacy
            </span>
            <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Terms
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
