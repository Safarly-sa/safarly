import { useLocation } from "wouter";
import { Link } from "wouter";
import { useTranslation } from "@/providers/I18nProvider";
import { useTheme } from "@/providers/ThemeProvider";
import safarlyLogo from "@assets/screen_1784406032258.png";
import { Sun, Moon } from "lucide-react";
import clsx from "clsx";

export function Navbar() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  const navLinks = [
    { href: "/", label: t("nav.plan") },
    { href: "/lens", label: t("nav.lens") },
    { href: "/dialect", label: t("nav.dialect") },
    { href: "/dashboard", label: t("nav.dashboard") },
  ];

  return (
    <header className="fixed top-0 start-0 end-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl h-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group outline-none">
          <img src={safarlyLogo} alt="Safarly" className="h-7 w-auto object-contain" />
          <span className="font-bold text-xl tracking-tight bg-clip-text text-primary dark:text-transparent dark:bg-gradient-to-r dark:from-[var(--sf-accent)] dark:to-[var(--sf-indigo)]">
            Safarly
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "text-sm font-medium transition-all duration-200 outline-none hover:text-indigo",
                  isActive
                    ? "text-indigo border-b-2 border-indigo pt-0.5"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button
            onClick={toggleLanguage}
            className="text-sm font-semibold tracking-wide text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent px-2 py-1 rounded"
          >
            {language === "en" ? "العربية" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
