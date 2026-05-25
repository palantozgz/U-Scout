import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export interface PlaybookPlan {
  id: string;
  clubId: string;
  type: string;
  name: string;
  opponentName?: string | null;
  gameId?: number | null;
  seasonLabel?: string | null;
  notes?: string | null;
  answers: Record<string, unknown>;
  report: Record<string, unknown>;
  visibility: "draft" | "staff" | "players";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
}

export function usePlans(type = "defensive") {
  return useQuery({
    queryKey: ["playbook-plans", type],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/playbook/plans");
      const data = (await r.json()) as PlaybookPlan[];
      return data.filter((p) => p.type === type);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<PlaybookPlan>) => {
      const r = await apiRequest("POST", "/api/playbook/plans", body);
      return r.json() as Promise<PlaybookPlan>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook-plans"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<PlaybookPlan> & { id: string }) => {
      const r = await apiRequest("PATCH", `/api/playbook/plans/${id}`, body);
      return r.json() as Promise<PlaybookPlan>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook-plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/playbook/plans/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook-plans"] }),
  });
}
