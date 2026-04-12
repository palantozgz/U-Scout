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

export function shouldOfferOnboarding(userCreatedAt: string | undefined, userId: string): boolean {
  if (!userCreatedAt) return false;
  if (isOnboardingCompleted(userId)) return false;
  const created = new Date(userCreatedAt).getTime();
  const launch = new Date(ONBOARDING_V2_LAUNCH_ISO).getTime();
  return created >= launch;
}
