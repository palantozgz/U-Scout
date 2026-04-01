#!/usr/bin/env python3
"""
U Scout — Clean hooks patch
Replaces the broken complex mutations with simple clean versions.
Run from project root: python3 patch_hooks.py
"""
import sys

filepath = "client/src/lib/mock-data.ts"
try:
    with open(filepath, "r") as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: {filepath} not found. Run from project root.")
    sys.exit(1)

# Find where the hooks start and replace everything from useTeams onwards
hooks_start = content.find("\nexport function useTeams()")
if hooks_start == -1:
    hooks_start = content.find("export function useTeams()")

if hooks_start == -1:
    print("ERROR: Could not find useTeams() in mock-data.ts")
    sys.exit(1)

# Keep everything before the hooks, replace hooks with clean versions
motor_code = content[:hooks_start]

clean_hooks = '''
// ─── TanStack Query hooks ──────────────────────────────────────────────────────
// Simple mutations — server is source of truth.
// No optimistic updates, no tempIds, no custom cache surgery.
// On success: invalidate queries and let React Query refetch.

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn:  async () => (await apiRequest("GET", "/api/teams")).json(),
  });
}

export function usePlayers(teamId?: string) {
  return useQuery<PlayerProfile[]>({
    queryKey: ["/api/players", teamId],
    queryFn:  async () =>
      (await apiRequest("GET", teamId ? `/api/players?teamId=${teamId}` : "/api/players")).json(),
  });
}

export function usePlayer(id: string) {
  return useQuery<PlayerProfile>({
    queryKey: ["/api/players", id],
    queryFn:  async () => (await apiRequest("GET", `/api/players/${id}`)).json(),
    enabled:  !!id && id !== "new",
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (team: Omit<Team, "id">) =>
      (await apiRequest("POST", "/api/teams", team)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Team> }) =>
      (await apiRequest("PATCH", `/api/teams/${id}`, updates)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/teams/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  return useMutation<PlayerProfile, Error, Omit<PlayerProfile, "id">>({
    mutationFn: async (player) =>
      (await apiRequest("POST", "/api/players", player)).json(),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/players"] });
      qc.setQueryData(["/api/players", created.id], created);
    },
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation<PlayerProfile, Error, { id: string; updates: Partial<PlayerProfile> }>({
    mutationFn: async ({ id, updates }) =>
      (await apiRequest("PATCH", `/api/players/${id}`, updates)).json(),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["/api/players"] });
      qc.setQueryData(["/api/players", updated.id], updated);
    },
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => { await apiRequest("DELETE", `/api/players/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/players"] }),
  });
}
'''

new_content = motor_code + clean_hooks

with open(filepath, "w") as f:
    f.write(new_content)

lines_before = content.count('\n')
lines_after  = new_content.count('\n')
print(f"✅ Hooks replaced")
print(f"   Before: {lines_before} lines")
print(f"   After:  {lines_after} lines  (removed {lines_before - lines_after} lines of complexity)")
print()
print("Verify:")
print("  useCreatePlayer accepts: Omit<PlayerProfile, 'id'>  ✓")
print("  useUpdatePlayer accepts: { id, updates }            ✓")
print("  useDeletePlayer accepts: string (id)                ✓")
print("  No tempIds, no queues, no custom cache              ✓")
