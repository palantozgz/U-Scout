import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Locale } from "@/lib/i18n";

/**
 * Recordatorios diarios locales en el dispositivo (spec 45) — no push/APNs:
 * el club solo guarda la hora preferida, cada iPhone programa sus propias
 * notificaciones locales vía este módulo. Sin infraestructura de servidor,
 * sin certificados de Apple, funciona sin conexión una vez programado.
 * Solo jugadoras reciben estos 2 avisos (revisar scout reports, rellenar
 * wellness) — los entrenadores no los necesitan.
 */

/** Ids estables — reprogramar (p. ej. el head coach cambia la hora) cancela primero por id. */
const SCOUT_REPORTS_NOTIF_ID = 9001;
const WELLNESS_NOTIF_ID = 9002;

/** Coincide con el valor por defecto documentado en shared/schema.ts (clubs.*_notify_time null). */
export const DEFAULT_NOTIFY_TIME = "21:30";

function parseTime(hhmm: string | null | undefined): { hour: number; minute: number } {
  const src = hhmm && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) ? hhmm : DEFAULT_NOTIFY_TIME;
  const [hour, minute] = src.split(":").map(Number);
  return { hour, minute };
}

/** Notificaciones locales solo tienen sentido en la app nativa de iOS (no Mac Catalyst/web: ahí no hay "primera vez que se abre el móvil por la mañana" que tenga sentido recordar). */
export function isNativeNotificationsSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

export type NotificationPermissionState = "granted" | "denied" | "prompt" | "unsupported";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!isNativeNotificationsSupported()) return "unsupported";
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display as NotificationPermissionState;
  } catch {
    return "unsupported";
  }
}

/** Dispara el diálogo nativo real de iOS. Llamar solo tras un toque explícito del usuario en la tarjeta de "priming" — nunca en silencio al abrir la app (Apple HIG). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNativeNotificationsSupported()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

/**
 * (Re)programa los 2 recordatorios diarios con la hora del club. No pide
 * permiso por su cuenta — si el usuario aún no lo ha concedido, no hace
 * nada (silenciosamente, para poder llamarse en cada carga de Home sin
 * lógica extra de "¿ya se pidió?"). Idempotente: cancela por id antes de
 * volver a programar, así cambiar la hora en Ajustes del club se refleja
 * sin duplicar notificaciones.
 */
export async function scheduleDailyReminders(params: {
  scoutReportsTime: string | null | undefined;
  wellnessTime: string | null | undefined;
  locale: Locale;
}): Promise<void> {
  if (!isNativeNotificationsSupported()) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") return;

    const { locale } = params;
    const scout = parseTime(params.scoutReportsTime);
    const wellness = parseTime(params.wellnessTime);

    await LocalNotifications.cancel({
      notifications: [{ id: SCOUT_REPORTS_NOTIF_ID }, { id: WELLNESS_NOTIF_ID }],
    });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: SCOUT_REPORTS_NOTIF_ID,
          title: locale === "es" ? "Scouting" : locale === "zh" ? "球探报告" : "Scouting",
          body:
            locale === "es"
              ? "Revisa si hay informes de scouting nuevos sobre tu próxima rival."
              : locale === "zh"
                ? "查看是否有关于下一位对手的新球探报告。"
                : "Check for new scouting reports on your next opponent.",
          schedule: { on: { hour: scout.hour, minute: scout.minute }, allowWhileIdle: true },
        },
        {
          id: WELLNESS_NOTIF_ID,
          title: locale === "es" ? "Wellness" : locale === "zh" ? "健康打卡" : "Wellness",
          body:
            locale === "es"
              ? "No olvides rellenar tu estado de bienestar de hoy."
              : locale === "zh"
                ? "别忘了完成今天的健康打卡。"
                : "Don't forget to fill in today's wellness check-in.",
          schedule: { on: { hour: wellness.hour, minute: wellness.minute }, allowWhileIdle: true },
        },
      ],
    });
  } catch {
    // Best-effort — un fallo al programar nunca debe romper el resto de la app.
  }
}

/** Usado si en el futuro se necesita apagar los recordatorios (p. ej. la jugadora los desactiva). No se expone en UI todavía — ver spec 45. */
export async function cancelDailyReminders(): Promise<void> {
  if (!isNativeNotificationsSupported()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: SCOUT_REPORTS_NOTIF_ID }, { id: WELLNESS_NOTIF_ID }],
    });
  } catch {
    /* ignore */
  }
}
