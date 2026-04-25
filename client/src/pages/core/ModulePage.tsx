import { type PropsWithChildren } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Settings, ArrowLeft } from "lucide-react";
import { ModuleNav } from "./ModuleNav";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
import { ModuleHeader } from "@/components/branding/ModuleHeader";
import type { ComponentProps } from "react";

type ModuleType = ComponentProps<typeof ModuleHeader>["module"];

export function ModulePageShell(
  props: PropsWithChildren<{
    title: string;
    showBack?: boolean;
    /** Si se provee, muestra el logo centrado en vez del header sticky de texto */
    moduleHeader?: { module: ModuleType; tagline: string };
  }>,
) {
  const { title, showBack, moduleHeader, children } = props;
  const [, setLocation] = useLocation();
  const { previewRole } = useAuth();
  const caps = useCapabilities();
  const settingsHref = previewRole ? "/settings" : (caps.canUsePlayerUX ? "/player/home-settings" : "/settings");

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-16">
      {moduleHeader ? (
        // Modo logo centrado — igual que CoachHome / U CORE Home
        <div className="max-w-md mx-auto w-full px-4">
          <ModuleHeader module={moduleHeader.module} tagline={moduleHeader.tagline} />
        </div>
      ) : (
        // Modo header sticky con título de texto (para subpáginas)
        <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-3 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {showBack ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="text-muted-foreground hover:text-foreground shrink-0"
                data-testid="ucore-module-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : null}
            <h1 className="text-lg font-extrabold tracking-tight truncate">{title}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setLocation(settingsHref)}
            aria-label="Settings"
            data-testid="ucore-module-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </header>
      )}

      <main className="flex-1">{children}</main>

      <ModuleNav />
    </div>
  );
}

