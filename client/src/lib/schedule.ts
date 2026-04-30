import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { todayKey } from "@/lib/wellness";

export type ScheduleEvent = {
  id: string;
  club_id: string;
  session_type: "training" | "match" | "travel" | "meeting" | "recovery" | "other";
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  attendance_required: boolean;
  created_by: string;
  created_at: string;
};

export type ScheduleParticipant = {
  id: string;
  club_id: string;
  event_id: string;
  user_id: string;
  status: "confirmed" | "declined" | "maybe";
  responded_at: string;
};

export function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfTomorrowLocal(): Date {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() + 1);
  return d;
}

export function endOfWeekLocal(): Date {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() + 7);
  return d;
}

async function fetchScheduleEventsRange(params: { clubId: string; fromIso: string; toIso: string }) {
  const { data, error } = await supabase
    .from("schedule_events")
    .select(
      "id, club_id, session_type, title, starts_at, ends_at, location, notes, attendance_required, created_by, created_at",
    )
    .eq("club_id", params.clubId)
    .gte("starts_at", params.fromIso)
    .lt("starts_at", params.toIso)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data as ScheduleEvent[]) ?? [];
}

export function useScheduleEventsRange(params: { clubId?: string; fromIso?: string; toIso?: string; key: string }) {
  return useQuery({
    queryKey: ["schedule", "events", "range", params.key, params.clubId ?? null, params.fromIso ?? null, params.toIso ?? null],
    enabled: Boolean(params.clubId) && Boolean(params.fromIso) && Boolean(params.toIso),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<ScheduleEvent[]> => {
      return await fetchScheduleEventsRange({ clubId: params.clubId!, fromIso: params.fromIso!, toIso: params.toIso! });
    },
  });
}

export function useTodayScheduleEvents(params: { clubId?: string }) {
  return useQuery({
    queryKey: ["schedule", "events", "today", params.clubId ?? null],
    enabled: Boolean(params.clubId),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<ScheduleEvent[]> => {
      const from = startOfTodayLocal().toISOString();
      const to = startOfTomorrowLocal().toISOString();
      return await fetchScheduleEventsRange({ clubId: params.clubId!, fromIso: from, toIso: to });
    },
  });
}

export function useTomorrowScheduleEvents(params: { clubId?: string }) {
  return useQuery({
    queryKey: ["schedule", "events", "tomorrow", params.clubId ?? null],
    enabled: Boolean(params.clubId),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<ScheduleEvent[]> => {
      const from = startOfTomorrowLocal();
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return await fetchScheduleEventsRange({
        clubId: params.clubId!,
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
      });
    },
  });
}

export function useThisWeekScheduleEvents(params: { clubId?: string }) {
  return useQuery({
    queryKey: ["schedule", "events", "week", params.clubId ?? null],
    enabled: Boolean(params.clubId),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<ScheduleEvent[]> => {
      const from = startOfTodayLocal().toISOString();
      const to = endOfWeekLocal().toISOString();
      return await fetchScheduleEventsRange({ clubId: params.clubId!, fromIso: from, toIso: to });
    },
  });
}

export function useCreateScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: async (vars) => {
      // Optimistic insert into today's events cache when applicable.
      const clubId = vars.club_id;
      const startsAt = new Date(vars.starts_at);
      const from = startOfTodayLocal();
      const to = startOfTomorrowLocal();
      if (startsAt < from || startsAt >= to) return { clubId, inserted: false as const };

      const key = ["schedule", "events", "today", clubId] as const;
      const previous = qc.getQueryData<ScheduleEvent[]>(key);
      const optimistic: ScheduleEvent = {
        id: `optimistic-${Math.random().toString(16).slice(2)}`,
        club_id: vars.club_id,
        session_type: vars.session_type,
        title: vars.title,
        starts_at: vars.starts_at,
        ends_at: vars.ends_at ?? null,
        location: vars.location ?? null,
        notes: vars.notes ?? null,
        attendance_required: vars.attendance_required ?? true,
        created_by: vars.created_by,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<ScheduleEvent[]>(key, (cur) => {
        const next = [...(cur ?? []), optimistic];
        next.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        return next;
      });

      return { clubId, inserted: true as const, key, previous };
    },
    mutationFn: async (body: {
      club_id: string;
      session_type: ScheduleEvent["session_type"];
      title: string;
      starts_at: string;
      ends_at?: string | null;
      location?: string | null;
      notes?: string | null;
      attendance_required?: boolean;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from("schedule_events")
        .insert({
          club_id: body.club_id,
          session_type: body.session_type,
          title: body.title,
          starts_at: body.starts_at,
          ends_at: body.ends_at ?? null,
          location: body.location ?? null,
          notes: body.notes ?? null,
          attendance_required: body.attendance_required ?? true,
          created_by: body.created_by,
        })
        .select("id, club_id, session_type, title, starts_at, ends_at, location, notes, attendance_required, created_by, created_at")
        .single();
      if (error) throw error;
      return data as ScheduleEvent;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx && "inserted" in ctx && ctx.inserted && ctx.key) {
        qc.setQueryData(ctx.key, ctx.previous ?? []);
      }
    },
    onSuccess: (event, vars, ctx) => {
      const key = ["schedule", "events", "today", vars.club_id] as const;
      // Replace optimistic row (if any) with real one, then ensure fresh ordering.
      qc.setQueryData<ScheduleEvent[]>(key, (cur) => {
        const withoutOptimistic = (cur ?? []).filter((e) => !e.id.startsWith("optimistic-"));
        const next = [...withoutOptimistic, event];
        next.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        return next;
      });
    },
    onSettled: (_event, _err, vars) => {
      void qc.invalidateQueries({ queryKey: ["schedule", "events"], exact: false });
    },
  });
}

export function useUpdateScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: async (vars: { id: string; club_id: string; patch: Partial<Omit<ScheduleEvent, "id" | "club_id" | "created_at" | "created_by">> }) => {
      const clubId = vars.club_id;
      const keys = [
        ["schedule", "events", "today", clubId] as const,
        ["schedule", "events", "tomorrow", clubId] as const,
        ["schedule", "events", "week", clubId] as const,
      ];
      const previous = keys.map((k) => [k, qc.getQueryData<ScheduleEvent[]>(k)] as const);
      for (const k of keys) {
        qc.setQueryData<ScheduleEvent[]>(k, (cur) => {
          const list = cur ?? [];
          const next = list.map((e) => (e.id === vars.id ? { ...e, ...vars.patch } as ScheduleEvent : e));
          next.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
          return next;
        });
      }
      return { keys, previous };
    },
    mutationFn: async (body: {
      id: string;
      club_id: string;
      patch: {
        session_type?: ScheduleEvent["session_type"];
        title?: string;
        starts_at?: string;
        ends_at?: string | null;
        location?: string | null;
        notes?: string | null;
        attendance_required?: boolean;
      };
    }) => {
      const { data, error } = await supabase
        .from("schedule_events")
        .update(body.patch)
        .eq("id", body.id)
        .eq("club_id", body.club_id)
        .select(
          "id, club_id, session_type, title, starts_at, ends_at, location, notes, attendance_required, created_by, created_at",
        )
        .single();
      if (error) throw error;
      return data as ScheduleEvent;
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.previous) qc.setQueryData(key, data);
    },
    onSettled: (_d, _e, vars) => {
      void qc.invalidateQueries({ queryKey: ["schedule", "events"], exact: false });
      void qc.invalidateQueries({ queryKey: ["schedule", "participants"], exact: false });
    },
  });
}

export function useDeleteScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: async (vars: { id: string; club_id: string }) => {
      const clubId = vars.club_id;
      const keys = [
        ["schedule", "events", "today", clubId] as const,
        ["schedule", "events", "tomorrow", clubId] as const,
        ["schedule", "events", "week", clubId] as const,
      ];
      const previous = keys.map((k) => [k, qc.getQueryData<ScheduleEvent[]>(k)] as const);
      for (const k of keys) {
        qc.setQueryData<ScheduleEvent[]>(k, (cur) => (cur ?? []).filter((e) => e.id !== vars.id));
      }
      return { keys, previous };
    },
    mutationFn: async (body: { id: string; club_id: string }) => {
      const { error } = await supabase.from("schedule_events").delete().eq("id", body.id).eq("club_id", body.club_id);
      if (error) throw error;
      return { id: body.id };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.previous) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["schedule", "events"], exact: false });
      void qc.invalidateQueries({ queryKey: ["schedule", "participants"], exact: false });
    },
  });
}

export function useScheduleParticipantsForUser(params: {
  clubId?: string;
  userId?: string;
  eventIds?: string[];
}) {
  const eventIds = params.eventIds ?? [];
  return useQuery({
    queryKey: ["schedule", "participants", "byUser", params.clubId ?? null, params.userId ?? null, eventIds],
    enabled: Boolean(params.clubId) && Boolean(params.userId) && eventIds.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<ScheduleParticipant[]> => {
      const { data, error } = await supabase
        .from("schedule_participants")
        .select("id, club_id, event_id, user_id, status, responded_at")
        .eq("club_id", params.clubId!)
        .eq("user_id", params.userId!)
        .in("event_id", eventIds);
      if (error) throw error;
      return (data as ScheduleParticipant[]) ?? [];
    },
  });
}

export function useScheduleParticipantsForEvents(params: { clubId?: string; eventIds?: string[] }) {
  const eventIds = params.eventIds ?? [];
  return useQuery({
    queryKey: ["schedule", "participants", "byEvents", params.clubId ?? null, eventIds],
    enabled: Boolean(params.clubId) && eventIds.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<ScheduleParticipant[]> => {
      const { data, error } = await supabase
        .from("schedule_participants")
        .select("id, club_id, event_id, user_id, status, responded_at")
        .eq("club_id", params.clubId!)
        .in("event_id", eventIds);
      if (error) throw error;
      return (data as ScheduleParticipant[]) ?? [];
    },
  });
}

export function useUpsertScheduleParticipant() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: async (vars) => {
      // Optimistically update any cached participant lists for this user+club.
      const prefix: readonly unknown[] = ["schedule", "participants", "byUser", vars.club_id, vars.user_id];
      const previous = qc.getQueriesData<ScheduleParticipant[]>({ queryKey: prefix, exact: false });

      qc.setQueriesData<ScheduleParticipant[]>({ queryKey: prefix, exact: false }, (cur) => {
        const existing = (cur ?? []).find((p) => p.event_id === vars.event_id);
        const nextRow: ScheduleParticipant = existing
          ? { ...existing, status: vars.status, responded_at: new Date().toISOString() }
          : {
              id: `optimistic-${Math.random().toString(16).slice(2)}`,
              club_id: vars.club_id,
              event_id: vars.event_id,
              user_id: vars.user_id,
              status: vars.status,
              responded_at: new Date().toISOString(),
            };
        const without = (cur ?? []).filter((p) => p.event_id !== vars.event_id);
        return [...without, nextRow];
      });

      return { prefix, previous };
    },
    mutationFn: async (body: {
      club_id: string;
      event_id: string;
      user_id: string;
      status: ScheduleParticipant["status"];
    }) => {
      const { data, error } = await supabase
        .from("schedule_participants")
        .upsert(
          {
            club_id: body.club_id,
            event_id: body.event_id,
            user_id: body.user_id,
            status: body.status,
            responded_at: new Date().toISOString(),
          },
          { onConflict: "event_id,user_id" },
        )
        .select("id, club_id, event_id, user_id, status, responded_at")
        .single();
      if (error) throw error;
      return data as ScheduleParticipant;
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.previous) {
        qc.setQueryData(key, data);
      }
    },
    onSuccess: (_data, vars) => {
      // The participants query key includes eventIds; invalidate by prefix so UI updates immediately.
      void qc.invalidateQueries({
        queryKey: ["schedule", "participants", "byUser", vars.club_id, vars.user_id],
        exact: false,
      });
    },
    onSettled: (_d, _e, vars) => {
      void qc.invalidateQueries({ queryKey: ["schedule", "participants", "byEvents", vars.club_id], exact: false });
    },
  });
}

export function useTodayWellnessSubmissionPct(params: { clubId?: string; playerUserIds?: string[] }) {
  const entryDate = todayKey();
  const ids = params.playerUserIds ?? [];
  return useQuery({
    queryKey: ["schedule", "wellnessPct", params.clubId ?? null, entryDate, ids],
    enabled: Boolean(params.clubId) && ids.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<{ submitted: number; total: number; pct: number }> => {
      const { data, error } = await supabase
        .from("wellness_entries")
        .select("user_id")
        .eq("club_id", params.clubId!)
        .eq("entry_date", entryDate)
        .in("user_id", ids);
      if (error) throw error;
      const submitted = (data ?? []).length;
      const total = ids.length;
      const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
      return { submitted, total, pct };
    },
  });
}

