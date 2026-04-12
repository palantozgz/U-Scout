import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n";

type Translate = ReturnType<typeof useLocale>["t"];
import { useAuth } from "@/lib/useAuth";
import {
  useClub,
  usePatchClub,
  useClubInvite,
  useDeleteClubMember,
  useBanClubMember,
  useRevokeClubInvitation,
  useClubStats,
  clubStatsQueryKey,
  type ClubMemberDto,
  type PatchClubBody,
} from "@/lib/club-api";
import { toast } from "@/hooks/use-toast";
import { isShortUserIdFallback, userDisplayLabel } from "@/lib/userDisplayLabel";
import { cn } from "@/lib/utils";
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
  const [activeTab, setActiveTab] = useState("staff");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"coach" | "player">("coach");
  const [inviteEmail, setInviteEmail] = useState("");
  const [dialogLink, setDialogLink] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const canAccess = profile?.role === "master" || profile?.role === "head_coach" || profile?.role === "coach";

  useEffect(() => {
    if (profile && !canAccess) {
      setLocation("/coach");
    }
  }, [profile, canAccess, setLocation]);

  const q = useClub();
  const patchClub = usePatchClub();
  const inviteMut = useClubInvite();
  const delMember = useDeleteClubMember();
  const banMut = useBanClubMember();
  const revokeInv = useRevokeClubInvitation();
  const statsQ = useClubStats({ enabled: activeTab === "stats" });
  const queryClient = useQueryClient();

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

  const canEditBranding =
    profile &&
    q.data &&
    (profile.role === "master" || q.data.club.ownerId === profile.id);

  const canManage = useMemo(() => {
    if (!profile || !q.data) return false;
    if (profile.role === "master") return true;
    if (q.data.club.ownerId === profile.id) return true;
    const me = q.data.members.find((m) => m.userId === profile.id);
    return me?.status === "active" && (me.role === "head_coach" || me.role === "coach");
  }, [profile, q.data]);

  const clubMemberByUserId = useMemo(() => {
    const map = new Map<string, ClubMemberDto>();
    for (const m of q.data?.members ?? []) {
      map.set(m.userId, m);
    }
    return map;
  }, [q.data?.members]);

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
    const i = isClubLogoImageUrl(cur) ? -1 : LOGO_EMOJIS.indexOf(cur);
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

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
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
        {q.isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isNoClubError && (
          <p className="text-sm text-muted-foreground text-center py-12 px-2">{t("club_no_club")}</p>
        )}

        {q.isError && !isNoClubError && (
          <p className="text-sm text-destructive text-center py-8">{t("club_load_error")}</p>
        )}

        {q.data && (
          <>
            <section className="rounded-2xl border border-border bg-card p-4 mb-6 space-y-4">
              <div className="flex items-start gap-4">
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onLogoFile}
                />
                <div
                  className={cn(
                    "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 text-5xl leading-none",
                    canEditBranding && "ring-offset-background cursor-default ring-2 ring-transparent hover:ring-primary/30",
                  )}
                  title={canEditBranding ? t("club_logo_upload") : undefined}
                >
                  <ClubLogoView logo={q.data.club.logo} className="max-h-[5.5rem] max-w-[5.5rem]" />
                </div>
                {canEditBranding && (
                  <div className="flex flex-col gap-2 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="font-bold"
                      disabled={patchClub.isPending}
                      onClick={() => logoFileRef.current?.click()}
                    >
                      {t("club_logo_upload")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-bold"
                      disabled={patchClub.isPending}
                      onClick={cycleLogo}
                    >
                      {t("club_logo_hint")}
                    </Button>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
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

            <section className="rounded-2xl border border-border bg-card p-4 mb-6 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("club_ctx_section")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("club_ctx_hint")}</p>
              {!canEditBranding && (
                <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
                  {t("club_ctx_viewer_hint")}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">{t("club_ctx_league")}</Label>
                  <Select
                    disabled={!canEditBranding || patchClub.isPending}
                    value={q.data.club.leagueType ?? CTX_UNSET}
                    onValueChange={(v) => {
                      const newLeague = v === CTX_UNSET ? null : (v as ClubLeagueType);
                      const updates: PatchClubBody = { leagueType: newLeague };
                      if (newLeague) {
                        const infer = LEAGUE_AUTO_INFER[newLeague];
                        updates.gender = infer.gender;
                        updates.level = infer.level;
                        updates.ageCategory = infer.ageCategory;
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
                    disabled={!canEditBranding || patchClub.isPending || Boolean(q.data.club.leagueType)}
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
                    disabled={!canEditBranding || patchClub.isPending || Boolean(q.data.club.leagueType)}
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
                    disabled={!canEditBranding || patchClub.isPending || Boolean(q.data.club.leagueType)}
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1 mb-4">
                <TabsTrigger value="staff" className="text-xs font-bold">
                  {t("club_tab_staff")}
                </TabsTrigger>
                <TabsTrigger value="roster" className="text-xs font-bold">
                  {t("club_tab_roster")}
                </TabsTrigger>
                <TabsTrigger value="invites" className="text-xs font-bold">
                  {t("club_tab_invitations")}
                </TabsTrigger>
                <TabsTrigger value="stats" className="text-xs font-bold">
                  {t("club_tab_stats")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="staff" className="space-y-3 mt-0">
                {canManage && (
                  <Button size="sm" variant="secondary" className="font-bold" onClick={() => openInvite("coach")}>
                    {t("club_invite_staff")}
                  </Button>
                )}
                {(() => {
                  const staff = q.data.members.filter((m) => m.role === "coach" || m.role === "head_coach");
                  if (staff.length === 0) {
                    return <p className="text-sm text-muted-foreground py-6 text-center">{t("club_empty_staff")}</p>;
                  }
                  return staff.map((m) => (
                    <MemberRow
                      key={m.id}
                      m={m}
                      variant="staff"
                      t={t}
                      roleLabel={roleLabel}
                      canManage={canManage}
                      profileId={profile?.id}
                      clubOwnerId={q.data.club.ownerId}
                      delMember={delMember}
                      banMut={banMut}
                    />
                  ));
                })()}
              </TabsContent>

              <TabsContent value="roster" className="space-y-3 mt-0">
                {canManage && (
                  <Button size="sm" variant="secondary" className="font-bold" onClick={() => openInvite("player")}>
                    {t("club_invite_player")}
                  </Button>
                )}
                {(() => {
                  const roster = q.data.members.filter((m) => m.role === "player");
                  if (roster.length === 0) {
                    return <p className="text-sm text-muted-foreground py-6 text-center">{t("club_empty_roster")}</p>;
                  }
                  return roster.map((m) => (
                    <MemberRow
                      key={m.id}
                      m={m}
                      variant="player"
                      t={t}
                      roleLabel={roleLabel}
                      canManage={canManage}
                      profileId={profile?.id}
                      clubOwnerId={q.data.club.ownerId}
                      delMember={delMember}
                      banMut={banMut}
                    />
                  ));
                })()}
              </TabsContent>

              <TabsContent value="invites" className="space-y-4 mt-0">
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
                        <p className="text-[11px] text-muted-foreground">
                          {t("team_mgmt_inv_expires")}: {formatWhen(inv.expiresAt, locale)}
                        </p>
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
                          {canManage && (
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
    </div>
  );
}

function MemberRow({
  m,
  variant,
  t,
  roleLabel,
  canManage,
  profileId,
  clubOwnerId,
  delMember,
  banMut,
}: {
  m: ClubMemberDto;
  variant: "staff" | "player";
  t: Translate;
  roleLabel: (r: string) => string;
  canManage: boolean;
  profileId?: string;
  clubOwnerId: string;
  delMember: ReturnType<typeof useDeleteClubMember>;
  banMut: ReturnType<typeof useBanClubMember>;
}) {
  const isOwner = m.userId === clubOwnerId && m.role === "head_coach";
  const isSelf = m.userId === profileId;
  const banned = m.status === "banned";

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
          <Badge variant="secondary" className="text-[10px] font-bold uppercase">
            {roleLabel(m.role)}
          </Badge>
          <Badge variant={banned ? "destructive" : "outline"} className="text-[10px] font-bold uppercase">
            {banned ? t("club_status_banned") : t("club_status_active")}
          </Badge>
        </div>
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            disabled={delMember.isPending || isOwner}
            onClick={() => delMember.mutate(m.id)}
          >
            {t("club_remove")}
          </Button>
          {!isOwner && !isSelf && (
            <Button
              variant="outline"
              size="sm"
              disabled={banMut.isPending}
              onClick={() => banMut.mutate({ id: m.id, ban: !banned })}
            >
              {banned ? t("club_unban") : t("club_ban")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
