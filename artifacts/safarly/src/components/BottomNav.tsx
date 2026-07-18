import { Link, useLocation } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { Home, Map as MapIcon, Camera, Mic } from "lucide-react";
import clsx from "clsx";

export function BottomNav() {
  const { t } = useTranslation();
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/itinerary", label: "Plan", icon: MapIcon },
    { href: "/lens", label: "Lens", icon: Camera },
    { href: "/dialect", label: "Dialect", icon: Mic },
  ];

  return (
    <div className="md:hidden fixed bottom-0 start-0 end-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {links.map((link) => {
          const isActive = location === link.href || (link.href === "/itinerary" && location === "/trip");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full gap-1 outline-none transition-colors",
                isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <link.icon className={clsx("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
              <span className="text-[10px] font-medium leading-none">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
