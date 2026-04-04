import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { supabase } from "./supabase";

export type ApprovalSlide = "identity" | "attack" | "danger" | "screens" | "plan";

export interface ApprovalStatusPayload {
  approvals: Array<{ coachId: string; approvedAt: string }>;
  totalStaff: number;
  overrides: Array<{ coachId: string; slide: string; itemKey: string; action: string }>;
  isPublished: boolean;
  hasDiscrepancy: boolean;
}

export function approvalStatusQueryKey(playerId: string | undefined) {
  return ["approval-status", playerId] as const;
}

export function useApprovalStatus(playerId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalStatusQueryKey(playerId),
    queryFn: async (): Promise<ApprovalStatusPayload> =>
      (await apiRequest("GET", `/api/players/${encodeURIComponent(playerId!)}/approval-status`)).json(),
    enabled: Boolean(playerId) && (options?.enabled ?? true),
    networkMode: "offlineFirst",
  });
}

async function invalidatePlayerApprovalQueries(qc: ReturnType<typeof useQueryClient>, playerId: string) {
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

export function useSetReportOverride(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { slide: ApprovalSlide; itemKey: string; action: "hide" | "keep" }) => {
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
