import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { apiRequest } from "./queryClient";

export interface PlayerReport {
  assignmentId: string;
  assignedAt: string;
  opponentPlayerId: string;
  opponentName: string;
  opponentTeamId: string;
  opponentTeamName: string;
  opponentImageUrl: string;
  opponentNumber: string;
}

export interface PlayerMembership {
  jerseyNumber: string;
  position: string;
  displayName: string;
  role: string;
  team: { id: string; name: string; logo: string };
}

export interface PlayerHomeData {
  membership: PlayerMembership | null;
  reports: PlayerReport[];
}

async function fetchPlayerHome(): Promise<PlayerHomeData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("Not authenticated");
  }
  const res = await fetch("/api/player/home", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GET /api/player/home → ${res.status}: ${text}`);
  }
  return res.json() as Promise<PlayerHomeData>;
}

export function usePlayerHome() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["player-home"],
    queryFn: fetchPlayerHome,
    enabled: !loading && Boolean(user),
    networkMode: "offlineFirst",
  });
}

export async function fetchInvitationPublic(token: string) {
  const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "invite_load_failed");
  }
  return data as {
    team: { id: string; name: string; logo: string };
    role: string;
    expiresAt: string;
    expired: boolean;
    used: boolean;
  };
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { teamId: string; role: "coach" | "player" }) => {
      const res = await apiRequest("POST", "/api/invitations", body);
      return res.json() as Promise<{ invitation: { id: string; token: string }; link: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/teams"] });
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", `/api/invitations/${encodeURIComponent(token)}/accept`, {});
      return res.json() as Promise<{ ok: boolean; teamId: string; role: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["player-home"] });
    },
  });
}
