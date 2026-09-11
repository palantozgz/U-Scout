/**
 * Motor 1.0 — detección de `archetypeKey` (spec 14.3), diseño real sobre la
 * taxonomía Synergy — no un crosswalk desde `motor-v4.ts`.
 *
 * Diseñado por "El Arquitecto" (2026-09-11) a partir de un hallazgo real:
 * el crosswalk provisional que sustituye (`inferirArchetypeKeyProvisional`,
 * ya retirado de `motor-v1.ts`) producía `archetypeKey` cuyo prefijo de grupo
 * contradecía la `PosicionJugadora` del mismo reporte en 3 de los 10 perfiles
 * de `test-profiles.json` (ej. un interior con `armadora_creadora`). Este
 * archivo existe para que eso sea estructuralmente imposible.
 *
 * ## Los 3 principios de diseño
 * P1 — El grupo (base/alero/interior) es una restricción dura: el algoritmo
 *      nunca evalúa fuera del grupo, así que un resultado fuera de grupo no
 *      puede ocurrir por construcción.
 * P2 — El archetype debe añadir información que la Capa 1 (SituacionAmenaza[])
 *      no tiene ya — nunca es solo "la situación con más score" (ese era el
 *      bug de motor-v4.ts: `situations[0]`).
 * P3 — Agregación por ejes funcionales (varias situaciones + señales de
 *      Nivel 1), nunca una sola situación decidiendo sola.
 *
 * ## Interfaz propia, no EnrichedInputs directamente
 * `SenalesArchetype` es deliberadamente un tipo propio, no un alias de
 * `EnrichedInputs` de motor-v2.1.ts — cuando Fase 3 retire ese motor, solo
 * cambia `senalesDesdeEnriched()` (el adaptador), nunca la lógica de este
 * archivo. Coherente con la sección 4 de la spec (sin acoplamiento innecesario
 * entre el cálculo puro y una implementación legacy concreta).
 *
 * ## Deuda explícita (documentada también en spec 21.4)
 * - El proxy de volumen on-ball es `usage` (primary/secondary/role, 3 niveles
 *   declarados por el staff) — cuando `PlayerRealStats.usgPct` (Nivel 2) esté
 *   wireado (Fase 2), debería sustituir a `usage` en el gate de iniciadora de
 *   `detectarBase()`, sin tocar nada más.
 * - Ningún perfil real de `test-profiles.json` tenía `deepRange` en un
 *   interior antes de esta sesión, ni un alero puro sin carga on-ball —
 *   `interior_abridora`, `alero_penetradora` y `alero_movimiento` no tenían
 *   cobertura de test. Se añadieron 3 perfiles sintéticos para cerrar ese
 *   hueco (ver `scripts/test-profiles.json`, p011-p013).
 * - `[A VALIDAR CON PABLO]` 2 decisiones de baloncesto genuinas, marcadas en
 *   el código donde aplican: (1) un poste con señales de creación fuerte se
 *   clasifica `interior_creadora` en vez de `interior_poste` aunque su
 *   situación dominante sea post-up — decisión de qué información añade más
 *   valor al informe, no una medición; (2) un SG sin carga on-ball se trata
 *   como `alero` en vez de `base` para la detección de archetype (parche
 *   local al puente legacy, no aplica al contrato nuevo donde el staff teclea
 *   el grupo directamente).
 */

import type {
  ArchetypeKey,
  PosicionJugadora,
  SituacionAmenaza,
  SituacionSynergy,
} from "./motor-v1-types";
import type { EnrichedInputs } from "./motor-v2.1";

export interface SenalesArchetype {
  vision: 1 | 2 | 3 | 4 | 5;
  usage: "primary" | "secondary" | "role";
  pnrPri: "SF" | "PF" | null;
  isoDec: "S" | "F" | "P" | null;
  dhoRole: "giver" | "receiver" | "both" | null;
  deepRange: boolean;
  spotUpAction: "shoot" | "pump" | "either" | null;
  indirectFreq: "P" | "S" | "R" | "N" | null;
  transRole: string | null;
  screenerAction: "roll" | "pop" | "slip" | null;
  popRange: "three" | "midrange" | null;
  cutType: "basket" | "backdoor" | "flash" | "curl" | null;
  offBallCutAction: string | null;
  orebThreat: "high" | "medium" | "low" | null;
  contactFinish: "seeks" | "neutral" | "avoids" | null;
  postProfile: "B2B" | "FU" | "M" | null;
  postEff: "high" | "medium" | "low" | null;
  postMovesCount: number;
  highPostPasaACortador: boolean;
  ath: 1 | 2 | 3 | 4 | 5;
}

export interface DeteccionArchetype {
  key: ArchetypeKey;
  /** ganador − segundo, dentro del grupo. Diagnóstico y tests -- NO va al reporte final. */
  margen: number;
  confianza: "alta" | "media" | "baja";
  /** Trazabilidad de qué eje/gate decidió -- para tests y depuración, no para UI. */
  traza: string[];
}

/**
 * Adaptador desde el motor legacy -- ÚNICO punto que Fase 3 tendría que tocar
 * al retirar motor-v2.1.ts. Todo lo demás en este archivo es independiente.
 */
export function senalesDesdeEnriched(enriched: EnrichedInputs): SenalesArchetype {
  const e = enriched as any;
  const highPostPasaACortador =
    e.highPostZones?.leftElbow === "pass_to_cutter" ||
    e.highPostZones?.rightElbow === "pass_to_cutter";
  return {
    vision: e.vision ?? 3,
    usage: e.usage ?? "role",
    pnrPri: e.pnrPri ?? null,
    isoDec: e.isoDec ?? null,
    dhoRole: e.dhoRole ?? null,
    deepRange: e.deepRange ?? false,
    spotUpAction: e.spotUpAction ?? null,
    indirectFreq: e.indirectFreq ?? null,
    transRole: e.transRole ?? null,
    screenerAction: e.screenerAction ?? null,
    popRange: e.popRange ?? null,
    cutType: e.cutType ?? null,
    offBallCutAction: e.offBallCutAction ?? null,
    orebThreat: e.orebThreat ?? null,
    contactFinish: e.contactFinish ?? null,
    postProfile: e.postProfile ?? null,
    postEff: e.postEff ?? null,
    postMovesCount: Array.isArray(e.postMoves) ? e.postMoves.length : 0,
    highPostPasaACortador,
    ath: e.ath ?? 3,
  };
}

function scoreDe(situaciones: SituacionAmenaza[], situacion: SituacionSynergy): number {
  return situaciones.find((s) => s.situacion === situacion)?.score ?? 0;
}

function confianzaDeMargen(margen: number): "alta" | "media" | "baja" {
  if (margen >= 0.25) return "alta";
  if (margen >= 0.1) return "media";
  return "baja";
}

// ---------------------------------------------------------------------------------
// Grupo BASE -- armadora_creadora | armadora_anotadora | manejadora_secundaria
// ---------------------------------------------------------------------------------

function detectarBase(s: (sit: SituacionSynergy) => number, se: SenalesArchetype): DeteccionArchetype {
  const onBall = Math.max(s("pnrHandler"), s("iso"));

  // Paso 1 -- gate de iniciadora. `usage` es el proxy de volumen on-ball
  // disponible hoy (Nivel 1) -- sustituir por PlayerRealStats.usgPct en Fase 2.
  const esIniciadora = se.usage === "primary" || (se.usage === "secondary" && onBall >= 0.7);
  if (!esIniciadora || onBall < 0.35) {
    return {
      key: "manejadora_secundaria",
      margen: 1 - onBall,
      confianza: confianzaDeMargen(1 - onBall),
      traza: ["gate_iniciadora: no cualifica -> manejadora_secundaria"],
    };
  }

  // Paso 2 -- creadora vs anotadora, suma ponderada. Los pesos reflejan cuán
  // directa es la señal: pnrPri/isoDec son la respuesta explícita del staff
  // a "¿tira o pasa?" (neverInfer), vision es capacidad, no elección.
  let crea = 0;
  let anot = 0;
  const traza: string[] = [];

  if (se.pnrPri === "PF") { crea += 2.0; traza.push("pnrPri=PF(+2 crea)"); }
  if (se.pnrPri === "SF") { anot += 2.0; traza.push("pnrPri=SF(+2 anot)"); }
  if (se.isoDec === "P") { crea += 2.0; traza.push("isoDec=P(+2 crea)"); }
  if (se.isoDec === "S" || se.isoDec === "F") { anot += 2.0; traza.push(`isoDec=${se.isoDec}(+2 anot)`); }
  if (se.dhoRole === "giver" || se.dhoRole === "both") { crea += 1.0; traza.push(`dhoRole=${se.dhoRole}(+1 crea)`); }
  if (se.dhoRole === "receiver") { anot += 1.0; traza.push("dhoRole=receiver(+1 anot)"); }
  if (se.vision === 5) crea += 1.5;
  else if (se.vision === 4) crea += 0.75;
  else if (se.vision <= 2) anot += 0.75;
  if (se.deepRange) anot += 0.5;
  if (s("iso") >= s("pnrHandler") && s("iso") > 0) anot += 0.5;
  if (s("pnrHandler") > s("iso")) crea += 0.5;
  if (s("handoff") > 0 && se.dhoRole === "giver") crea += 0.5;

  const key: ArchetypeKey = crea > anot ? "armadora_creadora" : "armadora_anotadora";
  const margen = Math.abs(crea - anot) / 4;
  traza.push(`crea=${crea.toFixed(2)} anot=${anot.toFixed(2)} -> ${key}`);
  return { key, margen, confianza: confianzaDeMargen(margen), traza };
}

// ---------------------------------------------------------------------------------
// Grupo INTERIOR -- interior_creadora | interior_poste | interior_abridora | interior_finalizadora
// ---------------------------------------------------------------------------------

function detectarInterior(s: (sit: SituacionSynergy) => number, se: SenalesArchetype): DeteccionArchetype {
  // Paso 1 -- gate de hub, excluyente. Estricto a propósito: un poste
  // anotador normal no lo pasa (requiere vision>=4 Y una señal explícita de
  // distribución), para que "interior_creadora" siga significando algo.
  const senalesHub = [
    se.pnrPri === "PF",
    se.dhoRole === "giver" || se.dhoRole === "both",
    se.highPostPasaACortador,
    se.isoDec === "P",
    se.usage === "role",
  ].filter(Boolean).length;

  if (se.vision >= 4 && senalesHub >= 1) {
    // [A VALIDAR CON PABLO] decisión deliberada: un poste con señales de
    // creación fuerte se clasifica como creador aunque su situación dominante
    // sea post-up -- la Capa 1/2 ya muestran ese post-up, esto añade lo que
    // ninguna otra capa dice (que la ofensiva pasa por sus manos).
    return {
      key: "interior_creadora",
      margen: 0.3,
      confianza: "media",
      traza: [`gate_hub: vision=${se.vision}, senalesHub=${senalesHub} -> interior_creadora`],
    };
  }

  const poste =
    s("post") +
    (se.postProfile === "B2B" ? 0.15 : se.postProfile === "FU" ? 0.05 : 0) +
    (se.postEff === "high" ? 0.1 : 0) +
    (se.postMovesCount >= 2 ? 0.1 : 0);

  const abridoraElegible = se.deepRange || se.popRange === "three";
  const abridora = !abridoraElegible
    ? -Infinity
    : Math.max(
        s("spotUp"),
        se.deepRange ? 0.75 : 0,
        se.screenerAction === "pop" && se.popRange === "three"
          ? 0.85
          : se.screenerAction === "pop"
            ? 0.6
            : 0,
      ) + (se.deepRange && s("spotUp") > 0 ? 0.15 : 0);

  const finalizadora =
    Math.max(
      s("pnrRollMan"),
      s("cut"),
      s("putback"),
      se.transRole === "rim_run" || se.transRole === "leak" ? s("transition") : 0.5 * s("transition"),
      se.pnrPri !== "PF" ? 0.9 * s("pnrHandler") : 0,
    ) +
    (se.orebThreat === "high" ? 0.15 : 0) +
    (se.contactFinish === "seeks" ? 0.1 : 0) +
    (se.screenerAction === "roll" ? 0.1 : 0);

  const candidatos: [ArchetypeKey, number][] = [
    ["interior_poste", poste],
    ["interior_finalizadora", finalizadora],
    ["interior_abridora", abridora],
  ];
  // Desempate exacto: poste > finalizadora > abridora (orden ya en candidatos).
  candidatos.sort((a, b) => b[1] - a[1]);
  const [key, top] = candidatos[0];
  const segundo = candidatos[1][1];
  const margen = top === -Infinity ? 0 : top - Math.max(segundo, 0);
  return {
    key,
    margen,
    confianza: confianzaDeMargen(margen),
    traza: [`poste=${poste.toFixed(2)} finalizadora=${finalizadora.toFixed(2)} abridora=${abridora === -Infinity ? "N/A" : abridora.toFixed(2)} -> ${key}`],
  };
}

// ---------------------------------------------------------------------------------
// Grupo ALERO -- alero_penetradora | alero_tiradora | alero_movimiento
// ---------------------------------------------------------------------------------

function detectarAlero(s: (sit: SituacionSynergy) => number, se: SenalesArchetype): DeteccionArchetype {
  // s.transition NO cuenta como penetración salvo transRole rim_run/leak --
  // verificado con datos reales (Klay Thompson: transition=0.91, transRole
  // 'trail', es tiradora en movimiento, no penetradora).
  const penetradora =
    Math.max(
      s("iso"),
      se.cutType === "basket" || se.cutType === "backdoor" ? s("cut") : 0,
      se.transRole === "rim_run" || se.transRole === "leak" ? s("transition") : 0,
      s("pnrHandler"),
    ) +
    (se.contactFinish === "seeks" ? 0.1 : 0) +
    (se.isoDec === "F" ? 0.1 : 0) +
    (se.ath >= 4 && !se.deepRange ? 0.1 : 0);

  const tiradora =
    Math.max(s("spotUp"), se.transRole === "trail" ? 0.6 * s("transition") : 0) +
    (se.deepRange ? 0.15 : -0.25) +
    (se.spotUpAction === "shoot" ? 0.1 : 0);

  const movimiento =
    Math.max(s("offScreen"), s("handoff"), se.cutType === "curl" ? s("cut") : 0) +
    (se.indirectFreq === "P" ? 0.2 : se.indirectFreq === "S" ? 0.1 : 0) +
    (se.dhoRole === "receiver" || se.dhoRole === "both" ? 0.1 : 0) +
    (se.offBallCutAction === "curl" || se.offBallCutAction === "flare" ? 0.1 : 0) +
    (se.deepRange ? 0.1 : -0.2);

  const candidatos: [ArchetypeKey, number][] = [
    ["alero_tiradora", tiradora],
    ["alero_penetradora", penetradora],
    ["alero_movimiento", movimiento],
  ];
  candidatos.sort((a, b) => b[1] - a[1]);
  const [key, top] = candidatos[0];
  const segundo = candidatos[1][1];
  const margen = top - segundo;
  return {
    key,
    margen,
    confianza: confianzaDeMargen(margen),
    traza: [`penetradora=${penetradora.toFixed(2)} tiradora=${tiradora.toFixed(2)} movimiento=${movimiento.toFixed(2)} -> ${key}`],
  };
}

/**
 * Detecta el `archetypeKey` de una jugadora. El grupo (`posicion`) es una
 * restricción dura (P1) -- el resultado siempre empieza por el prefijo de
 * `posicion`, nunca hay que validarlo después.
 */
export function detectarArchetype(
  situaciones: SituacionAmenaza[],
  posicion: PosicionJugadora,
  senales: SenalesArchetype,
): DeteccionArchetype {
  const s = (sit: SituacionSynergy) => scoreDe(situaciones, sit);
  if (posicion === "base") return detectarBase(s, senales);
  if (posicion === "interior") return detectarInterior(s, senales);
  return detectarAlero(s, senales);
}
