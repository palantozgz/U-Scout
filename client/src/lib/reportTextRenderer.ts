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
      const zone = inputs.spotZone ?? "wing";
      const deep = inputs.deepRange ? " Has deep range." : "";
      return `Spots up at the ${zone}.${deep} Shoots immediately off the catch with a quick release.`;
    }
    case "transition":
      return `Primary transition threat. Pushes the pace and attacks before the defense sets.`;
    case "off_ball":
      return `Active off the ball. Uses screens and cuts to find open looks.`;
    case "dho":
      return `Dangerous in DHO actions — reads the handoff defender and attacks the gap.`;
    case "floater":
      return `Uses the floater to score over rim protection. Effective in the mid-range lane area.`;
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
      const zone =
        inputs.spotZone === "corner"
          ? "la esquina"
          : inputs.spotZone === "wing"
            ? "el ala"
            : "el top";
      const deep = inputs.deepRange ? " Tiene rango largo." : "";
      return `Se coloca en ${zone}.${deep} Lanza de inmediato tras el catch con mecánica rápida.`;
    }
    case "transition":
      return `Amenaza principal en transición. Empuja el ritmo y ataca antes de que la defensa se organice.`;
    case "off_ball":
      return `Activo/a sin balón. Usa bloqueos y cortes para encontrar tiros abiertos.`;
    case "dho":
      return `Peligroso/a en el DHO — lee al defensor del handoff y ataca el hueco.`;
    case "floater":
      return `Usa el floater para anotar sobre la protección del aro. Efectivo/a en la zona de medio poste.`;
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
    case "deny_iso_space":
      return inputs.isoDir === "R"
        ? "Deny the right wing catch. Force them left before they set up."
        : inputs.isoDir === "L"
          ? "Deny the left wing catch. Force them right — their weaker side."
          : "Deny ISO catches on both wings. Make them work for every touch.";
    case "deny_pnr_downhill":
      return "Deny the downhill PnR attack. Get over the screen — do not go under.";
    case "deny_post_entry":
      return inputs.postShoulder === "R"
        ? "Front the right block entry. Three-quarter position on the right shoulder."
        : "Front the left block entry. Three-quarter position on the left shoulder.";
    case "deny_spot_deep":
      return "Deny the deep catch. Extend your close-out — they shoot immediately off the catch.";
    case "deny_trans_rim":
      return "Sprint back. No basket cuts in transition — get between them and the rim.";
    case "deny_floater":
      return "Deny the catch in the floater zone. Contest high — do not give them the lane.";
    case "deny_pnr_slip":
      return "Anticipate the slip. They read your hedge — stay connected through the screen.";
    case "force_early":
      return "Force early clock shots. Apply ball pressure — do not let them settle.";
    case "force_no_space":
      return "Force them into no-space catches. Tight on the catch, no room to set up.";
    case "force_trap":
      return "Force into traps on the PnR. Hedge hard — they struggle to escape.";
    case "force_paint_deny":
      return "Keep her off the paint. Force catches on the perimeter, not inside.";
    case "allow_catch_shoot":
      return "Allow catch-and-shoot attempts. Contest from distance — no free drives from closeout.";
    case "allow_iso":
      return "Allow ISO attempts in non-primary situations. Low efficiency — make them use clock.";
    case "allow_spot_three":
      return "Allow spot-up threes. No deep range — the shot is below average.";
    case "allow_cut":
      return "Allow baseline cuts. No scoring threat off the cut — focus on primary actions.";
    case "force_contact":
      return "Force into contact — be physical on every drive. Do not give easy layups.";
    case "force_full_court":
      return inputs.pressureResponse === "struggles"
        ? "Full-court pressure. Attacks the ball in transition — she struggles under pressure."
        : "Active pressure — make the ball advance difficult.";
    case "force_no_push":
      return "Contain the dribble push. No free coast-to-coast — get in front early.";
    case "force_no_ball":
      return "Deny ball touches. Ball handling liability — attack the ball every time she has it.";
    case "allow_distance":
      return "Give distance. No exterior range — sag off and protect the paint.";
    case "allow_ball_handling":
      return "Allow ball handling. Limited threat with the ball — let her dribble, not drive.";
    case "deny_pnr_pop":
      return "Contest the pop immediately. They shoot off the screen — no space to set.";
    case "deny_pnr_roll":
      return "Stay attached to the roller. Do not lose contact — they roll hard to the rim.";
    case "deny_oreb":
      return "Box out on every shot. Elite offensive rebounder — physical block-out required.";
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
    case "deny_iso_space":
      return inputs.isoDir === "R"
        ? "Niégale el catch en el ala derecha. Fórzale a la izquierda antes de que se sitúe."
        : inputs.isoDir === "L"
          ? "Niégale el catch en el ala izquierda. Fórzale a la derecha — su lado débil."
          : "Niégale el catch en ambas alas. Que trabaje cada balón.";
    case "deny_pnr_downhill":
      return "Niega el ataque directo en el PnR. Por encima del bloqueo — nunca por debajo.";
    case "deny_post_entry":
      return inputs.postShoulder === "R"
        ? "Fronta la entrada al bloque derecho. Tres cuartos por el lado del hombro derecho."
        : "Fronta la entrada al bloque izquierdo. Tres cuartos por el lado del hombro izquierdo.";
    case "deny_spot_deep":
      return "Niega el catch largo. Cierre anticipado — lanza de inmediato tras recibir.";
    case "deny_trans_rim":
      return "Corre de vuelta. Sin cortes al aro en transición — ponte entre él/ella y el aro.";
    case "deny_floater":
      return "Niega el catch en la zona del floater. Contesta alto — no le des la línea.";
    case "deny_pnr_slip":
      return "Anticipa el slip. Lee el hedge — mantente conectado/a durante todo el bloqueo.";
    case "force_early":
      return "Fuerza tiros de inicio de posesión. Presión sobre el balón — no le dejes asentarse.";
    case "force_no_space":
      return "Fuerza el catch sin espacio. Pegado/a en la recepción — sin margen para prepararse.";
    case "force_trap":
      return "Fuerza la trampa en el PnR. Hedge duro — tiene problemas para escapar.";
    case "force_paint_deny":
      return "Mantenla fuera de la pintura. Que reciba en el perímetro, no dentro.";
    case "allow_catch_shoot":
      return "Permite el catch & shoot. Cierre desde lejos — sin penetraciones desde el cierre.";
    case "allow_iso":
      return "Permite el ISO en situaciones no primarias. Baja eficiencia — que consuma posesión.";
    case "allow_spot_three":
      return "Permite el tres en estático. Sin rango largo — el tiro está por debajo de la media.";
    case "allow_cut":
      return "Permite el corte. Sin amenaza en el corte — foco en las acciones primarias.";
    case "force_contact":
      return "Fuerza el contacto — sé físico/a en cada penetración. No regalar mates fáciles.";
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
    case "deny_iso_space":
      return inputs.isoDir === "R"
        ? "封堵右翼接球，迫使其向左运球。"
        : "封堵左翼接球，迫使其向右运球。";
    case "deny_pnr_downhill":
      return "封堵挡拆下坡进攻，绕过掩护，不要走底线。";
    case "deny_post_entry":
      return "封堵低位接球，保持前防位置。";
    case "deny_spot_deep":
      return "封堵远距离接球，提前补防。";
    case "deny_trans_rim":
      return "全速回防，不让其快攻上篮。";
    case "force_early":
      return "逼迫其在进攻时间早期出手，持续施压不让其站稳。";
    case "force_no_space":
      return "逼迫其在无空间处接球，紧贴防守。";
    case "force_trap":
      return "在挡拆中逼迫其陷入夹击，大力补防。";
    case "allow_catch_shoot":
      return "允许接球跳投，远距离补防即可——不给从防守中突破的机会。";
    case "allow_iso":
      return "在非主要进攻位置允许单打，效率低，让其消耗进攻时间。";
    case "allow_spot_three":
      return "允许定点三分，射程有限，命中率偏低。";
    case "force_contact":
      return "逼迫对抗——每次突破都要身体对抗，不给轻松上篮机会。";
    case "force_full_court":
      return "全场紧逼，持续施压让传球推进困难。";
    case "force_no_push":
      return "限制持球推进，提前卡位，不让其全场突破。";
    case "force_paint_deny":
      return "将其逼离禁区，迫使其在外线接球。";
    case "force_no_ball":
      return "封堵接球。运球能力差——每次持球都要上抢。";
    case "allow_distance":
      return "给予外线空间，无射程威胁——协防保护禁区。";
    case "allow_ball_handling":
      return "允许持球运球，控球威胁有限——让其运球，但不让其突破。";
    case "deny_pnr_pop":
      return "立即补防外拆投篮，挡拆后直接出手——不给空间站稳。";
    case "deny_pnr_roll":
      return "紧跟掩护者下顺，不脱离接触——强力切向篮下。";
    case "deny_oreb":
      return "每次出手都要卡位，顶级进攻篮板手——必须物理阻挡。";
    case "deny_dho":
      return "封堵手递手，在交接瞬间抢断——封死接球。";
    case "allow_cut":
      return "允许底线切入，无切入得分威胁——专注主要进攻动作。";
    case "allow_transition":
      return "允许快攻，非主要快攻威胁——保持防守组织。";
    case "allow_post":
    case "allow_post_right":
    case "allow_post_left":
      return "允许低位进攻，低位威胁有限——协防保护禁区。";
    case "allow_iso_both":
      return "允许单打，单打效率低——让其消耗进攻时间。";
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
    if (key.includes("passer") || key.includes("vision"))
      return "High-level passer — reads the double team instantly.";
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
    if (key.includes("deep") || key.includes("range"))
      return "Deep range — shoots from well beyond the arc.";
    if (key.includes("physical"))
      return "Uses body to create space — physical mismatch risk.";
    return key.replace(/_/g, " ");
  }
  if (locale === "es") {
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
    if (key.includes("deep") || key.includes("range"))
      return "Rango largo — lanza desde muy por detrás de la línea.";
    if (key.includes("physical"))
      return "Usa el cuerpo para crear espacio — riesgo de desajuste físico.";
    return key.replace(/_/g, " ");
  }
  if (locale === "zh") {
    if (key.includes("passer") || key.includes("vision"))
      return "传球视野极佳，夹击时能立刻找到出球点。";
    if (key.includes("post_fade"))
      return "低位后仰跳投，难以有效封盖。";
    if (key.includes("stepback"))
      return "后撤步跳投，两次运球即可创造空间。";
    if (key.includes("trans"))
      return "快攻威胁，能迅速找到空位射手。";
    if (key.includes("oreb"))
      return "积极抢进攻篮板，把握每次补篮机会。";
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
    if (base.includes("deep"))
      return "Any space beyond 7 meters — they are in range.";
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
    if (base.includes("deep"))
      return "Cualquier espacio más allá de 7 metros — está en rango.";
    return "Atento/a en cada posesión.";
  }
  if (locale === "zh") {
    if (base.includes("passer"))
      return "夹击时对方已经抬头找传球点。";
    if (base.includes("stepback"))
      return "两次运球向强手方向——已在蓄力后撤步。";
    if (base.includes("trans"))
      return "任何失误球——对方已在读出球传球。";
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
