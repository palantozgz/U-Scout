import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-center gap-2 bg-slate-900 text-white text-[11px] font-bold px-4 py-1.5 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
      Sin conexión — los cambios se guardarán al reconectar
    </div>
  );
}

