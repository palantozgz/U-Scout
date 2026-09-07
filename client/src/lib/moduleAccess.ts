import { useClub } from "./club-api";
import { useAuth } from "./useAuth";
import type { ClubModuleKey } from "@shared/club-context";

export interface ModuleAccess {
  /** true if this module should be shown/usable for the current user right now. */
  enabled: boolean;
  /** true while club data is still loading — callers should avoid flashing a "disabled" state during this window. */
  loading: boolean;
}

/**
 * Modules the head coach can turn on/off club-wide (My Club > Club tab) so players/coaches
 * see a smaller app during a phase (e.g. preseason: only Schedule+Wellness, add Playbook later).
 *
 * The head coach who sets the toggle always keeps full access — the point is decluttering
 * the app for everyone else, not locking the person managing the rollout out of their own tools.
 * `master` (Anthropic/admin preview role) also always sees everything.
 */
export function useIsModuleEnabled(moduleKey: ClubModuleKey): ModuleAccess {
  const { profile, effectiveRole } = useAuth();
  const clubQ = useClub({ enabled: Boolean(profile) });

  if (effectiveRole === "master" || effectiveRole === "head_coach") {
    return { enabled: true, loading: false };
  }
  if (clubQ.isLoading && !clubQ.data) {
    // Don't flash a "module disabled" screen on first load before we know the real setting.
    return { enabled: true, loading: true };
  }
  const disabled = clubQ.data?.club.disabledModules ?? [];
  return { enabled: !disabled.includes(moduleKey), loading: false };
}

/** Non-hook helper for places that already have the club payload (e.g. ModuleNav, Home module grid). */
export function isModuleEnabledFor(
  moduleKey: ClubModuleKey,
  disabledModules: string[] | undefined,
  effectiveRole: string | null | undefined,
): boolean {
  if (effectiveRole === "master" || effectiveRole === "head_coach") return true;
  return !(disabledModules ?? []).includes(moduleKey);
}
