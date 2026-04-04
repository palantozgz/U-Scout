import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export interface PlayerHomeMembership {
  jerseyNumber: string;
  position: string;
  displayName: string;
  role: string;
  team: { id: string; name: string; logo: string };
}

export interface PlayerHomeReport {
  assignmentId: string;
  assignedAt: string;
  opponentPlayerId: string;
  opponentName: string;
  opponentTeamId: string;
  opponentTeamName: string;
}

export interface PlayerHomePayload {
  membership: PlayerHomeMembership | null;
  reports: PlayerHomeReport[];
}

export function usePlayerHome() {
  return useQuery({
    queryKey: ["/api/player/home"],
    queryFn: async (): Promise<PlayerHomePayload> =>
      (await apiRequest("GET", "/api/player/home")).json(),
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
      qc.invalidateQueries({ queryKey: ["/api/teams"] });
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
      qc.invalidateQueries({ queryKey: ["/api/player/home"] });
    },
  });
}
