/**
 * Capa 2 (v1) — Renderiza `ScoutingReportV1` (motor-v1) a texto legible por
 * locale/género. Hermano de `reportTextRenderer.ts` (que renderiza
 * `MotorV4Output`, todavía el único camino real en producción — spec 21.5),
 * no un reemplazo: parte del plan de migración de la sección 23 de
 * `docs/motor-1.0-spec.md` (PR-A, "capa de texto nueva, verificable en
 * aislamiento, sin tocar ReportSlidesV1.tsx").
 *
 * Reutiliza (no duplica) todo lo que sí es compatible entre motores:
 * - `renderInstructionEN/ES/ZH` — las keys de deny/force/allow/aware son el
 *   mismo string legacy en ambos motores (spec 21.4#7, verificado por El
 *   Arquitecto en la sección 23.1), así que el texto de instrucción se
 *   reutiliza literal, solo cambia de dónde viene el `key`.
 * - `renderAlertText`/`renderTriggerCue` — mismo razonamiento para `aware`.
 * - Los helpers de idioma (`g`, `joinList*`, `spotZonesPhrase*`, `cornerFocus*`).
 *
 * Lo que SÍ es trabajo nuevo (no una adaptación de firma):
 * - Descripciones de situación: motor-v4 tenía 16 `SituationId` granulares
 *   (con dirección/zona, ej. `iso_right`/`post_high`); motor-v1 solo tiene los
 *   11 buckets Synergy sin esa granularidad en la propia key. Se recupera el
 *   mismo nivel de detalle leyendo `EnrichedInputs` directamente dentro de
 *   cada caso (ej. `iso` mira `isoDir` para decidir derecha/izquierda/ambas),
 *   en vez de que la granularidad viva en la key.
 * - Catálogo de labels para los 10 `ArchetypeKey` nuevos (spec 14.3) + fusión
 *   obligatoria de `archetypeModificador` en la misma etiqueta (spec 14.3 bis:
 *   "SIEMPRE fusionado... nunca como chip propio").
 * - Texto de amenaza/tagline basado en `nivelAmenaza` (semáforo binario,
 *   spec 21.9 bis) en vez del `dangerLevel` numérico 1-5 de motor-v4 — el dato
 *   de origen es más simple a propósito (KYP: amenaza real o no, no una
 *   escala), así que el texto también lo es; no es una limitación de esta
 *   capa, es el contrato que ya se decidió.
 *
 * Sobre `EnrichedInputs` como parámetro: `ScoutingReportV1` NO lo expone
 * (14.2 bis, separación deliberada Nivel 1/Nivel 3) — spec 23.3 (decisión
 * directa de Pablo, 2026-09-13) resolvió mantener el detalle de texto actual
 * exponiéndolo como dato auxiliar solo para esta capa, vía
 * `ensamblarReporteParaTexto()` (`motor-v1.ts`), documentado ahí como deuda
 * técnica deliberada. No importar `EnrichedInputs` para nada que no sea texto.
 */

import type {
  ScoutingReportV1,
  ReporteModoCompletoV1,
  DefenseOutput,
  CampoConCandidatos,
  SituacionAmenaza,
  SituacionSynergy,
  ArchetypeKey,
  ModificadorArchetype,
  IdentidadReporte,
} from "./motor-v1-types";
import type { EnrichedInputs } from "./motor-v2.1";
import { mecanismoDeAwareKey } from "./motor-v1";
import {
  g,
  joinListEN,
  joinListES,
  joinListZH,
  spotZonesPhraseEN,
  spotZonesPhraseES,
  spotZonesPhraseZH,
  cornerFocusEN,
  cornerFocusES,
  cornerFocusZH,
  postMovesPhrase,
  renderInstructionEN,
  renderInstructionES,
  renderInstructionZH,
  renderAlertText,
  renderTriggerCue,
  type Locale,
  type Gender,
  type RenderContext,
  type RenderedInstruction,
  type RenderedAlert,
} from "./reportTextRenderer";

export type { Locale, Gender, RenderContext };

// ---------------------------------------------------------------------------------
// Tipos de salida — hermanos de `RenderedReport`/`RenderedIdentity`, pero
// reflejando la unión discriminada real de `ScoutingReportV1` (modo sencillo
// NO tiene situaciones/capa2/alerts -- forzar el shape plano de
// `RenderedReport` habría sido mentir sobre qué datos existen de verdad,
// spec 13.3).
// ---------------------------------------------------------------------------------

export interface RenderedIdentityV1 {
  /** Etiqueta ya fusionada con el modificador si existe (spec 14.3 bis). */
  archetypeLabel: string;
  tagline: string;
  threat: string;
  nivelAmenaza: "alta" | "estandar";
}

export interface RenderedSituationV1 {
  situacion: SituacionSynergy;
  score: number;
  frecuenciaObservada: "P" | "S" | "R" | "N";
  label: string;
  description: string;
}

export type RenderedReportV1 =
  | {
      modo: "sencillo";
      identity: RenderedIdentityV1;
      /** Ausente cuando no hay `deny` real -- ver `renderThreatV1` para el
       *  copy activo de "defensa estándar" (spec 21.9 bis/23.4#4), nunca
       *  silencio. */
      accionPrincipal?: RenderedInstruction;
    }
  | {
      modo: "completo";
      identity: RenderedIdentityV1;
      situations: RenderedSituationV1[];
      defense: {
        deny?: RenderedInstruction;
        force?: RenderedInstruction;
        allow?: RenderedInstruction;
      };
      alerts: RenderedAlert[];
    };

// ---------------------------------------------------------------------------------
// Instrucciones (deny/force/allow/aware) -- reutiliza renderInstructionEN/ES/ZH
// literal, solo adapta la forma ganador+candidatos de `CampoConCandidatos`
// (motor-v1) a `RenderedInstruction.alternatives` (candidatos ya incluye al
// ganador en rank 0, a diferencia de motor-v4 que los separaba -- spec 23.1).
// ---------------------------------------------------------------------------------

const INSTRUCTION_LABELS: Record<"deny" | "force" | "allow", Record<Locale, string>> = {
  deny: { en: "DENY", es: "NIEGA", zh: "封堵" },
  force: { en: "FORCE", es: "FUERZA", zh: "逼迫" },
  allow: { en: "ALLOW", es: "PERMITE", zh: "放开" },
};

function renderInstructionTextV1(
  key: string,
  enriched: EnrichedInputs,
  ctx: RenderContext,
): string {
  if (ctx.locale === "en") return renderInstructionEN(key, enriched);
  if (ctx.locale === "es") return renderInstructionES(key, enriched, ctx.gender);
  if (ctx.locale === "zh") return renderInstructionZH(key, enriched);
  return key;
}

export function renderCampoV1(
  campo: CampoConCandidatos,
  type: "deny" | "force" | "allow",
  enriched: EnrichedInputs,
  ctx: RenderContext,
): RenderedInstruction {
  return {
    type,
    label: INSTRUCTION_LABELS[type][ctx.locale],
    instruction: renderInstructionTextV1(String(campo.ganador.key), enriched, ctx),
    situationRef: campo.ganador.situacionOrigen,
    alternatives: campo.candidatos.slice(1).map((c) => ({
      instruction: renderInstructionTextV1(String(c.output.key), enriched, ctx),
      score: c.score,
    })),
  };
}

/**
 * `aware` -- deliberadamente SIN extender a `alternatives` en esta pasada
 * (aunque motor-v1 sí trae candidatos, spec 23.4#5 lo deja como "opcional,
 * no obligatorio para esta migración"). `RenderedAlert` no lleva ese campo
 * todavía; extenderlo es trabajo de PR-B si se decide, no de esta capa base.
 */
export function renderAwareV1(
  slots: CampoConCandidatos[],
  enriched: EnrichedInputs,
  ctx: RenderContext,
): RenderedAlert[] {
  return slots.map((slot): RenderedAlert => {
    const key = String(slot.ganador.key);
    return {
      key,
      triggerKey: key,
      text: renderAlertText(key, enriched, ctx),
      triggerCue: renderTriggerCue(key, enriched, ctx),
      mechanismType: mecanismoDeAwareKey(key),
    };
  });
}

// ---------------------------------------------------------------------------------
// Situaciones (capa 1) -- trabajo nuevo real (spec 23.1): los 11 buckets
// Synergy no llevan dirección/zona en la key, a diferencia de los 16
// `SituationId` de motor-v4. Se recupera el mismo detalle leyendo
// `EnrichedInputs` dentro de cada caso.
// ---------------------------------------------------------------------------------

const SITUATION_LABELS: Record<SituacionSynergy, Record<Locale, string>> = {
  iso: { en: "Isolation", es: "Aislamiento (ISO)", zh: "单打" },
  pnrHandler: { en: "PnR ball-handler", es: "PnR con balón", zh: "持球挡拆" },
  pnrRollMan: { en: "PnR roll man", es: "Bloqueador en PnR", zh: "挡拆掩护/顺下" },
  post: { en: "Post-up", es: "Poste bajo", zh: "低位单打" },
  transition: { en: "Transition", es: "Transición", zh: "快攻" },
  spotUp: { en: "Spot-up", es: "Tiro en estático", zh: "定点投篮" },
  handoff: { en: "Hand-off", es: "Hand-off (DHO)", zh: "手递手" },
  cut: { en: "Cut", es: "Corte", zh: "切入" },
  offScreen: { en: "Off-screen", es: "Bloqueo indirecto", zh: "无球掩护跑动" },
  putback: { en: "Putback", es: "Rebote ofensivo", zh: "进攻篮板补篮" },
  misc: { en: "Other", es: "Otras", zh: "其他" },
};

function renderSituationLabelV1(situacion: SituacionSynergy, locale: Locale): string {
  return SITUATION_LABELS[situacion][locale];
}

function renderSituationDescriptionV1EN(situacion: SituacionSynergy, inputs: EnrichedInputs): string {
  switch (situacion) {
    case "iso": {
      if (inputs.isoDir === "B")
        return `Attacks from either side. Reads the defense and picks the weaker help.`;
      const side = inputs.isoDir === "R" ? "right" : inputs.isoDir === "L" ? "left" : null;
      const dec =
        inputs.isoDec === "S" ? "pull-up shot" : inputs.isoDec === "F" ? "drive to the rim" : "read and distribute";
      const contact = inputs.contactFinish === "seeks" ? " Actively draws contact." : "";
      if (!side) return `Initiates ISO from the perimeter. Primary decision: ${dec}.${contact}`;
      return `Initiates ISO from the ${side} side. Primary decision: ${dec}.${contact}`;
    }
    case "pnrHandler": {
      const finish = inputs.pnrFinishRight ?? inputs.pnrFinishLeft ?? "Pull-up";
      const trap =
        inputs.trapResponse === "escape"
          ? " Escapes traps cleanly."
          : inputs.trapResponse === "struggle"
            ? " Struggles against hard hedges."
            : "";
      return `Uses the screen to read coverage. Preferred finish: ${finish}.${trap}`;
    }
    case "pnrRollMan": {
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
    case "post": {
      if (inputs.postZone === "high")
        return `Operates from the high post. Reads cutters and drives when overplayed.`;
      const shoulder = inputs.postShoulder === "R" ? "right" : "left";
      const side = inputs.postShoulder === "R" ? "right" : inputs.postShoulder === "L" ? "left" : "preferred";
      const moves = postMovesPhrase(inputs.postMoves, "en") ?? "standard post moves";
      return `Posts on the ${side} block. Attacks over the ${shoulder} shoulder with ${moves}.`;
    }
    case "transition":
      return `Primary transition threat. Pushes the pace and attacks before the defense sets.`;
    case "spotUp": {
      const zoneStr = spotZonesPhraseEN(inputs);
      const rangeNote = inputs.deepRange ? " Range extends well beyond the arc." : "";
      return `Spots up at ${zoneStr}.${rangeNote} Shoots immediately off the catch with a quick release.`;
    }
    case "handoff":
      return `Dangerous in hand-off actions — reads the handoff defender and attacks the gap.`;
    case "cut": {
      const typeStr =
        inputs.cutType === "backdoor"
          ? "backdoor cuts"
          : inputs.cutType === "curl"
            ? "curl cuts off screens"
            : inputs.cutType === "flash"
              ? "flash cuts to the elbow"
              : "basket cuts";
      return `Scores off ${typeStr}. Reads gaps in the defense and attacks when the defender loses visual contact.`;
    }
    case "offScreen":
      return `Active off the ball. Uses screens and cuts to find open looks.`;
    case "putback":
      return `Active on the offensive glass. Anticipates misses and converts second chances.`;
    case "misc": {
      if (inputs.floater && inputs.floater !== "N")
        return `Uses the floater to score over rim protection. Effective in the mid-range lane area.`;
      return `Multiple secondary threats — stay alert to sudden shifts in offensive focus.`;
    }
    default:
      return "";
  }
}

function renderSituationDescriptionV1ES(situacion: SituacionSynergy, inputs: EnrichedInputs): string {
  switch (situacion) {
    case "iso": {
      if (inputs.isoDir === "B")
        return `Ataca por ambos lados. Lee la defensa y elige el lado con menos ayuda.`;
      const side = inputs.isoDir === "R" ? "derecho" : inputs.isoDir === "L" ? "izquierdo" : null;
      const dec =
        inputs.isoDec === "S" ? "pull-up" : inputs.isoDec === "F" ? "penetración al aro" : "lectura y pase";
      const contact = inputs.contactFinish === "seeks" ? " Busca el contacto activamente." : "";
      if (!side) return `Inicia el ISO desde el perímetro. Decisión principal: ${dec}.${contact}`;
      return `Inicia el ISO por el lado ${side}. Decisión principal: ${dec}.${contact}`;
    }
    case "pnrHandler": {
      const finish = inputs.pnrFinishRight ?? inputs.pnrFinishLeft ?? "pull-up";
      const trap =
        inputs.trapResponse === "escape"
          ? " Escapa bien de las trampas."
          : inputs.trapResponse === "struggle"
            ? " Tiene problemas con los hedges duros."
            : "";
      return `Usa el bloqueo para leer la cobertura. Finalización preferida: ${finish}.${trap}`;
    }
    case "pnrRollMan": {
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
    case "post": {
      if (inputs.postZone === "high")
        return `Opera desde el poste alto. Lee los cortadores y penetra si le sobredefienden.`;
      const shoulder = inputs.postShoulder === "R" ? "derecho" : "izquierdo";
      const side = inputs.postShoulder === "R" ? "derecho" : inputs.postShoulder === "L" ? "izquierdo" : "preferido";
      const moves = postMovesPhrase(inputs.postMoves, "es") ?? "movimientos estándar de poste";
      return `Postea en el bloque ${side}. Ataca por el hombro ${shoulder} con ${moves}.`;
    }
    case "transition":
      return `Amenaza principal en transición. Empuja el ritmo y ataca antes de que la defensa se organice.`;
    case "spotUp": {
      const zoneStr = spotZonesPhraseES(inputs);
      const rangeNote = inputs.deepRange ? " Su rango llega más allá del arco estándar." : "";
      return `Se coloca en ${zoneStr}.${rangeNote} Lanza de inmediato tras el catch.`;
    }
    case "handoff":
      return `Peligrosa en el hand-off (DHO) — lee al defensor del intercambio y ataca el hueco.`;
    case "cut": {
      const typeStr =
        inputs.cutType === "backdoor"
          ? "cortes a puerta trasera"
          : inputs.cutType === "curl"
            ? "cortes en curl por bloqueos"
            : inputs.cutType === "flash"
              ? "cortes al codo"
              : "cortes al aro";
      return `Anota con ${typeStr}. Lee los espacios y ataca cuando el defensor pierde el contacto visual.`;
    }
    case "offScreen":
      return `Activa sin balón. Usa bloqueos y cortes para encontrar tiros abiertos.`;
    case "putback":
      return `Activa en el rebote ofensivo. Anticipa los fallos y convierte segundas oportunidades.`;
    case "misc": {
      if (inputs.floater && inputs.floater !== "N")
        return `Usa el floater para anotar sobre la protección del aro. Efectiva en la zona de medio poste.`;
      return `Amenazas secundarias variadas — mantente atenta a cambios bruscos de foco.`;
    }
    default:
      return "";
  }
}

function renderSituationDescriptionV1ZH(situacion: SituacionSynergy, inputs: EnrichedInputs): string {
  switch (situacion) {
    case "iso": {
      if (inputs.isoDir === "B") return `两侧均可发起单打，根据防守选择突破方向。`;
      const dec = inputs.isoDec === "S" ? "急停跳投" : inputs.isoDec === "F" ? "突破上篮" : "读防组织";
      const side = inputs.isoDir === "R" ? "右侧" : inputs.isoDir === "L" ? "左侧" : "外线";
      return `从${side}发起单打，主要选择${dec}。`;
    }
    case "pnrHandler":
      return `利用挡拆读防守，擅长${inputs.pnrFinishRight ?? "急停跳投"}。`;
    case "pnrRollMan":
      return `掩护后${inputs.screenerAction === "roll" ? "下顺" : inputs.screenerAction === "pop" ? "外拆投篮" : "滑步切入"}。`;
    case "post": {
      if (inputs.postZone === "high") return `高位接球后读切入者，防守过于靠近时突破。`;
      const shoulder = inputs.postShoulder === "R" ? "右" : "左";
      return `在低位建立位置，从${shoulder}肩进攻。`;
    }
    case "transition":
      return `快攻中威胁极大，在防守到位前快速推进。`;
    case "spotUp":
      return `定点站位${inputs.spotZone === "corner" ? "底角" : inputs.spotZone === "wing" ? "45度" : "弧顶"}，接球即投，出手快。`;
    case "handoff":
      return `手递手威胁明显，善于阅读防守者位置并突破。`;
    case "cut": {
      const typeStr =
        inputs.cutType === "backdoor"
          ? "背刺切入"
          : inputs.cutType === "curl"
            ? "绕掩护弧线切入"
            : inputs.cutType === "flash"
              ? "闪切至肘区"
              : "切入篮下";
      return `以${typeStr}得分，善于读空档，一旦防守者失去目视立即切入。`;
    }
    case "offScreen":
      return `无球跑动积极，利用掩护和切入寻找空位机会。`;
    case "putback":
      return `积极抢进攻篮板，把握二次进攻机会。`;
    case "misc": {
      if (inputs.floater && inputs.floater !== "N") return `在禁区附近使用高弧度抛投对抗护框球员。`;
      return `多种次要威胁并存，需保持专注。`;
    }
    default:
      return "";
  }
}

/** Exportada -- `ReportSlidesV1.tsx` la reusa para los "runners-up" de
 *  situación (spec 22.1/23), mismo patrón que `renderSituationDescription`
 *  en `reportTextRenderer.ts`. */
export function renderSituationDescriptionV1(
  situacion: SituacionSynergy,
  inputs: EnrichedInputs,
  locale: Locale,
): string {
  if (locale === "en") return renderSituationDescriptionV1EN(situacion, inputs);
  if (locale === "es") return renderSituationDescriptionV1ES(situacion, inputs);
  if (locale === "zh") return renderSituationDescriptionV1ZH(situacion, inputs);
  return "";
}

function renderSituationesV1(
  situaciones: SituacionAmenaza[],
  inputs: EnrichedInputs,
  ctx: RenderContext,
): RenderedSituationV1[] {
  return situaciones
    .filter((s) => s.score > 0)
    .slice(0, 5)
    .map((s) => ({
      situacion: s.situacion,
      score: s.score,
      frecuenciaObservada: s.frecuenciaObservada,
      label: renderSituationLabelV1(s.situacion, ctx.locale),
      description: renderSituationDescriptionV1(s.situacion, inputs, ctx.locale),
    }));
}

// ---------------------------------------------------------------------------------
// Identidad -- catálogo de los 10 ArchetypeKey nuevos (spec 14.3) + fusión
// obligatoria de archetypeModificador (spec 14.3 bis) + texto de amenaza
// basado en nivelAmenaza (semáforo binario, spec 21.9 bis) en vez del
// dangerLevel 1-5 de motor-v4.
//
// "base"/"alero"/"interior" son invariantes de género en español de
// baloncesto real (se dice "la alero", igual que "la base" o "la pívot") --
// solo el calificativo (creadora/tiradora/abridora/...) se declina. Verificado
// contra el propio uso del resto del codebase (`locales/es.ts`: "Creadora
// interior", "interiores" como sustantivo ya sin marcar género aparte).
// ---------------------------------------------------------------------------------

const ARCHETYPE_LABELS: Record<ArchetypeKey, { en: string; es: Record<Gender, string>; zh: string }> = {
  armadora_creadora: {
    en: "Playmaking Guard",
    es: { f: "Armadora creadora", m: "Armador creador", n: "Armador/a creador/a" },
    zh: "组织后卫",
  },
  armadora_anotadora: {
    en: "Scoring Guard",
    es: { f: "Armadora anotadora", m: "Armador anotador", n: "Armador/a anotador/a" },
    zh: "得分后卫",
  },
  manejadora_secundaria: {
    en: "Secondary Ball-Handler",
    es: { f: "Manejadora secundaria", m: "Manejador secundario", n: "Manejador/a secundario/a" },
    zh: "第二持球者",
  },
  alero_penetradora: {
    en: "Slashing Wing",
    es: { f: "Alero penetradora", m: "Alero penetrador", n: "Alero penetrador/a" },
    zh: "突破锋线",
  },
  alero_tiradora: {
    en: "Spot-up Shooting Wing",
    es: { f: "Alero tiradora", m: "Alero tirador", n: "Alero tirador/a" },
    zh: "定点投手锋线",
  },
  alero_movimiento: {
    en: "Dynamic Shooting Wing",
    es: { f: "Alero de movimiento", m: "Alero de movimiento", n: "Alero de movimiento" },
    zh: "跑动投篮锋线",
  },
  interior_creadora: {
    en: "Playmaking Big",
    es: { f: "Interior creadora", m: "Interior creador", n: "Interior creador/a" },
    zh: "组织型内线",
  },
  interior_poste: {
    en: "Post-up Big",
    es: { f: "Interior de poste", m: "Interior de poste", n: "Interior de poste" },
    zh: "低位内线",
  },
  interior_abridora: {
    en: "Stretch Big",
    es: { f: "Interior abridora", m: "Interior abridor", n: "Interior abridor/a" },
    zh: "空间型内线",
  },
  interior_finalizadora: {
    en: "Rim-finishing Big",
    es: { f: "Interior finalizadora", m: "Interior finalizador", n: "Interior finalizador/a" },
    zh: "终结型内线",
  },
};

function archetypeBaseLabel(key: ArchetypeKey, locale: Locale, gender: Gender): string {
  const entry = ARCHETYPE_LABELS[key];
  if (locale === "en") return entry.en;
  if (locale === "zh") return entry.zh;
  return entry.es[gender];
}

/**
 * Fusión de `archetypeModificador` en la etiqueta -- SIEMPRE fusionado, nunca
 * como chip propio (spec 14.3 bis). Patrón uniforme en vez de una frase
 * bespoke por cada una de las 20 combinaciones posibles (10 archetypes x 2
 * modificadores): mantenible y fiel a las 2 definiciones cerradas de
 * `ModificadorArchetype` (spec 14.3 bis) sin inventar matiz por combinación.
 */
function fusionarModificador(base: string, mod: ModificadorArchetype | undefined, locale: Locale): string {
  if (!mod) return base;
  if (locale === "en") return mod === "de_movimiento" ? `${base} (off movement)` : `${base} (in transition)`;
  if (locale === "zh") return mod === "de_movimiento" ? `${base}（跑动型）` : `${base}（转换进攻型）`;
  return mod === "de_movimiento" ? `${base} de movimiento` : `${base} a la contra`;
}

function renderArchetypeLabelV1(identidad: IdentidadReporte, ctx: RenderContext): string {
  const base = archetypeBaseLabel(identidad.archetypeKey, ctx.locale, ctx.gender);
  return fusionarModificador(base, identidad.archetypeModificador, ctx.locale);
}

/**
 * Tagline corta por archetype -- un rasgo concreto y accionable, apoyado en
 * `EnrichedInputs` cuando el archetype lo pide de forma natural (dirección de
 * ISO para las armadoras, movimientos de poste para las interiores de poste,
 * rango para las tiradoras/abridoras). Deliberadamente más compacto que el
 * `renderTagline` de motor-v4 (que tenía ramas extra por `dangerLevel`
 * 1-5 x archetype): el dato de origen aquí es más simple a propósito
 * (nivelAmenaza binario, spec 21.9 bis) -- ver `renderThreatV1` para esa
 * parte.
 */
function renderTaglineV1(identidad: IdentidadReporte, inputs: EnrichedInputs, ctx: RenderContext): string {
  const { locale } = ctx;
  const key = identidad.archetypeKey;

  if (locale === "en") {
    switch (key) {
      case "armadora_creadora":
        return "Reads the defense first — looks to set up teammates before looking for her own shot.";
      case "armadora_anotadora":
        return inputs.isoDir === "L"
          ? "Left-hand dominant scorer — forces you to shade a side most defenders avoid."
          : "Can create a quality shot for herself from anywhere on the floor.";
      case "manejadora_secundaria":
        return "Effective with the ball in a support role — not the primary initiator, but punishes a lazy closeout.";
      case "alero_penetradora":
        return "Attacks the rim off the dribble — most dangerous with a live drive, not standing still.";
      case "alero_tiradora":
        return inputs.deepRange
          ? "Shoots from well beyond the arc — the catch alone is a threat."
          : "Punishes any closeout mistake immediately.";
      case "alero_movimiento":
        return "Scores coming off screens and cuts — never stops moving without the ball.";
      case "interior_creadora":
        return "Reads cutters and shooters from the post or the elbow — a passing threat as much as a scoring one.";
      case "interior_poste": {
        const hasHook = inputs.postMoves?.includes("hook");
        const hasFade = inputs.postMoves?.includes("fade");
        if (hasHook && hasFade) return "Has both the hook and the fadeaway — two finishes off the same setup.";
        return "Dangerous once she establishes deep post position.";
      }
      case "interior_abridora":
        return "Forces the defense out to the arc — opens driving lanes for teammates.";
      case "interior_finalizadora":
        return "Finishes above the rim — every miss and every drive is a threat with her running the floor.";
      default:
        return "Adapts to whatever the defense gives.";
    }
  }

  if (locale === "es") {
    switch (key) {
      case "armadora_creadora":
        return "Lee la defensa primero — busca a sus compañeras antes que su propio tiro.";
      case "armadora_anotadora":
        return inputs.isoDir === "L"
          ? "Anotadora dominante con la izquierda — obliga a cargarse a un lado que casi nadie defiende bien."
          : "Puede crear un buen tiro para sí misma desde cualquier punto de la pista.";
      case "manejadora_secundaria":
        return "Eficaz con el balón en un rol de apoyo — no es la iniciadora principal, pero castiga un cierre flojo.";
      case "alero_penetradora":
        return "Ataca el aro con el bote — más peligrosa en la penetración que parada.";
      case "alero_tiradora":
        return inputs.deepRange
          ? "Tira desde bien fuera del arco — solo el catch ya es una amenaza."
          : "Castiga cualquier cierre mal ejecutado al instante.";
      case "alero_movimiento":
        return "Anota saliendo de bloqueos y cortes — nunca deja de moverse sin balón.";
      case "interior_creadora":
        return "Lee cortadoras y tiradoras desde el poste o el codo — amenaza de pase tanto como de anotación.";
      case "interior_poste": {
        const hasHook = inputs.postMoves?.includes("hook");
        const hasFade = inputs.postMoves?.includes("fade");
        if (hasHook && hasFade) return "Tiene gancho y fadeaway — dos finalizaciones desde la misma posición.";
        return "Peligrosa en cuanto establece posición en el poste bajo.";
      }
      case "interior_abridora":
        return "Obliga a la defensa a salir al arco — abre líneas de penetración para sus compañeras.";
      case "interior_finalizadora":
        return "Finaliza por encima del aro — cada fallo y cada penetración son una amenaza con ella corriendo el campo.";
      default:
        return "Se adapta a lo que le da la defensa.";
    }
  }

  // zh
  switch (key) {
    case "armadora_creadora":
      return "优先读防守——为队友创造机会，其次才是自己的出手。";
    case "armadora_anotadora":
      return inputs.isoDir === "L" ? "左手主导得分，迫使防守者做出不习惯的判断。" : "全场任意位置均可为自己创造高质量投篮机会。";
    case "manejadora_secundaria":
      return "作为辅助持球者效率高——不是主要发起点，但补防松懈时会被惩罚。";
    case "alero_penetradora":
      return "持球突破攻框——运动中比静止时更具威胁。";
    case "alero_tiradora":
      return inputs.deepRange ? "射程远超三分线——接球本身就是威胁。" : "定点出手快，任何防守失误都会被即刻惩罚。";
    case "alero_movimiento":
      return "依靠掩护和切入跑动得分——无球时持续移动。";
    case "interior_creadora":
      return "在低位或肘区读切入者与射手——传球威胁不亚于得分。";
    case "interior_poste":
      return "低位建立位置后极具威胁。";
    case "interior_abridora":
      return "拉开空间到三分线外，为队友创造突破路线。";
    case "interior_finalizadora":
      return "篮筐上方终结能力强——快下和每次突破都是威胁。";
    default:
      return "根据防守变化随机应变。";
  }
}

/**
 * Texto de amenaza principal (Slide 0 / Capa 0). Basado en `nivelAmenaza`
 * (spec 21.9 bis) -- "alta" usa el `archetypeKey` para un texto específico
 * (mismo espíritu que `renderThreat` de motor-v4, adaptado a los 10 archetypes
 * nuevos); "estandar" usa el copy activo de "defensa estándar del equipo"
 * respaldado por terminología real de banquillo (KYP -- Know Your Personnel,
 * spec 21.9 bis: nunca silencio, siempre una instrucción activa distinta para
 * no-amenazas: dejar espacio, no ayudar de más). Este copy NO estaba
 * implementado en ningún sitio de la UI hasta esta capa (spec 23.4#4).
 */
export function renderThreatV1(identidad: IdentidadReporte, ctx: RenderContext): string {
  const { locale, gender } = ctx;

  if (identidad.nivelAmenaza === "estandar") {
    if (locale === "es")
      return "Sin una situación clara que merezca negarse por sí sola. Defensa estándar del equipo — no sobre-ayudes, dale espacio y protege la pintura.";
    if (locale === "zh")
      return "没有需要单独重点封堵的明确威胁。执行球队标准防守——不要过度协防，给出空间并保护禁区。";
    return "No single situation clear enough to deny outright. Standard team defense — don't over-help, give her space and protect the paint.";
  }

  const d = g("dangerous", gender, locale);
  const key = identidad.archetypeKey;

  if (locale === "es") {
    switch (key) {
      case "armadora_creadora":
        return "Dirige el ataque de verdad — toma la decisión correcta frente a cualquier cobertura y castiga la ayuda extra con el pase.";
      case "armadora_anotadora":
        return "Amenaza de primer nivel con el balón — capaz de crear tiro de calidad en cualquier posesión.";
      case "manejadora_secundaria":
        return "Amenaza secundaria real con el balón — no la subestimes en un cambio defensivo.";
      case "alero_penetradora":
        return `Más ${d} atacando el aro con el bote — convierte cualquier ventaja en penetración.`;
      case "alero_tiradora":
        return "Tiro instantáneo y de largo alcance — castiga cualquier descuido en el cierre.";
      case "alero_movimiento":
        return "Constante amenaza sin balón — un solo despiste en un bloqueo indirecto y anota.";
      case "interior_creadora":
        return "Amenaza doble desde el poste — anota y organiza, no se puede dejar sola ni ayudar de más.";
      case "interior_poste":
        return "Domina el poste bajo — convierte posesiones que otras no pueden resolver.";
      case "interior_abridora":
        return "Espaciadora real — su tiro exterior obliga a salir a defenderla lejos del aro.";
      case "interior_finalizadora":
        return `Más ${d} corriendo el campo — finaliza por encima de todo en transición y en el rebote ofensivo.`;
      default:
        return "Alta capacidad de impacto en cualquier momento del partido.";
    }
  }

  if (locale === "zh") {
    switch (key) {
      case "armadora_creadora":
        return "真正的进攻发起点——能针对任何防守体系做出正确决策，并用传球惩罚过度协防。";
      case "armadora_anotadora":
        return "持球一级威胁——每次持球均可创造高质量投篮机会。";
      case "manejadora_secundaria":
        return "持球时的真实次级威胁——换防时不可轻视。";
      case "alero_penetradora":
        return "持球突破攻框威胁极大——任何空隙都能转化为突破得分。";
      case "alero_tiradora":
        return "定点出手快、射程远——任何补防失误都会被立即惩罚。";
      case "alero_movimiento":
        return "无球时持续构成威胁——一次掩护漏防就可能被命中。";
      case "interior_creadora":
        return "低位双重威胁——能得分也能组织，既不能放空也不能过度协防。";
      case "interior_poste":
        return "低位统治力极强——能解决其他球员无法处理的进攻回合。";
      case "interior_abridora":
        return "真正的空间型内线——外线投篮迫使防守者远离篮筐。";
      case "interior_finalizadora":
        return "快下终结能力极强——转换进攻和进攻篮板都是威胁。";
      default:
        return "比赛任意阶段均具备高影响力。";
    }
  }

  // en
  switch (key) {
    case "armadora_creadora":
      return "Truly runs the offense — makes the right read against any coverage and punishes extra help with the pass.";
    case "armadora_anotadora":
      return "Top-tier threat with the ball — capable of creating a quality shot on any possession.";
    case "manejadora_secundaria":
      return "Real secondary threat with the ball — do not sleep on her in a defensive switch.";
    case "alero_penetradora":
      return `Most ${d} attacking the rim off the dribble — converts any advantage into a drive.`;
    case "alero_tiradora":
      return "Instant release, extended range — punishes any closeout mistake immediately.";
    case "alero_movimiento":
      return "A constant off-ball threat — one lapse on a screen and she scores.";
    case "interior_creadora":
      return "A dual threat from the post — scores and organizes, cannot be left alone or over-helped.";
    case "interior_poste":
      return "Dominates the low post — converts possessions others cannot.";
    case "interior_abridora":
      return "A real floor-spacer — her outside shot forces you to defend her away from the rim.";
    case "interior_finalizadora":
      return `Most ${d} running the floor — finishes above everything in transition and on the offensive glass.`;
    default:
      return "High-impact threat at any point in the game.";
  }
}

function renderIdentityV1(identidad: IdentidadReporte, inputs: EnrichedInputs, ctx: RenderContext): RenderedIdentityV1 {
  return {
    archetypeLabel: renderArchetypeLabelV1(identidad, ctx),
    tagline: renderTaglineV1(identidad, inputs, ctx),
    threat: renderThreatV1(identidad, ctx),
    nivelAmenaza: identidad.nivelAmenaza,
  };
}

// ---------------------------------------------------------------------------------
// Ensamblado principal
// ---------------------------------------------------------------------------------

export function renderReportV1(
  reporte: ScoutingReportV1,
  enrichedInputs: EnrichedInputs,
  ctx: RenderContext,
): RenderedReportV1 {
  const identity = renderIdentityV1(reporte.identidad, enrichedInputs, ctx);

  if (reporte.modo === "sencillo") {
    return {
      modo: "sencillo",
      identity,
      accionPrincipal: reporte.accionPrincipal
        ? renderCampoV1(reporte.accionPrincipal, "deny", enrichedInputs, ctx)
        : undefined,
    };
  }

  const completo = reporte as ReporteModoCompletoV1;
  return {
    modo: "completo",
    identity,
    situations: renderSituationesV1(completo.capa1.situaciones, enrichedInputs, ctx),
    defense: {
      deny: completo.capa2.deny ? renderCampoV1(completo.capa2.deny, "deny", enrichedInputs, ctx) : undefined,
      force: completo.capa2.force ? renderCampoV1(completo.capa2.force, "force", enrichedInputs, ctx) : undefined,
      allow: completo.capa2.allow ? renderCampoV1(completo.capa2.allow, "allow", enrichedInputs, ctx) : undefined,
    },
    alerts: renderAwareV1(completo.capa2.aware, enrichedInputs, ctx),
  };
}

// Re-exportado por conveniencia -- consumidores de esta capa no deberían
// necesitar importar `DefenseOutput` directamente, pero algún caller de UI
// (picker de alternativas, spec 22) sí necesita el tipo para tipar `candidatos`.
export type { DefenseOutput };
