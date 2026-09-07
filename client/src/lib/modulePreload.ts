/**
 * Precarga de los 5 chunks de m\u00f3dulo (Home/Schedule/Scout/Stats/Playbook).
 *
 * Antes, App.tsx defin\u00eda cada lazy() con su propio `import()` inline. React.lazy
 * solo dispara esa descarga cuando el componente se renderiza por primera vez \u2014
 * es decir, justo cuando el usuario ya est\u00e1 esperando la pantalla. Resultado:
 * lag perceptible la primera vez que se abre cada m\u00f3dulo en una sesi\u00f3n (reportado
 * por Pablo el 2026-09-08 usando la app desde desktop).
 *
 * Estas mismas funciones se usan ahora en dos sitios:
 * 1. App.tsx las pasa directamente a lazy() \u2014 el resultado del import() se
 *    cachea a nivel de m\u00f3dulo (Vite/ESM), as\u00ed que llamarlas de nuevo desde
 *    ModuleNav antes de navegar no vuelve a descargar nada si ya se dispar\u00f3.
 * 2. ModuleNav las dispara en segundo plano (poco despu\u00e9s de montar, con
 *    prioridad baja) y tambi\u00e9n en onMouseEnter/onTouchStart de cada bot\u00f3n de
 *    navegaci\u00f3n \u2014 as\u00ed el chunk ya est\u00e1 en cach\u00e9 (o casi) cuando el clic real llega.
 */
export const preloadHome = () => import("@/pages/core/Home");
export const preloadScoutModule = () => import("@/pages/core/Scout");
export const preloadScheduleModule = () => import("@/pages/core/Schedule");
export const preloadStatsModule = () => import("@/pages/core/Stats");
export const preloadPlaybookModule = () => import("@/pages/core/Playbook");

export const MODULE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  home: preloadHome,
  schedule: preloadScheduleModule,
  scout: preloadScoutModule,
  stats: preloadStatsModule,
  playbook: preloadPlaybookModule,
};

let allPreloaded = false;
/** Dispara los 5 imports en segundo plano, una sola vez por sesi\u00f3n de pesta\u00f1a. */
export function preloadAllModulesOnce() {
  if (allPreloaded) return;
  allPreloaded = true;
  for (const load of Object.values(MODULE_PRELOADERS)) {
    // Fire-and-forget; cualquier fallo de red se ignora (el import real al
    // navegar lo reintentar\u00e1 de todas formas).
    load().catch(() => {});
  }
}
