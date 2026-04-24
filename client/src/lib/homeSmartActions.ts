export type StaffRole = "head_coach" | "coach" | "player" | null;

export type HomeSmartActionKind = "attendance" | "createSession" | "wellness" | "club";

export type HomeSmartAction = { kind: HomeSmartActionKind };

export type ComputeHomeSmartActionsInput = {
  staffRole: StaffRole;
  isPhysicalTrainer: boolean;
  canCreateSession: boolean;
  canManageWellness: boolean;
  pendingAttendanceCount: number;
  noSessionsToday: boolean;
  showClubChanges: boolean;
  rosterCount: number;
  wellnessPct: number | null;
};

export type ComputeHomeSmartActionsResult = {
  primary: HomeSmartAction;
  secondary: HomeSmartAction | null;
} | null;

/**
 * Pure ranking logic for Home command-center actions.
 * Presentation layer (Home.tsx) is responsible for labels/routes.
 */
export function computeHomeSmartActions(input: ComputeHomeSmartActionsInput): ComputeHomeSmartActionsResult {
  const needsAttendance = input.pendingAttendanceCount > 0;
  const needsClubReview = input.showClubChanges;
  const noSessionsToday = input.noSessionsToday;
  const wellnessPct = input.wellnessPct;

  const needsWellnessReview =
    input.canManageWellness && input.rosterCount > 0 && typeof wellnessPct === "number" && wellnessPct < 80;

  const allowed: HomeSmartActionKind[] = (() => {
    if (input.staffRole === "head_coach") return ["attendance", "createSession", "wellness", "club"];
    if (input.staffRole === "coach" && input.isPhysicalTrainer) return ["wellness", "attendance", "createSession"];
    if (input.staffRole === "coach") return ["attendance", "createSession"];
    return [];
  })();

  const triggered = (k: HomeSmartActionKind): boolean => {
    if (k === "attendance") return needsAttendance;
    if (k === "createSession") return noSessionsToday && input.canCreateSession;
    if (k === "wellness") return needsWellnessReview;
    if (k === "club") return needsClubReview;
    return false;
  };

  const primaryKind = allowed.find((k) => triggered(k)) ?? null;
  if (!primaryKind) return null;

  const secondaryKind = allowed.find((k) => k !== primaryKind && triggered(k)) ?? null;

  return {
    primary: { kind: primaryKind },
    secondary: secondaryKind ? { kind: secondaryKind } : null,
  };
}

