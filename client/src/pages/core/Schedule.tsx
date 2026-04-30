import { ModulePageShell } from "./ModulePage";
import { useLocale } from "@/lib/i18n";
import { ModuleHeader } from "@/components/branding/ModuleHeader";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Dumbbell,
  HeartPulse,
  Trophy,
  Bus,
  Video,
  CalendarDays,
  Info,
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
import { formatTimeHHMMFromParts, formatTimeHHMMFromTotalMinutes, parseTimeHHMMToTotalMinutes } from "@/lib/timeHHMM";
import {
  todayKey,
  useUpsertWellnessEntry,
  useWellnessEntriesForDate,
  useWellnessEntriesRangeForUsers,
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
  startOfTomorrowLocal,
  type ScheduleEvent,
} from "@/lib/schedule";

type AttendanceMode = "all_team" | "groups" | "signup" | "selected_players";
type LoadWeight = "low" | "medium" | "high";
type GroupSignupMode = "coach_assign" | "auto_signup";
type ActivityTypeConfig = {
  value: ScheduleEvent["session_type"];
  labelKey: any;
  icon: typeof Dumbbell;
  defaultDuration: number;
  allowedDurations: number[];
  defaultAttendanceMode: AttendanceMode;
  defaultGearHint: "ball" | "weights" | "travel" | "video" | "none";
  loadWeight: LoadWeight;
};

const ACTIVITY_TYPE_CONFIG: Record<ScheduleEvent["session_type"], ActivityTypeConfig> = {
  training: {
    value: "training",
    labelKey: "schedule_activity_court_practice",
    icon: Dumbbell,
    defaultDuration: 90,
    allowedDurations: [60, 90, 120],
    defaultAttendanceMode: "all_team",
    defaultGearHint: "ball",
    loadWeight: "medium",
  },
  recovery: {
    value: "recovery",
    labelKey: "schedule_activity_physical_training",
    icon: HeartPulse,
    defaultDuration: 60,
    allowedDurations: [60, 90],
    defaultAttendanceMode: "all_team",
    defaultGearHint: "weights",
    loadWeight: "medium",
  },
  match: {
    value: "match",
    labelKey: "schedule_activity_match",
    icon: Trophy,
    defaultDuration: 120,
    allowedDurations: [120, 150, 180],
    defaultAttendanceMode: "all_team",
    defaultGearHint: "ball",
    loadWeight: "high",
  },
  travel: {
    value: "travel",
    labelKey: "schedule_activity_travel",
    icon: Bus,
    defaultDuration: 120,
    allowedDurations: [],
    defaultAttendanceMode: "all_team",
    defaultGearHint: "travel",
    loadWeight: "medium",
  },
  meeting: {
    value: "meeting",
    labelKey: "schedule_activity_meeting_video",
    icon: Video,
    defaultDuration: 60,
    allowedDurations: [30, 60, 90],
    defaultAttendanceMode: "all_team",
    defaultGearHint: "video",
    loadWeight: "low",
  },
  other: {
    value: "other",
    labelKey: "schedule_activity_event",
    icon: CalendarDays,
    defaultDuration: 60,
    allowedDurations: [60, 90],
    defaultAttendanceMode: "all_team",
    defaultGearHint: "none",
    loadWeight: "low",
  },
};

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
  const canCreateSession = caps.canCreateEvent;
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

  const todayEventsQ = useTodayScheduleEvents({ clubId });
  const tomorrowEventsQ = useTomorrowScheduleEvents({ clubId });
  const weekEventsQ = useThisWeekScheduleEvents({ clubId });
  const createEventMut = useCreateScheduleEvent();
  const updateEventMut = useUpdateScheduleEvent();
  const deleteEventMut = useDeleteScheduleEvent();
  const upsertParticipant = useUpsertScheduleParticipant();
  const weekRestSessions = useMemo(() => {
    const start = startOfTomorrowLocal();
    start.setDate(start.getDate() + 1);
    const t0 = start.getTime();
    return (weekEventsQ.data ?? []).filter((s) => new Date(s.starts_at).getTime() >= t0);
  }, [weekEventsQ.data]);

  const participantEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of todayEventsQ.data ?? []) ids.add(s.id);
    for (const s of tomorrowEventsQ.data ?? []) ids.add(s.id);
    for (const s of weekRestSessions) ids.add(s.id);
    return Array.from(ids);
  }, [todayEventsQ.data, tomorrowEventsQ.data, weekRestSessions]);

  const myParticipantsQ = useScheduleParticipantsForUser({
    clubId,
    userId,
    eventIds: isPlayer ? participantEventIds : [],
  });
  const todayParticipantsQ = useScheduleParticipantsForEvents({
    clubId,
    eventIds: todayEventsQ.data?.map((e) => e.id) ?? [],
  });
  const wellnessPctQ = useTodayWellnessSubmissionPct({ clubId, playerUserIds: rosterPlayerUserIds });

  const nextSession = useMemo(() => {
    const now = Date.now();
    const all = [
      ...(todayEventsQ.data ?? []),
      ...(tomorrowEventsQ.data ?? []),
      ...(weekEventsQ.data ?? []),
    ];
    const upcoming = all
      .filter((s) => new Date(s.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return upcoming[0] ?? null;
  }, [todayEventsQ.data, tomorrowEventsQ.data, weekEventsQ.data]);

  const [activeTab, setActiveTab] = useState<"schedule" | "wellness">("schedule");
  const [staffView, setStaffView] = useState<"list" | "planner">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const isEditing = Boolean(editingSessionId);
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [createSessionType, setCreateSessionType] = useState<ScheduleEvent["session_type"]>("training");
  const [createTitle, setCreateTitle] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createStartMins, setCreateStartMins] = useState<number | null>(null);
  const [createEndTime, setCreateEndTime] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createAttendanceRequired, setCreateAttendanceRequired] = useState(true);
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(() => new Set());

  const locationKey = useMemo(() => `uscout-schedule-locations:${clubId ?? "no-club"}`, [clubId]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  // location presets now contextual per session type in slot create
  const [useCustomDateTime, setUseCustomDateTime] = useState(false);
  const [durationMins, setDurationMins] = useState<number | null>(null);
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
  const [editingWeekTemplateId, setEditingWeekTemplateId] = useState<string | null>(null);
  const [applyWeekTemplateOpen, setApplyWeekTemplateOpen] = useState(false);
  const [applyTargetTemplateId, setApplyTargetTemplateId] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  // (touchStartX removed - no swipe pages in portrait)
  const [highlightDayKey, setHighlightDayKey] = useState<string | null>(null);
  const portraitDayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const landscapeDayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState<1 | 2 | 3 | 4 | 6 | 8>(4);
  const [repeatWeekdays, setRepeatWeekdays] = useState<Set<number>>(() => new Set([1, 3, 5])); // Mon/Wed/Fri

  const [targetAttendance, setTargetAttendance] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [groupName, setGroupName] = useState("");
  // UI-ready only (not persisted yet)
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>("all_team");
  const [attendanceModeTouched, setAttendanceModeTouched] = useState(false);
  const [groupsCount, setGroupsCount] = useState("");
  const [groupCapacity, setGroupCapacity] = useState("");
  const [groupSignupMode, setGroupSignupMode] = useState<GroupSignupMode>("coach_assign");
  const [coachGroupAssignments, setCoachGroupAssignments] = useState<Record<string, number>>({});
  const [signupDeadline, setSignupDeadline] = useState("");
  const [signupMaxSpots, setSignupMaxSpots] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(() => new Set());
  const [customDurationOpen, setCustomDurationOpen] = useState(false);
  const [customDurationMins, setCustomDurationMins] = useState<string>("");
  const [groupAssignOpen, setGroupAssignOpen] = useState(false);
  const [choosePlayersOpen, setChoosePlayersOpen] = useState(false);
  const [playerActionsTick, setPlayerActionsTick] = useState(0);
  const [trainingTags, setTrainingTags] = useState<Set<string>>(() => new Set());
  const [subgroupCount, setSubgroupCount] = useState("");
  const [subgroupMinutes, setSubgroupMinutes] = useState("");

  type SessionTemplate = {
    id: string;
    name: string;
    session_type: ScheduleEvent["session_type"];
    title: string;
    location: string | null;
    notes: string | null;
    attendance_required: boolean;
    constraints?: { target_attendance?: number; max_capacity?: number; group_name?: string };
  };

  const templatesKey = useMemo(() => `uscout-schedule-templates:${clubId ?? "no-club"}`, [clubId]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);

  type WeekTemplateSession = {
    dayIndex: number; // 0..6 (Mon..Sun relative to selected week start)
    startMins: number; // minutes from midnight (local)
    durationMins: number | null;
    session_type: ScheduleEvent["session_type"];
    title: string;
    location: string | null;
    notes: string | null;
    attendance_required: boolean;
  };

  type WeekTemplate = {
    id: string;
    name: string;
    notes: string | null;
    phase?: "preseason" | "regular" | "playoff" | "off";
    games_count?: 0 | 1 | 2;
    load_level?: "low" | "medium" | "high";
    tags?: string;
    favorite?: boolean;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    sessions: WeekTemplateSession[];
  };

  const weekTemplatesKey = useMemo(() => `uscout-schedule-week-templates:${clubId ?? "no-club"}`, [clubId]);
  const [weekTemplates, setWeekTemplates] = useState<WeekTemplate[]>([]);
  const [weekTemplateSearch, setWeekTemplateSearch] = useState("");
  const [weekTemplateSort, setWeekTemplateSort] = useState<"recent" | "alpha">("recent");
  const [weekTemplatePhase, setWeekTemplatePhase] = useState<WeekTemplate["phase"] | "all">("all");
  const [weekTemplateGames, setWeekTemplateGames] = useState<WeekTemplate["games_count"] | "all">("all");
  const [weekTemplateLoad, setWeekTemplateLoad] = useState<WeekTemplate["load_level"] | "all">("all");
  const [weekTemplateFavOnly, setWeekTemplateFavOnly] = useState(false);

  const persistWeekTemplates = (next: WeekTemplate[]) => {
    setWeekTemplates(next);
    try {
      window.localStorage.setItem(weekTemplatesKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // persist anytime templates change (metadata edits are done inline)
    try {
      window.localStorage.setItem(weekTemplatesKey, JSON.stringify(weekTemplates));
    } catch {
      // ignore
    }
  }, [weekTemplates, weekTemplatesKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(weekTemplatesKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) setWeekTemplates(parsed as WeekTemplate[]);
      else setWeekTemplates([]);
    } catch {
      setWeekTemplates([]);
    }
  }, [weekTemplatesKey]);

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

  const readConstraintsFromNotes = (notes: string | null | undefined) => {
    const raw = notes ?? "";
    const marker = "\nOPS:";
    const idx = raw.lastIndexOf(marker);
    if (idx === -1) return { notesClean: raw.trim() || null, constraints: {} as any };
    const jsonPart = raw.slice(idx + marker.length).trim();
    const notesClean = raw.slice(0, idx).trim() || null;
    try {
      const parsed = JSON.parse(jsonPart) as any;
      const c: any = {};
      if (typeof parsed?.target_attendance === "number") c.target_attendance = parsed.target_attendance;
      if (typeof parsed?.max_capacity === "number") c.max_capacity = parsed.max_capacity;
      if (typeof parsed?.group_name === "string") c.group_name = parsed.group_name;
      if (Array.isArray(parsed?.tags)) c.tags = parsed.tags.filter((x: any) => typeof x === "string");
      if (parsed?.subgroups && typeof parsed.subgroups === "object") c.subgroups = parsed.subgroups;
      if (parsed?.attendance && typeof parsed.attendance === "object") c.attendance = parsed.attendance;
      return { notesClean, constraints: c };
    } catch {
      return { notesClean: raw.trim() || null, constraints: {} as any };
    }
  };

  const writeConstraintsToNotes = (
    baseNotes: string | null,
    constraints: {
      target_attendance?: number;
      max_capacity?: number;
      group_name?: string;
      tags?: string[];
      subgroups?: { count?: number; minutes?: number };
      attendance?: {
        mode: AttendanceMode;
        groups_count?: number;
        group_capacity?: number;
        group_signup_mode?: GroupSignupMode;
        coach_assignments?: Record<string, number>;
        signup_deadline?: string;
        signup_max_spots?: number;
        selected_player_ids?: string[];
      };
    },
  ) => {
    const clean = (baseNotes ?? "").trim();
    const hasAny = Object.values(constraints).some((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (!hasAny) return clean || null;
    const payload = JSON.stringify(constraints);
    return `${clean || ""}${clean ? "\n\n" : ""}OPS:${payload}`.trim();
  };

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

  const runCreateOrUpdate = async (opts?: { overrideTemplate?: SessionTemplate | null }) => {
    if (!clubId || !userId) return;
    if (!createDate || createStartMins == null) return;
    if (attendanceMode === "selected_players" && selectedPlayerIds.size < 1) return;
    if (!signupMaxSpotsOk) return;
    const baseTitle = (opts?.overrideTemplate ? opts.overrideTemplate.title : createTitle).trim();
    const title = baseTitle || t(ACTIVITY_TYPE_CONFIG[createSessionType].labelKey);
    const startsIso = new Date(`${createDate}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`).toISOString();
    const endsIso = createEndTime
      ? new Date(`${createDate}T${createEndTime}`).toISOString()
      : durationMins && durationMins > 0
        ? new Date(new Date(`${createDate}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`).getTime() + durationMins * 60000).toISOString()
        : null;
    const constraints = {
      target_attendance: targetAttendance.trim() ? Number(targetAttendance) : undefined,
      max_capacity: maxCapacity.trim() ? Number(maxCapacity) : undefined,
      group_name: groupName.trim() ? groupName.trim() : undefined,
      attendance: {
        mode: attendanceMode,
        groups_count: attendanceMode === "groups" && groupsCount.trim() ? Number(groupsCount) : undefined,
        group_capacity: attendanceMode === "groups" && groupCapacity.trim() ? Number(groupCapacity) : undefined,
        group_signup_mode: attendanceMode === "groups" ? groupSignupMode : undefined,
        coach_assignments:
          attendanceMode === "groups" && groupSignupMode === "coach_assign" && Object.keys(coachGroupAssignments).length > 0
            ? coachGroupAssignments
            : undefined,
        signup_deadline: attendanceMode === "signup" && signupDeadline.trim() ? signupDeadline.trim() : undefined,
        signup_max_spots: attendanceMode === "signup" && signupMaxSpots.trim() ? Number(signupMaxSpots) : undefined,
        selected_player_ids:
          attendanceMode === "selected_players" && selectedPlayerIds.size > 0 ? Array.from(selectedPlayerIds) : undefined,
      },
      tags: trainingTags.size > 0 ? Array.from(trainingTags) : undefined,
      subgroups:
        subgroupCount.trim() || subgroupMinutes.trim()
          ? {
              count: subgroupCount.trim() ? Number(subgroupCount) : undefined,
              minutes: subgroupMinutes.trim() ? Number(subgroupMinutes) : undefined,
            }
          : undefined,
    };
    const rawNotes = opts?.overrideTemplate ? (opts.overrideTemplate.notes ?? "") : createNotes;
    const notesWithOps = writeConstraintsToNotes(rawNotes.trim() || null, constraints);
    if (editingSessionId) {
      await updateEventMut.mutateAsync({
        id: editingSessionId,
        club_id: clubId,
        patch: {
          session_type: createSessionType,
          title,
          starts_at: startsIso,
          ends_at: endsIso,
          location: (opts?.overrideTemplate ? (opts.overrideTemplate.location ?? "") : createLocation).trim() || null,
          notes: notesWithOps,
          attendance_required: createAttendanceRequired,
        },
      });
    } else {
      await createEventMut.mutateAsync({
        club_id: clubId,
        session_type: createSessionType,
        title,
        starts_at: startsIso,
        ends_at: endsIso,
        location: (opts?.overrideTemplate ? (opts.overrideTemplate.location ?? "") : createLocation).trim() || null,
        notes: notesWithOps,
        attendance_required: createAttendanceRequired,
        created_by: userId,
      });
    }
  };

  const mondayOf = (base: Date) => {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    return d;
  };

  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const currentWeekStart = useMemo(() => mondayOf(new Date()), []);
  const isCurrentWeek = selectedWeekStart.toISOString().slice(0, 10) === currentWeekStart.toISOString().slice(0, 10);

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
        { key: "morning", labelKey: "schedule_planner_slot_morning", hour: 9 },
        { key: "midday", labelKey: "schedule_planner_slot_midday", hour: 12 },
        { key: "evening", labelKey: "schedule_planner_slot_evening", hour: 18 },
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
  const createStartTime = useMemo(() => {
    return typeof createStartMins === "number" && Number.isFinite(createStartMins)
      ? formatTimeHHMMFromTotalMinutes(createStartMins)
      : "";
  }, [createStartMins]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(selectedWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedWeekStart]);

  const openCreatePrefilled = (d: Date, hour: number) => {
    setEditingSessionId(null);
    setShowAdvancedCreate(false);
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

  const upsertWeekTemplate = (tpl: WeekTemplate) => {
    persistWeekTemplates([tpl, ...weekTemplates.filter((t) => t.id !== tpl.id)].slice(0, 24));
  };

  const duplicateWeekTemplate = (tpl: WeekTemplate) => {
    const now = new Date().toISOString();
      const copy: WeekTemplate = {
      ...tpl,
      id: `wktpl-${Math.random().toString(16).slice(2)}`,
        name: `${tpl.name} (${t("invite_copy")})`,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: undefined,
    };
    upsertWeekTemplate(copy);
    toast({ description: t("schedule_week_template_duplicated") });
  };

  const markWeekTemplateUsed = (id: string) => {
    const now = new Date().toISOString();
    persistWeekTemplates(
      weekTemplates.map((t) => (t.id === id ? { ...t, lastUsedAt: now, updatedAt: now } : t)),
    );
  };

  const applyWeekTemplate = async (tpl: WeekTemplate, mode: "replace" | "merge") => {
    if (!clubId || !userId) return;
    if (mode === "replace") await clearCurrentWeek();
    try {
      for (const s of tpl.sessions) {
        const day = new Date(selectedWeekStart);
        day.setDate(day.getDate() + s.dayIndex);
        const hh = String(Math.floor(s.startMins / 60)).padStart(2, "0");
        const mm = String(s.startMins % 60).padStart(2, "0");
        const yyyy = day.getFullYear();
        const mo = String(day.getMonth() + 1).padStart(2, "0");
        const dd = String(day.getDate()).padStart(2, "0");
        const startsIso = new Date(`${yyyy}-${mo}-${dd}T${hh}:${mm}`).toISOString();
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

  const applyQuickPick = (pick: "today_evening" | "tomorrow_morning" | "tomorrow_evening") => {
    const base = new Date();
    base.setSeconds(0, 0);
    const d = new Date(base);
    const hour =
      pick === "tomorrow_morning" ? 9 : pick === "today_evening" || pick === "tomorrow_evening" ? 18 : 18;
    if (pick.startsWith("tomorrow")) d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setCreateDate(`${yyyy}-${mm}-${dd}`);
    setCreateStartMins(hour * 60);
    setUseCustomDateTime(false);
  };

  const applyDurationPreset = (mins: number) => {
    setDurationMins(mins);
    if (!createDate || createStartMins == null) return;
    const start = new Date(`${createDate}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + mins * 60000);
    setCreateEndTime(formatTimeHHMM(end.getHours(), end.getMinutes()));
    setUseCustomDateTime(true);
  };

  const startEditing = (ev: ScheduleEvent) => {
    setEditingSessionId(ev.id);
    setShowAdvancedCreate(false);
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
    } else {
      setCreateEndTime("");
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
    const todayKey = today.toISOString().slice(0, 10);
    setSelectedWeekStart(currentWeekStart);
    setHighlightDayKey(todayKey);
    window.setTimeout(() => setHighlightDayKey(null), 900);
    window.setTimeout(() => {
      const el = (portraitDayRefs.current[todayKey] ?? landscapeDayRefs.current[todayKey]) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "start", inline: "center" });
    }, 50);
  };

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString("sv");
    let attempts = 0;
    const tryScroll = () => {
      const el = (portraitDayRefs.current[todayStr] ?? landscapeDayRefs.current[todayStr]) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } else if (attempts < 15) {
        attempts++;
        window.setTimeout(tryScroll, 100);
      }
    };
    window.setTimeout(tryScroll, 300);
  }, []);

  const fmtWeekRange = (start: Date) => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  };

  const deleteWeekTemplate = (id: string) => {
    persistWeekTemplates(weekTemplates.filter((t2) => t2.id !== id));
    toast({ description: t("schedule_week_template_deleted" as any) });
  };

  const typePillClass = (k: ScheduleEvent["session_type"]) => {
    if (k === "match") return "border-orange-300/50 bg-orange-500/10 text-orange-900 dark:text-orange-200";
    if (k === "recovery") return "border-emerald-300/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
    if (k === "travel") return "border-sky-300/50 bg-sky-500/10 text-sky-900 dark:text-sky-200";
    return "border-border bg-background/40 text-foreground";
  };

  const adjustStartTimeMins = (deltaMins: number) => {
    if (createStartMins == null) return;
    const next = (createStartMins + deltaMins + 1440) % 1440;
    setCreateStartMins(next);
    if (durationMins) applyDurationPreset(durationMins);
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

  const signupMaxSpotsOk = useMemo(() => {
    const raw = signupMaxSpots.trim();
    if (!raw) return true;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1;
  }, [signupMaxSpots]);

  const canSubmitCreate = Boolean(
    clubId &&
      userId &&
      createDate &&
      createStartTime &&
      signupMaxSpotsOk &&
      (attendanceMode !== "selected_players" || selectedPlayerIds.size >= 1),
  );

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

  const rosterLabelByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of rosterPlayers) {
      map[m.userId] = ((m as any).fullName ?? (m as any).full_name ?? (m as any).email ?? m.userId) as string;
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
    const highSorenessUserIds = new Set(entries.filter((e) => e.muscle_soreness >= 4).map((e) => e.user_id));
    const belowNormalUserIds = new Set<string>([...Array.from(lowReadinessUserIds), ...Array.from(highSorenessUserIds)]);

    const priority = rosterPlayerUserIds
      .map((uid) => {
        const e = byUser[uid];
        const missingSubmission = !e;
        const lowReadiness = Boolean(e && e.mental_readiness <= 2);
        const highSoreness = Boolean(e && e.muscle_soreness >= 4);
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
      return list.reduce((acc, e) => acc + (e as any)[field], 0) / list.length;
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

  const [wellnessTrendRange, setWellnessTrendRange] = useState<"7d" | "30d">("7d");
  const [staffRiskSort, setStaffRiskSort] = useState<"score" | "missing" | "readiness" | "soreness" | "sleep">("score");
  const [staffTrendRange, setStaffTrendRange] = useState<"7d" | "30d">("7d");

  const staffTeamAvgToday = useMemo(() => {
    const entries = staffTodayEntriesQ.data ?? [];
    if (entries.length === 0) return null;
    const avg = (field: "sleep_quality" | "energy_level" | "muscle_soreness" | "mental_readiness") =>
      entries.reduce((acc, e) => acc + (e as any)[field], 0) / entries.length;
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
      const highSoreness = Boolean(e && e.muscle_soreness >= 4);
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
      r.entry ? (r.entry as any)[field] : null;
    rows.sort((a, b) => {
      if (staffRiskSort === "missing") return Number(b.missingSubmission) - Number(a.missingSubmission) || b.score - a.score;
      if (staffRiskSort === "sleep") return (v(a, "sleep_quality") ?? 999) - (v(b, "sleep_quality") ?? 999) || b.score - a.score;
      if (staffRiskSort === "readiness") return (v(a, "mental_readiness") ?? 999) - (v(b, "mental_readiness") ?? 999) || b.score - a.score;
      if (staffRiskSort === "soreness") return (v(b, "muscle_soreness") ?? -1) - (v(a, "muscle_soreness") ?? -1) || b.score - a.score;
      return b.score - a.score;
    });
    return rows;
  }, [staffRiskRows, staffRiskSort]);

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

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    parts.push(t(ACTIVITY_TYPE_CONFIG[createSessionType].labelKey));
    if (createDate && createStartMins != null) parts.push(`${createDate} ${formatTimeHHMMFromTotalMinutes(createStartMins)}`);
    else parts.push(t("schedule_create_summary_time_missing"));
    if (createLocation.trim()) parts.push(createLocation.trim());
    else parts.push(t("schedule_create_summary_location_missing"));
    return parts.join(" · ");
  }, [createDate, createLocation, createSessionType, createStartMins, t]);

  const createLocationPlaceholderKey = useMemo(() => {
    if (createSessionType === "training") return "schedule_session_location_placeholder_training";
    if (createSessionType === "recovery") return "schedule_session_location_placeholder_recovery";
    if (createSessionType === "match") return "schedule_session_location_placeholder_match";
    if (createSessionType === "travel") return "schedule_session_location_placeholder_travel";
    if (createSessionType === "meeting") return "schedule_session_location_placeholder_meeting";
    return "schedule_session_location_placeholder_other";
  }, [createSessionType]);

  // Title is optional; if blank we fall back to the activity label on save.

  useEffect(() => {
    const cfg = ACTIVITY_TYPE_CONFIG[createSessionType];
    // Keep UI clean: duration chips adapt by type; if current duration isn't allowed, reset to the type default.
    // Travel uses "block time" semantics: no duration chips and no forced end time.
    if (createSessionType === "travel") {
      setDurationMins(null);
      setCreateEndTime("");
      setUseCustomDateTime(false);
      setCustomDurationOpen(false);
      setCustomDurationMins("");
    } else if (durationMins == null || !cfg.allowedDurations.includes(durationMins)) {
      applyDurationPreset(cfg.defaultDuration);
    }
    // Type defaults must actually work: only auto-apply if coach hasn't manually changed attendance mode this session.
    if (!attendanceModeTouched) setAttendanceMode(cfg.defaultAttendanceMode);
  }, [
    applyDurationPreset,
    attendanceModeTouched,
    createSessionType,
    durationMins,
    setCreateEndTime,
    setCustomDurationMins,
    setDurationMins,
    setUseCustomDateTime,
  ]);

  const derivedDurationFromEndTimeMins = useMemo(() => {
    if (!createDate || createStartMins == null || !createEndTime) return null;
    const start = new Date(`${createDate}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`);
    const end = new Date(`${createDate}T${createEndTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    if (!Number.isFinite(diff) || diff <= 0) return null;
    return diff;
  }, [createDate, createEndTime, createStartMins]);

  const durationOptions = useMemo(() => {
    const cfg = ACTIVITY_TYPE_CONFIG[createSessionType];
    return cfg.allowedDurations;
  }, [createSessionType]);

  useEffect(() => {
    if (createSessionType === "travel") return;
    if (!derivedDurationFromEndTimeMins) return;
    // If user edits end time directly, reflect it as a "Custom" duration selection.
    setDurationMins(derivedDurationFromEndTimeMins);
    setCustomDurationMins(String(derivedDurationFromEndTimeMins));
  }, [createSessionType, derivedDurationFromEndTimeMins]);

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

  return (
    <ModulePageShell title={t("ucore_card_schedule_title")} moduleHeader={{ module: "schedule", tagline: t("tagline_schedule") }}>
      <div className="p-4 pb-10 max-w-md mx-auto w-full">
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

          <TabsContent value="schedule" className="mt-4 space-y-4">
            {todayEventsQ.isError ? (
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted-foreground">{t("schedule_load_failed")}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => void todayEventsQ.refetch()}
                  data-testid="schedule-retry"
                >
                  {t("retry")}
                </Button>
              </div>
            ) : null}
            {isPlayer ? (
              <>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                    {t("schedule_player_next_session")}
                  </p>
                  <div className="mt-2">
                    <p className="text-sm font-extrabold text-foreground">
                      {todayEventsQ.isLoading || tomorrowEventsQ.isLoading || weekEventsQ.isLoading
                        ? t("schedule_loading_today")
                        : nextSession
                          ? nextSession.title
                          : t("schedule_empty_next_sessions")}
                    </p>
                    {nextSession?.starts_at ? (
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        {t("schedule_player_time")}: {formatTime(nextSession.starts_at)}
                        {" · "}
                        {t("schedule_player_location")}:{" "}
                        {nextSession.location?.trim() ? nextSession.location! : t("schedule_location_tbd")}
                      </p>
                    ) : null}
                    {nextSession?.session_type ? (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2.5 py-1 text-[11px] font-bold text-foreground">
                          {t(ACTIVITY_TYPE_CONFIG[nextSession.session_type].labelKey)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2.5 py-1 text-[11px] font-bold text-foreground">
                      {t("schedule_player_wellness")}:{" "}
                      {submittedToday ? t("schedule_wellness_submitted") : t("schedule_wellness_pending")}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                            title={ev.title}
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
                                              <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-[11px] font-bold text-foreground">
                                                {t("schedule_player_joined")}
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8"
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
                                              className="h-8"
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
                                              <Button size="sm" variant="secondary" className="h-8" disabled={disabledCore}>
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
                                              <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-[11px] font-bold text-foreground">
                                                {t("schedule_player_group").replace("{group}", chosenGroup)}
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8"
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
                                            <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-[11px] font-bold text-foreground">
                                              {t("schedule_player_assigned_group").replace("{group}", assignedGroupLabel)}
                                            </span>
                                          ) : null}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8"
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
                                          <span className="px-2 py-1 rounded-full border border-border bg-background/40 text-[11px] font-bold text-foreground">
                                            {t("schedule_player_mandatory")}
                                          </span>
                                        ) : null}
                                        <div className="flex gap-1.5">
                                          {(["confirmed", "declined", "maybe"] as const).map((status) => (
                                            <Button
                                              key={status}
                                              size="sm"
                                              variant={my?.status === status ? "secondary" : "outline"}
                                              className="h-8 px-2.5"
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
                    <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                      {t("schedule_section_tomorrow")}
                    </p>
                    <div className="mt-3 space-y-2">
                      {(tomorrowEventsQ.data ?? []).map((ev) => (
                        <SessionRow
                          key={ev.id}
                          title={ev.title}
                          subtitle={`${formatTime(ev.starts_at)}${ev.location ? ` · ${ev.location}` : ""}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {weekEventsQ.isSuccess && weekRestSessions.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                      {t("schedule_section_week")}
                    </p>
                    <div className="mt-3 space-y-2">
                      {weekRestSessions.map((ev) => (
                        <SessionRow
                          key={ev.id}
                          title={ev.title}
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
                  <ToggleGroup
                    type="single"
                    value={staffView}
                    onValueChange={(v) => setStaffView((v as any) || "list")}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="list" size="sm" variant="outline" className="h-9 px-3">
                      {t("schedule_view_list")}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="planner" size="sm" variant="outline" className="h-9 px-3">
                      {t("schedule_view_planner")}
                    </ToggleGroupItem>
                  </ToggleGroup>

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
                      <p className="text-[11px] font-semibold text-muted-foreground">{t("schedule_planner_hint")}</p>

                    {!isLandscape ? (
                      <div className="mt-3 space-y-3">
                        {days.map((d) => {
                          const dayKey = d.toISOString().slice(0, 10);
                          const daySessionsAll = (plannerWeekQ.data ?? [])
                            .filter((s) => new Date(s.starts_at).toLocaleDateString("sv") === dayKey)
                            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                          const label = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d);
                          const dateLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);

                          const sessionsInSlot = (hour: number) => {
                            const slotStart = new Date(d);
                            slotStart.setHours(hour, 0, 0, 0);
                            const slotEnd = new Date(slotStart);
                            slotEnd.setHours(hour + 3, 0, 0, 0);
                            return daySessionsAll.filter((s) => {
                              const ts = new Date(s.starts_at).getTime();
                              return ts >= slotStart.getTime() && ts < slotEnd.getTime();
                            });
                          };

                          const isToday = dayKey === new Date().toLocaleDateString("sv");
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
                                  <p className="text-[11px] font-semibold text-muted-foreground">{dateLabel}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {daySessionsAll.length >= 3 ? (
                                    <span className="px-2 py-0.5 rounded-full border border-border bg-muted/40 text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                                  const list = sessionsInSlot(slot.hour);
                                  return (
                                    <div
                                      key={slot.key}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-2.5 py-2"
                                    >
                                      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                                        {t(slot.labelKey as any)}
                                      </p>

                                      {list.length > 0 ? (
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                          {list.map((ev) => {
                                            const parsed = readConstraintsFromNotes(ev.notes ?? null);
                                            const tags = (parsed.constraints?.tags ?? []).slice(0, 2) as string[];
                                            return (
                                              <div key={ev.id} className="flex items-stretch justify-between gap-2">
                                                <button
                                                  type="button"
                                                  className="min-w-0 flex-1 text-left rounded-lg px-2 py-1.5 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                                  onClick={() => startEditing(ev)}
                                                >
                                                  <p className="text-sm font-extrabold text-foreground truncate">{ev.title}</p>
                                                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground truncate">
                                                    {formatTime(ev.starts_at)}
                                                    {ev.location ? ` · ${ev.location}` : ""}
                                                  </p>
                                                  {tags.length > 0 ? (
                                                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                      {tags.map((tg) => (
                                                        <span
                                                          key={tg}
                                                          className="px-1.5 py-0.5 rounded-full border border-border/70 bg-muted/10 text-[10px] font-bold text-muted-foreground"
                                                        >
                                                          {tg}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  ) : null}
                                                </button>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button
                                                      type="button"
                                                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                                      aria-label={t("more")}
                                                    >
                                                      <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => startEditing(ev)}>
                                                      <Pencil className="w-4 h-4" />
                                                      {t("schedule_edit")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => duplicateInOneTap(ev)}>
                                                      <Copy className="w-4 h-4" />
                                                      {t("schedule_duplicate_one_tap")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setCancelTarget(ev)} className="text-destructive focus:text-destructive">
                                                      <Trash2 className="w-4 h-4" />
                                                      {t("schedule_cancel_session")}
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={!canCreateSession}
                                          onClick={() => openCreatePrefilled(d, slot.hour)}
                                          className={[
                                            "h-9 px-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-border/70",
                                            "bg-transparent text-xs font-extrabold text-muted-foreground",
                                            "hover:bg-muted/20 hover:text-foreground",
                                            "disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
                                          ].join(" ")}
                                        >
                                          <Plus className="w-4 h-4" />
                                          <span>{t("schedule_add" as any)}</span>
                                        </button>
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
                      <div className="mt-3 overflow-x-auto">
                        <div className="min-w-[560px]">
                          <div className="grid grid-cols-8 gap-2">
                          <div />
                          {days.map((d) => (
                            <div
                              key={d.toISOString()}
                              ref={(el) => {
                                landscapeDayRefs.current[d.toISOString().slice(0, 10)] = el;
                              }}
                              className={[
                                "text-center",
                                (() => {
                                  const dk = d.toISOString().slice(0, 10);
                                  const isTodayLs = dk === new Date().toLocaleDateString("sv");
                                  const isHighLs = highlightDayKey === dk;
                                  if (isTodayLs) return "border-2 border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)] rounded-lg";
                                  if (isHighLs) return "ring-2 ring-primary/60 rounded-lg";
                                  return "";
                                })(),
                              ].join(" ")}
                            >
                              <p className="text-[11px] font-black text-foreground">
                                {new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d)}
                              </p>
                              <p className="text-[10px] font-semibold text-muted-foreground">
                                {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d)}
                              </p>
                              <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                                {(() => {
                                  const dayKey = d.toISOString().slice(0, 10);
                                  const daySessions = (plannerWeekQ.data ?? []).filter((s) => new Date(s.starts_at).toLocaleDateString("sv") === dayKey);
                                  const chips: string[] = [];
                                  if (daySessions.length === 0) chips.push("schedule_insight_no_sessions");
                                  if (daySessions.length >= 3) chips.push("schedule_insight_overloaded");
                                  const todayKey = new Date().toISOString().slice(0, 10);
                                  if (dayKey === todayKey && pendingResponses > 0) chips.push("schedule_insight_low_attendance_risk");
                                  return chips.slice(0, 2).map((k) => (
                                    <span
                                      key={k}
                                      className="px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-[9px] font-semibold text-muted-foreground"
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
                                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                                  {t(slot.labelKey as any)}
                                </p>
                              </div>
                              {days.map((d) => {
                                const slotStart = new Date(d);
                                slotStart.setHours(slot.hour, 0, 0, 0);
                                const slotEnd = new Date(slotStart);
                                slotEnd.setHours(slot.hour + 3, 0, 0, 0);
                                const inSlot = (plannerWeekQ.data ?? []).filter((s) => {
                                  const ts = new Date(s.starts_at).getTime();
                                  return ts >= slotStart.getTime() && ts < slotEnd.getTime();
                                });

                                return (
                                  <div key={`${slot.key}-${d.toISOString()}`} className="space-y-1">
                                    {inSlot.length > 0 ? (
                                      inSlot.map((ev) => (
                                        <div
                                          key={ev.id}
                                          className="rounded-lg border border-border bg-background/40 px-2 py-2 text-left"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-extrabold text-foreground truncate">{ev.title}</p>
                                              <p className="text-[10px] font-semibold text-muted-foreground truncate">
                                                {formatTime(ev.starts_at)}
                                                {ev.location ? ` · ${ev.location}` : ""}
                                              </p>
                                            </div>
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
                                                <DropdownMenuItem onClick={() => startEditing(ev)}>
                                                  <Pencil className="w-4 h-4" />
                                                  {t("schedule_edit")}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => duplicateInOneTap(ev)}>
                                                  <Copy className="w-4 h-4" />
                                                  {t("schedule_duplicate_one_tap")}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => saveSessionAsTemplate(ev)}>
                                                  <Copy className="w-4 h-4" />
                                                  {t("schedule_template_save")}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {days.flatMap((dd) =>
                                                  slotDefs.map((ss) => (
                                                    <DropdownMenuItem
                                                      key={`move-${ev.id}-${dd.toISOString()}-${ss.key}`}
                                                      onClick={() => moveSessionToSlot(ev, dd, ss.hour)}
                                                    >
                                                      <Clock className="w-4 h-4" />
                                                      {t("schedule_move_to").replace(
                                                        "{slot}",
                                                        `${new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(dd)} ${t(ss.labelKey as any)}`,
                                                      )}
                                                    </DropdownMenuItem>
                                                  )),
                                                )}
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
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openCreatePrefilled(d, slot.hour)}
                                        className="w-full rounded-lg border border-dashed border-border bg-muted/20 px-2 py-2 text-left hover:bg-muted/30"
                                      >
                                        <p className="text-[10px] font-semibold text-muted-foreground">
                                          {t("schedule_planner_add")}
                                        </p>
                                      </button>
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
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-center min-h-[44px]">
                            {showCopyPrev ? (
                              <Button className="h-11 px-6" disabled={!clubId || !userId} onClick={() => void copyPreviousWeek()}>
                                {t("schedule_copy_prev_week")}
                              </Button>
                            ) : showDeleteAll ? (
                              <Button
                                variant="secondary"
                                className="h-11 px-6 text-destructive"
                                disabled={!clubId || weekCount === 0}
                                onClick={() => setClearWeekOpen(true)}
                              >
                                {t("schedule_clear_week")}
                              </Button>
                            ) : (
                              <div />
                            )}
                          </div>

                          <div className="flex justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-11 px-6"
                              onClick={() => setWeekTemplatesOpen(true)}
                              data-testid="schedule-week-templates"
                              aria-label={t("schedule_week_templates")}
                              title={t("schedule_week_templates")}
                            >
                              <LayoutTemplate className="w-4 h-4 mr-2" />
                              {t("schedule_week_templates")}
                            </Button>
                          </div>

                          {canExportWeekImage ? (
                            <div className="flex justify-center">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-11 px-6"
                                disabled={!clubId || exportBusy}
                                onClick={() => void exportVisibleWeekImage()}
                                aria-label={t("schedule_export_week" as any)}
                                title={t("schedule_export_week" as any)}
                              >
                                <Share2 className="w-4 h-4 mr-2" />
                                {exportBusy ? t("schedule_exporting" as any) : t("schedule_export_week" as any)}
                              </Button>
                            </div>
                          ) : null}
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
                    subtitle={nextSession ? nextSession.title : undefined}
                  />
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                          title={ev.title}
                          subtitle={`${formatTime(ev.starts_at)}${ev.location ? ` · ${ev.location}` : ""}`}
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
                    const dayKey = d.toISOString().slice(0, 10);
                    const dayLabel = new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d);
                    const dateLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
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
                      const dayKey = d.toISOString().slice(0, 10);
                      const daySessions = (plannerWeekQ.data ?? [])
                        .filter((ev) => ev.starts_at.slice(0, 10) === dayKey)
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
                                          {ev.title}
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
                    {new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date())}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af" }}>U Core</div>
                </div>
              </div>
            </div>
          ) : null}

          <TabsContent value="wellness" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-black tracking-tight text-foreground">{t("wellness_title")}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {isPlayer ? t("wellness_subtitle") : t("wellness_staff_subtitle")}
              </p>

              {!wellnessHintDismissed ? (
                <div className="mt-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 flex items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">
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
                <div className="mt-4 space-y-3">
                  {(() => {
                    const top = staffRiskRowsSorted.find((p) => p.score > 0) ?? null;
                    const missing = staffWellnessSummary.missing;
                    return (
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                          {t("wellness_staff_today" as any)}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {t("wellness_staff_missing_today_label" as any)}
                            </p>
                            <p className="mt-1 text-lg font-black text-foreground">{missing}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {t("wellness_staff_top_risk_label" as any)}
                            </p>
                            <p className="mt-1 text-sm font-extrabold text-foreground truncate">
                              {top ? top.name : t("wellness_staff_top_risk_none" as any)}
                            </p>
                            {top ? (
                              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                                {t("wellness_staff_priority_score" as any).replace("{score}", String(top.score))}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="rounded-2xl border border-border bg-background/40 p-3">
                    <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                    <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                        const highSoreness = entries.some((e) => e.muscle_soreness >= 4);
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
                      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                        {t("wellness_staff_team_trends" as any)}
                      </p>
                      <ToggleGroup
                        type="single"
                        value={staffTrendRange}
                        onValueChange={(v) => setStaffTrendRange((v as any) || "7d")}
                        className="justify-end"
                      >
                        <ToggleGroupItem value="7d" size="sm" variant="outline" className="h-8 px-2.5">
                          7d
                        </ToggleGroupItem>
                        <ToggleGroupItem value="30d" size="sm" variant="outline" className="h-8 px-2.5">
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
                          const pick = (k: keyof (typeof slice)[number]) => slice.map((p) => (p ? (p as any)[k] : null));
                          return (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-bold text-foreground">{t("wellness_metric_sleep" as any)}</p>
                                <div className="mt-1"><SparklineBars values={pick("avgSleep")} goodUp /></div>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">{t("wellness_metric_energy" as any)}</p>
                                <div className="mt-1"><SparklineBars values={pick("avgEnergy")} goodUp /></div>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">{t("wellness_metric_soreness" as any)}</p>
                                <div className="mt-1"><SparklineBars values={pick("avgSoreness")} goodUp={false} /></div>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">{t("wellness_metric_readiness" as any)}</p>
                                <div className="mt-1"><SparklineBars values={pick("avgReadiness")} goodUp /></div>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                                <p className="text-[11px] font-bold text-muted-foreground">{t("wellness_staff_priority_score" as any).replace("{score}", String(p.score))}</p>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {reasons.slice(0, 4).map((r) => (
                                  <span
                                    key={r}
                                    className={[
                                      "px-2 py-0.5 rounded-full border text-[10px] font-black tracking-wide",
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
                                  <span key={c} className="px-2 py-0.5 rounded-full border border-border bg-background/40 text-[10px] font-black tracking-wide text-muted-foreground">
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
              ) : showLocalWellness ? (
                <>
                  <div className="mt-4 space-y-4">
                    <WellnessRow
                      label={t("wellness_metric_sleep" as any)}
                      tooltip={t("wellness_tooltip_sleep" as any)}
                      value={sleepQuality}
                      onValueChange={(v) => {
                        setLocalSaved(false);
                        setSleepQuality(v);
                      }}
                    />
                    <WellnessRow
                      label={t("wellness_metric_energy" as any)}
                      tooltip={t("wellness_tooltip_energy" as any)}
                      value={energyLevel}
                      onValueChange={(v) => {
                        setLocalSaved(false);
                        setEnergyLevel(v);
                      }}
                    />
                    <WellnessRow
                      label={t("wellness_metric_soreness" as any)}
                      tooltip={t("wellness_tooltip_soreness" as any)}
                      value={muscleSoreness}
                      onValueChange={(v) => {
                        setLocalSaved(false);
                        setMuscleSoreness(v);
                      }}
                    />
                    <WellnessRow
                      label={t("wellness_metric_readiness" as any)}
                      tooltip={t("wellness_tooltip_readiness" as any)}
                      value={mentalReadiness}
                      onValueChange={(v) => {
                        setLocalSaved(false);
                        setMentalReadiness(v);
                      }}
                    />
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={!wellnessComplete}
                      onClick={() => {
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
                      data-testid="wellness-submit-local"
                    >
                      {localSaved ? t("wellness_saved_local_cta") : t("wellness_save_local")}
                    </Button>
                  </div>

                  <p className="mt-2 text-[11px] text-muted-foreground">{t("wellness_local_note")}</p>
                </>
              ) : entryQ.isLoading ? (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-muted-foreground">{t("wellness_loading_today")}</p>
                </div>
              ) : submittedToday && !wellnessEditing ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-xs font-bold text-foreground">{t("wellness_submitted_today")}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
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
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t("wellness_completed_subtitle" as any)}</p>
                    </div>
                  </div>

                  {entryQ.data && playerBaseline ? (
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                        {t("wellness_baseline_title" as any)}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        {t("wellness_baseline_subtitle" as any).replace("{n}", String(playerBaseline.n))}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { key: "sleep", label: t("wellness_metric_sleep" as any), today: entryQ.data.sleep_quality, base: playerBaseline.sleep, goodUp: true },
                          { key: "energy", label: t("wellness_metric_energy" as any), today: entryQ.data.energy_level, base: playerBaseline.energy, goodUp: true },
                          { key: "soreness", label: t("wellness_metric_soreness" as any), today: entryQ.data.muscle_soreness, base: playerBaseline.soreness, goodUp: false },
                          { key: "readiness", label: t("wellness_metric_readiness" as any), today: entryQ.data.mental_readiness, base: playerBaseline.readiness, goodUp: true },
                        ].map((x) => {
                          const delta = x.today - x.base;
                          const dirGood = x.goodUp ? delta >= 0 : delta <= 0;
                          const deltaTxt = `${delta >= 0 ? "+" : ""}${(Math.round(delta * 10) / 10).toFixed(1)}`;
                          return (
                            <div key={x.key} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{x.label}</p>
                              <div className="mt-1 flex items-baseline justify-between gap-2">
                                <p className="text-lg font-black text-foreground">{x.today}</p>
                                <p
                                  className={[
                                    "text-[11px] font-bold",
                                    dirGood ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                                  ].join(" ")}
                                >
                                  {t("wellness_vs_baseline" as any).replace("{delta}", deltaTxt)}
                                </p>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {t("wellness_baseline_value" as any).replace("{v}", String(Math.round(x.base * 10) / 10))}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                        {t("wellness_trends_title" as any)}
                      </p>
                      <ToggleGroup
                        type="single"
                        value={wellnessTrendRange}
                        onValueChange={(v) => setWellnessTrendRange((v as any) || "7d")}
                        className="justify-end"
                      >
                        <ToggleGroupItem value="7d" size="sm" variant="outline" className="h-8 px-2.5">
                          7d
                        </ToggleGroupItem>
                        <ToggleGroupItem value="30d" size="sm" variant="outline" className="h-8 px-2.5">
                          30d
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="mt-3 space-y-3">
                      {(() => {
                        const q = wellnessTrendRange === "7d" ? last7Q : last30Q;
                        const points = (q.data ?? []).map((e) => ({
                          sleep: e.sleep_quality,
                          energy: e.energy_level,
                          soreness: e.muscle_soreness,
                          readiness: e.mental_readiness,
                        }));
                        const pick = (k: keyof (typeof points)[number]) => points.map((p) => (p ? (p as any)[k] : null));
                        return q.isLoading ? (
                          <p className="text-sm text-muted-foreground">{t("wellness_loading_today")}</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_sleep" as any)}</p>
                              <div className="mt-1">
                                <SparklineBars values={pick("sleep")} goodUp />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_energy" as any)}</p>
                              <div className="mt-1">
                                <SparklineBars values={pick("energy")} goodUp />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_soreness" as any)}</p>
                              <div className="mt-1">
                                <SparklineBars values={pick("soreness")} goodUp={false} />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t("wellness_metric_readiness" as any)}</p>
                              <div className="mt-1">
                                <SparklineBars values={pick("readiness")} goodUp />
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
                    <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{t("wellness_done_subtitle" as any)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-4">
                    <WellnessRow
                      label={t("wellness_metric_sleep" as any)}
                      tooltip={t("wellness_tooltip_sleep" as any)}
                      value={sleepQuality}
                      onValueChange={setSleepQuality}
                      disabled={upsert.isPending}
                    />
                    <WellnessRow
                      label={t("wellness_metric_energy" as any)}
                      tooltip={t("wellness_tooltip_energy" as any)}
                      value={energyLevel}
                      onValueChange={setEnergyLevel}
                      disabled={upsert.isPending}
                    />
                    <WellnessRow
                      label={t("wellness_metric_soreness" as any)}
                      tooltip={t("wellness_tooltip_soreness" as any)}
                      value={muscleSoreness}
                      onValueChange={setMuscleSoreness}
                      disabled={upsert.isPending}
                    />
                    <WellnessRow
                      label={t("wellness_metric_readiness" as any)}
                      tooltip={t("wellness_tooltip_readiness" as any)}
                      value={mentalReadiness}
                      onValueChange={setMentalReadiness}
                      disabled={upsert.isPending}
                    />
                  </div>

              <div className="mt-5 flex gap-2">
                <Button
                  className="flex-1"
                  disabled={
                    !wellnessComplete || upsert.isPending || !clubId || !userId
                  }
                  onClick={() => {
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
                  data-testid="wellness-submit"
                >
                  {upsert.isPending ? t("saving") : t("wellness_submit")}
                </Button>
                {submittedToday && wellnessEditing ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWellnessEditing(false);
                      setSleepQuality("");
                      setEnergyLevel("");
                      setMuscleSoreness("");
                      setMentalReadiness("");
                    }}
                  >
                    {t("cancel")}
                  </Button>
                ) : null}
              </div>

              {backendAvailable ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{t("wellness_persistence_note")}</p>
              ) : null}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setEditingSessionId(null);
            setShowAdvancedCreate(false);
            setAttendanceModeTouched(false);
            setCustomDurationOpen(false);
            setCustomDurationMins("");
          }
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader>
            <div className="px-5 pt-5 pb-3">
              <DialogTitle>{t("schedule_create_session_title")}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground font-medium">{t("schedule_create_session_subtitle")}</p>
            </div>
          </DialogHeader>
          <div className="px-5 pb-24 max-h-[70dvh] overflow-y-auto">
            <div className="space-y-4 pb-4">
              <div className="rounded-xl border border-border bg-card px-3 py-2">
                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                  {t("schedule_create_context" as any).replace(
                    "{when}",
                    (() => {
                      const d = createDate ? new Date(`${createDate}T00:00`) : null;
                      const labelDay = d ? new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d) : "";
                      const labelDate = d ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d) : "";
                      const mins = typeof createStartMins === "number" ? createStartMins : null;
                      const hour = typeof mins === "number" ? Math.floor(mins / 60) : null;
                      const slot =
                        typeof hour === "number" && hour >= 0 && hour < 12
                          ? t("schedule_planner_slot_morning" as any)
                          : typeof hour === "number" && hour < 17
                            ? t("schedule_planner_slot_midday" as any)
                            : t("schedule_planner_slot_evening" as any);
                      return `${labelDay} · ${slot} · ${labelDate}`;
                    })(),
                  )}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black tracking-widest uppercase text-muted-foreground">
                  {t("schedule_session_type")}
                </p>
                <ToggleGroup
                  type="single"
                  value={createSessionType}
                  onValueChange={(v) => {
                    if (!v) return;
                    setCreateSessionType(v as any);
                    setCustomDurationOpen(false);
                    setCustomDurationMins("");
                  }}
                  className="mt-2 justify-start flex-wrap gap-2"
                >
                  {(
                    showAdvancedCreate || isEditing || createSessionType === "other"
                      ? (["training", "match", "recovery", "travel", "meeting", "other"] as const)
                      : (["training", "match", "recovery", "travel", "meeting"] as const)
                  ).map((k) => (
                    <ToggleGroupItem key={k} value={k} size="sm" variant="outline" className="h-9 px-3">
                      {t(ACTIVITY_TYPE_CONFIG[k].labelKey)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0 rounded-xl border border-border bg-card p-3">
                  <p className="text-[11px] font-black tracking-widest uppercase text-muted-foreground">
                    {t("schedule_session_start_time")}
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <div
                      className="grid items-center gap-2"
                      style={{ gridTemplateColumns: "1fr minmax(5.75rem, 1.2fr) 1fr" }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 px-0 w-full font-black"
                        onClick={() => adjustStartTimeMins(-15)}
                      >
                        -15
                      </Button>
                      <input
                        className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-[15px] leading-none text-center tabular-nums"
                        type="time"
                        value={createStartTime}
                        onChange={(e) => {
                          const mins = parseTimeHHMMToTotalMinutes(e.target.value);
                          setCreateStartMins(mins);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 px-0 w-full font-black"
                        onClick={() => adjustStartTimeMins(15)}
                      >
                        +15
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-border bg-card p-3">
                  <p className="text-[11px] font-black tracking-widest uppercase text-muted-foreground">
                    {t("schedule_duration_presets")}
                  </p>
                  {createSessionType === "travel" ? (
                    <div className="mt-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
                      <p className="text-sm font-semibold text-muted-foreground">{t("schedule_travel_uses_block_time" as any)}</p>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {durationOptions.map((m) => (
                          <Button
                            key={m}
                            type="button"
                            size="sm"
                            variant={durationMins === m ? "secondary" : "outline"}
                            className="h-9 px-3"
                            onClick={() => {
                              setCustomDurationOpen(false);
                              setCustomDurationMins("");
                              applyDurationPreset(m);
                            }}
                          >
                            {m}′
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant={customDurationOpen || (durationMins != null && !durationOptions.includes(durationMins)) ? "secondary" : "outline"}
                          className="h-9 px-3"
                          onClick={() => setCustomDurationOpen((v) => !v)}
                        >
                          {t("schedule_duration_custom" as any)}
                        </Button>
                      </div>
                      {customDurationOpen ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-sm"
                            inputMode="numeric"
                            value={customDurationMins}
                            onChange={(e) => setCustomDurationMins(e.target.value)}
                            placeholder={t("schedule_minutes" as any)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={() => {
                              const n = Number(customDurationMins);
                              if (!Number.isFinite(n) || n <= 0) return;
                              applyDurationPreset(Math.round(n));
                            }}
                          >
                            {t("apply" as any)}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] font-black tracking-widest uppercase text-muted-foreground">
                  {t("schedule_attendance_mode")}
                </p>
                <ToggleGroup
                  type="single"
                  value={attendanceMode}
                  onValueChange={(v) => {
                    if (!v) return;
                    setAttendanceMode(v as any);
                    setAttendanceModeTouched(true);
                  }}
                  className="mt-2 justify-start flex-wrap gap-2"
                >
                  <ToggleGroupItem value="all_team" size="sm" variant="outline" className="h-8 px-2.5">
                    {t("schedule_attendance_mode_all_team")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="groups" size="sm" variant="outline" className="h-8 px-2.5">
                    {t("schedule_attendance_mode_groups")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="signup" size="sm" variant="outline" className="h-8 px-2.5">
                    {t("schedule_attendance_mode_signup")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="selected_players" size="sm" variant="outline" className="h-8 px-2.5">
                    {t("schedule_attendance_mode_selected_players")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {attendanceMode === "groups" ? (
                <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border bg-background/40 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">{t("schedule_groups_count")}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 px-0"
                          onClick={() =>
                            setGroupsCount((prev) => {
                              const n = Math.max(2, Math.min(6, Number(prev) || 2));
                              return String(Math.max(2, n - 1));
                            })
                          }
                        >
                          −
                        </Button>
                        <p className="text-lg font-black text-foreground">{Math.max(2, Math.min(6, Number(groupsCount) || 2))}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 px-0"
                          onClick={() =>
                            setGroupsCount((prev) => {
                              const n = Math.max(2, Math.min(6, Number(prev) || 2));
                              return String(Math.min(6, n + 1));
                            })
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-background/40 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">{t("schedule_group_capacity")}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 px-0"
                          onClick={() =>
                            setGroupCapacity((prev) => {
                              const n = Math.max(0, Number(prev) || 0);
                              return String(Math.max(0, n - 1));
                            })
                          }
                        >
                          −
                        </Button>
                        <p className="text-lg font-black text-foreground">{Math.max(0, Number(groupCapacity) || 0) || "—"}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 px-0"
                          onClick={() =>
                            setGroupCapacity((prev) => {
                              const n = Math.max(0, Number(prev) || 0);
                              return String(Math.min(99, n + 1));
                            })
                          }
                        >
                          +
                        </Button>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{t("schedule_capacity_unlimited_hint" as any)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">{t("schedule_groups_assignment_mode")}</p>
                    <ToggleGroup
                      type="single"
                      value={groupSignupMode}
                      onValueChange={(v) => {
                        if (!v) return;
                        setGroupSignupMode(v as any);
                      }}
                      className="justify-end flex-wrap gap-2"
                    >
                      <ToggleGroupItem value="coach_assign" size="sm" variant="outline" className="h-8 px-2.5">
                        {t("schedule_groups_mode_coach_assign")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="auto_signup" size="sm" variant="outline" className="h-8 px-2.5">
                        {t("schedule_groups_mode_auto_signup")}
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {groupSignupMode === "coach_assign" ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t("schedule_coach_group_assign")}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("schedule_groups_assigned_count" as any).replace("{count}", String(Object.keys(coachGroupAssignments).length))}
                        </p>
                      </div>
                      <Button type="button" variant="outline" className="h-9" onClick={() => setGroupAssignOpen(true)}>
                        {t("schedule_assign_players" as any)}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : attendanceMode === "selected_players" ? (
                <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t("schedule_selected_players_quick" as any)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("schedule_selected_players_hint").replace("{count}", String(selectedPlayerIds.size))}
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="h-9" onClick={() => setChoosePlayersOpen(true)}>
                    {t("schedule_choose_players" as any)}
                  </Button>
                </div>
              ) : null}

              {(() => {
                const hasAdvanced =
                  !createAttendanceRequired ||
                  Boolean(targetAttendance.trim()) ||
                  Boolean(maxCapacity.trim()) ||
                  Boolean(createNotes.trim()) ||
                  Boolean(groupName.trim()) ||
                  Boolean(signupDeadline.trim()) ||
                  Boolean(signupMaxSpots.trim()) ||
                  selectedPlayerIds.size > 0 ||
                  (repeatEnabled && !isEditing);
                return (
                  <details
                    className="rounded-xl border border-border bg-card p-3"
                    open={showAdvancedCreate}
                    onToggle={(e) => setShowAdvancedCreate((e.currentTarget as HTMLDetailsElement).open)}
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-foreground">
                          {t("schedule_advanced_options" as any)}
                        </p>
                        {hasAdvanced && !showAdvancedCreate ? (
                          <span className="text-[11px] font-semibold text-muted-foreground">•</span>
                        ) : null}
                      </div>
                    </summary>

                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_session_title")}</p>
                        <input
                          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                          value={createTitle}
                          onChange={(e) => setCreateTitle(e.target.value)}
                          placeholder={t("schedule_optional")}
                        />
                      </div>

                      <div className="rounded-xl border border-border bg-background/40 p-3">
                        <p className="text-xs font-semibold text-muted-foreground">{t("schedule_create_location" as any)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(() => {
                            const k = createSessionType;
                            const keys =
                              k === "training"
                                ? (["schedule_loc_training_court", "schedule_loc_training_strength", "schedule_loc_training_outdoor"] as const)
                                : k === "match"
                                  ? (["schedule_loc_match_arena", "schedule_loc_match_home", "schedule_loc_match_away"] as const)
                                  : k === "recovery"
                                    ? (["schedule_loc_recovery_room", "schedule_loc_recovery_pool", "schedule_loc_recovery_physio"] as const)
                                    : k === "travel"
                                      ? (["schedule_loc_travel_airport", "schedule_loc_travel_bus", "schedule_loc_travel_hotel"] as const)
                                      : (["schedule_loc_meeting_video", "schedule_loc_meeting_room"] as const);
                            return keys.map((kk) => (
                              <Button
                                key={kk}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                onClick={() => setCreateLocation(t(kk as any))}
                              >
                                {t(kk as any)}
                              </Button>
                            ));
                          })()}
                        </div>
                        <div className="mt-2">
                          <input
                            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                            value={createLocation}
                            onChange={(e) => setCreateLocation(e.target.value)}
                            placeholder={t(createLocationPlaceholderKey as any)}
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_session_end_time")}</p>
                        <input
                          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                          type="time"
                          value={createEndTime}
                          onChange={(e) => setCreateEndTime(e.target.value)}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_session_notes")}</p>
                        <textarea
                          className="w-full min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                          value={createNotes}
                          onChange={(e) => setCreateNotes(e.target.value)}
                          placeholder={t("schedule_session_notes_placeholder")}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_group_name")}</p>
                        <input
                          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder={t("schedule_optional")}
                        />
                      </div>

                      <div className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
                        <label className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-foreground">{t("schedule_session_attendance_required")}</span>
                          <input
                            type="checkbox"
                            checked={createAttendanceRequired}
                            onChange={(e) => setCreateAttendanceRequired(e.target.checked)}
                          />
                        </label>
                        {createAttendanceRequired ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_target_attendance")}</p>
                              <div className="h-10 rounded-md border border-border bg-background px-2 flex items-center justify-between gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 px-0"
                                  onClick={() =>
                                    setTargetAttendance((prev) => {
                                      const n = Math.max(0, Number(prev) || 0);
                                      return String(Math.max(0, n - 1));
                                    })
                                  }
                                >
                                  −
                                </Button>
                                <p className="text-sm font-black text-foreground tabular-nums">
                                  {Math.max(0, Number(targetAttendance) || 0) || "—"}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 px-0"
                                  onClick={() =>
                                    setTargetAttendance((prev) => {
                                      const n = Math.max(0, Number(prev) || 0);
                                      return String(Math.min(99, n + 1));
                                    })
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("schedule_max_capacity")}</p>
                              <div className="h-10 rounded-md border border-border bg-background px-2 flex items-center justify-between gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 px-0"
                                  onClick={() =>
                                    setMaxCapacity((prev) => {
                                      const n = Math.max(0, Number(prev) || 0);
                                      return String(Math.max(0, n - 1));
                                    })
                                  }
                                >
                                  −
                                </Button>
                                <p className="text-sm font-black text-foreground tabular-nums">
                                  {Math.max(0, Number(maxCapacity) || 0) || "—"}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 px-0"
                                  onClick={() =>
                                    setMaxCapacity((prev) => {
                                      const n = Math.max(0, Number(prev) || 0);
                                      return String(Math.min(99, n + 1));
                                    })
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {attendanceMode === "signup" ? (
                        <div className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              {t("schedule_signup_deadline")}
                            </p>
                            <input
                              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                              type="datetime-local"
                              value={signupDeadline}
                              onChange={(e) => setSignupDeadline(e.target.value)}
                            />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              {t("schedule_signup_max_spots")}
                            </p>
                            <input
                              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                              inputMode="numeric"
                              value={signupMaxSpots}
                              onChange={(e) => setSignupMaxSpots(e.target.value)}
                              placeholder={t("schedule_optional")}
                            />
                          </div>
                        </div>
                      ) : null}

                      {attendanceMode === "selected_players" ? (
                        <div className="rounded-xl border border-border bg-background/40 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">{t("schedule_attendance_mode_selected_players")}</p>
                          <div className="rounded-lg border border-border bg-background/40 p-3 max-h-44 overflow-y-auto">
                            {rosterPlayers.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t("schedule_no_roster_players")}</p>
                            ) : (
                              rosterPlayers.map((m) => {
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
                          <p className="text-[11px] text-muted-foreground">
                            {t("schedule_selected_players_hint").replace("{count}", String(selectedPlayerIds.size))}
                          </p>
                        </div>
                      ) : null}

                      {!isEditing ? (
                        <details className="rounded-xl border border-border bg-background/40 p-3">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-foreground">{t("schedule_repeat")}</span>
                              <span className="text-xs font-semibold text-muted-foreground">{t("schedule_repeat_advanced")}</span>
                            </div>
                          </summary>
                          <div className="mt-3">
                            <label className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-foreground">{t("schedule_repeat_session")}</span>
                              <input type="checkbox" checked={repeatEnabled} onChange={(e) => setRepeatEnabled(e.target.checked)} />
                            </label>
                            {repeatEnabled ? (
                              <div className="mt-3 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-muted-foreground">{t("schedule_repeat_weeks")}</p>
                                  <select
                                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                                    value={repeatWeeks}
                                    onChange={(e) => setRepeatWeeks(Number(e.target.value) as any)}
                                  >
                                    {[1, 2, 3, 4, 6, 8].map((w) => (
                                      <option key={w} value={w}>
                                        {t("schedule_repeat_weeks_value").replace("{weeks}", String(w))}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">{t("schedule_repeat_weekdays")}</p>
                                  <ToggleGroup
                                    type="multiple"
                                    value={Array.from(repeatWeekdays).map(String)}
                                    onValueChange={(vals) => setRepeatWeekdays(new Set((vals ?? []).map((v) => Number(v))))}
                                    className="justify-start flex-wrap gap-2"
                                  >
                                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                                      <ToggleGroupItem key={d} value={String(d)} size="sm" variant="outline" className="h-9 px-3">
                                        {new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(new Date(2024, 0, 7 + d))}
                                      </ToggleGroupItem>
                                    ))}
                                  </ToggleGroup>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </details>
                );
              })()}

              {/* Summary card removed for compact default create sheet */}

              {/* Advanced fields above replace older scattered blocks */}

              {createEventMut.isError ? <p className="text-sm text-destructive">{t("schedule_create_session_error")}</p> : null}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-md px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="h-11">
                {t("close")}
              </Button>
                <Button
                  className="h-11 flex-1 font-black"
                  disabled={!canSubmitCreate || createEventMut.isPending || updateEventMut.isPending}
                  onClick={() => {
                    const doReset = () => {
                      pushRecentLocation(createLocation);
                      setCreateOpen(false);
                      setEditingSessionId(null);
                      setShowAdvancedCreate(false);
                      setCreateSessionType("training");
                      setCreateTitle("");
                      setCreateDate("");
                      setCreateStartMins(null);
                      setCreateEndTime("");
                      setCreateLocation("");
                      setCreateNotes("");
                      setCreateAttendanceRequired(true);
                      setUseCustomDateTime(false);
                      setDurationMins(null);
                      setRepeatEnabled(false);
                      setRepeatWeeks(4);
                      setRepeatWeekdays(new Set([1, 3, 5]));
                      setTargetAttendance("");
                      setMaxCapacity("");
                      setGroupName("");
                      setAttendanceMode("all_team");
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
                    };
                    void runCreateOrUpdate()
                      .then(() => {
                        toast({ description: editingSessionId ? t("schedule_edit_saved") : t("schedule_create_session_saved") });
                        doReset();
                      })
                      .catch(() =>
                        toast({
                          variant: "destructive",
                          description: editingSessionId ? t("schedule_edit_error") : t("schedule_create_session_error"),
                        }),
                      );
                  }}
                >
                  {createEventMut.isPending || updateEventMut.isPending
                    ? t("saving")
                    : editingSessionId
                      ? t("schedule_edit_save")
                      : t("schedule_create_session_save")}
                </Button>
            </div>
            {!canSubmitCreate ? (
              <p className="mt-2 text-[11px] text-muted-foreground">{t("schedule_create_validation_hint")}</p>
            ) : null}
          </div>
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
                  const label = `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start)}–${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(end)}`;
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
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    value={weekTemplateLoad}
                    onChange={(e) => setWeekTemplateLoad((e.target.value as any) || "all")}
                  >
                    <option value="all">{t("schedule_load_any" as any)}</option>
                    <option value="low">{t("schedule_load_low" as any)}</option>
                    <option value="medium">{t("schedule_load_medium" as any)}</option>
                    <option value="high">{t("schedule_load_high" as any)}</option>
                  </select>
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
                setSaveWeekTemplateOpen(true);
              }}
            >
              {t("schedule_week_template_save")}
            </Button>

            {(plannerWeekQ.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">{t("schedule_week_template_save_empty_hint")}</p>
            ) : null}

            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                        <p className="text-[11px] font-semibold text-muted-foreground truncate">
                          {t("schedule_week_template_sessions").replace("{count}", String(tpl.sessions.length))}
                          {tpl.lastUsedAt ? ` · ${t("schedule_week_template_last_used")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          aria-label={t("schedule_favorite_toggle" as any)}
                          onClick={() => {
                            persistWeekTemplates(
                              weekTemplates.map((t2) => (t2.id === tpl.id ? { ...t2, favorite: !t2.favorite, updatedAt: new Date().toISOString() } : t2)),
                            );
                          }}
                        >
                          <span className="text-base leading-none">{tpl.favorite ? "★" : "☆"}</span>
                        </button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
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
                          className="h-8"
                          onClick={() => {
                            setEditingWeekTemplateId(tpl.id);
                            setWeekTemplateName(tpl.name);
                            setWeekTemplateNotes(tpl.notes ?? "");
                            setWeekTemplateFavorite(Boolean(tpl.favorite));
                            setWeekTemplateEditPhase((tpl.phase ?? "regular") as any);
                            setSaveWeekTemplateOpen(true);
                          }}
                        >
                          {t("edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => duplicateWeekTemplate(tpl)}
                        >
                          {t("schedule_week_template_duplicate")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive border-destructive/30"
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
                  value={(weekTemplates.find((x) => x.id === editingWeekTemplateId)?.load_level ?? "medium") as any}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    setWeekTemplates((prev) =>
                      prev.map((t2) => (t2.id === editingWeekTemplateId ? { ...t2, load_level: v, updatedAt: new Date().toISOString() } : t2)),
                    );
                  }}
                  disabled={!editingWeekTemplateId}
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
                  value={String(weekTemplates.find((x) => x.id === editingWeekTemplateId)?.games_count ?? 0)}
                  onChange={(e) => {
                    const v = Number(e.target.value) as any;
                    setWeekTemplates((prev) =>
                      prev.map((t2) => (t2.id === editingWeekTemplateId ? { ...t2, games_count: v, updatedAt: new Date().toISOString() } : t2)),
                    );
                  }}
                  disabled={!editingWeekTemplateId}
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
                  value={weekTemplates.find((x) => x.id === editingWeekTemplateId)?.tags ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWeekTemplates((prev) =>
                      prev.map((t2) => (t2.id === editingWeekTemplateId ? { ...t2, tags: v, updatedAt: new Date().toISOString() } : t2)),
                    );
                  }}
                  placeholder={t("schedule_tags_placeholder" as any)}
                  disabled={!editingWeekTemplateId}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveWeekTemplateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!weekTemplateName.trim() || (plannerWeekQ.data?.length ?? 0) === 0}
              onClick={() => {
                const now = new Date().toISOString();
                const id = editingWeekTemplateId ?? `wktpl-${Math.random().toString(16).slice(2)}`;
                const existing = weekTemplates.find((x) => x.id === id);
                const sessions = buildWeekTemplateFromCurrentWeek();
                const tpl: WeekTemplate = {
                  id,
                  name: weekTemplateName.trim(),
                  notes: weekTemplateNotes.trim() ? weekTemplateNotes.trim() : null,
                  phase: weekTemplateEditPhase ?? existing?.phase ?? "regular",
                  games_count: existing?.games_count ?? 0,
                  load_level: existing?.load_level ?? "medium",
                  tags: existing?.tags ?? "",
                  favorite: weekTemplateFavorite,
                  createdAt: existing?.createdAt ?? now,
                  updatedAt: now,
                  lastUsedAt: existing?.lastUsedAt,
                  sessions: sessions.length > 0 ? sessions : existing?.sessions ?? [],
                };
                upsertWeekTemplate(tpl);
                toast({ description: t("schedule_week_template_saved") });
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
                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
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
                            {list.slice(0, 4).map((s, idx) => {
                              const hh = String(Math.floor(s.startMins / 60)).padStart(2, "0");
                              const mm = String(s.startMins % 60).padStart(2, "0");
                              return (
                                <p key={idx} className="text-[11px] font-semibold text-muted-foreground truncate">
                                  {hh}:{mm} · {s.title}
                                </p>
                              );
                            })}
                            {list.length > 4 ? (
                              <p className="text-[11px] font-semibold text-muted-foreground">
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
                              "h-8 w-8 rounded-md border text-xs font-black transition-colors",
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
                          <p className="text-[11px] font-semibold text-muted-foreground">{inGroup(idx).length}</p>
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
}) {
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
        <p className="text-[11px] text-muted-foreground mt-0.5">{props.value ? "Selected" : "1–5"}</p>
      </div>
      <ToggleGroup
        type="single"
        value={props.value}
        onValueChange={(v) => props.onValueChange(v || "")}
        className="justify-end"
        disabled={props.disabled}
      >
        {["1", "2", "3", "4", "5"].map((n) => (
          <ToggleGroupItem
            key={n}
            value={n}
            size="sm"
            variant="outline"
            className={[
              "h-10 w-10 px-0 text-sm font-black",
              "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm",
            ].join(" ")}
          >
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{props.label}</p>
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

function KpiCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">{props.title}</p>
      <p className="mt-2 text-xl font-black tracking-tight text-foreground">{props.value}</p>
      {props.subtitle ? <p className="mt-1 text-[11px] text-muted-foreground">{props.subtitle}</p> : null}
    </div>
  );
}

function SessionRow(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-foreground truncate">{props.title}</p>
        {props.subtitle ? (
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground truncate">{props.subtitle}</p>
        ) : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

