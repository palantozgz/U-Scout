import { type PropsWithChildren, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Settings, ArrowLeft } from "lucide-react";
import { ModuleNav } from "./ModuleNav";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
import { ModuleHeader } from "@/components/branding/ModuleHeader";
import type { ComponentProps } from "react";

type ModuleType = ComponentProps<typeof ModuleHeader>["module"];

/**
 * Shell compartido para todos los módulos U Core.
 *
 * Layout mobile:
 *   [Header]
 *   [main — scroll interno, padding-bottom para nav fijo]
 *   [ModuleNav fijo abajo]
 *
 * Layout desktop (md+):
 *   [Sidebar fijo a la izquierda — ModuleNav]
 *   [Header]
 *   [flex-row]
 *     [main — flex-1, scroll interno]
 *     [panel — w-80 lg:w-96, solo si se pasa la prop, scroll propio]
 *
 * El panel es contenido contextual específico de cada módulo
 * (detalle de evento, perfil de jugador, filtros…). En mobile se oculta;
 * el módulo debe exponer ese contenido a través de la UI principal si
 * el usuario lo necesita en pantalla pequeña.
 */
export function ModulePageShell(
  props: PropsWithChildren<{
    /** Título de texto para subpáginas (header sticky) */
    title: string;
    /** Muestra botón back en el header */
    showBack?: boolean;
    /** Si se provee, renderiza ModuleHeader con logo en lugar del header de texto */
    moduleHeader?: { module: ModuleType; tagline: string };
    /**
     * Contenido del panel lateral desktop.
     * No se renderiza en mobile — garantiza que el módulo también
     * exponga este contenido de alguna forma en la UI principal si
     * es necesario para mobile users.
     */
    panel?: ReactNode;
    /** Etiqueta uppercase del panel (cabecera del panel) */
    panelLabel?: string;
  }>,
) {
  const { title, showBack, moduleHeader, children, panel, panelLabel } = props;
  const [, setLocation] = useLocation();
  const { previewRole } = useAuth();
  const caps = useCapabilities();
  const settingsHref = previewRole
    ? "/settings"
    : caps.canUsePlayerUX
      ? "/player/home-settings"
      : "/settings";

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">

      {/* ── Header ── */}
      {moduleHeader ? (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-8 md:pt-1 shrink-0">
          <ModuleHeader
            module={moduleHeader.module}
            tagline={moduleHeader.tagline}
            className="md:py-3"
          />
        </div>
      ) : (
        <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border shrink-0">
          <div className="w-full max-w-5xl mx-auto px-3 md:px-8 md:py-3.5 py-3 flex items-center justify-between gap-2">
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
          </div>
        </header>
      )}

      {/* ── Contenido + Panel ── */}
      {/*
        min-h-0 necesario para que flex-1 funcione en Chrome/Safari.
        Sin overflow-hidden aquí: main y aside gestionan su propio scroll.
        overflow-hidden en ancestors intermedios rompe position:sticky.
      */}
      <div className="flex flex-1 min-h-0">

        {/* Main — scroll interno, padding para nav mobile */}
        <main className="flex-1 min-h-0 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-10 md:pt-4 lg:pt-6">
          {children}
        </main>

        {/* Panel lateral — solo desktop, solo si se pasa la prop */}
        {panel && (
          <aside
            className="hidden md:flex w-80 lg:w-96 shrink-0 flex-col min-h-0 overflow-y-auto bg-muted/10"
            style={{ borderLeft: "1px solid hsl(var(--border) / 0.7)" }}
          >
            {panelLabel && (
              <div
                className="px-5 py-3.5 shrink-0"
                style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)" }}
              >
                <p className="text-[10px] md:text-xs font-black tracking-[2px] md:tracking-[0.2em] uppercase text-muted-foreground">
                  {panelLabel}
                </p>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {panel}
            </div>
          </aside>
        )}
      </div>

      <ModuleNav />
      {/* Cubre el safe-area-inset-bottom en iOS para evitar franja blanca */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card" style={{ height: "env(safe-area-inset-bottom)", zIndex: 89 }} />
    </div>
  );
}
