import { useCallback, useMemo, useState } from "react";
import { formatTimeHHMMFromParts, formatTimeHHMMFromTotalMinutes } from "@/lib/timeHHMM";
import type { ScheduleEvent } from "@/lib/schedule";

export type AttendanceMode = "all_team" | "groups" | "signup" | "selected_players";
export type GroupSignupMode = "coach_assign" | "auto_signup";

export type SessionTemplate = {
  id: string;
  name: string;
  session_type: ScheduleEvent["session_type"];
  title: string;
  location: string | null;
  notes: string | null;
  attendance_required: boolean;
  constraints?: { target_attendance?: number; max_capacity?: number; group_name?: string };
};

export type SessionNotesConstraints = {
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
};

export function readConstraintsFromNotes(notes: string | null | undefined): {
  notesClean: string | null;
  constraints: SessionNotesConstraints;
} {
  const raw = notes ?? "";
  const marker = "\nOPS:";
  const idx = raw.lastIndexOf(marker);
  if (idx === -1) return { notesClean: raw.trim() || null, constraints: {} };
  const jsonPart = raw.slice(idx + marker.length).trim();
  const notesClean = raw.slice(0, idx).trim() || null;
  try {
    const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
    const c: SessionNotesConstraints = {};
    if (typeof parsed?.target_attendance === "number") c.target_attendance = parsed.target_attendance;
    if (typeof parsed?.max_capacity === "number") c.max_capacity = parsed.max_capacity;
    if (typeof parsed?.group_name === "string") c.group_name = parsed.group_name;
    if (Array.isArray(parsed?.tags)) c.tags = parsed.tags.filter((x): x is string => typeof x === "string");
    if (parsed?.subgroups && typeof parsed.subgroups === "object") {
      c.subgroups = parsed.subgroups as SessionNotesConstraints["subgroups"];
    }
    if (parsed?.attendance && typeof parsed.attendance === "object") {
      c.attendance = parsed.attendance as SessionNotesConstraints["attendance"];
    }
    return { notesClean, constraints: c };
  } catch {
    return { notesClean: raw.trim() || null, constraints: {} };
  }
}

export function writeConstraintsToNotes(
  baseNotes: string | null,
  constraints: SessionNotesConstraints,
): string | null {
  const clean = (baseNotes ?? "").trim();
  const hasAny = Object.values(constraints).some((v) => v !== undefined && v !== null && String(v).trim() !== "");
  if (!hasAny) return clean || null;
  const payload = JSON.stringify(constraints);
  return `${clean || ""}${clean ? "\n\n" : ""}OPS:${payload}`.trim();
}

type CreateEventMut = {
  mutateAsync: (input: {
    club_id: string;
    session_type: ScheduleEvent["session_type"];
    title: string;
    starts_at: string;
    ends_at: string | null;
    location: string | null;
    notes: string | null;
    attendance_required: boolean;
    created_by: string;
  }) => Promise<unknown>;
};

type UpdateEventMut = {
  mutateAsync: (input: {
    id: string;
    club_id: string;
    patch: {
      session_type: ScheduleEvent["session_type"];
      title: string;
      starts_at: string;
      ends_at: string | null;
      location: string | null;
      notes: string | null;
      attendance_required: boolean;
    };
  }) => Promise<unknown>;
};

export type RunCreateOrUpdateCtx = {
  clubId: string | undefined;
  userId: string | undefined;
  editingSessionId: string | null;
  createEventMut: CreateEventMut;
  updateEventMut: UpdateEventMut;
  defaultTitle: string;
};

export function useSessionForm() {
  const [createSessionType, setCreateSessionType] = useState<ScheduleEvent["session_type"]>("training");
  const [createTitle, setCreateTitle] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createStartMins, setCreateStartMins] = useState<number | null>(null);
  const [createEndTime, setCreateEndTime] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createAttendanceRequired, setCreateAttendanceRequired] = useState(true);
  const [useCustomDateTime, setUseCustomDateTime] = useState(false);
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState<1 | 2 | 3 | 4 | 6 | 8>(4);
  const [repeatWeekdays, setRepeatWeekdays] = useState<Set<number>>(() => new Set([1, 3, 5]));
  const [targetAttendance, setTargetAttendance] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [groupName, setGroupName] = useState("");
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
  const [trainingTags, setTrainingTags] = useState<Set<string>>(() => new Set());
  const [subgroupCount, setSubgroupCount] = useState("");
  const [subgroupMinutes, setSubgroupMinutes] = useState("");

  const createStartTime = useMemo(() => {
    return typeof createStartMins === "number" && Number.isFinite(createStartMins)
      ? formatTimeHHMMFromTotalMinutes(createStartMins)
      : "";
  }, [createStartMins]);

  const signupMaxSpotsOk = useMemo(() => {
    const raw = signupMaxSpots.trim();
    if (!raw) return true;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1;
  }, [signupMaxSpots]);

  const applyDurationPreset = useCallback(
    (mins: number) => {
      setDurationMins(mins);
      if (!createDate || createStartMins == null) return;
      const start = new Date(`${createDate}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`);
      if (Number.isNaN(start.getTime())) return;
      const end = new Date(start.getTime() + mins * 60000);
      setCreateEndTime(formatTimeHHMMFromParts(end.getHours(), end.getMinutes()));
      setUseCustomDateTime(true);
    },
    [createDate, createStartMins],
  );

  const applyQuickPick = useCallback((pick: "today_evening" | "tomorrow_morning" | "tomorrow_evening") => {
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
  }, []);

  const doReset = useCallback(() => {
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
    setGroupAssignOpen(false);
    setChoosePlayersOpen(false);
    setTrainingTags(new Set());
    setSubgroupCount("");
    setSubgroupMinutes("");
  }, []);

  const runCreateOrUpdate = useCallback(
    async (ctx: RunCreateOrUpdateCtx, opts?: { overrideTemplate?: SessionTemplate | null; dateOverride?: string }) => {
      const { clubId, userId, editingSessionId, createEventMut, updateEventMut, defaultTitle } = ctx;
      if (!clubId || !userId) return;
      if (!createDate || createStartMins == null) return;
      if (attendanceMode === "selected_players" && selectedPlayerIds.size < 1) return;
      if (!signupMaxSpotsOk) return;
      const baseTitle = (opts?.overrideTemplate ? opts.overrideTemplate.title : createTitle).trim();
      const title = baseTitle || defaultTitle;
      const dateStr = opts?.dateOverride ?? createDate;
      const startsIso = new Date(`${dateStr}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`).toISOString();
      const endsIso = createEndTime
        ? new Date(`${dateStr}T${createEndTime}`).toISOString()
        : durationMins && durationMins > 0
          ? new Date(
              new Date(`${dateStr}T${formatTimeHHMMFromTotalMinutes(createStartMins)}`).getTime() +
                durationMins * 60000,
            ).toISOString()
          : null;
      const constraints: SessionNotesConstraints = {
        target_attendance: targetAttendance.trim() ? Number(targetAttendance) : undefined,
        max_capacity: maxCapacity.trim() ? Number(maxCapacity) : undefined,
        group_name: groupName.trim() ? groupName.trim() : undefined,
        attendance: {
          mode: attendanceMode,
          groups_count: attendanceMode === "groups" && groupsCount.trim() ? Number(groupsCount) : undefined,
          group_capacity: attendanceMode === "groups" && groupCapacity.trim() ? Number(groupCapacity) : undefined,
          group_signup_mode: attendanceMode === "groups" ? groupSignupMode : undefined,
          coach_assignments:
            attendanceMode === "groups" &&
            groupSignupMode === "coach_assign" &&
            Object.keys(coachGroupAssignments).length > 0
              ? coachGroupAssignments
              : undefined,
          signup_deadline: attendanceMode === "signup" && signupDeadline.trim() ? signupDeadline.trim() : undefined,
          signup_max_spots: attendanceMode === "signup" && signupMaxSpots.trim() ? Number(signupMaxSpots) : undefined,
          selected_player_ids:
            attendanceMode === "selected_players" && selectedPlayerIds.size > 0
              ? Array.from(selectedPlayerIds)
              : undefined,
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
    },
    [
      attendanceMode,
      coachGroupAssignments,
      createAttendanceRequired,
      createDate,
      createEndTime,
      createLocation,
      createNotes,
      createSessionType,
      createStartMins,
      createTitle,
      durationMins,
      groupCapacity,
      groupName,
      groupSignupMode,
      groupsCount,
      maxCapacity,
      selectedPlayerIds,
      signupDeadline,
      signupMaxSpots,
      signupMaxSpotsOk,
      subgroupCount,
      subgroupMinutes,
      targetAttendance,
      trainingTags,
    ],
  );

  return {
    createSessionType,
    setCreateSessionType,
    createTitle,
    setCreateTitle,
    createDate,
    setCreateDate,
    createStartMins,
    setCreateStartMins,
    createEndTime,
    setCreateEndTime,
    createLocation,
    setCreateLocation,
    createNotes,
    setCreateNotes,
    createAttendanceRequired,
    setCreateAttendanceRequired,
    useCustomDateTime,
    setUseCustomDateTime,
    durationMins,
    setDurationMins,
    repeatEnabled,
    setRepeatEnabled,
    repeatWeeks,
    setRepeatWeeks,
    repeatWeekdays,
    setRepeatWeekdays,
    targetAttendance,
    setTargetAttendance,
    maxCapacity,
    setMaxCapacity,
    groupName,
    setGroupName,
    attendanceMode,
    setAttendanceMode,
    attendanceModeTouched,
    setAttendanceModeTouched,
    groupsCount,
    setGroupsCount,
    groupCapacity,
    setGroupCapacity,
    groupSignupMode,
    setGroupSignupMode,
    coachGroupAssignments,
    setCoachGroupAssignments,
    signupDeadline,
    setSignupDeadline,
    signupMaxSpots,
    setSignupMaxSpots,
    selectedPlayerIds,
    setSelectedPlayerIds,
    customDurationOpen,
    setCustomDurationOpen,
    customDurationMins,
    setCustomDurationMins,
    groupAssignOpen,
    setGroupAssignOpen,
    choosePlayersOpen,
    setChoosePlayersOpen,
    trainingTags,
    setTrainingTags,
    subgroupCount,
    setSubgroupCount,
    subgroupMinutes,
    setSubgroupMinutes,
    createStartTime,
    signupMaxSpotsOk,
    applyDurationPreset,
    applyQuickPick,
    doReset,
    runCreateOrUpdate,
  };
}

export type SessionForm = ReturnType<typeof useSessionForm>;
