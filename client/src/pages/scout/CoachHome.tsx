import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
import { Users, Pencil, Users2, FileText, ChevronRight, ArrowRight } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { ModuleHeader } from "@/components/branding/ModuleHeader";
import { cn } from "@/lib/utils";

// ── Smart alert slot ──────────────────────────────────────────────────────────
function AlertSlot({
  icon,
  label,
  sub,
  tone,
  onClick,
}: {
  icon: string;
  label: string;
  sub?: string;
  tone: "neutral" | "amber" | "blue" | "emerald";
  onClick?: () => void;
}) {
  const toneClass = {
    neutral: "border-border bg-card",
    amber:   "border-amber-500/30 bg-amber-500/8",
    blue:    "border-blue-500/30 bg-blue-500/8",
    emerald: "border-emerald-500/30 bg-emerald-500/8",
  }[tone];
  const textClass = {
    neutral: "text-foreground",
    amber:   "text-amber-700 dark:text-amber-400",
    blue:    "text-blue-700 dark:text-blue-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.99] w-full",
        toneClass,
        onClick ? "cursor-pointer hover:brightness-95" : "cursor-default",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">{icon}</span>
        <div className="min-w-0">
          <p className={cn("text-[11px] font-black leading-snug tracking-tight line-clamp-2", textClass)}>
            {label}
          </p>
          {sub && (
            <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground line-clamp-1">
              {sub}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Nav card ─────────────────────────────────────────────────────────────────
function NavCard({
  icon,
  title,
  sub,
  onClick,
  badge,
  testId,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  badge?: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group w-full text-left rounded-lg border border-border bg-card p-4 flex items-stretch gap-4 transition-all duration-200 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)] active:scale-[0.995]"
    >
      <div className="flex items-center justify-center w-12 shrink-0 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2">
          <p className="text-base font-black text-foreground tracking-tight">{title}</p>
          {badge}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{sub}</p>
      </div>
      <div className="flex items-center pr-1 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-1">
        <ChevronRight className="w-5 h-5" />
      </div>
    </button>
  );
}

export default function CoachHome() {
  const { locale } = useLocale();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const caps = useCapabilities();

  const isHeadCoach = profile?.role === "head_coach" || profile?.role === "master";

  // ── Localised strings ──────────────────────────────────────────────────────
  const L = {
    en: {
      personnel:    "Personnel",
      personnelSub: "Official rival roster · canonical profiles",
      myscout:      "My Scout",
      myscoutSub:   "Your individual scouting reports",
      filmroom:     "Film Room",
      filmroomSub:  "Collective review · resolve discrepancies",
      gameplan:     "Game Plan",
      gameplanSub:  "Published to players",
      workflow:     "── WORKFLOW ──",
      alertNext:    "Next game",
      alertNoGame:  "No upcoming game",
      alertPending: "reports pending",
      alertConflicts: "conflicts",
      alertAllGood: "All reports up to date ✓",
      sandboxBanner: "⚗️ Sandbox — profiles created here won't appear in Film Room",
    },
    es: {
      personnel:    "Plantilla",
      personnelSub: "Roster rival oficial · fichas canónicas",
      myscout:      "Mi Scout",
      myscoutSub:   "Tus informes de scouting individuales",
      filmroom:     "Sala de análisis",
      filmroomSub:  "Revisión colectiva · resolver discrepancias",
      gameplan:     "Plan de juego",
      gameplanSub:  "Publicados a jugadoras",
      workflow:     "── FLUJO ──",
      alertNext:    "Próximo partido",
      alertNoGame:  "Sin partido próximo",
      alertPending: "informes pendientes",
      alertConflicts: "conflictos",
      alertAllGood: "Todos los informes al día ✓",
      sandboxBanner: "⚗️ Campo de pruebas — estas fichas no llegan a la Sala de análisis",
    },
    zh: {
      personnel:    "球员档案",
      personnelSub: "官方对手名单 · 标准档案",
      myscout:      "我的报告",
      myscoutSub:   "你的个人球探报告",
      filmroom:     "集体分析",
      filmroomSub:  "集体审核 · 解决分歧",
      gameplan:     "比赛方案",
      gameplanSub:  "已发布给球员",
      workflow:     "── 工作流程 ──",
      alertNext:    "下一场比赛",
      alertNoGame:  "暂无即将到来的比赛",
      alertPending: "份报告待完成",
      alertConflicts: "个冲突",
      alertAllGood: "所有报告已完成 ✓",
      sandboxBanner: "⚗️ 测试区域 — 此处创建的档案不会进入集体分析",
    },
  }[locale as "en" | "es" | "zh"] ?? {
    personnel:    "Personnel",
    personnelSub: "Official rival roster · canonical profiles",
    myscout:      "My Scout",
    myscoutSub:   "Your individual scouting reports",
    filmroom:     "Film Room",
    filmroomSub:  "Collective review · resolve discrepancies",
    gameplan:     "Game Plan",
    gameplanSub:  "Published to players",
    workflow:     "── WORKFLOW ──",
    alertNext:    "Next game",
    alertNoGame:  "No upcoming game",
    alertPending: "reports pending",
    alertConflicts: "conflicts",
    alertAllGood: "All reports up to date ✓",
    sandboxBanner: "⚗️ Sandbox — profiles created here won't appear in Film Room",
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground overflow-hidden pb-16">
      <main className="relative z-10 flex flex-col flex-1 px-4 pb-6 max-w-md mx-auto w-full gap-4">
        <ModuleHeader module="scout" tagline={
          locale === "zh" ? "个人防守侦察" :
          locale === "es" ? "Scouting defensivo individual" :
          "Individual defensive scouting"
        } />

        {/* ── ALERT SLOTS ── */}
        <div className="grid grid-cols-3 gap-2">
          <AlertSlot
            icon="📅"
            label={L.alertNoGame}
            tone="neutral"
            onClick={() => setLocation("/schedule")}
          />
          <AlertSlot
            icon="📋"
            label={L.alertAllGood}
            tone="emerald"
            onClick={() => setLocation("/coach/my-scout")}
          />
          <AlertSlot
            icon="✅"
            tone="emerald"
            label={L.alertAllGood}
            onClick={() => setLocation("/coach/film-room")}
          />
        </div>

        {/* ── PERSONNEL (separated) ── */}
        <NavCard
          icon={<Users className="w-8 h-8" strokeWidth={2} />}
          title={L.personnel}
          sub={isHeadCoach ? L.personnelSub : L.sandboxBanner}
          onClick={() => setLocation("/coach/personnel")}
          testId="coach-home-personnel"
        />

        {/* ── SEPARATOR ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[9px] font-black tracking-widest text-muted-foreground/40 uppercase shrink-0">
            {L.workflow}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── MY SCOUT ── */}
        {/* Flow indicator — encima del primer card del workflow */}
        <div className="flex items-center justify-center gap-1 text-[9px] font-black tracking-widest text-muted-foreground/35 uppercase -mb-1">
          <span>{locale === "zh" ? "我的报告" : locale === "es" ? "Mi Scout" : "My Scout"}</span>
          <ArrowRight className="w-3 h-3" />
          <span>{locale === "zh" ? "集体分析" : locale === "es" ? "Sala de análisis" : "Film Room"}</span>
          <ArrowRight className="w-3 h-3" />
          <span>{locale === "zh" ? "比赛方案" : locale === "es" ? "Plan de juego" : "Game Plan"}</span>
        </div>
        <NavCard
          icon={<Pencil className="w-8 h-8" strokeWidth={2} />}
          title={L.myscout}
          sub={L.myscoutSub}
          onClick={() => setLocation("/coach/my-scout")}
          testId="coach-home-my-scout"
        />

        {/* ── FILM ROOM ── */}
        <NavCard
          icon={<Users2 className="w-8 h-8" strokeWidth={2} />}
          title={L.filmroom}
          sub={L.filmroomSub}
          onClick={() => setLocation("/coach/film-room")}
          testId="coach-home-film-room"
        />

        {/* ── GAME PLAN ── */}
        <NavCard
          icon={<FileText className="w-8 h-8" strokeWidth={2} />}
          title={L.gameplan}
          sub={L.gameplanSub}
          onClick={() => setLocation("/coach/game-plan")}
          testId="coach-home-game-plan"
        />
      </main>
      <ModuleNav />
    </div>
  );
}
