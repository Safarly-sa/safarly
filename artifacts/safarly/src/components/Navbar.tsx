import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { useTheme } from "@/providers/ThemeProvider";
import { getAuth, signOut } from "@/lib/auth";
import { SignOutDialog } from "@/components/SignOutDialog";
import safarlyLogo from "@assets/safarly-logo-new.png";
import { Sun, Moon, UserCircle, LogIn, LogOut, Menu, X } from "lucide-react";
import { LanguagePicker } from "@/components/LanguagePicker";
import clsx from "clsx";

export function Navbar() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();

  /* Auth-aware — re-reads whenever safarly-auth-changed fires */
  const [authed, setAuthed] = useState(() => !!getAuth());
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  useEffect(() => {
    function sync() { setAuthed(!!getAuth()); }
    window.addEventListener("safarly-auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("safarly-auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Mobile menu. The desktop link row is `hidden md:flex`, and the bottom bar
     only carries four tabs — without this, Stories, Dashboard, Companion and
     2030 Vision had no navigation route at all on a phone. */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Route changes close it, so tapping a link doesn't leave the panel hanging
     open over the page it just navigated to. */
  useEffect(() => { setMenuOpen(false); }, [location]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /* Two agents, not a feature list. Live Lens and Dialect moved under the
     Companion hub — they keep their own routes, and stay one tap away in the
     mobile bottom nav, which is where someone standing in front of a menu
     actually reaches for them. */
  const navLinks = [
    { href: "/",            label: t("nav.plan")       },
    { href: "/planner",     label: t("nav.planner")    },
    { href: "/companion",   label: t("nav.companion")  },
    { href: "/stories",     label: t("nav.stories")    },
    { href: "/dashboard",   label: t("nav.dashboard")  },
    { href: "/vision-2030", label: t("nav.vision2030") },
  ];

  const controlBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "10px", border: "1px solid #232C3D",
    padding: "6px 10px", color: "#8A93A6",
    background: "transparent", cursor: "pointer",
    transition: "color .2s, border-color .2s, background .2s",
    fontSize: "0.875rem", fontWeight: 600,
    gap: "6px",
  };

  return (
    <header
      className="fixed top-0 start-0 end-0 z-50 backdrop-blur-xl"
      style={{ height: "68px", backgroundColor: "rgba(10, 14, 22, 0.92)", borderBottom: "1px solid #232C3D" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-full flex items-center justify-between">

        {/* Brand */}
        <Link href="/" className="site-logo flex items-center shrink-0 group" aria-label="Safarly — Home">
          <img src={safarlyLogo} alt="Safarly" />
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
                  isActive ? "border-b-2 pb-px" : "hover:text-white"
                )}
                style={isActive ? { color: "#5C6CFF", borderColor: "#5C6CFF" } : { color: "#8A93A6" }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors duration-200"
            style={{ color: "#8A93A6" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#EDEFF3"; e.currentTarget.style.backgroundColor = "#1A2233"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8A93A6"; e.currentTarget.style.backgroundColor = "transparent"; }}
            aria-label={t("nav.toggle_theme")}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Language — desktop only. On phones it lives in the footer as
              a compact circular control, so the header keeps room for the
              menu button. */}
          <LanguagePicker className="hidden md:block" />

          {/* Auth buttons. Sign out is a separate control rather than a menu
              item so it is reachable in one click from any page; it is kept
              visually subordinate (muted until hover) because it is
              destructive. It always confirms before clearing data. */}
          {authed ? (
            <>
              <Link
                href="/profile"
                style={{ ...controlBtn, textDecoration: "none" }}
                aria-label="My profile"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEFF3"; (e.currentTarget as HTMLElement).style.borderColor = "#5C6CFF"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8A93A6"; (e.currentTarget as HTMLElement).style.borderColor = "#232C3D"; }}
              >
                <UserCircle size={18} aria-hidden />
                <span className="hidden sm:inline">Profile</span>
              </Link>
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                style={{ ...controlBtn }}
                aria-label={t("profile.signout.button")}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "#DC2626"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8A93A6"; e.currentTarget.style.borderColor = "#232C3D"; }}
              >
                <LogOut size={16} aria-hidden />
                <span className="hidden md:inline">{t("profile.signout.button")}</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              style={{ ...controlBtn, textDecoration: "none" }}
              aria-label="Sign in"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEFF3"; (e.currentTarget as HTMLElement).style.borderColor = "#5C6CFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8A93A6"; (e.currentTarget as HTMLElement).style.borderColor = "#232C3D"; }}
            >
              <LogIn size={16} aria-hidden />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Mobile menu — the only route to Stories, Dashboard, Companion and
              2030 Vision on a phone, since the bottom bar holds just four tabs. */}
          <div ref={menuRef} className="md:hidden" style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              style={{ ...controlBtn, padding: "6px 8px" }}
              aria-label={t("nav.menu")}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              onMouseEnter={(e) => { e.currentTarget.style.color = "#EDEFF3"; e.currentTarget.style.borderColor = "#5C6CFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#8A93A6"; e.currentTarget.style.borderColor = "#232C3D"; }}
            >
              {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            </button>

            {menuOpen && (
              <div
                id="mobile-nav-menu"
                style={{
                  /* Pinned to the viewport, not the button. Anchoring to the
                     button put the panel's edge ~150px from the screen edge,
                     so a 208px menu ran off-screen and clipped every label.
                     Fixed + insetInline can't overflow whatever the button's
                     position or the writing direction. */
                  position: "fixed",
                  top: 76, // header is 68px + 8px gap
                  insetInline: 12,
                  zIndex: 200,
                  background: "#111827",
                  border: "1px solid #232C3D",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                }}
              >
                {navLinks.map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        /* 44px min target — this is a phone-only control. */
                        minHeight: 44,
                        padding: "11px 16px",
                        background: isActive ? "#1A2233" : "transparent",
                        color: isActive ? "#EDEFF3" : "#8A93A6",
                        fontSize: "0.9375rem",
                        fontWeight: isActive ? 700 : 500,
                        textDecoration: "none",
                        transition: "background .12s, color .12s",
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          style={{ width: 3, height: 16, borderRadius: 2, background: "#5C6CFF", marginInlineStart: -6 }}
                        />
                      )}
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {confirmSignOut && (
        <SignOutDialog
          t={t}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            signOut();
            setConfirmSignOut(false);
            navigate("/");
          }}
        />
      )}
    </header>
  );
}
