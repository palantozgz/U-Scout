/**
 * Comprueba si hay una version nueva desplegada y fuerza recarga si la hay.
 *
 * Por que existe: index.html se sirve con Cache-Control: no-store (ver server/static.ts),
 * pero WKWebView (el motor de la app nativa via Capacitor) no siempre revalida de forma
 * fiable solo con eso. Sin este chequeo, un usuario puede quedarse en una version vieja
 * de la app indefinidamente, incluso relanzandola, hasta que la desinstale y reinstale.
 *
 * Como funciona: al arrancar, guarda el ETag actual de "/". Cada vez que la app vuelve
 * a primer plano (visibilitychange / focus), vuelve a pedir el ETag con cache:"no-store".
 * Si difiere del guardado, recarga la pagina entera -- lo que trae los assets nuevos
 * (con su propio hash) sin que el usuario tenga que hacer nada manual.
 */
export function initVersionCheck() {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;

  let baselineEtag: string | null = null;
  let checking = false;

  const fetchEtag = async (): Promise<string | null> => {
    try {
      const res = await fetch("/", { method: "HEAD", cache: "no-store" });
      return res.headers.get("etag");
    } catch {
      return null;
    }
  };

  fetchEtag().then(etag => {
    baselineEtag = etag;
  });

  const check = async () => {
    if (checking || !baselineEtag) return;
    checking = true;
    try {
      const etag = await fetchEtag();
      if (etag && etag !== baselineEtag) {
        window.location.reload();
      }
    } finally {
      checking = false;
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
}
