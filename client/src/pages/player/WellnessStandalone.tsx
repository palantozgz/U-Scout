import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Info } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import { todayKey, useUpsertWellnessEntry, useWellnessEntryToday } from "@/lib/wellness";

function WellnessRow(props: {
  label: string;
  tooltip?: string;
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black tracking-tight text-foreground">{props.label}</p>
          {props.tooltip ? (
            <span className="inline-flex items-center text-muted-foreground" title={props.tooltip} aria-label={props.tooltip}>
              <Info className="w-3.5 h-3.5" />
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{props.value ? "Selected" : "1–5"}</p>
      </div>
      <ToggleGroup
        type="single"
        value={props.value}
        onValueChange={(v) => props.onValueChange(v || "")}
        className="justify-end"
        disabled={props.disabled}
      >
        {["1", "2", "3", "4", "5"].map((n) => (
          <ToggleGroupItem
            key={n}
            value={n}
            size="sm"
            variant="outline"
            className={[
              "h-10 w-10 px-0 text-sm font-black",
              "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm",
            ].join(" ")}
          >
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export default function WellnessStandalone() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const clubQ = useClub();
  const clubId = clubQ.data?.club?.id;
  const userId = profile?.id;
  const entryDate = todayKey();

  const entryQ = useWellnessEntryToday({ clubId, userId });
  const upsert = useUpsertWellnessEntry();

  const submittedToday = Boolean(entryQ.data);

  const [editing, setEditing] = useState(false);
  const [sleepQuality, setSleepQuality] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [muscleSoreness, setMuscleSoreness] = useState("");
  const [mentalReadiness, setMentalReadiness] = useState("");

  const setFromEntry = (e: { sleep_quality: number; energy_level: number; muscle_soreness: number; mental_readiness: number }) => {
    setSleepQuality(String(e.sleep_quality));
    setEnergyLevel(String(e.energy_level));
    setMuscleSoreness(String(e.muscle_soreness));
    setMentalReadiness(String(e.mental_readiness));
  };

  const wellnessComplete = useMemo(
    () => Boolean(sleepQuality && energyLevel && muscleSoreness && mentalReadiness),
    [sleepQuality, energyLevel, muscleSoreness, mentalReadiness],
  );

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-16">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/player")}
          className="-ml-1 p-3 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black tracking-tight">{t("schedule_tab_wellness")}</h1>
          <p className="text-[10px] text-muted-foreground font-medium">
            {t("wellness_entry_date_label").replace("{date}", entryDate)}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 max-w-md mx-auto w-full">
        {entryQ.isLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("wellness_loading_today")}</p>
          </div>
        ) : submittedToday && !editing ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <p className="text-xs font-bold text-foreground">{t("wellness_submitted_today")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{t("wellness_metric_sleep" as any)}</p>
                  <p className="mt-1 text-lg font-black text-foreground">{entryQ.data!.sleep_quality}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{t("wellness_metric_energy" as any)}</p>
                  <p className="mt-1 text-lg font-black text-foreground">{entryQ.data!.energy_level}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{t("wellness_metric_soreness" as any)}</p>
                  <p className="mt-1 text-lg font-black text-foreground">{entryQ.data!.muscle_soreness}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{t("wellness_metric_readiness" as any)}</p>
                  <p className="mt-1 text-lg font-black text-foreground">{entryQ.data!.mental_readiness}</p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 rounded-xl font-bold"
              onClick={() => {
                setFromEntry(entryQ.data!);
                setEditing(true);
              }}
              data-testid="wellness-standalone-edit"
            >
              {t("wellness_edit")}
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <WellnessRow
                label={t("wellness_metric_sleep" as any)}
                tooltip={t("wellness_tooltip_sleep" as any)}
                value={sleepQuality}
                onValueChange={setSleepQuality}
                disabled={upsert.isPending}
              />
              <WellnessRow
                label={t("wellness_metric_energy" as any)}
                tooltip={t("wellness_tooltip_energy" as any)}
                value={energyLevel}
                onValueChange={setEnergyLevel}
                disabled={upsert.isPending}
              />
              <WellnessRow
                label={t("wellness_metric_soreness" as any)}
                tooltip={t("wellness_tooltip_soreness" as any)}
                value={muscleSoreness}
                onValueChange={setMuscleSoreness}
                disabled={upsert.isPending}
              />
              <WellnessRow
                label={t("wellness_metric_readiness" as any)}
                tooltip={t("wellness_tooltip_readiness" as any)}
                value={mentalReadiness}
                onValueChange={setMentalReadiness}
                disabled={upsert.isPending}
              />
            </div>

            <div className="flex gap-2">
              {submittedToday ? (
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-bold"
                  disabled={upsert.isPending}
                  onClick={() => {
                    setEditing(false);
                    setSleepQuality("");
                    setEnergyLevel("");
                    setMuscleSoreness("");
                    setMentalReadiness("");
                  }}
                >
                  {t("cancel")}
                </Button>
              ) : null}
              <Button
                className="flex-1 h-11 rounded-xl font-bold"
                disabled={!wellnessComplete || upsert.isPending || !clubId || !userId}
                onClick={() => {
                  if (!clubId || !userId) return;
                  void upsert.mutateAsync({
                    club_id: clubId,
                    user_id: userId,
                    entry_date: entryDate,
                    sleep_quality: Number(sleepQuality),
                    energy_level: Number(energyLevel),
                    muscle_soreness: Number(muscleSoreness),
                    mental_readiness: Number(mentalReadiness),
                  }).then(() => {
                    setEditing(false);
                  });
                }}
                data-testid="wellness-standalone-submit"
              >
                {upsert.isPending ? t("saving") : t("wellness_submit")}
              </Button>
            </div>
          </>
        )}
      </main>

      <ModuleNav />
    </div>
  );
}

