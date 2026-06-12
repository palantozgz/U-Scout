import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "vaul";
import { useGameBoxscore, type GameBoxscorePlayer } from "@/lib/stats-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function pickName(
  nameZh: string | null | undefined,
  nameEn: string | null | undefined,
  locale: string,
): string {
  if (locale === "zh") return nameZh ?? nameEn ?? "—";
  return nameEn ?? nameZh ?? "—";
}

function fmtPct(n: number | null): string {
  if (n === null || isNaN(n)) return "—";
  return n.toFixed(1) + "%";
}

function fmtPM(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? "+" + n : String(n);
}

function efg(fgm: number, tpm: number, fga: number): number | null {
  if (fga === 0) return null;
  return ((fgm + 0.5 * tpm) / fga) * 100;
}

function tovPct(tov: number, fga: number, fta: number): number | null {
  const denom = fga + 0.44 * fta + tov;
  if (denom === 0) return null;
  return (tov / denom) * 100;
}

function sumPlayers(ps: GameBoxscorePlayer[]) {
  return ps.reduce(
    (acc, p) => ({
      pts:  acc.pts  + p.pts,
      reb:  acc.reb  + p.reb,
      ast:  acc.ast  + p.ast,
      stl:  acc.stl  + p.stl,
      blk:  acc.blk  + p.blk,
      tov:  acc.tov  + p.tov,
      fgm:  acc.fgm  + p.fgm,
      fga:  acc.fga  + p.fga,
      tpm:  acc.tpm  + p.tpm,
      tpa:  acc.tpa  + p.tpa,
      ftm:  acc.ftm  + p.ftm,
      fta:  acc.fta  + p.fta,
      plusMinus: acc.plusMinus + p.plusMinus,
    }),
    { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, tpm:0, tpa:0, ftm:0, fta:0, plusMinus:0 },
  );
}

// ─── types ────────────────────────────────────────────────────────────────────

type SortKey = "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "plusMinus" | "fga" | "tpa" | "fta" | "min";

function getCols(locale: string): { key: SortKey; label: string; short: string }[] {
  const es = locale === "es";
  const zh = locale === "zh";
  return [
    { key: "pts",       label: "PTS",                                           short: "PTS" },
    { key: "reb",       label: "REB",                                           short: "REB" },
    { key: "ast",       label: es ? "ASI" : zh ? "助" : "AST",                  short: es ? "ASI" : zh ? "助" : "AST" },
    { key: "stl",       label: es ? "ROB" : zh ? "抢" : "STL",                  short: es ? "ROB" : zh ? "抢" : "STL" },
    { key: "blk",       label: es ? "TAP" : zh ? "盖" : "BLK",                  short: es ? "TAP" : zh ? "盖" : "BLK" },
    { key: "tov",       label: es ? "PER" : zh ? "失" : "TOV",                  short: es ? "PER" : zh ? "失" : "TOV" },
    { key: "plusMinus", label: "+/−",                                           short: "+/−" },
    { key: "fga",       label: "FG",                                            short: "FG"  },
    { key: "tpa",       label: "3P",                                            short: "3P"  },
    { key: "fta",       label: es ? "TL" : zh ? "罚" : "FT",                    short: es ? "TL" : zh ? "罚" : "FT" },
  ];
}

// ─── sub-components ────────────────────────────────────────────────────────────

function QuarterRow({ qs, score, label }: { qs: (number | null)[]; score: number; label: string }) {
  return (
    <div className="flex items-center gap-0">
      <span className="w-20 text-[10px] text-muted-foreground truncate pr-1">{label}</span>
      {qs.map((q, i) => (
        <span key={i} className="w-8 text-center text-[11px] font-mono text-foreground/70">
          {q ?? "—"}
        </span>
      ))}
      <span className="w-10 text-center text-[13px] font-black text-foreground">{score}</span>
    </div>
  );
}

type ColDef = { key: SortKey; label: string; short: string };

function StatColHeader({ col, sortKey, onSort }: {
  col: ColDef; sortKey: SortKey; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col.key;
  return (
    <button
      onClick={() => onSort(col.key)}
      className={cn(
        "w-9 shrink-0 text-center text-[9px] font-black uppercase tracking-wide py-1.5 transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {col.short}
      {active && <span className="block h-0.5 bg-primary mx-auto w-4 mt-0.5 rounded-full" />}
    </button>
  );
}

function PlayerRow({ p, locale, cols, isLast }: {
  p: GameBoxscorePlayer;
  locale: string;
  cols: ColDef[];
  isLast: boolean;
}) {
  const name = pickName(p.nameZh, p.nameEn, locale);
  const vals: Record<SortKey, string> = {
    pts:       String(p.pts),
    reb:       String(p.reb),
    ast:       String(p.ast),
    stl:       String(p.stl),
    blk:       String(p.blk),
    tov:       String(p.tov),
    plusMinus: fmtPM(p.plusMinus),
    fga:       p.fga > 0 ? `${p.fgm}/${p.fga}` : "—",
    tpa:       p.tpa > 0 ? `${p.tpm}/${p.tpa}` : "—",
    fta:       p.fta > 0 ? `${p.ftm}/${p.fta}` : "—",
    min:       p.minutes ?? "—",
  };

  return (
    <div className={cn(
      "flex items-center border-border/30 transition-colors active:bg-muted/10",
      !isLast && "border-b",
      p.isStart && "bg-muted/5",
    )}>
      <div className="w-28 shrink-0 flex items-center gap-1.5 px-2 py-2">
        {p.isStart
          ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          : <span className="w-1.5 h-1.5 shrink-0" />
        }
        <div className="min-w-0">
          <p className="text-[11px] font-bold truncate leading-tight">{name}</p>
          {p.jerseyNumber && (
            <p className="text-[9px] text-muted-foreground leading-tight">#{p.jerseyNumber}</p>
          )}
        </div>
      </div>
      {cols.map((col) => {
        const isPts = col.key === "pts";
        const isPM  = col.key === "plusMinus";
        return (
          <span
            key={col.key}
            className={cn(
              "w-9 shrink-0 text-center text-[11px] tabular-nums",
              isPts && "font-black text-foreground",
              !isPts && "text-foreground/80",
              isPM && p.plusMinus > 0 && "text-emerald-500",
              isPM && p.plusMinus < 0 && "text-red-400",
              (col.key === "fga" || col.key === "tpa" || col.key === "fta") && "text-[10px] text-muted-foreground",
            )}
          >
            {vals[col.key]}
          </span>
        );
      })}
    </div>
  );
}

function TotalsRow({ players, locale, cols }: {
  players: GameBoxscorePlayer[];
  locale: string;
  cols: ColDef[];
}) {
  const t = sumPlayers(players);
  const vals: Record<SortKey, string> = {
    pts: String(t.pts), reb: String(t.reb), ast: String(t.ast),
    stl: String(t.stl), blk: String(t.blk), tov: String(t.tov),
    plusMinus: "—",
    fga: t.fga > 0 ? `${t.fgm}/${t.fga}` : "—",
    tpa: t.tpa > 0 ? `${t.tpm}/${t.tpa}` : "—",
    fta: t.fta > 0 ? `${t.ftm}/${t.fta}` : "—",
    min: "",
  };
  return (
    <div className="flex items-center border-t-2 border-border bg-muted/10">
      <div className="w-28 shrink-0 px-2 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {locale === "zh" ? "合计" : "TOTAL"}
        </p>
      </div>
      {cols.map((col) => (
        <span
          key={col.key}
          className={cn(
            "w-9 shrink-0 text-center tabular-nums font-black",
            col.key === "pts" ? "text-[12px] text-foreground" : "text-[10px] text-muted-foreground",
          )}
        >
          {vals[col.key]}
        </span>
      ))}
    </div>
  );
}

function AdvancedCard({ homePlayers, awayPlayers, homeName, awayName, locale }: {
  homePlayers: GameBoxscorePlayer[];
  awayPlayers: GameBoxscorePlayer[];
  homeName: string;
  awayName: string;
  locale: string;
}) {
  const calc = (ps: GameBoxscorePlayer[]) => {
    const t = sumPlayers(ps);
    return {
      fgPct:   t.fga > 0 ? (t.fgm / t.fga) * 100 : null,
      tpPct:   t.tpa > 0 ? (t.tpm / t.tpa) * 100 : null,
      ftPct:   t.fta > 0 ? (t.ftm / t.fta) * 100 : null,
      efgPct:  efg(t.fgm, t.tpm, t.fga),
      tovPctV: tovPct(t.tov, t.fga, t.fta),
      ftRate:  t.fga > 0 ? t.fta / t.fga : null,
    };
  };
  const h = calc(homePlayers);
  const a = calc(awayPlayers);

  const es = locale === "es";
  const zh = locale === "zh";

  const rows: { label: string; hVal: string; aVal: string; hBetter: boolean | null }[] = [
    { label: "eFG%",                                        hVal: fmtPct(h.efgPct),  aVal: fmtPct(a.efgPct),  hBetter: h.efgPct  != null && a.efgPct  != null ? h.efgPct  > a.efgPct  : null },
    { label: "FG%",                                         hVal: fmtPct(h.fgPct),   aVal: fmtPct(a.fgPct),   hBetter: h.fgPct   != null && a.fgPct   != null ? h.fgPct   > a.fgPct   : null },
    { label: "3P%",                                         hVal: fmtPct(h.tpPct),   aVal: fmtPct(a.tpPct),   hBetter: h.tpPct   != null && a.tpPct   != null ? h.tpPct   > a.tpPct   : null },
    { label: es ? "TL%" : zh ? "罚球%" : "FT%",             hVal: fmtPct(h.ftPct),   aVal: fmtPct(a.ftPct),   hBetter: h.ftPct   != null && a.ftPct   != null ? h.ftPct   > a.ftPct   : null },
    { label: es ? "PER%" : zh ? "失误率" : "TOV%",           hVal: fmtPct(h.tovPctV), aVal: fmtPct(a.tovPctV), hBetter: h.tovPctV != null && a.tovPctV != null ? h.tovPctV < a.tovPctV : null },
    { label: es ? "Tasa TL" : zh ? "罚球率" : "FT Rate",    hVal: h.ftRate != null ? h.ftRate.toFixed(2) : "—", aVal: a.ftRate != null ? a.ftRate.toFixed(2) : "—", hBetter: h.ftRate != null && a.ftRate != null ? h.ftRate > a.ftRate : null },
  ];

  const sectionLabel = zh ? "进攻数据对比" : es ? "Comparativa ofensiva" : "Shooting comparison";

  return (
    <div className="mt-4 mb-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 mb-2">
        {sectionLabel}
      </p>
      <div className="border-t border-border">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5 border-b border-border/40">
          <span className="text-[10px] font-bold text-left truncate pr-2">{homeName}</span>
          <span className="w-16" />
          <span className="text-[10px] font-bold text-right truncate pl-2">{awayName}</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5 border-b border-border/20 last:border-0">
            <span className={cn("text-[12px] font-black tabular-nums text-left",
              r.hBetter === true && "text-emerald-500", r.hBetter === false && "text-foreground/60")}>
              {r.hVal}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center w-16">
              {r.label}
            </span>
            <span className={cn("text-[12px] font-black tabular-nums text-right",
              r.hBetter === false && "text-emerald-500", r.hBetter === true && "text-foreground/60")}>
              {r.aVal}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

interface GameBoxscoreSheetProps {
  gameId: string | null;
  locale: string;
  onClose: () => void;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  gamePosition?: { current: number; total: number } | null;
}

export function GameBoxscoreSheet({ gameId, locale, onClose, onPrev, onNext, gamePosition }: GameBoxscoreSheetProps) {
  const { data, isLoading } = useGameBoxscore(gameId);
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");
  const [sortKey, setSortKey] = useState<SortKey>("pts");

  const es = locale === "es";
  const zh = locale === "zh";

  // Locale-aware columns — computed once per locale change
  const COLS = useMemo(() => getCols(locale), [locale]);

  const homePlayers = useMemo(
    () => (data?.players.filter((p) => p.teamExtId === data.game.home.extId) ?? []),
    [data],
  );
  const awayPlayers = useMemo(
    () => (data?.players.filter((p) => p.teamExtId !== data?.game.home.extId) ?? []),
    [data],
  );

  function sorted(ps: GameBoxscorePlayer[]): GameBoxscorePlayer[] {
    return [...ps].sort((a, b) => {
      if (sortKey === "min") {
        const toSec = (m: string) => { const [mm, ss] = (m ?? "0:00").split(":").map(Number); return (mm||0)*60+(ss||0); };
        return toSec(b.minutes) - toSec(a.minutes);
      }
      if (sortKey === "tov") return b.tov - a.tov;
      const va = a[sortKey as keyof GameBoxscorePlayer] as number;
      const vb = b[sortKey as keyof GameBoxscorePlayer] as number;
      return vb !== va ? vb - va : b.pts - a.pts;
    });
  }

  const activePlayers = sorted(activeTeam === "home" ? homePlayers : awayPlayers);
  const g = data?.game;

  const homeName = g ? pickName(g.home.nameZh, g.home.nameEn, locale) : "…";
  const awayName = g ? pickName(g.away.nameZh, g.away.nameEn, locale) : "…";
  const homeQs   = g ? [g.homeQ1, g.homeQ2, g.homeQ3, g.homeQ4] : [null, null, null, null];
  const awayQs   = g ? [g.awayQ1, g.awayQ2, g.awayQ3, g.awayQ4] : [null, null, null, null];
  const homeWon  = g ? g.homeScore > g.awayScore : false;

  return (
    <Drawer.Root
      open={Boolean(gameId)}
      onOpenChange={(o) => { if (!o) onClose(); }}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 h-[92dvh] min-h-[70%] flex flex-col p-0 pb-[env(safe-area-inset-bottom)] bg-background border-t border-border outline-none md:ml-12 lg:ml-48"
        >
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            {/* ── Drag handle + nav ────────────────────────────── */}
            <div className="shrink-0 flex items-center justify-between px-3 pt-3 pb-1">
              <button
                onClick={onPrev ?? undefined}
                disabled={!onPrev}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors",
                  onPrev ? "text-muted-foreground hover:text-foreground hover:bg-muted/30" : "invisible",
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {es ? "Ant" : zh ? "上场" : "Prev"}
              </button>

              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={onClose}
                  className="w-8 h-1 rounded-full bg-border hover:bg-muted-foreground/40 transition-colors"
                />
                {gamePosition && (
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {gamePosition.current} / {gamePosition.total}
                  </span>
                )}
              </div>

              <button
                onClick={onNext ?? undefined}
                disabled={!onNext}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors",
                  onNext ? "text-muted-foreground hover:text-foreground hover:bg-muted/30" : "invisible",
                )}
              >
                {es ? "Sig" : zh ? "下场" : "Next"}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Score header ─────────────────────────────────── */}
            <div className="shrink-0 bg-card border-b border-border px-3 pb-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex-1 text-left">
                  <p className={cn("text-[11px] font-black uppercase tracking-wide truncate",
                    homeWon ? "text-foreground" : "text-muted-foreground")}>
                    {homeName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-3xl font-black tabular-nums leading-none",
                    homeWon ? "text-foreground" : "text-muted-foreground")}>
                    {g?.homeScore ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground font-light">–</span>
                  <span className={cn("text-3xl font-black tabular-nums leading-none",
                    !homeWon ? "text-foreground" : "text-muted-foreground")}>
                    {g?.awayScore ?? "—"}
                  </span>
                </div>
                <div className="flex-1 text-right">
                  <p className={cn("text-[11px] font-black uppercase tracking-wide truncate",
                    !homeWon ? "text-foreground" : "text-muted-foreground")}>
                    {awayName}
                  </p>
                </div>
              </div>

              {g?.homeQ1 != null && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-0">
                    <span className="w-20" />
                    {["Q1","Q2","Q3","Q4"].map((q) => (
                      <span key={q} className="w-8 text-center text-[9px] font-black text-muted-foreground/50 uppercase">{q}</span>
                    ))}
                    <span className="w-10 text-center text-[9px] font-black text-muted-foreground/50 uppercase">
                      {es ? "TOT" : zh ? "总" : "TOT"}
                    </span>
                  </div>
                  <QuarterRow qs={homeQs} score={g.homeScore} label={homeName} />
                  <QuarterRow qs={awayQs} score={g.awayScore} label={awayName} />
                </div>
              )}
            </div>

            {/* ── Team tabs ─────────────────────────────────────── */}
            <div className="shrink-0 flex border-b border-border">
              {(["home", "away"] as const).map((t) => {
                const name  = t === "home" ? homeName : awayName;
                const active = activeTeam === t;
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTeam(t)}
                    className={cn(
                      "flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors relative",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70",
                    )}
                  >
                    {name}
                    {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
                  </button>
                );
              })}
            </div>

            {/* ── Table area ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {isLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {data && (
                <>
                  <div className="sticky top-0 z-10 bg-card border-b border-border flex items-center">
                    <div className="w-28 shrink-0 px-2 py-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                        {es ? "Jugadora" : zh ? "球员" : "Player"}
                      </span>
                    </div>
                    <div className="flex items-center">
                      {COLS.map((col) => (
                        <StatColHeader key={col.key} col={col} sortKey={sortKey} onSort={setSortKey} />
                      ))}
                    </div>
                  </div>

                  <div>
                    {activePlayers.map((p, i) => (
                      <PlayerRow
                        key={p.externalId}
                        p={p}
                        locale={locale}
                        cols={COLS}
                        isLast={i === activePlayers.length - 1}
                      />
                    ))}
                  </div>

                  <TotalsRow
                    players={activeTeam === "home" ? homePlayers : awayPlayers}
                    locale={locale}
                    cols={COLS}
                  />

                  <AdvancedCard
                    homePlayers={homePlayers}
                    awayPlayers={awayPlayers}
                    homeName={homeName}
                    awayName={awayName}
                    locale={locale}
                  />
                </>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
