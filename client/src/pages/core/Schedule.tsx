import { ModulePageShell } from "./ModulePage";
import { useLocale, type I18nKey } from "@/lib/i18n";
import { SkeletonSchedule } from "@/components/SkeletonLoaders";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { cn } from "@/lib/utils";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities, type ClubMembership } from "@/lib/capabilities";
import { useClub } from "@/lib/club-api";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  Clock,
  LayoutTemplate,
  Share2,
  X,
  CalendarDays,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { toPng } from "html-to-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { formatTimeHHMMFromParts } from "@/lib/timeHHMM";
import {
  todayKey,
  type WellnessEntry,
  useUpsertWellnessEntry,
  useWellnessEntriesLastNDays,
  useWellnessEntryToday,
} from "@/lib/wellness";
import {
  useCreateScheduleEvent,
  useDeleteScheduleEvent,
  useScheduleParticipantsForEvents,
  useScheduleParticipantsForUser,
  useScheduleEventsRange,
  useThisWeekScheduleEvents,
  useTodayScheduleEvents,
  useTodayWellnessSubmissionPct,
  useTomorrowScheduleEvents,
  useUpdateScheduleEvent,
  useUpsertScheduleParticipant,
  useScheduleData,
  startOfTomorrowLocal,
  CLUB_TIME_ZONE,
  clubMidnightUtc,
  useWeekTemplates,
  useCreateWeekTemplate,
  useUpdateWeekTemplate,
  useDeleteWeekTemplate,
  type WeekTemplate,
  type WeekTemplateSession,
  type ScheduleEvent,
} from "@/lib/schedule";
import {
  useSessionForm,
  readConstraintsFromNotes,
  type AttendanceMode,
  type SessionTemplate,
} from "@/lib/useSessionForm";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/scheduleActivityConfig";

function localDateKey(d: Date): string {
  // Siempre en la zona horaria del club (Asia/Shanghai), nunca la del
  // dispositivo -- para que coincida exactamente con las fronteras
  // "hoy/manana" de useScheduleData y con el dialogo de detalle de sesion.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    timer.current = setTimeout(onLongPress, ms);
  };
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return { onMouseDown: start, onTouchStart: start, onMouseUp: cancel, onTouchEnd: cancel, onMouseLeave: cancel };
}

const SessionCreateDialog = lazy(() =>
  import("@/components/SessionCreateDialog").then((m) => ({ default: m.SessionCreateDialog })),
);
const WellnessStaffTab = lazy(() =>
  import("@/components/schedule/WellnessStaffTab").then((m) => ({ default: m.WellnessStaffTab })),
);
const WellnessTrendChart = lazy(() =>
  import("@/components/schedule/WellnessTrendChart").then((m) => ({ default: m.WellnessTrendChart })),
);

export default function Schedule() {
  const { t, locale } = useLocale();
  const { profile } = useAuth();
  const clubQ = useClub();
  const clubId = clubQ.data?.club?.id;
  const userId = profile?.id;
  const membership: ClubMembership | null = useMemo(() => {
    if (!profile?.id || !clubQ.data?.club) return null;
    const me = (clubQ.data.members ?? []).find((m) => m.userId === profile.id);
    if (!me) return null;
    return {
      clubId: clubQ.data.club?.id,
      userId: profile.id,
      role: me.role as ClubMembership["role"],
      status: me.status as ClubMembership["status"],
      isOwner: clubQ.data.club?.ownerId === profile.id,
      operationsAccess: Boolean(me.operationsAccess),
    };
  }, [clubQ.data?.club, clubQ.data?.members, profile?.id]);

  const caps = useCapabilities({ membership });
  const isPlayer = caps.canUsePlayerUX;
  const isDesktop = useIsDesktop();
  const canCreateSession = caps.canCreateEvent;
  const canCreateEvent = caps.canCreateEvent;
  const canExportWeekImage =
    !isPlayer &&
    (caps.staffRole === "head_coach" ||
      (caps.staffRole === "coach" && Boolean(membership?.operationsAccess)));
  const rosterPlayers = useMemo(() => {
    const members = clubQ.data?.members ?? [];
    return members.filter((m) => m.role === "player" && m.status === "active");
  }, [clubQ.data?.members]);
  const rosterPlayerUserIds = useMemo(() => {
    return rosterPlayers.map((m) => m.userId);
  }, [rosterPlayers]);

  const {
    todayEventsQ,
    tomorrowEventsQ,
    weekEventsQ,
    isInitialLoad,
    createEventMut,
    updateEventMut,
    deleteEventMut,
    upsertParticipant,
    weekRestSessions,
    participantEventIds,
    myParticipantsQ,
    todayParticipantsQ,
    wellnessPctQ,
    nextSession,
  } = useScheduleData({ clubId, userId, isPlayer, rosterPlayerUserIds });

  const [activeTab, setActiveTab] = useState<"schedule" | "wellness">("schedule");
  const [staffView, setStaffView] = useState<"list" | "planner">("list");
  const [plannerScrollTick, setPlannerScrollTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [sessionDetailEvent, setSessionDetailEvent] = useState<ScheduleEvent | null>(null);
  const [desktopSelectedEvent, setDesktopSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionEvent, setEditingSessionEvent] = useState<ScheduleEvent | null>(null);
  const isEditing = Boolean(editingSessionId);
  const form = useSessionForm();
  const {
    createSessionType, setCreateSessionType,
    createTitle, setCreateTitle,
    createDate, setCreateDate,
    createStartMins, setCreateStartMins,
    createEndTime, setCreateEndTime,
    createLocation, setCreateLocation,
    createNotes, setCreateNotes,
    createAttendanceRequired, setCreateAttendanceRequired,
    useCustomDateTime, setUseCustomDateTime,
    durationMins, setDurationMins,
    repeatEnabled, setRepeatEnabled,
    repeatWeeks, setRepeatWeeks,
    repeatWeekdays, setRepeatWeekdays,
    targetAttendance, setTargetAttendance,
    maxCapacity, setMaxCapacity,
    groupName, setGroupName,
    attendanceMode, setAttendanceMode,
    attendanceModeTouched, setAttendanceModeTouched,
    groupsCount, setGroupsCount,
    groupCapacity, setGroupCapacity,
    groupSignupMode, setGroupSignupMode,
    coachGroupAssignments, setCoachGroupAssignments,
    signupDeadline, setSignupDeadline,
    signupMaxSpots, setSignupMaxSpots,
    selectedPlayerIds, setSelectedPlayerIds,
    customDurationOpen, setCustomDurationOpen,
    customDurationMins, setCustomDurationMins,
    groupAssignOpen, setGroupAssignOpen,
    choosePlayersOpen, setChoosePlayersOpen,
    trainingTags, setTrainingTags,
    subgroupCount, setSubgroupCount,
    subgroupMinutes, setSubgroupMinutes,
    applyDurationPreset,
  } = form;
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(() => new Set());

  const locationKey = useMemo(() => `uscout-schedule-locations:${clubId ?? "no-club"}`, [clubId]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  // location presets now contextual per session type in slot create
  const [cancelTarget, setCancelTarget] = useState<ScheduleEvent | null>(null);
  const [repeatWeekPlanOpen, setRepeatWeekPlanOpen] = useState(false);
  const [repeatWeekPlanWeeks, setRepeatWeekPlanWeeks] = useState<1 | 2 | 3 | 4 | 6 | 8>(4);
  const [repeatWeekPlanSelected, setRepeatWeekPlanSelected] = useState<Set<number>>(() => new Set([1, 2, 3, 4]));
  const [clearWeekOpen, setClearWeekOpen] = useState(false);
  const [weekTemplatesOpen, setWeekTemplatesOpen] = useState(false);
  const [saveWeekTemplateOpen, setSaveWeekTemplateOpen] = useState(false);
  const [weekTemplateName, setWeekTemplateName] = useState("");
  const [weekTemplateNotes, setWeekTemplateNotes] = useState("");
  const [weekTemplateFavorite, setWeekTemplateFavorite] = useState(false);
  const [weekTemplateEditPhase, setWeekTemplateEditPhase] = useState<WeekTemplate["phase"]>("regular");
  const [weekTemplateEditLoad, setWeekTemplateEditLoad] = useState<NonNullable<WeekTemplate["load_level"]>>("medium");
  const [weekTemplateEditGames, setWeekTemplateEditGames] = useState<NonNullable<WeekTemplate["games_count"]>>(0);
  const [weekTemplateEditTags, setWeekTemplateEditTags] = useState("");
  const [editingWeekTemplateId, setEditingWeekTemplateId] = useState<string | null>(null);
  const [applyWeekTemplateOpen, setApplyWeekTemplateOpen] = useState(false);
  const [applyTargetTemplateId, setApplyTargetTemplateId] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [draggedSession, setDraggedSession] = useState<ScheduleEvent | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  // (touchStartX removed - no swipe pages in portrait)
  const [highlightDayKey, setHighlightDayKey] = useState<string | null>(null);
  const portraitDayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const landscapeDayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const plannerGridRef = useRef<HTMLDivElement | null>(null);
  const [playerActionsTick, setPlayerActionsTick] = useState(0);

  const templatesKey = useMemo(() => `uscout-schedule-templates:${clubId ?? "no-club"}`, [clubId]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);

  const weekTemplatesQ = useWeekTemplates({ clubId });
  const weekTemplates = weekTemplatesQ.data ?? [];
  const createWeekTemplateMut = useCreateWeekTemplate();
  const updateWeekTemplateMut = useUpdateWeekTemplate();
  const deleteWeekTemplateMut = useDeleteWeekTemplate();
  const [weekTemplateSearch, setWeekTemplateSearch] = useState("");
  const [weekTemplateSort, setWeekTemplateSort] = useState<"recent" | "alpha">("recent");
  const [weekTemplatePhase, setWeekTemplatePhase] = useState<WeekTemplate["phase"] | "all">("all");
  const [weekTemplateGames, setWeekTemplateGames] = useState<WeekTemplate["games_count"] | "all">("all");
  const [weekTemplateLoad, setWeekTemplateLoad] = useState<WeekTemplate["load_level"] | "all">("all");
  const [weekTemplateFavOnly, setWeekTemplateFavOnly] = useState(false);

  const weekTemplatesSorted = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    const q = norm(weekTemplateSearch);
    const filtered = weekTemplates.filter((tpl) => {
      if (q && !norm(tpl.name).includes(q)) return false;
      if (weekTemplateFavOnly && !tpl.favorite) return false;
      if (weekTemplatePhase !== "all" && tpl.phase !== weekTemplatePhase) return false;
      if (weekTemplateGames !== "all" && (tpl.games_count ?? 0) !== weekTemplateGames) return false;
      if (weekTemplateLoad !== "all" && tpl.load_level !== weekTemplateLoad) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const fa = a.favorite ? 1 : 0;
      const fb = b.favorite ? 1 : 0;
      if (fb !== fa) return fb - fa;
      if (weekTemplateSort === "alpha") return a.name.localeCompare(b.name);
      const la = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const lb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (lb !== la) return lb - la;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [weekTemplates, weekTemplateSearch, weekTemplateSort, weekTemplatePhase, weekTemplateGames, weekTemplateLoad, weekTemplateFavOnly]);

  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(templatesKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) setTemplates(parsed as SessionTemplate[]);
    } catch {
      setTemplates([]);
    }
  }, [templatesKey]);

  const saveTemplate = (tpl: SessionTemplate) => {
    setTemplates((prev) => {
      const next = [tpl, ...prev.filter((t) => t.id !== tpl.id)].slice(0, 12);
      try {
        window.localStorage.setItem(templatesKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const applyTemplate = (tpl: SessionTemplate) => {
    setCreateSessionType(tpl.session_type);
    setCreateTitle(tpl.title);
    setCreateLocation(tpl.location ?? "");
    setCreateAttendanceRequired(tpl.attendance_required);
    setCreateNotes(tpl.notes ?? "");
    setTargetAttendance(String(tpl.constraints?.target_attendance ?? ""));
    setMaxCapacity(String(tpl.constraints?.max_capacity ?? ""));
    setGroupName(String(tpl.constraints?.group_name ?? ""));
  };

  const mondayOf = (base: Date) => {
    // Ancla en el dia calendario del club (Asia/Shanghai), no en el reloj del
    // dispositivo -- mismo bug ya corregido en startOfTodayLocal/todayKey.
    // localDateKey(base) ya da el dia correcto en hora de China; se usa un
    // ancla neutra a mediodia UTC para calcular el dia de la semana sin
    // arrastrar de nuevo la zona horaria del dispositivo, y clubMidnightUtc
    // convierte el lunes resultante a su medianoche real en China.
    const [y, m, d] = localDateKey(base).split("-").map(Number);
    const noonAnchor = new Date(Date.UTC(y, m - 1, d, 12));
    const dow = noonAnchor.getUTCDay(); // 0=Sun
    const diff = (dow + 6) % 7; // dias desde el lunes
    noonAnchor.setUTCDate(noonAnchor.getUTCDate() - diff);
    return clubMidnightUtc(noonAnchor);
  };

  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const currentWeekStart = useMemo(() => mondayOf(new Date()), []);
  const isCurrentWeek = localDateKey(selectedWeekStart) === localDateKey(currentWeekStart);

  const selectedWeekEnd = useMemo(() => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [selectedWeekStart]);

  const plannerWeekQ = useScheduleEventsRange({
    clubId,
    fromIso: selectedWeekStart.toISOString(),
    toIso: selectedWeekEnd.toISOString(),
    key: "plannerWeek",
  });

  const prevWeekQ = useScheduleEventsRange({
    clubId,
    fromIso: new Date(selectedWeekStart.getTime() - 7 * 86400000).toISOString(),
    toIso: selectedWeekStart.toISOString(),
    key: "prevWeek",
  });

  const slotDefs = useMemo(
    () =>
      [
        { key: "morning", labelKey: "schedule_planner_slot_morning", hour: 9, startHour: 0, endHour: 12 },
        { key: "midday", labelKey: "schedule_planner_slot_midday", hour: 12, startHour: 12, endHour: 18 },
        { key: "evening", labelKey: "schedule_planner_slot_evening", hour: 18, startHour: 18, endHour: 24 },
      ] as const,
    [],
  );

  const exportNodeRef = useRef<HTMLDivElement | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const wellnessHintKey = useMemo(() => `uscout-hint:v1:wellness:${userId ?? "anon"}`, [userId]);
  const [wellnessHintDismissed, setWellnessHintDismissed] = useState(false);
  useEffect(() => {
    try {
      setWellnessHintDismissed(window.localStorage.getItem(wellnessHintKey) === "1");
    } catch {
      setWellnessHintDismissed(false);
    }
  }, [wellnessHintKey]);
  const dismissWellnessHint = () => {
    setWellnessHintDismissed(true);
    try { window.localStorage.setItem(wellnessHintKey, "1"); } catch {}
  };

  const exportVisibleWeekImage = async () => {
    if (!canExportWeekImage) return;
    if (!exportNodeRef.current) return;
    if (!clubId) return;
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const clubName = clubQ.data?.club.name || "My Club";
      const weekLabel = fmtWeekRange(selectedWeekStart);
      const fileNameSafe = `${clubName} ${weekLabel}`.replace(/[^\w\s\-–—]/g, "").trim() || "schedule";
      const dataUrl = await toPng(exportNodeRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${fileNameSafe}.png`, { type: "image/png" });

      const nav = navigator as any;
      if (nav?.share && nav?.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${clubName} · ${weekLabel}`,
          text: `${clubName} · ${weekLabel}`,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNameSafe}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch {
      toast({ description: t("schedule_export_failed" as any) });
    } finally {
      setExportBusy(false);
    }
  };

  const intlLocale = useMemo(() => {
    return locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const formatTimeHHMM = (h: number, m: number) => formatTimeHHMMFromParts(h, m);
  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(selectedWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedWeekStart]);

  const openCreatePrefilled = (d: Date, hour: number) => {
    setEditingSessionId(null);
    setCreateSessionType("training");
    setCreateTitle("");
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setCreateDate(`${yyyy}-${mm}-${dd}`);
    setCreateStartMins(hour * 60);
    setCreateEndTime("");
    setCreateLocation("");
    setCreateNotes("");
    setCreateAttendanceRequired(true);
    setTargetAttendance("");
    setMaxCapacity("");
    setGroupName("");
    setAttendanceMode(ACTIVITY_TYPE_CONFIG.training.defaultAttendanceMode);
    setAttendanceModeTouched(false);
    setGroupsCount("");
    setGroupCapacity("");
    setGroupSignupMode("coach_assign");
    setCoachGroupAssignments({});
    setSignupDeadline("");
    setSignupMaxSpots("");
    setSelectedPlayerIds(new Set());
    setCustomDurationOpen(false);
    setCustomDurationMins("");
    setUseCustomDateTime(true);
    setDurationMins(90);
    applyDurationPreset(90);
    setCreateOpen(true);
  };

  const moveSessionToSlot = (ev: ScheduleEvent, day: Date, hour: number) => {
    if (!clubId) return;
    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const startsIso = new Date(`${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:00`).toISOString();
    const duration = ev.ends_at ? new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime() : null;
    const endsIso = duration && duration > 0 ? new Date(new Date(startsIso).getTime() + duration).toISOString() : null;
    void updateEventMut
      .mutateAsync({ id: ev.id, club_id: clubId, patch: { starts_at: startsIso, ends_at: endsIso } })
      .then(() => toast({ description: t("schedule_move_saved") }))
      .catch(() => toast({ variant: "destructive", description: t("schedule_move_error") }));
  };

  const copyPreviousWeek = async () => {
    if (!clubId || !userId) return;
    const prev = prevWeekQ.data ?? [];
    if (prev.length === 0) return;
    try {
      for (const ev of prev) {
        const starts = new Date(ev.starts_at);
        const ends = ev.ends_at ? new Date(ev.ends_at) : null;
        const starts2 = new Date(starts.getTime() + 7 * 86400000).toISOString();
        const ends2 = ends ? new Date(ends.getTime() + 7 * 86400000).toISOString() : null;
        await createEventMut.mutateAsync({
          club_id: clubId,
          session_type: ev.session_type,
          title: ev.title,
          starts_at: starts2,
          ends_at: ends2,
          location: ev.location ?? null,
          notes: ev.notes ?? null,
          attendance_required: ev.attendance_required ?? true,
          created_by: userId,
        });
      }
      toast({ description: t("schedule_copy_prev_week_done") });
    } catch {
      toast({ variant: "destructive", description: t("schedule_copy_prev_week_error") });
    }
  };

  const copyVisibleWeekTo = async (targetWeekStart: Date) => {
    if (!clubId || !userId) return;
    const source = plannerWeekQ.data ?? [];
    if (source.length === 0) return;
    try {
      for (const ev of source) {
        const starts = new Date(ev.starts_at);
        const ends = ev.ends_at ? new Date(ev.ends_at) : null;
        const dayOffset = Math.floor((starts.getTime() - selectedWeekStart.getTime()) / 86400000);
        const targetDay = new Date(targetWeekStart);
        targetDay.setDate(targetDay.getDate() + dayOffset);
        targetDay.setHours(starts.getHours(), starts.getMinutes(), 0, 0);
        const starts2 = targetDay.toISOString();
        const ends2 =
          ends && !Number.isNaN(ends.getTime())
            ? new Date(new Date(starts2).getTime() + (ends.getTime() - starts.getTime())).toISOString()
            : null;
        await createEventMut.mutateAsync({
          club_id: clubId,
          session_type: ev.session_type,
          title: ev.title,
          starts_at: starts2,
          ends_at: ends2,
          location: ev.location ?? null,
          notes: ev.notes ?? null,
          attendance_required: ev.attendance_required ?? true,
          created_by: userId,
        });
      }
      toast({ description: t("schedule_copy_week_done" as any) });
    } catch {
      toast({ variant: "destructive", description: t("schedule_copy_week_error" as any) });
    }
  };

  const repeatThisWeek = async (weekOffsets: number[]) => {
    if (!clubId || !userId) return;
    const current = plannerWeekQ.data ?? [];
    if (current.length === 0) return;
    try {
      for (const w of weekOffsets) {
        for (const ev of current) {
          const starts = new Date(ev.starts_at);
          const ends = ev.ends_at ? new Date(ev.ends_at) : null;
          const starts2 = new Date(starts.getTime() + w * 7 * 86400000).toISOString();
          const ends2 = ends ? new Date(ends.getTime() + w * 7 * 86400000).toISOString() : null;
          await createEventMut.mutateAsync({
            club_id: clubId,
            session_type: ev.session_type,
            title: ev.title,
            starts_at: starts2,
            ends_at: ends2,
            location: ev.location ?? null,
            notes: ev.notes ?? null,
            attendance_required: ev.attendance_required ?? true,
            created_by: userId,
          });
        }
      }
      toast({
        description: t("schedule_repeat_week_done")
          .replace("{weeks}", String(weekOffsets.length))
          .replace("{sessions}", String(current.length * weekOffsets.length)),
      });
    } catch {
      toast({ variant: "destructive", description: t("schedule_repeat_week_error") });
    }
  };

  const clearCurrentWeek = async () => {
    if (!clubId) return;
    const current = plannerWeekQ.data ?? [];
    if (current.length === 0) return;
    try {
      for (const ev of current) {
        await deleteEventMut.mutateAsync({ id: ev.id, club_id: clubId });
      }
      toast({ description: t("schedule_clear_week_done") });
    } catch {
      toast({ variant: "destructive", description: t("schedule_clear_week_error") });
    }
  };

  const buildWeekTemplateFromCurrentWeek = (): WeekTemplateSession[] => {
    const current = plannerWeekQ.data ?? [];
    const sessions: WeekTemplateSession[] = [];
    for (const ev of current) {
      const starts = new Date(ev.starts_at);
      const dayIndex = Math.floor((starts.getTime() - selectedWeekStart.getTime()) / 86400000);
      if (dayIndex < 0 || dayIndex > 6) continue;
      const startMins = starts.getHours() * 60 + starts.getMinutes();
      const durationMins =
        ev.ends_at ? Math.max(0, Math.round((new Date(ev.ends_at).getTime() - starts.getTime()) / 60000)) : null;
      sessions.push({
        dayIndex,
        startMins,
        durationMins,
        session_type: ev.session_type,
        title: ev.title,
        location: ev.location ?? null,
        notes: ev.notes ?? null,
        attendance_required: ev.attendance_required ?? true,
      });
    }
    return sessions
      .sort((a, b) => (a.dayIndex !== b.dayIndex ? a.dayIndex - b.dayIndex : a.startMins - b.startMins))
      .slice(0, 200);
  };

  const duplicateWeekTemplate = (tpl: WeekTemplate) => {
    if (!clubId) return;
    createWeekTemplateMut.mutate(
      {
        name: `${tpl.name} (${t("invite_copy")})`,
        notes: tpl.notes,
        phase: tpl.phase,
        games_count: tpl.games_count,
        load_level: tpl.load_level,
        tags: tpl.tags,
        favorite: false,
        sessions: tpl.sessions,
      },
      { onSuccess: () => toast({ description: t("schedule_week_template_duplicated") }) },
    );
  };

  const markWeekTemplateUsed = (id: string) => {
    if (!clubId) return;
    updateWeekTemplateMut.mutate({ id, clubId, markUsed: true });
  };

  const applyWeekTemplate = async (tpl: WeekTemplate, mode: "replace" | "merge") => {
    if (!clubId || !userId) return;
    if (mode === "replace") await clearCurrentWeek();
    try {
      for (const s of tpl.sessions) {
        const day = new Date(selectedWeekStart);
        day.setDate(day.getDate() + s.dayIndex);
        const yyyy = day.getFullYear();
        const mo = String(day.getMonth() + 1).padStart(2, "0");
        const dd = String(day.getDate()).padStart(2, "0");
        const startsIso = new Date(`${yyyy}-${mo}-${dd}T${minutesToHHMM(s.startMins)}`).toISOString();
        const endsIso =
          s.durationMins && s.durationMins > 0
            ? new Date(new Date(startsIso).getTime() + s.durationMins * 60000).toISOString()
            : null;
        await createEventMut.mutateAsync({
          club_id: clubId,
          session_type: s.session_type,
          title: s.title,
          starts_at: startsIso,
          ends_at: endsIso,
          location: s.location ?? null,
          notes: s.notes ?? null,
          attendance_required: s.attendance_required ?? true,
          created_by: userId,
        });
      }
      markWeekTemplateUsed(tpl.id);
      toast({ description: t("schedule_week_template_applied") });
    } catch {
      toast({ variant: "destructive", description: t("schedule_week_template_apply_error") });
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(locationKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((x) => typeof x === "string" && x.trim().length > 0).slice(0, 5) as string[];
        setRecentLocations(clean);
      }
    } catch {
      setRecentLocations([]);
    }
  }, [locationKey]);

  const pushRecentLocation = (loc: string) => {
    const v = loc.trim();
    if (!v) return;
    setRecentLocations((prev) => {
      const next = [v, ...prev.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 5);
      try {
        window.localStorage.setItem(locationKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const openSessionDetail = (ev: ScheduleEvent) => {
    if (isDesktop) {
      setDesktopSelectedEvent(ev);
    } else {
      setSessionDetailEvent(ev);
    }
  };

  const startEditing = (ev: ScheduleEvent) => {
    setEditingSessionId(ev.id);
    setEditingSessionEvent(ev);
    setCreateSessionType(ev.session_type);
    setCreateTitle(ev.title ?? "");
    const d = new Date(ev.starts_at);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setCreateDate(`${yyyy}-${mm}-${dd}`);
    setCreateStartMins(d.getHours() * 60 + d.getMinutes());
    if (ev.ends_at) {
      const e = new Date(ev.ends_at);
      setCreateEndTime(formatTimeHHMM(e.getHours(), e.getMinutes()));
      const realDurationMins = Math.round((e.getTime() - d.getTime()) / 60000);
      setDurationMins(realDurationMins > 0 ? realDurationMins : null);
    } else {
      setCreateEndTime("");
      setDurationMins(null);
    }
    setCreateLocation(ev.location ?? "");
    const parsed = readConstraintsFromNotes(ev.notes ?? null);
    setCreateNotes(parsed.notesClean ?? "");
    setTargetAttendance(parsed.constraints?.target_attendance ? String(parsed.constraints.target_attendance) : "");
    setMaxCapacity(parsed.constraints?.max_capacity ? String(parsed.constraints.max_capacity) : "");
    setGroupName(parsed.constraints?.group_name ? String(parsed.constraints.group_name) : "");
    const att = parsed.constraints?.attendance as any;
    if (att?.mode === "groups" || att?.mode === "signup" || att?.mode === "selected_players" || att?.mode === "all_team") {
      setAttendanceMode(att.mode);
    }
    setAttendanceModeTouched(true);
    setGroupsCount(att?.groups_count ? String(att.groups_count) : "");
    setGroupCapacity(att?.group_capacity ? String(att.group_capacity) : "");
    setGroupSignupMode(att?.group_signup_mode === "auto_signup" ? "auto_signup" : "coach_assign");
    setCoachGroupAssignments(att?.coach_assignments && typeof att.coach_assignments === "object" ? att.coach_assignments : {});
    setSignupDeadline(typeof att?.signup_deadline === "string" ? att.signup_deadline : "");
    setSignupMaxSpots(att?.signup_max_spots ? String(att.signup_max_spots) : "");
    setSelectedPlayerIds(new Set(Array.isArray(att?.selected_player_ids) ? att.selected_player_ids.map(String) : []));
    setCustomDurationOpen(false);
    setCustomDurationMins("");
    setTrainingTags(new Set((parsed.constraints?.tags ?? []).map(String)));
    setSubgroupCount(parsed.constraints?.subgroups?.count ? String(parsed.constraints.subgroups.count) : "");
    setSubgroupMinutes(parsed.constraints?.subgroups?.minutes ? String(parsed.constraints.subgroups.minutes) : "");
    setCreateAttendanceRequired(ev.attendance_required !== false);
    setUseCustomDateTime(true);
    setCreateOpen(true);
  };

  // week dropdown removed (strict arrow navigation)

  const scrollToToday = () => {
    const today = new Date();
    const todayKey = localDateKey(today);
    setSelectedWeekStart(currentWeekStart);
    setHighlightDayKey(todayKey);
    window.setTimeout(() => setHighlightDayKey(null), 900);
    window.setTimeout(() => {
      const el = (portraitDayRefs.current[todayKey] ?? landscapeDayRefs.current[todayKey]) as HTMLElement | null;
      el?.scrollIntoView({ block: "start", inline: "nearest" });
    }, 50);
  };

  useEffect(() => {
    if (staffView !== "list") return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector(`[data-today="true"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "start", inline: "nearest" });
      } else if (attempts < 20) {
        attempts++;
        window.setTimeout(tryScroll, 150);
      }
    };
    window.setTimeout(tryScroll, 500);
  }, [staffView]);

  // Auto-scroll so planner grid is visible on desktop when planner tab is clicked.
  // Uses scrollTop on the grid's own scrollable container — safe for iOS (no scrollIntoView).
  useEffect(() => {
    if (staffView !== "planner" || !isLandscape) return;
    const timer = window.setTimeout(() => {
      const grid = plannerGridRef.current;
      if (!grid) return;
      // Scroll the grid's nearest scrollable ancestor to show the grid
      let parent = grid.parentElement;
      while (parent && parent.scrollHeight <= parent.clientHeight) {
        parent = parent.parentElement;
      }
      if (parent) {
        const targetTop = grid.offsetTop - (parent as HTMLElement).offsetTop - 8;
        parent.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [staffView, isLandscape, plannerScrollTick]);

  // Auto-scroll to today when portrait planner is shown (or re-clicked)
  // Uses scrollTop instead of scrollIntoView — avoids iOS Capacitor touch-scroll lock bug.
  useEffect(() => {
    if (staffView !== "planner" || isLandscape) return;
    const timer = window.setTimeout(() => {
      const todayKey = localDateKey(new Date());
      const el = portraitDayRefs.current[todayKey] as HTMLElement | null;
      if (!el) return;
      // Find the nearest scrollable ancestor instead of scrollIntoView
      let parent = el.parentElement;
      while (parent && parent.scrollHeight <= parent.clientHeight) {
        parent = parent.parentElement;
      }
      if (parent) {
        const targetTop = el.offsetTop - parent.offsetTop - 16;
        parent.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [staffView, isLandscape, plannerScrollTick]);

  const fmtWeekRange = (start: Date) => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  };

  const deleteWeekTemplate = (id: string) => {
    if (!clubId) return;
    deleteWeekTemplateMut.mutate(
      { id, clubId },
      { onSuccess: () => toast({ description: t("schedule_week_template_deleted" as any) }) },
    );
  };

  const typePillClass = (k: ScheduleEvent["session_type"]) => {
    if (k === "match") return "border-orange-300/50 bg-orange-500/10 text-orange-900 dark:text-orange-200";
    if (k === "recovery") return "border-emerald-300/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
    if (k === "travel") return "border-sky-300/50 bg-sky-500/10 text-sky-900 dark:text-sky-200";
    return "border-border bg-background/40 text-foreground";
  };

  const duplicateInOneTap = (ev: ScheduleEvent) => {
    if (!clubId || !userId) return;
    const starts = new Date(ev.starts_at);
    const now = new Date();
    const sameTimeTomorrow = new Date(now);
    sameTimeTomorrow.setHours(starts.getHours(), starts.getMinutes(), 0, 0);
    sameTimeTomorrow.setDate(sameTimeTomorrow.getDate() + 1);
    const startsIso = sameTimeTomorrow.toISOString();
    const endsIso =
      ev.ends_at && !Number.isNaN(new Date(ev.ends_at).getTime())
        ? new Date(new Date(startsIso).getTime() + (new Date(ev.ends_at).getTime() - starts.getTime())).toISOString()
        : null;
    void createEventMut
      .mutateAsync({
        club_id: clubId,
        session_type: ev.session_type,
        title: ev.title,
        starts_at: startsIso,
        ends_at: endsIso,
        location: ev.location ?? null,
        notes: ev.notes ?? null,
        attendance_required: ev.attendance_required ?? true,
        created_by: userId,
      })
      .then(() => toast({ description: t("schedule_duplicate_saved") }))
      .catch(() => toast({ variant: "destructive", description: t("schedule_duplicate_error") }));
  };

  const saveSessionAsTemplate = (ev: ScheduleEvent) => {
    const parsed = readConstraintsFromNotes(ev.notes ?? null);
    const tpl = {
      id: `tpl-${ev.id}`,
      name: ev.title,
      session_type: ev.session_type,
      title: ev.title,
      location: ev.location ?? null,
      notes: parsed.notesClean ?? null,
      attendance_required: ev.attendance_required ?? true,
      constraints: parsed.constraints ?? {},
    };
    saveTemplate(tpl);
    toast({ description: t("schedule_template_saved") });
  };

  const [sleepQuality, setSleepQuality] = useState<string>("");
  const [energyLevel, setEnergyLevel] = useState<string>("");
  const [muscleSoreness, setMuscleSoreness] = useState<string>("");
  const [mentalReadiness, setMentalReadiness] = useState<string>("");
  const [wellnessEditing, setWellnessEditing] = useState(false);

  const entryQ = useWellnessEntryToday({ clubId, userId });
  const upsert = useUpsertWellnessEntry();
  const entryDate = todayKey();
  const localKey = useMemo(() => `uscout-wellness-local:${userId ?? "anon"}:${entryDate}`, [entryDate, userId]);

  const last7Q = useWellnessEntriesLastNDays({ clubId, userId, days: 7 });
  const last30Q = useWellnessEntriesLastNDays({ clubId, userId, days: 30 });
  const submittedToday = Boolean(entryQ.data);

  const playerBaseline = useMemo(() => {
    const entries = (last30Q.data ?? []).filter((e) => e.entry_date !== entryDate);
    if (entries.length === 0) return null;
    const avg = (key: "sleep_quality" | "energy_level" | "muscle_soreness" | "mental_readiness") => {
      const sum = entries.reduce((acc, e) => acc + (e as any)[key], 0);
      return sum / entries.length;
    };
    return {
      sleep: avg("sleep_quality"),
      energy: avg("energy_level"),
      soreness: avg("muscle_soreness"),
      readiness: avg("mental_readiness"),
      n: entries.length,
    };
  }, [entryDate, last30Q.data]);

  const [wellnessTrendRange, setWellnessTrendRange] = useState<"7d" | "30d">("7d");


  const setFromEntry = (e: {
    sleep_quality: number;
    energy_level: number;
    muscle_soreness: number;
    mental_readiness: number;
  }) => {
    setSleepQuality(String(e.sleep_quality));
    setEnergyLevel(String(e.energy_level));
    setMuscleSoreness(String(e.muscle_soreness));
    setMentalReadiness(String(e.mental_readiness));
  };

  const wellnessComplete = useMemo(
    () => Boolean(sleepQuality && energyLevel && muscleSoreness && mentalReadiness),
    [sleepQuality, energyLevel, mentalReadiness, muscleSoreness],
  );

  const backendAvailable = Boolean(clubId && userId);
  const showLocalWellness = isPlayer && (!backendAvailable || entryQ.isError);
  const [localSaved, setLocalSaved] = useState(false);

  const pendingResponses = useMemo(() => {
    const sessions = (todayEventsQ.data ?? []).filter((s) => s.attendance_required !== false);
    if (!sessions.length) return 0;
    const totalRoster = rosterPlayerUserIds.length;
    if (!totalRoster) return 0;
    const respondedUserIds = new Set((todayParticipantsQ.data ?? []).map((p) => p.user_id));
    // MVP: pending responses across club roster (not per-session) to keep it simple.
    const responded = Math.min(totalRoster, respondedUserIds.size);
    return Math.max(0, totalRoster - responded);
  }, [rosterPlayerUserIds.length, todayEventsQ.data, todayParticipantsQ.data]);

  const nextSessionCountdown = useMemo(() => {
    if (!nextSession?.starts_at) return null;
    const diffMs = new Date(nextSession.starts_at).getTime() - Date.now();
    if (diffMs <= 0) return null;
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return t("schedule_countdown_mins").replace("{mins}", String(mins));
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return t("schedule_countdown_hours").replace("{h}", String(hrs)).replace("{m}", String(rem));
  }, [nextSession?.starts_at, t]);

  useEffect(() => {
    if (!showLocalWellness) return;
    try {
      const raw = window.localStorage.getItem(localKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        sleep_quality: number;
        energy_level: number;
        muscle_soreness: number;
        mental_readiness: number;
        saved_at: string;
      }>;
      if (typeof parsed.sleep_quality === "number") setSleepQuality(String(parsed.sleep_quality));
      if (typeof parsed.energy_level === "number") setEnergyLevel(String(parsed.energy_level));
      if (typeof parsed.muscle_soreness === "number") setMuscleSoreness(String(parsed.muscle_soreness));
      if (typeof parsed.mental_readiness === "number") setMentalReadiness(String(parsed.mental_readiness));
      setLocalSaved(Boolean(parsed.saved_at));
    } catch {
      // ignore
    }
  }, [localKey, showLocalWellness]);

  const playerSignupKey = (club: string, eventId: string, user: string) => `uscout-schedule:signup:${club}:${eventId}:${user}`;
  const playerGroupKey = (club: string, eventId: string, user: string) => `uscout-schedule:group:${club}:${eventId}:${user}`;

  // ── Desktop week strip & panel data ──────────────────────────
  const schedWeekDays = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dow + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, []);

  const schedTodayKey = localDateKey(new Date());

  const desktopPanel = isDesktop ? (
    <ScheduleDesktopPanel
      event={desktopSelectedEvent}
      locale={locale}
      intlLocale={intlLocale}
      t={t}
      canCreateSession={canCreateSession}
      readConstraintsFromNotes={readConstraintsFromNotes}
      onEdit={(ev) => {
        setDesktopSelectedEvent(null);
        startEditing(ev);
      }}
    />
  ) : undefined;


  return (
    <ModulePageShell
      title={t("ucore_card_schedule_title")}
      moduleHeader={{ module: "schedule", tagline: t("tagline_schedule") }}
      panel={staffView === "planner" ? undefined : desktopPanel}
      panelLabel={isDesktop ? (locale === "zh" ? "概况" : locale === "es" ? "DETALLE" : "OVERVIEW") : undefined}
    >
      <div className="p-4 pb-10 md:px-8 md:pt-5 max-w-5xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "schedule" | "wellness")}>
          <div className="flex items-center justify-between gap-3">
            <TabsList className="h-10">
              <TabsTrigger value="schedule" className="text-xs font-bold">
                {t("schedule_tab_schedule")}
              </TabsTrigger>
              <TabsTrigger value="wellness" className="text-xs font-bold">
                {t("schedule_tab_wellness")}
              </TabsTrigger>
            </TabsList>
            {/* No external create entry points. Session creation starts from empty planner slots only. */}
          </div>

          {/* Skeleton inicial — solo cuando no hay datos cacheados */}
          {activeTab === "schedule" && isInitialLoad && <SkeletonSchedule />}
          <TabsContent value="schedule" className={cn("mt-4 space-y-4 md:mt-6 md:space-y-5", isInitialLoad && "hidden")}>

            {/* ── Desktop week calendar grid ── */}
            {isDesktop && (
              <div className="hidden md:block mb-6">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {schedWeekDays.map((d) => {
                    const name = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: CLUB_TIME_ZONE }).format(d);
                    const isToday = localDateKey(d) === schedTodayKey;
                    return (
                      <div key={localDateKey(d)} className="text-center py-1">
                        <span className={cn("text-[10px] md:text-xs font-medium uppercase tracking-wide",
                          isToday ? "text-primary" : "text-muted-foreground/70")}>{name}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {schedWeekDays.map((d) => {
                    const key = localDateKey(d);
                    const isToday = key === schedTodayKey;
                    const dayEvents = (weekEventsQ.data ?? []).filter(
                      (ev) => localDateKey(new Date(ev.starts_at)) === key,
                    );
                    const EVENT_COLORS: Record<string, string> = {
                      training: "bg-primary/15 text-primary",
                      match:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      recovery: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                      meeting:  "bg-muted text-muted-foreground",
                      travel:   "bg-muted text-muted-foreground",
                    };
                    return (
                      <div
                        key={key}
                        className={cn(
                          "min-h-[72px] rounded-xl border p-1.5 flex flex-col gap-1 text-left w-full",
                          isToday
                            ? "border-primary/30 bg-primary/4"
                            : "border-border/30 bg-card",
                        )}
                      >
                        <span className={cn("text-[11px] md:text-sm font-medium leading-none mb-0.5",
                          isToday ? "text-primary" : "text-muted-foreground/70")}>{d.getDate()}</span>
                        {dayEvents.map((ev) => {
                          const timeStr = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE }).format(new Date(ev.starts_at));
                          const colorClass = EVENT_COLORS[(ev as any).type ?? "training"] ?? EVENT_COLORS.training;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => openSessionDetail(ev)}
                              className={cn("rounded px-1.5 py-0.5 text-[10px] md:text-sm font-medium leading-tight truncate text-left w-full cursor-pointer hover:opacity-80 transition-opacity", colorClass)}
                            >
                              {timeStr} {sessionDisplayTitle(ev, t)}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {todayEventsQ.isError ? (
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted-foreground">{t("schedule_load_failed")}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={() => void todayEventsQ.refetch()}
                  data-testid="schedule-retry"
                >
                  {t("retry")}
                </Button>
              </div>
            ) : null}
            {isPlayer ? (
              <>
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  <div className="border-b border-border/60 bg-muted/15 px-4 py-2.5">
                    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                      {t("schedule_player_next_session")}
                    </p>
                  </div>
                  <div className="p-4">
                    {todayEventsQ.isLoading || tomorrowEventsQ.isLoading || weekEventsQ.isLoading ? (
                      <p className="text-sm font-semibold text-muted-foreground">{t("schedule_loading_today")}</p>
                    ) : !nextSession ? (
                      <p className="text-lg font-black tracking-tight text-foreground">{t("schedule_empty_next_sessions")}</p>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          {nextSession.session_type ? (
                            (() => {
                              const NextIcon = ACTIVITY_TYPE_CONFIG[nextSession.session_type].icon;
                              return (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                                  <NextIcon className="h-6 w-6" aria-hidden />
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/30 text-muted-foreground">
                              <CalendarDays className="h-6 w-6" aria-hidden />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-black leading-tight tracking-tight text-foreground sm:text-xl">{sessionDisplayTitle(nextSession, t)}</p>
                            {nextSessionCountdown ? (
                              <p className="mt-2 text-2xl font-black text-primary">{nextSessionCountdown}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {nextSession.session_type ? (
                            (() => {
                              const ChipIcon = ACTIVITY_TYPE_CONFIG[nextSession.session_type].icon;
                              const chipClass =
                                nextSession.session_type === "training"
                                  ? "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200"
                                  : nextSession.session_type === "recovery"
                                    ? "border-rose-500/35 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                                    : nextSession.session_type === "match"
                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                                      : nextSession.session_type === "travel"
                                        ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-900 dark:text-cyan-200"
                                        : nextSession.session_type === "meeting"
                                          ? "border-violet-500/35 bg-violet-500/10 text-violet-900 dark:text-violet-200"
                                          : "border-border bg-muted/30 text-foreground";
                              return (
                                <span
                                  className={[
                                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black",
                                    chipClass,
                                  ].join(" ")}
                                >
                                  <ChipIcon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                                  {t(ACTIVITY_TYPE_CONFIG[nextSession.session_type].labelKey)}
                                </span>
                              );
                            })()
                          ) : null}
                          {nextSession.starts_at ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              {formatTime(nextSession.starts_at)}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground">
                            {nextSession.location?.trim() ? nextSession.location : t("schedule_location_tbd")}
                          </span>
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black",
                              submittedToday
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                : "border-amber-500/40 bg-amber-500/12 text-amber-950 dark:text-amber-100",
                            ].join(" ")}
                          >
                            {submittedToday
                              ? `${t("schedule_player_wellness")} ✓`
                              : `${t("schedule_player_wellness")}: ${t("schedule_wellness_pending")}`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <p
                    className="text-xs font-black tracking-widest uppercase text-muted-foreground"
                    data-today="true"
                  >
                    {t("schedule_section_today")}
                  </p>
                  <div className="mt-3 space-y-2">
                    {todayEventsQ.isError ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{t("schedule_load_failed")}</p>
                      </div>
                    ) : todayEventsQ.isLoading ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{t("schedule_loading_today")}</p>
                      </div>
                    ) : (todayEventsQ.data?.length ?? 0) === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{t("schedule_empty_today_sessions")}</p>
                      </div>
                    ) : (
                      (todayEventsQ.data ?? []).map((ev) => {
                        const my = (myParticipantsQ.data ?? []).find((p) => p.event_id === ev.id);
                        const rowPending = pendingSessionIds.has(ev.id);
                        const attendanceRequired = ev.attendance_required !== false;
                        const parsed = readConstraintsFromNotes(ev.notes ?? null);
                        const att = parsed.constraints?.attendance as any;
                        const mode: AttendanceMode = (att?.mode as AttendanceMode) || "all_team";
                        const selectedMandatory =
                          mode === "selected_players" && Array.isArray(att?.selected_player_ids) && userId
                            ? att.selected_player_ids.map(String).includes(String(userId))
                            : false;
                        // Ensure localStorage-backed actions re-render immediately after changes.
                        void playerActionsTick;
                        const isSignedUp =
                          mode === "signup" && clubId && userId
                            ? Boolean(window.localStorage.getItem(playerSignupKey(clubId, ev.id, userId)))
                            : false;
                        const chosenGroup =
                          mode === "groups" && att?.group_signup_mode === "auto_signup" && clubId && userId
                            ? window.localStorage.getItem(playerGroupKey(clubId, ev.id, userId))
                            : null;
                        const groupsN = Math.max(2, Math.min(6, Number(att?.groups_count) || 2));
                        const groupCap = Number(att?.group_capacity) || null;
                        const assignedGroupIdx =
                          mode === "groups" && att?.group_signup_mode === "coach_assign" && userId
                            ? (typeof att?.coach_assignments?.[String(userId)] === "number"
                                ? Number(att.coach_assignments[String(userId)])
                                : null)
                            : null;
                        const assignedGroupLabel =
                          typeof assignedGroupIdx === "number" && Number.isFinite(assignedGroupIdx)
                            ? String.fromCharCode(65 + assignedGroupIdx)
                            : null;
                        return (
                          <SessionRow
                            key={ev.id}
                            title={sessionDisplayTitle(ev, t)}
                            subtitle={`${formatTime(ev.starts_at)}${ev.location ? ` · ${ev.location}` : ""}`}
                            right={
                              attendanceRequired ? (
                                <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                                  {(() => {
                                    const setParticipantStatus = (status: "confirmed" | "declined" | "maybe") => {
                                      if (!clubId || !userId) return;
                                      setPendingSessionIds((prev) => {
                                        const next = new Set(prev);
                                        next.add(ev.id);
                                        return next;
                                      });
                                      void upsertParticipant
                                        .mutateAsync({
                                          club_id: clubId,
                                          event_id: ev.id,
                                          user_id: userId,
                                          status,
                                        })
                                        .then(() => toast({ description: t("schedule_attendance_saved") }))
                                        .catch(() => toast({ variant: "destructive", description: t("schedule_attendance_error") }))
                                        .finally(() => {
                                          setPendingSessionIds((prev) => {
                                            const next = new Set(prev);
                                            next.delete(ev.id);
                                            return next;
                                          });
                                        });
                                    };

                                    const disabledCore =
                                      !clubId || !userId || myParticipantsQ.isLoading || rowPending || upsertParticipant.isPending;

                                    if (mode === "selected_players" && !selectedMandatory) {
                                      return null;
                                    }

                                    if (mode === "signup") {
                                      return (
                                        <div className="flex items-center gap-2">
                                          {isSignedUp ? (
                                            <>
                                              <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-xs font-bold text-foreground">
                                                {t("schedule_player_joined")}
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9"
                                                disabled={disabledCore}
                                                onClick={() => {
                                                  if (!clubId || !userId) return;
                                                  try {
                                                    window.localStorage.removeItem(playerSignupKey(clubId, ev.id, userId));
                                                  } catch {
                                                    // ignore
                                                  }
                                                  setParticipantStatus("declined");
                                                  setPlayerActionsTick((x) => x + 1);
                                                }}
                                              >
                                                {t("schedule_player_leave")}
                                              </Button>
                                            </>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="secondary"
                                              className="h-9"
                                              disabled={disabledCore}
                                              onClick={() => {
                                                if (!clubId || !userId) return;
                                                try {
                                                  window.localStorage.setItem(playerSignupKey(clubId, ev.id, userId), "1");
                                                } catch {
                                                  // ignore
                                                }
                                                setParticipantStatus("confirmed");
                                                setPlayerActionsTick((x) => x + 1);
                                              }}
                                            >
                                              {t("schedule_player_join_session")}
                                            </Button>
                                          )}
                                        </div>
                                      );
                                    }

                                    if (mode === "groups" && att?.group_signup_mode === "auto_signup") {
                                      return (
                                        <div className="flex items-center gap-2">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="secondary" className="h-9" disabled={disabledCore}>
                                                {chosenGroup
                                                  ? t("schedule_player_change_group")
                                                  : t("schedule_player_choose_group")}
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              {Array.from({ length: groupsN }).map((_, idx) => {
                                                const label = String.fromCharCode(65 + idx);
                                                return (
                                                  <DropdownMenuItem
                                                    key={label}
                                                    onClick={() => {
                                                      if (!clubId || !userId) return;
                                                      try {
                                                        window.localStorage.setItem(playerGroupKey(clubId, ev.id, userId), label);
                                                      } catch {
                                                        // ignore
                                                      }
                                                      setParticipantStatus("confirmed");
                                                      setPlayerActionsTick((x) => x + 1);
                                                    }}
                                                  >
                                                    {t("schedule_player_group_pick").replace("{group}", label)}
                                                    {groupCap ? ` · ${t("schedule_player_group_cap").replace("{cap}", String(groupCap))}` : ""}
                                                  </DropdownMenuItem>
                                                );
                                              })}
                                            </DropdownMenuContent>
                                          </DropdownMenu>

                                          {chosenGroup ? (
                                            <>
                                              <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-xs font-bold text-foreground">
                                                {t("schedule_player_group").replace("{group}", chosenGroup)}
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9"
                                                disabled={disabledCore}
                                                onClick={() => {
                                                  if (!clubId || !userId) return;
                                                  try {
                                                    window.localStorage.removeItem(playerGroupKey(clubId, ev.id, userId));
                                                  } catch {
                                                    // ignore
                                                  }
                                                  setParticipantStatus("declined");
                                                  setPlayerActionsTick((x) => x + 1);
                                                }}
                                              >
                                                {t("schedule_player_leave_group")}
                                              </Button>
                                            </>
                                          ) : null}
                                        </div>
                                      );
                                    }

                                    if (mode === "groups" && att?.group_signup_mode === "coach_assign") {
                                      return (
                                        <div className="flex items-center gap-2">
                                          {assignedGroupLabel ? (
                                            <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-xs font-bold text-foreground">
                                              {t("schedule_player_assigned_group").replace("{group}", assignedGroupLabel)}
                                            </span>
                                          ) : null}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-9"
                                            disabled={disabledCore}
                                            onClick={() => setParticipantStatus("declined")}
                                          >
                                            {t("schedule_player_cannot_attend")}
                                          </Button>
                                        </div>
                                      );
                                    }

                                    // all_team + selected_players (included): RSVP only (+ mandatory badge for selected_players)
                                    return (
                                      <div className="flex items-center gap-2">
                                        {selectedMandatory ? (
                                          <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-xs font-bold text-foreground">
                                            {t("schedule_player_mandatory")}
                                          </span>
                                        ) : null}
                                        <div className="flex gap-1.5">
                                          {(["confirmed", "declined", "maybe"] as const).map((status) => (
                                            <Button
                                              key={status}
                                              size="sm"
                                              variant={my?.status === status ? "secondary" : "outline"}
                                              className="h-9 px-2.5"
                                              disabled={disabledCore}
                                              onClick={() => setParticipantStatus(status)}
                                            >
                                              {t(
                                                status === "confirmed"
                                                  ? "schedule_rsvp_confirm_attendance"
                                                  : status === "declined"
                                                    ? "schedule_rsvp_decline"
                                                    : "schedule_rsvp_maybe_cta",
                                              )}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : null
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {tomorrowEventsQ.isSuccess && (tomorrowEventsQ.data?.length ?? 0) > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                      {t("schedule_section_tomorrow")}
                    </p>
                    <div className="mt-3 space-y-2">
                      {(tomorrowEventsQ.data ?? []).map((ev) => (
                        <SessionRow
                          key={ev.id}
                          title={sessionDisplayTitle(ev, t)}
                          subtitle={`${formatTime(ev.starts_at)}${ev.location ? ` · ${ev.location}` : ""}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {weekEventsQ.isSuccess && weekRestSessions.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                      {t("schedule_section_week")}
                    </p>
                    <div className="mt-3 space-y-2">
                      {weekRestSessions.map((ev) => (
                        <SessionRow
                          key={ev.id}
                          title={sessionDisplayTitle(ev, t)}
                          subtitle={`${formatTime(ev.starts_at)}${ev.location ? ` · ${ev.location}` : ""}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!staffView || staffView !== "list") setStaffView("list");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black tracking-tight transition-all",
                        staffView === "list"
                          ? "bg-card text-foreground shadow-sm border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <CalendarDays className="w-4 h-4 shrink-0" />
                      {t("schedule_view_list")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffView("planner");
                        setPlannerScrollTick(t => t + 1);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black tracking-tight transition-all",
                        staffView === "planner"
                          ? "bg-card text-foreground shadow-sm border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <LayoutTemplate className="w-4 h-4 shrink-0" />
                      {t("schedule_view_planner")}
                    </button>
                  </div>

                  <div />
                </div>

                {staffView === "planner" ? (
                  <div className="mt-2 grid grid-cols-3 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 w-11 px-0 justify-self-start"
                      onClick={() => setSelectedWeekStart((p) => new Date(p.getTime() - 7 * 86400000))}
                      aria-label={t("schedule_week_prev" as any)}
                    >
                      ←
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 px-3 justify-self-center w-full max-w-[220px]"
                      onClick={() => {
                        if (!isCurrentWeek) scrollToToday();
                      }}
                    >
                      <span className="truncate whitespace-nowrap">
                        {isCurrentWeek ? t("schedule_this_week" as any) : t("schedule_go_current_week" as any)}
                      </span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 w-11 px-0 justify-self-end"
                      onClick={() => setSelectedWeekStart((p) => new Date(p.getTime() + 7 * 86400000))}
                      aria-label={t("schedule_week_next" as any)}
                    >
                      →
                    </Button>
                  </div>
                ) : null}

                {staffView === "planner" ? (
                  <>
                    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs font-semibold text-muted-foreground">{t("schedule_planner_hint")}</p>

                    {!isLandscape ? (
                      <div className="mt-3 space-y-3">
                        {days.map((d) => {
                          const dayKey = localDateKey(d);
                          const daySessionsAll = (plannerWeekQ.data ?? [])
                            .filter((s) => localDateKey(new Date(s.starts_at)) === dayKey)
                            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                          const label = new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: CLUB_TIME_ZONE }).format(d);
                          const dateLabel = new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(d);

                          const sessionsInSlot = (slot: (typeof slotDefs)[number]) => {
                            const slotStart = new Date(d);
                            slotStart.setHours(slot.startHour, 0, 0, 0);
                            const slotEnd = new Date(d);
                            slotEnd.setHours(slot.endHour, 0, 0, 0);
                            return daySessionsAll.filter((s) => {
                              const ts = new Date(s.starts_at).getTime();
                              return ts >= slotStart.getTime() && ts < slotEnd.getTime();
                            });
                          };

                          const isToday = dayKey === localDateKey(new Date());
                          const isHighlighted = highlightDayKey === dayKey;
                          return (
                            <div
                              key={dayKey}
                              ref={(el) => {
                                portraitDayRefs.current[dayKey] = el;
                              }}
                              className={[
                                "rounded-2xl border-2 bg-card p-4",
                                isToday
                                  ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
                                  : "border-border",
                                isHighlighted ? "ring-2 ring-primary/60" : "",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-extrabold text-foreground truncate">{label}</p>
                                  <p className="text-xs font-semibold text-muted-foreground">{dateLabel}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {daySessionsAll.length >= 3 ? (
                                    <span className="px-2 py-0.5 rounded-full border border-border bg-muted/40 text-xs font-black tracking-widest uppercase text-muted-foreground">
                                      {t("schedule_overload" as any)}
                                    </span>
                                  ) : null}
                                  <span className="text-xs font-bold text-muted-foreground">
                                    {daySessionsAll.length > 0
                                      ? t("schedule_day_sessions_count" as any).replace("{count}", String(daySessionsAll.length))
                                      : t("schedule_rest_day" as any)}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2.5 space-y-1.5">
                                {slotDefs.map((slot) => {
                                  const list = sessionsInSlot(slot);
                                  return (
                                    <div
                                      key={slot.key}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-2.5 py-2"
                                    >
                                      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                                        {t(slot.labelKey as any)}
                                        <span className="ml-1.5 font-semibold normal-case tracking-normal text-muted-foreground/60">
                                          {formatSlotHourRange(slot.startHour, slot.endHour)}
                                        </span>
                                      </p>

                                      {list.length > 0 ? (
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                          {list.map((ev) => {
                                            const parsed = readConstraintsFromNotes(ev.notes ?? null);
                                            const tags = (parsed.constraints?.tags ?? []).slice(0, 2) as string[];
                                            return (
                                              <div key={ev.id} className="flex items-stretch justify-between gap-2">
                                                <PlannerSessionCardButton
                                                  className="min-w-0 flex-1 text-left rounded-lg px-2 py-1.5 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                                  onOpenDetail={() => openSessionDetail(ev)}
                                                  onOpenEdit={() => startEditing(ev)}
                                                >
                                                  <p className="text-sm font-extrabold text-foreground truncate">{sessionDisplayTitle(ev, t)}</p>
                                                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground truncate">
                                                    {formatTimeRange(ev.starts_at, ev.ends_at)}
                                                    {ev.location ? ` · ${ev.location}` : ""}
                                                  </p>
                                                  {tags.length > 0 ? (
                                                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                      {tags.map((tg) => (
                                                        <span
                                                          key={tg}
                                                          className="px-1.5 py-0.5 rounded-full border border-border/70 bg-muted/10 text-xs font-bold text-muted-foreground"
                                                        >
                                                          {tg}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  ) : null}
                                                </PlannerSessionCardButton>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : canCreateEvent ? (
                                        <button
                                          type="button"
                                          onClick={() => openCreatePrefilled(d, slot.hour)}
                                          className="w-full rounded-lg border border-dashed border-border bg-muted/20 px-2 py-4 text-left hover:bg-muted/30"
                                        >
                                          <p className="text-xs font-semibold text-muted-foreground">
                                            {t("schedule_planner_add")}
                                          </p>
                                        </button>
                                      ) : (
                                        <div className="w-full rounded-lg border border-dashed border-border/10 bg-muted/10 px-2 py-4" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div ref={plannerGridRef} className="mt-3 min-h-0 overflow-x-auto overflow-y-auto">
                        <div className="min-w-[560px]">
                          <div className="grid grid-cols-8 gap-2">
                          <div />
                          {days.map((d) => (
                            <div
                              key={d.toISOString()}
                              ref={(el) => {
                                landscapeDayRefs.current[localDateKey(d)] = el;
                              }}
                              className={[
                                "text-center rounded-lg px-0.5 pb-1",
                                (() => {
                                  const dk = localDateKey(d);
                                  const isTodayLs = dk === localDateKey(new Date());
                                  const isHighLs = highlightDayKey === dk;
                                  if (isTodayLs) return "border-2 border-primary bg-primary/5 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]";
                                  if (isHighLs) return "ring-2 ring-primary/60";
                                  return "";
                                })(),
                              ].join(" ")}
                            >
                              <p className="text-xs font-black text-foreground">
                                {new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: CLUB_TIME_ZONE }).format(d)}
                              </p>
                              <p className="text-xs font-semibold text-muted-foreground">
                                {new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(d)}
                              </p>
                              <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                                {(() => {
                                  const dayKey = localDateKey(d);
                                  const daySessions = (plannerWeekQ.data ?? []).filter((s) => localDateKey(new Date(s.starts_at)) === dayKey);
                                  const chips: string[] = [];
                                  if (daySessions.length === 0) chips.push("schedule_insight_no_sessions");
                                  if (daySessions.length >= 3) chips.push("schedule_insight_overloaded");
                                  const todayKey = localDateKey(new Date());
                                  if (dayKey === todayKey && pendingResponses > 0) chips.push("schedule_insight_low_attendance_risk");
                                  return chips.slice(0, 2).map((k) => (
                                    <span
                                      key={k}
                                      className="px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-xs font-semibold text-muted-foreground"
                                    >
                                      {t(k as any)}
                                    </span>
                                  ));
                                })()}
                              </div>
                            </div>
                          ))}
                          {slotDefs.map((slot) => (
                            <>
                              <div key={slot.key} className="flex items-center">
                                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                                  {t(slot.labelKey as any)}
                                  <span className="block font-semibold normal-case tracking-normal text-muted-foreground/60">
                                    {formatSlotHourRange(slot.startHour, slot.endHour)}
                                  </span>
                                </p>
                              </div>
                              {days.map((d) => {
                                const slotStart = new Date(d);
                                slotStart.setHours(slot.startHour, 0, 0, 0);
                                const slotEnd = new Date(d);
                                slotEnd.setHours(slot.endHour, 0, 0, 0);
                                const inSlot = (plannerWeekQ.data ?? []).filter((s) => {
                                  const ts = new Date(s.starts_at).getTime();
                                  return ts >= slotStart.getTime() && ts < slotEnd.getTime();
                                });

                                const cellDayKey = localDateKey(d);
                                const isCellToday = cellDayKey === localDateKey(new Date());
                                const cellKey = `${slot.key}-${cellDayKey}`;
                                const isDragOver = dragOverCell === cellKey;
                                return (
                                  <div
                                    key={cellKey}
                                    data-testid={`planner-cell-${cellKey}`}
                                    className={[
                                      'space-y-1 rounded-lg px-0.5 py-2 transition-colors',
                                      isCellToday ? 'bg-primary/5' : '',
                                      isDragOver ? 'bg-primary/15 ring-2 ring-primary/50' : '',
                                    ].join(' ')}
                                    onDragOver={(e) => {
                                      if (!canCreateEvent || !draggedSession) return;
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      if (dragOverCell !== cellKey) setDragOverCell(cellKey);
                                    }}
                                    onDragLeave={() => {
                                      setDragOverCell((prev) => (prev === cellKey ? null : prev));
                                    }}
                                    onDrop={(e) => {
                                      if (!canCreateEvent) return;
                                      e.preventDefault();
                                      setDragOverCell(null);
                                      if (draggedSession) {
                                        moveSessionToSlot(draggedSession, d, slot.hour);
                                      }
                                      setDraggedSession(null);
                                    }}
                                  >
                                    {inSlot.length > 0 ? (
                                      inSlot.map((ev) => (
                                      <PlannerSessionCardButton
                                      key={ev.id}
                                        className="w-full rounded-lg border border-border bg-background/40 px-2 py-2 text-left hover:bg-muted/20 active:scale-[0.98] transition-colors"
                                        onOpenDetail={() => openSessionDetail(ev)}
                                        onOpenEdit={() => startEditing(ev)}
                                        desktopInteraction={isDesktop}
                                        draggable={canCreateEvent}
                                        onDragStart={() => setDraggedSession(ev)}
                                        onDragEnd={() => { setDraggedSession(null); setDragOverCell(null); }}
                                      >
                                      <p className="text-xs font-extrabold text-foreground truncate">{sessionDisplayTitle(ev, t)}</p>
                                      <p className="text-xs font-semibold text-muted-foreground truncate">
                                      {formatTimeRange(ev.starts_at, ev.ends_at)}
                                      {ev.location ? ` · ${ev.location}` : ""}
                                      </p>
                                      </PlannerSessionCardButton>
                                      ))
                                    ) : canCreateEvent ? (
                                      <button
                                        type="button"
                                        onClick={() => openCreatePrefilled(d, slot.hour)}
                                        className={cn(
                                          "w-full rounded-lg border border-dashed border-border bg-muted/20 px-2 py-4 text-left hover:bg-muted/30",
                                          isDragOver ? "border-primary/60" : "",
                                        )}
                                      >
                                        <p className="text-xs font-semibold text-muted-foreground">
                                          {isDragOver ? (locale === "zh" ? "松开以移动到这里" : locale === "es" ? "Suelta aquí para mover" : "Drop here to move") : t("schedule_planner_add")}
                                        </p>
                                      </button>
                                    ) : (
                                      <div className="w-full rounded-lg border border-dashed border-border/10 bg-muted/10 px-2 py-4" />
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          ))}
                        </div>
                      </div>
                    </div>
                    )}
                    </div>

                    {(() => {
                      const weekCount = plannerWeekQ.data?.length ?? 0;
                      const prevCount = prevWeekQ.data?.length ?? 0;
                      const weekHasSessions = !plannerWeekQ.isLoading && weekCount > 0;
                      const weekEmpty = !plannerWeekQ.isLoading && weekCount === 0;
                      const prevHasSessions = !prevWeekQ.isLoading && prevCount > 0;
                      const showCopyPrev = weekEmpty && prevHasSessions;
                      const showDeleteAll = weekHasSessions;
                      return (
                        <div className="mt-3 grid grid-cols-3 items-center gap-2">
                          {/* Left — Week templates */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11 px-4 justify-self-start"
                            onClick={() => setWeekTemplatesOpen(true)}
                            data-testid="schedule-week-templates"
                            aria-label={t("schedule_week_templates")}
                            title={t("schedule_week_templates")}
                          >
                            <LayoutTemplate className="w-4 h-4 mr-2 shrink-0" />
                            <span className="truncate">{t("schedule_week_templates")}</span>
                          </Button>

                          {/* Center — conditional: Copy prev / Clear week / empty */}
                          <div className="flex justify-center">
                            {showCopyPrev ? (
                              <Button className="h-11 px-5 w-full max-w-[220px]" disabled={!clubId || !userId} onClick={() => void copyPreviousWeek()}>
                                <span className="truncate">{t("schedule_copy_prev_week")}</span>
                              </Button>
                            ) : showDeleteAll ? (
                              <Button
                                variant="secondary"
                                className="h-11 px-5 w-full max-w-[220px] text-destructive"
                                disabled={!clubId || weekCount === 0}
                                onClick={() => setClearWeekOpen(true)}
                              >
                                <span className="truncate">{t("schedule_clear_week")}</span>
                              </Button>
                            ) : (
                              <div />
                            )}
                          </div>

                          {/* Right — Export (head_coach only) or empty placeholder */}
                          {canExportWeekImage ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-11 px-4 justify-self-end"
                              disabled={!clubId || exportBusy}
                              onClick={() => void exportVisibleWeekImage()}
                              aria-label={t("schedule_export_week" as any)}
                              title={t("schedule_export_week" as any)}
                            >
                              <Share2 className="w-4 h-4 mr-2 shrink-0" />
                              <span className="truncate">{exportBusy ? t("schedule_exporting" as any) : t("schedule_export_week" as any)}</span>
                            </Button>
                          ) : (
                            <div />
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <KpiCard
                    title={t("schedule_staff_kpi_sessions_today")}
                    value={
                      todayEventsQ.isLoading ? t("schedule_placeholder_kpi") : String(todayEventsQ.data?.length ?? 0)
                    }
                  />
                  <KpiCard
                    title={t("schedule_staff_kpi_wellness_pct")}
                    value={
                      wellnessPctQ.isLoading
                        ? t("schedule_placeholder_kpi")
                        : `${wellnessPctQ.data?.pct ?? 0}%`
                    }
                    subtitle={
                      wellnessPctQ.data
                        ? t("schedule_staff_wellness_submitted")
                            .replace("{submitted}", String(wellnessPctQ.data.submitted))
                            .replace("{total}", String(wellnessPctQ.data.total))
                        : undefined
                    }
                  />
                  <KpiCard
                    title={t("schedule_staff_kpi_pending_responses")}
                    value={
                      todayEventsQ.isLoading || todayParticipantsQ.isLoading ? t("schedule_placeholder_kpi") : String(pendingResponses)
                    }
                  />
                  <KpiCard
                    title={t("schedule_staff_kpi_next_session_countdown")}
                    value={nextSessionCountdown ?? t("schedule_placeholder_kpi")}
                    subtitle={nextSession ? sessionDisplayTitle(nextSession, t) : undefined}
                  />
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                    {t("schedule_staff_timeline_title")}
                  </p>
                  <div className="mt-3 space-y-2">
                    {todayEventsQ.isError ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{t("schedule_load_failed")}</p>
                      </div>
                    ) : todayEventsQ.isLoading ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{t("schedule_loading_today")}</p>
                      </div>
                    ) : (todayEventsQ.data?.length ?? 0) === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{t("schedule_empty_today_sessions")}</p>
                      </div>
                    ) : (
                      (todayEventsQ.data ?? []).map((ev) => (
                        <SessionRow
                          key={ev.id}
                          sessionType={ev.session_type}
                          title={sessionDisplayTitle(ev, t)}
                          subtitle={`${formatTimeRange(ev.starts_at, ev.ends_at)}${ev.location ? ` · ${ev.location}` : ""}`}
                          onClick={() => openSessionDetail(ev)}
                          right={
                            canCreateSession ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    aria-label={t("more")}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => duplicateInOneTap(ev)}>
                                    <Copy className="w-4 h-4" />
                                    {t("schedule_duplicate_one_tap")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => saveSessionAsTemplate(ev)}>
                                    <Copy className="w-4 h-4" />
                                    {t("schedule_template_save")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => startEditing(ev)}>
                                    <Pencil className="w-4 h-4" />
                                    {t("schedule_edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setCancelTarget(ev)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t("schedule_cancel_session")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Offscreen render target for week export image */}
          {canExportWeekImage ? (
            <div className="fixed left-[-99999px] top-0 pointer-events-none opacity-0">
              <div
                ref={exportNodeRef}
                style={{
                  width: 1080,
                  background: "#ffffff",
                  color: "#0a0a0a",
                  padding: 48,
                  fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
                      {clubQ.data?.club?.name || "My Club"}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 16, fontWeight: 600, color: "#4b5563" }}>
                      {fmtWeekRange(selectedWeekStart)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 1.4,
                    }}
                  >
                    {t("ucore_card_schedule_title")}
                  </div>
                </div>

                <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb" }} />

                {/* Grid header */}
                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "140px repeat(7, 1fr)", gap: 12 }}>
                  <div />
                  {days.map((d) => {
                    const dayKey = localDateKey(d);
                    const dayLabel = new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d);
                    const dateLabel = new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(d);
                    return (
                      <div key={dayKey} style={{ padding: "8px 10px" }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{dayLabel}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>{dateLabel}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Slots */}
                <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10 }}>
                    {slotDefs.map((s) => (
                      <div
                        key={s.key}
                        style={{
                          height: 140,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#111827",
                        }}
                      >
                        {t(s.labelKey as any)}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
                    {days.map((d) => {
                      const dayKey = localDateKey(d);
                      const daySessions = (plannerWeekQ.data ?? [])
                        .filter((ev) => localDateKey(new Date(ev.starts_at)) === dayKey)
                        .slice()
                        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

                      const buckets: Record<(typeof slotDefs)[number]["key"], ScheduleEvent[]> = {
                        morning: [],
                        midday: [],
                        evening: [],
                      };
                      for (const ev of daySessions) {
                        const h = new Date(ev.starts_at).getHours();
                        if (h < 12) buckets.morning.push(ev);
                        else if (h < 18) buckets.midday.push(ev);
                        else buckets.evening.push(ev);
                      }

                      return (
                        <div key={dayKey} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {slotDefs.map((s) => {
                            const list = buckets[s.key];
                            return (
                              <div
                                key={s.key}
                                style={{
                                  minHeight: 140,
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 14,
                                  padding: 10,
                                  background: "#ffffff",
                                  boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
                                }}
                              >
                                {list.length === 0 ? (
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", paddingTop: 4 }}>
                                    —
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {list.slice(0, 4).map((ev) => (
                                      <div
                                        key={ev.id}
                                        style={{
                                          borderRadius: 12,
                                          padding: "8px 10px",
                                          background: "#f9fafb",
                                          border: "1px solid #eef2f7",
                                        }}
                                      >
                                        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>
                                          {sessionDisplayTitle(ev, t)}
                                        </div>
                                        <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
                                          {formatTime(ev.starts_at)}
                                          {ev.location ? ` · ${ev.location}` : ""}
                                        </div>
                                      </div>
                                    ))}
                                    {list.length > 4 ? (
                                      <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280" }}>
                                        +{list.length - 4}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>
                    {new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "short", day: "numeric" }).format(new Date())}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af" }}>U Core</div>
                </div>
              </div>
            </div>
          ) : null}

          <TabsContent value="wellness" className="mt-4 space-y-4 md:mt-6 md:space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-black tracking-tight text-foreground">{t("wellness_title")}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {isPlayer ? t("wellness_subtitle") : t("wellness_staff_subtitle")}
              </p>

              {!wellnessHintDismissed ? (
                <div className="mt-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {isPlayer ? t("onboarding_player_wellness_hint" as any) : t("onboarding_staff_wellness_hint" as any)}
                  </p>
                  <button
                    type="button"
                    className="h-9 w-9 -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    onClick={dismissWellnessHint}
                    aria-label={t("dismiss" as any)}
                    title={t("dismiss" as any)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null}

              {!isPlayer ? (
                <Suspense fallback={<div className="mt-4 text-sm text-muted-foreground">{t("wellness_loading_today")}</div>}>
                  <WellnessStaffTab
                    clubId={clubId}
                    rosterPlayers={rosterPlayers}
                    weekEvents={weekEventsQ.data ?? []}
                    t={t}
                  />
                </Suspense>
              ) : showLocalWellness ? (
                <WellnessEntryForm
                  t={t}
                  sleepQuality={sleepQuality}
                  onSleepQualityChange={(v) => {
                    setLocalSaved(false);
                    setSleepQuality(v);
                  }}
                  energyLevel={energyLevel}
                  onEnergyLevelChange={(v) => {
                    setLocalSaved(false);
                    setEnergyLevel(v);
                  }}
                  muscleSoreness={muscleSoreness}
                  onMuscleSorenessChange={(v) => {
                    setLocalSaved(false);
                    setMuscleSoreness(v);
                  }}
                  mentalReadiness={mentalReadiness}
                  onMentalReadinessChange={(v) => {
                    setLocalSaved(false);
                    setMentalReadiness(v);
                  }}
                  saveDisabled={!wellnessComplete}
                  saveLabel={localSaved ? t("wellness_saved_local_cta") : t("wellness_save_local")}
                  saveTestId="wellness-submit-local"
                  onSave={() => {
                    try {
                      window.localStorage.setItem(
                        localKey,
                        JSON.stringify({
                          sleep_quality: Number(sleepQuality),
                          energy_level: Number(energyLevel),
                          muscle_soreness: Number(muscleSoreness),
                          mental_readiness: Number(mentalReadiness),
                          saved_at: new Date().toISOString(),
                        }),
                      );
                    } catch {
                      // ignore
                    }
                    setLocalSaved(true);
                    toast({ description: t("wellness_saved_local") });
                  }}
                  footNote={t("wellness_local_note")}
                />
              ) : entryQ.isLoading ? (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-muted-foreground">{t("wellness_loading_today")}</p>
                </div>
              ) : submittedToday && !wellnessEditing ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-xs font-bold text-foreground">{t("wellness_submitted_today")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("wellness_entry_date_label").replace("{date}", entryDate)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric label={t("wellness_metric_sleep" as any)} value={entryQ.data!.sleep_quality} />
                      <Metric label={t("wellness_metric_energy" as any)} value={entryQ.data!.energy_level} />
                      <Metric label={t("wellness_metric_soreness" as any)} value={entryQ.data!.muscle_soreness} />
                      <Metric label={t("wellness_metric_readiness" as any)} value={entryQ.data!.mental_readiness} />
                    </div>
                    <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <p className="text-sm font-semibold text-foreground">{t("wellness_completed_title" as any)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t("wellness_completed_subtitle" as any)}</p>
                    </div>
                  </div>

                  {entryQ.data && playerBaseline ? (
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                        {t("wellness_baseline_title" as any)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {t("wellness_baseline_subtitle" as any).replace("{n}", String(playerBaseline.n))}
                      </p>
                      <Suspense fallback={null}>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { key: "sleep", label: t("wellness_metric_sleep" as any), today: entryQ.data.sleep_quality, base: playerBaseline.sleep, goodUp: true },
                          { key: "energy", label: t("wellness_metric_energy" as any), today: entryQ.data.energy_level, base: playerBaseline.energy, goodUp: true },
                          { key: "soreness", label: t("wellness_metric_soreness" as any), today: entryQ.data.muscle_soreness, base: playerBaseline.soreness, goodUp: true },
                          { key: "readiness", label: t("wellness_metric_readiness" as any), today: entryQ.data.mental_readiness, base: playerBaseline.readiness, goodUp: true },
                        ].map((x) => {
                          const delta = x.today - x.base;
                          const dirGood = x.goodUp ? delta >= 0 : delta <= 0;
                          const deltaTxt = `${delta >= 0 ? "+" : ""}${(Math.round(delta * 10) / 10).toFixed(1)}`;
                          return (
                            <div key={x.key} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground truncate">{x.label}</p>
                              <div className="mt-1 flex items-baseline justify-between gap-2">
                                <p className="text-lg font-black text-foreground">{x.today}</p>
                                <p
                                  className={[
                                    "text-xs font-bold",
                                    dirGood ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                                  ].join(" ")}
                                >
                                  {t("wellness_vs_baseline" as any).replace("{delta}", deltaTxt)}
                                </p>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {t("wellness_baseline_value" as any).replace("{v}", String(Math.round(x.base * 10) / 10))}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                        </Suspense>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                        {t("wellness_trends_title" as any)}
                      </p>
                      <ToggleGroup
                        type="single"
                        value={wellnessTrendRange}
                        onValueChange={(v) => setWellnessTrendRange((v as any) || "7d")}
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
                    <div className="mt-3 space-y-3">
                      {(() => {
                        const q = wellnessTrendRange === "7d" ? last7Q : last30Q;
                        const entries = q.data ?? [];
                        const series = (
                          field: keyof Pick<WellnessEntry, "sleep_quality" | "energy_level" | "muscle_soreness" | "mental_readiness">,
                        ) =>
                          entries.map((e) => ({
                            date: e.entry_date,
                            value: typeof e[field] === "number" && Number.isFinite(e[field]) ? e[field] : null,
                          }));
                        return q.isLoading ? (
                          <p className="text-sm text-muted-foreground">{t("wellness_loading_today")}</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_sleep" as any)}</p>
                              <div className="mt-1">
                                <WellnessTrendChart points={series("sleep_quality")} goodUp color="#3b82f6" />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_energy" as any)}</p>
                              <div className="mt-1">
                                <WellnessTrendChart points={series("energy_level")} goodUp color="#f59e0b" />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_soreness" as any)}</p>
                              <div className="mt-1">
                                <WellnessTrendChart points={series("muscle_soreness")} goodUp color="#A78BFA" />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_readiness" as any)}</p>
                              <div className="mt-1">
                                <WellnessTrendChart points={series("mental_readiness")} goodUp color="#10b981" />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setFromEntry(entryQ.data!);
                      setWellnessEditing(true);
                    }}
                    data-testid="wellness-edit"
                  >
                    {t("wellness_edit")}
                  </Button>

                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                    <p className="text-sm font-extrabold text-foreground">{t("wellness_done_title" as any)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{t("wellness_done_subtitle" as any)}</p>
                  </div>
                </div>
              ) : (
                <WellnessEntryForm
                  t={t}
                  sleepQuality={sleepQuality}
                  onSleepQualityChange={setSleepQuality}
                  energyLevel={energyLevel}
                  onEnergyLevelChange={setEnergyLevel}
                  muscleSoreness={muscleSoreness}
                  onMuscleSorenessChange={setMuscleSoreness}
                  mentalReadiness={mentalReadiness}
                  onMentalReadinessChange={setMentalReadiness}
                  disabled={upsert.isPending}
                  saveDisabled={!wellnessComplete || upsert.isPending || !clubId || !userId}
                  saveLabel={upsert.isPending ? t("saving") : t("wellness_submit")}
                  saveTestId="wellness-submit"
                  onSave={() => {
                    if (!clubId || !userId) return;
                    void upsert.mutateAsync({
                      club_id: clubId,
                      user_id: userId,
                      entry_date: entryDate,
                      sleep_quality: Number(sleepQuality),
                      energy_level: Number(energyLevel),
                      muscle_soreness: Number(muscleSoreness),
                      mental_readiness: Number(mentalReadiness),
                    }).then(() => {
                      toast({ description: t("wellness_saved") });
                      setWellnessEditing(false);
                    }).catch(() => {
                      toast({ variant: "destructive", description: t("wellness_save_error") });
                    });
                  }}
                  onCancel={
                    submittedToday && wellnessEditing
                      ? () => {
                          setWellnessEditing(false);
                          setSleepQuality("");
                          setEnergyLevel("");
                          setMuscleSoreness("");
                          setMentalReadiness("");
                        }
                      : undefined
                  }
                  footNote={backendAvailable ? t("wellness_persistence_note") : undefined}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {createOpen ? (
        <Suspense fallback={null}>
          <SessionCreateDialog
            isOpen={createOpen}
            onClose={() => {
              setCreateOpen(false);
              setEditingSessionId(null);
              setEditingSessionEvent(null);
            }}
            isEditing={isEditing}
            editingSessionId={editingSessionId}
            form={form}
            clubId={clubId}
            userId={userId}
            rosterPlayers={rosterPlayers}
            createEventMut={createEventMut}
            updateEventMut={updateEventMut}
            pushRecentLocation={pushRecentLocation}
            onDelete={
              editingSessionEvent
                ? () => {
                    const ev = editingSessionEvent;
                    setCreateOpen(false);
                    setEditingSessionId(null);
                    setEditingSessionEvent(null);
                    setCancelTarget(ev);
                  }
                : undefined
            }
            t={t}
            locale={locale}
          />
        </Suspense>
      ) : null}

      <Dialog
        open={!isDesktop && sessionDetailEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSessionDetailEvent(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-8">{sessionDetailEvent?.title ?? ""}</DialogTitle>
          </DialogHeader>
          {sessionDetailEvent ? (
            <ScheduleSessionDetailBody
              event={sessionDetailEvent}
              intlLocale={intlLocale}
              t={t}
              readConstraintsFromNotes={readConstraintsFromNotes}
            />
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSessionDetailEvent(null)}>
              {t("close")}
            </Button>
            {canCreateSession && sessionDetailEvent ? (
              <Button
                onClick={() => {
                  const ev = sessionDetailEvent;
                  setSessionDetailEvent(null);
                  startEditing(ev);
                }}
              >
                {t("schedule_edit")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_cancel_session_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("schedule_cancel_session_body")}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{t("close")}</Button>
            <Button
              variant="destructive"
              disabled={!clubId || !cancelTarget || deleteEventMut.isPending}
              onClick={() => {
                if (!clubId || !cancelTarget) return;
                void deleteEventMut
                  .mutateAsync({ id: cancelTarget.id, club_id: clubId })
                  .then(() => {
                    toast({ description: t("schedule_cancel_session_done") });
                    setCancelTarget(null);
                  })
                  .catch(() => toast({ variant: "destructive", description: t("schedule_cancel_session_error") }));
              }}
            >
              {deleteEventMut.isPending ? t("saving") : t("schedule_cancel_session_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={repeatWeekPlanOpen} onOpenChange={setRepeatWeekPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_repeat_week_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("schedule_repeat_week_body")}</p>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">{t("schedule_repeat_weeks")}</p>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={repeatWeekPlanWeeks}
                onChange={(e) => {
                  const w = Number(e.target.value) as any;
                  setRepeatWeekPlanWeeks(w);
                  setRepeatWeekPlanSelected(new Set(Array.from({ length: w }).map((_, i) => i + 1)));
                }}
              >
                {[1, 2, 3, 4, 6, 8].map((w) => (
                  <option key={w} value={w}>
                    {t("schedule_repeat_weeks_value").replace("{weeks}", String(w))}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground">{t("schedule_repeat_week_skip_hint")}</p>
              <div className="mt-2 space-y-2">
                {Array.from({ length: repeatWeekPlanWeeks }).map((_, i) => {
                  const offset = i + 1;
                  const start = new Date(selectedWeekStart);
                  start.setDate(start.getDate() + offset * 7);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 6);
                  const label = `${new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(start)}–${new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(end)}`;
                  const checked = repeatWeekPlanSelected.has(offset);
                  return (
                    <label key={offset} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-foreground">
                        {t("schedule_week_offset").replace("{n}", String(offset))} · {label}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setRepeatWeekPlanSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(offset);
                            else next.delete(offset);
                            return next;
                          });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRepeatWeekPlanOpen(false)}>
              {t("close")}
            </Button>
            <Button
              disabled={
                !clubId ||
                !userId ||
                (plannerWeekQ.data?.length ?? 0) === 0 ||
                repeatWeekPlanSelected.size === 0 ||
                createEventMut.isPending
              }
              onClick={() => {
                const offsets = Array.from(repeatWeekPlanSelected).sort((a, b) => a - b);
                void repeatThisWeek(offsets).finally(() => setRepeatWeekPlanOpen(false));
              }}
            >
              {t("schedule_repeat_week_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearWeekOpen} onOpenChange={setClearWeekOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_clear_week_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("schedule_clear_week_body")}</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearWeekOpen(false)}>
              {t("close")}
            </Button>
            <Button
              variant="destructive"
              disabled={!clubId || (plannerWeekQ.data?.length ?? 0) === 0 || deleteEventMut.isPending}
              onClick={() => {
                void clearCurrentWeek().finally(() => setClearWeekOpen(false));
              }}
            >
              {t("schedule_clear_week_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={weekTemplatesOpen} onOpenChange={setWeekTemplatesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_week_templates")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <input
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={weekTemplateSearch}
                onChange={(e) => setWeekTemplateSearch(e.target.value)}
                placeholder={t("schedule_template_search" as any)}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={weekTemplateFavOnly ? "secondary" : "outline"}
                    className="h-9"
                    onClick={() => setWeekTemplateFavOnly((v) => !v)}
                  >
                    {t("schedule_favorites" as any)}
                  </Button>
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    value={weekTemplatePhase}
                    onChange={(e) => setWeekTemplatePhase((e.target.value as any) || "all")}
                  >
                    <option value="all">{t("schedule_filter_all" as any)}</option>
                    <option value="preseason">{t("schedule_phase_preseason" as any)}</option>
                    <option value="regular">{t("schedule_phase_regular" as any)}</option>
                    <option value="playoff">{t("schedule_phase_playoff" as any)}</option>
                    <option value="off">{t("schedule_phase_off" as any)}</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    value={weekTemplateGames}
                    onChange={(e) => setWeekTemplateGames((e.target.value === "all" ? "all" : Number(e.target.value)) as any)}
                  >
                    <option value="all">{t("schedule_games_any" as any)}</option>
                    <option value="0">{t("schedule_games_0" as any)}</option>
                    <option value="1">{t("schedule_games_1" as any)}</option>
                    <option value="2">{t("schedule_games_2" as any)}</option>
                  </select>
                  <div className="relative">
                    <SlidersHorizontal className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <select
                      className="h-9 rounded-md border border-border bg-background pl-7 pr-2 text-sm"
                      value={weekTemplateLoad}
                      onChange={(e) => setWeekTemplateLoad((e.target.value as any) || "all")}
                      aria-label={t("schedule_load_any" as any)}
                    >
                      <option value="all">{t("schedule_load_any" as any)}</option>
                      <option value="low">{t("schedule_load_low" as any)}</option>
                      <option value="medium">{t("schedule_load_medium" as any)}</option>
                      <option value="high">{t("schedule_load_high" as any)}</option>
                    </select>
                  </div>
                </div>
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={weekTemplateSort}
                  onChange={(e) => setWeekTemplateSort((e.target.value as any) || "recent")}
                >
                  <option value="recent">{t("schedule_sort_recent" as any)}</option>
                  <option value="alpha">{t("schedule_sort_alpha" as any)}</option>
                </select>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!clubId || (plannerWeekQ.data?.length ?? 0) === 0}
              onClick={() => {
                setEditingWeekTemplateId(null);
                setWeekTemplateName("");
                setWeekTemplateNotes("");
                            setWeekTemplateFavorite(false);
                            setWeekTemplateEditPhase("regular");
                            setWeekTemplateEditLoad("medium");
                            setWeekTemplateEditGames(0);
                            setWeekTemplateEditTags("");
                setSaveWeekTemplateOpen(true);
              }}
            >
              {t("schedule_week_template_save")}
            </Button>

            {(plannerWeekQ.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">{t("schedule_week_template_save_empty_hint")}</p>
            ) : null}

            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                {t("schedule_templates")}
              </p>
              {weekTemplatesSorted.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("schedule_week_template_empty")}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {weekTemplatesSorted.slice(0, 10).map((tpl) => (
                    <div key={tpl.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-foreground truncate">{tpl.name}</p>
                        <p className="text-xs font-semibold text-muted-foreground truncate">
                          {t("schedule_week_template_sessions").replace("{count}", String(tpl.sessions.length))}
                          {tpl.lastUsedAt ? ` · ${t("schedule_week_template_last_used")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <button
                          type="button"
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          aria-label={t("schedule_favorite_toggle" as any)}
                          onClick={() => {
                            if (!clubId) return;
                            updateWeekTemplateMut.mutate({ id: tpl.id, clubId, favorite: !tpl.favorite });
                          }}
                        >
                          <span className="text-base leading-none">{tpl.favorite ? "★" : "☆"}</span>
                        </button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9"
                          disabled={!clubId || !userId}
                          onClick={() => {
                            setApplyTargetTemplateId(tpl.id);
                            setApplyWeekTemplateOpen(true);
                          }}
                        >
                          {t("schedule_week_template_load")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          onClick={() => {
                            setEditingWeekTemplateId(tpl.id);
                            setWeekTemplateName(tpl.name);
                            setWeekTemplateNotes(tpl.notes ?? "");
                            setWeekTemplateFavorite(Boolean(tpl.favorite));
                            setWeekTemplateEditPhase((tpl.phase ?? "regular") as any);
                            setWeekTemplateEditLoad((tpl.load_level ?? "medium") as any);
                            setWeekTemplateEditGames((tpl.games_count ?? 0) as any);
                            setWeekTemplateEditTags(tpl.tags ?? "");
                            setSaveWeekTemplateOpen(true);
                          }}
                        >
                          {t("edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          onClick={() => duplicateWeekTemplate(tpl)}
                        >
                          {t("schedule_week_template_duplicate")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-destructive border-destructive/30"
                          onClick={() => deleteWeekTemplate(tpl.id)}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setWeekTemplatesOpen(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveWeekTemplateOpen} onOpenChange={setSaveWeekTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingWeekTemplateId ? t("schedule_week_template_edit") : t("schedule_week_template_save_title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("club_name_label")}</p>
              <input
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={weekTemplateName}
                onChange={(e) => setWeekTemplateName(e.target.value)}
                placeholder={t("schedule_week_template_name_placeholder" as any)}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_session_notes")}</p>
              <textarea
                className="w-full min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={weekTemplateNotes}
                onChange={(e) => setWeekTemplateNotes(e.target.value)}
                placeholder={t("schedule_week_template_notes_placeholder" as any)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_phase" as any)}</p>
                <select
                  className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
                  value={weekTemplateEditPhase as any}
                  onChange={(e) => setWeekTemplateEditPhase(e.target.value as any)}
                >
                  <option value="preseason">{t("schedule_phase_preseason" as any)}</option>
                  <option value="regular">{t("schedule_phase_regular" as any)}</option>
                  <option value="playoff">{t("schedule_phase_playoff" as any)}</option>
                  <option value="off">{t("schedule_phase_off" as any)}</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_load_level" as any)}</p>
                <select
                  className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
                  value={weekTemplateEditLoad}
                  onChange={(e) => setWeekTemplateEditLoad(e.target.value as any)}
                >
                  <option value="low">{t("schedule_load_low" as any)}</option>
                  <option value="medium">{t("schedule_load_medium" as any)}</option>
                  <option value="high">{t("schedule_load_high" as any)}</option>
                </select>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
              <span className="font-semibold text-foreground">{t("schedule_favorites" as any)}</span>
              <input type="checkbox" checked={weekTemplateFavorite} onChange={(e) => setWeekTemplateFavorite(e.target.checked)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_games_count" as any)}</p>
                <select
                  className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
                  value={String(weekTemplateEditGames)}
                  onChange={(e) => setWeekTemplateEditGames(Number(e.target.value) as any)}
                >
                  <option value="0">{t("schedule_games_0" as any)}</option>
                  <option value="1">{t("schedule_games_1" as any)}</option>
                  <option value="2">{t("schedule_games_2" as any)}</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_tags" as any)}</p>
                <input
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={weekTemplateEditTags}
                  onChange={(e) => setWeekTemplateEditTags(e.target.value)}
                  placeholder={t("schedule_tags_placeholder" as any)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveWeekTemplateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!weekTemplateName.trim() || (plannerWeekQ.data?.length ?? 0) === 0 || createWeekTemplateMut.isPending || updateWeekTemplateMut.isPending}
              onClick={() => {
                if (!clubId) return;
                const sessions = buildWeekTemplateFromCurrentWeek();
                const basePayload = {
                  name: weekTemplateName.trim(),
                  notes: weekTemplateNotes.trim() ? weekTemplateNotes.trim() : null,
                  phase: weekTemplateEditPhase,
                  games_count: weekTemplateEditGames,
                  load_level: weekTemplateEditLoad,
                  tags: weekTemplateEditTags,
                  favorite: weekTemplateFavorite,
                };
                if (editingWeekTemplateId) {
                  // Al editar solo metadatos (sin sesiones nuevas capturadas en la
                  // semana visible), no se toca `sessions` -- si no, editar el
                  // nombre/etiquetas de un template mientras se mira una semana
                  // vacia borraria las sesiones guardadas del template.
                  updateWeekTemplateMut.mutate(
                    { id: editingWeekTemplateId, clubId, ...basePayload, ...(sessions.length > 0 ? { sessions } : {}) },
                    { onSuccess: () => toast({ description: t("schedule_week_template_saved") }) },
                  );
                } else {
                  createWeekTemplateMut.mutate(
                    { ...basePayload, sessions },
                    { onSuccess: () => toast({ description: t("schedule_week_template_saved") }) },
                  );
                }
                setSaveWeekTemplateOpen(false);
              }}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyWeekTemplateOpen} onOpenChange={setApplyWeekTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_week_template_load")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("schedule_week_template_load_body")}</p>

          {(() => {
            const tpl = weekTemplates.find((x) => x.id === applyTargetTemplateId);
            if (!tpl) return null;
            const byDay = Array.from({ length: 7 }).map((_, i) => tpl.sessions.filter((s) => s.dayIndex === i).sort((a, b) => a.startMins - b.startMins));
            return (
              <div className="mt-4 rounded-xl border border-border bg-card p-3">
                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                  {t("schedule_template_preview" as any)}
                </p>
                <div className="mt-2 space-y-2">
                  {byDay.map((list, i) => {
                    const day = new Date(selectedWeekStart);
                    day.setDate(day.getDate() + i);
                    const label = new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(day);
                    return (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <p className="text-xs font-black text-foreground w-12 shrink-0">{label}</p>
                        {list.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("schedule_template_preview_empty" as any)}</p>
                        ) : (
                          <div className="min-w-0 flex-1 space-y-1">
                            {list.slice(0, 4).map((s, idx) => (
                              <p key={idx} className="text-xs font-semibold text-muted-foreground truncate">
                                {minutesToHHMM(s.startMins)} · {sessionDisplayTitle(s, t)}
                              </p>
                            ))}
                            {list.length > 4 ? (
                              <p className="text-xs font-semibold text-muted-foreground">
                                {t("schedule_template_preview_more" as any).replace("{count}", String(list.length - 4))}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApplyWeekTemplateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="secondary"
              disabled={!applyTargetTemplateId || !clubId || !userId}
              onClick={() => {
                const tpl = weekTemplates.find((x) => x.id === applyTargetTemplateId);
                if (!tpl) return;
                void applyWeekTemplate(tpl, "merge").finally(() => setApplyWeekTemplateOpen(false));
              }}
            >
              {t("schedule_week_template_merge")}
            </Button>
            <Button
              disabled={!applyTargetTemplateId || !clubId || !userId}
              onClick={() => {
                const tpl = weekTemplates.find((x) => x.id === applyTargetTemplateId);
                if (!tpl) return;
                void applyWeekTemplate(tpl, "replace").finally(() => setApplyWeekTemplateOpen(false));
              }}
            >
              {t("schedule_week_template_replace")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupAssignOpen} onOpenChange={setGroupAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_assign_players" as any)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {rosterPlayers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                <p className="text-sm font-medium text-muted-foreground">{t("schedule_no_roster_players")}</p>
              </div>
            ) : (
              (() => {
                const n = Math.max(2, Math.min(6, Number(groupsCount) || 2));
                const sorted = [...rosterPlayers].sort((a, b) => {
                  const la = ((a as any).fullName ?? (a as any).full_name ?? (a as any).email ?? a.userId) as string;
                  const lb = ((b as any).fullName ?? (b as any).full_name ?? (b as any).email ?? b.userId) as string;
                  const ga = typeof coachGroupAssignments[a.userId] === "number" ? coachGroupAssignments[a.userId] : 999;
                  const gb = typeof coachGroupAssignments[b.userId] === "number" ? coachGroupAssignments[b.userId] : 999;
                  if (ga !== gb) return ga - gb;
                  return la.localeCompare(lb);
                });

                const groups = Array.from({ length: n }).map((_, idx) => idx);
                const inGroup = (idx: number) => sorted.filter((m) => coachGroupAssignments[m.userId] === idx);
                const unassigned = sorted.filter((m) => typeof coachGroupAssignments[m.userId] !== "number");

                const PlayerRow = (m: (typeof sorted)[number]) => {
                  const label = ((m as any).fullName ?? (m as any).full_name ?? (m as any).email ?? m.userId) as string;
                  const current = typeof coachGroupAssignments[m.userId] === "number" ? coachGroupAssignments[m.userId] : -1;
                  return (
                    <div key={m.userId} className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate min-w-0 flex-1">{label}</p>
                      <div className="flex gap-1 shrink-0">
                        {groups.map((idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={[
                              "h-9 w-8 rounded-md border text-xs font-black transition-colors",
                              current === idx
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background/40 text-muted-foreground hover:bg-muted/40",
                            ].join(" ")}
                            onClick={() => {
                              setCoachGroupAssignments((prev) => {
                                const next = { ...prev };
                                next[m.userId] = idx;
                                return next;
                              });
                            }}
                            aria-label={`${t("schedule_assign_group")} ${String.fromCharCode(65 + idx)}`}
                            title={`${t("schedule_assign_group")} ${String.fromCharCode(65 + idx)}`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-3 max-h-[60dvh] overflow-y-auto pr-1">
                    <div className="rounded-xl border border-border bg-background/40 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">{t("schedule_unassigned" as any)}</p>
                      <div className="mt-2 space-y-2">
                        {unassigned.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("schedule_none" as any)}</p>
                        ) : (
                          unassigned.map(PlayerRow)
                        )}
                      </div>
                    </div>
                    {groups.map((idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-background/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {t("schedule_group_label" as any).replace("{group}", String.fromCharCode(65 + idx))}
                          </p>
                          <p className="text-xs font-semibold text-muted-foreground">{inGroup(idx).length}</p>
                        </div>
                        <div className="mt-2 space-y-2">{inGroup(idx).map(PlayerRow)}</div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={choosePlayersOpen} onOpenChange={setChoosePlayersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("schedule_choose_players" as any)}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-background/40 p-3 max-h-[60dvh] overflow-y-auto space-y-2">
            {rosterPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("schedule_no_roster_players")}</p>
            ) : (
              rosterPlayers
                .slice()
                .sort((a, b) => {
                  const la = ((a as any).fullName ?? (a as any).full_name ?? (a as any).email ?? a.userId) as string;
                  const lb = ((b as any).fullName ?? (b as any).full_name ?? (b as any).email ?? b.userId) as string;
                  return la.localeCompare(lb);
                })
                .map((m) => {
                  const checked = selectedPlayerIds.has(m.userId);
                  const label = ((m as any).fullName ?? (m as any).full_name ?? (m as any).email ?? m.userId) as string;
                  return (
                    <label key={m.userId} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectedPlayerIds((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(m.userId);
                            else next.delete(m.userId);
                            return next;
                          });
                        }}
                      />
                    </label>
                  );
                })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoosePlayersOpen(false)}>
              {t("close")}
            </Button>
            <Button onClick={() => setChoosePlayersOpen(false)}>{t("apply" as any)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePageShell>
  );
}

function WellnessRow(props: {
  label: string;
  tooltip?: string;
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  goodUp?: boolean;
}) {
  const goodUp = props.goodUp ?? true;
  const COLOR_MAP_UP: Record<string, string> = {
    "1": "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400 data-[state=on]:bg-red-500 data-[state=on]:text-white data-[state=on]:border-red-500",
    "2": "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 data-[state=on]:bg-orange-500 data-[state=on]:text-white data-[state=on]:border-orange-500",
    "3": "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 data-[state=on]:bg-yellow-500 data-[state=on]:text-white data-[state=on]:border-yellow-500",
    "4": "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500",
    "5": "border-emerald-600/50 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:border-emerald-600",
  };
  const COLOR_MAP_DOWN: Record<string, string> = {
    "1": "border-emerald-600/50 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:border-emerald-600",
    "2": "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500",
    "3": "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 data-[state=on]:bg-yellow-500 data-[state=on]:text-white data-[state=on]:border-yellow-500",
    "4": "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 data-[state=on]:bg-orange-500 data-[state=on]:text-white data-[state=on]:border-orange-500",
    "5": "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400 data-[state=on]:bg-red-500 data-[state=on]:text-white data-[state=on]:border-red-500",
  };
  const colorMap = goodUp ? COLOR_MAP_UP : COLOR_MAP_DOWN;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black tracking-tight text-foreground">{props.label}</p>
          {props.tooltip ? (
            <span className="inline-flex items-center text-muted-foreground" title={props.tooltip} aria-label={props.tooltip}>
              <Info className="w-3.5 h-3.5" />
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{props.value ? `${props.value}/5` : "—"}</p>
      </div>
      <ToggleGroup
        type="single"
        value={props.value}
        onValueChange={(v) => props.onValueChange(v || "")}
        className="justify-end gap-1"
        disabled={props.disabled}
      >
        {["1", "2", "3", "4", "5"].map((n) => (
          <ToggleGroupItem
            key={n}
            value={n}
            size="sm"
            variant="outline"
            className={[
              "h-10 w-10 px-0 text-sm font-black rounded-xl border transition-all duration-150",
              colorMap[n],
            ].join(" ")}
          >
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function WellnessEntryForm(props: {
  t: (key: I18nKey) => string;
  sleepQuality: string;
  onSleepQualityChange: (v: string) => void;
  energyLevel: string;
  onEnergyLevelChange: (v: string) => void;
  muscleSoreness: string;
  onMuscleSorenessChange: (v: string) => void;
  mentalReadiness: string;
  onMentalReadinessChange: (v: string) => void;
  disabled?: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  saveLabel: string;
  saveTestId?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  footNote?: string;
}) {
  const { t } = props;
  return (
    <>
      <div className="mt-4 space-y-4">
        <WellnessRow
          label={t("wellness_metric_sleep" as any)}
          tooltip={t("wellness_tooltip_sleep" as any)}
          value={props.sleepQuality}
          goodUp
          onValueChange={props.onSleepQualityChange}
          disabled={props.disabled}
        />
        <WellnessRow
          label={t("wellness_metric_energy" as any)}
          tooltip={t("wellness_tooltip_energy" as any)}
          value={props.energyLevel}
          goodUp
          onValueChange={props.onEnergyLevelChange}
          disabled={props.disabled}
        />
        <WellnessRow
          label={t("wellness_metric_soreness" as any)}
          tooltip={t("wellness_tooltip_soreness" as any)}
          value={props.muscleSoreness}
          goodUp
          onValueChange={props.onMuscleSorenessChange}
          disabled={props.disabled}
        />
        <WellnessRow
          label={t("wellness_metric_readiness" as any)}
          tooltip={t("wellness_tooltip_readiness" as any)}
          value={props.mentalReadiness}
          goodUp
          onValueChange={props.onMentalReadinessChange}
          disabled={props.disabled}
        />
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          className="flex-1"
          disabled={props.saveDisabled}
          onClick={props.onSave}
          data-testid={props.saveTestId ?? "wellness-submit"}
        >
          {props.saveLabel}
        </Button>
        {props.onCancel ? (
          <Button variant="outline" onClick={props.onCancel}>
            {props.cancelLabel ?? t("cancel")}
          </Button>
        ) : null}
      </div>

      {props.footNote ? <p className="mt-2 text-xs text-muted-foreground">{props.footNote}</p> : null}
    </>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground truncate">{props.label}</p>
      <p className="mt-1 text-lg font-black text-foreground">{props.value}</p>
    </div>
  );
}

function SparklineBars(props: {
  values: Array<number | null>;
  height?: number;
  goodUp?: boolean;
}) {
  const h = props.height ?? 30;
  const finite = props.values.filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  const span = max - min || 1;
  const first = (props.values.find((v) => typeof v === "number" && Number.isFinite(v)) ?? null) as number | null;
  const last = ([...props.values].reverse().find((v) => typeof v === "number" && Number.isFinite(v)) ?? null) as number | null;
  const delta = typeof first === "number" && typeof last === "number" ? last - first : 0;
  const goodUp = props.goodUp ?? true;
  const trendGood = goodUp ? delta >= 0 : delta <= 0;
  const baseColor = trendGood ? "bg-emerald-600/75 dark:bg-emerald-400/70" : "bg-amber-600/75 dark:bg-amber-400/70";
  const lastColor = trendGood ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-600 dark:bg-amber-400";
  return (
    <div className="flex items-end gap-1" style={{ height: h }}>
      {props.values.map((v, idx) => {
        const pct = typeof v === "number" && Number.isFinite(v) ? (v - min) / span : 0;
        const barH = Math.max(2, Math.round(pct * (h - 2)));
        const isLast = idx === props.values.length - 1;
        return (
          <div
            key={idx}
            className={
              typeof v === "number"
                ? `w-2.5 rounded-sm ${isLast ? lastColor : baseColor}`
                : "w-2.5 rounded-sm bg-muted/35"
            }
            style={{ height: barH }}
            title={typeof v === "number" ? String(Math.round(v * 10) / 10) : "—"}
          />
        );
      })}
    </div>
  );
}

type ScheduleConstraintsReader = (notes: string | null | undefined) => {
  notesClean: string | null;
  constraints: Record<string, unknown>;
};

function ScheduleSessionDetailBody(props: {
  event: ScheduleEvent;
  intlLocale: string;
  t: (key: I18nKey) => string;
  readConstraintsFromNotes: ScheduleConstraintsReader;
}) {
  const { event, intlLocale, t, readConstraintsFromNotes } = props;
  return (
    <div className="space-y-3 text-sm">
      <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs font-bold text-foreground">
        {t(ACTIVITY_TYPE_CONFIG[event.session_type].labelKey)}
      </span>
      <p className="text-muted-foreground font-medium">
        {new Intl.DateTimeFormat(intlLocale, { weekday: "long", month: "short", day: "numeric", timeZone: CLUB_TIME_ZONE }).format(
          new Date(event.starts_at),
        )}
        {" · "}
        {formatTime(event.starts_at)}
        {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ""}
      </p>
      {event.location?.trim() ? (
        <p className="text-foreground font-semibold">{event.location}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("schedule_location_tbd")}</p>
      )}
      {(() => {
        const detailNotes = readConstraintsFromNotes(event.notes ?? null).notesClean?.trim();
        return detailNotes ? (
          <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{detailNotes}</p>
        ) : null;
      })()}
      {event.attendance_required !== false ? (
        <p className="text-xs text-muted-foreground">{t("schedule_session_attendance_required")}</p>
      ) : null}
    </div>
  );
}

function ScheduleDesktopPanel(props: {
  event: ScheduleEvent | null;
  locale: string;
  intlLocale: string;
  t: (key: I18nKey) => string;
  canCreateSession: boolean;
  readConstraintsFromNotes: ScheduleConstraintsReader;
  onEdit: (ev: ScheduleEvent) => void;
}) {
  if (!props.event) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[12rem] p-8 text-center gap-3">
        <CalendarDays className="w-10 h-10 text-muted-foreground/40" aria-hidden />
        <p className="text-sm font-semibold text-muted-foreground">
          {props.locale === "zh" ? "选择一场训练" : props.locale === "es" ? "Selecciona una sesión" : "Select a session"}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 p-5">
      <h2 className="text-base font-black tracking-tight text-foreground pr-2">{sessionDisplayTitle(props.event, props.t)}</h2>
      <ScheduleSessionDetailBody
        event={props.event}
        intlLocale={props.intlLocale}
        t={props.t}
        readConstraintsFromNotes={props.readConstraintsFromNotes}
      />
      {props.canCreateSession ? (
        <Button className="w-full" onClick={() => props.onEdit(props.event!)}>
          {props.t("schedule_edit")}
        </Button>
      ) : null}
    </div>
  );
}

function PlannerSessionCardButton(props: {
  className?: string;
  onOpenDetail: () => void;
  onOpenEdit: () => void;
  children: React.ReactNode;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Escritorio: raton, no touch -- doble clic para editar en vez de mantener pulsado (que no tiene sentido con raton). */
  desktopInteraction?: boolean;
}) {
  const suppressNextClickRef = useRef(false);
  const longPress = useLongPress(() => {
    suppressNextClickRef.current = true;
    props.onOpenEdit();
  }, 500);
  return (
    <button
      type="button"
      className={cn(props.className, props.draggable ? "cursor-grab active:cursor-grabbing" : "")}
      {...(props.desktopInteraction ? {} : longPress)}
      draggable={props.draggable}
      onDragStart={(e) => {
        if (!props.draggable) return;
        e.dataTransfer.effectAllowed = "move";
        // Firefox requires data to be set for drag to start.
        try { e.dataTransfer.setData("text/plain", "session"); } catch { /* ignore */ }
        props.onDragStart?.();
      }}
      onDragEnd={() => props.onDragEnd?.()}
      onDoubleClick={props.desktopInteraction ? props.onOpenEdit : undefined}
      onClick={() => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        props.onOpenDetail();
      }}
    >
      {props.children}
    </button>
  );
}

function KpiCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">{props.title}</p>
      <p className="mt-2 text-xl font-black tracking-tight text-foreground">{props.value}</p>
      {props.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{props.subtitle}</p> : null}
    </div>
  );
}

const STAFF_SESSION_ROW_ACCENT: Record<
  ScheduleEvent["session_type"],
  { panel: string; icon: string }
> = {
  training: { panel: "bg-sky-500/15 border-sky-500/25", icon: "text-sky-600 dark:text-sky-400" },
  recovery: { panel: "bg-rose-500/15 border-rose-500/25", icon: "text-rose-600 dark:text-rose-400" },
  match: { panel: "bg-amber-500/15 border-amber-500/30", icon: "text-amber-700 dark:text-amber-300" },
  travel: { panel: "bg-cyan-500/15 border-cyan-500/25", icon: "text-cyan-700 dark:text-cyan-300" },
  meeting: { panel: "bg-violet-500/15 border-violet-500/25", icon: "text-violet-700 dark:text-violet-300" },
  other: { panel: "bg-muted/50 border-border", icon: "text-muted-foreground" },
};

function SessionRow(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  sessionType?: ScheduleEvent["session_type"];
  onClick?: () => void;
}) {
  const accent = props.sessionType ? STAFF_SESSION_ROW_ACCENT[props.sessionType] : null;
  const TypeIcon = props.sessionType ? ACTIVITY_TYPE_CONFIG[props.sessionType].icon : null;
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border border-border bg-background/40",
        props.onClick ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors" : "",
      )}
      onClick={props.onClick}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick ? 0 : undefined}
    >
      {accent && TypeIcon ? (
        <div
          className={["flex w-11 shrink-0 flex-col items-center justify-center border-r", accent.panel].join(" ")}
          aria-hidden
        >
          <TypeIcon className={["h-4 w-4", accent.icon].join(" ")} />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-foreground truncate">{props.title}</p>
          {props.subtitle ? (
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground truncate">{props.subtitle}</p>
          ) : null}
        </div>
        {props.right ? (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {props.right}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "09:30" o, si hay hora de fin, "09:30–11:30" -- para que la duración real de la sesión se vea de un vistazo en las tarjetas del Planner. */
function formatTimeRange(startsAt: string, endsAt: string | null): string {
  const start = formatTime(startsAt);
  if (!endsAt) return start;
  return `${start}–${formatTime(endsAt)}`;
}

/**
 * Si el coach no escribio un nombre propio para la sesion, el titulo
 * guardado es "" (ver useSessionForm.ts) -- aqui se rellena con la etiqueta
 * de ACTIVITY_TYPE_CONFIG traducida EN VIVO al idioma actual, en vez de
 * depender de texto congelado desde el momento de creacion (eso era lo que
 * hacia que "Court Practice" se quedara en ingles al cambiar de idioma).
 */
function sessionDisplayTitle(
  ev: { title: string; session_type: ScheduleEvent["session_type"] },
  t: (key: I18nKey) => string,
): string {
  return ev.title.trim() || t(ACTIVITY_TYPE_CONFIG[ev.session_type].labelKey);
}

/** "9:00–12:00" style range for a planner slot header — fixes the original
 *  complaint that Morning/Midday/Evening gave no hint of their actual hours. */
function formatSlotHourRange(startHour: number, endHour: number): string {
  const fmt = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  return `${fmt(startHour)}–${fmt(endHour)}`;
}

function minutesToHHMM(mins: number): string {
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

