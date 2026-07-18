import { useLocation } from "wouter";
import { Link } from "wouter";
import { useTranslation } from "@/providers/I18nProvider";
import { useTheme } from "@/providers/ThemeProvider";
import safarlyLogo from "@assets/safarly-transparent_1784408718766.png";
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
        <Link href="/" className="flex items-center gap-2.5 group outline-none shrink-0">
          <img
            src={safarlyLogo}
            alt="Safarly"
            style={{ height: "38px", width: "auto", objectFit: "contain" }}
          />
          <span
            className="font-bold text-xl tracking-tight"
            style={{
              background: "linear-gradient(90deg, #00D8A4, #5C6CFF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Safarly
          </span>
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
                  "text-sm font-medium transition-colors duration-200 outline-none whitespace-nowrap",
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
            className="p-2 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#00D8A4]"
            style={{ color: "#8A93A6" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#EDEFF3";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1A2233";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#8A93A6";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleLanguage}
            className="text-sm font-semibold tracking-wide transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#00D8A4] px-3 py-1.5"
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
          >
            {language === "en" ? "العربية" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
