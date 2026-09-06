import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  todayKey,
  useWellnessEntriesForDate,
  useWellnessEntriesRangeForUsers,
} from "@/lib/wellness";
import { useTodayWellnessSubmissionPct } from "@/lib/schedule";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/scheduleActivityConfig";
import type { ScheduleEvent } from "@/lib/schedule";
import type { ClubMemberDto } from "@/lib/club-api";
import type { I18nKey } from "@/lib/i18n";
import { WellnessTrendChart } from "@/components/schedule/WellnessTrendChart";

type Translate = (key: I18nKey) => string;

function KpiCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">{props.title}</p>
      <p className="mt-2 text-xl font-black tracking-tight text-foreground">{props.value}</p>
      {props.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{props.subtitle}</p> : null}
    </div>
  );
}

export type WellnessStaffTabProps = {
  clubId: string | undefined;
  rosterPlayers: ClubMemberDto[];
  weekEvents: ScheduleEvent[];
  t: Translate;
};

export function WellnessStaffTab(props: WellnessStaffTabProps) {
  const { clubId, rosterPlayers, weekEvents, t } = props;
  const rosterPlayerUserIds = useMemo(() => rosterPlayers.map((m) => m.userId), [rosterPlayers]);
  const entryDate = todayKey();

  const wellnessPctQ = useTodayWellnessSubmissionPct({ clubId, playerUserIds: rosterPlayerUserIds });
  const staffTodayEntriesQ = useWellnessEntriesForDate({ clubId, entryDate, userIds: rosterPlayerUserIds });
  const staffRange30Q = useWellnessEntriesRangeForUsers({
    clubId,
    userIds: rosterPlayerUserIds,
    fromDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    })(),
    toDate: entryDate,
  });

  const rosterLabelByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of rosterPlayers) {
      map[m.userId] = (m.authFullName ?? m.displayName ?? m.authEmail ?? m.userId) as string;
    }
    return map;
  }, [rosterPlayers]);

  const staffWellnessSummary = useMemo(() => {
    const entries = staffTodayEntriesQ.data ?? [];
    const byUser: Record<string, (typeof entries)[number]> = {};
    for (const e of entries) byUser[e.user_id] = e;
    const total = rosterPlayerUserIds.length;
    const submitted = entries.length;
    const missing = Math.max(0, total - submitted);
    const lowReadinessUserIds = new Set(entries.filter((e) => e.mental_readiness <= 2).map((e) => e.user_id));
    const highSorenessUserIds = new Set(entries.filter((e) => e.muscle_soreness <= 2).map((e) => e.user_id));
    const belowNormalUserIds = new Set<string>([...Array.from(lowReadinessUserIds), ...Array.from(highSorenessUserIds)]);

    const priority = rosterPlayerUserIds
      .map((uid) => {
        const e = byUser[uid];
        const missingSubmission = !e;
        const lowReadiness = Boolean(e && e.mental_readiness <= 2);
        const highSoreness = Boolean(e && e.muscle_soreness <= 2);
        const lowSleep = Boolean(e && e.sleep_quality <= 2);
        const score = missingSubmission ? 100 : (lowReadiness ? 40 : e!.mental_readiness === 3 ? 15 : 0) + (highSoreness ? 25 : 0) + (lowSleep ? 20 : 0);
        return {
          userId: uid,
          score,
          missingSubmission,
          lowReadiness,
          highSoreness,
          lowSleep,
          entry: e ?? null,
        };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      total,
      submitted,
      missing,
      lowReadinessCount: lowReadinessUserIds.size,
      highSorenessCount: highSorenessUserIds.size,
      belowNormalCount: belowNormalUserIds.size,
      priority,
    };
  }, [rosterPlayerUserIds, staffTodayEntriesQ.data]);

  const staffTrend = useMemo(() => {
    const entries = staffRange30Q.data ?? [];
    const dayKeys = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    });

    const byDay = new Map<string, typeof entries>();
    for (const k of dayKeys) byDay.set(k, []);
    for (const e of entries) {
      if (!byDay.has(e.entry_date)) continue;
      byDay.get(e.entry_date)!.push(e);
    }

    const totalRoster = rosterPlayerUserIds.length || 0;
    const avgNum = (
      list: typeof entries,
      field: "sleep_quality" | "energy_level" | "muscle_soreness" | "mental_readiness",
    ) => {
      if (list.length === 0) return null;
      return list.reduce((acc, e) => acc + e[field], 0) / list.length;
    };

    const points = dayKeys.map((k) => {
      const list = byDay.get(k) ?? [];
      const submitted = list.length;
      const submissionPct = totalRoster > 0 ? Math.round((submitted / totalRoster) * 100) : 0;
      return {
        day: k,
        submissionPct,
        avgSleep: avgNum(list, "sleep_quality"),
        avgEnergy: avgNum(list, "energy_level"),
        avgReadiness: avgNum(list, "mental_readiness"),
        avgSoreness: avgNum(list, "muscle_soreness"),
        submitted,
      };
    });

    return { points };
  }, [rosterPlayerUserIds.length, rosterPlayerUserIds, staffRange30Q.data]);

  const [staffRiskSort, setStaffRiskSort] = useState<"score" | "missing" | "readiness" | "soreness" | "sleep">("score");
  const [staffTrendRange, setStaffTrendRange] = useState<"7d" | "30d">("7d");

  const staffTeamAvgToday = useMemo(() => {
    const entries = staffTodayEntriesQ.data ?? [];
    if (entries.length === 0) return null;
    const avg = (field: "sleep_quality" | "energy_level" | "muscle_soreness" | "mental_readiness") =>
      entries.reduce((acc, e) => acc + e[field], 0) / entries.length;
    return {
      sleep: avg("sleep_quality"),
      energy: avg("energy_level"),
      soreness: avg("muscle_soreness"),
      readiness: avg("mental_readiness"),
      n: entries.length,
    };
  }, [staffTodayEntriesQ.data]);

  const staffRiskRows = useMemo(() => {
    const entries = staffTodayEntriesQ.data ?? [];
    const byUser: Record<string, (typeof entries)[number]> = {};
    for (const e of entries) byUser[e.user_id] = e;
    return rosterPlayerUserIds.map((uid) => {
      const e = byUser[uid];
      const missingSubmission = !e;
      const lowReadiness = Boolean(e && e.mental_readiness <= 2);
      const highSoreness = Boolean(e && e.muscle_soreness <= 2);
      const lowSleep = Boolean(e && e.sleep_quality <= 2);
      const score = missingSubmission
        ? 100
        : (lowReadiness ? 40 : e!.mental_readiness === 3 ? 15 : 0) + (highSoreness ? 25 : 0) + (lowSleep ? 20 : 0);
      return {
        userId: uid,
        name: rosterLabelByUserId[uid] ?? uid,
        score,
        missingSubmission,
        lowReadiness,
        highSoreness,
        lowSleep,
        entry: e ?? null,
      };
    });
  }, [rosterLabelByUserId, rosterPlayerUserIds, staffTodayEntriesQ.data]);

  const staffRiskRowsSorted = useMemo(() => {
    const rows = [...staffRiskRows];
    const v = (r: (typeof rows)[number], field: "sleep_quality" | "energy_level" | "muscle_soreness" | "mental_readiness") =>
      r.entry ? r.entry[field] : null;
    rows.sort((a, b) => {
      if (staffRiskSort === "missing") return Number(b.missingSubmission) - Number(a.missingSubmission) || b.score - a.score;
      if (staffRiskSort === "sleep") return (v(a, "sleep_quality") ?? 999) - (v(b, "sleep_quality") ?? 999) || b.score - a.score;
      if (staffRiskSort === "readiness") return (v(a, "mental_readiness") ?? 999) - (v(b, "mental_readiness") ?? 999) || b.score - a.score;
      if (staffRiskSort === "soreness") return (v(a, "muscle_soreness") ?? 999) - (v(b, "muscle_soreness") ?? 999) || b.score - a.score;
      return b.score - a.score;
    });
    return rows;
  }, [staffRiskRows, staffRiskSort]);

  // weekEvents used in correlations below (replaces weekEventsQ.data)
  const weekEventsQ = { data: weekEvents };

  return (
<div className="mt-4 space-y-3">
  {(() => {
    const top = staffRiskRowsSorted.find((p) => p.score > 0) ?? null;
    const missing = staffWellnessSummary.missing;
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
          {t("wellness_staff_today" as any)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("wellness_staff_missing_today_label" as any)}
            </p>
            <p className="mt-1 text-lg font-black text-foreground">{missing}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("wellness_staff_top_risk_label" as any)}
            </p>
            <p className="mt-1 text-sm font-extrabold text-foreground truncate">
              {top ? top.name : t("wellness_staff_top_risk_none" as any)}
            </p>
            {top ? (
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {t("wellness_staff_priority_score" as any).replace("{score}", String(top.score))}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  })()}

  <div className="rounded-2xl border border-border bg-background/40 p-3">
    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
      {t("wellness_staff_alerts_title" as any)}
    </p>
    <div className="mt-2 space-y-1.5">
      {staffWellnessSummary.belowNormalCount >= 3 ? (
        <p className="text-sm font-semibold text-foreground">{t("wellness_staff_alert_below_normal" as any)}</p>
      ) : null}
      {staffWellnessSummary.missing > 0 ? (
        <p className="text-sm font-semibold text-foreground">{t("wellness_staff_alert_missing" as any)}</p>
      ) : null}
      {staffWellnessSummary.belowNormalCount < 3 && staffWellnessSummary.missing === 0 ? (
        <p className="text-sm font-semibold text-muted-foreground">{t("wellness_staff_alert_all_clear" as any)}</p>
      ) : null}
    </div>
  </div>

  <div className="rounded-2xl border border-border bg-card p-4">
    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
      {t("wellness_schedule_correlations" as any)}
    </p>
    <div className="mt-2 space-y-1.5">
      {(() => {
        const sessions = weekEventsQ.data ?? [];
        const now = Date.now();
        const recentWindowMs = 3 * 86400000;
        const recent = sessions.filter((s) => Math.abs(new Date(s.starts_at).getTime() - now) <= recentWindowMs);
        const hasMatch = recent.some((s) => s.session_type === "match");
        const hasTravel = recent.some((s) => s.session_type === "travel");
        const loadScore = sessions
          .filter((s) => {
            const ts = new Date(s.starts_at).getTime();
            return ts <= now && ts >= now - 7 * 86400000;
          })
          .reduce((acc, s) => {
            const w = ACTIVITY_TYPE_CONFIG[s.session_type]?.loadWeight ?? "low";
            return acc + (w === "high" ? 3 : w === "medium" ? 2 : 1);
          }, 0);
        const heavyWeek = loadScore >= 10;
        const entries = staffTodayEntriesQ.data ?? [];
        const highSoreness = entries.some((e) => e.muscle_soreness <= 2);
        const lowSleep = entries.some((e) => e.sleep_quality <= 2);
        const lowReadiness = entries.some((e) => e.mental_readiness <= 2);
        const lines: string[] = [];
        if (hasMatch && highSoreness) lines.push(t("wellness_corr_match_soreness_watch" as any));
        if (hasTravel && lowSleep) lines.push(t("wellness_corr_travel_sleep_watch" as any));
        if (heavyWeek && lowReadiness) lines.push(t("wellness_corr_heavy_week_readiness_watch" as any));
        if (lines.length === 0) lines.push(t("wellness_corr_none" as any));
        return lines.map((txt) => (
          <p key={txt} className="text-sm font-semibold text-muted-foreground">
            {txt}
          </p>
        ));
      })()}
    </div>
  </div>

  <div className="grid grid-cols-2 gap-2">
    <KpiCard
      title={t("wellness_staff_card_submitted_pct" as any)}
      value={wellnessPctQ.isLoading ? t("schedule_placeholder_kpi") : `${wellnessPctQ.data?.pct ?? 0}%`}
      subtitle={
        wellnessPctQ.data
          ? t("wellness_staff_card_submitted_subtitle" as any)
              .replace("{submitted}", String(wellnessPctQ.data.submitted))
              .replace("{total}", String(wellnessPctQ.data.total))
          : undefined
      }
    />
    <KpiCard
      title={t("wellness_staff_card_missing_today" as any)}
      value={staffTodayEntriesQ.isLoading ? t("schedule_placeholder_kpi") : String(staffWellnessSummary.missing)}
    />
    <KpiCard
      title={t("wellness_staff_card_low_readiness" as any)}
      value={staffTodayEntriesQ.isLoading ? t("schedule_placeholder_kpi") : String(staffWellnessSummary.lowReadinessCount)}
      subtitle={t("wellness_staff_threshold_low_readiness" as any)}
    />
    <KpiCard
      title={t("wellness_staff_card_high_soreness" as any)}
      value={staffTodayEntriesQ.isLoading ? t("schedule_placeholder_kpi") : String(staffWellnessSummary.highSorenessCount)}
      subtitle={t("wellness_staff_threshold_high_soreness" as any)}
    />
  </div>

  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
        {t("wellness_staff_team_trends" as any)}
      </p>
      <ToggleGroup
        type="single"
        value={staffTrendRange}
        onValueChange={(v) => setStaffTrendRange((v as any) || "7d")}
        className="justify-end"
      >
        <ToggleGroupItem value="7d" size="sm" variant="outline" className="h-9 px-2.5">
          7d
        </ToggleGroupItem>
        <ToggleGroupItem value="30d" size="sm" variant="outline" className="h-9 px-2.5">
          30d
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <div className="mt-3">
      {staffRange30Q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("wellness_loading_today")}</p>
      ) : (
        (() => {
          const points = staffTrend.points;
          const slice = staffTrendRange === "7d" ? points.slice(-7) : points;
          const series = (metric: "avgSleep" | "avgEnergy" | "avgSoreness" | "avgReadiness") =>
            slice.map((p) => ({ date: p.day, value: (p as any)[metric] as number | null }));
          return (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">{t("wellness_metric_sleep" as any)}</p>
                <div className="mt-1">
                  <WellnessTrendChart points={series("avgSleep")} goodUp color="#3b82f6" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{t("wellness_metric_energy" as any)}</p>
                <div className="mt-1">
                  <WellnessTrendChart points={series("avgEnergy")} goodUp color="#f59e0b" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{t("wellness_metric_soreness" as any)}</p>
                <div className="mt-1">
                  <WellnessTrendChart points={series("avgSoreness")} goodUp color="#A78BFA" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{t("wellness_metric_readiness" as any)}</p>
                <div className="mt-1">
                  <WellnessTrendChart points={series("avgReadiness")} goodUp color="#10b981" />
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  </div>

  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
        {t("wellness_staff_priority_title" as any)}
      </p>
      <select
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        value={staffRiskSort}
        onChange={(e) => setStaffRiskSort(e.target.value as any)}
      >
        <option value="score">{t("wellness_sort_highest_risk" as any)}</option>
        <option value="sleep">{t("wellness_sort_lowest_sleep" as any)}</option>
        <option value="soreness">{t("wellness_sort_highest_soreness" as any)}</option>
        <option value="readiness">{t("wellness_sort_lowest_readiness" as any)}</option>
        <option value="missing">{t("wellness_sort_missing_today" as any)}</option>
      </select>
    </div>
    <div className="mt-3 space-y-2">
      {staffTodayEntriesQ.isLoading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">{t("wellness_loading_today")}</p>
        </div>
      ) : staffRiskRowsSorted.filter((p) => p.score > 0).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">{t("wellness_staff_priority_empty" as any)}</p>
        </div>
      ) : (
        staffRiskRowsSorted
          .filter((p) => p.score > 0)
          .slice(0, 5)
          .map((p) => {
          const reasons: string[] = [];
          if (p.missingSubmission) reasons.push(t("wellness_reason_missing" as any));
          if (p.lowReadiness) reasons.push(t("wellness_reason_low_readiness" as any));
          if (p.highSoreness) reasons.push(t("wellness_reason_high_soreness" as any));
          if (p.lowSleep) reasons.push(t("wellness_reason_low_sleep" as any));
          const team = staffTeamAvgToday;
          const chips: string[] = [];
          if (team && p.entry) {
            const rd = p.entry.mental_readiness - team.readiness;
            const sr = p.entry.muscle_soreness - team.soreness;
            if (p.lowReadiness) chips.push(t("wellness_vs_team" as any).replace("{metric}", t("wellness_metric_readiness" as any)).replace("{delta}", `${rd >= 0 ? "+" : ""}${(Math.round(rd * 10) / 10).toFixed(1)}`));
            if (p.highSoreness) chips.push(t("wellness_vs_team" as any).replace("{metric}", t("wellness_metric_soreness" as any)).replace("{delta}", `${sr >= 0 ? "+" : ""}${(Math.round(sr * 10) / 10).toFixed(1)}`));
            if (p.lowSleep) {
              const sl = p.entry.sleep_quality - team.sleep;
              chips.push(t("wellness_vs_team" as any).replace("{metric}", t("wellness_metric_sleep" as any)).replace("{delta}", `${sl >= 0 ? "+" : ""}${(Math.round(sl * 10) / 10).toFixed(1)}`));
            }
          }
          return (
            <div key={p.userId} className="rounded-xl border border-border bg-background/40 px-3 py-3 min-h-[56px]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-foreground truncate">{p.name}</p>
                <p className="text-xs font-bold text-muted-foreground">{t("wellness_staff_priority_score" as any).replace("{score}", String(p.score))}</p>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {reasons.slice(0, 4).map((r) => (
                  <span
                    key={r}
                    className={[
                      "px-2 py-0.5 rounded-full border text-xs font-black tracking-wide",
                      r === t("wellness_reason_missing" as any)
                        ? "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-200"
                        : r === t("wellness_reason_high_soreness" as any) || r === t("wellness_reason_low_readiness" as any)
                          ? "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                          : "border-border bg-muted/25 text-muted-foreground",
                    ].join(" ")}
                  >
                    {r}
                  </span>
                ))}
                {chips.slice(0, 2).map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-full border border-border bg-background/40 text-xs font-black tracking-wide text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
</div>

  );
}
