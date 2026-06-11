/**
 * useRailwayWarmup — dispara un ping a Railway cuando la app vuelve al foco.
 *
 * Railway (hobby/free) duerme tras 5 min de inactividad.
 * En Capacitor, cuando el usuario desbloquea el móvil y abre la app,
 * el evento 'resume' se dispara ~1-2s antes de que haga cualquier tap real.
 * Ese tiempo es suficiente para que Railway despierte (cold start: 2-4s).
 *
 * Sin esto: el primer API call tarda 5-10s (cold start + latencia China→US).
 * Con esto:  el ping arranca el cold start en cuanto el usuario abre la app.
 *            Para cuando toca algo, Railway ya está activo.
 *
 * Nota: para eliminar el cold start por completo, configurar UptimeRobot
 * (gratis) para hacer ping a /api/ping cada 5 minutos:
 * https://uptimerobot.com → New monitor → HTTP → URL: https://u-scout-production.up.railway.app/api/ping
 */
import { useEffect } from "react";

const PING_URL = "/api/ping";
const MIN_INTERVAL_MS = 4 * 60 * 1000; // no más de 1 ping cada 4 minutos

let lastPingAt = 0;

function doPing() {
  const now = Date.now();
  if (now - lastPingAt < MIN_INTERVAL_MS) return;
  lastPingAt = now;
  // fire-and-forget — ignorar errores (si Railway está dormido, la petición
  // misma lo despierta aunque tarde; si está activo, responde en <100ms)
  fetch(PING_URL, { method: "GET", credentials: "include" }).catch(() => {});
}

export function useRailwayWarmup() {
  useEffect(() => {
    // Ping inmediato al montar (app cold start o primer render tras auth)
    doPing();

    // Ping al volver al foco en web
    const handleFocus = () => doPing();
    window.addEventListener("focus", handleFocus);

    // Ping al reanudar en Capacitor iOS/Android
    let removeCapacitorListener: (() => void) | undefined;
    (async () => {
      try {
        // Importación dinámica — solo existe en builds Capacitor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cap = await import("@capacitor/app" as any);
        const handle = await cap.App.addListener(
          "appStateChange",
          (state: { isActive: boolean }) => { if (state.isActive) doPing(); },
        );
        removeCapacitorListener = () => { try { handle.remove(); } catch {} };
      } catch {
        // No es Capacitor — ignorar
      }
    })();

    return () => {
      window.removeEventListener("focus", handleFocus);
      removeCapacitorListener?.();
    };
  }, []);
}
