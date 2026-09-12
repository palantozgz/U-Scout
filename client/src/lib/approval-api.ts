import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { supabase } from "./supabase";
import type { ReportOverride } from "./overrideEngine";

export type ApprovalSlide =
  | "identity"
  | "attack"
  | "danger"
  | "screens"
  | "plan"
  | "situations"
  | "defense"
  | "alerts";

export interface ApprovalStatusPayload {
  approvals: Array<{ coachId: string; approvedAt: string }>;
  totalStaff: number;
  overrides: Array<{
    coachId: string;
    slide: string;
    itemKey: string;
    action: string;
    // Añadidos 2026-09-12 (picker de alternativas, spec motor-1.0 21.11) --
    // solo presentes cuando action === "replace".
    replacementValue?: string;
    originalScore?: number;
    replacementScore?: number;
  }>;
  isPublished: boolean;
  hasDiscrepancy: boolean;
}

export function approvalStatusQueryKey(playerId: string | undefined) {
  return ["approval-status", playerId] as const;
}

export function useApprovalStatus(
  playerId: string | undefined,
  options?: { enabled?: boolean; coachReviewMode?: boolean },
) {
  return useQuery({
    queryKey: approvalStatusQueryKey(playerId),
    queryFn: async (): Promise<ApprovalStatusPayload> =>
      (await apiRequest("GET", `/api/players/${encodeURIComponent(playerId!)}/approval-status`)).json(),
    enabled: Boolean(playerId) && (options?.enabled ?? true),
    refetchInterval: options?.coachReviewMode ? 30_000 : false,
    networkMode: "offlineFirst",
  });
}

/**
 * Map server rows to client ReportOverride.
 * CORREGIDO 2026-09-12 (picker de alternativas, spec 21.11): antes
 * colapsaba cualquier action que no fuera "hide" a "approve_as_is" --
 * un "replace" real (elegido en el picker) se perdía y `applyOverrides`
 * nunca llegaba a aplicarlo. Ahora se pasa tal cual, con su
 * replacementValue.
 */
export function serverOverridesToReportOverrides(
  rows: ApprovalStatusPayload["overrides"],
  playerId: string,
  coachId: string,
): ReportOverride[] {
  return rows
    .filter((o) => o.coachId === coachId)
    .map((o) => ({
      playerId,
      coachId: o.coachId,
      slide: o.slide,
      itemKey: o.itemKey,
      action: (o.action === "hide" || o.action === "replace" ? o.action : "approve_as_is") as
        | "hide"
        | "replace"
        | "approve_as_is",
      replacementValue: o.action === "replace" ? o.replacementValue : undefined,
      originalScore: o.originalScore,
      replacementScore: o.replacementScore,
    }));
}

export async function invalidatePlayerApprovalQueries(qc: QueryClient, playerId: string) {
  const key = approvalStatusQueryKey(playerId);
  await qc.invalidateQueries({ queryKey: key });
  await qc.refetchQueries({ queryKey: key, type: "active" });
  void qc.invalidateQueries({ queryKey: ["/api/players", playerId] });
  void qc.invalidateQueries({ queryKey: ["/api/players"] });
}

export function useApproveReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!playerId) throw new Error("approve: missing playerId");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("approve: not signed in (no access token)");
      }
      await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/approve`, {});
    },
    onSuccess: () => void invalidatePlayerApprovalQueries(qc, playerId),
    onError: (err) => {
      console.error("[useApproveReport]", { playerId, err });
    },
  });
}

export function useUnapproveReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!playerId) throw new Error("unapprove: missing playerId");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("unapprove: not signed in (no access token)");
      }
      await apiRequest("DELETE", `/api/players/${encodeURIComponent(playerId)}/approve`);
    },
    onSuccess: () => void invalidatePlayerApprovalQueries(qc, playerId),
    onError: (err) => {
      console.error("[useUnapproveReport]", { playerId, err });
    },
  });
}

export interface SetReportOverrideBody {
  slide: ApprovalSlide;
  itemKey: string;
  action: "hide" | "keep" | "replace" | "approve_as_is";
  /** Solo relevantes cuando action === "replace" (picker de alternativas, spec 21.11). */
  replacementValue?: string;
  originalScore?: number;
  replacementScore?: number;
  archetypeKey?: string;
  locale?: "en" | "es" | "zh";
}

export function useSetReportOverride(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SetReportOverrideBody) => {
      await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/overrides`, body);
    },
    onSuccess: () => void invalidatePlayerApprovalQueries(qc, playerId),
  });
}

export function useDeleteReportOverride(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemKey: string) => {
      await apiRequest(
        "DELETE",
        `/api/players/${encodeURIComponent(playerId)}/overrides/${encodeURIComponent(itemKey)}`,
      );
    },
    onSuccess: () => void invalidatePlayerApprovalQueries(qc, playerId),
  });
}

export function usePublishReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/publish`, {});
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: () => void invalidatePlayerApprovalQueries(qc, playerId),
  });
}

export function useUnpublishReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/unpublish`, {});
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: () => void invalidatePlayerApprovalQueries(qc, playerId),
  });
}
