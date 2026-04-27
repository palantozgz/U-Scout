import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Check, Users, MoreVertical, ShieldCheck, AlertTriangle, UserPlus, ClipboardList, Dumbbell, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Translate = ReturnType<typeof useLocale>["t"];
import { useAuth } from "@/lib/useAuth";
import { useCapabilities, type ClubMembership } from "@/lib/capabilities";
import { canBanMember, canRemoveMember, canToggleOperationsAccess, type ClubActorRole } from "@/lib/clubMemberPermissions";
import {
  useClub,
  usePatchClub,
  useClubInvite,
  useDeleteClubMember,
  useBanClubMember,
  useSetClubMemberOperationsAccess,
  useRevokeClubInvitation,
  useClubStats,
  clubStatsQueryKey,
  type ClubMemberDto,
  type PatchClubBody,
} from "@/lib/club-api";
import { toast } from "@/hooks/use-toast";
import { isShortUserIdFallback, userDisplayLabel } from "@/lib/userDisplayLabel";
import { cn } from "@/lib/utils";
import { rosterSignature, setStoredRosterSignature } from "@/lib/clubRosterSeen";
import { ModuleNav } from "@/pages/core/ModuleNav";
import type {
  ClubAgeCategory,
  ClubGender,
  ClubLeagueType,
  ClubLevel,
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
  const [matchLocation, setMatchLocation] = useState("");

  const q = useClub();

  // ── League matches (Liga tab) ───────────────────────────────────────────────
  const matchesQ = useQuery<Array<{id:string;rivalName:string;matchDate:string;location:string|null;matchType:string}>>({    queryKey: ["/api/club/matches"],
    queryFn: async () => {
      const r = await fetch("/api/club/matches", { credentials: "include" });
      return r.json();
    },
    enabled: activeTab === "liga",
  });
  const createMatchMut = useMutation({
    mutationFn: async (data: {rivalName:string;matchDate:string;location:string}) => {
      const r = await fetch("/api/club/matches", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/club/matches"] });
      setShowAddMatch(false); setMatchRival(""); setMatchDate(""); setMatchLocation("");
    },
  });
  const deleteMatchMut = useMutation({
    mutationFn: async (id:string) => {
      await fetch(`/api/club/matches/${id}`, { method:"DELETE", credentials:"include" });
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
  const delMember = useDeleteClubMember();
  const banMut = useBanClubMember();
  const opsMut = useSetClubMemberOperationsAccess();
  const revokeInv = useRevokeClubInvitation();
  const statsQ = useClubStats({ enabled: activeTab === "stats" });
  const queryClient = useQueryClient();

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

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
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

      <main className="flex-1 p-4 pb-10">
        {!hintDismissed ? (
          <div className="mb-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold text-muted-foreground">
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
                          disabled={patchClub.isPending}
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
                                className="h-8 w-full px-1 text-[10px] font-bold leading-tight"
                                disabled={patchClub.isPending}
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
                            className="h-8 w-full px-1 text-[10px] font-bold leading-tight"
                            disabled={patchClub.isPending}
                            onClick={() => logoFileRef.current?.click()}
                          >
                            {t("club_logo_upload")}
                          </Button>
                        ))}
                    </div>
                    <div className="min-w-0 w-full space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("club_name_label")}</p>
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("club_ctx_section")}</p>
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
                        disabled={!canEditClubContext || patchClub.isPending}
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
                          patchClub.isPending ||
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
                          patchClub.isPending ||
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
                          patchClub.isPending ||
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
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="liga" className="space-y-4 mt-0">
                {(() => {
                  const now = new Date();
                  const upcoming = (matchesQ.data ?? []).filter((m: any) => new Date(m.matchDate) >= now);
                  const past = (matchesQ.data ?? []).filter((m: any) => new Date(m.matchDate) < now);
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
                        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground/60">
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
                          <input
                            type="datetime-local"
                            value={matchDate}
                            onChange={e => setMatchDate(e.target.value)}
                            className="w-full h-10 rounded-lg border border-border bg-background text-sm px-3 text-foreground"
                          />
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
                              onClick={() => createMatchMut.mutate({ rivalName: matchRival.trim(), matchDate, location: matchLocation.trim() })}
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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
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
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                        {locale === "zh" ? "球员名单" : locale === "es" ? "Jugadoras del club" : "Club players"}
                      </p>
                      {roster.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 py-1">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                            {(m.displayName || m.authFullName || "?").slice(0,2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {m.displayName || m.authFullName || m.authEmail || m.invitedEmail || "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {(m as any).jerseyNumber ? `#${(m as any).jerseyNumber} · ` : ""}{(m as any).position || (locale === "es" ? "Jugadora" : locale === "zh" ? "球员" : "Player")}
                            </p>
                          </div>
                        </div>
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
                  {canInviteMembers && (
                    <Button size="sm" variant="secondary" className="font-bold" onClick={() => openInvite("coach")}>
                      {t("club_invite_staff")}
                    </Button>
                  )}
                  {(() => {
                    const staff = q.data.members?.filter((m) => m.role === "coach" || m.role === "head_coach");
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
                        delMember={delMember}
                        banMut={banMut}
                        opsMut={opsMut}
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

                  {q.data.pendingInvitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t("club_empty_invites")}</p>
                  ) : (
                    <ul className="space-y-3">
                      {q.data.pendingInvitations.map((inv) => (
                        <li key={inv.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] font-bold uppercase">
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
                              <p className={`text-[11px] ${urgent ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}`}>
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

function MemberRow({
  m,
  variant,
  t,
  roleLabel,
  canManage,
  meRole,
  profileId,
  clubOwnerId,
  delMember,
  banMut,
  opsMut,
}: {
  m: ClubMemberDto;
  variant: "staff" | "player";
  t: Translate;
  roleLabel: (r: string) => string;
  canManage: boolean;
  meRole: ClubActorRole;
  profileId?: string;
  clubOwnerId: string;
  delMember: ReturnType<typeof useDeleteClubMember>;
  banMut: ReturnType<typeof useBanClubMember>;
  opsMut: ReturnType<typeof useSetClubMemberOperationsAccess>;
}) {
  const isOwner = m.userId === clubOwnerId && m.role === "head_coach";
  const isSelf = m.userId === profileId;
  const banned = m.status === "banned";
  const canRemove = canRemoveMember({ meRole, targetRole: m.role, isOwner, isSelf });
  const canBan = canBanMember({ meRole, targetRole: m.role, isOwner, isSelf });
  const canOps = canToggleOperationsAccess({ meRole, targetRole: m.role, isOwner, isSelf });
  const opsEnabled = Boolean(m.operationsAccess) && m.role === "coach";
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);

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
            <Badge variant="secondary" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] font-black uppercase tracking-wide">
              <ShieldCheck className="w-3 h-3" />
              {t("role_head_coach")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] font-black uppercase tracking-wide">
              <Users className="w-3 h-3" />
              {t("role_coach")}
            </Badge>
          )}
          {m.role === "coach" && opsEnabled ? (
            <Badge variant="outline" className="h-5 px-2 gap-1 inline-flex items-center text-[10px] font-black uppercase tracking-wide">
              <Dumbbell className="w-3 h-3" />
              PREP
            </Badge>
          ) : null}
          <Badge variant={banned ? "destructive" : "outline"} className="text-[10px] font-bold uppercase">
            {banned ? t("club_status_banned") : t("club_status_active")}
          </Badge>
        </div>
      </div>
      {canManage && !(isSelf && isOwner) && (
        variant === "staff" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-11 w-11 p-0" aria-label="More actions">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              {canOps ? (
                <DropdownMenuItem
                  className="font-medium"
                  onSelect={() => {
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
                </DropdownMenuItem>
              ) : null}
              {!isSelf ? (
                <>
                  <DropdownMenuItem
                    className={cn("font-medium", !canRemove && "opacity-50 pointer-events-none")}
                    onSelect={() => {
                      if (!canRemove) return;
                      setRemoveConfirmOpen(true);
                    }}
                  >
                    <span className="text-destructive">{t("club_remove")}</span>
                  </DropdownMenuItem>
                  {canBan ? (
                    <DropdownMenuItem
                      className={cn("font-medium", (banned || !canBan) && "opacity-50 pointer-events-none")}
                      onSelect={() => {
                        if (banned) return;
                        setBanConfirmOpen(true);
                      }}
                    >
                      <span className={banned ? "opacity-60" : ""}>{t("club_ban")}</span>
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
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
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={delMember.isPending || !canRemove}
              onClick={() => setRemoveConfirmOpen(true)}
            >
              {t("club_remove")}
            </Button>
            {canBan && (
              <Button
                variant="outline"
                size="sm"
                disabled={banMut.isPending || banned}
                onClick={() => setBanConfirmOpen(true)}
              >
                {t("club_ban")}
              </Button>
            )}
          </div>
        )
      )}

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("club_remove")}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.displayName || m.invitedEmail || "—"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("close")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                delMember.mutate(m.id, {
                  onSuccess: () => toast({ description: t("club_remove") }),
                  onError: (err) =>
                    toast({
                      description: typeof (err as any)?.message === "string" ? (err as any).message : t("club_load_error"),
                      variant: "destructive" as any,
                    }),
                });
              }}
            >
              {t("club_remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={banConfirmOpen} onOpenChange={setBanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("club_ban")}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.displayName || m.invitedEmail || "—"}
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
                    onSuccess: () => toast({ description: t("club_ban") }),
                    onError: (err) =>
                      toast({
                        description: typeof (err as any)?.message === "string" ? (err as any).message : t("club_load_error"),
                        variant: "destructive" as any,
                      }),
                  },
                );
              }}
            >
              {t("club_ban")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
