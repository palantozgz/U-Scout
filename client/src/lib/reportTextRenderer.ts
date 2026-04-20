/**
 * Capa 2 — Renderiza MotorV4Output a texto legible por locale/género.
 * No usa i18n del proyecto: strings embebidas por idioma.
 */

import type {
  MotorV4Output,
  DefenseInstruction,
  AlertCandidate,
  RankedSituation,
} from "./motor-v4";
import type { EnrichedInputs } from "./motor-v2.1";

function joinListEN(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function spotZonesPhraseEN(inputs: EnrichedInputs): string {
  const z = inputs.spotZones;
  if (z) {
    const parts: string[] = [];
    if (z.cornerLeft || z.cornerRight) parts.push("the corners");
    if (z.wing45Left || z.wing45Right) parts.push("the 45-degree spots");
    if (z.top) parts.push("the top of the key");
    if (parts.length === 0) return "the perimeter";
    return joinListEN(parts);
  }
  if (inputs.spotZone === "corner") return "the corners";
  if (inputs.spotZone === "wing") return "the wings";
  if (inputs.spotZone === "top") return "the top of the key";
  return "the perimeter";
}

function cornerFocusEN(inputs: EnrichedInputs): string {
  const z = inputs.spotZones;
  if (z?.cornerLeft && z?.cornerRight) return "the corners";
  if (z?.cornerLeft && !z.cornerRight) return "the left corner";
  if (z?.cornerRight && !z.cornerLeft) return "the right corner";
  if (inputs.spotZone === "corner") return "the corners";
  return "the corners";
}

function joinListES(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, y ${parts[parts.length - 1]}`;
}

function spotZonesPhraseES(inputs: EnrichedInputs): string {
  const z = inputs.spotZones;
  if (z) {
    const parts: string[] = [];
    if (z.cornerLeft || z.cornerRight) parts.push("las esquinas");
    if (z.wing45Left || z.wing45Right) parts.push("los 45°");
    if (z.top) parts.push("la parte alta");
    if (parts.length === 0) return "el perímetro";
    return joinListES(parts);
  }
  if (inputs.spotZone === "corner") return "las esquinas";
  if (inputs.spotZone === "wing") return "los costados";
  if (inputs.spotZone === "top") return "la parte alta";
  return "el perímetro";
}

function cornerFocusES(inputs: EnrichedInputs): string {
  const z = inputs.spotZones;
  if (z?.cornerLeft && z?.cornerRight) return "las esquinas";
  if (z?.cornerLeft && !z.cornerRight) return "la esquina izquierda";
  if (z?.cornerRight && !z.cornerLeft) return "la esquina derecha";
  return "las esquinas";
}

function joinListZH(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}和${parts[1]}`;
  return `${parts.slice(0, -1).join("、")}和${parts[parts.length - 1]}`;
}

function spotZonesPhraseZH(inputs: EnrichedInputs): string {
  const z = inputs.spotZones;
  if (z) {
    const parts: string[] = [];
    if (z.cornerLeft || z.cornerRight) parts.push("底角");
    if (z.wing45Left || z.wing45Right) parts.push("45度角");
    if (z.top) parts.push("弧顶");
    if (parts.length === 0) return "外线";
    return joinListZH(parts);
  }
  if (inputs.spotZone === "corner") return "底角区域";
  if (inputs.spotZone === "wing") return "两翼";
  if (inputs.spotZone === "top") return "弧顶";
  return "外线";
}

function cornerFocusZH(inputs: EnrichedInputs): string {
  const z = inputs.spotZones;
  if (z?.cornerLeft && z?.cornerRight) return "底角";
  if (z?.cornerLeft && !z.cornerRight) return "左侧底角";
  if (z?.cornerRight && !z.cornerLeft) return "右侧底角";
  return "底角";
}

export type Locale = "en" | "es" | "zh";
export type Gender = "f" | "m" | "n";

export interface RenderContext {
  locale: Locale;
  gender: Gender;
}

export interface RenderedSituation {
  id: string;
  score: number;
  tier: "primary" | "secondary" | "situational";
  label: string;
  description: string;
  alternatives: { description: string; score: number; id: string }[];
}

export interface RenderedInstruction {
  type: "deny" | "force" | "allow";
  label: string;
  instruction: string;
  situationRef?: string;
  alternatives: { instruction: string; score: number }[];
}

export interface RenderedAlert {
  text: string;
  triggerCue: string;
  mechanismType: string;
}

export interface RenderedIdentity {
  archetypeLabel: string;
  tagline: string;
  dangerLevel: 1 | 2 | 3 | 4 | 5;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  archetypeAlternatives: { label: string; score: number }[];
}

export interface RenderedReport {
  identity: RenderedIdentity;
  situations: RenderedSituation[];
  defense: {
    deny: RenderedInstruction;
    force: RenderedInstruction;
    allow: RenderedInstruction;
  };
  alerts: RenderedAlert[];
}

type GenderedWord =
  | "player"
  | "dominant"
  | "dangerous"
  | "effective"
  | "primary"
  | "scorer"
  | "creator";

const genderES_f: Record<GenderedWord, string> = {
  player: "jugadora",
  dominant: "dominante",
  dangerous: "peligrosa",
  effective: "efectiva",
  primary: "primaria",
  scorer: "anotadora",
  creator: "creadora",
};
const genderES_m: Record<GenderedWord, string> = {
  player: "jugador",
  dominant: "dominante",
  dangerous: "peligroso",
  effective: "efectivo",
  primary: "primario",
  scorer: "anotador",
  creator: "creador",
};
const genderES_n: Record<GenderedWord, string> = {
  player: "jugador/a",
  dominant: "dominante",
  dangerous: "peligroso/a",
  effective: "efectivo/a",
  primary: "primario/a",
  scorer: "anotador/a",
  creator: "creador/a",
};
const genderEN: Record<GenderedWord, string> = {
  player: "player",
  dominant: "dominant",
  dangerous: "dangerous",
  effective: "effective",
  primary: "primary",
  scorer: "scorer",
  creator: "creator",
};
const genderZH: Record<GenderedWord, string> = {
  player: "球员",
  dominant: "主导",
  dangerous: "危险",
  effective: "有效",
  primary: "主要",
  scorer: "得分手",
  creator: "持球组织",
};

function g(word: GenderedWord, gender: Gender, locale: Locale): string {
  if (locale === "en") return genderEN[word];
  if (locale === "zh") return genderZH[word];
  if (gender === "f") return genderES_f[word];
  if (gender === "m") return genderES_m[word];
  return genderES_n[word];
}

function renderIdentity(
  motorOutput: MotorV4Output,
  ctx: RenderContext,
): RenderedIdentity {
  const { inputs, identity } = motorOutput;
  const { locale, gender } = ctx;

  const archetypeLabels: Record<string, Record<Locale, string>> = {
    archetype_iso_scorer: {
      en: "ISO Scorer",
      es: `${g("scorer", gender, "es")} ISO`,
      zh: "ISO得分手",
    },
    archetype_pnr_orchestrator: {
      en: "PnR Orchestrator",
      es: "Orquestador PnR",
      zh: "PnR组织者",
    },
    archetype_post_scorer: {
      en: "Post Scorer",
      es: `${g("scorer", gender, "es")} en poste`,
      zh: "低位得分手",
    },
    archetype_stretch_big: {
      en: "Stretch Big",
      es: "Interior espaciador",
      zh: "拉开大个",
    },
    archetype_playmaker: {
      en: "Playmaker",
      es: `${g("creator", gender, "es")} de juego`,
      zh: "组织核心",
    },
    archetype_spot_up_shooter: {
      en: "Spot-up Shooter",
      es: "Tirador en estático",
      zh: "定点射手",
    },
    archetype_transition_threat: {
      en: "Transition Threat",
      es: "Amenaza en transición",
      zh: "快攻威胁",
    },
    archetype_role_player: {
      en: "Role Player",
      es: `${g("player", gender, "es")} de rol`,
      zh: "角色球员",
    },
    archetype_versatile: {
      en: "Versatile",
      es: "Versátil",
      zh: "全能型",
    },
  };

  const archetypeLabel =
    archetypeLabels[identity.archetypeKey]?.[locale] ?? identity.archetypeKey;

  const tagline = renderTagline(inputs, identity.archetypeKey, ctx);

  const archetypeAlternatives = identity.archetypeCandidates.map((c) => ({
    label: archetypeLabels[c.key]?.[locale] ?? c.key,
    score: c.score,
  }));

  return {
    archetypeLabel,
    tagline,
    dangerLevel: identity.dangerLevel,
    difficultyLevel: identity.difficultyLevel,
    archetypeAlternatives,
  };
}

function renderTagline(
  inputs: EnrichedInputs,
  archetypeKey: string,
  ctx: RenderContext,
): string {
  const { locale, gender } = ctx;

  if (locale === "en") {
    if (archetypeKey === "archetype_iso_scorer") {
      if (inputs.selfCreation === "high" && (inputs.ath ?? 0) <= 2)
        return "Creates separation through timing, not athleticism.";
      if (inputs.isoDir === "R")
        return "Dangerous off the right hand — creates pull-up and drive from the same move.";
      if (inputs.isoDir === "L")
        return "Left-hand dominant — forces you to shade a side most defenders avoid.";
      return "Can create a quality shot from anywhere on the floor.";
    }
    if (archetypeKey === "archetype_pnr_orchestrator")
      return "Reads the defense off the screen — makes the right play every time.";
    if (archetypeKey === "archetype_post_scorer") {
      if (
        inputs.postMoves?.includes("fade") &&
        inputs.postMoves?.includes("hook")
      )
        return "Has both the fadeaway and the hook — two moves off the same setup.";
      return "Dangerous once they establish deep post position.";
    }
    if (archetypeKey === "archetype_stretch_big")
      return "Forces the defense out — creates driving lanes for teammates.";
    if (archetypeKey === "archetype_spot_up_shooter")
      return "Punishes any closeout mistake immediately.";
    if (archetypeKey === "archetype_transition_threat")
      return "Most dangerous in open court — limits your transition recovery.";
    return "Adapts to whatever the defense gives.";
  }

  if (locale === "es") {
    if (archetypeKey === "archetype_iso_scorer") {
      if (inputs.selfCreation === "high" && (inputs.ath ?? 0) <= 2)
        return `Crea separación con timing, no con atletismo.`;
      if (inputs.isoDir === "R")
        return `Peligrosa/o por la derecha — genera pull-up y penetración desde el mismo movimiento.`;
      if (inputs.isoDir === "L")
        return `Dominante con la izquierda — te obliga a cargarte a un lado que casi nadie defiende bien.`;
      return `Puede crear un buen tiro desde cualquier punto de la pista.`;
    }
    if (archetypeKey === "archetype_pnr_orchestrator")
      return `Lee la defensa en el bloqueo — siempre toma la decisión correcta.`;
    if (archetypeKey === "archetype_post_scorer") {
      if (
        inputs.postMoves?.includes("fade") &&
        inputs.postMoves?.includes("hook")
      )
        return `Tiene fadeaway y gancho — dos movimientos desde la misma posición.`;
      const d = g("dangerous", gender, "es");
      return `${d.charAt(0).toUpperCase() + d.slice(1)} cuando establece posición en el poste bajo.`;
    }
    if (archetypeKey === "archetype_stretch_big")
      return `Obliga a salir a la defensa — abre líneas de penetración para sus compañeros.`;
    if (archetypeKey === "archetype_spot_up_shooter")
      return `Castiga cualquier cierre mal ejecutado al instante.`;
    if (archetypeKey === "archetype_transition_threat")
      return `Más ${g("dangerous", gender, "es")} en campo abierto — limita tu recuperación defensiva.`;
    return `Se adapta a lo que le da la defensa.`;
  }

  if (locale === "zh") {
    if (archetypeKey === "archetype_iso_scorer") {
      if (inputs.isoDir === "R") return "右手突破为主，单打能力极强。";
      if (inputs.isoDir === "L") return "左手主导，迫使防守者做出不习惯的判断。";
      return "全场任意位置均可自主创造高质量投篮机会。";
    }
    if (archetypeKey === "archetype_pnr_orchestrator")
      return "挡拆后善于读防守，决策准确。";
    if (archetypeKey === "archetype_post_scorer")
      return "低位建立位置后极具威胁。";
    if (archetypeKey === "archetype_stretch_big")
      return "拉开空间，为队友创造突破路线。";
    if (archetypeKey === "archetype_spot_up_shooter")
      return "定点出手快，任何防守失误都会被即刻惩罚。";
    if (archetypeKey === "archetype_transition_threat")
      return "快攻中威胁最大，限制防守回追时间。";
    return "根据防守变化随机应变。";
  }

  return "";
}

function renderSituations(
  motorOutput: MotorV4Output,
  ctx: RenderContext,
): RenderedSituation[] {
  const { situations } = motorOutput;

  return situations
    .filter((s) => s.score > 0)
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      score: s.score,
      tier: s.tier,
      label: renderSituationLabel(s.id, ctx.locale),
      description: renderSituationDescriptionLine(s.id, motorOutput.inputs, ctx),
      alternatives: [],
    }));
}

function renderSituationLabel(id: string, locale: Locale): string {
  const labels: Record<string, Record<Locale, string>> = {
    iso_right: {
      en: "ISO right hand",
      es: "ISO mano derecha",
      zh: "右手单打",
    },
    iso_left: {
      en: "ISO left hand",
      es: "ISO mano izquierda",
      zh: "左手单打",
    },
    iso_both: {
      en: "ISO both hands",
      es: "ISO ambas manos",
      zh: "双手单打",
    },
    pnr_ball: {
      en: "PnR ball-handler",
      es: "PnR con balón",
      zh: "持球挡拆",
    },
    pnr_screener: {
      en: "PnR screener",
      es: "Bloqueador en PnR",
      zh: "挡拆掩护者",
    },
    post_right: {
      en: "Post right block",
      es: "Poste bloque derecho",
      zh: "右侧低位",
    },
    post_left: {
      en: "Post left block",
      es: "Poste bloque izquierdo",
      zh: "左侧低位",
    },
    post_high: { en: "High post", es: "Poste alto", zh: "高位" },
    catch_shoot: {
      en: "Catch & shoot",
      es: "Catch & shoot",
      zh: "接球即投",
    },
    transition: { en: "Transition", es: "Transición", zh: "快攻" },
    off_ball: { en: "Off-ball", es: "Sin balón", zh: "无球跑动" },
    dho: { en: "DHO", es: "DHO", zh: "手递手" },
    cut: { en: "Cut", es: "Corte", zh: "切入" },
    floater: { en: "Floater", es: "Floater", zh: "抛投" },
    oreb: {
      en: "Offensive rebound",
      es: "Rebote ofensivo",
      zh: "进攻篮板",
    },
    misc: { en: "Other", es: "Otro", zh: "其他" },
  };
  return labels[id]?.[locale] ?? id;
}

/** Same text as `renderReport` uses for each situation card’s description. */
export function renderSituationDescription(
  sit: RankedSituation,
  ctx: RenderContext,
  inputs: EnrichedInputs,
): string {
  return renderSituationDescriptionLine(sit.id, inputs, ctx);
}

function renderSituationDescriptionLine(
  id: string,
  inputs: EnrichedInputs,
  ctx: RenderContext,
): string {
  const { locale } = ctx;
  if (locale === "en") return renderSituationDescriptionEN(id, inputs);
  if (locale === "es")
    return renderSituationDescriptionES(id, inputs, ctx.gender);
  if (locale === "zh") return renderSituationDescriptionZH(id, inputs);
  return "";
}

function renderSituationDescriptionEN(id: string, inputs: EnrichedInputs): string {
  switch (id) {
    case "iso_right":
    case "iso_left": {
      const side = id === "iso_right" ? "right" : "left";
      const dec =
        inputs.isoDec === "S"
          ? "pull-up shot"
          : inputs.isoDec === "F"
            ? "drive to the rim"
            : "read and distribute";
      const contact =
        inputs.contactFinish === "seeks" ? " Actively draws contact." : "";
      return `Initiates ISO from the ${side} side. Primary decision: ${dec}.${contact}`;
    }
    case "iso_both":
      return `Attacks from either side. Reads the defense and picks the weaker help.`;
    case "pnr_ball": {
      const finish =
        inputs.pnrFinishRight ?? inputs.pnrFinishLeft ?? "Pull-up";
      const trap =
        inputs.trapResponse === "escape"
          ? " Escapes traps cleanly."
          : inputs.trapResponse === "struggle"
            ? " Struggles against hard hedges."
            : "";
      return `Uses the screen to read coverage. Preferred finish: ${finish}.${trap}`;
    }
    case "pnr_screener": {
      const action =
        inputs.screenerAction === "roll"
          ? "rolls hard to the rim"
          : inputs.screenerAction === "pop"
            ? "pops for the jumper"
            : inputs.screenerAction === "slip"
              ? "slips before contact"
              : "reads the defense after the screen";
      return `After setting the screen, ${action}.`;
    }
    case "post_right":
    case "post_left": {
      const shoulder = inputs.postShoulder === "R" ? "right" : "left";
      const moves = inputs.postMoves?.length
        ? inputs.postMoves.join(" and ")
        : "standard post moves";
      return `Posts on the ${id === "post_right" ? "right" : "left"} block. Attacks over the ${shoulder} shoulder with ${moves}.`;
    }
    case "post_high":
      return `Operates from the high post. Reads cutters and drives when overplayed.`;
    case "catch_shoot": {
      const z = inputs.spotZones;
      let zoneStr: string;
      if (z) {
        const parts: string[] = [];
        if (z.cornerLeft || z.cornerRight) parts.push("the corners");
        if (z.wing45Left || z.wing45Right) parts.push("the 45s");
        if (z.top) parts.push("the top of the key");
        zoneStr = parts.length > 0 ? parts.join(" and ") : "the perimeter";
      } else {
        zoneStr = inputs.spotZone === "corner"
          ? "the corners"
          : inputs.spotZone === "wing"
            ? "the wings"
            : inputs.spotZone === "top"
              ? "the top of the key"
              : "the perimeter";
      }
      const rangeNote = inputs.deepRange
        ? " Range extends well beyond the arc."
        : "";
      return `Spots up at ${zoneStr}.${rangeNote} Shoots immediately off the catch with a quick release.`;
    }
    case "transition":
      return `Primary transition threat. Pushes the pace and attacks before the defense sets.`;
    case "off_ball":
      return `Active off the ball. Uses screens and cuts to find open looks.`;
    case "dho":
      return `Dangerous in DHO actions — reads the handoff defender and attacks the gap.`;
    case "floater":
      return `Uses the floater to score over rim protection. Effective in the mid-range lane area.`;
    case "cut": {
      const typeStr =
        inputs.cutType === "backdoor" ? "backdoor cuts"
        : inputs.cutType === "curl" ? "curl cuts off screens"
        : inputs.cutType === "flash" ? "flash cuts to the elbow"
        : "basket cuts";
      return `Scores off ${typeStr}. Reads gaps in the defense and attacks when the defender loses visual contact.`;
    }
    case "oreb":
      return `Active on the offensive glass. Anticipates misses and converts second chances.`;
    case "misc":
      return `Multiple secondary threats — stay alert to sudden shifts in offensive focus.`;
    default:
      return "";
  }
}

function renderSituationDescriptionES(
  id: string,
  inputs: EnrichedInputs,
  _gender: Gender,
): string {
  switch (id) {
    case "iso_right":
    case "iso_left": {
      const side = id === "iso_right" ? "derecha" : "izquierda";
      const dec =
        inputs.isoDec === "S"
          ? "pull-up"
          : inputs.isoDec === "F"
            ? "penetración al aro"
            : "lectura y pase";
      const contact =
        inputs.contactFinish === "seeks"
          ? " Busca el contacto activamente."
          : "";
      return `Inicia el ISO por el lado ${side}. Decisión principal: ${dec}.${contact}`;
    }
    case "iso_both":
      return `Ataca por ambos lados. Lee la defensa y elige el lado con menos ayuda.`;
    case "pnr_ball": {
      const finish =
        inputs.pnrFinishRight ?? inputs.pnrFinishLeft ?? "pull-up";
      const trap =
        inputs.trapResponse === "escape"
          ? " Escapa bien de las trampas."
          : inputs.trapResponse === "struggle"
            ? " Tiene problemas con los hedges duros."
            : "";
      return `Usa el bloqueo para leer la cobertura. Finalización preferida: ${finish}.${trap}`;
    }
    case "pnr_screener": {
      const action =
        inputs.screenerAction === "roll"
          ? "corta fuerte al aro"
          : inputs.screenerAction === "pop"
            ? "abre para el tiro"
            : inputs.screenerAction === "slip"
              ? "se escapa antes del contacto"
              : "lee la defensa tras el bloqueo";
      return `Tras poner el bloqueo, ${action}.`;
    }
    case "post_right":
    case "post_left": {
      const shoulder = inputs.postShoulder === "R" ? "derecho" : "izquierdo";
      const moves = inputs.postMoves?.length
        ? inputs.postMoves.join(" y ")
        : "movimientos estándar de poste";
      return `Postea en el bloque ${id === "post_right" ? "derecho" : "izquierdo"}. Ataca por el hombro ${shoulder} con ${moves}.`;
    }
    case "post_high":
      return `Opera desde el poste alto. Lee los cortadores y penetra si le sobredefienden.`;
    case "catch_shoot": {
      const z = inputs.spotZones;
      let zoneStr: string;
      if (z) {
        const parts: string[] = [];
        if (z.cornerLeft || z.cornerRight) parts.push("las esquinas");
        if (z.wing45Left || z.wing45Right) parts.push("los 45°");
        if (z.top) parts.push("la parte alta");
        zoneStr = parts.length > 0 ? parts.join(" y ") : "el perímetro";
      } else {
        zoneStr = inputs.spotZone === "corner"
          ? "la esquina"
          : inputs.spotZone === "wing"
            ? "el ala"
            : inputs.spotZone === "top"
              ? "la parte alta"
              : "el perímetro";
      }
      const rangeNote = inputs.deepRange
        ? " Su rango llega más allá del arco estándar."
        : "";
      return `Se coloca en ${zoneStr}.${rangeNote} Lanza de inmediato tras el catch.`;
    }
    case "transition":
      return `Amenaza principal en transición. Empuja el ritmo y ataca antes de que la defensa se organice.`;
    case "off_ball":
      return `Activo/a sin balón. Usa bloqueos y cortes para encontrar tiros abiertos.`;
    case "dho":
      return `Peligroso/a en el DHO — lee al defensor del handoff y ataca el hueco.`;
    case "floater":
      return `Usa el floater para anotar sobre la protección del aro. Efectivo/a en la zona de medio poste.`;
    case "cut": {
      const typeStr =
        inputs.cutType === "backdoor" ? "cortes a puerta trasera"
        : inputs.cutType === "curl" ? "cortes en curl por bloqueos"
        : inputs.cutType === "flash" ? "cortes al codo"
        : "cortes al aro";
      return `Anota con ${typeStr}. Lee los espacios y ataca cuando el defensor pierde el contacto visual.`;
    }
    case "oreb":
      return `Activo/a en el rebote ofensivo. Anticipa los fallos y convierte segundas oportunidades.`;
    case "misc":
      return `Amenazas secundarias variadas — mantente atento/a a cambios bruscos de foco.`;
    default:
      return "";
  }
}

function renderSituationDescriptionZH(id: string, inputs: EnrichedInputs): string {
  switch (id) {
    case "iso_right":
      return `从右侧发起单打，主要选择${inputs.isoDec === "S" ? "急停跳投" : inputs.isoDec === "F" ? "突破上篮" : "读防组织"}。`;
    case "iso_left":
      return `从左侧发起单打，主要选择${inputs.isoDec === "S" ? "急停跳投" : "突破"}。`;
    case "iso_both":
      return `两侧均可发起单打，根据防守选择突破方向。`;
    case "pnr_ball":
      return `利用挡拆读防守，擅长${inputs.pnrFinishRight ?? "急停跳投"}。`;
    case "pnr_screener":
      return `掩护后${inputs.screenerAction === "roll" ? "下顺" : inputs.screenerAction === "pop" ? "外拆投篮" : "滑步切入"}。`;
    case "post_right":
      return `在右侧低位建立位置，从${inputs.postShoulder === "R" ? "右" : "左"}肩进攻。`;
    case "post_left":
      return `在左侧低位建立位置，从${inputs.postShoulder === "L" ? "左" : "右"}肩进攻。`;
    case "post_high":
      return `高位接球后读切入者，防守过于靠近时突破。`;
    case "catch_shoot":
      return `定点站位${inputs.spotZone === "corner" ? "底角" : inputs.spotZone === "wing" ? "45度" : "弧顶"}，接球即投，出手快。`;
    case "transition":
      return `快攻中威胁极大，在防守到位前快速推进。`;
    case "off_ball":
      return `无球跑动积极，利用掩护和切入寻找空位机会。`;
    case "dho":
      return `手递手威胁明显，善于阅读防守者位置并突破。`;
    case "floater":
      return `在禁区附近使用高弧度抛投对抗护框球员。`;
    case "oreb":
      return `积极抢进攻篮板，把握二次进攻机会。`;
    case "cut": {
      const typeStr =
        inputs.cutType === "backdoor" ? "背刺切入"
        : inputs.cutType === "curl" ? "绕掩护弧线切入"
        : inputs.cutType === "flash" ? "闪切至肘区"
        : "切入篮下";
      return `以${typeStr}得分，善于读空档，一旦防守者失去目视立即切入。`;
    }
    case "misc":
      return `多种次要威胁并存，需保持专注。`;
    default:
      return "";
  }
}

function renderDefense(
  motorOutput: MotorV4Output,
  ctx: RenderContext,
): RenderedReport["defense"] {
  const { inputs, defense } = motorOutput;

  return {
    deny: renderInstruction(defense.deny, "deny", inputs, ctx),
    force: renderInstruction(defense.force, "force", inputs, ctx),
    allow: renderInstruction(defense.allow, "allow", inputs, ctx),
  };
}

function renderInstruction(
  instruction: DefenseInstruction,
  type: "deny" | "force" | "allow",
  inputs: EnrichedInputs,
  ctx: RenderContext,
): RenderedInstruction {
  const labels: Record<"deny" | "force" | "allow", Record<Locale, string>> = {
    deny: { en: "DENY", es: "NIEGA", zh: "封堵" },
    force: { en: "FORCE", es: "FUERZA", zh: "逼迫" },
    allow: { en: "ALLOW", es: "PERMITE", zh: "放开" },
  };

  const { locale } = ctx;

  return {
    type,
    label: labels[type][locale],
    instruction: renderInstructionText(instruction.winner.key, inputs, ctx),
    situationRef: instruction.winner.situationRef,
    alternatives: instruction.alternatives.map((a) => ({
      instruction: renderInstructionText(a.key, inputs, ctx),
      score: a.score,
    })),
  };
}

function renderInstructionText(
  key: string,
  inputs: EnrichedInputs,
  ctx: RenderContext,
): string {
  const { locale, gender } = ctx;

  if (locale === "en") return renderInstructionEN(key, inputs);
  if (locale === "es") return renderInstructionES(key, inputs, gender);
  if (locale === "zh") return renderInstructionZH(key, inputs);
  return key;
}

function renderInstructionEN(key: string, inputs: EnrichedInputs): string {
  switch (key) {
    case "deny_iso_space": {
      const dirEN = inputs.isoDir === "R"
        ? "right wing"
        : inputs.isoDir === "L"
          ? "left wing"
          : "both wings";
      const forceEN = inputs.isoDir === "R"
        ? "Force left — contest every touch before they gather."
        : inputs.isoDir === "L"
          ? "Force right — do not let them set up going their way."
          : "Stay between ball and body — no free catches in space.";
      const athNote = (inputs.ath ?? 3) >= 4
        ? " Do not reach — they create off contact."
        : "";
      return `Deny the ${dirEN} catch. ${forceEN}${athNote}`;
    }
    case "deny_pnr_downhill": {
      const deepEN = inputs.deepRange
        ? "Get over the screen — do not go under. She shoots immediately if you give her the pull-up."
        : "Stay attached over the screen. No space for a mid-range pull-up.";
      const passerNote = inputs.pnrPri === "PF"
        ? " She will look to pass first — stay connected to the roll man."
        : "";
      return `Deny the downhill PnR catch. ${deepEN}${passerNote}`;
    }
    case "deny_post_entry": {
      const sideEN = inputs.postShoulder === "R" ? "right" : inputs.postShoulder === "L" ? "left" : "preferred";
      const techEN = inputs.phys && inputs.phys >= 4
        ? `Deny the ${sideEN} block entry. Front the post — three-quarter on the ${sideEN} shoulder, push high before she seals.`
        : `Deny the ${sideEN} block entry. Three-quarter position — get in front before she seals.`;
      const physNote = inputs.phys && inputs.phys >= 4 ? " She is physical — beat her to the spot before the ball arrives." : "";
      return techEN + physNote;
    }
    case "deny_cut_backdoor":
      return "Stay ball-side on cuts. Anticipate the backdoor — she reads when her defender turns their head. Keep vision on ball and body.";
    case "deny_cut_basket":
      return "Stay ball-side. She cuts hard to the rim — do not let her get in front of you. No free catches in the paint.";
    case "deny_cut_flash":
      return "Deny the flash to the elbow. Get in the passing lane early — she catches high and reads cutters.";
    case "deny_cut_curl":
      return "Chase over the screen on curl cuts. No rhythm catch — she curls to shoot or drive immediately off the catch.";
    case "deny_spot_deep": {
      const where = spotZonesPhraseEN(inputs);
      const instantEN = inputs.spotUpAction === "shoot"
        ? "Sprint to close out — no pump fake, no hesitation. She fires immediately on the catch."
        : "Close out under control — she may attack off the dribble on a soft closeout.";
      return `No open catch at ${where}. ${instantEN} Contest every touch.`;
    }
    case "deny_spot_corner": {
      const whereCorner = cornerFocusEN(inputs);
      const instantCorner = inputs.spotUpAction === "shoot"
        ? "Long, aggressive closeout — she is comfortable firing from there."
        : "Close out long but stay balanced — no rhythm catch.";
      return `Prioritize ${whereCorner} when she spots up. ${instantCorner}`;
    }
    case "deny_trans_rim":
      return "Sprint directly to the rim. She runs hard on every miss — get between her and the basket before the ball arrives.";
    case "deny_floater":
      return "Deny the catch in the floater zone. Contest high — do not give them the lane.";
    case "deny_pnr_slip":
      return "Anticipate the slip. They read your hedge — stay connected through the screen.";
    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "left" : "right";
      const isShooterForce = inputs.deepRange &&
        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
      const isIsoForce = (inputs.isoFreq === "P" || inputs.isoFreq === "S") &&
        inputs.isoDir !== "B";
      if (isShooterForce) {
        return `Force ${weakSide} — deny the mid-range pull-up. She avoids the rim; push her ${weakSide} and make her attack the paint.`;
      }
      if (isIsoForce) {
        const contactNote = inputs.contactFinish === "seeks"
          ? ` Stay square — she looks for contact going her way.`
          : "";
        return `Force ${weakSide} in ISO. She goes to her right — shade your body ${weakSide} before she gathers.${contactNote}`;
      }
      return `Force ${weakSide} off the screen. She finishes better going right — shade ${weakSide} early, before the screen is set.`;
    }
    case "force_early":
      return "Force early clock shots. Get into her in the first three seconds — do not let her survey the floor. She needs time to create.";
    case "force_no_space":
      return "Force them into no-space catches. Tight on the catch, no room to set up.";
    case "force_trap": {
      const weakSideTrap = inputs.hand === "R" ? "left" : "right";
      const hasPnrDir = inputs.pnrFinishLeft != null || inputs.pnrFinishRight != null;
      const dirNote = hasPnrDir
        ? ` Stay over the screen — no space for the pull-up. Funnel ${weakSideTrap} toward the paint or force the pass.`
        : ` Get over the screen aggressively and maintain contact — no mid-range pull-up.`;
      return `Force over every screen — no soft coverage. She struggles under hard hedge pressure.${dirNote}`;
    }
    case "force_post_channel": {
      const channelDir = inputs.hand === "L" ? "right" : "left";
      const dominantHand = inputs.hand === "L" ? "left" : "right";
      const hasUpUnder = inputs.postMoves?.includes("up_and_under");
      const hasHook = inputs.postMoves?.includes("hook");
      const movesNote = hasUpUnder && hasHook
        ? "The up-and-under and hook both terminate with the left hand."
        : hasUpUnder
          ? "The up-and-under always pivots back to the dominant hand."
          : "Hook on the dominant shoulder finishes with the dominant hand.";
      return `Force ${channelDir} in the post — deny the ${dominantHand}-hand finish. ${movesNote} Channel ${channelDir} before she seals.`;
    }
    case "force_paint_deny":
      return "Keep her off the paint. Force catches on the perimeter, not inside.";
    case "aware_instant_shot":
      return "Immediate release on closeout — no pump fake, no hesitation. Must arrive high and fast at the catch.";
    case "allow_catch_shoot":
      return "Allow catch-and-shoot attempts. Contest from distance — no free drives from closeout.";
    case "allow_iso":
      return "Allow ISO attempts. Low efficiency when she creates off the dribble — give her the ball, stay upright, and contest the shot.";
    case "allow_spot_three":
      return "Allow spot-up catches. No deep range — the long two is her best perimeter shot. Protect the paint instead.";
    case "allow_cut":
      return "Allow baseline cuts. No scoring threat off the cut — focus on primary actions.";
    case "force_contact": {
      const handEN = inputs.hand === "R" ? "left" : "right";
      return `Be physical on drives — she avoids contact and looks for space to finish. Push her ${handEN} and make every layup contested.`;
    }
    case "force_full_court":
      return inputs.pressureResponse === "struggles"
        ? "Full-court pressure. Attacks the ball in transition — she struggles under pressure."
        : "Active pressure — make the ball advance difficult.";
    case "force_no_push":
      return "Contain the dribble push. No free coast-to-coast — get in front early.";
    case "force_no_ball":
      return "Deny ball touches. Ball handling liability — attack the ball every time she has it.";
    case "allow_distance":
      return "Sag off. No perimeter range — give her the catch and focus on protecting the paint and box-out.";
    case "allow_ball_handling":
      return "Allow ball handling. Limited threat with the ball — let her dribble, not drive.";
    case "deny_pnr_pop":
      return "Contest the pop immediately. No space to catch — they shoot off the screen without hesitation.";
    case "deny_pnr_roll":
      return "Stay attached to the roller. Do not lose contact — they roll hard to the rim.";
    case "deny_duck_in":
      return "Deny the duck-in. Get in front early — they seal deep for the easy catch and finish.";
    case "deny_oreb":
      return "Find her before the shot goes up — not after. Box out early and physically. She crashes every possession.";
    case "deny_dho":
      return "Jump the handoff. Attack the ball at the moment of exchange — deny the catch.";
    case "deny_ball_advance":
      return "Pressure the ball advance. Limited handling under pressure — attack early in the halfcourt.";
    case "allow_transition":
      return "Allow transition attempts. Not a primary transition threat — stay organized defensively.";
    case "allow_post_right":
    case "allow_post_left":
    case "allow_post":
      return "Allow post-up attempts. Minimal post threat — sag off and help inside.";
    case "allow_pnr_mid_range":
      return "Allow mid-range pull-ups off the PnR. No deep range — the mid-range is the least efficient shot. Stay tight on transition and cutters instead.";
    case "allow_iso_both":
      return "Allow ISO attempts from either side. Low efficiency in isolation — make them use the clock.";
    case "none":
      return "No specific instruction — follow standard defensive principles.";
    default:
      return key
        .replace(/_/g, " ")
        .replace(/^(deny|force|allow) /, "");
  }
}

function renderInstructionES(key: string, inputs: EnrichedInputs, gender: Gender): string {
  switch (key) {
    case "deny_iso_space": {
      const dirES = inputs.isoDir === "R" ? "ala derecha" : inputs.isoDir === "L" ? "ala izquierda" : "ambas alas";
      const forceES = inputs.isoDir === "R"
        ? "Fuérzale a la izquierda — contesta cada toque antes de que se coloque."
        : inputs.isoDir === "L"
          ? "Fuérzale a la derecha — no le dejes atacar por su lado."
          : "Cuerpo entre balón y cuerpo — que trabaje para recibir.";
      const athES2 = (inputs.ath ?? 3) >= 4 ? " No estires — crea desde el contacto." : "";
      return `Niega el catch en ${dirES}. ${forceES}${athES2}`;
    }
    case "deny_pnr_downhill": {
      const deepES2 = inputs.deepRange
        ? "Por encima del bloqueo — nunca por debajo. Tira de inmediato si le das el pull-up."
        : "Pégale por encima. No le des espacio para el medio largo.";
      const passerES2 = inputs.pnrPri === "PF" ? " Prioriza el pase — mantente conectado al bloqueador." : "";
      return `Niega el catch en el bloqueo directo. ${deepES2}${passerES2}`;
    }
    case "deny_post_entry":
      return inputs.postShoulder === "R"
        ? "Fronta la entrada al bloque derecho. Tres cuartos por el lado del hombro derecho."
        : "Fronta la entrada al bloque izquierdo. Tres cuartos por el lado del hombro izquierdo.";
    case "deny_cut_backdoor":
      return "Mantente por el lado del balón. Anticipa el corte a puerta trasera — lee cuándo pierdes el contacto visual. Visión en balón y cuerpo.";
    case "deny_cut_basket":
      return "Quédate por el lado del balón. Corta fuerte al aro — no le dejes ponerse por delante. Sin catches libres en la pintura.";
    case "deny_cut_flash":
      return "Niega el corte al codo. Ponte en la línea de pase pronto — recibe en alto y lee cortadores.";
    case "deny_cut_curl":
      return "Persigue por encima del bloqueo en el curl. Sin catch a ritmo — ataca de inmediato al recibir.";
    case "deny_spot_deep": {
      const donde = spotZonesPhraseES(inputs);
      const instES = inputs.spotUpAction === "shoot"
        ? "Cierre a máxima velocidad — sin finta, sin dudar. Lanza al recibir."
        : "Cierra controlado — puede atacar si llegas en exceso.";
      return `No dejar catch limpio en ${donde}. ${instES} Contesta cada toque.`;
    }
    case "deny_spot_corner": {
      const wc = cornerFocusES(inputs);
      const instC = inputs.spotUpAction === "shoot"
        ? "Closeout largo y agresivo — cómoda lanzando desde ahí."
        : "Cierra largo pero con equilibrio — sin catch a ritmo.";
      return `Prioriza ${wc} en el spot-up. ${instC}`;
    }
    case "deny_trans_rim":
      return "Corre directo al aro. Va en carrera en cada pérdida — ponte entre ella y el aro antes de que llegue el balón.";
    case "deny_floater":
      return "Niega el catch en la zona del floater. Contesta alto — no le des la línea.";
    case "deny_pnr_slip":
      return "Anticipa el slip. Lee el hedge — mantente conectado/a durante todo el bloqueo.";
    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";
      const isShooterForce = inputs.deepRange &&
        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
      if (isShooterForce) {
        return `Fuerza a la ${weakSide} — niega el pull-up de media distancia. Evita penetrar al aro; empújala a la ${weakSide} y oblígala a atacar la pintura.`;
      }
      const isIsoES = (inputs.isoFreq === "P" || inputs.isoFreq === "S") && inputs.isoDir !== "B";
      if (isIsoES) {
        const cES = inputs.contactFinish === "seeks" ? ` Mantente cuadrado/a — busca el contacto por su lado.` : "";
        return `Fuerza a la ${weakSide} en el ISO. Va hacia su derecha — coloca el cuerpo a la ${weakSide} antes de que recoja.${cES}`;
      }
      return `Fuerza a la ${weakSide} por la pantalla. Finaliza peor por ese lado — cárgaste antes de que la pantalla esté puesta.`;
    }
    case "force_early":
      return "Fuerza el tiro en los primeros tres segundos. Métele encima desde el inicio — necesita tiempo para crear.";
    case "force_no_space":
      return "Fuerza el catch sin espacio. Pegado/a en la recepción — sin margen para prepararse.";
    case "force_trap": {
      const weakSideTrapES = inputs.hand === "R" ? "izquierda" : "derecha";
      const hasPnrDirES = inputs.pnrFinishLeft != null || inputs.pnrFinishRight != null;
      const dirNoteES = hasPnrDirES
        ? ` Pasa por arriba del bloqueo — sin espacio para el pull-up. Canaliza a la ${weakSideTrapES} hacia la pintura o fuerza el pase.`
        : ` Pasa por arriba del bloqueo con agresividad y mantén el contacto — sin pull-up de media distancia.`;
      return `Pasa por arriba de todos los bloqueos — sin cobertura blanda. Tiene problemas cuando se le presiona duro.${dirNoteES}`;
    }
    case "force_post_channel": {
      const channelDir = inputs.hand === "L" ? "derecha" : "izquierda";
      const dominantHand = inputs.hand === "L" ? "izquierda" : "derecha";
      const hasUpUnder = inputs.postMoves?.includes("up_and_under");
      const hasHook = inputs.postMoves?.includes("hook");
      const movesNote = hasUpUnder && hasHook
        ? "El up-and-under y el gancho terminan con la mano izquierda."
        : hasUpUnder
          ? "El up-and-under siempre pivota hacia la mano dominante."
          : "El gancho por el hombro dominante termina con la mano dominante.";
      return `Canaliza a la ${channelDir} en el poste — niega el remate con la mano ${dominantHand}. ${movesNote} Cárgala a la ${channelDir} antes de que selle.`;
    }
    case "force_paint_deny":
      return "Mantenla fuera de la pintura. Que reciba en el perímetro, no dentro.";
    case "allow_catch_shoot":
      return "Permite el catch & shoot. Cierre desde lejos — sin penetraciones desde el cierre.";
    case "allow_iso":
      return "Permite el ISO. Baja eficiencia creando — dale el balón, mantente erguido/a y contesta el tiro.";
    case "allow_spot_three":
      return "Permite el catch en el perímetro. Sin rango largo — el dos largo es su mejor tiro exterior. Protege la pintura.";
    case "allow_cut":
      return "Permite el corte. Sin amenaza en el corte — foco en las acciones primarias.";
    case "force_contact": {
      const handES3 = inputs.hand === "R" ? "izquierda" : "derecha";
      return `Sé físico/a en cada penetración — evita el contacto y busca espacio para finalizar. Empújala a la ${handES3} y contesta cada bandeja.`;
    }
    case "force_full_court":
      return inputs.pressureResponse === "struggles"
        ? "Presión toda cancha. Ataca el balón en transición — tiene problemas bajo presión."
        : "Presión activa — dificultar el avance del balón.";
    case "force_no_push":
      return "Contén el empuje de dribble. Sin avance libre de cancha a cancha — ponerse por delante pronto.";
    case "force_no_ball":
      return "Niega el balón. Manejo de balón deficiente — ataca el balón cada vez que lo tenga.";
    case "allow_distance":
      return "Concede distancia. Sin rango exterior — sagear y proteger la pintura.";
    case "allow_ball_handling":
      return "Permite el bote. Poca amenaza con balón — déjala botar, no penetrar.";
    case "deny_pnr_pop":
      return "Contesta el pop de inmediato. Lanza tras el bloqueo — no darle espacio para prepararse.";
    case "deny_pnr_roll":
      return "Mantente pegado/a al bloqueador. Sin perder contacto — corta fuerte al aro.";
    case "deny_duck_in":
      return "Niega el duck-in. Ponte por delante pronto — sella profundo para recibir y anotar fácil.";
    case "deny_oreb":
      return "Bloquear en cada tiro. Reboteador/a ofensivo/a élite — bloqueo físico obligatorio.";
    case "deny_dho":
      return "Salta el DHO. Ataca el balón en el momento del intercambio — niega el catch.";
    case "deny_ball_advance":
      return "Presión al avance del balón. Manejo limitado bajo presión — atacar pronto en el medio campo.";
    case "allow_transition":
      return "Permite la transición. Sin amenaza primaria en el contraataque — mantén la organización defensiva.";
    case "allow_post_right":
    case "allow_post_left":
    case "allow_post":
      return "Permite el poste. Sin amenaza real en el poste — sagea y ayuda dentro.";
    case "allow_pnr_mid_range":
      return "Permite el pull-up de media distancia en el PnR. Sin rango largo — el mid-range es el tiro menos eficiente. Concéntrate en transición y cortadores.";
    case "allow_iso_both":
      return "Permite el ISO desde cualquier lado. Baja eficiencia en aislamiento — que use el reloj.";
    case "none":
      return "Sin instrucción específica — aplica principios defensivos estándar.";
    default:
      return key.replace(/_/g, " ");
  }
}

function renderInstructionZH(key: string, inputs: EnrichedInputs): string {
  switch (key) {
    case "deny_iso_space": {
      const dirZH = inputs.isoDir === "R" ? "右翼" : inputs.isoDir === "L" ? "左翼" : "两翼";
      const forceZH =
        inputs.isoDir === "R"
          ? "迫使其向左——在其站稳前干扰每次接球。"
          : inputs.isoDir === "L"
            ? "迫使其向右——不让其按惯用方向发起进攻。"
            : "保持身体在球与对手之间——不给轻松接球机会。";
      const athZH = (inputs.ath ?? 3) >= 4 ? " 不要伸手犯规——她善于利用对抗。" : "";
      return `封堵${dirZH}接球。${forceZH}${athZH}`;
    }
    case "deny_pnr_downhill": {
      const deepZH = inputs.deepRange
        ? "绕过掩护，不要走底线——给她急停跳投机会就是失误。"
        : "紧贴绕过掩护，不让其舒适接球后中距离出手。";
      const passerZH = inputs.pnrPri === "PF" ? " 她以传球为优先——保持与滚篮者的联系。" : "";
      return `封堵挡拆顺下接球。${deepZH}${passerZH}`;
    }
    case "deny_post_entry": {
      const sideZH =
        inputs.postShoulder === "R" ? "右侧" : inputs.postShoulder === "L" ? "左侧" : "惯用侧";
      const techZH =
        inputs.phys && inputs.phys >= 4
          ? `封堵${sideZH}低位接球。前防低位——从${sideZH}肩膀四分之三位置，在其完成密封前推高卡位。`
          : `封堵${sideZH}低位接球。四分之三站位——在其完成密封前抢占位置。`;
      const physZH = inputs.phys && inputs.phys >= 4 ? " 她身体对抗强——在球到达前抢到位置。" : "";
      return techZH + physZH;
    }
    case "deny_cut_backdoor":
      return "保持在球的一侧。预判背刺切入——当防守者转头时读出切入时机。同时关注球和身体。";
    case "deny_cut_basket":
      return "保持球侧站位，强力切向篮下——不让其在你前面接球。禁区内无轻松接球。";
    case "deny_cut_flash":
      return "封堵闪切至肘区，提前卡在传球线上——接球后读切入者并攻击。";
    case "deny_cut_curl":
      return "绕掩护追赶弧线切入。不给节奏型接球——接球后立即突破或投篮。";
    case "deny_spot_deep": {
      const dondeZH = spotZonesPhraseZH(inputs);
      const instantZH =
        inputs.spotUpAction === "shoot"
          ? "全速补防——无假动作，无犹豫。接球即出手。"
          : "控制补防节奏——补防过快可能被突破利用。";
      return `不让其在${dondeZH}轻松接球。${instantZH} 争抢每次接球机会。`;
    }
    case "deny_spot_corner": {
      const wc = cornerFocusZH(inputs);
      const instC =
        inputs.spotUpAction === "shoot"
          ? "长距离快速补防——该区域接球投篮很果断。"
          : "长补防但保持平衡——不给节奏型接球投篮。";
      return `定点进攻时优先照顾${wc}。${instC}`;
    }
    case "deny_trans_rim":
      return "直接回追篮筐。她在每次失误后全力冲刺——在球到达前卡在她与篮筐之间。";
    case "deny_floater":
      return "封堵抛投区域接球，高高干扰——不给轻松上篮线。";
    case "deny_pnr_slip":
      return "预判掩护者滑出。读懂你的补防——全程与掩护保持身体接触。";
    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "左侧" : "右侧";
      const isShooterForce =
        inputs.deepRange &&
        inputs.spotUpFreq != null &&
        inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null &&
        inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" &&
        inputs.pnrFinishRight !== "Drive to Rim";
      if (isShooterForce) {
        return `逼迫其向${weakSide}突破——封堵中距离接球机会。她逃避冲击篮筐，靠向${weakSide}，迫其进攻禁区。`;
      }
      const isIsoZH = (inputs.isoFreq === "P" || inputs.isoFreq === "S") && inputs.isoDir !== "B";
      if (isIsoZH) {
        const cZH =
          inputs.contactFinish === "seeks" ? ` 保持身体方正——她喜欢从惯用侧寻求对抗。` : "";
        const handZH = inputs.hand === "R" ? "右" : "左";
        return `在单打中逼迫其向${weakSide}——她惯用${handZH}手，在其接球前靠向${weakSide}。${cZH}`;
      }
      return `从掩护中逼迫其向${weakSide}进攻，该侧终结能力较弱——掩护建立前提早靠位。`;
    }
    case "force_early":
      return "逼迫其在前三秒出手。从一开始就紧逼——她需要时间来创造机会。";
    case "force_no_space":
      return "逼迫其在无空间处接球，紧贴防守。";
    case "force_trap": {
      const weakSideTrapZH = inputs.hand === "R" ? "左侧" : "右侧";
      const hasPnrDirZH = inputs.pnrFinishLeft != null || inputs.pnrFinishRight != null;
      const dirNoteZH = hasPnrDirZH
        ? `绕过掩护上方——不给急停跳投空间。引导其向${weakSideTrapZH}进攻禁区或迫其传球。`
        : `强行绕过掩护并保持身体接触——不给中距离出手机会。`;
      return `所有掩护都从上方绕过，不给软防空间。她在强硬逼抢下容易出错。${dirNoteZH}`;
    }
    case "force_post_channel": {
      const channelDir = inputs.hand === "L" ? "右侧" : "左侧";
      const dominantHand = inputs.hand === "L" ? "左手" : "右手";
      const hasUpUnder = inputs.postMoves?.includes("up_and_under");
      const hasHook = inputs.postMoves?.includes("hook");
      const movesNote = hasUpUnder && hasHook
        ? "上步转身和勾手都以左手终结。"
        : hasUpUnder
          ? "上步转身动作总会转回主导手方向。"
          : "主导肩侧的勾手以惯用手终结。";
      return `在低位向${channelDir}引导——封堵${dominantHand}终结。${movesNote} 在其建立密封前向${channelDir}卡位。`;
    }
    case "force_paint_deny":
      return "将其逼离禁区——迫使在外线接球，不在内线。";
    case "force_contact": {
      const handZH = inputs.hand === "R" ? "左侧" : "右侧";
      return `每次突破都要身体对抗——她躲避对抗寻找空位终结。靠向${handZH}，让每次上篮都有争抢。`;
    }
    case "force_full_court":
      return inputs.pressureResponse === "struggles"
        ? "全场紧逼。在过渡防守中压迫持球——她在压力下容易出错。"
        : "主动施压——让球的推进变得困难。";
    case "force_no_push":
      return "限制持球推进，提前卡位，不让其全场突破。";
    case "force_no_ball":
      return "封堵接球。运球是弱项——每次持球都要上抢。";
    case "allow_catch_shoot":
      return "允许接球跳投，远距离补防即可——不给从防守中突破的机会。";
    case "allow_iso":
      return "允许单打。她持球创造的效率偏低——给球，保持直立姿势，封堵出手。";
    case "allow_spot_three":
      return "允许外线接球。射程有限——中远距离两分是她最好的外线选择。专注保护禁区。";
    case "allow_distance":
      return "松防。无外线射程——允许接球，专注保护禁区和卡位篮板。";
    case "allow_ball_handling":
      return "允许持球运球，控球威胁有限——让其运球，但不让其突破。";
    case "deny_pnr_pop":
      return "立即补防外拆投篮，挡拆后直接出手——不给空间站稳。";
    case "deny_pnr_roll":
      return "紧跟掩护者下顺，不脱离接触——强力切向篮下。";
    case "deny_duck_in":
      return "封堵低位切入接球。提前卡位——她深度密封后接球即可轻松终结。";
    case "deny_oreb":
      return "出手前找到她——不是出手后。提前身体卡位。每次进攻她都冲抢篮板。";
    case "deny_dho":
      return "封堵手递手，在交接瞬间抢断——封死接球。";
    case "deny_ball_advance":
      return "施压运球推进，压力下处理球能力有限——在半场早期进行干扰。";
    case "allow_cut":
      return "允许底线切入，无切入得分威胁——专注主要进攻动作。";
    case "allow_transition":
      return "允许快攻，非主要快攻威胁——保持防守组织。";
    case "allow_post":
    case "allow_post_right":
    case "allow_post_left":
      return "允许低位进攻，低位威胁有限——松防并协助内线。";
    case "allow_pnr_mid_range":
      return "允许挡拆后中距离跳投，无远射程——中距离是效率最低的投篮，专注快攻和切入防守。";
    case "allow_iso_both":
      return "允许双侧单打，单打效率低——让其消耗进攻时间。";
    case "aware_instant_shot":
      return "补防时立即出手——无假动作，无犹豫。";
    case "none":
      return "无特定指令，遵循标准防守原则。";
    default:
      return key.replace(/_/g, " ");
  }
}

function renderAlerts(
  alerts: AlertCandidate[],
  inputs: EnrichedInputs,
  ctx: RenderContext,
): RenderedAlert[] {
  return alerts.map((a) => ({
    text: renderAlertText(a.key, inputs, ctx),
    triggerCue: renderTriggerCue(a.triggerKey, inputs, ctx),
    mechanismType: a.mechanismType,
  }));
}

function renderAlertText(key: string, inputs: EnrichedInputs, ctx: RenderContext): string {
  const { locale } = ctx;
  if (locale === "en") {
    if (key.includes("instant_shot"))
      return "Fires immediately on closeout — no look, no hesitation.";
    if (key.includes("passer") || key.includes("vision"))
      return "Elite passer — head up before the trap closes. Stay connected to the roll man.";
    if (key.includes("post_fade"))
      return "Fadeaway from the post — hard to contest cleanly.";
    if (key.includes("post_hook"))
      return "Hook shot from the post — effective over either shoulder.";
    if (key.includes("stepback"))
      return "Stepback — creates separation in two dribbles.";
    if (key.includes("trans"))
      return "Transition threat — locates shooter early in the break.";
    if (key.includes("oreb"))
      return "Offensive rebounding — stays alive on every missed shot.";
    if (key.includes("screen_hold"))
      return "Holds the screen longer than expected — slip comes late.";
    if (key.includes("pressure_vuln"))
      return "Struggles under pressure — attack the ball early, force mistakes before they settle.";
    if (key === "aware_deep")
      return "Long-range threat — shoots from well beyond the standard arc. Guard from distance.";
    if (key.includes("physical"))
      return "Uses body to create space — physical mismatch risk.";
    return key.replace(/_/g, " ");
  }
  if (locale === "es") {
    if (key.includes("instant_shot"))
      return "Lanza de inmediato en el cierre — sin finta, sin dudar.";
    if (key.includes("passer") || key.includes("vision"))
      return "Pasador/a de alto nivel — lee el doble de inmediato.";
    if (key.includes("post_fade"))
      return "Fadeaway desde el poste — difícil de contestar limpiamente.";
    if (key.includes("post_hook"))
      return "Gancho desde el poste — efectivo por ambos hombros.";
    if (key.includes("stepback"))
      return "Stepback — crea separación en dos dribbles.";
    if (key.includes("trans"))
      return "Amenaza en transición — encuentra al tirador pronto en el contraataque.";
    if (key.includes("oreb"))
      return "Rebote ofensivo — sigue vivo/a en cada fallo.";
    if (key.includes("screen_hold"))
      return "Mantiene el bloqueo más de lo esperado — el slip llega tarde.";
    if (key.includes("pressure_vuln"))
      return "Le cuesta bajo presión — ataca pronto con el balón, fuerza el error antes de que se organice.";
    if (key === "aware_deep")
      return "Rango extra-largo — lanza desde más allá del arco estándar. Salir a defender desde lejos.";
    if (key.includes("physical"))
      return "Usa el cuerpo para crear espacio — riesgo de desajuste físico.";
    return key.replace(/_/g, " ");
  }
  if (locale === "zh") {
    if (key.includes("instant_shot"))
      return "补防时立即出手——无假动作，无犹豫。";
    if (key.includes("passer") || key.includes("vision"))
      return "传球精英——补防闭合前头部已抬起寻找出球。保持与滚篮者的联系。";
    if (key.includes("pressure_vuln"))
      return "压力下易出错。接球时主动施压——在其站稳前干扰。";
    if (key.includes("post_fade"))
      return "低位后仰跳投，难以有效封盖。";
    if (key.includes("post_hook"))
      return "低位勾手投篮，两侧均可出手，难以预判。";
    if (key.includes("stepback"))
      return "后撤步跳投，两次运球即可创造空间。";
    if (key.includes("trans"))
      return "快攻威胁，能迅速找到空位射手。";
    if (key.includes("oreb"))
      return "积极抢进攻篮板，把握每次补篮机会。";
    if (key.includes("screen_hold"))
      return "掩护时间比预期长——滑出来得晚，保持警觉。";
    if (key.includes("physical"))
      return "用身体创造空间——存在身体错位风险。";
    if (key === "aware_deep")
      return "超远射程威胁——在标准弧线外很远处即可出手。保持防守距离。";
    return key.replace(/_/g, " ");
  }
  return key;
}

function renderTriggerCue(
  triggerKey: string,
  _inputs: EnrichedInputs,
  ctx: RenderContext,
): string {
  const { locale } = ctx;
  const base = triggerKey.replace("_trigger", "");

  if (locale === "en") {
    if (base.includes("passer"))
      return "When you double — their head is already up looking to pass.";
    if (base.includes("post_fade"))
      return "When they catch in the post and feel you on the right shoulder.";
    if (base.includes("post_hook"))
      return "When they catch and pivot — hook comes from either side.";
    if (base.includes("stepback"))
      return "Two dribbles toward their strong hand — they are already loading.";
    if (base.includes("trans"))
      return "Any missed shot — they are already reading the outlet pass.";
    if (base.includes("oreb"))
      return "Every shot — they are boxing you out before the ball arrives.";
    if (base === "aware_deep_trigger" || base === "aware_deep")
      return "Any open catch beyond the arc — they can shoot from well outside standard range.";
    return "Watch for this in every possession.";
  }
  if (locale === "es") {
    if (base.includes("passer"))
      return "Cuando doblas — ya tiene la cabeza levantada buscando el pase.";
    if (base.includes("post_fade"))
      return "Cuando recibe en el poste y siente que estás en el hombro derecho.";
    if (base.includes("post_hook"))
      return "Cuando recibe y pivota — el gancho viene de cualquier lado.";
    if (base.includes("stepback"))
      return "Dos dribbles hacia su mano fuerte — ya está cargando el tiro.";
    if (base.includes("trans"))
      return "Cualquier fallo — ya está leyendo el pase de salida.";
    if (base.includes("oreb"))
      return "En cada tiro — te está bloqueando antes de que llegue el balón.";
    if (base === "aware_deep_trigger" || base === "aware_deep")
      return "Cualquier catch abierto más allá del arco — puede tirar desde fuera del rango estándar.";
    return "Atento/a en cada posesión.";
  }
  if (locale === "zh") {
    if (base.includes("passer"))
      return "夹击时对方已经抬头找传球点。";
    if (base.includes("post_fade"))
      return "低位接球后感觉到防守者在右肩——后仰跳投即将出手。";
    if (base.includes("post_hook"))
      return "低位接球并转身——勾手可从任意一侧出手。";
    if (base.includes("stepback"))
      return "两次运球向强手方向——已在蓄力后撤步。";
    if (base.includes("trans"))
      return "任何失误球——对方已在读出球传球。";
    if (base.includes("oreb"))
      return "每次出手——她在球到达前就已经开始卡位。";
    if (base.includes("deep"))
      return "7米以外任何空间——射程已到。";
    return "每次进攻都需注意。";
  }
  return "";
}

export function renderReport(
  motorOutput: MotorV4Output,
  ctx: RenderContext,
): RenderedReport {
  const identity = renderIdentity(motorOutput, ctx);
  const situations = renderSituations(motorOutput, ctx);
  const defense = renderDefense(motorOutput, ctx);
  const alerts = renderAlerts(motorOutput.alerts, motorOutput.inputs, ctx);

  return { identity, situations, defense, alerts };
}
