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
  /** Publish badge for coaches (granted by head coach) -- spec motor-1.0
   *  sección 25.1/26: permite publicar informes de scouting a las
   *  jugadoras sin ser head_coach/master. */
  reportPublishAccess?: boolean;
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
  /** Can create/edit/delete schedule sessions. head_coach + operationsAccess coaches only. */
  canCreateEvent: boolean;
  canAccessReports: boolean;
  /** Only head_coach and master can access Personnel to create/manage canonical profiles. */
  canAccessPersonnel: boolean;
  /** Only head_coach and master can promote/create canonical profiles. */
  canCreateCanonical: boolean;
  canUsePlayerUX: boolean;
  /** Staff capability: can view/manage wellness operations. */
  canManageWellness: boolean;
  /** Can view Stats module. head_coach, master, operationsAccess coaches. */
  canViewStats: boolean;
  /** Can view Mi Club / club management entry point. head_coach + master only. */
  canViewClubManagement: boolean;
  /** Puede ver/editar el panel de calibración Nivel B ("el decantador",
   *  spec 17.3/38/39). head_coach/master siempre; coach solo con
   *  reportPublishAccess delegado. RENOMBRADO 2026-09-14 (spec 38): se
   *  llamaba canPublishReports, pero tras la reconciliación del gate de
   *  publicación (sección 38 -- cualquier coach con ≥1 aprobación puede
   *  publicar, sin badge) ese nombre ya no describía lo que controla. Cero
   *  consumidores reales antes del rename, confirmado por grep. */
  canAccessCalibrationPanel: boolean;
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
  const realRole =
    input.realRole === "master"
      ? "master"
      : ((input.membership?.role as typeof input.realRole) ?? input.realRole);
  // Si no hay preview activo (effectiveRole === realRole "en crudo" del auth), el rol
  // efectivo debe seguir la correccion de arriba (membership por encima del metadato
  // de auth, que puede quedarse desincronizado si el rol de alguien se cambio a mano
  // en club_members sin tocar su user_metadata). Si SI hay un preview activo (un
  // master probando la app como otro rol), respetamos ese override tal cual.
  const previewActive = input.effectiveRole !== input.realRole;
  const effectiveRole = previewActive ? input.effectiveRole : realRole;
  const m = input.membership ?? null;
  const badges = input.badges ?? null;

  const canUsePlayerUX = effectiveRole === "player";
  const canViewCoachUI = !canUsePlayerUX;

  const staffRole: Capabilities["staffRole"] =
    realRole === "head_coach" ? "head_coach" : realRole === "coach" ? "coach" : realRole === "player" ? "player" : null;

  const isPhysicalTrainer = Boolean(badges?.physical_trainer) && staffRole === "coach";
  const hasOperationsAccess = Boolean(m?.operationsAccess) && staffRole === "coach" && m?.status === "active";

  // UI-only capability (frontend rendering).
  // Only head_coach, master, and coaches with operationsAccess can create/edit sessions.
  const canCreateEvent =
    canViewCoachUI && (
      effectiveRole === "master" ||
      effectiveRole === "head_coach" ||
      (effectiveRole === "coach" && hasOperationsAccess)
    );

  // Stats: todos los staff pueden ver stats de liga
  const canViewStats = canViewCoachUI;

  // Mi Club entry point: only head_coach and master (based on effectiveRole for preview correctness)
  const canViewClubManagement =
    effectiveRole === "master" || effectiveRole === "head_coach";

  // Permission-oriented capability: prefer realRole + membership, never effectiveRole.
  const canManageClub = (() => {
    if (!realRole) return false;
    if (realRole === "master") return true;
    if (!m) return false;
    if (m.status !== "active") return false;
    if (m.isOwner) return true;
    return m.role === "head_coach";
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
    effectiveRole === "master" ||
    effectiveRole === "head_coach" ||
    (effectiveRole === "coach" && Boolean(m?.operationsAccess) && m?.status === "active");

  const canCreateCanonical = effectiveRole === "master" || effectiveRole === "head_coach";

  const canAccessCalibrationPanel =
    effectiveRole === "master" ||
    effectiveRole === "head_coach" ||
    (effectiveRole === "coach" && Boolean(m?.reportPublishAccess) && m?.status === "active");

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
    canViewStats,
    canViewClubManagement,
    canAccessCalibrationPanel,
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

