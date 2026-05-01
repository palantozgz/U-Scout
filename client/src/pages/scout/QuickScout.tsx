import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useUpdatePlayer, usePlayers, generateProfile, clubRowToMotorContext } from "@/lib/mock-data";
import { useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/lib/club-api";
import { cn } from "@/lib/utils";
import { ModuleNav } from "@/pages/core/ModuleNav";

// ── Types ─────────────────────────────────────────────────────────────────────
type Situation = "iso" | "pnr_handler" | "pnr_screener" | "post" | "spot_up" | "transition" | "off_ball";

interface WizardState {
  situation: Situation | null;
  // ISO
  isoDir: "Right" | "Left" | "Balanced" | null;
  isoDec: "Finish" | "Shoot" | "Pass" | null;
  isoAth: 2 | 3 | 5 | null;
  isoCloseout: string | null;
  // PnR Handler
  pnrDir: "Right" | "Left" | "Balanced" | null;
  pnrVsUnder: string | null;
  pnrPriority: string | null;
  // PnR Screener
  screenerAction: "Roll" | "Pop" | "Slip" | null;
  screenerThreat: boolean | null;
  // Post
  postShoulder: "Left Block" | "Right Block" | "Any" | null;
  postZone: string | null;
  postMoves: string[];
  // Spot-up
  spotReaction: string | null;
  spotZone: string | null;
  // Transition
  transRole: string | null;
  transPrimary: string | null;
  // Off-ball
  offBallRole: string | null;
  offBallCut: string | null;
}

const initialState: WizardState = {
  situation: null,
  isoDir: null, isoDec: null, isoAth: null, isoCloseout: null,
  pnrDir: null, pnrVsUnder: null, pnrPriority: null,
  screenerAction: null, screenerThreat: null,
  postShoulder: null, postZone: null, postMoves: [],
  spotReaction: null, spotZone: null,
  transRole: null, transPrimary: null,
  offBallRole: null, offBallCut: null,
};

// ── Map wizard state to PlayerInput fields ────────────────────────────────────
function wizardToInputs(w: WizardState): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  if (!w.situation) return inputs;

  // Frequency — set primary situation to Primary, others to Never
  const freqMap: Record<Situation, string> = {
    iso: "isoFrequency", pnr_handler: "pnrFrequency", pnr_screener: "pnrFrequency",
    post: "postFrequency", spot_up: "isoFrequency", transition: "transitionFrequency", off_ball: "indirectsFrequency",
  };
  const allFreqs = ["isoFrequency","pnrFrequency","postFrequency","transitionFrequency","indirectsFrequency","backdoorFrequency"];
  allFreqs.forEach(f => { inputs[f] = "Never"; });
  inputs[freqMap[w.situation]] = "Primary";

  if (w.situation === "spot_up") {
    inputs["isoFrequency"] = "Rare";
  }

  // PnR role
  if (w.situation === "pnr_handler") inputs["pnrRole"] = "Handler";
  if (w.situation === "pnr_screener") inputs["pnrRole"] = "Screener";

  // ISO
  if (w.isoDir) inputs["isoDominantDirection"] = w.isoDir;
  if (w.isoDec) inputs["isoDecision"] = w.isoDec;
  if (w.isoAth !== null) inputs["athleticism"] = w.isoAth;
  if (w.isoCloseout) inputs["closeoutReaction"] = w.isoCloseout;

  // PnR Handler
  if (w.pnrDir) inputs["pnrDirection"] = w.pnrDir;
  if (w.pnrVsUnder) inputs["pnrReactionVsUnder"] = w.pnrVsUnder;
  if (w.pnrPriority) inputs["pnrScoringPriority"] = w.pnrPriority;

  // PnR Screener
  if (w.screenerAction) inputs["pnrScreenerAction"] = w.screenerAction;

  // Post
  if (w.postShoulder) inputs["postPreferredBlock"] = w.postShoulder;
  if (w.postZone) inputs["postPlayType"] = w.postZone;
  if (w.postMoves.length > 0) inputs["postMoves"] = w.postMoves.map(name => ({ name }));
  if (w.isoAth !== null) inputs["physicalStrength"] = w.isoAth;

  // Spot-up
  if (w.spotReaction) inputs["closeoutReaction"] = w.spotReaction;

  // Transition
  if (w.transRole) inputs["transitionRole"] = w.transRole;

  // Off-ball
  if (w.offBallCut) inputs["backdoorFrequency"] = w.offBallCut === "Backdoor" ? "Primary" : "Secondary";

  return inputs;
}

// ── Option button ─────────────────────────────────────────────────────────────
function Opt({ label, sub, selected, onSelect }: {
  label: string; sub?: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border-2 px-4 py-4 text-left transition-all active:scale-[0.98]",
        selected
          ? "border-primary bg-primary/8"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <p className={cn("text-sm font-black", selected ? "text-primary" : "text-foreground")}>
        {label}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 font-medium">{sub}</p>}
    </button>
  );
}

// ── Multi-select option ───────────────────────────────────────────────────────
function MultiOpt({ label, selected, onToggle }: {
  label: string; selected: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-xl border-2 px-3 py-2.5 text-left transition-all active:scale-[0.98] flex items-center gap-2",
        selected ? "border-primary bg-primary/8" : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "border-primary bg-primary" : "border-border"
      )}>
        {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </div>
      <span className={cn("text-xs font-bold", selected ? "text-primary" : "text-foreground")}>
        {label}
      </span>
    </button>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < current ? "bg-primary" : i === current ? "bg-primary/40" : "bg-border"
          )}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { playerId: string; }

export default function QuickScout({ playerId }: Props) {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  const qc = useQueryClient();
  const updatePlayer = useUpdatePlayer();
  const { data: allPlayers = [] } = usePlayers();
  const { data: clubPayload } = useClub();
  const player = allPlayers.find(p => p.id === playerId);

  const [w, setW] = useState<WizardState>(initialState);
  const [step, setStep] = useState(0); // 0 = situation selection
  const [saving, setSaving] = useState(false);

  const es = locale === "es";
  const zh = locale === "zh";

  // Steps per situation
  const totalSteps = (sit: Situation | null): number => {
    if (!sit) return 1;
    const map: Record<Situation, number> = {
      iso: 5, pnr_handler: 4, pnr_screener: 3, post: 4,
      spot_up: 3, transition: 3, off_ball: 3,
    };
    return map[sit];
  };

  const goNext = () => setStep(s => s + 1);
  const goBack = () => {
    if (step === 0) {
      const from = (window.history.state as any)?.from as string | undefined;
      setLocation(from ?? "/coach/my-scout");
    }
    else setStep(s => s - 1);
  };

  const canAdvance = (): boolean => {
    if (step === 0) return w.situation !== null;
    const sit = w.situation!;
    if (sit === "iso") {
      if (step === 1) return w.isoDir !== null;
      if (step === 2) return w.isoDec !== null;
      if (step === 3) return w.isoAth !== null;
      if (step === 4) return w.isoCloseout !== null;
    }
    if (sit === "pnr_handler") {
      if (step === 1) return w.pnrDir !== null;
      if (step === 2) return w.pnrVsUnder !== null;
      if (step === 3) return w.pnrPriority !== null;
    }
    if (sit === "pnr_screener") {
      if (step === 1) return w.screenerAction !== null;
      if (step === 2) return w.screenerThreat !== null;
    }
    if (sit === "post") {
      if (step === 1) return w.postShoulder !== null;
      if (step === 2) return w.postZone !== null;
      if (step === 3) return w.postMoves.length > 0;
    }
    if (sit === "spot_up") {
      if (step === 1) return w.spotReaction !== null;
      if (step === 2) return w.spotZone !== null;
    }
    if (sit === "transition") {
      if (step === 1) return w.transRole !== null;
      if (step === 2) return w.transPrimary !== null;
    }
    if (sit === "off_ball") {
      if (step === 1) return w.offBallRole !== null;
      if (step === 2) return w.offBallCut !== null;
    }
    return true;
  };

  const isLastStep = step === totalSteps(w.situation) - 1;

  const handleFinish = async () => {
    setSaving(true);
    const wizardFields = wizardToInputs(w);
    try {
      // Merge wizard fields into existing inputs
      const existingInputs = (player?.inputs as Record<string, unknown>) ?? {};
      const mergedInputs = { ...existingInputs, ...wizardFields };

      // Run the motor client-side to generate defensivePlan, internalModel, archetype
      const motorCtx = clubRowToMotorContext(clubPayload?.club);
      const profile = generateProfile(mergedInputs as any, undefined, motorCtx);

      // Save everything — same shape as PlayerEditor
      await updatePlayer.mutateAsync({
        id: playerId,
        updates: {
          inputs: mergedInputs,
          internalModel: profile.internalModel,
          defensivePlan: profile.defensivePlan,
          archetype: profile.archetype,
          keyTraits: profile.keyTraits,
        } as any,
      });
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
      setLocation(`/coach/player/${playerId}`);
    } catch (e) {
      console.error("QuickScout save error:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step content ────────────────────────────────────────────────────────────
  const renderStep = () => {
    // Step 0: Situation
    if (step === 0) {
      const situations: { value: Situation; label: string; sub: string }[] = [
        { value: "iso", label: "ISO", sub: es ? "Aislamiento con balón" : zh ? "单打" : "Ball isolation" },
        { value: "pnr_handler", label: "PnR Handler", sub: es ? "Maneja el bloqueo directo" : zh ? "挡拆持球人" : "Drives off the pick" },
        { value: "pnr_screener", label: "PnR Screener", sub: es ? "Pone las pantallas" : zh ? "挡拆掩护人" : "Sets the screens" },
        { value: "post", label: es ? "Poste" : zh ? "低位" : "Post", sub: es ? "Juego de espaldas al aro" : zh ? "背身进攻" : "Back to basket" },
        { value: "spot_up", label: "Spot-up", sub: es ? "Tiradora en posición" : zh ? "定点投手" : "Catch & shoot" },
        { value: "transition", label: es ? "Transición" : zh ? "快攻" : "Transition", sub: es ? "Amenaza en juego rápido" : zh ? "快攻威胁" : "Fast break threat" },
        { value: "off_ball", label: es ? "Sin balón" : zh ? "无球跑动" : "Off-ball", sub: es ? "Cortadora / pantallera sin balón" : zh ? "无球切入/掩护" : "Cutter / off-ball screener" },
      ];
      return (
        <div className="space-y-2">
          {situations.map(s => (
            <Opt
              key={s.value}
              label={s.label}
              sub={s.sub}
              selected={w.situation === s.value}
              onSelect={() => setW(prev => ({ ...prev, situation: s.value }))}
            />
          ))}
        </div>
      );
    }

    const sit = w.situation!;

    // ── ISO steps ──────────────────────────────────────────────────────────────
    if (sit === "iso") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "Right" as const, label: es ? "Derecha" : zh ? "右手" : "Right", sub: es ? "Domina hacia su derecha" : zh ? "主导右侧" : "Favors her right" },
            { value: "Left" as const, label: es ? "Izquierda" : zh ? "左手" : "Left", sub: es ? "Domina hacia su izquierda" : zh ? "主导左侧" : "Favors her left" },
            { value: "Balanced" as const, label: es ? "Ambas" : zh ? "双手均衡" : "Both sides", sub: es ? "Cómoda en los dos lados" : zh ? "两侧均衡" : "Comfortable both ways" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.isoDir === o.value}
              onSelect={() => setW(p => ({ ...p, isoDir: o.value }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: "Finish" as const, label: es ? "Finalizadora" : zh ? "终结型" : "Finisher", sub: es ? "Busca el aro" : zh ? "寻求上篮" : "Attacks the rim" },
            { value: "Shoot" as const, label: es ? "Tiradora" : zh ? "投手型" : "Shooter", sub: es ? "Prefiere el tiro" : zh ? "偏好投篮" : "Prefers the jumper" },
            { value: "Pass" as const, label: es ? "Creadora" : zh ? "组织型" : "Creator", sub: es ? "Busca a compañeras" : zh ? "寻求传球" : "Looks to pass out" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.isoDec === o.value}
              onSelect={() => setW(p => ({ ...p, isoDec: o.value }))} />
          ))}
        </div>
      );
      if (step === 3) return (
        <div className="space-y-2">
          {[
            { value: 2 as const, label: es ? "Baja / Media" : zh ? "低/中" : "Low / Medium", sub: es ? "Sin explosividad especial" : zh ? "无特殊爆发力" : "Below average athleticism" },
            { value: 3 as const, label: es ? "Alta" : zh ? "高" : "High", sub: es ? "Atleta sólida" : zh ? "运动能力强" : "Solid athlete" },
            { value: 5 as const, label: es ? "Élite" : zh ? "顶级" : "Elite", sub: es ? "Explosividad diferencial" : zh ? "爆发力顶级" : "Explosive, elite level" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.isoAth === o.value}
              onSelect={() => setW(p => ({ ...p, isoAth: o.value }))} />
          ))}
        </div>
      );
      if (step === 4) return (
        <div className="space-y-2">
          {[
            { value: "Catch & Shoot", label: "Catch & Shoot", sub: es ? "Tira nada más recibir" : zh ? "接球即投" : "Shoots immediately on catch" },
            { value: "Attack Baseline", label: es ? "Ataca línea de fondo" : zh ? "底线突破" : "Attack Baseline", sub: es ? "Va por la línea de fondo" : zh ? "沿底线突破" : "Goes baseline" },
            { value: "Attack Middle", label: es ? "Ataca por el medio" : zh ? "中路突破" : "Attack Middle", sub: es ? "Corta hacia el centro" : zh ? "向中路切入" : "Cuts to the middle" },
            { value: "Extra Pass", label: es ? "Pasa" : zh ? "传球" : "Extra Pass", sub: es ? "Busca la circulación" : zh ? "寻求传球" : "Kicks it out" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.isoCloseout === o.value}
              onSelect={() => setW(p => ({ ...p, isoCloseout: o.value }))} />
          ))}
        </div>
      );
    }

    // ── PnR Handler steps ─────────────────────────────────────────────────────
    if (sit === "pnr_handler") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "Right", label: es ? "Derecha" : zh ? "右侧" : "Right", sub: es ? "Pide la pantalla hacia su derecha" : zh ? "向右侧要挡拆" : "Screens on her right" },
            { value: "Left", label: es ? "Izquierda" : zh ? "左侧" : "Left", sub: es ? "Pide la pantalla hacia su izquierda" : zh ? "向左侧要挡拆" : "Screens on her left" },
            { value: "Balanced", label: es ? "Ambas" : zh ? "双侧" : "Both", sub: es ? "Usa los dos lados" : zh ? "两侧均用" : "Uses both sides" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.pnrDir === o.value}
              onSelect={() => setW(p => ({ ...p, pnrDir: o.value as any }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: "Pull-up 3", label: es ? "Tira el triple" : zh ? "接球三分" : "Shoots the 3", sub: es ? "Aprovecha si la defensa pasa por abajo" : zh ? "防守低位通过时直接投三分" : "Takes the pull-up 3" },
            { value: "Re-screen", label: es ? "Vuelve a pedir pantalla" : zh ? "重新要挡拆" : "Re-screens", sub: es ? "No tira, busca mejor ángulo" : zh ? "不投球，寻求更好角度" : "Doesn't shoot, resets" },
            { value: "Reject / Attack", label: es ? "Rechaza y ataca" : zh ? "拒绝掩护突破" : "Rejects & attacks", sub: es ? "Ignora la pantalla y va directa" : zh ? "忽视掩护直接突破" : "Ignores screen, drives" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.pnrVsUnder === o.value}
              onSelect={() => setW(p => ({ ...p, pnrVsUnder: o.value }))} />
          ))}
        </div>
      );
      if (step === 3) return (
        <div className="space-y-2">
          {[
            { value: "Score First", label: es ? "Primero anotar" : zh ? "优先得分" : "Score first", sub: es ? "Busca el tiro o la penetración" : zh ? "寻求投篮或突破" : "Looks for her shot" },
            { value: "Pass First", label: es ? "Primero distribuir" : zh ? "优先传球" : "Pass first", sub: es ? "Busca al rodador o al abierto" : zh ? "寻找跑位队友或空位" : "Finds the roll or open player" },
            { value: "Balanced", label: es ? "Equilibrada" : zh ? "均衡型" : "Balanced", sub: es ? "Lee la defensa y decide" : zh ? "根据防守判断" : "Reads the defense" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.pnrPriority === o.value}
              onSelect={() => setW(p => ({ ...p, pnrPriority: o.value }))} />
          ))}
        </div>
      );
    }

    // ── PnR Screener steps ────────────────────────────────────────────────────
    if (sit === "pnr_screener") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "Roll" as const, label: "Roll", sub: es ? "Corta directo al aro" : zh ? "直接切入篮下" : "Cuts hard to the rim" },
            { value: "Pop" as const, label: "Pop", sub: es ? "Sale a la línea de 3" : zh ? "弹出至三分线" : "Pops to the 3-point line" },
            { value: "Slip" as const, label: "Slip", sub: es ? "Corta antes de completar la pantalla" : zh ? "提前切入" : "Slips before completing the screen" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.screenerAction === o.value}
              onSelect={() => setW(p => ({ ...p, screenerAction: o.value }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: true, label: es ? "Amenaza real" : zh ? "真实威胁" : "Real threat", sub: es ? "Puede anotar sola, hay que seguirla" : zh ? "可以独立得分，需要跟防" : "Can score, must be followed" },
            { value: false, label: es ? "Solo distracción" : zh ? "仅作干扰" : "Distraction only", sub: es ? "Su rol es liberar a la manejadora" : zh ? "主要作用是为持球人创造空间" : "Her role is to free the handler" },
          ].map(o => (
            <Opt key={String(o.value)} label={o.label} sub={o.sub} selected={w.screenerThreat === o.value}
              onSelect={() => setW(p => ({ ...p, screenerThreat: o.value }))} />
          ))}
        </div>
      );
    }

    // ── Post steps ────────────────────────────────────────────────────────────
    if (sit === "post") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "Left Block" as const, label: es ? "Bloque izquierdo" : zh ? "左侧低位" : "Left block", sub: es ? "Se sella a la izquierda del aro" : zh ? "在篮下左侧建立位置" : "Seals on the left side" },
            { value: "Right Block" as const, label: es ? "Bloque derecho" : zh ? "右侧低位" : "Right block", sub: es ? "Se sella a la derecha del aro" : zh ? "在篮下右侧建立位置" : "Seals on the right side" },
            { value: "Any" as const, label: es ? "Cualquier lado" : zh ? "两侧均可" : "Either side", sub: es ? "Cómoda en ambos bloques" : zh ? "两侧均可" : "Comfortable on both sides" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.postShoulder === o.value}
              onSelect={() => setW(p => ({ ...p, postShoulder: o.value }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: "Back to Basket", label: es ? "Espalda al aro" : zh ? "背身" : "Back to basket", sub: es ? "Juego tradicional de poste bajo" : zh ? "传统低位背身" : "Classic post-up game" },
            { value: "Face-Up", label: es ? "Cara al aro" : zh ? "面框" : "Face-up", sub: es ? "Se gira y ataca de cara" : zh ? "转身面对篮筐进攻" : "Turns and attacks face-up" },
            { value: "Mixed", label: es ? "Mixto" : zh ? "混合型" : "Mixed", sub: es ? "Combina las dos opciones" : zh ? "两种方式结合" : "Uses both approaches" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.postZone === o.value}
              onSelect={() => setW(p => ({ ...p, postZone: o.value }))} />
          ))}
        </div>
      );
      if (step === 3) {
        const moves = [
          "Drop Step (Baseline)", "Drop Step (Middle)", "Jump Hook",
          "Spin Move (Baseline)", "Fadeaway", "Baby Hook",
          "Back Down", "Cross Hook",
        ];
        return (
          <div className="grid grid-cols-2 gap-2">
            {moves.map(m => (
              <MultiOpt key={m} label={m} selected={w.postMoves.includes(m)}
                onToggle={() => setW(p => ({
                  ...p,
                  postMoves: p.postMoves.includes(m)
                    ? p.postMoves.filter(x => x !== m)
                    : p.postMoves.length < 3 ? [...p.postMoves, m] : p.postMoves,
                }))} />
            ))}
            {w.postMoves.length >= 3 && (
              <p className="col-span-2 text-[11px] text-muted-foreground text-center">
                {es ? "Máx. 3 movimientos" : zh ? "最多3个动作" : "Max 3 moves"}
              </p>
            )}
          </div>
        );
      }
    }

    // ── Spot-up steps ─────────────────────────────────────────────────────────
    if (sit === "spot_up") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "Catch & Shoot", label: "Catch & Shoot", sub: es ? "Tira nada más recibir" : zh ? "接球即投" : "Shoots on catch" },
            { value: "Attack Baseline", label: es ? "Ataca línea de fondo" : zh ? "底线突破" : "Attack baseline", sub: es ? "Si le cierran, va por abajo" : zh ? "被封盖时走底线" : "Drives baseline on closeout" },
            { value: "Attack Middle", label: es ? "Ataca por el medio" : zh ? "中路突破" : "Attack middle", sub: es ? "Si le cierran, corta al centro" : zh ? "被封盖时中路切入" : "Drives middle on closeout" },
            { value: "Extra Pass", label: es ? "Pasa" : zh ? "传球" : "Extra pass", sub: es ? "Busca a la abierta" : zh ? "寻找空位队友" : "Finds the open player" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.spotReaction === o.value}
              onSelect={() => setW(p => ({ ...p, spotReaction: o.value }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: "corner", label: es ? "Esquinas" : zh ? "底角" : "Corners", sub: es ? "Principalmente en esquinas" : zh ? "主要在底角" : "Mainly in the corners" },
            { value: "wing", label: es ? "Alas" : zh ? "侧翼" : "Wings", sub: es ? "Principalmente en las alas" : zh ? "主要在侧翼" : "Mainly on the wings" },
            { value: "both", label: es ? "Toda la línea" : zh ? "全三分线" : "Full arc", sub: es ? "Amenaza en cualquier posición" : zh ? "全线威胁" : "Threat anywhere on the arc" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.spotZone === o.value}
              onSelect={() => setW(p => ({ ...p, spotZone: o.value }))} />
          ))}
        </div>
      );
    }

    // ── Transition steps ──────────────────────────────────────────────────────
    if (sit === "transition") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "Pusher", label: "Pusher", sub: es ? "Avanza con el balón" : zh ? "持球推进" : "Pushes the ball up court" },
            { value: "Rim Runner", label: "Rim Runner", sub: es ? "Corre directo al aro" : zh ? "直奔篮筐" : "Sprints to the rim" },
            { value: "Trailer", label: "Trailer", sub: es ? "Viene detrás buscando el triple" : zh ? "跟进寻求三分" : "Trails for the three" },
            { value: "Outlet", label: "Outlet", sub: es ? "Inicia la transición con el pase" : zh ? "通过传球发动快攻" : "Initiates with the outlet pass" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.transRole === o.value}
              onSelect={() => setW(p => ({ ...p, transRole: o.value }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: "finish", label: es ? "Finaliza" : zh ? "终结" : "Finishes", sub: es ? "Busca el layup o el tiro" : zh ? "寻求上篮或投篮" : "Looks for the layup or shot" },
            { value: "find", label: es ? "Busca a la 4/5" : zh ? "寻找内线" : "Finds 4/5", sub: es ? "Pasa al interior" : zh ? "传给内线球员" : "Passes to the big" },
            { value: "stabilize", label: es ? "Estabiliza" : zh ? "稳定进攻" : "Stabilizes", sub: es ? "Para el juego y organiza" : zh ? "停止快攻，重新组织" : "Stops the break, sets up" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.transPrimary === o.value}
              onSelect={() => setW(p => ({ ...p, transPrimary: o.value }))} />
          ))}
        </div>
      );
    }

    // ── Off-ball steps ────────────────────────────────────────────────────────
    if (sit === "off_ball") {
      if (step === 1) return (
        <div className="space-y-2">
          {[
            { value: "cutter", label: es ? "Cortadora" : zh ? "切入型" : "Cutter", sub: es ? "Amenaza con cortes sin balón" : zh ? "无球切入威胁" : "Cuts without the ball" },
            { value: "screener", label: es ? "Pantallera sin balón" : zh ? "无球掩护" : "Off-ball screener", sub: es ? "Pone pantallas para liberación" : zh ? "无球掩护释放队友" : "Sets screens to free teammates" },
            { value: "spot", label: es ? "Estática" : zh ? "定点站位" : "Static spot-up", sub: es ? "Se queda en posición esperando" : zh ? "定点等球" : "Stands in position waiting" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.offBallRole === o.value}
              onSelect={() => setW(p => ({ ...p, offBallRole: o.value }))} />
          ))}
        </div>
      );
      if (step === 2) return (
        <div className="space-y-2">
          {[
            { value: "Backdoor", label: "Backdoor", sub: es ? "Corta por la espalda de la defensa" : zh ? "背后切入" : "Cuts behind the defender" },
            { value: "Flash", label: "Flash", sub: es ? "Corta al poste alto o al codo" : zh ? "切至高位或肘区" : "Flashes to high post or elbow" },
            { value: "Curl", label: "Curl", sub: es ? "Enrolla la pantalla buscando el tiro" : zh ? "绕过掩护寻求投篮" : "Curls off screens for the shot" },
            { value: "Basket", label: es ? "Canasta directa" : zh ? "直接切篮" : "Basket cut", sub: es ? "Corta directo al aro" : zh ? "直接切向篮下" : "Cuts straight to the basket" },
          ].map(o => (
            <Opt key={o.value} label={o.label} sub={o.sub} selected={w.offBallCut === o.value}
              onSelect={() => setW(p => ({ ...p, offBallCut: o.value }))} />
          ))}
        </div>
      );
    }

    return null;
  };

  // Step labels
  const stepLabels: Record<Situation, string[]> = {
    iso: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Dirección dominante" : zh ? "主导方向" : "Dominant direction",
      es ? "Decisión con balón" : zh ? "持球决策" : "Ball decision",
      es ? "Nivel atlético" : zh ? "运动能力" : "Athletic level",
      es ? "Reacción al cierre" : zh ? "对位封盖反应" : "Closeout reaction",
    ],
    pnr_handler: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Dirección del pick" : zh ? "挡拆方向" : "Pick direction",
      es ? "Defensa por debajo" : zh ? "对防守的反应" : "Vs. under coverage",
      es ? "Prioridad ofensiva" : zh ? "进攻优先级" : "Offensive priority",
    ],
    pnr_screener: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Acción tras la pantalla" : zh ? "掩护后动作" : "After screen action",
      es ? "Nivel de amenaza" : zh ? "威胁等级" : "Threat level",
    ],
    post: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Bloque preferido" : zh ? "偏好位置" : "Preferred block",
      es ? "Tipo de juego" : zh ? "进攻类型" : "Play type",
      es ? "Movimientos (máx. 3)" : zh ? "动作（最多3个）" : "Moves (max 3)",
    ],
    spot_up: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Reacción al cierre" : zh ? "封盖反应" : "Closeout reaction",
      es ? "Zona de amenaza" : zh ? "威胁区域" : "Threat zone",
    ],
    transition: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Rol en transición" : zh ? "快攻角色" : "Transition role",
      es ? "Al llegar al aro" : zh ? "到达篮下时" : "At the rim",
    ],
    off_ball: [
      es ? "Situación principal" : zh ? "主要方式" : "Main situation",
      es ? "Tipo de movimiento" : zh ? "无球动作类型" : "Movement type",
      es ? "Tipo de corte" : zh ? "切入类型" : "Cut type",
    ],
  };

  const currentLabel = w.situation
    ? stepLabels[w.situation][step]
    : (es ? "Situación principal" : zh ? "主要方式" : "Main situation");

  const total = totalSteps(w.situation);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={goBack} className="-ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-foreground tracking-tight truncate">
            {player?.name || (es ? "Nueva ficha" : zh ? "新建档案" : "New profile")}
          </h1>
          <p className="text-[10px] text-muted-foreground font-semibold">
            {es ? "Inicio rápido" : zh ? "快速开始" : "Quick start"}
            {w.situation && ` · ${stepLabels[w.situation][step]}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLocation(`/coach/player/${playerId}`)}
          className="text-[11px] font-bold text-muted-foreground hover:text-foreground whitespace-nowrap"
        >
          {es ? "Editor completo →" : zh ? "完整编辑器 →" : "Full editor →"}
        </button>
      </header>

      <main className="flex-1 flex flex-col px-4 py-5 max-w-md mx-auto w-full gap-5">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
              {es ? `Paso ${step + 1} de ${total}` : zh ? `第${step + 1}步，共${total}步` : `Step ${step + 1} of ${total}`}
            </p>
          </div>
          <Progress current={step} total={total} />
          <p className="text-lg font-black text-foreground leading-snug">
            {currentLabel}
          </p>
        </div>

        {/* Step content */}
        <div className="flex-1">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={goBack}>
              {es ? "← Atrás" : zh ? "← 返回" : "← Back"}
            </Button>
          )}
          {isLastStep ? (
            <Button
              className="flex-1 h-12 rounded-xl font-black text-sm"
              disabled={!canAdvance() || saving}
              onClick={handleFinish}
            >
              {saving
                ? (es ? "Guardando..." : zh ? "保存中..." : "Saving...")
                : (es ? "✓ Ir al editor" : zh ? "✓ 打开编辑器" : "✓ Open editor")}
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 rounded-xl font-black text-sm"
              disabled={!canAdvance()}
              onClick={goNext}
            >
              {es ? "Siguiente →" : zh ? "下一步 →" : "Next →"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
