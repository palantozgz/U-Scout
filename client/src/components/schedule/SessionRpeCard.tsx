import { useState } from "react";
import { Check, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/hooks/use-toast";
import { CLUB_TIME_ZONE, type ScheduleEvent } from "@/lib/schedule";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/scheduleActivityConfig";
import { usePendingRpeSession, useSubmitSessionRpe } from "@/lib/session-rpe";
import type { I18nKey } from "@/lib/i18n";

type Translate = (key: I18nKey) => string;

function sessionLabel(ev: Pick<ScheduleEvent, "title" | "session_type">, t: Translate): string {
  return ev.title.trim() || t(ACTIVITY_TYPE_CONFIG[ev.session_type].labelKey);
}

function whenLabel(startsAt: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
      timeZone: CLUB_TIME_ZONE,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(startsAt));
  } catch {
    return "";
  }
}

/**
 * Jugadora: tras terminar un entrenamiento o partido, pide el esfuerzo percibido (0-10). Desaparece
 * cuando contesta; no aparece si no hay ninguna sesión terminada pendiente.
 */
export function SessionRpeCard(props: { clubId: string; userId: string; t: Translate; locale: string }) {
  const { clubId, userId, t, locale } = props;
  const pendingQ = usePendingRpeSession({ clubId, userId });
  const submit = useSubmitSessionRpe();
  const [value, setValue] = useState("");
  const [done, setDone] = useState<{ ev: ScheduleEvent; rpe: number } | null>(null);
  const [changing, setChanging] = useState(false);

  const pending = pendingQ.data ?? null;
  const target = changing && done ? done.ev : pending;

  if (!target) {
    if (!done) return null;
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3" data-testid="rpe-card-saved">
        <p className="text-sm font-bold text-foreground flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          {(t("rpe_saved" as any) as string).replace("{rpe}", String(done.rpe))}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-lg text-xs font-bold"
          onClick={() => {
            setValue(String(done.rpe));
            setChanging(true);
          }}
        >
          {t("rpe_change" as any)}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="rpe-card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Flame className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black tracking-tight text-foreground">{t("rpe_card_title" as any)}</p>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            {sessionLabel(target, t)} · {whenLabel(target.starts_at, locale)}
          </p>
          <p className="text-[11px] md:text-sm text-muted-foreground mt-1 leading-snug">{t("rpe_card_hint" as any)}</p>
        </div>
      </div>

      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => setValue(v || "")}
        className="flex flex-wrap justify-start gap-2"
        disabled={submit.isPending}
      >
        {Array.from({ length: 11 }, (_, i) => String(i)).map((n) => (
          <ToggleGroupItem
            key={n}
            value={n}
            size="sm"
            variant="outline"
            className="h-11 w-11 px-0 text-sm font-black data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
            data-testid={`rpe-option-${n}`}
          >
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex justify-between text-[11px] md:text-xs font-semibold text-muted-foreground">
        <span>{t("rpe_scale_low" as any)}</span>
        <span>{t("rpe_scale_high" as any)}</span>
      </div>

      <Button
        className="w-full h-11 rounded-xl font-bold"
        disabled={value === "" || submit.isPending}
        data-testid="rpe-submit"
        onClick={() => {
          const rpe = Number(value);
          void submit
            .mutateAsync({ club_id: clubId, event_id: target.id, user_id: userId, rpe })
            .then(() => {
              setDone({ ev: target, rpe });
              setChanging(false);
              setValue("");
            })
            .catch(() => {
              toast({ variant: "destructive", description: t("schedule_edit_error") });
            });
        }}
      >
        {submit.isPending ? t("saving") : t("rpe_submit" as any)}
      </Button>
    </div>
  );
}
