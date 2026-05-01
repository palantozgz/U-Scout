import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  approvalStatusQueryKey,
  useApprovalStatus,
  type ApprovalSlide,
} from "@/lib/approval-api";

export interface OverridePanelProps {
  playerId: string;
  coachId: string;
  locale: "en" | "es" | "zh";
  onOverrideChange?: () => void;
}

/** Same auth pattern as ReportViewV4.authedFetch (duplicated until shared). */
async function authedFetch(url: string, init: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${init.method ?? "GET"} ${url} → ${res.status}: ${text}`);
  }
  return res;
}

const TRACKED_DISPLAY_KEYS = [
  "situation.0",
  "situation.1",
  "situation.2",
  "defense.deny",
  "defense.force",
  "defense.allow",
  "alert.0",
  "alert.1",
] as const;

type DisplayKey = (typeof TRACKED_DISPLAY_KEYS)[number];

function toServerSlideAndItemKey(displayKey: DisplayKey): { slide: ApprovalSlide; itemKey: string } {
  if (displayKey.startsWith("defense.")) {
    const kind = displayKey.replace("defense.", "") as "deny" | "force" | "allow";
    return { slide: "defense", itemKey: `${kind}.instruction` };
  }
  if (displayKey.startsWith("situation.")) {
    return { slide: "situations", itemKey: displayKey };
  }
  return { slide: "alerts", itemKey: displayKey };
}

function serverRowToDisplayKey(slide: string, itemKey: string): DisplayKey | null {
  if (slide === "situations" && /^situation\.\d+$/.test(itemKey)) {
    if ((TRACKED_DISPLAY_KEYS as readonly string[]).includes(itemKey)) return itemKey as DisplayKey;
  }
  if (slide === "alerts" && /^alert\.\d+$/.test(itemKey)) {
    if ((TRACKED_DISPLAY_KEYS as readonly string[]).includes(itemKey)) return itemKey as DisplayKey;
  }
  if (slide === "defense") {
    const prefix = itemKey.split(".")[0];
    const dk = `defense.${prefix}` as DisplayKey;
    if (prefix === "deny" || prefix === "force" || prefix === "allow") {
      if ((TRACKED_DISPLAY_KEYS as readonly string[]).includes(dk)) return dk;
    }
  }
  return null;
}

function formatItemLabel(displayKey: DisplayKey, locale: "en" | "es" | "zh"): string {
  if (displayKey.startsWith("situation.")) {
    const n = Number(displayKey.split(".")[1] ?? "0") + 1;
    if (locale === "es") return `Situación ${n}`;
    if (locale === "zh") return `情境 ${n}`;
    return `Situation ${n}`;
  }
  if (displayKey === "defense.deny") {
    if (locale === "es") return "Negar (Deny)";
    if (locale === "zh") return "封堵 (Deny)";
    return "Deny";
  }
  if (displayKey === "defense.force") {
    if (locale === "es") return "Forzar (Force)";
    if (locale === "zh") return "逼迫 (Force)";
    return "Force";
  }
  if (displayKey === "defense.allow") {
    if (locale === "es") return "Permitir (Allow)";
    if (locale === "zh") return "放开 (Allow)";
    return "Allow";
  }
  const an = Number(displayKey.split(".")[1] ?? "0") + 1;
  if (locale === "es") return `Alerta ${an}`;
  if (locale === "zh") return `提醒 ${an}`;
  return `Alert ${an}`;
}

const playerOverridesQueryKey = (playerId: string) => ["player-overrides", playerId] as const;

export function OverridePanel({ playerId, coachId, locale, onOverrideChange }: OverridePanelProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const overridesFetchQ = useQuery({
    queryKey: playerOverridesQueryKey(playerId),
    queryFn: async (): Promise<
      Array<{ coachId?: string; slide: string; itemKey: string; action: string }> | null
    > => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url = `/api/players/${encodeURIComponent(playerId)}/overrides`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        // TODO: add GET /api/players/:id/overrides on server — until then approval-status supplies rows.
        return null;
      }
      return (await res.json()) as Array<{ coachId?: string; slide: string; itemKey: string; action: string }>;
    },
    enabled: Boolean(playerId),
    networkMode: "offlineFirst",
  });

  const { data: approvalData } = useApprovalStatus(playerId, {
    enabled: Boolean(playerId),
  });

  const actionByDisplayKey = useMemo(() => {
    const m = new Map<DisplayKey, "hide" | "keep">();
    const fromGet = overridesFetchQ.data;
    const rows =
      fromGet && fromGet.length > 0
        ? fromGet.filter((r) => !coachId || !r.coachId || r.coachId === coachId)
        : (approvalData?.overrides ?? []).filter((o) => o.coachId === coachId);

    for (const o of rows) {
      if (o.action !== "hide" && o.action !== "keep") continue;
      const dk = serverRowToDisplayKey(o.slide, o.itemKey);
      if (dk) m.set(dk, o.action as "hide" | "keep");
    }
    return m;
  }, [overridesFetchQ.data, approvalData?.overrides, coachId]);

  const hiddenCount = useMemo(() => {
    let n = 0;
    for (const k of TRACKED_DISPLAY_KEYS) {
      if (actionByDisplayKey.get(k) === "hide") n++;
    }
    return n;
  }, [actionByDisplayKey]);

  const toggleLabel =
    locale === "es"
      ? hiddenCount > 0
        ? `Revisar ítems · ${hiddenCount} ocultos`
        : "Revisar ítems"
      : locale === "zh"
        ? hiddenCount > 0
          ? `检查项目 · ${hiddenCount} 项隐藏`
          : "检查项目"
        : hiddenCount > 0
          ? `Review items · ${hiddenCount} hidden`
          : "Review items";

  const sectionTitles = {
    situations:
      locale === "es" ? "Situaciones" : locale === "zh" ? "情境" : "Situations",
    defense:
      locale === "es"
        ? "Instrucción defensiva"
        : locale === "zh"
          ? "防守指令"
          : "Defense",
    alerts: locale === "es" ? "Alertas" : locale === "zh" ? "提醒" : "Alerts",
  };

  async function setItemAction(displayKey: DisplayKey, action: "hide" | "keep") {
    const { slide, itemKey } = toServerSlideAndItemKey(displayKey);
    setPendingKey(displayKey);
    try {
      await authedFetch(`/api/players/${encodeURIComponent(playerId)}/overrides`, {
        method: "POST",
        body: JSON.stringify({ slide, itemKey, action }),
      });
      await qc.invalidateQueries({ queryKey: approvalStatusQueryKey(playerId) });
      await qc.invalidateQueries({ queryKey: playerOverridesQueryKey(playerId) });
      onOverrideChange?.();
    } catch (e) {
      console.error("[OverridePanel] override failed", e);
    } finally {
      setPendingKey(null);
    }
  }

  function onPillTap(displayKey: DisplayKey) {
    const isHidden = actionByDisplayKey.get(displayKey) === "hide";
    void setItemAction(displayKey, isHidden ? "keep" : "hide");
  }

  function row(displayKey: DisplayKey) {
    const isHidden = actionByDisplayKey.get(displayKey) === "hide";
    const busy = pendingKey === displayKey;
    return (
      <div
        key={displayKey}
        className="flex justify-between items-center py-2 border-b border-border/40 last:border-0"
      >
        <span className="text-[11px] font-semibold text-foreground truncate pr-2">
          {formatItemLabel(displayKey, locale)}
        </span>
        <button
          type="button"
          disabled={busy || !coachId}
          onClick={() => onPillTap(displayKey)}
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold transition-opacity",
            isHidden ? "bg-muted text-muted-foreground/50" : "bg-emerald-500/15 text-emerald-600",
            busy ? "opacity-50 pointer-events-none" : "",
          ].join(" ")}
        >
          {isHidden ? "HIDDEN" : "VISIBLE"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full bg-muted/40 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-left text-foreground"
      >
        {toggleLabel}
      </button>
      {expanded && (
        <div className="rounded-xl border border-border/60 bg-card/50 px-3 py-2 space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
              {sectionTitles.situations}
            </p>
            {(["situation.0", "situation.1", "situation.2"] as const).map((k) => row(k))}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
              {sectionTitles.defense}
            </p>
            {(["defense.deny", "defense.force", "defense.allow"] as const).map((k) => row(k))}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
              {sectionTitles.alerts}
            </p>
            {(["alert.0", "alert.1"] as const).map((k) => row(k))}
          </div>
        </div>
      )}
    </div>
  );
}
