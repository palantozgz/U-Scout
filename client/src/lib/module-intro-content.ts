import type { Locale } from "@/lib/i18n";
import type { ModuleIntroKey } from "@/lib/onboarding-state";

export type ModuleIntroAudience = "staff" | "player";

interface ModuleIntroContent {
  emoji: string;
  title: string;
  body: string;
}

/**
 * Copy for the per-module first-open card (spec sección 44). Scout/Schedule/
 * Playbook differ by audience (coach vs player see different real screens);
 * Stats is the same screen for both, Club is staff-only (the module isn't
 * even reachable by players today, see server-side gating).
 *
 * Deliberately short — one card, not a slide deck (see ModuleIntroCard.tsx).
 * Stats/Playbook get the most substantial copy here on purpose: the *main*
 * onboarding tutorial (OnboardingFlow.tsx) never mentions either module at
 * all (its slides only cover Scout/Club/Reports/Settings for coaches, and
 * Reports/Wellness/Schedule for players) — this is genuinely new information
 * for those two, not a repeat.
 */
export function getModuleIntroContent(
  moduleKey: ModuleIntroKey,
  locale: Locale,
  audience: ModuleIntroAudience,
): ModuleIntroContent {
  const es = locale === "es";
  const zh = locale === "zh";

  switch (moduleKey) {
    case "scout":
      if (audience === "player") {
        return {
          emoji: "🎯",
          title: "Scout",
          body: zh
            ? "在这里查看已批准发布的对手球探报告，为你的下一场比赛做准备。"
            : es
              ? "Aquí ves los informes de scouting ya aprobados sobre tus próximas rivales."
              : "Here you'll find the approved scouting reports on your upcoming opponents.",
        };
      }
      return {
        emoji: "🎯",
        title: "Scout",
        body: zh
          ? "在这里制作球探报告：My Scout（个人草稿）→ Film Room（与教练组共同复核）→ Game Plan（正式发布）。"
          : es
            ? "Aquí construyes los informes de scouting: My Scout (tu ficha privada) → Film Room (revisión con el resto del staff) → Game Plan (ya publicado)."
            : "Here's where scouting reports get built: My Scout (your private draft) → Film Room (review with the rest of the staff) → Game Plan (published).",
      };

    case "schedule":
      if (audience === "player") {
        return {
          emoji: "📅",
          title: zh ? "日程" : es ? "Horario" : "Schedule",
          body: zh
            ? "查看即将到来的训练和比赛，并在这里完成每日健康打卡。"
            : es
              ? "Consulta tus próximas sesiones y rellena tu estado de bienestar cada día, aquí mismo."
              : "Check your upcoming sessions and fill in your daily wellness check-in right here.",
        };
      }
      return {
        emoji: "📅",
        title: zh ? "日程" : es ? "Horario" : "Schedule",
        body: zh
          ? "管理球队的训练/比赛安排，并查看球员每日健康打卡的完成情况。"
          : es
            ? "Gestiona las sesiones del equipo y consulta de un vistazo el estado de bienestar diario de las jugadoras."
            : "Manage the team's sessions and see each player's daily wellness check-in at a glance.",
      };

    case "stats":
      return {
        emoji: "📊",
        title: zh ? "统计" : "Stats",
        body: zh
          ? "联赛统计数据：球队档案、效率数据，以及球员对比雷达图。"
          : es
            ? "Estadísticas de la liga WCBA: fichas de equipo, datos de eficiencia y comparador de jugadoras."
            : "WCBA league stats: team sheets, efficiency numbers, and a player comparison tool.",
      };

    case "playbook":
      if (audience === "player") {
        return {
          emoji: "📘",
          title: "Playbook",
          body: zh
            ? "随时查看你球队的战术体系。"
            : es
              ? "Repasa el sistema táctico de tu equipo cuando quieras."
              : "Review your team's tactical system whenever you want.",
        };
      }
      return {
        emoji: "📘",
        title: "Playbook",
        body: zh
          ? "在这里设计你的防守体系，并与教练组和球员分享。"
          : es
            ? "Diseña tu sistema defensivo aquí y compártelo con el resto del staff y las jugadoras."
            : "Design your defensive system here and share it with the rest of the staff and the players.",
      };

    case "club":
      return {
        emoji: "🛡️",
        title: zh ? "我的俱乐部" : es ? "Mi Club" : "My Club",
        body: zh
          ? "管理你的俱乐部：教练组、权限、官方名册，以及报告校准面板。"
          : es
            ? "Gestiona tu club: staff, permisos, roster oficial y el panel de calibración de informes."
            : "Manage your club: staff, permissions, the official roster, and the report calibration panel.",
      };
  }
}
