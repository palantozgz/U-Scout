import { beforeEach, describe, expect, it } from "vitest";

// This repo's vitest config has no jsdom/browser environment (confirmed:
// `node -e "console.log(typeof localStorage)"` → "undefined"), so every
// onboarding-state.ts function that touches localStorage would otherwise hit
// its safe-fallback catch branch here, never exercising the real logic. Stub
// a minimal in-memory localStorage before importing the module under test —
// its top-level code has no import-time side effects, so this ordering is
// safe (the stub is in place before any exported function is actually called
// from inside a test).
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
};

import {
  ONBOARDING_V2_LAUNCH_ISO,
  completeOnboarding,
  hasSeenModuleIntro,
  markModuleIntroSeen,
  resetModuleIntros,
  resetOnboarding,
  shouldOfferOnboarding,
} from "./onboarding-state";

const USER = "u1";
const AFTER_LAUNCH = "2026-05-01T00:00:00.000Z";
const BEFORE_LAUNCH = "2026-01-01T00:00:00.000Z";

beforeEach(() => {
  store.clear();
});

describe("shouldOfferOnboarding", () => {
  it("cuenta nueva (creada despues del lanzamiento v2), no completada -> true", () => {
    expect(shouldOfferOnboarding(AFTER_LAUNCH, USER)).toBe(true);
  });

  it("cuenta nueva ya completada -> false", () => {
    completeOnboarding(USER);
    expect(shouldOfferOnboarding(AFTER_LAUNCH, USER)).toBe(false);
  });

  it("cuenta legacy (anterior al lanzamiento v2) -> false, nunca se ofrece de entrada", () => {
    expect(shouldOfferOnboarding(BEFORE_LAUNCH, USER)).toBe(false);
  });

  it("resetOnboarding() en una cuenta legacy SI fuerza el replay una vez (bypass real, no solo teorico)", () => {
    // Sin el flag de replay, una cuenta legacy nunca pasaria esto -- es
    // justo el bug que resetOnboarding()/shouldOfferOnboarding() cierran.
    expect(shouldOfferOnboarding(BEFORE_LAUNCH, USER)).toBe(false);
    resetOnboarding(USER);
    expect(shouldOfferOnboarding(BEFORE_LAUNCH, USER)).toBe(true);
    // Es de un solo uso -- se consume al leerlo, no se queda "pegado".
    expect(shouldOfferOnboarding(BEFORE_LAUNCH, USER)).toBe(false);
  });

  it("resetOnboarding() en una cuenta post-lanzamiento tambien fuerza el replay", () => {
    completeOnboarding(USER);
    expect(shouldOfferOnboarding(AFTER_LAUNCH, USER)).toBe(false);
    resetOnboarding(USER);
    expect(shouldOfferOnboarding(AFTER_LAUNCH, USER)).toBe(true);
  });

  it("ONBOARDING_V2_LAUNCH_ISO sigue siendo la fecha documentada (guarda contra un cambio accidental)", () => {
    expect(ONBOARDING_V2_LAUNCH_ISO).toBe("2026-04-12T00:00:00.000Z");
  });
});

describe("module intro flags (spec seccion 44)", () => {
  it("un modulo nunca visto -> hasSeenModuleIntro false", () => {
    expect(hasSeenModuleIntro(USER, "stats")).toBe(false);
  });

  it("markModuleIntroSeen marca solo ese modulo, no los demas", () => {
    markModuleIntroSeen(USER, "stats");
    expect(hasSeenModuleIntro(USER, "stats")).toBe(true);
    expect(hasSeenModuleIntro(USER, "playbook")).toBe(false);
  });

  it("resetModuleIntros limpia los 5 modulos a la vez", () => {
    markModuleIntroSeen(USER, "scout");
    markModuleIntroSeen(USER, "stats");
    markModuleIntroSeen(USER, "club");
    resetModuleIntros(USER);
    expect(hasSeenModuleIntro(USER, "scout")).toBe(false);
    expect(hasSeenModuleIntro(USER, "stats")).toBe(false);
    expect(hasSeenModuleIntro(USER, "club")).toBe(false);
  });

  it("los flags de modulo son por usuario -- otro userId no ve el mismo estado", () => {
    markModuleIntroSeen(USER, "playbook");
    expect(hasSeenModuleIntro("otro-usuario", "playbook")).toBe(false);
  });
});
