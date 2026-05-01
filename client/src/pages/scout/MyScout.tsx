import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Star, ChevronRight, Pencil } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { usePlayers, useTeams, useCreatePlayer, createDefaultPlayer, type PlayerProfile } from "@/lib/mock-data";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function hasReportInputs(player: PlayerProfile): boolean {
  const inp = (player as any).inputs ?? (player as any).scoutingInputs;
  if (!inp || typeof inp !== "object") return false;
  const i = inp as Record<string, unknown>;
  return (
    (i.isoFrequency === "Primary" || i.isoFrequency === "Secondary") ||
    (i.pnrFrequency === "Primary" || i.pnrFrequency === "Secondary") ||
    (i.postFrequency === "Primary" || i.postFrequency === "Secondary") ||
    (i.transitionFrequency === "Primary" || i.transitionFrequency === "Secondary")
  );
}

export default function MyScout() {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  const { profile } = useAuth();

  const { data: allPlayers = [], isLoading } = usePlayers();
  const { data: teams = [] } = useTeams();
  const createPlayerMutation = useCreatePlayer();

  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newTeamId, setNewTeamId] = useState("");

  const canonicalPlayers: PlayerProfile[] = allPlayers.filter((p) => {
    const isCanonical = (p as any).isCanonical ?? (p as any).is_canonical ?? false;
    // Published players are in Game Plan — no longer pending work in MyScout
    const isPublished = (p as any).published === true;
    return isCanonical && !isPublished;
  });

  const sandboxPlayers: PlayerProfile[] = allPlayers.filter((p) => {
    const isCanonical = (p as any).isCanonical ?? (p as any).is_canonical ?? false;
    if (isCanonical) return false;
    return (p as any).createdByUserId === profile?.id ||
           (p as any).createdByCoachId === profile?.id;
  });

  const [sandboxOpen, setSandboxOpen] = useState(canonicalPlayers.length === 0);

  const teamsWithCanonical = useMemo(
    () => teams.filter((team) => canonicalPlayers.some((p) => p.teamId === team.id)),
    [teams, canonicalPlayers],
  );

  const [expandedByTeamId, setExpandedByTeamId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (teamsWithCanonical.length === 0) return;
    setExpandedByTeamId((prev) => {
      const hasInit = teamsWithCanonical.some((t) => Object.prototype.hasOwnProperty.call(prev, t.id));
      if (hasInit) return prev;
      const next: Record<string, boolean> = {};
      teamsWithCanonical.forEach((t, idx) => {
        next[t.id] = idx === 0;
      });
      return next;
    });
  }, [teamsWithCanonical]);

  const teamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? "";
  const teamLogo = (teamId: string) => teams.find((t) => t.id === teamId)?.logo ?? "";

  const L = {
    en: {
      title: "My Scout",
      sub: "Your individual scouting reports",
      add: "+ Practice profile",
      noPlayers: "No profiles yet. Create one to start scouting.",
      name: "Name",
      number: "#",
      save: "Save",
      cancel: "Cancel",
      sandboxNote: "Sandbox — not eligible for Film Room",
      officialBadge: "Official",
      editReport: "Edit report",
      viewReport: "View report",
      fillProfile: "Fill profile",
      playersCount: "{n} players",
    },
    es: {
      title: "Mi Scout",
      sub: "Tus informes de scouting individuales",
      add: "+ Ficha de práctica",
      noPlayers: "Sin fichas. Crea una para empezar.",
      name: "Nombre",
      number: "#",
      save: "Guardar",
      cancel: "Cancelar",
      sandboxNote: "Campo de pruebas — no apta para la Sala de análisis",
      officialBadge: "Oficial",
      editReport: "Editar informe",
      viewReport: "Ver informe",
      fillProfile: "Completar ficha",
      playersCount: "{n} fichas",
    },
    zh: {
      title: "我的报告",
      sub: "你的个人球探报告",
      add: "+ 练习档案",
      noPlayers: "暂无档案，创建一个开始侦察。",
      name: "姓名",
      number: "#",
      save: "保存",
      cancel: "取消",
      sandboxNote: "测试档案 — 无法进入集体分析",
      officialBadge: "官方",
      editReport: "编辑报告",
      viewReport: "查看报告",
      fillProfile: "完善档案",
      playersCount: "{n} 名球员",
    },
  }[locale as "en" | "es" | "zh"] ?? {
    title: "My Scout", sub: "Your individual scouting reports", add: "+ Practice profile",
    noPlayers: "No profiles yet.", name: "Name", number: "#",
    save: "Save", cancel: "Cancel",
    sandboxNote: "Sandbox — not eligible for Film Room",
    officialBadge: "Official", editReport: "Edit report",
    viewReport: "View report", fillProfile: "Fill profile",
    playersCount: "{n} players",
  };

  const handleCreate = () => {
    const tid = newTeamId || teams[0]?.id;
    if (!tid) return;
    const def = createDefaultPlayer(tid);
    createPlayerMutation.mutate(
      { ...def, name: newName.trim() || "New Player", number: newNumber.trim() } as any,
      {
        onSuccess: (created: PlayerProfile) => {
          setShowNewPlayer(false);
          setNewName("");
          setNewNumber("");
          setLocation(`/coach/player/${created.id}`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/coach")}
            className="-ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-foreground tracking-tight">{L.title}</h1>
            <p className="text-[10px] text-muted-foreground font-medium">{L.sub}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs font-bold h-9 rounded-lg"
          onClick={() => { setShowNewPlayer(true); setNewTeamId(teams[0]?.id ?? ""); }}
        >
          {L.add}
        </Button>
      </header>

      <main className="flex-1 px-4 py-4 landscape:py-2 space-y-3 max-w-md mx-auto w-full">

        {/* Context banner */}
        {!showNewPlayer && sandboxPlayers.length === 0 && canonicalPlayers.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {locale === "es"
                ? "Tus fichas de práctica"
                : locale === "zh"
                ? "你的练习档案"
                : "Your practice profiles"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {locale === "es"
                ? "Crea fichas aquí para practicar con el motor. No son oficiales y no se envían al staff."
                : locale === "zh"
                ? "在此创建档案以使用引擎练习。这些不是官方档案，不会发送给团队。"
                : "Create profiles here to practice with the engine. These are not official and won't be sent to the team."}
            </p>
            <p className="text-xs font-semibold text-muted-foreground/60 mt-1">
              {locale === "es"
                ? "Las fichas oficiales se crean en Plantilla"
                : locale === "zh"
                ? "官方档案在球员档案中创建"
                : "Official profiles are created in Personnel"}
            </p>
          </div>
        )}

        {/* New player form */}
        {showNewPlayer && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-black text-foreground">{L.add}</p>
            <div className="flex gap-2">
              <Input
                placeholder={L.name}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 h-10 rounded-lg text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Input
                placeholder={L.number}
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                className="w-16 h-10 rounded-lg text-sm text-center"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            {teams.length > 1 && (
              <select
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background text-sm px-3"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.logo} {t.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 rounded-lg" onClick={() => setShowNewPlayer(false)}>
                {L.cancel}
              </Button>
              <Button size="sm" className="flex-1 rounded-lg font-bold" onClick={handleCreate} disabled={createPlayerMutation.isPending}>
                {L.save}
              </Button>
            </div>
          </div>
        )}

        {/* SECTION 1 — Canonical players grouped by team */}
        {canonicalPlayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">
              {locale === "es" ? "Sin fichas oficiales — créalas en Plantilla"
               : locale === "zh" ? "暂无官方档案 — 请在球员档案中创建"
               : "No official profiles yet — create them in Personnel"}
            </p>
          </div>
        ) : (
          teamsWithCanonical.map((team) => {
            const teamCanon = canonicalPlayers.filter((p) => p.teamId === team.id);
            const expanded = expandedByTeamId[team.id] === true;

            return (
              <div key={team.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedByTeamId((prev) => ({ ...prev, [team.id]: !prev[team.id] }))
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="text-xl shrink-0" aria-hidden>
                    {team.logo}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{team.name}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {L.playersCount.replace("{n}", String(teamCanon.length))}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      "w-5 h-5 text-muted-foreground shrink-0 transition-transform",
                      expanded && "rotate-90",
                    )}
                  />
                </button>

                {expanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                    {teamCanon.map((player) => {
                      const isCanonical =
                        (player as any).isCanonical ?? (player as any).is_canonical ?? false;
                      const hasReport = hasReportInputs(player);

                      return (
                        <div
                          key={player.id}
                          className="rounded-xl border border-border bg-background overflow-hidden"
                        >
                          <div className="flex items-center gap-3 px-3 py-3">
                            <div className="relative shrink-0">
                              {isRealPhoto(player.imageUrl) ? (
                                <img
                                  src={player.imageUrl}
                                  alt={player.name}
                                  className="w-11 h-11 rounded-full object-cover ring-2 ring-border"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-border">
                                  <BasketballPlaceholderAvatar size={44} />
                                </div>
                              )}
                              {isCanonical && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                  <Star className="w-2.5 h-2.5 text-primary-foreground" />
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-extrabold text-foreground truncate">
                                  {player.name || "—"}
                                </p>
                                {isCanonical && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {L.officialBadge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                #{player.number || "—"} · {teamLogo(player.teamId)} {teamName(player.teamId)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (!hasReportInputs(player)) setLocation(`/coach/quick-scout/${player.id}`);
                                else setLocation(`/coach/player/${player.id}`);
                              }}
                              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                              title={L.editReport}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="border-t border-border px-3 py-3 bg-muted/30">
                            {hasReport ? (
                              <Button
                                type="button"
                                className="w-full h-10 rounded-xl font-bold text-sm bg-primary text-primary-foreground shadow-sm flex items-center justify-between gap-2 pr-3"
                                onClick={() => setLocation(`/coach/scout/${player.id}/review`)}
                              >
                                <span>{L.viewReport}</span>
                                <ChevronRight className="w-5 h-5 shrink-0 opacity-90" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full h-9 rounded-xl text-xs font-bold border-border"
                                onClick={() => setLocation(`/coach/player/${player.id}`)}
                              >
                                {L.fillProfile}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}

        <button
          type="button"
          onClick={() => setSandboxOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-left mt-2"
        >
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {"⚗️ "}
            {locale === "es" ? "Fichas de práctica" : locale === "zh" ? "练习档案" : "Practice profiles"}
            {sandboxPlayers.length > 0 && ` · ${sandboxPlayers.length}`}
          </span>
          <ChevronRight className={cn(
            "w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform",
            sandboxOpen && "rotate-90",
          )} />
        </button>

        {sandboxOpen && (
          sandboxPlayers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {locale === "es" ? "Sin fichas de práctica" : locale === "zh" ? "暂无练习档案" : "No practice profiles yet"}
            </p>
          ) : (
            sandboxPlayers.map((player) => {
              const isCanonical = (player as any).isCanonical ?? (player as any).is_canonical ?? false;
              const hasReport = hasReportInputs(player);

              return (
                <div key={player.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="relative shrink-0">
                      {isRealPhoto(player.imageUrl)
                        ? <img src={player.imageUrl} alt={player.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-border" />
                        : <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-border"><BasketballPlaceholderAvatar size={44} /></div>
                      }
                      {isCanonical && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                          <Star className="w-2.5 h-2.5 text-primary-foreground" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-extrabold text-foreground truncate">{player.name || "—"}</p>
                        {isCanonical && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {L.officialBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        #{player.number || "—"} · {teamLogo(player.teamId)} {teamName(player.teamId)}
                      </p>
                      {!isCanonical && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                          {L.sandboxNote}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!hasReportInputs(player)) setLocation(`/coach/quick-scout/${player.id}`);
                        else setLocation(`/coach/player/${player.id}`);
                      }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title={L.editReport}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border-t border-border px-4 py-3 bg-background/40">
                    {hasReport ? (
                      <Button
                        type="button"
                        className="w-full h-10 rounded-xl font-bold text-sm bg-primary text-primary-foreground shadow-sm flex items-center justify-between gap-2 pr-3"
                        onClick={() => setLocation(`/coach/scout/${player.id}/review`)}
                      >
                        <span>{L.viewReport}</span>
                        <ChevronRight className="w-5 h-5 shrink-0 opacity-90" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-9 rounded-xl text-xs font-bold border-border"
                        onClick={() => setLocation(`/coach/player/${player.id}`)}
                      >
                        {L.fillProfile}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </main>
      <ModuleNav />
    </div>
  );
}
