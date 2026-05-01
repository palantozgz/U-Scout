import { useMemo } from "react";
import { useAuth, type AppUserRole, type UserProfile } from "@/lib/useAuth";

export type ClubMembership = {
  clubId: string;
  userId: string;
  /** Club member role (not auth role). */
  role: "head_coach" | "coach" | "player";
  status: "active" | "pending" | "banned";
  /** Whether this user is the club owner. */
  isOwner?: boolean;
  /** Operations badge for coaches (granted by head coach). */
  operationsAccess?: boolean;
};

export type Capabilities = {
  /** Real staff tier (for product logic). */
  staffRole: "head_coach" | "coach" | "player" | null;
  /** Coach badge: capability-level (not an auth role). */
  isPhysicalTrainer: boolean;
  canViewCoachUI: boolean;
  canManageClub: boolean;
  canInviteMembers: boolean;
  canEditClub: boolean;
  canSeeAdminActions: boolean;
  canCreateEvent: boolean;
  canAccessReports: boolean;
  /** Only head_coach and master can access Personnel to create/manage canonical profiles. */
  canAccessPersonnel: boolean;
  /** Only head_coach and master can promote/create canonical profiles. */
  canCreateCanonical: boolean;
  canUsePlayerUX: boolean;
  /** Staff capability: can view/manage wellness operations. */
  canManageWellness: boolean;
};

export type CoachBadges = {
  physical_trainer?: boolean;
};

export function readCoachBadges(_profile: UserProfile | null): CoachBadges {
  // TODO(physical_trainer): wire to a real badge source (e.g., club_members.badges, profile metadata, or a server-provided capability map).
  // Do NOT infer or fabricate. Default is false until an authoritative source exists.
  return { physical_trainer: false };
}

export function computeCapabilities(input: {
  realRole: AppUserRole | null;
  effectiveRole: AppUserRole | null;
  membership?: ClubMembership | null;
  badges?: CoachBadges | null;
}): Capabilities {
  const realRole = input.realRole;
  const effectiveRole = input.effectiveRole;
  const m = input.membership ?? null;
  const badges = input.badges ?? null;

  const canUsePlayerUX = effectiveRole === "player";
  const canViewCoachUI = !canUsePlayerUX;

  const staffRole: Capabilities["staffRole"] =
    realRole === "head_coach" ? "head_coach" : realRole === "coach" ? "coach" : realRole === "player" ? "player" : null;

  const isPhysicalTrainer = Boolean(badges?.physical_trainer) && staffRole === "coach";
  const hasOperationsAccess = Boolean(m?.operationsAccess) && staffRole === "coach" && m?.status === "active";

  // UI-only capability (frontend rendering).
  const canCreateEvent =
    canViewCoachUI && (effectiveRole === "master" || effectiveRole === "head_coach" || effectiveRole === "coach");

  // Permission-oriented capability: prefer realRole + membership, never effectiveRole.
  const canManageClub = (() => {
    if (!realRole) return false;
    if (realRole === "master") return true;
    if (!m) return false;
    if (m.status !== "active") return false;
    if (m.isOwner) return true;
    return m.role === "head_coach" || m.role === "coach";
  })();

  const canInviteMembers = canManageClub;

  const canEditClub = (() => {
    if (!realRole) return false;
    if (realRole === "master") return true;
    if (!m) return false;
    if (m.status !== "active") return false;
    // editing club details is restricted to owner/head coach by default
    return Boolean(m.isOwner) || m.role === "head_coach";
  })();

  const canSeeAdminActions = canManageClub;

  // Reports are coach/staff oriented in legacy U Scout; keep conservative.
  const canAccessReports = canViewCoachUI;

  const canAccessPersonnel =
    realRole === "master" ||
    realRole === "head_coach" ||
    (realRole === "coach" && Boolean(m?.operationsAccess) && m?.status === "active");

  const canCreateCanonical = realRole === "master" || realRole === "head_coach";

  const canManageWellness = staffRole === "head_coach" || isPhysicalTrainer || hasOperationsAccess;

  return {
    staffRole,
    isPhysicalTrainer,
    canViewCoachUI,
    canManageClub,
    canInviteMembers,
    canEditClub,
    canSeeAdminActions,
    canCreateEvent,
    canAccessReports,
    canAccessPersonnel,
    canCreateCanonical,
    canUsePlayerUX,
    canManageWellness,
  };
}

export function useCapabilities(params?: { membership?: ClubMembership | null }) {
  const { profile, effectiveRole } = useAuth();
  return useMemo(
    () =>
      computeCapabilities({
        realRole: profile?.role ?? null,
        effectiveRole,
        membership: params?.membership ?? null,
        badges: readCoachBadges(profile ?? null),
      }),
    [effectiveRole, params?.membership, profile?.role],
  );
}

