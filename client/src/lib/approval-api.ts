import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

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

function invalidatePlayerApprovalQueries(qc: ReturnType<typeof useQueryClient>, playerId: string) {
  void qc.invalidateQueries({ queryKey: approvalStatusQueryKey(playerId) });
  void qc.invalidateQueries({ queryKey: ["/api/players", playerId] });
  void qc.invalidateQueries({ queryKey: ["/api/players"] });
}

export function useApproveReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/approve`, {});
    },
    onSuccess: () => invalidatePlayerApprovalQueries(qc, playerId),
  });
}

export function useUnapproveReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/players/${encodeURIComponent(playerId)}/approve`);
    },
    onSuccess: () => invalidatePlayerApprovalQueries(qc, playerId),
  });
}

export function useSetReportOverride(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { slide: ApprovalSlide; itemKey: string; action: "hide" | "keep" }) => {
      await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/overrides`, body);
    },
    onSuccess: () => invalidatePlayerApprovalQueries(qc, playerId),
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
    onSuccess: () => invalidatePlayerApprovalQueries(qc, playerId),
  });
}

export function usePublishReport(playerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/players/${encodeURIComponent(playerId)}/publish`, {});
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: () => invalidatePlayerApprovalQueries(qc, playerId),
  });
}
