import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useCapabilities } from "@/lib/capabilities";
import { CalendarDays, ClipboardList, BarChart3, Home } from "lucide-react";
import { useLocale } from "@/lib/i18n";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
};

function useModuleNavItems() {
  const caps = useCapabilities();
  const isPlayer = caps.canUsePlayerUX;
  const { t } = useLocale();
  return useMemo<NavItem[]>(() => {
    const home = { key: "home", label: t("ucore_nav_home"), href: "/home", icon: <Home className="w-4 h-4" /> };
    const scout = { key: "scout", label: t("ucore_nav_scout"), href: "/scout", icon: <ClipboardList className="w-4 h-4" /> };
    const schedule = { key: "schedule", label: t("ucore_nav_schedule"), href: "/schedule", icon: <CalendarDays className="w-4 h-4" /> };
    const stats = { key: "stats", label: t("ucore_nav_stats"), href: "/stats", icon: <BarChart3 className="w-4 h-4" /> };
    return isPlayer ? [home, schedule, scout, stats] : [home, scout, schedule, stats];
  }, [isPlayer, t]);
}

export function ModuleNav() {
  const [loc, setLocation] = useLocation();
  const items = useModuleNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[90] max-w-md mx-auto border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active = loc === it.href || loc.startsWith(`${it.href}/`);
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => setLocation(it.href)}
              className={cn(
                "h-14 flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
              data-testid={`ucore-nav-${it.key}`}
            >
              <span
                className={cn(
                  "h-8 w-10 rounded-xl flex items-center justify-center border transition-colors",
                  active ? "border-primary/40 bg-primary/10" : "border-transparent bg-transparent",
                )}
              >
                {it.icon}
              </span>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

