import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Check, Users, MoreVertical, ShieldCheck, AlertTriangle, UserPlus, ClipboardList, Dumbbell, Send, X, ChevronRight, Sparkles, RotateCcw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

type Translate = ReturnType<typeof useLocale>["t"];
import { useAuth } from "@/lib/useAuth";
import { useCapabilities, type ClubMembership } from "@/lib/capabilities";
import { canBanMember, canRemoveMember, canToggleOperationsAccess, canToggleReportPublishAccess, type ClubActorRole } from "@/lib/clubMemberPermissions";
import {
  useClub,
  usePatchClub,
  useClubInvite,
  useBanClubMember,
  useSetClubMemberOperationsAccess,
  useSetClubMemberReportPublishAccess,
  useRevokeClubInvitation,
  useClubStats,
  clubStatsQueryKey,
  useCalibrationPatterns,
  usePromotePattern,
  useRevertPattern,
  type ClubMemberDto,
  type PatchClubBody,
  type CalibrationPattern,
} from "@/lib/club-api";
import { toast } from "@/hooks/use-toast";
import { isShortUserIdFallback, userDisplayLabel } from "@/lib/userDisplayLabel";
import { cn } from "@/lib/utils";
import { archetypeBaseLabel, INSTRUCTION_LABELS } from "@/lib/reportTextRendererV1";
import { rosterSignature, setStoredRosterSignature } from "@/lib/clubRosterSeen";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { ModuleIntroCard } from "@/components/ModuleIntroCard";
import { getModuleIntroContent } from "@/lib/module-intro-content";
import { DEFAULT_NOTIFY_TIME } from "@/lib/local-notifications";
import type {
  ClubAgeCategory,
  ClubGender,
  ClubLeagueType,
  ClubLevel,
  ClubReportMode,
  ClubModuleKey,
} from "@shared/club-context";
import {
  CLUB_AGE_CATEGORIES,
  CLUB_GENDERS,
  CLUB_LEVELS,
  LEAGUE_AUTO_INFER,
} from "@shared/club-context";

const CLUB_LEAGUE_SELECT_OPTIONS: { value: ClubLeagueType; i18nKey: string }[] = [
  { value: "nba", i18nKey: "club_league_nba" },
  { value: "euroleague_m", i18nKey: "club_league_euroleague_m" },
  { value: "euroleague_f", i18nKey: "club_league_euroleague_f" },
  { value: "acb", i18nKey: "club_league_acb" },
  { value: "cba", i18nKey: "club_league_cba" },
  { value: "wcba", i18nKey: "club_league_wcba" },
  { value: "ncaa_m", i18nKey: "club_league_ncaa_m" },
  { value: "ncaa_f", i18nKey: "club_league_ncaa_f" },
  { value: "cuba_m", i18nKey: "club_league_cuba_m" },
  { value: "cuba_f", i18nKey: "club_league_cuba_f" },
  { value: "fiba_americas", i18nKey: "club_league_fiba_americas" },
  { value: "amateur", i18nKey: "club_league_amateur" },
];

const LOGO_EMOJIS = ["🏀", "⛹️", "🔥", "⭐", "💪", "🎯"];
const CTX_UNSET = "__unset__";
const CLUB_LOGO_DATAURL_MAX = 480_000;

/** Preset leagues fix gender/level/age — except amateur, where the coach configures freely. */
function leagueLocksContextFields(leagueType: string | null | undefined): boolean {
  return Boolean(leagueType) && leagueType !== "amateur";
}

function isClubLogoImageUrl(logo: string): boolean {
  return logo.startsWith("data:image/") || /^https:\/\//i.test(logo);
}

function ClubLogoView({ logo, className }: { logo: string; className?: string }) {
  if (isClubLogoImageUrl(logo)) {
    return <img src={logo} alt="" className={cn("object-contain", className)} />;
  }
  return <span className={className}>{logo || "🏀"}</span>;
}

async function compressImageFileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load"));
      img.src = url;
    });
    const max = 256;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const scale = Math.min(1, max / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, w, h);
    let q = 0.88;
    let data = canvas.toDataURL("image/jpeg", q);
    while (data.length > CLUB_LOGO_DATAURL_MAX && q > 0.42) {
      q -= 0.07;
      data = canvas.toDataURL("image/jpeg", q);
    }
    if (data.length > CLUB_LOGO_DATAURL_MAX) throw new Error("too_large");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(
      locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en",
      { dateStyle: "medium", timeStyle: "short" },
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

function MemberLabel({
  userId,
  authFullName,
  authEmail,
  displayName,
  invitedEmail,
}: {
  userId: string;
  authFullName?: string | null;
  authEmail?: string | null;
  displayName: string;
  invitedEmail: string | null;
}) {
  const label = userDisplayLabel({
    userId,
    authFullName: authFullName ?? null,
    authEmail: authEmail ?? null,
    displayName,
    invitedEmail,
  });
  const idFallback = isShortUserIdFallback(label, userId);
  return (
    <span
      className={cn("truncate", idFallback ? "font-mono text-xs text-muted-foreground" : "font-semibold text-foreground")}
      title={userId}
    >
      {label}
    </span>
  );
}

function StatsUserName(props: {
  userId: string;
  authFullName?: string | null;
  authEmail?: string | null;
  displayName: string;
  invitedEmail?: string | null;
}) {
  const label = userDisplayLabel({
    userId: props.userId,
    authFullName: props.authFullName ?? null,
    authEmail: props.authEmail ?? null,
    displayName: props.displayName,
    invitedEmail: props.invitedEmail ?? null,
  });
  const idFallback = isShortUserIdFallback(label, props.userId);
  return (
    <p
      className={cn("font-semibold text-foreground", idFallback && "font-mono text-xs text-muted-foreground")}
      title={props.userId}
    >
      {label}
    </p>
  );
}

function firstNonEmptyString(
  a: string | null | undefined,
  b: string | null | undefined,
): string | undefined {
  const ta = typeof a === "string" ? a.trim() : "";
  if (ta) return ta;
  const tb = typeof b === "string" ? b.trim() : "";
  if (tb) return tb;
  return undefined;
}

/** Stats query is cached separately; overlay club /api/club member row so names match Staff tab. */
function mergeStatsRowWithClubMember(
  row: {
    userId: string;
    authFullName?: string | null;
    authEmail?: string | null;
    displayName: string;
    invitedEmail?: string | null;
  },
  clubMap: Map<string, ClubMemberDto>,
) {
  const cm = clubMap.get(row.userId);
  return {
    userId: row.userId,
    authFullName: firstNonEmptyString(cm?.authFullName, row.authFullName) ?? null,
    authEmail: firstNonEmptyString(cm?.authEmail, row.authEmail) ?? null,
    displayName: firstNonEmptyString(cm?.displayName, row.displayName) ?? "",
    invitedEmail: firstNonEmptyString(cm?.invitedEmail ?? undefined, row.invitedEmail ?? undefined) ?? null,
  };
}

export default function ClubManagement() {
  const { t, locale } = useLocale();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const [clubNameDraft, setClubNameDraft] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("club");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"coach" | "player">("coach");
  const [inviteEmail, setInviteEmail] = useState("");
  const [dialogLink, setDialogLink] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [matchRival, setMatchRival] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("12:00");
  const [matchLocation, setMatchLocation] = useState("");

  const q = useClub();
  const queryClient = useQueryClient();

  // ── League matches (Liga tab) ───────────────────────────────────────────────
  const matchesQ = useQuery<Array<{id:string;rivalName:string;matchDate:string;location:string|null;matchType:string}>>({    queryKey: ["/api/club/matches"],
    queryFn: async () => {
      try {
        const r = await apiRequest("GET", "/api/club/matches");
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    enabled: activeTab === "liga",
  });
  const createMatchMut = useMutation({
    mutationFn: async (data: {rivalName:string;matchDate:string;location:string}) => {
      const r = await apiRequest("POST", "/api/club/matches", data);
      return r.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/club/matches"] });
      setShowAddMatch(false); setMatchRival(""); setMatchDate(""); setMatchTime("12:00"); setMatchLocation("");
    },
    onError: () => {
      toast({ variant: "destructive", description: locale === "es" ? "Error al guardar el partido" : locale === "zh" ? "保存比赛失败" : "Failed to save match" });
    },
  });
  const deleteMatchMut = useMutation({
    mutationFn: async (id:string) => {
      await apiRequest("DELETE", `/api/club/matches/${id}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/club/matches"] }),
  });
  const patchClub = usePatchClub();

  const membership: ClubMembership | null = useMemo(() => {
    if (!profile?.id || !q.data?.club) return null;
    const me = q.data.members?.find((m) => m.userId === profile.id);
    if (!me) return null;
    return {
      clubId: q.data.club.id,
      userId: profile.id,
      role: me.role as ClubMembership["role"],
      status: me.status as ClubMembership["status"],
      isOwner: q.data.club.ownerId === profile.id,
      operationsAccess: Boolean(me.operationsAccess),
      // CORREGIDO 2026-09-14 (Nivel B/decantador, spec 38/39): faltaba --
      // caps.canAccessCalibrationPanel (antes canPublishReports) depende de
      // esto para un coach delegado, pero como esa capability nunca tuvo
      // consumidores reales hasta ahora, el hueco quedó dormido y sin
      // efecto visible hasta esta pantalla.
      reportPublishAccess: Boolean(me.reportPublishAccess),
    };
  }, [profile?.id, q.data?.club, q.data?.members]);

  const caps = useCapabilities({ membership });

  // Page entry: canManageClub (realRole + membership), not effectiveRole.
  useEffect(() => {
    if (!profile) return;
    if (profile.role === "player") {
      setLocation("/coach");
      return;
    }
    if (!q.data && profile.role !== "master") return;
    if (!caps.canManageClub) setLocation("/coach");
  }, [caps.canManageClub, profile, q.data, setLocation]);

  useEffect(() => {
    if (!q.data || !profile?.id) return;
    setStoredRosterSignature(profile.id, q.data.club.id, rosterSignature(q.data.members));
  }, [q.data, profile?.id]);
  const inviteMut = useClubInvite();
  const banMut = useBanClubMember();
  const opsMut = useSetClubMemberOperationsAccess();
  const publishMut = useSetClubMemberReportPublishAccess();
  const revokeInv = useRevokeClubInvitation();
  const statsQ = useClubStats({ enabled: activeTab === "stats" });

  const hintKey = useMemo(() => `uscout-hint:v1:club:${profile?.id ?? "anon"}`, [profile?.id]);
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    try {
      setHintDismissed(window.localStorage.getItem(hintKey) === "1");
    } catch {
      setHintDismissed(false);
    }
  }, [hintKey]);
  const dismissHint = () => {
    setHintDismissed(true);
    try { window.localStorage.setItem(hintKey, "1"); } catch {}
  };

  useEffect(() => {
    if (activeTab !== "stats") return;
    void queryClient.invalidateQueries({ queryKey: clubStatsQueryKey });
  }, [activeTab, queryClient]);

  useEffect(() => {
    if (q.data?.club) {
      if (!nameDirty) {
        setClubNameDraft(q.data.club.name);
      }
    }
  }, [q.data?.club, nameDirty]);

  const canEditBranding = caps.canEditClub;

  /** Owner/master, or active club head coach — can edit league / gender / level / age (head coach cannot rename club or logo). */
  const canEditClubContext = useMemo(() => {
    if (!profile || !q.data) return false;
    if (caps.canEditClub) return true;
    const me = q.data.members?.find((m) => m.userId === profile.id);
    return me?.status === "active" && me.role === "head_coach";
  }, [caps.canEditClub, profile, q.data]);

  const canInviteMembers = caps.canInviteMembers;
  const canSeeAdminActions = caps.canSeeAdminActions;

  const meClubRole = useMemo<ClubActorRole>(() => {
    if (profile?.role === "master") return "master";
    return membership?.role ?? null;
  }, [membership?.role, profile?.role]);

  const canManageStaff = useMemo(() => {
    if (meClubRole === "master") return true;
    return membership?.role === "head_coach" && membership.status === "active";
  }, [meClubRole, membership?.role, membership?.status]);

  const clubMemberByUserId = useMemo(() => {
    const map = new Map<string, ClubMemberDto>();
    for (const m of q.data?.members ?? []) {
      map.set(m.userId, m);
    }
    return map;
  }, [q.data?.members]);

  const overview = useMemo(() => {
    if (!q.data) return null;
    const members = q.data.members;
    const staff = (members ?? []).filter((m) => m.role === "coach" || m.role === "head_coach").filter((m) => m.status === "active");
    const roster = (members ?? []).filter((m) => m.role === "player").filter((m) => m.status === "active");
    const pendingInvites = (q.data.pendingInvitations ?? []).length;
    const banned = (members ?? []).filter((m) => m.status === "banned").length;

    const missingContext: string[] = [];
    if (!q.data.club.leagueType) missingContext.push(t("club_ctx_league"));
    if (!q.data.club.gender) missingContext.push(t("club_ctx_gender"));
    if (!q.data.club.level) missingContext.push(t("club_ctx_level"));
    if (!q.data.club.ageCategory) missingContext.push(t("club_ctx_age"));

    const alerts: Array<{ key: string; title: string; body: string }> = [];
    if (pendingInvites > 0) {
      alerts.push({
        key: "invites",
        title: t("club_overview_alert_pending_invites_title"),
        body: t("club_overview_alert_pending_invites_body")
          .replace("{count}", String(pendingInvites))
          .replace("{plural}", pendingInvites === 1 ? "" : "s"),
      });
    }
    if (missingContext.length > 0) {
      alerts.push({
        key: "context",
        title: t("club_overview_alert_context_incomplete_title"),
        body: t("club_overview_alert_context_incomplete_body").replace("{fields}", missingContext.join(", ")),
      });
    }
    if (banned > 0) {
      alerts.push({
        key: "banned",
        title: t("club_overview_alert_banned_title"),
        body: t("club_overview_alert_banned_body")
          .replace("{count}", String(banned))
          .replace("{plural}", banned === 1 ? "" : "s"),
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        key: "ok",
        title: t("club_overview_alert_all_clear_title"),
        body: t("club_overview_alert_all_clear_body"),
      });
    }

    const complianceScore = Math.max(0, 4 - missingContext.length);
    return {
      staffCount: staff.length,
      rosterCount: roster.length,
      pendingInvites,
      missingContext,
      complianceScore,
      complianceTotal: 4,
      alerts,
    };
  }, [q.data, t]);

  const copyLink = async (link: string, id: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const [icalLoading, setIcalLoading] = useState(false);
  const copyIcalLink = async () => {
    setIcalLoading(true);
    try {
      const r = await apiRequest("GET", "/api/club/ical-link");
      if (!r.ok) throw new Error("failed");
      const data = await r.json();
      await copyLink(data.url as string, "ical");
    } catch {
      toast({
        variant: "destructive",
        description:
          locale === "zh" ? "无法生成日历链接" : locale === "es" ? "No se pudo generar el enlace de calendario" : "Couldn't generate the calendar link",
      });
    } finally {
      setIcalLoading(false);
    }
  };

  const openInvite = (role: "coach" | "player") => {
    setInviteRole(role);
    setInviteEmail("");
    setDialogLink(null);
    setInviteOpen(true);
  };

  const onGenerateInvite = () => {
    inviteMut.mutate(
      { role: inviteRole, email: inviteEmail.trim() || undefined },
      {
        onSuccess: (data) => setDialogLink(data.link),
      },
    );
  };

  const roleLabel = useCallback(
    (role: string) => {
      if (role === "head_coach") return t("invite_role_head_coach");
      if (role === "coach") return t("team_mgmt_badge_coach");
      if (role === "player") return t("team_mgmt_badge_player");
      return role;
    },
    [t],
  );

  const cycleLogo = () => {
    if (!q.data?.club || !canEditBranding) return;
    const cur = q.data.club.logo || "🏀";
    if (isClubLogoImageUrl(cur)) return;
    const i = LOGO_EMOJIS.indexOf(cur);
    const next = LOGO_EMOJIS[(i + 1) % LOGO_EMOJIS.length];
    patchClub.mutate({ logo: next });
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !canEditBranding || !q.data) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(f);
      patchClub.mutate({ logo: dataUrl });
    } catch {
      toast({ variant: "destructive", description: t("club_logo_upload_error") });
    }
  };

  const onNameBlur = () => {
    if (!q.data?.club || !canEditBranding) return;
    const trimmed = clubNameDraft.trim();
    if (!trimmed || trimmed === q.data.club.name) return;
    patchClub.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setNameDirty(false);
        },
        onError: () => {
          setClubNameDraft(q.data!.club.name);
          setNameDirty(false);
        },
      },
    );
  };

  const isNoClubError = q.isError && String((q.error as Error)?.message).includes("404");

  if (profile?.role === "player") {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const clubIntro = getModuleIntroContent("club", locale, "staff");

  return (
    <div className="flex flex-col h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <ModuleIntroCard moduleKey="club" emoji={clubIntro.emoji} title={clubIntro.title} body={clubIntro.body} />
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/coach")} className="-ml-2 shrink-0">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-foreground truncate flex items-center gap-2">
            <Users className="w-5 h-5 text-primary shrink-0" />
            {t("club_mgmt_title")}
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 p-4 pb-10">
        {!hintDismissed ? (
          <div className="mb-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] md:text-sm font-semibold text-muted-foreground">
                {t("onboarding_staff_club_hint" as any)}
              </p>
              <button
                type="button"
                className="h-9 w-9 -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                onClick={dismissHint}
                aria-label={t("dismiss" as any)}
                title={t("dismiss" as any)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}

        {q.isLoading && !q.data && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isNoClubError && (
          <p className="text-sm text-muted-foreground text-center py-12 px-2">{t("club_no_club")}</p>
        )}

                {q.isError && !isNoClubError && !q.data && (
                  <div className="space-y-3 py-8">
                    <p className="text-sm text-destructive text-center">{t("club_load_error")}</p>
                    <div className="flex justify-center">
                      <Button variant="secondary" className="h-11 px-6" onClick={() => void q.refetch()}>
                        {t("retry")}
                      </Button>
                    </div>
                  </div>
                )}

        {q.data && (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="club" className="w-full">
              <TabsList
                className="flex h-auto w-full overflow-x-auto justify-start gap-1 p-1 mb-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <TabsTrigger value="club" className="text-xs font-bold">
                  {locale === "zh" ? "球队" : locale === "es" ? "Club" : "Club"}
                </TabsTrigger>
                <TabsTrigger value="liga" className="text-xs font-bold">
                  {locale === "zh" ? "赛程" : locale === "es" ? "Liga" : "League"}
                </TabsTrigger>
                <TabsTrigger value="equipo" className="text-xs font-bold">
                  {locale === "zh" ? "团队" : locale === "es" ? "Equipo" : "Team"}
                </TabsTrigger>
                <TabsTrigger value="stats" className="text-xs font-bold">
                  {t("club_tab_stats")}
                </TabsTrigger>
                {caps.canAccessCalibrationPanel && (
                  <TabsTrigger value="calibracion" className="text-xs font-bold">
                    {locale === "zh" ? "校准" : locale === "es" ? "Calibración" : "Calibration"}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="club" className="space-y-4 mt-0">
                <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={onLogoFile}
                    />
                    <div className="flex w-full sm:w-[6.75rem] sm:shrink-0 flex-col items-center sm:items-stretch gap-2">
                      {canEditBranding && !isClubLogoImageUrl(q.data.club.logo) ? (
                        <button
                          type="button"
                          onClick={cycleLogo}
                          className={cn(
                            "flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 text-5xl leading-none transition-[box-shadow]",
                            "ring-offset-background hover:ring-2 hover:ring-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                          )}
                          title={t("club_logo_hint")}
                          aria-label={t("club_logo_hint")}
                        >
                          <ClubLogoView logo={q.data.club.logo} className="max-h-[5.5rem] max-w-[5.5rem]" />
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 text-5xl leading-none",
                            canEditBranding && isClubLogoImageUrl(q.data.club.logo) && "ring-offset-background ring-2 ring-transparent",
                          )}
                        >
                          <ClubLogoView logo={q.data.club.logo} className="max-h-[5.5rem] max-w-[5.5rem]" />
                        </div>
                      )}
                      {canEditBranding &&
                        (isClubLogoImageUrl(q.data.club.logo) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-8 w-full px-1 text-[10px] md:text-xs font-bold leading-tight"
                              >
                                {t("club_logo_manage")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="min-w-[10rem]">
                              <DropdownMenuItem
                                className="font-medium"
                                onSelect={() => {
                                  window.requestAnimationFrame(() => logoFileRef.current?.click());
                                }}
                              >
                                {t("club_logo_replace")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="font-medium text-destructive focus:text-destructive"
                                onSelect={() => patchClub.mutate({ logo: "🏀" })}
                              >
                                {t("club_logo_remove")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 w-full px-1 text-[10px] md:text-xs font-bold leading-tight"
                            onClick={() => logoFileRef.current?.click()}
                          >
                            {t("club_logo_upload")}
                          </Button>
                        ))}
                    </div>
                    <div className="min-w-0 w-full space-y-1">
                      <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("club_name_label")}</p>
                      {canEditBranding ? (
                        <Input
                          value={clubNameDraft}
                          onChange={(e) => {
                            setNameDirty(true);
                            setClubNameDraft(e.target.value);
                          }}
                          onBlur={onNameBlur}
                          className="font-bold text-lg bg-background border-border"
                        />
                      ) : (
                        <p className="text-lg font-bold text-foreground truncate">{q.data.club.name}</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("club_ctx_section")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("club_ctx_hint")}</p>
                  {!canEditClubContext && (
                    <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
                      {t("club_ctx_viewer_hint")}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">{t("club_ctx_league")}</Label>
                      <Select
                        disabled={!canEditClubContext}
                        value={q.data.club.leagueType ?? CTX_UNSET}
                        onValueChange={(v) => {
                          const newLeague = v === CTX_UNSET ? null : (v as ClubLeagueType);
                          const updates: PatchClubBody = { leagueType: newLeague };
                          if (newLeague) {
                            const infer = LEAGUE_AUTO_INFER[newLeague] ?? {};
                            updates.gender = infer.gender;
                            updates.level = infer.level;
                            // `LEAGUE_AUTO_INFER` may not declare ageCategory in its TS type.
                            // Only apply if present at runtime.
                            const inferredAgeCategory = (infer as { ageCategory?: PatchClubBody["ageCategory"] }).ageCategory;
                            if (inferredAgeCategory !== undefined) updates.ageCategory = inferredAgeCategory;
                            patchClub.mutate(updates, {
                              onSuccess: () => {
                                toast({ description: t("club_league_infer_toast") });
                              },
                            });
                            return;
                          }
                          patchClub.mutate(updates);
                        }}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CTX_UNSET}>{t("club_ctx_not_set")}</SelectItem>
                          {CLUB_LEAGUE_SELECT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {t(opt.i18nKey as never)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">{t("club_ctx_gender")}</Label>
                      <Select
                        disabled={
                          !canEditClubContext ||
                          leagueLocksContextFields(q.data.club.leagueType)
                        }
                        value={q.data.club.gender ?? CTX_UNSET}
                        onValueChange={(v) =>
                          patchClub.mutate({ gender: v === CTX_UNSET ? null : (v as ClubGender) })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CTX_UNSET}>{t("club_ctx_not_set")}</SelectItem>
                          {CLUB_GENDERS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {t(`club_gender_${opt}` as never)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">{t("club_ctx_level")}</Label>
                      <Select
                        disabled={
                          !canEditClubContext ||
                          leagueLocksContextFields(q.data.club.leagueType)
                        }
                        value={q.data.club.level ?? CTX_UNSET}
                        onValueChange={(v) =>
                          patchClub.mutate({ level: v === CTX_UNSET ? null : (v as ClubLevel) })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CTX_UNSET}>{t("club_ctx_not_set")}</SelectItem>
                          {CLUB_LEVELS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {t(`club_level_${opt}` as never)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">{t("club_ctx_age")}</Label>
                      <Select
                        disabled={
                          !canEditClubContext ||
                          leagueLocksContextFields(q.data.club.leagueType)
                        }
                        value={q.data.club.ageCategory ?? CTX_UNSET}
                        onValueChange={(v) =>
                          patchClub.mutate({
                            ageCategory: v === CTX_UNSET ? null : (v as ClubAgeCategory),
                          })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CTX_UNSET}>{t("club_ctx_not_set")}</SelectItem>
                          {CLUB_AGE_CATEGORIES.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {t(`club_age_${opt}` as never)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        {locale === "zh" ? "球探默认报告视图" : locale === "es" ? "Vista por defecto de Scout" : "Scout default report view"}
                      </Label>
                      <Select
                        disabled={!canEditClubContext}
                        value={q.data.club.reportMode ?? "advanced"}
                        onValueChange={(v) =>
                          patchClub.mutate({ reportMode: v === "advanced" ? null : (v as ClubReportMode) })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="advanced">
                            {locale === "zh" ? "完整报告（3页）" : locale === "es" ? "Informe completo (3 slides)" : "Full report (3 slides)"}
                          </SelectItem>
                          <SelectItem value="simple">
                            {locale === "zh" ? "快速简报（1页）" : locale === "es" ? "Resumen rápido (1 slide)" : "Quick brief (1 slide)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] md:text-xs text-muted-foreground/60 leading-relaxed">
                        {locale === "zh"
                          ? "教练和球员仍可随时切换视图。这只是默认选项。"
                          : locale === "es"
                            ? "Coaches y jugadoras siguen pudiendo cambiar de vista en cualquier momento. Esto solo fija el punto de partida."
                            : "Coaches and players can still switch views anytime — this only sets the starting point."}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    {locale === "zh" ? "提醒时间" : locale === "es" ? "Horario de los avisos" : "Reminder times"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {locale === "zh"
                      ? "每天在这个时间提醒球员查看球探报告，以及另一个时间提醒她们完成健康打卡（仅 iOS 通知，需要球员在手机上开启权限）。"
                      : locale === "es"
                        ? "Cada día se avisa a las jugadoras a esta hora para revisar los scout reports, y a otra para rellenar su wellness (notificación de iOS — cada jugadora debe haberla activado en su móvil)."
                        : "Every day, players get a reminder at this time to check scout reports, and another to fill in their wellness (iOS notification — each player needs to have allowed it on her phone)."}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        {locale === "zh" ? "球探报告" : locale === "es" ? "Scout reports" : "Scout reports"}
                      </Label>
                      <Input
                        type="time"
                        disabled={!canEditClubContext}
                        value={q.data.club.scoutReportsNotifyTime ?? DEFAULT_NOTIFY_TIME}
                        onChange={(e) =>
                          patchClub.mutate({ scoutReportsNotifyTime: e.target.value || null })
                        }
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Wellness</Label>
                      <Input
                        type="time"
                        disabled={!canEditClubContext}
                        value={q.data.club.wellnessNotifyTime ?? DEFAULT_NOTIFY_TIME}
                        onChange={(e) =>
                          patchClub.mutate({ wellnessNotifyTime: e.target.value || null })
                        }
                        className="bg-background border-border"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground/60 leading-relaxed">
                    {locale === "zh"
                      ? `默认 ${DEFAULT_NOTIFY_TIME}。`
                      : locale === "es"
                        ? `Por defecto, ${DEFAULT_NOTIFY_TIME}.`
                        : `Defaults to ${DEFAULT_NOTIFY_TIME}.`}
                  </p>
                </section>

                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {locale === "zh" ? "日历同步" : locale === "es" ? "Sincronización de calendario" : "Calendar sync"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {locale === "zh"
                      ? "把修行日程订阅到 Google/Apple/Outlook 日历。任何人拿到链接都能订阅，不需登录，还能自动同步新增的训练。"
                      : locale === "es"
                        ? "Suscribe el calendario de entrenamientos en Google, Apple u Outlook. Cualquiera con el enlace puede suscribirse (sin iniciar sesión) y las sesiones nuevas apareceran solas."
                        : "Subscribe the training schedule in Google, Apple, or Outlook calendar. Anyone with the link can subscribe (no login needed) and new sessions show up automatically."}
                  </p>
                  <Button size="sm" variant="outline" className="gap-2" disabled={icalLoading} onClick={copyIcalLink}>
                    {copiedId === "ical" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === "ical"
                      ? t("invite_copied")
                      : locale === "zh"
                        ? "复制日历链接"
                        : locale === "es"
                          ? "Copiar enlace de calendario"
                          : "Copy calendar link"}
                  </Button>
                </section>

                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {locale === "zh" ? "模块" : locale === "es" ? "Módulos" : "Modules"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {locale === "zh"
                      ? "对教练和球员隐藏暂时不需要的模块，让应用更简洁（例如季前赛只开放日程与状态）。"
                      : locale === "es"
                        ? "Oculta a coaches y jugadoras los módulos que aún no toca usar — útil para lanzar la app por fases (p. ej. en pretemporada, solo Schedule y Wellness)."
                        : "Hide modules coaches and players don't need yet — useful for rolling the app out in phases (e.g. preseason: only Schedule and Wellness)."}
                  </p>
                  {!canEditClubContext && (
                    <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
                      {t("club_ctx_viewer_hint")}
                    </p>
                  )}
                  <div className="space-y-2">
                    {(
                      [
                        {
                          key: "schedule" as ClubModuleKey,
                          label: locale === "zh" ? "日程与状态" : locale === "es" ? "Schedule y Wellness" : "Schedule & Wellness",
                          sub: locale === "zh" ? "训练安排、每日打卡" : locale === "es" ? "Calendario de sesiones y check-in diario" : "Session calendar and daily check-in",
                        },
                        {
                          key: "scout" as ClubModuleKey,
                          label: t("ucore_nav_scout"),
                          sub: locale === "zh" ? "对手球探报告" : locale === "es" ? "Informes de scouting rival" : "Opponent scouting reports",
                        },
                        {
                          key: "stats" as ClubModuleKey,
                          label: t("ucore_nav_stats"),
                          sub: locale === "zh" ? "WCBA联赛数据" : locale === "es" ? "Estadísticas de la liga WCBA" : "WCBA league stats",
                        },
                        {
                          key: "playbook" as ClubModuleKey,
                          label: t("ucore_nav_playbook"),
                          sub: locale === "zh" ? "战术手册" : locale === "es" ? "Manual táctico" : "Tactical manual",
                        },
                      ]
                    ).map((mod) => {
                      const isDisabled = (q.data!.club.disabledModules ?? []).includes(mod.key);
                      return (
                        <div key={mod.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{mod.label}</p>
                            <p className="text-[11px] md:text-sm text-muted-foreground truncate">{mod.sub}</p>
                          </div>
                          <Switch
                            checked={!isDisabled}
                            disabled={!canEditClubContext}
                            onCheckedChange={(checked) => {
                              const current = q.data!.club.disabledModules ?? [];
                              const next = checked
                                ? current.filter((k) => k !== mod.key)
                                : Array.from(new Set([...current, mod.key]));
                              patchClub.mutate({ disabledModules: next as ClubModuleKey[] });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground/60 leading-relaxed">
                    {locale === "zh"
                      ? "作为主教练，你始终能看到所有模块。"
                      : locale === "es"
                        ? "Como head coach, tú siempre ves todos los módulos."
                        : "As head coach, you always see every module."}
                  </p>
                </section>
              </TabsContent>

              <TabsContent value="liga" className="space-y-4 mt-0">
                {(() => {
                  const now = new Date();
                  const upcoming = (Array.isArray(matchesQ.data) ? matchesQ.data : []).filter((m: any) => new Date(m.matchDate) >= now);
                  const past = (Array.isArray(matchesQ.data) ? matchesQ.data : []).filter((m: any) => new Date(m.matchDate) < now);
                  const fmtDate = (iso: string) => {
                    try {
                      return new Intl.DateTimeFormat(
                        locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en",
                        { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                      ).format(new Date(iso));
                    } catch { return iso; }
                  };
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] md:text-sm font-black uppercase tracking-wider text-muted-foreground/60">
                          {locale === "zh" ? "赛程" : locale === "es" ? "Calendario de liga" : "League schedule"}
                        </p>
                        {canEditClubContext && (
                          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold" onClick={() => setShowAddMatch(true)}>
                            + {locale === "zh" ? "添加比赛" : locale === "es" ? "Añadir partido" : "Add match"}
                          </Button>
                        )}
                      </div>
                      {showAddMatch && (
                        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                          <p className="text-sm font-black text-foreground">
                            {locale === "zh" ? "添加比赛" : locale === "es" ? "Añadir partido" : "Add match"}
                          </p>
                          <Input
                            placeholder={locale === "zh" ? "对手名称" : locale === "es" ? "Nombre del rival" : "Rival name"}
                            value={matchRival}
                            onChange={e => setMatchRival(e.target.value)}
                            className="h-10 rounded-lg text-sm"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={matchDate}
                              onChange={e => setMatchDate(e.target.value)}
                              className="flex-1 h-10 rounded-lg border border-border bg-background text-sm px-3 text-foreground"
                            />
                            <input
                              type="time"
                              value={matchTime}
                              onChange={e => setMatchTime(e.target.value)}
                              className="w-28 h-10 rounded-lg border border-border bg-background text-sm px-3 text-foreground"
                            />
                          </div>
                          <Input
                            placeholder={locale === "zh" ? "地点（可选）" : locale === "es" ? "Lugar (opcional)" : "Location (optional)"}
                            value={matchLocation}
                            onChange={e => setMatchLocation(e.target.value)}
                            className="h-10 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="flex-1 rounded-lg" onClick={() => setShowAddMatch(false)}>
                              {locale === "es" ? "Cancelar" : locale === "zh" ? "取消" : "Cancel"}
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 rounded-lg font-bold"
                              disabled={!matchRival.trim() || !matchDate || createMatchMut.isPending}
                              onClick={() => createMatchMut.mutate({ rivalName: matchRival.trim(), matchDate: `${matchDate}T${matchTime || "12:00"}`, location: matchLocation.trim() })}
                            >
                              {locale === "es" ? "Guardar" : locale === "zh" ? "保存" : "Save"}
                            </Button>
                          </div>
                        </div>
                      )}
                      {matchesQ.isLoading && (
                        <div className="flex justify-center py-4">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {upcoming.length === 0 && past.length === 0 && !matchesQ.isLoading && (
                        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center space-y-1">
                          <p className="text-sm font-semibold text-muted-foreground">
                            {locale === "zh" ? "暂无赛程" : locale === "es" ? "Sin partidos añadidos" : "No matches yet"}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            {locale === "zh" ? "点击上方按钮添加比赛" : locale === "es" ? "Pulsa «Añadir partido» para empezar" : "Tap «Add match» to get started"}
                          </p>
                        </div>
                      )}
                      {upcoming.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground">
                            {locale === "es" ? "Próximos" : locale === "zh" ? "即将到来" : "Upcoming"}
                          </p>
                          {upcoming.map((m: any, i: number) => (
                            <div key={m.id} className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${i === 0 ? "border-blue-500/30 bg-blue-500/5" : "border-border bg-card"}`}>
                              <div>
                                <p className="text-sm font-extrabold text-foreground">vs {m.rivalName}</p>
                                <p className="text-xs text-muted-foreground">{fmtDate(m.matchDate)}{m.location ? ` · ${m.location}` : ""}</p>
                              </div>
                              {canEditClubContext && (
                                <button type="button" onClick={() => deleteMatchMut.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {past.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] md:text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                            {locale === "es" ? "Jugados" : locale === "zh" ? "已完成" : "Past"}
                          </p>
                          {past.map((m: any) => (
                            <div key={m.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3 opacity-60">
                              <div>
                                <p className="text-sm font-semibold text-foreground">vs {m.rivalName}</p>
                                <p className="text-xs text-muted-foreground">{fmtDate(m.matchDate)}</p>
                              </div>
                              {canEditClubContext && (
                                <button type="button" onClick={() => deleteMatchMut.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="equipo" className="space-y-4 mt-0">
                {(() => {
                  const roster = q.data?.members?.filter((m) => m.role === "player" && m.status === "active") ?? [];
                  return roster.length > 0 ? (
                    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
                      <p className="text-[11px] md:text-sm font-black uppercase tracking-wider text-muted-foreground/60">
                        {locale === "zh" ? "球员名单" : locale === "es" ? "Jugadoras del club" : "Club players"}
                      </p>
                      {roster.map((m) => (
                        <MemberRow
                          key={m.id}
                          m={m}
                          variant="player"
                          t={t}
                          roleLabel={roleLabel}
                          canManage={canManageStaff}
                          meRole={meClubRole}
                          profileId={profile?.id}
                          clubOwnerId={q.data.club.ownerId}
                          banMut={banMut}
                          opsMut={opsMut}
                          publishMut={publishMut}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        {locale === "zh" ? "暂无球员加入" : locale === "es" ? "Sin jugadoras en el club todavía" : "No players have joined yet"}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {locale === "zh" ? "通过邀请链接邀请球员" : locale === "es" ? "Invítalas con el enlace de invitación" : "Invite them with an invitation link"}
                      </p>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  {(() => {
                    const staff = (q.data.members ?? []).filter((m) => m.role === "coach" || m.role === "head_coach");
                    if (staff.length === 0) {
                      return (
                        <div className="py-6 text-center space-y-3">
                          <p className="text-sm text-muted-foreground">{t("club_empty_staff")}</p>
                          {canInviteMembers ? (
                            <div className="flex justify-center">
                              <Button size="sm" variant="secondary" className="h-11 px-6 font-bold" onClick={() => openInvite("coach")}>
                                {t("club_invite_staff")}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                    return staff.map((m) => (
                      <MemberRow
                        key={m.id}
                        m={m}
                        variant="staff"
                        t={t}
                        roleLabel={roleLabel}
                        canManage={canManageStaff}
                        meRole={meClubRole}
                        profileId={profile?.id}
                        clubOwnerId={q.data.club.ownerId}
                        banMut={banMut}
                        opsMut={opsMut}
                        publishMut={publishMut}
                      />
                    ));
                  })()}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {t("club_tab_invitations")}
                    </p>
                    {canInviteMembers ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="font-bold" onClick={() => openInvite("coach")}>
                          {t("club_invite_staff")}
                        </Button>
                        <Button size="sm" variant="secondary" className="font-bold" onClick={() => openInvite("player")}>
                          {t("club_invite_player")}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {(q.data.pendingInvitations ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t("club_empty_invites")}</p>
                  ) : (
                    <ul className="space-y-3">
                      {(q.data.pendingInvitations ?? []).map((inv) => (
                        <li key={inv.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] md:text-xs font-bold uppercase">
                              {roleLabel(inv.role)}
                            </Badge>
                            {inv.invitedEmail && (
                              <span className="text-xs text-muted-foreground truncate max-w-full">{inv.invitedEmail}</span>
                            )}
                          </div>
                          {(() => {
                            const expiresMs = new Date(inv.expiresAt).getTime() - Date.now();
                            const daysLeft = Math.ceil(expiresMs / (1000 * 60 * 60 * 24));
                            const urgent = daysLeft <= 2;
                            return (
                              <p className={`text-[11px] md:text-sm ${urgent ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}`}>
                                {t("team_mgmt_inv_expires")}: {formatWhen(inv.expiresAt, locale)}
                                {urgent && daysLeft > 0 ? ` · ${daysLeft}d` : urgent ? " · Hoy" : ""}
                              </p>
                            );
                          })()}
                          <p className="text-xs font-mono break-all text-foreground bg-muted/50 rounded-lg p-2">{inv.link}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => copyLink(inv.link, inv.id)}
                            >
                              {copiedId === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedId === inv.id ? t("invite_copied") : t("invite_copy")}
                            </Button>
                            {canInviteMembers && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={revokeInv.isPending}
                                onClick={() => revokeInv.mutate(inv.id)}
                              >
                                {t("club_revoke")}
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="stats" className="space-y-6 mt-0">
                {statsQ.isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {statsQ.isError && <p className="text-sm text-destructive text-center">{t("club_stats_error")}</p>}
                {statsQ.data && (
                  <>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        {t("club_stats_section_players")}
                      </p>
                      <ul className="space-y-2">
                        {statsQ.data.players.length === 0 ? (
                          <li className="text-sm text-muted-foreground">{t("club_empty_roster")}</li>
                        ) : (
                          statsQ.data.players.map((p) => (
                            <li
                              key={p.memberId}
                              className="rounded-xl border border-border bg-card p-3 text-sm space-y-1"
                            >
                              <StatsUserName
                                {...mergeStatsRowWithClubMember(p, clubMemberByUserId)}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t("club_stats_reports")}: <span className="text-foreground font-medium">{p.reportsAssigned}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("club_stats_last_seen")}:{" "}
                                {p.lastSeen ? formatWhen(p.lastSeen, locale) : "—"}
                              </p>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        {t("club_stats_section_coaches")}
                      </p>
                      <ul className="space-y-2">
                        {statsQ.data.coaches.length === 0 ? (
                          <li className="text-sm text-muted-foreground">{t("club_empty_staff")}</li>
                        ) : (
                          statsQ.data.coaches.map((c) => (
                            <li
                              key={c.memberId}
                              className="rounded-xl border border-border bg-card p-3 text-sm space-y-1"
                            >
                              <StatsUserName
                                {...mergeStatsRowWithClubMember(c, clubMemberByUserId)}
                              />
                              <p className="text-xs text-muted-foreground">{roleLabel(c.role)}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("club_stats_players_scouted")}:{" "}
                                <span className="text-foreground font-medium">{c.playersScouted}</span>
                              </p>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </TabsContent>

              {caps.canAccessCalibrationPanel && (
                <TabsContent value="calibracion" className="space-y-4 mt-0">
                  <CalibrationPanel
                    locale={locale}
                    gender={q.data.club.gender === "F" ? "f" : q.data.club.gender === "M" ? "m" : "n"}
                  />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {inviteRole === "coach" ? t("club_invite_staff") : t("club_invite_player")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("club_invite_email")}</p>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("email")}
                className="bg-background"
              />
            </div>
            {inviteMut.isError && <p className="text-sm text-destructive">{t("invite_create_error")}</p>}
            {dialogLink && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-bold text-foreground">{t("invite_link_label")}</p>
                <p className="text-xs font-mono break-all text-muted-foreground">{dialogLink}</p>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => copyLink(dialogLink, "dlg")}>
                  {copiedId === "dlg" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedId === "dlg" ? t("invite_copied") : t("invite_copy")}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {t("close")}
            </Button>
            <Button onClick={onGenerateInvite} disabled={inviteMut.isPending}>
              {inviteMut.isPending ? t("saving") : t("club_generate_link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ModuleNav />
    </div>
  );
}

// ── Nivel B / "el decantador" (spec 38/39) ────────────────────────────────
// Panel de calibración: qué sustituciones repiten varios entrenadores
// distintos para el mismo arquetipo, con opción de promocionarlas a
// permanentes (afecta al motor para todo el club) o revertirlas -- nunca
// expone qué entrenador concreto originó cada override individual (spec
// 17.2), solo el agregado.
function CalibrationPanel({ locale, gender }: { locale: "en" | "es" | "zh"; gender: "f" | "m" | "n" }) {
  const [threshold, setThreshold] = useState(3);
  const q = useCalibrationPatterns(threshold);
  const promoteMut = usePromotePattern(threshold);
  const revertMut = useRevertPattern(threshold);
  const [confirmRevert, setConfirmRevert] = useState<CalibrationPattern | null>(null);

  const L = locale === "zh"
    ? {
        title: "多位教练达成一致的替换",
        empty: "暂无达到阈值的模式 -- 随着更多教练做出编辑，这里会显示出来。",
        coaches: "位不同教练",
        players: "名球员",
        fineCalib: "微调",
        editorialDisagree: "编辑分歧",
        promote: "设为永久",
        promoted: "已永久",
        revert: "撤销",
        threshold: "阈值",
        confirmTitle: "撤销此模式？",
        confirmBody: "以后的报告将不再应用这个调整 -- 引擎会恢复到原来的计算方式。",
        confirmCancel: "取消",
        confirmOk: "撤销",
      }
    : locale === "es"
      ? {
          title: "Sustituciones en las que coinciden varios entrenadores",
          empty: "Todavía no hay ningún patrón que llegue al umbral -- aparecerá aquí según más entrenadores editen informes.",
          coaches: "entrenadores distintos",
          players: "jugadoras",
          fineCalib: "Calibración fina",
          editorialDisagree: "Desacuerdo editorial",
          promote: "Hacer permanente",
          promoted: "Permanente",
          revert: "Revertir",
          threshold: "Umbral",
          confirmTitle: "¿Revertir este patrón?",
          confirmBody: "Los informes futuros dejarán de aplicar este ajuste -- el motor vuelve a su cálculo original.",
          confirmCancel: "Cancelar",
          confirmOk: "Revertir",
        }
      : {
          title: "Substitutions multiple coaches agree on",
          empty: "No pattern meets the threshold yet -- this fills in as more coaches edit reports.",
          coaches: "different coaches",
          players: "players",
          fineCalib: "Fine calibration",
          editorialDisagree: "Editorial disagreement",
          promote: "Make permanent",
          promoted: "Permanent",
          revert: "Revert",
          threshold: "Threshold",
          confirmTitle: "Revert this pattern?",
          confirmBody: "Future reports will stop applying this adjustment -- the motor reverts to its original calculation.",
          confirmCancel: "Cancel",
          confirmOk: "Revert",
        };

  const fieldLabel = (fieldKey: string): string => {
    const type = fieldKey.split(".")[0] as "deny" | "force" | "allow";
    return INSTRUCTION_LABELS[type]?.[locale] ?? fieldKey;
  };

  const archetypeLabel = (key: string): string => {
    try {
      return archetypeBaseLabel(key as any, locale, gender);
    } catch {
      return key;
    }
  };

  const doPromote = (p: CalibrationPattern) => {
    promoteMut.mutate(
      { archetypeKey: p.archetypeKey, fieldKey: p.fieldKey, replacementKey: p.replacementKey },
      {
        onSuccess: () => toast({ description: locale === "es" ? "Patrón promocionado." : locale === "zh" ? "模式已设为永久。" : "Pattern promoted." }),
        onError: (err) =>
          toast({
            description: typeof (err as any)?.message === "string" ? (err as any).message : "Error",
            variant: "destructive" as any,
          }),
      },
    );
  };

  const doRevert = () => {
    if (!confirmRevert?.promotedPatternId) return;
    revertMut.mutate(confirmRevert.promotedPatternId, {
      onSuccess: () => {
        toast({ description: locale === "es" ? "Patrón revertido." : locale === "zh" ? "已撤销。" : "Pattern reverted." });
        setConfirmRevert(null);
      },
      onError: (err) => {
        toast({
          description: typeof (err as any)?.message === "string" ? (err as any).message : "Error",
          variant: "destructive" as any,
        });
        setConfirmRevert(null);
      },
    });
  };

  // AÑADIDO 2026-09-15 (spec sección 57): Pablo, mirando el panel en
  // producción -- "no sé para qué sirve". Primera versión (una frase suelta
  // en gris) resultó insuficiente -- pidió explícitamente "explicarlo mejor
  // a fondo en el menú, porque los usuarios no lo van a entender". Sustituida
  // por una caja destacada (mismo patrón visual que el link de invitación
  // más arriba en este archivo), con el mecanismo completo en lenguaje llano
  // + un ejemplo concreto, siempre visible (no solo en el estado vacío).
  const explain =
    locale === "zh"
      ? {
          heading: "这是什么？",
          p1: "引擎会自动生成每一份报告。有时候某位教练不认同某个结论，就会在那份报告里手动修改。",
          p2: "如果几位不同的教练，在相似类型的球员身上，都做了同样的修改——这就不是巧合，说明引擎在这里的默认判断经常出错。下面列出的就是这些重复出现的修改。",
          example: "例如：如果 3 位不同的教练都把某句描述改成了同一个说法，就会出现在这里。",
          promoteWhat: "「设为永久」",
          promoteDesc: "以后引擎会自动应用这个修改，教练不用再一个个手动改。",
          revertWhat: "「撤销」",
          revertDesc: "取消这个永久修改，引擎恢复原来的计算方式。",
          emptyNote: "只有你一个人使用时，这里会一直是空的——需要几位教练真正做出同样的修改才会出现。",
        }
      : locale === "es"
        ? {
            heading: "¿Qué es esto?",
            p1: "El motor genera cada informe en automático. A veces un entrenador no está de acuerdo con algo que dice, y lo cambia a mano en ese informe.",
            p2: "Si varios entrenadores distintos hacen el mismo cambio a mano, en jugadoras con un perfil parecido, no es casualidad — es señal de que el motor se equivoca ahí siempre. Esos cambios repetidos son los que ves listados abajo.",
            example: "Ejemplo: si 3 entrenadores distintos corrigen la misma frase en jugadoras parecidas, aparecerá aquí.",
            promoteWhat: "\"Hacer permanente\"",
            promoteDesc: "el motor aplica ese cambio solo, en todos los informes parecidos, a partir de ahora — nadie tiene que volver a corregirlo a mano.",
            revertWhat: "\"Revertir\"",
            revertDesc: "deshace eso, el motor vuelve a calcularlo como antes.",
            emptyNote: "Con un solo entrenador usando la app, este panel se ve vacío siempre — hace falta que varios coincidan en el mismo cambio.",
          }
        : {
            heading: "What is this?",
            p1: "The engine generates every report automatically. Sometimes a coach disagrees with something it says and changes it by hand on that report.",
            p2: "If several different coaches make the same change by hand, on players with a similar profile, that's not a coincidence — it's a sign the engine gets that wrong every time. Those repeated changes are what's listed below.",
            example: "Example: if 3 different coaches correct the same line on similar players, it will show up here.",
            promoteWhat: "\"Make permanent\"",
            promoteDesc: "the engine applies that change on its own, on every similar report, from now on — nobody has to fix it by hand again.",
            revertWhat: "\"Revert\"",
            revertDesc: "undoes that, the engine goes back to calculating it the original way.",
            emptyNote: "With just one coach using the app, this panel will always look empty — it needs several coaches to agree on the same change.",
          };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold text-foreground">{L.title}</p>
        <div className="flex items-center gap-2">
          <Label htmlFor="calibration-threshold" className="text-xs text-muted-foreground">{L.threshold}</Label>
          <Select value={String(threshold)} onValueChange={(v) => setThreshold(Number(v))}>
            <SelectTrigger id="calibration-threshold" className="h-9 w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-bold text-foreground">{explain.heading}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{explain.p1}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{explain.p2}</p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed italic">{explain.example}</p>
        <ul className="text-xs text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
          <li>
            <span className="font-semibold text-foreground">{explain.promoteWhat}</span> — {explain.promoteDesc}
          </li>
          <li>
            <span className="font-semibold text-foreground">{explain.revertWhat}</span> — {explain.revertDesc}
          </li>
        </ul>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-1 border-t border-border/50">
          {explain.emptyNote}
        </p>
      </div>

      {q.isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {q.data && q.data.patterns.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">{L.empty}</p>
      )}

      {q.data && q.data.patterns.length > 0 && (
        <div className="space-y-3">
          {q.data.patterns.map((p) => {
            const gapKnown = p.avgScoreGap != null;
            const isFine = gapKnown && Math.abs(p.avgScoreGap!) < 0.15;
            return (
              <div
                key={`${p.archetypeKey}::${p.fieldKey}::${p.replacementKey}`}
                className="rounded-xl border border-border bg-background p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-black uppercase">{fieldLabel(p.fieldKey)}</Badge>
                      <span className="text-xs font-bold text-foreground">{archetypeLabel(p.archetypeKey)}</span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-1">{p.replacementValueSample}</p>
                  </div>
                  {p.isPromoted ? (
                    <Badge variant="secondary" className="text-[10px] font-black uppercase shrink-0 gap-1">
                      <Sparkles className="w-3 h-3" />
                      {L.promoted}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      className="shrink-0 h-9"
                      disabled={promoteMut.isPending}
                      onClick={() => doPromote(p)}
                    >
                      {L.promote}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">{p.distinctCoaches}</span> {L.coaches}
                  <span className="opacity-50">·</span>
                  <span>{p.distinctPlayers} {L.players}</span>
                  {gapKnown && (
                    <>
                      <span className="opacity-50">·</span>
                      <Badge variant={isFine ? "outline" : "secondary"} className="text-[10px]">
                        {isFine ? L.fineCalib : L.editorialDisagree}
                      </Badge>
                    </>
                  )}
                  {p.isPromoted && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 ml-auto"
                      onClick={() => setConfirmRevert(p)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      {L.revert}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmRevert} onOpenChange={(o) => { if (!o) setConfirmRevert(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{L.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.confirmCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={doRevert} disabled={revertMut.isPending}>
              {L.confirmOk}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function MemberRow({
  m,
  variant,
  t,
  roleLabel,
  canManage,
  meRole,
  profileId,
  clubOwnerId,
  banMut,
  opsMut,
  publishMut,
}: {
  m: ClubMemberDto;
  variant: "staff" | "player";
  t: Translate;
  roleLabel: (r: string) => string;
  canManage: boolean;
  meRole: ClubActorRole;
  profileId?: string;
  clubOwnerId: string;
  banMut: ReturnType<typeof useBanClubMember>;
  opsMut: ReturnType<typeof useSetClubMemberOperationsAccess>;
  publishMut: ReturnType<typeof useSetClubMemberReportPublishAccess>;
}) {
  const isOwner = m.userId === clubOwnerId && m.role === "head_coach";
  const isSelf = m.userId === profileId;
  const banned = m.status === "banned";
  const canRemove = canRemoveMember({ meRole, targetRole: m.role, isOwner, isSelf });
  const canBan = canBanMember({ meRole, targetRole: m.role, isOwner, isSelf });
  const canOps = canToggleOperationsAccess({ meRole, targetRole: m.role, isOwner, isSelf });
  const opsEnabled = Boolean(m.operationsAccess) && m.role === "coach";
  const canPublish = canToggleReportPublishAccess({ meRole, targetRole: m.role, isOwner, isSelf });
  const publishEnabled = Boolean(m.reportPublishAccess) && m.role === "coach";
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <MemberLabel
          userId={m.userId}
          authFullName={m.authFullName}
          authEmail={m.authEmail}
          displayName={m.displayName}
          invitedEmail={m.invitedEmail}
        />
        {variant === "player" && (
          <p className="text-xs text-muted-foreground">
            #{m.jerseyNumber || "—"} · {m.position || "—"}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {m.role === "head_coach" ? (
            <Badge variant="secondary" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] md:text-xs font-black uppercase tracking-wide">
              <ShieldCheck className="w-3 h-3" />
              {t("role_head_coach")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] md:text-xs font-black uppercase tracking-wide">
              <Users className="w-3 h-3" />
              {t("role_coach")}
            </Badge>
          )}
          {m.role === "coach" && opsEnabled ? (
            <Badge variant="outline" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] md:text-xs font-black uppercase tracking-wide">
              <Dumbbell className="w-3 h-3" />
              PREP
            </Badge>
          ) : null}
          {m.role === "coach" && publishEnabled ? (
            <Badge variant="outline" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] md:text-xs font-black uppercase tracking-wide">
              <Send className="w-3 h-3" />
              {t("club_publish_access_badge")}
            </Badge>
          ) : null}
          <Badge variant={banned ? "destructive" : "outline"} className="text-[10px] md:text-xs font-bold uppercase">
            {banned ? t("club_status_banned") : t("club_status_active")}
          </Badge>
        </div>
      </div>
      {canManage && !(isSelf && isOwner) && (
        variant === "staff" ? (
          // CORREGIDO 2026-09-14 (hallazgo D.2 de la auditoría, spec 28):
          // ops/publish vivían solo dentro de este menú de 3 puntos, sin
          // ninguna señal visible de que existieran antes de abrirlo -- el
          // badge PREP/PUBLICAR solo aparecía *después* de concederse, nunca
          // como pista de que la opción existe. Es justo la función que
          // Pablo pidió explícitamente en la sección 26 ("un botón para...
          // dar permisos a otros coaches"). Ahora son botones directos,
          // siempre visibles, mismo patrón ya usado en la variante "player"
          // de esta fila -- el menú de 3 puntos queda solo para
          // quitar/banear (acciones más destructivas, ocultarlas a propósito
          // sigue teniendo sentido).
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {canOps ? (
              <Button
                variant={opsEnabled ? "default" : "outline"}
                size="sm"
                disabled={opsMut.isPending}
                onClick={() => {
                  const next = !opsEnabled;
                  opsMut.mutate(
                    { id: m.id, operationsAccess: next },
                    {
                      onSuccess: () => {
                        toast({ description: next ? t("club_ops_access_grant") : t("club_ops_access_remove") });
                      },
                      onError: (err) => {
                        toast({
                          description:
                            typeof (err as any)?.message === "string"
                              ? (err as any).message
                              : t("schedule_edit_error"),
                          variant: "destructive" as any,
                        });
                      },
                    },
                  );
                }}
              >
                {opsEnabled ? t("club_ops_access_remove") : t("club_ops_access_grant")}
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                variant={publishEnabled ? "default" : "outline"}
                size="sm"
                disabled={publishMut.isPending}
                onClick={() => {
                  const next = !publishEnabled;
                  publishMut.mutate(
                    { id: m.id, reportPublishAccess: next },
                    {
                      onSuccess: () => {
                        toast({ description: next ? t("club_publish_access_grant") : t("club_publish_access_remove") });
                      },
                      onError: (err) => {
                        toast({
                          description:
                            typeof (err as any)?.message === "string"
                              ? (err as any).message
                              : t("schedule_edit_error"),
                          variant: "destructive" as any,
                        });
                      },
                    },
                  );
                }}
              >
                {publishEnabled ? t("club_publish_access_remove") : t("club_publish_access_grant")}
              </Button>
            ) : null}
            {/* CORREGIDO 2026-09-15 (mandato directo de Pablo): un único
                elemento, "Eliminar"/"Restaurar" según el estado actual, en
                vez de 2 acciones distintas (eliminar/banear) -- misma
                intención unificada que en la variante "player" de esta fila. */}
            {!isSelf && (canRemove || canBan) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="More actions">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  {banned ? (
                    <DropdownMenuItem
                      className="font-medium"
                      onSelect={() => banMut.mutate({ id: m.id, ban: false }, {
                        onSuccess: () => toast({ description: t("club_unban") }),
                      })}
                    >
                      {t("club_unban")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="font-medium"
                      onSelect={() => setRemoveConfirmOpen(true)}
                    >
                      <span className="text-destructive">{t("club_remove")}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 shrink-0">
            {canOps ? (
              <Button
                variant="outline"
                size="sm"
                disabled={opsMut.isPending}
                onClick={() => {
                  const next = !opsEnabled;
                  opsMut.mutate(
                    { id: m.id, operationsAccess: next },
                    {
                      onSuccess: () => {
                        toast({ description: next ? t("club_ops_access_grant") : t("club_ops_access_remove") });
                      },
                      onError: (err) => {
                        toast({
                          description:
                            typeof (err as any)?.message === "string"
                              ? (err as any).message
                              : t("schedule_edit_error"),
                          variant: "destructive" as any,
                        });
                      },
                    },
                  );
                }}
              >
                {opsEnabled ? t("club_ops_access_remove") : t("club_ops_access_grant")}
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                variant="outline"
                size="sm"
                disabled={publishMut.isPending}
                onClick={() => {
                  const next = !publishEnabled;
                  publishMut.mutate(
                    { id: m.id, reportPublishAccess: next },
                    {
                      onSuccess: () => {
                        toast({ description: next ? t("club_publish_access_grant") : t("club_publish_access_remove") });
                      },
                      onError: (err) => {
                        toast({
                          description:
                            typeof (err as any)?.message === "string"
                              ? (err as any).message
                              : t("schedule_edit_error"),
                          variant: "destructive" as any,
                        });
                      },
                    },
                  );
                }}
              >
                {publishEnabled ? t("club_publish_access_remove") : t("club_publish_access_grant")}
              </Button>
            ) : null}
            {/* CORREGIDO 2026-09-15 (mandato directo de Pablo, hallazgo real
                durante tryouts): "Eliminar" y "Banear" eran 2 botones/acciones
                distintas -- confuso para lo que en la práctica es una sola
                intención ("que deje de ver nada del equipo, y que sus datos
                locales se borren"). Unificadas en un único botón, reversible
                (reutiliza el mecanismo de baneo por debajo, no el borrado
                duro -- valioso durante tryouts reales, donde eliminar a la
                jugadora equivocada por error debe poder deshacerse). */}
            {banned ? (
              canBan && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={banMut.isPending}
                  onClick={() => banMut.mutate({ id: m.id, ban: false }, {
                    onSuccess: () => toast({ description: t("club_unban") }),
                  })}
                >
                  {t("club_unban")}
                </Button>
              )
            ) : (
              (canRemove || canBan) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  disabled={banMut.isPending}
                  onClick={() => setRemoveConfirmOpen(true)}
                >
                  {t("club_remove")}
                </Button>
              )
            )}
          </div>
        )
      )}

      {/* CORREGIDO 2026-09-15 (mandato directo de Pablo): un único diálogo de
          confirmación -- antes había 2 (eliminar con borrado duro, banear
          con estado reversible) para la misma intención real. Usa banMut
          (reversible vía "Restaurar") en vez de delMember: valioso de verdad
          durante tryouts, donde eliminar a la jugadora equivocada por error
          debe poder deshacerse sin perder el historial. El texto explica las
          2 consecuencias reales (pierde acceso ya, se borran sus datos
          locales del club) para que quien confirma sepa exactamente qué va
          a pasar, no solo un nombre. */}
      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("club_remove")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(m.displayName || m.invitedEmail || "—") + " — " + t("club_remove_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("close")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                banMut.mutate(
                  { id: m.id, ban: true },
                  {
                    onSuccess: () => toast({ description: t("club_remove") }),
                    onError: (err) =>
                      toast({
                        description: typeof (err as any)?.message === "string" ? (err as any).message : t("club_load_error"),
                        variant: "destructive" as any,
                      }),
                  },
                );
              }}
            >
              {t("club_remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
