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
 * https://uptimerobot.com → New monitor → HTTP →
 * URL: https://u-scout-production.up.railway.app/api/ping
 */
import { useEffect } from "react";

const PING_URL = "/api/ping";
const MIN_INTERVAL_MS = 4 * 60 * 1000; // no más de 1 ping cada 4 minutos

let lastPingAt = 0;

function doPing() {
  const now = Date.now();
  if (now - lastPingAt < MIN_INTERVAL_MS) return;
  lastPingAt = now;
  // fire-and-forget — ignorar errores
  fetch(PING_URL, { method: "GET", credentials: "include" }).catch(() => {});
}

// Acceso a Capacitor sin imports — en builds nativos, window.Capacitor y
// window.Capacitor.Plugins están disponibles globalmente sin necesidad de
// importar @capacitor/app (evita error de Rollup al resolver módulo nativo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CapApp = () => (window as any)?.Capacitor?.Plugins?.App;

export function useRailwayWarmup() {
  useEffect(() => {
    // Ping inmediato al montar (app cold start o primer render tras auth)
    doPing();

    // Ping al volver al foco en web
    const handleFocus = () => doPing();
    window.addEventListener("focus", handleFocus);

    // Ping al reanudar en Capacitor iOS/Android
    // Capacitor inyecta window.Capacitor.Plugins.App en native builds.
    // No usamos import() para evitar que Rollup intente resolver el módulo.
    let removeCapacitorListener: (() => void) | undefined;
    const appPlugin = CapApp();
    if (appPlugin?.addListener) {
      appPlugin
        .addListener("appStateChange", (state: { isActive: boolean }) => {
          if (state.isActive) doPing();
        })
        .then((handle: { remove: () => void }) => {
          removeCapacitorListener = () => { try { handle.remove(); } catch {} };
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      removeCapacitorListener?.();
    };
  }, []);
}
