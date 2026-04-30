import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Star, ChevronRight, Pencil, Send } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { usePlayers, useTeams, useCreatePlayer, createDefaultPlayer, type PlayerProfile } from "@/lib/mock-data";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

type SubmitState = "idle" | "submitting" | "done" | "error";

export default function MyScout() {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: allPlayers = [], isLoading } = usePlayers();
  const { data: teams = [] } = useTeams();
  const createPlayerMutation = useCreatePlayer();

  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newTeamId, setNewTeamId] = useState("");
  const [submitStates, setSubmitStates] = useState<Record<string, SubmitState>>({});

  const myPlayers: PlayerProfile[] = allPlayers.filter((p) => {
    if (p.createdByCoachId !== profile?.id) return false;
    // MyScout es solo para fichas sandbox — las canónicas van a Personnel/Film Room
    const isCanonical = (p as any).isCanonical ?? (p as any).is_canonical ?? false;
    return !isCanonical;
  });

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
      sendToFilm: "→ Film Room",
      sending: "Sending...",
      sent: "Sent ✓",
      sandboxNote: "Sandbox — not eligible for Film Room",
      officialBadge: "Official",
      editReport: "Edit report",
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
      sendToFilm: "→ Sala de análisis",
      sending: "Enviando...",
      sent: "Enviado ✓",
      sandboxNote: "Campo de pruebas — no apta para la Sala de análisis",
      officialBadge: "Oficial",
      editReport: "Editar informe",
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
      sendToFilm: "→ 集体分析",
      sending: "发送中...",
      sent: "已发送 ✓",
      sandboxNote: "测试档案 — 无法进入集体分析",
      officialBadge: "官方",
      editReport: "编辑报告",
    },
  }[locale as "en" | "es" | "zh"] ?? {
    title: "My Scout", sub: "Your individual scouting reports", add: "+ Practice profile",
    noPlayers: "No profiles yet.", name: "Name", number: "#",
    save: "Save", cancel: "Cancel", sendToFilm: "→ Film Room",
    sending: "Sending...", sent: "Sent ✓",
    sandboxNote: "Sandbox — not eligible for Film Room",
    officialBadge: "Official", editReport: "Edit report",
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

  const handleSendToFilmRoom = async (playerId: string) => {
    setSubmitStates((s) => ({ ...s, [playerId]: "submitting" }));
    try {
      await apiRequest("POST", `/api/players/${playerId}/scout-version/submit`);
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
      setSubmitStates((s) => ({ ...s, [playerId]: "done" }));
    } catch {
      setSubmitStates((s) => ({ ...s, [playerId]: "error" }));
    }
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
        {!showNewPlayer && myPlayers.length === 0 && (
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

        {myPlayers.length === 0 && !showNewPlayer ? (
          <p className="text-sm text-muted-foreground text-center py-16">{L.noPlayers}</p>
        ) : (
          myPlayers.map((player) => {
            const isCanonical = player.isCanonical ?? (player as any).is_canonical ?? false;
            const submitState = submitStates[player.id] ?? "idle";
            const inp = (player as any).inputs ?? (player as any).scoutingInputs;
            const hasReport = inp && typeof inp === "object" && Object.keys(inp).length > 3;

            return (
              <div
                key={player.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
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

                  {/* Info */}
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

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => {
                      const inp = (player as any).inputs ?? (player as any).scoutingInputs;
                      const hasReport = inp && typeof inp === "object" && Object.keys(inp).length > 3;
                      if (!hasReport) setLocation(`/coach/quick-scout/${player.id}`);
                      else setLocation(`/coach/player/${player.id}`);
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={L.editReport}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {/* Send to Film Room — only for canonical, only if has report */}
                {isCanonical && hasReport && (
                  <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-background/40">
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {submitState === "done"
                          ? L.sent
                          : submitState === "error"
                          ? (locale === "es" ? "Error — reintentar" : "Error — retry")
                          : locale === "es" ? "Listo para enviar" : "Ready to send"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={submitState === "done" ? "outline" : "default"}
                      className={cn(
                        "h-7 px-3 text-[11px] font-black rounded-lg",
                        submitState === "done" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
                        submitState === "error" && "border-destructive/40 text-destructive",
                      )}
                      disabled={submitState === "submitting" || submitState === "done"}
                      onClick={() => void handleSendToFilmRoom(player.id)}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      {submitState === "submitting" ? L.sending : submitState === "done" ? L.sent : L.sendToFilm}
                    </Button>
                  </div>
                )}

                {/* Report preview row */}
                {hasReport && (
                  <div
                    className="border-t border-border px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setLocation(`/coach/scout/${player.id}/review`)}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 flex-1">
                      {locale === "es" ? "Ver informe" : locale === "zh" ? "查看报告" : "View report"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
      <ModuleNav />
    </div>
  );
}

