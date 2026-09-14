import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { hasSeenNotificationsPriming, markNotificationsPrimingSeen } from "@/lib/onboarding-state";
import {
  getNotificationPermissionState,
  isNativeNotificationsSupported,
  requestNotificationPermission,
  scheduleDailyReminders,
} from "@/lib/local-notifications";

/**
 * "Enable notifications" priming card (spec 45) — shown once to a player on
 * the iOS app, before the real system permission dialog. Explains the 2
 * reminders (scout reports, wellness) with the club's actual configured
 * times so it doesn't read as a generic "allow notifications?" ask. Apple
 * HIG: never trigger the system dialog with no context — this card is that
 * context, tapping "Activar" is what actually calls requestPermissions().
 *
 * No-ops entirely outside native iOS, and if the OS-level permission is
 * already granted or denied from a previous decision (nothing left to
 * "prime" — the system won't re-prompt either way).
 */
export function NotificationsPrimingCard({
  scoutReportsTime,
  wellnessTime,
}: {
  scoutReportsTime: string;
  wellnessTime: string;
}) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || !isNativeNotificationsSupported()) return;
    if (hasSeenNotificationsPriming(user.id)) return;
    let cancelled = false;
    void getNotificationPermissionState().then((state) => {
      if (cancelled || !user.id) return;
      if (state === "prompt") {
        setOpen(true);
      } else {
        // Already decided at the OS level (granted earlier, or denied) —
        // nothing for this card to do, don't ask again.
        markNotificationsPrimingSeen(user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const dismiss = () => {
    if (user?.id) markNotificationsPrimingSeen(user.id);
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    const granted = await requestNotificationPermission();
    if (granted) {
      await scheduleDailyReminders({ scoutReportsTime, wellnessTime, locale });
    }
    setBusy(false);
    dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-[340px] rounded-2xl text-center gap-4" data-testid="notifications-priming-card">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <DialogTitle className="text-lg font-black text-foreground text-center">
            {locale === "es" ? "Activa los avisos" : locale === "zh" ? "开启提醒" : "Turn on reminders"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {locale === "es"
              ? `Un aviso a las ${scoutReportsTime} para revisar los scout reports, y otro a las ${wellnessTime} para rellenar tu wellness. Puedes cambiarlo cuando quieras desde iOS.`
              : locale === "zh"
                ? `${scoutReportsTime} 提醒你查看球探报告，${wellnessTime} 提醒你完成健康打卡。你可以随时在 iOS 设置中更改。`
                : `A reminder at ${scoutReportsTime} to check your scout reports, and another at ${wellnessTime} to fill in your wellness. You can change this anytime from iOS.`}
          </p>
        </div>
        <Button className="w-full h-11 rounded-xl font-bold" onClick={() => void enable()} disabled={busy}>
          {locale === "es" ? "Activar notificaciones" : locale === "zh" ? "开启通知" : "Enable notifications"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
