import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, FlaskConical, ChevronDown, ChevronUp,
  Shield, Zap, Flame, Target, User, SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { generateProfile, type PlayerInput, type PlayerProfile } from "@/lib/mock-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function maybe<T>(arr: T[], prob = 0.5): T | undefined { return Math.random() < prob ? pick(arr) : undefined; }

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const INTENSITIES = ["Primary", "Secondary", "Rare", "Never"] as const;
const DIRECTIONS = ["Left", "Right", "Balanced"] as const;
const PHYSICAL = ["Low", "Medium", "High"] as const;
const CLOSEOUTS = ["Catch & Shoot", "Attack Baseline", "Attack Middle", "Extra Pass"] as const;
const PNR_FINISHES = ["Drive to Rim", "Pull-up", "Floater", "Mid-range"] as const;
const POST_MOVES_POOL = ["Hook Shot", "Fadeaway", "Drop Step", "Jump Hook", "Spin Baseline", "Spin Middle", "Up & Under"];

let playerCounter = 1;

function randomInputs(): PlayerInput {
  const postFrequency = pick(INTENSITIES);
  const pnrFrequency  = pick(INTENSITIES);
  const isoFrequency  = pick(INTENSITIES);
  const postMoves: string[] = [];
  if (postFrequency === "Primary" || postFrequency === "Secondary") {
    const count = 1 + Math.floor(Math.random() * 3);
    const pool = [...POST_MOVES_POOL];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      postMoves.push(pool.splice(idx, 1)[0]);
    }
  }
  return {
    position: pick([...POSITIONS]),
    height: String(170 + Math.floor(Math.random() * 40)),
    weight: String(65 + Math.floor(Math.random() * 50)),
    minutesPerGame: 10 + Math.floor(Math.random() * 28),
    athleticism: pick([...PHYSICAL]),
    physicalStrength: pick([...PHYSICAL]),
    postFrequency,
    postPreferredBlock: pick(["Left Block", "Right Block", "Any"]),
    postPlayType: pick(["Back to Basket", "Face-Up", "Mixed"]),
    postMoves,
    isoFrequency,
    isoDominantDirection: pick([...DIRECTIONS]),
    isoInitiation: pick(["Controlled", "Quick Attack"]),
    isoDecision: pick(["Finish", "Shoot", "Pass"]),
    isoOppositeFinish: maybe(["Drive", "Pull-up", "Floater"] as const, 0.7),
    closeoutReaction: pick([...CLOSEOUTS]),
    pnrFrequency,
    pnrRole: pick(["Handler", "Screener"]),
    pnrScoringPriority: pick(["Score First", "Pass First", "Balanced"]),
    pnrScreenerAction: pick(["Roll", "Pop", "Slip"]),
    pnrReactionVsUnder: pick(["Pull-up 3", "Re-screen", "Reject / Attack"]),
    pnrTiming: pick(["Early (Drag)", "Deep (Half-court)"]),
    pnrDirection: pick([...DIRECTIONS]),
    pnrDominantFinish: maybe([...PNR_FINISHES], 0.8),
    pnrOppositeFinish: maybe([...PNR_FINISHES], 0.7),
    transitionFrequency: pick(INTENSITIES),
    transitionRole: pick(["Pusher", "Outlet", "Rim Runner", "Trailer"]),
    indirectsFrequency: pick(INTENSITIES),
    backdoorFrequency: pick(INTENSITIES),
    offensiveReboundFrequency: pick(INTENSITIES),
  };
}

function generateTestPlayer(id: string, inputs: PlayerInput): TestPlayer {
  const profile = generateProfile(inputs);
  return {
    id,
    name: `Player ${playerCounter++}`,
    inputs,
    archetype: profile.archetype,
    keyTraits: profile.keyTraits,
    internalModel: profile.internalModel,
    defensivePlan: profile.defensivePlan,
  };
}

function generateBatch(count: number): TestPlayer[] {
  return Array.from({ length: count }, (_, i) => {
    const inputs = randomInputs();
    return generateTestPlayer(`tp-${Date.now()}-${i}`, inputs);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestPlayer {
  id: string;
  name: string;
  inputs: PlayerInput;
  archetype: string;
  keyTraits: string[];
  internalModel: PlayerProfile["internalModel"];
  defensivePlan: PlayerProfile["defensivePlan"];
}

// ── Behaviour tags ────────────────────────────────────────────────────────────

function getBehaviorTags(p: TestPlayer): string[] {
  const tags: string[] = [];
  if (p.internalModel.scoringType === "Driver") tags.push("Driver");
  if (p.internalModel.scoringType === "Shooter") tags.push("Shooter");
  if (p.internalModel.scoringType === "Post Scorer") tags.push("Post Scorer");
  if (p.inputs.isoDecision === "Shoot") tags.push("Pull-up");
  if (p.inputs.isoDecision === "Finish") tags.push("Finisher");
  if (p.inputs.closeoutReaction === "Catch & Shoot") tags.push("C&S Threat");
  if (p.inputs.closeoutReaction === "Attack Baseline") tags.push("Attacks Baseline");
  if (p.inputs.closeoutReaction === "Attack Middle") tags.push("Attacks Middle");
  if (p.inputs.pnrReactionVsUnder === "Pull-up 3") tags.push("PnR Pull-up");
  if (p.inputs.backdoorFrequency === "Primary" || p.inputs.backdoorFrequency === "Secondary") tags.push("Backdoor Cutter");
  if (p.inputs.indirectsFrequency === "Primary") tags.push("Off-Screen Shooter");
  if (p.inputs.isoInitiation === "Quick Attack") tags.push("Quick Attacker");
  if (p.inputs.athleticism === "High") tags.push("Explosive");
  if (p.inputs.physicalStrength === "High") tags.push("Physical");
  return tags;
}

// ── Default manual inputs ─────────────────────────────────────────────────────

const defaultManualInputs: PlayerInput = {
  position: "PG", height: "185", weight: "80", minutesPerGame: 25,
  athleticism: "Medium", physicalStrength: "Medium",
  postFrequency: "Never", postPreferredBlock: "Any", postPlayType: "Mixed", postMoves: [],
  isoFrequency: "Primary", isoDominantDirection: "Right",
  isoInitiation: "Controlled", isoDecision: "Finish",
  isoOppositeFinish: "Pull-up", closeoutReaction: "Catch & Shoot",
  pnrFrequency: "Primary", pnrRole: "Handler",
  pnrScoringPriority: "Score First", pnrScreenerAction: "Roll",
  pnrReactionVsUnder: "Pull-up 3", pnrTiming: "Deep (Half-court)",
  pnrDirection: "Right", pnrDominantFinish: "Drive to Rim",
  pnrOppositeFinish: "Pull-up",
  transitionFrequency: "Secondary", transitionRole: "Pusher",
  indirectsFrequency: "Rare", backdoorFrequency: "Rare",
  offensiveReboundFrequency: "Rare",
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TraitBadge({ type }: { type?: "Strength" | "Weakness" | "Neutral" }) {
  if (type === "Strength") return <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-1.5" />;
  if (type === "Weakness") return <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />;
}

function PlayerCard({ player }: { player: TestPlayer }) {
  const [open, setOpen] = useState(false);
  const tags = getBehaviorTags(player);
  const isoTraits = player.internalModel.isoTraits.slice(0, 2);
  const pnrTraits = player.internalModel.pnrTraits.slice(0, 1);
  const allTopTraits = [...isoTraits, ...pnrTraits];
  const forzar = (player.defensivePlan.forzar ?? []).slice(0, 2);
  const concede = (player.defensivePlan.concede ?? []).slice(0, 2);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden" data-testid={`card-test-player-${player.id}`}>
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(o => !o)}
        data-testid={`button-expand-${player.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{(player.inputs)?.position ?? "—"}</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{player.archetype}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>
        <span className="text-slate-400 shrink-0 ml-2">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
              <p className="text-muted-foreground font-semibold uppercase text-[10px]">Scoring</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{player.internalModel.scoringType}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
              <p className="text-muted-foreground font-semibold uppercase text-[10px]">Side</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{player.internalModel.dominantSide}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
              <p className="text-muted-foreground font-semibold uppercase text-[10px]">PnR</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5 leading-tight text-[10px]">{player.internalModel.pnrRoleClassification}</p>
            </div>
          </div>

          {allTopTraits.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Flame className="w-3 h-3" /> Key Outputs</p>
              {allTopTraits.map((t, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <TraitBadge type={t.type} />
                  <span className="text-slate-700 dark:text-slate-300 leading-snug">{t.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Shield className="w-3 h-3" /> Defensive Plan</p>
            {forzar.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-orange-500 font-bold shrink-0">→</span>
                <span className="text-slate-700 dark:text-slate-300 leading-snug">{f}</span>
              </div>
            ))}
            {concede.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold shrink-0">✓</span>
                <span className="text-slate-700 dark:text-slate-300 leading-snug">Concede: {c}</span>
              </div>
            ))}
          </div>

          <details className="text-[10px] text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700">Raw inputs</summary>
            <pre className="mt-1 overflow-x-auto bg-slate-50 dark:bg-slate-800 rounded p-2 text-[9px] leading-relaxed">
              {JSON.stringify(player.inputs, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ManualField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/50 dark:border-slate-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TestMode() {
  const [, setLocation] = useLocation();
  const [players, setPlayers] = useState<TestPlayer[]>([]);
  const [filterArchetype, setFilterArchetype] = useState("All");
  const [filterBehavior, setFilterBehavior] = useState("All");
  const [showManual, setShowManual] = useState(false);
  const [manualInputs, setManualInputs] = useState<PlayerInput>(defaultManualInputs);
  const [manualResult, setManualResult] = useState<TestPlayer | null>(null);
  const [batchCount, setBatchCount] = useState(30);

  const handleGenerate = () => {
    playerCounter = 1;
    setPlayers(generateBatch(batchCount));
    setFilterArchetype("All");
    setFilterBehavior("All");
  };

  const archetypes = useMemo(() => {
    const set = new Set(players.map(p => p.archetype));
    return ["All", ...Array.from(set).sort()];
  }, [players]);

  const behaviorOptions = useMemo(() => {
    const set = new Set<string>();
    players.forEach(p => getBehaviorTags(p).forEach(t => set.add(t)));
    return ["All", ...Array.from(set).sort()];
  }, [players]);

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (filterArchetype !== "All" && p.archetype !== filterArchetype) return false;
      if (filterBehavior !== "All" && !getBehaviorTags(p).includes(filterBehavior)) return false;
      return true;
    });
  }, [players, filterArchetype, filterBehavior]);

  const updateManual = (key: keyof PlayerInput, v: string) =>
    setManualInputs(prev => ({ ...prev, [key]: v }));

  const runManual = () => {
    const result = generateTestPlayer(`manual-${Date.now()}`, manualInputs);
    result.name = "Manual Test";
    setManualResult(result);
  };

  // Stats summary
  const stats = useMemo(() => {
    if (!players.length) return null;
    const byArchetype: Record<string, number> = {};
    const byScoringType: Record<string, number> = {};
    players.forEach(p => {
      byArchetype[p.archetype] = (byArchetype[p.archetype] ?? 0) + 1;
      byScoringType[p.internalModel.scoringType] = (byScoringType[p.internalModel.scoringType] ?? 0) + 1;
    });
    const topArchetype = Object.entries(byArchetype).sort((a, b) => b[1] - a[1])[0];
    return { total: players.length, topArchetype, byScoringType };
  }, [players]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/coach")} className="-ml-2 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4 text-primary" /> Engine Test Mode
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium">Internal — validates scouting logic</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-bold border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400">INTERNAL</Badge>
      </header>

      <main className="flex-1 p-4 space-y-4 pb-10">

        {/* ── Generate panel ─────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <p className="text-sm font-bold text-slate-800 dark:text-white">Batch Generator</p>
          <div className="flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Player count</Label>
              <Select value={String(batchCount)} onValueChange={v => setBatchCount(Number(v))}>
                <SelectTrigger className="h-9 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/50 dark:border-slate-700" data-testid="select-batch-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 30, 40, 50].map(n => <SelectItem key={n} value={String(n)}>{n} players</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              className="h-9 px-4 rounded-xl font-bold text-sm flex items-center gap-2 mt-5"
              data-testid="button-generate"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Generate
            </Button>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────── */}
        {stats && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-800 dark:text-white mb-2">Summary — {stats.total} players</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.byScoringType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <span key={type} className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                  {type}: {count}
                </span>
              ))}
              <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Top archetype: {stats.topArchetype?.[0]} ×{stats.topArchetype?.[1]}
              </span>
            </div>
          </div>
        )}

        {/* ── Filters ───────────────────────────────────── */}
        {players.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Filters <span className="text-muted-foreground font-normal">({filtered.length} shown)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Archetype</Label>
                <Select value={filterArchetype} onValueChange={setFilterArchetype}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/50 dark:border-slate-700" data-testid="select-filter-archetype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {archetypes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Behavior</Label>
                <Select value={filterBehavior} onValueChange={setFilterBehavior}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-slate-50 dark:bg-slate-950/50 dark:border-slate-700" data-testid="select-filter-behavior">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {behaviorOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ── Player list ───────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground px-1 uppercase tracking-wider">Results — tap to expand</p>
            {filtered.map(p => <PlayerCard key={p.id} player={p} />)}
          </div>
        )}

        {players.length > 0 && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm font-medium">
            No players match these filters.
          </div>
        )}

        {players.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm font-medium">
            Press &quot;Generate&quot; to create test players.
          </div>
        )}

        {/* ── Manual test ───────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            onClick={() => setShowManual(o => !o)}
            data-testid="button-toggle-manual"
          >
            <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Manual Test Player
            </span>
            {showManual ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showManual && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <ManualField label="Position" value={manualInputs.position} options={POSITIONS} onChange={v => updateManual("position", v)} />
                <ManualField label="ISO Frequency" value={manualInputs.isoFrequency} options={[...INTENSITIES]} onChange={v => updateManual("isoFrequency", v)} />
                <ManualField label="ISO Decision" value={manualInputs.isoDecision!} options={["Finish", "Shoot", "Pass"]} onChange={v => updateManual("isoDecision", v as any)} />
                <ManualField label="ISO Initiation" value={manualInputs.isoInitiation!} options={["Controlled", "Quick Attack"]} onChange={v => updateManual("isoInitiation", v as any)} />
                <ManualField label="ISO Direction" value={manualInputs.isoDominantDirection} options={[...DIRECTIONS]} onChange={v => updateManual("isoDominantDirection", v as any)} />
                <ManualField label="Closeout" value={manualInputs.closeoutReaction} options={[...CLOSEOUTS]} onChange={v => updateManual("closeoutReaction", v as any)} />
                <ManualField label="PnR Frequency" value={manualInputs.pnrFrequency} options={[...INTENSITIES]} onChange={v => updateManual("pnrFrequency", v)} />
                <ManualField label="PnR Role" value={manualInputs.pnrRole} options={["Handler", "Screener"]} onChange={v => updateManual("pnrRole", v as any)} />
                <ManualField label="PnR Priority" value={manualInputs.pnrScoringPriority} options={["Score First", "Pass First", "Balanced"]} onChange={v => updateManual("pnrScoringPriority", v as any)} />
                <ManualField label="PnR vs Under" value={manualInputs.pnrReactionVsUnder} options={["Pull-up 3", "Re-screen", "Reject / Attack"]} onChange={v => updateManual("pnrReactionVsUnder", v as any)} />
                <ManualField label="Athleticism" value={manualInputs.athleticism!} options={[...PHYSICAL]} onChange={v => updateManual("athleticism", v as any)} />
                <ManualField label="Strength" value={manualInputs.physicalStrength!} options={[...PHYSICAL]} onChange={v => updateManual("physicalStrength", v as any)} />
                <ManualField label="Post Frequency" value={manualInputs.postFrequency} options={[...INTENSITIES]} onChange={v => updateManual("postFrequency", v)} />
                <ManualField label="Transition" value={manualInputs.transitionFrequency} options={[...INTENSITIES]} onChange={v => updateManual("transitionFrequency", v)} />
                <ManualField label="Indirects" value={manualInputs.indirectsFrequency} options={[...INTENSITIES]} onChange={v => updateManual("indirectsFrequency", v)} />
                <ManualField label="Backdoor" value={manualInputs.backdoorFrequency} options={[...INTENSITIES]} onChange={v => updateManual("backdoorFrequency", v)} />
              </div>
              <Button onClick={runManual} className="w-full rounded-xl font-bold h-10" data-testid="button-run-manual">
                <Zap className="w-3.5 h-3.5 mr-2" /> Run Engine
              </Button>

              {manualResult && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Result</span>
                    <span className="text-sm font-extrabold text-primary">{manualResult.archetype}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-muted-foreground font-semibold uppercase text-[10px]">Scoring</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">{manualResult.internalModel.scoringType}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-muted-foreground font-semibold uppercase text-[10px]">Side</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">{manualResult.internalModel.dominantSide}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-muted-foreground font-semibold uppercase text-[10px]">PnR</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5 text-[10px] leading-tight">{manualResult.internalModel.pnrRoleClassification}</p>
                    </div>
                  </div>

                  {manualResult.keyTraits.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {manualResult.keyTraits.map(t => (
                        <span key={t} className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Flame className="w-3 h-3" /> Top Outputs</p>
                    {[...manualResult.internalModel.isoTraits, ...manualResult.internalModel.pnrTraits].slice(0, 3).map((t, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <TraitBadge type={t.type} />
                        <span className="text-slate-700 dark:text-slate-300 leading-snug">{t.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Shield className="w-3 h-3" /> Defensive Plan</p>
                    {(manualResult.defensivePlan.forzar ?? []).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-orange-500 font-bold shrink-0">→</span>
                        <span className="text-slate-700 dark:text-slate-300 leading-snug">{f}</span>
                      </div>
                    ))}
                    {(manualResult.defensivePlan.concede ?? []).map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-blue-500 font-bold shrink-0">✓</span>
                        <span className="text-slate-700 dark:text-slate-300 leading-snug">Concede: {c}</span>
                      </div>
                    ))}
                    {(manualResult.defensivePlan.defender ?? []).map((d, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-slate-500 font-bold shrink-0">●</span>
                        <span className="text-slate-700 dark:text-slate-300 leading-snug">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
