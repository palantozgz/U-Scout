import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatTimeHHMMFromTotalMinutes, parseTimeHHMMToTotalMinutes } from "@/lib/timeHHMM";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/scheduleActivityConfig";
import type { ScheduleEvent } from "@/lib/schedule";
import type { ClubMemberDto } from "@/lib/club-api";
import type { SessionForm } from "@/lib/useSessionForm";
import type { I18nKey } from "@/lib/i18n";

function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mondayOf(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

type Translate = (key: I18nKey) => string;

type CreateEventMut = {
  isPending: boolean;
  isError: boolean;
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
  isPending: boolean;
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

export type SessionCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  editingSessionId: string | null;
  form: SessionForm;
  clubId: string | undefined;
  userId: string | undefined;
  rosterPlayers: ClubMemberDto[];
  createEventMut: CreateEventMut;
  updateEventMut: UpdateEventMut;
  pushRecentLocation: (loc: string) => void;
  t: Translate;
  locale: string;
};

export function SessionCreateDialog(props: SessionCreateDialogProps) {
  const {
    isOpen,
    onClose,
    isEditing,
    editingSessionId,
    form,
    clubId,
    userId,
    rosterPlayers,
    createEventMut,
    updateEventMut,
    pushRecentLocation,
    t,
    locale,
  } = props;

  const {
    createSessionType, setCreateSessionType,
    createTitle, setCreateTitle,
    createDate,
    createStartMins, setCreateStartMins,
    createEndTime, setCreateEndTime,
    createLocation, setCreateLocation,
    createNotes, setCreateNotes,
    createAttendanceRequired, setCreateAttendanceRequired,
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
    coachGroupAssignments,
    signupDeadline, setSignupDeadline,
    signupMaxSpots, setSignupMaxSpots,
    selectedPlayerIds, setSelectedPlayerIds,
    customDurationOpen, setCustomDurationOpen,
    customDurationMins, setCustomDurationMins,
    setGroupAssignOpen,
    setChoosePlayersOpen,
    createStartTime,
    signupMaxSpotsOk,
    applyDurationPreset,
    setUseCustomDateTime,
    doReset: resetSessionForm,
    runCreateOrUpdate: runCreateOrUpdateForm,
  } = form;

  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);

  const intlLocale = locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en";

  const canSubmitCreate = Boolean(
    clubId &&
      userId &&
      createDate &&
      createStartTime &&
      signupMaxSpotsOk &&
      (attendanceMode !== "selected_players" || selectedPlayerIds.size >= 1),
  );

  const createLocationPlaceholderKey = useMemo(() => {
    if (createSessionType === "training") return "schedule_session_location_placeholder_training";
    if (createSessionType === "recovery") return "schedule_session_location_placeholder_recovery";
    if (createSessionType === "match") return "schedule_session_location_placeholder_match";
    if (createSessionType === "travel") return "schedule_session_location_placeholder_travel";
    if (createSessionType === "meeting") return "schedule_session_location_placeholder_meeting";
    return "schedule_session_location_placeholder_other";
  }, [createSessionType]);

  useEffect(() => {
    if (!isOpen) return;
    setShowAdvancedCreate(false);
  }, [isOpen, editingSessionId]);

  useEffect(() => {
    const cfg = ACTIVITY_TYPE_CONFIG[createSessionType];
    if (createSessionType === "travel") {
      setDurationMins(null);
      setCreateEndTime("");
      setUseCustomDateTime(false);
      setCustomDurationOpen(false);
      setCustomDurationMins("");
    } else if (durationMins == null || !cfg.allowedDurations.includes(durationMins)) {
      applyDurationPreset(cfg.defaultDuration);
    }
    if (!attendanceModeTouched) setAttendanceMode(cfg.defaultAttendanceMode);
  }, [
    applyDurationPreset,
    attendanceModeTouched,
    createSessionType,
    durationMins,
    setAttendanceMode,
    setCreateEndTime,
    setCustomDurationMins,
    setCustomDurationOpen,
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

  const durationOptions = useMemo(() => ACTIVITY_TYPE_CONFIG[createSessionType].allowedDurations, [createSessionType]);

  useEffect(() => {
    if (createSessionType === "travel") return;
    if (!derivedDurationFromEndTimeMins) return;
    setDurationMins(derivedDurationFromEndTimeMins);
    setCustomDurationMins(String(derivedDurationFromEndTimeMins));
  }, [createSessionType, derivedDurationFromEndTimeMins, setCustomDurationMins, setDurationMins]);

  const adjustStartTimeMins = (deltaMins: number) => {
    if (createStartMins == null) return;
    const next = (createStartMins + deltaMins + 1440) % 1440;
    setCreateStartMins(next);
    if (durationMins) applyDurationPreset(durationMins);
  };

  const runCreateOrUpdate = async (opts?: { dateOverride?: string }) => {
    await runCreateOrUpdateForm(
      {
        clubId,
        userId,
        editingSessionId,
        createEventMut,
        updateEventMut,
        defaultTitle: t(ACTIVITY_TYPE_CONFIG[createSessionType].labelKey),
      },
      opts,
    );
  };

  return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdvancedCreate(false);
            setAttendanceModeTouched(false);
            setCustomDurationOpen(false);
            setCustomDurationMins("");
            onClose();
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
                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                  {t("schedule_create_context" as any).replace(
                    "{when}",
                    (() => {
                      const d = createDate ? new Date(`${createDate}T00:00`) : null;
                      const labelDay = d ? new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d) : "";
                      const labelDate = d ? new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(d) : "";
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
                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
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
                  <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
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
                  <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
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
                            variant={durationMins === m ? "default" : "outline"}
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
                          variant={customDurationOpen || (durationMins != null && !durationOptions.includes(durationMins)) ? "default" : "outline"}
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
                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
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
                  <ToggleGroupItem value="all_team" size="sm" variant="outline" className="h-9 px-2.5">
                    {t("schedule_attendance_mode_all_team")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="groups" size="sm" variant="outline" className="h-9 px-2.5">
                    {t("schedule_attendance_mode_groups")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="signup" size="sm" variant="outline" className="h-9 px-2.5">
                    {t("schedule_attendance_mode_signup")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="selected_players" size="sm" variant="outline" className="h-9 px-2.5">
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
                      <p className="mt-1 text-xs text-muted-foreground">{t("schedule_capacity_unlimited_hint" as any)}</p>
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
                      <ToggleGroupItem value="coach_assign" size="sm" variant="outline" className="h-9 px-2.5">
                        {t("schedule_groups_mode_coach_assign")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="auto_signup" size="sm" variant="outline" className="h-9 px-2.5">
                        {t("schedule_groups_mode_auto_signup")}
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {groupSignupMode === "coach_assign" ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t("schedule_coach_group_assign")}</p>
                        <p className="text-xs text-muted-foreground">
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
                    <p className="mt-0.5 text-xs text-muted-foreground">
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
                          <span className="text-xs font-semibold text-muted-foreground">•</span>
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
                                  className="h-9 w-8 px-0"
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
                                  className="h-9 w-8 px-0"
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
                                  className="h-9 w-8 px-0"
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
                                  className="h-9 w-8 px-0"
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
                          <p className="text-xs text-muted-foreground">
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
                                {repeatWeekdays.size > 0 && createDate ? (
                                  (() => {
                                    // Count: 1 base session + (weeks × days) extra sessions.
                                    // The extra-dates loop below always starts at week offset 1
                                    // (it never regenerates the base week), so the base date can
                                    // never coincide with a generated extra date — no subtraction needed.
                                    const total = 1 + repeatWeeks * repeatWeekdays.size;
                                    const es = locale === "es"; const zh = locale === "zh";
                                    return (
                                      <p className="text-[11px] font-bold text-primary rounded-lg bg-primary/8 border border-primary/20 px-3 py-2 text-center">
                                        {zh ? `将创建 ${total} 个训练课` : es ? `Se crearán ${total} sesiones` : `${total} sessions will be created`}
                                      </p>
                                    );
                                  })()
                                ) : null}
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
              <Button variant="outline" onClick={onClose} className="h-11">
                {t("close")}
              </Button>
                <Button
                  className="h-11 flex-1 font-black"
                  disabled={!canSubmitCreate || createEventMut.isPending || updateEventMut.isPending}
                  onClick={() => {
                    const doReset = () => {
                      pushRecentLocation(createLocation);
                      setShowAdvancedCreate(false);
                      resetSessionForm();
                      onClose();
                    };
                    void runCreateOrUpdate()
                      .then(async () => {
                        // Recurring: create copies on additional weeks/days
                        if (repeatEnabled && !editingSessionId && repeatWeekdays.size > 0) {
                          const base = new Date(`${createDate}T00:00:00`);
                          const mon = mondayOf(base);
                          const extraDates: string[] = [];
                          for (let w = 1; w <= repeatWeeks; w++) {
                            for (const jsDow of Array.from(repeatWeekdays).sort((a, b) => a - b)) {
                              const d = new Date(mon.getTime() + (w * 7 + (jsDow + 6) % 7) * 86400000);
                              const dk = localDateKey(d);
                              if (dk !== createDate) extraDates.push(dk);
                            }
                          }
                          for (const dateOverride of extraDates) {
                            await runCreateOrUpdate({ dateOverride });
                          }
                        }
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
                      : (() => {
                          if (repeatEnabled && !editingSessionId && repeatWeekdays.size > 0 && createDate) {
                            // Same formula as the preview above — must stay in sync.
                            const total = 1 + repeatWeeks * repeatWeekdays.size;
                            const es = locale === "es"; const zh = locale === "zh";
                            return zh ? `创建 ${total} 个训练课` : es ? `Crear ${total} sesiones` : `Create ${total} sessions`;
                          }
                          return t("schedule_create_session_save");
                        })()}
                </Button>
            </div>
            {!canSubmitCreate ? (
              <p className="mt-2 text-xs text-muted-foreground">{t("schedule_create_validation_hint")}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

  );
}
