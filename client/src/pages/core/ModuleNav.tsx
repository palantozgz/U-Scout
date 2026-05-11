import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Home, Target, CalendarDays, BarChart3, BookOpen } from "lucide-react";
import { useLocale } from "@/lib/i18n";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
};

function useModuleNavItems() {
  const { t } = useLocale();

  return useMemo<NavItem[]>(() => {
    const home     = { key: "home",     label: t("ucore_nav_home"),     href: "/home",       icon: <Home         className="w-5 h-5" /> };
    const schedule = { key: "schedule", label: t("ucore_nav_schedule"), href: "/schedule",   icon: <CalendarDays className="w-5 h-5" /> };
    const scout    = { key: "scout",    label: t("ucore_nav_scout"),    href: "/scout",      icon: <Target       className="w-5 h-5" /> };
    const stats    = { key: "stats",    label: t("ucore_nav_stats"),    href: "/stats",     icon: <BarChart3 className="w-5 h-5" /> };
    const playbook = { key: "playbook", label: "Playbook",              href: "/playbook",  icon: <BookOpen  className="w-5 h-5" /> };

    // All users: same 5-item nav
    return [home, schedule, scout, stats, playbook];
  }, [t]);
}

export function ModuleNav() {
  const [loc, setLocation] = useLocation();
  const items = useModuleNavItems();
  const isFive = items.length === 5;

  const navItems = items.map((it) => {
    const active =
      it.key === "home"
        ? loc === "/home" || loc === "/"
        : loc === it.href || loc.startsWith(`${it.href}/`);
    return { ...it, active };
  });

  return (
    <>
      {/* ── Mobile: bottom bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[90] bg-card"
        style={{ borderTop: "1px solid hsl(var(--border) / 0.6)" }}
      >
        {/* paddingBottom cubre el home indicator físico del iPhone */}
        <div
          className={cn("grid", isFive ? "grid-cols-5" : "grid-cols-4")}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {navItems.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => setLocation(it.href)}
              className={cn(
                "h-14 landscape:h-11 flex flex-col items-center justify-center gap-0.5 transition-colors relative select-none",
                it.active ? "text-primary" : "text-muted-foreground hover:text-foreground/70",
              )}
              aria-current={it.active ? "page" : undefined}
              data-testid={`ucore-nav-${it.key}`}
            >
              <span className="flex items-center justify-center w-6 h-6">
                {it.icon}
              </span>
              <span className={cn(
                "landscape:hidden leading-none",
                isFive ? "text-[9px] font-semibold tracking-tight" : "text-[10px] font-semibold tracking-wide",
              )}>
                {it.label}
              </span>
              {it.active && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary landscape:hidden" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Desktop md+: sidebar vertical izquierda ────────────────── */}
      <nav
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-[90] w-16 lg:w-56 flex-col bg-card/95 backdrop-blur-md pt-6 pb-6 gap-0.5"
        style={{ borderRight: "1px solid hsl(var(--border) / 0.6)" }}
      >
        {/* Brand */}
        <div
          className="flex items-center justify-center lg:justify-start lg:px-5 pb-3 mb-2"
          style={{ borderBottom: "1px solid hsl(var(--border) / 0.3)" }}
        >
          <span className="hidden lg:block text-sm font-black tracking-[3px] uppercase text-primary">U·CORE</span>
          <span className="lg:hidden text-sm font-black text-primary">U</span>
        </div>

        {navItems.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setLocation(it.href)}
            className={cn(
              "mx-1.5 lg:mx-2 min-h-11 rounded-lg flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-3 py-2.5 transition-colors relative select-none",
              it.active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            aria-current={it.active ? "page" : undefined}
            data-testid={`ucore-nav-${it.key}`}
          >
            {it.active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
            )}
            <span className="flex items-center justify-center w-5 h-5 shrink-0">{it.icon}</span>
            <span className="hidden lg:block text-sm font-semibold leading-none truncate">{it.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
