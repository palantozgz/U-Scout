import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLocale } from "@/lib/i18n";

export function useIsLandscape() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== "undefined" && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const handler = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return landscape;
}

export function LandscapeHint() {
  const { locale } = useLocale();
  const text =
    locale === "es" ? "Gira el dispositivo para ver" : locale === "zh" ? "横屏查看" : "Rotate to view";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
      <RotateCcw className="w-8 h-8 animate-spin-slow opacity-60" />
      <p className="text-xs font-semibold">{text}</p>
    </div>
  );
}
