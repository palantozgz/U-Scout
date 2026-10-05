import { usePlayerAvailability } from "@/lib/availability";
import { availabilityOf, isRestricted } from "@/lib/availability-logic";

// La jugadora ve su propio estado de disponibilidad (RLS: solo lee su fila). Solo aparece si hay una restricción:
// con disponibilidad completa no se muestra nada. Es transparencia: sabe qué ha fijado su cuerpo técnico.

export function MyAvailabilityBadge(props: { clubId: string; userId: string; t: (key: any) => string }) {
  const { clubId, userId, t } = props;
  const q = usePlayerAvailability({ clubId });
  const mine = availabilityOf(
    (q.data ?? []).map((r) => ({ user_id: r.user_id, status: r.status, note: r.note })),
    userId,
  );
  if (!isRestricted(mine.status)) return null;

  const unavailable = mine.status === "unavailable";
  return (
    <div
      className={[
        "rounded-xl border px-3 py-2.5 space-y-0.5",
        unavailable
          ? "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200"
          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
      ].join(" ")}
      data-testid="my-availability"
    >
      <p className="text-sm font-extrabold">{unavailable ? t("availability_my_unavailable") : t("availability_my_modified")}</p>
      {mine.note ? <p className="text-xs font-semibold">{mine.note}</p> : null}
      <p className="text-[11px] font-semibold opacity-80">{t("availability_set_by_staff")}</p>
    </div>
  );
}
