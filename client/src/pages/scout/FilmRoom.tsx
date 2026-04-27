import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";

export default function FilmRoom() {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={() => setLocation("/coach")} className="-ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-black text-foreground tracking-tight">
          {locale === "zh" ? "集体分析" : locale === "es" ? "Sala de análisis" : "Film Room"}
        </h1>
      </header>
      <main className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {/* Sprint 4 content */}
        Coming soon
      </main>
      <ModuleNav />
    </div>
  );
}

