import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ClubAgeCategory,
  ClubGender,
  ClubLeagueType,
  ClubLevel,
} from "@shared/club-context";
import { apiRequest } from "./queryClient";

export const clubQueryKey = ["/api/club"] as const;
/** v3 — bump second segment when stats JSON shape changes (avoids stale persisted cache without auth fields). */
export const clubStatsQueryKey = ["/api/club/stats", "v3"] as const;

export interface ClubMemberDto {
  id: string;
  clubId: string;
  userId: string;
  role: string;
  displayName: string;
  jerseyNumber: string;
  position: string;
  operationsAccess?: boolean;
  status: string;
  invitedEmail: string | null;
  joinedAt: string | null;
  createdAt: string;
  /** From Supabase Auth user_metadata.full_name when service role lookup succeeds */
  authFullName?: string | null;
  authEmail?: string | null;
}

export interface ClubInvitationDto {
  id: string;
  clubId: string;
  role: string;
  token: string;
  invitedEmail: string | null;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  link: string;
}

export interface ClubPayload {
  club: {
    id: string;
    name: string;
    logo: string;
    ownerId: string;
    createdAt: string;
    leagueType?: string | null;
    gender?: string | null;
    level?: string | null;
    ageCategory?: string | null;
  };
  members: ClubMemberDto[];
  pendingInvitations: ClubInvitationDto[];
}

export function useClub(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clubQueryKey,
    queryFn: async (): Promise<ClubPayload> => (await apiRequest("GET", "/api/club")).json(),
    networkMode: "offlineFirst",
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

export type PatchClubBody = {
  name?: string;
  logo?: string;
  leagueType?: ClubLeagueType | null;
  gender?: ClubGender | null;
  level?: ClubLevel | null;
  ageCategory?: ClubAgeCategory | null;
};

export function usePatchClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PatchClubBody) => {
      const res = await apiRequest("PATCH", "/api/club", body);
      return res.json() as Promise<ClubPayload["club"]>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clubQueryKey });
    },
  });
}

export function useClubInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { role: "head_coach" | "coach" | "player"; email?: string }) => {
      const payload =
        body.email && body.email.trim().length > 0
          ? { role: body.role, email: body.email.trim() }
          : { role: body.role };
      const res = await apiRequest("POST", "/api/club/invite", payload);
      return res.json() as Promise<{ token: string; link: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clubQueryKey });
    },
  });
}

export function useDeleteClubMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/club/members/${encodeURIComponent(memberId)}`);
    },
    onMutate: async (memberId) => {
      await qc.cancelQueries({ queryKey: clubQueryKey });
      const prev = qc.getQueryData<ClubPayload>(clubQueryKey);
      if (prev) {
        qc.setQueryData<ClubPayload>(clubQueryKey, {
          ...prev,
          members: prev.members.filter((m) => m.id !== memberId),
        });
      }
      return { prev };
    },
    onError: (_err, _memberId, ctx) => {
      if (ctx?.prev) qc.setQueryData(clubQueryKey, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: clubQueryKey });
      void qc.invalidateQueries({ queryKey: clubStatsQueryKey });
    },
  });
}

export function useBanClubMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ban }: { id: string; ban: boolean }) => {
      const path = ban
        ? `/api/club/members/${encodeURIComponent(id)}/ban`
        : `/api/club/members/${encodeURIComponent(id)}/unban`;
      await apiRequest("PATCH", path, {});
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: clubQueryKey });
      const prev = qc.getQueryData<ClubPayload>(clubQueryKey);
      if (prev) {
        qc.setQueryData<ClubPayload>(clubQueryKey, {
          ...prev,
          members: prev.members.map((m) =>
            m.id === args.id ? { ...m, status: args.ban ? "banned" : "active" } : m,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(clubQueryKey, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: clubQueryKey });
    },
  });
}

export function useSetClubMemberOperationsAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; operationsAccess: boolean }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/club/members/${encodeURIComponent(args.id)}/operations-access`,
        { operationsAccess: args.operationsAccess },
      );
      const text = await res.text().catch(() => "");
      if (!text || text.trim().length === 0) {
        throw new Error(`Empty response from server (${res.status} ${res.url})`);
      }
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Show the first chars so devs can see HTML/text responses.
        const ct = res.headers.get("content-type") ?? "unknown";
        throw new Error(
          `Non-JSON response (${res.status} ${res.url}) [${ct}]: ${text.slice(0, 180)}`,
        );
      }
      if (parsed?.ok !== true || !parsed?.member) {
        throw new Error(
          typeof parsed?.error === "string"
            ? parsed.error + (typeof parsed?.detail === "string" ? `: ${parsed.detail}` : "")
            : "Unexpected response from server",
        );
      }
      return parsed.member as ClubMemberDto;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: clubQueryKey });
      const prev = qc.getQueryData<ClubPayload>(clubQueryKey);
      if (prev) {
        qc.setQueryData<ClubPayload>(clubQueryKey, {
          ...prev,
          members: prev.members.map((m) => (m.id === args.id ? { ...m, operationsAccess: args.operationsAccess } : m)),
        });
      }
      return { prev };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(clubQueryKey, ctx.prev);
    },
    onSettled: () => {
      // Always refetch to ensure server is source of truth.
      void qc.invalidateQueries({ queryKey: clubQueryKey });
    },
  });
}

export function useRevokeClubInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await apiRequest("DELETE", `/api/club/invitations/${encodeURIComponent(invitationId)}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clubQueryKey });
    },
  });
}

export function useClubStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clubStatsQueryKey,
    enabled: options?.enabled !== false,
    queryFn: async () =>
      (await apiRequest("GET", "/api/club/stats")).json() as Promise<{
        players: Array<{
          memberId: string;
          userId: string;
          displayName: string;
          authFullName?: string | null;
          authEmail?: string | null;
          invitedEmail?: string | null;
          reportsAssigned: number;
          lastSeen: string | null;
        }>;
        coaches: Array<{
          memberId: string;
          userId: string;
          displayName: string;
          authFullName?: string | null;
          authEmail?: string | null;
          invitedEmail?: string | null;
          role: string;
          playersScouted: number;
        }>;
      }>,
    networkMode: "offlineFirst",
  });
}

export async function fetchClubInvitationPublic(token: string) {
  const res = await fetch(`/api/club/invitations/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "load_failed");
  return data as {
    club: { id: string; name: string; logo: string };
    role: string;
    expiresAt: string;
    expired: boolean;
    used: boolean;
  };
}

export function useAcceptClubInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", `/api/club/invitations/${encodeURIComponent(token)}/accept`, {});
      return res.json() as Promise<{ ok: boolean; clubId: string; role: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clubQueryKey });
      void qc.invalidateQueries({ queryKey: clubStatsQueryKey });
    },
  });
}
