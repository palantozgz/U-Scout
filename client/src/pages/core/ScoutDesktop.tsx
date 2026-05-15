import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { cn, localName, isRealPhoto } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { Search, Star, ChevronRight, ExternalLink } from "lucide-react";
import { usePlayers, useTeams, type PlayerProfile } from "@/lib/mock-data";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { ModuleNav } from "./ModuleNav";
import { ModuleHeader } from "@/components/branding/ModuleHeader";

// ── Attribute bar ─────────────────────────────────────────────
function AttrBar({
  label,
  value,   // 0–5
  max = 5,
  color = "primary",
}: {
  label: string;
  value: number;
  max?: number;
  color?: "primary" | "green" | "amber";
}) {
  const pct = Math.round((Math.min(value, max) / max) * 100);
  const fillClass =
    color === "green" ? "bg-emerald-500" :
    color === "amber" ? "bg-amber-500"   :
    "bg-primary";
  return (
    <div className="flex items-center gap-3 py-[5px] border-b border-border/30 last:border-0">
      <span className="text-[12px] font-medium text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-[4px] rounded-full bg-border/30 relative overflow-hidden">
        <div className={cn("absolute left-0 top-0 h-full rounded-full", fillClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-medium text-foreground w-6 text-right">{Math.round((value / max) * 99)}</span>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────
function PlayerRow({
  player, teamName, selected, locale, onClick,
}: {
  player: PlayerProfile; teamName: string; selected: boolean; locale: string; onClick: () => void;
}) {
  const name = localName(player.name, (player as any).nameEn ?? (player as any).name_en, locale) || "—";
  const isCanonical = (player as any).isCanonical ?? (player as any).is_canonical ?? false;
  const img = player.imageUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        selected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-accent border border-transparent",
      )}
    >
      <div className="relative shrink-0">
        {isRealPhoto(img) ? (
          <img src={img} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-border/50" />
        ) : (
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border/50">
            <BasketballPlaceholderAvatar size={36} />
          </div>
        )}
        {isCanonical && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
            <Star className="w-2 h-2 text-primary-foreground" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate leading-tight">{name}</p>
        <p className="text-[11px] text-muted-foreground/70 truncate">
          #{player.number || "—"} · {player.inputs?.position || "—"} · {teamName}
        </p>
      </div>
      <ChevronRight className={cn("w-4 h-4 shrink-0", selected ? "text-primary" : "text-muted-foreground/30")} />
    </button>
  );
}

// ── Report preview ────────────────────────────────────────────
function ReportPreview({
  player, teamName, locale, onOpen,
}: {
  player: PlayerProfile; teamName: string; locale: string; onOpen: () => void;
}) {
  const name = localName(player.name, (player as any).nameEn ?? (player as any).name_en, locale) || "—";
  const isCanonical = (player as any).isCanonical ?? (player as any).is_canonical ?? false;
  const img = player.imageUrl;
  const { archetype, subArchetype, keyTraits, defensivePlan, inputs } = player;

  const L = locale === "zh"
    ? { archetype: "打法类型", traits: "关键特征", attrs: "身体属性", plan: "防守策略", forzar: "施压", concede: "让步", notes: "教练备注", open: "查看完整报告" }
    : locale === "es"
    ? { archetype: "Arquetipo", traits: "Características clave", attrs: "Atributos", plan: "Defensa principal", forzar: "Forzar", concede: "Ceder", notes: "Notas del coach", open: "Ver informe completo" }
    : { archetype: "Archetype", traits: "Key traits", attrs: "Attributes", plan: "Defend as", forzar: "Force", concede: "Concede", notes: "Coach notes", open: "Open full report" };

  // Map 0-5 inputs to attribute bars
  const ath   = typeof inputs?.athleticism    === "number" ? inputs.athleticism    : 3;
  const phys  = typeof inputs?.physicalStrength === "number" ? inputs.physicalStrength : 3;
  const ft    = typeof inputs?.ftShooting      === "number" ? inputs.ftShooting      : 3;
  const foul  = typeof inputs?.foulDrawing     === "number" ? inputs.foulDrawing     : 2;

  const hasReport = Boolean(archetype || (keyTraits?.length ?? 0) > 0 || defensivePlan?.defender?.length);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border/30 shrink-0">
        <div className="relative shrink-0">
          {isRealPhoto(img) ? (
            <img src={img} alt={name} className="w-12 h-12 rounded-full object-cover ring-2 ring-border/50" />
          ) : (
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-border/50">
              <BasketballPlaceholderAvatar size={48} />
            </div>
          )}
          {isCanonical && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Star className="w-2.5 h-2.5 text-primary-foreground" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-medium text-foreground tracking-tight truncate">{name}</p>
          <p className="text-[12px] text-muted-foreground font-medium">
            #{player.number || "—"} · {inputs?.position || "—"} · {teamName}
          </p>
        </div>
        <button type="button" onClick={onOpen}
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/70 transition-colors shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />{L.open}
        </button>
      </div>

      {/* Body */}
      {hasReport ? (
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Archetype */}
          {archetype && (
            <div>
              <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70 mb-2">{L.archetype}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">{archetype}</span>
                {subArchetype && (
                  <span className="px-3 py-1 rounded-full bg-card border border-border/30 text-muted-foreground text-[12px] font-medium">{subArchetype}</span>
                )}
              </div>
            </div>
          )}

          {/* Attributes */}
          <div>
            <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70 mb-1">{L.attrs}</p>
            <AttrBar label={locale === "es" ? "Atletismo"         : locale === "zh" ? "运动能力" : "Athleticism"}   value={ath}  color="primary" />
            <AttrBar label={locale === "es" ? "Físico"            : locale === "zh" ? "身体对抗" : "Physical"}      value={phys} color="green"   />
            <AttrBar label={locale === "es" ? "Tiro libre"        : locale === "zh" ? "罚球"     : "FT shooting"}   value={ft}   color="primary" />
            <AttrBar label={locale === "es" ? "Genera faltas"     : locale === "zh" ? "引foul"   : "Foul drawing"}  value={foul} color="amber"   />
          </div>

          {/* Key traits */}
          {(keyTraits?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70 mb-2">{L.traits}</p>
              <div className="flex flex-wrap gap-1.5">
                {keyTraits.slice(0, 6).map((trait) => (
                  <span key={trait}
                    className="px-2.5 py-1 rounded-lg bg-card border border-border/30 text-[11px] font-medium text-foreground">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Defensive plan */}
          {(defensivePlan?.defender?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70 mb-2">{L.plan}</p>
              <div className="flex flex-col gap-2">
                {defensivePlan.defender?.slice(0, 2).map((line, i) => (
                  <div key={i} className="rounded-xl bg-card border border-border/30 p-3">
                    <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-primary mb-1">{L.plan}</p>
                    <p className="text-[12px] font-medium text-foreground leading-snug">{line}</p>
                  </div>
                ))}
                {defensivePlan.forzar?.slice(0, 1).map((line, i) => (
                  <div key={i} className="rounded-xl bg-card border border-border/30 p-3">
                    <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-amber-500 mb-1">{L.forzar}</p>
                    <p className="text-[12px] font-medium text-foreground leading-snug">{line}</p>
                  </div>
                ))}
                {defensivePlan.concede?.slice(0, 1).map((line, i) => (
                  <div key={i} className="rounded-xl bg-card border border-border/30 p-3">
                    <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-emerald-500 mb-1">{L.concede}</p>
                    <p className="text-[12px] font-medium text-foreground leading-snug">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <p className="text-[13px] font-medium text-muted-foreground/70 text-center">
            {locale === "zh" ? "该球员暂无球探报告" : locale === "es" ? "Sin informe scout para este jugador" : "No scout report yet for this player"}
          </p>
          <button type="button" onClick={onOpen}
            className="text-[13px] font-medium text-primary hover:text-primary/70 transition-colors">
            {locale === "zh" ? "创建报告" : locale === "es" ? "Crear informe" : "Create report"} →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ScoutDesktop() {
  const { locale } = useLocale();
  const [, setLocation] = useLocation();
  const { data: allPlayers = [], isLoading } = usePlayers();
  const { data: teams = [] } = useTeams();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const L = locale === "zh"
    ? { search: "搜索球员…", count: (n: number) => `${n} 名球员` }
    : locale === "es"
    ? { search: "Buscar jugador…", count: (n: number) => `${n} jugador${n !== 1 ? "es" : ""}` }
    : { search: "Search players…", count: (n: number) => `${n} player${n !== 1 ? "s" : ""}` };

  const getTeamName = (teamId: string) => {
    const t = teams.find((x) => x.id === teamId);
    return t ? localName(t.name, (t as any).nameEn ?? (t as any).name_en, locale) : "";
  };

  const players = useMemo(() =>
    allPlayers.filter((p) => (p as any).isCanonical ?? (p as any).is_canonical ?? false),
    [allPlayers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const name = localName(p.name, (p as any).nameEn ?? (p as any).name_en, locale);
      return name.toLowerCase().includes(q) ||
        (p.inputs?.position ?? "").toLowerCase().includes(q) ||
        getTeamName(p.teamId).toLowerCase().includes(q);
    });
  }, [players, search, locale, teams]);

  const effectiveSelected = selectedId ?? filtered[0]?.id ?? null;
  const selectedPlayer = filtered.find((p) => p.id === effectiveSelected) ?? null;

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-2 shrink-0">
        <ModuleHeader module="scout"
          tagline={locale === "zh" ? "球探报告" : locale === "es" ? "Informes scout" : "Scout reports"} />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 px-8 pb-10 gap-4">

        {/* Left — player list */}
        <div className="flex flex-col w-64 lg:w-72 shrink-0">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L.search}
              className="w-full pl-9 pr-3 py-2 text-[13px] font-medium rounded-xl border border-border/30 bg-card text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* Count label */}
          <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70 mb-2 px-1">
            {L.count(filtered.length)}
          </p>
          {/* List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-[13px] font-medium text-muted-foreground/70 text-center py-8">
                {locale === "zh" ? "没有找到球员" : locale === "es" ? "Sin resultados" : "No players found"}
              </p>
            ) : filtered.map((player) => (
              <PlayerRow key={player.id} player={player}
                teamName={getTeamName(player.teamId)}
                selected={effectiveSelected === player.id}
                locale={locale}
                onClick={() => setSelectedId(player.id)} />
            ))}
          </div>
        </div>

        {/* Right — report preview */}
        <div className="flex-1 min-w-0 border border-border/30 rounded-xl overflow-hidden bg-card">
          {selectedPlayer ? (
            <ReportPreview
              player={selectedPlayer}
              teamName={getTeamName(selectedPlayer.teamId)}
              locale={locale}
              onOpen={() => setLocation(`/coach/scout/${selectedPlayer.id}/review`)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] font-medium text-muted-foreground/70">
                {locale === "zh" ? "选择一名球员查看报告"
                  : locale === "es" ? "Selecciona un jugador para ver su informe"
                  : "Select a player to view their report"}
              </p>
            </div>
          )}
        </div>
      </div>
      <ModuleNav />
    </div>
  );
}
