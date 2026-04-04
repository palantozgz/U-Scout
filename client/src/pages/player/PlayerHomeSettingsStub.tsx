import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";

/** Placeholder player-only settings until dedicated flows ship. */
export default function PlayerHomeSettingsStub() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/player")} className="-ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Button>
        <h1 className="font-bold text-foreground">{t("player_settings_stub_title")}</h1>
      </header>
      <main className="flex-1 p-6">
        <p className="text-sm text-muted-foreground leading-relaxed">{t("player_settings_stub_body")}</p>
      </main>
    </div>
  );
}
