/** First-time onboarding (language → theme → tutorial) for accounts created on or after this instant. */
export const ONBOARDING_V2_LAUNCH_ISO = "2026-04-12T00:00:00.000Z";

const LS_KEY = (userId: string) => `uscout_onboarding_v2:${userId}`;

export function migrateLegacyOnboarding(userCreatedAt: string | undefined, userId: string): void {
  if (!userCreatedAt) return;
  try {
    const created = new Date(userCreatedAt).getTime();
    const launch = new Date(ONBOARDING_V2_LAUNCH_ISO).getTime();
    if (created < launch && !localStorage.getItem(LS_KEY(userId))) {
      localStorage.setItem(LS_KEY(userId), "legacy");
    }
  } catch {
    /* ignore */
  }
}

export function isOnboardingCompleted(userId: string): boolean {
  try {
    const v = localStorage.getItem(LS_KEY(userId));
    return v === "1" || v === "legacy";
  } catch {
    return true;
  }
}

export function completeOnboarding(userId: string): void {
  try {
    localStorage.setItem(LS_KEY(userId), "1");
  } catch {
    /* ignore */
  }
}

const REPLAY_KEY = (userId: string) => `uscout_onboarding_replay:${userId}`;

/** One-shot flag set by resetOnboarding() below, consumed (read + cleared) here. */
function consumeOnboardingReplay(userId: string): boolean {
  try {
    const requested = localStorage.getItem(REPLAY_KEY(userId)) === "1";
    if (requested) localStorage.removeItem(REPLAY_KEY(userId));
    return requested;
  } catch {
    return false;
  }
}

export function shouldOfferOnboarding(userCreatedAt: string | undefined, userId: string): boolean {
  // A deliberate replay request (Settings → "watch tutorials again") always wins,
  // even for accounts created before ONBOARDING_V2_LAUNCH_ISO — without this, the
  // date gate below would silently make the replay button a no-op for anyone with
  // a pre-launch (legacy) account.
  if (consumeOnboardingReplay(userId)) return true;
  if (!userCreatedAt) return false;
  if (isOnboardingCompleted(userId)) return false;
  const created = new Date(userCreatedAt).getTime();
  const launch = new Date(ONBOARDING_V2_LAUNCH_ISO).getTime();
  return created >= launch;
}

/** Lets Settings offer "watch the welcome tutorial again" without waiting for a new account. */
export function resetOnboarding(userId: string): void {
  try {
    localStorage.removeItem(LS_KEY(userId));
    localStorage.setItem(REPLAY_KEY(userId), "1");
  } catch {
    /* ignore */
  }
}

/**
 * Per-module "first time you open this" intro card (spec section 44). Independent
 * of the main onboarding above — a user can have finished language/theme/tutorial
 * and still not have opened e.g. Stats yet, so each module tracks its own flag.
 */
export const MODULE_INTRO_KEYS = ["scout", "schedule", "stats", "playbook", "club"] as const;
export type ModuleIntroKey = (typeof MODULE_INTRO_KEYS)[number];

const MODULE_INTRO_LS_KEY = (userId: string, moduleKey: ModuleIntroKey) =>
  `uscout_module_intro:${userId}:${moduleKey}`;

export function hasSeenModuleIntro(userId: string, moduleKey: ModuleIntroKey): boolean {
  try {
    return localStorage.getItem(MODULE_INTRO_LS_KEY(userId, moduleKey)) === "1";
  } catch {
    return true;
  }
}

export function markModuleIntroSeen(userId: string, moduleKey: ModuleIntroKey): void {
  try {
    localStorage.setItem(MODULE_INTRO_LS_KEY(userId, moduleKey), "1");
  } catch {
    /* ignore */
  }
}

/** Used by Settings' "watch tutorials again" — clears every module flag at once. */
export function resetModuleIntros(userId: string): void {
  try {
    for (const key of MODULE_INTRO_KEYS) localStorage.removeItem(MODULE_INTRO_LS_KEY(userId, key));
  } catch {
    /* ignore */
  }
}

/**
 * "Enable notifications" priming card (spec 45, iOS only) — shown once to a
 * player so the real system permission dialog is never sprung on them with
 * no context (Apple HIG). Independent of everything above: a player can
 * dismiss/allow this on their own schedule, unrelated to onboarding/module
 * intro completion.
 */
const NOTIF_PRIMING_LS_KEY = (userId: string) => `uscout_notif_priming:${userId}`;

export function hasSeenNotificationsPriming(userId: string): boolean {
  try {
    return localStorage.getItem(NOTIF_PRIMING_LS_KEY(userId)) === "1";
  } catch {
    return true;
  }
}

export function markNotificationsPrimingSeen(userId: string): void {
  try {
    localStorage.setItem(NOTIF_PRIMING_LS_KEY(userId), "1");
  } catch {
    /* ignore */
  }
}
