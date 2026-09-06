import { Dumbbell, HeartPulse, Trophy, Bus, Video, CalendarDays } from "lucide-react";
import type { ScheduleEvent } from "@/lib/schedule";
import type { AttendanceMode } from "@/lib/useSessionForm";
import type { I18nKey } from "@/lib/i18n";

type LoadWeight = "low" | "medium" | "high";
type ActivityTypeConfig = {
  value: ScheduleEvent["session_type"];
  labelKey: I18nKey;
  icon: typeof Dumbbell;
  defaultDuration: number;
  allowedDurations: number[];
  defaultAttendanceMode: AttendanceMode;
  defaultGearHint: "ball" | "weights" | "travel" | "video" | "none";
  loadWeight: LoadWeight;
};

export const ACTIVITY_TYPE_CONFIG: Record<ScheduleEvent["session_type"], ActivityTypeConfig> = {
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
