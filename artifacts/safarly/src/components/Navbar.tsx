import { useLocation } from "wouter";
import { Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { useTheme } from "@/providers/ThemeProvider";
import safarlyLogo from "@assets/safarly-lockup-light_1784459757614.png";
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
    <header
      className="fixed top-0 start-0 end-0 z-50 backdrop-blur-xl"
      style={{
        height: "68px",
        backgroundColor: "rgba(10, 14, 22, 0.92)",
        borderBottom: "1px solid #232C3D",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center shrink-0 group" aria-label="Safarly — Home">
          <img
            src={safarlyLogo}
            alt="Safarly"
            style={{ height: "56px", width: "auto", objectFit: "contain" }}
          />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "text-sm font-medium transition-colors duration-200 whitespace-nowrap rounded-sm",
                  isActive
                    ? "border-b-2 pb-px"
                    : "hover:text-white"
                )}
                style={
                  isActive
                    ? { color: "#5C6CFF", borderColor: "#5C6CFF" }
                    : { color: "#8A93A6" }
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors duration-200"
            style={{ color: "#8A93A6" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#EDEFF3";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1A2233";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#8A93A6";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
            aria-label={t("nav.toggle_theme")}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleLanguage}
            className="text-sm font-semibold tracking-wide transition-colors duration-200 px-3 py-1.5"
            style={{
              color: "#8A93A6",
              borderRadius: "10px",
              border: "1px solid #232C3D",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#EDEFF3";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#5C6CFF";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#8A93A6";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#232C3D";
            }}
            aria-label={t("nav.toggle_lang")}
          >
            {language === "en" ? "العربية" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
