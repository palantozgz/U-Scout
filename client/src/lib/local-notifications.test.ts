import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFY_TIME,
  cancelDailyReminders,
  getNotificationPermissionState,
  isNativeNotificationsSupported,
  requestNotificationPermission,
  scheduleDailyReminders,
} from "./local-notifications";

// Spec 45. This suite runs in vitest's plain Node environment (no native iOS
// bridge, no jsdom) -- confirmed real behavior, not assumed: @capacitor/core
// safely reports isNativePlatform() === false / getPlatform() === "web" here
// (verified with `node -e "require('@capacitor/core')..."` before writing
// this), it does not throw for lacking a native bridge. That means every
// exported function below should cleanly no-op/return a safe default in this
// environment -- these tests are real regression coverage for that guard,
// not a tautology: a broken guard (e.g. one that assumes `window.Capacitor`
// exists) would throw here instead of returning cleanly.

describe("isNativeNotificationsSupported", () => {
  it("es false fuera de iOS nativo (este propio entorno de test)", () => {
    expect(isNativeNotificationsSupported()).toBe(false);
  });
});

describe("guards fuera de iOS nativo -- nunca deben lanzar, ni tocar el plugin real", () => {
  it("getNotificationPermissionState -> 'unsupported'", async () => {
    await expect(getNotificationPermissionState()).resolves.toBe("unsupported");
  });

  it("requestNotificationPermission -> false, sin abrir ningun dialogo", async () => {
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it("scheduleDailyReminders resuelve sin lanzar (no-op silencioso)", async () => {
    await expect(
      scheduleDailyReminders({ scoutReportsTime: "21:30", wellnessTime: "21:30", locale: "es" }),
    ).resolves.toBeUndefined();
  });

  it("cancelDailyReminders resuelve sin lanzar (no-op silencioso)", async () => {
    await expect(cancelDailyReminders()).resolves.toBeUndefined();
  });
});

describe("DEFAULT_NOTIFY_TIME", () => {
  it("sigue siendo 21:30 (guarda contra un cambio accidental del valor documentado en shared/schema.ts)", () => {
    expect(DEFAULT_NOTIFY_TIME).toBe("21:30");
  });

  it("tiene formato HH:MM valido", () => {
    expect(DEFAULT_NOTIFY_TIME).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
