import { ModulePageShell } from "./ModulePage";
import { useLocale } from "@/lib/i18n";

export default function Schedule() {
  const { t } = useLocale();
  return (
    <ModulePageShell title={t("ucore_card_schedule_title")}>
      <div className="p-4 pb-10 max-w-md mx-auto w-full">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-lg font-black tracking-tight text-foreground">{t("ucore_card_schedule_title")}</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {t("ucore_card_schedule_sub")}
          </p>
        </div>
      </div>
    </ModulePageShell>
  );
}

