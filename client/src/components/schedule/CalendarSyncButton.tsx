import { useState } from "react";
import { CalendarPlus, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { toWebcalUrl } from "@/lib/ical-link";
import { toast } from "@/hooks/use-toast";

// AÑADIDO 2026-10-01 (Fase 2, Schedule): el servidor ya genera el feed iCal del club
// (GET /api/club/ical-link + /api/ical/:token.ics) pero solo se enlazaba en My Club, para el staff.
// Las jugadoras no tenían forma de suscribirse. Con el feed en el calendario del móvil, los cambios y las
// cancelaciones del staff llegan con las alertas del propio calendario, sin notificaciones push.

async function fetchIcalUrl(): Promise<string> {
  const res = await apiRequest("GET", "/api/club/ical-link");
  const data = await res.json();
  if (typeof data?.url !== "string") throw new Error("no_ical_url");
  return data.url as string;
}

export function CalendarSyncButton() {
  const { t } = useLocale();
  const [busy, setBusy] = useState<"add" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  const fail = () =>
    toast({ variant: "destructive" as any, description: t("schedule_calendar_sync_error" as any) });

  const addToCalendar = async () => {
    setBusy("add");
    try {
      const url = await fetchIcalUrl();
      // webcal:// abre la suscripción en el calendario del sistema. Si el WebView no la abre,
      // el botón "Copiar enlace" es el camino alternativo.
      window.location.href = toWebcalUrl(url);
    } catch {
      fail();
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    setBusy("copy");
    try {
      const url = await fetchIcalUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ description: t("schedule_calendar_sync_copied" as any) });
    } catch {
      fail();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="calendar-sync">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
        {t("schedule_calendar_sync_title" as any)}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">{t("schedule_calendar_sync_desc" as any)}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-10 gap-2 rounded-xl font-bold"
          disabled={busy !== null}
          onClick={() => void addToCalendar()}
          data-testid="calendar-sync-add"
        >
          <CalendarPlus className="h-4 w-4" />
          {t("schedule_calendar_sync_add" as any)}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-10 gap-2 rounded-xl font-bold"
          disabled={busy !== null}
          onClick={() => void copyLink()}
          data-testid="calendar-sync-copy"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {t("schedule_calendar_sync_copy" as any)}
        </Button>
      </div>
    </div>
  );
}
