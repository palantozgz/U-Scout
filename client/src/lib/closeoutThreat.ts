/**
 * closeoutThreat — semáforo de cierre/catch-and-shoot (punto 7, sesión 2026-09-07).
 *
 * Decisión de Pablo tras revisar el prototipo v1 (shotVsDriveTendency, un índice
 * genérico tiro-vs-penetración): el semáforo NO debe ser un índice general de la
 * jugadora, sino específicamente sobre cómo reacciona al CIERRE (closeout) —
 * si tira en el catch-and-shoot o lo mete al suelo. Esa es la decisión real que
 * un defensor toma en la pista: ¿cierro fuerte para contestar el tiro, o puedo
 * ayudar sabiendo que va a botar?
 *
 * Colores (igual convención que usa Pablo con su cuerpo técnico — no es una
 * escala de peligro genérica, es específicamente sobre la amenaza de tiro en
 * el catch-and-shoot):
 *   rojo    = tira en el catch-and-shoot → cerrar fuerte, contestar el tiro.
 *   amarillo = mixto / frecuencia insuficiente para estar seguros → normal.
 *   verde   = no suele tirar en el catch — se puede ayudar/dar un paso atrás.
 *
 * Aviso adicional "ataca tras el cierre" (flecha curva + icono de ojo en la UI):
 * se activa cuando el semáforo NO es rojo pero la jugadora tiene señales reales
 * de que penetra (ISO o PnR con finish de "Drive to Rim") — para que un semáforo
 * verde no se lea como "puedes relajarte del todo", sino "no va a tirar, pero
 * vigila que ataca el aro".
 *
 * Nota de manejadora: solo se añade si la jugadora tiene frecuencia real como
 * manejadora de bloqueo directo (pnrFreq Primary/Secondary Y no es una pura
 * bloqueadora sin datos de finish). Si no juega ese rol con frecuencia, no se
 * menciona nada — evita ruido irrelevante en la ficha. El caso que más importa
 * señalar (pedido explícito de Pablo): tira bien en catch-and-shoot (rojo) pero
 * NO tira de bote como manejadora → avisar de que ir "por debajo" (under) del
 * bloqueo no la saca de su juego, porque preferirá penetrar en vez de parar a tirar.
 *
 * insufficient_data: cuando el motor no ha detectado NINGUNA situación ofensiva
 * activa (`situations.length === 0`) — es decir, la jugadora no tiene ninguna
 * frecuencia de ataque scouteada (ISO/PnR/post/etc. todas en "Never" o vacías).
 * A 2026-09-07, la inmensa mayoría de jugadoras en producción están en este
 * estado (solo datos de importación WCBA, `inputs={}`, sin ficha de scouting
 * real) — es el comportamiento correcto, no un bug: mejor no decir nada que
 * inventar un color con datos que no existen. Lo relevante es que el informe
 * no se publica al staff/jugadoras propias hasta que el entrenador lo aprueba
 * (ver `scouting_report_assignments`), así que este estado nunca debería
 * llegar a publicarse si el entrenador hace scouting completo antes de aprobar.
 *
 * OJO — por qué NO se usa spotUpFreq/perimeterThreats como gate adicional:
 * ese campo es legacy y casi nunca se rellena (en producción, solo 1 de 5
 * fichas reales lo tenía). Gatear la señal de closeoutReaction por él producía
 * falsos negativos reales: una manejadora de PnR con `closeoutReaction:
 * "Catch & Shoot"` explícitamente scouteado salía como "sin datos" solo
 * porque nadie había tocado el campo de frecuencia de spot-up, que es un
 * campo aparte y no tiene por qué estar relleno para que la reacción al
 * cierre sea real. El gate correcto es "¿hay ALGO scouteado de esta
 * jugadora?" (situations.length), no "¿es específicamente una tiradora de
 * spot-up por frecuencia?".
 */

import type { EnrichedInputs } from "./motor-v2.1";
import type { RankedSituation } from "./motor-v4";

export type CloseoutLight = "red" | "yellow" | "green" | "insufficient_data";

export type HandlerLean = "shoots" | "drives" | "mixed";

export interface HandlerNote {
  lean: HandlerLean;
  /** true cuando es el caso que Pablo pidió señalar explícitamente: tira en el
   *  catch (rojo) pero NO tira de bote como manejadora — el "under" no funciona. */
  contradictsCloseout: boolean;
}

export interface CloseoutThreatReport {
  light: CloseoutLight;
  /** -1 (nunca tira en el catch) .. +1 (siempre tira en el catch). null si insufficient_data. */
  index: number | null;
  /** Aviso "ataca tras el cierre" — mostrar icono de ojo + flecha curva hacia el aro. */
  watchDrive: boolean;
  /** Nota de manejadora en bloqueo directo — null si no juega ese rol con frecuencia real. */
  handlerNote: HandlerNote | null;
}

function situationScore(situations: RankedSituation[], prefix: string): number {
  let max = 0;
  for (const s of situations) {
    if (s.id === prefix || s.id.startsWith(prefix)) max = Math.max(max, s.score);
  }
  return max;
}

const RED_THRESHOLD = 0.35;
const GREEN_THRESHOLD = -0.35;

// +1 = tira en el catch, -1 = ataca el aro en vez de tirar.
const SPOT_ACTION_VALUE: Record<string, number> = {
  shoot: 1,
  either: 0,
  pump: -0.6, // el pump-fake suele preceder a un ataque a canasta, no a un tiro directo
};

const OFFBALL_CUT_VALUE: Record<string, number> = {
  catch_and_shoot: 1,
  flare: 0.7, // tiro tras bloqueo de flare — sigue siendo una amenaza de tiro en movimiento
  curl: -0.3, // el curl busca el aro, no el tiro inmediato
  catch_and_drive: -1,
};

/** +1 = prefiere penetrar, -1 = prefiere tirar de bote. */
const PNR_FINISH_LEAN: Record<string, number> = {
  "Drive to Rim": 1,
  Floater: 0.4,
  "Pull-up": -1,
  "Mid-range": -0.7,
};

/** true si juega de manejadora en PnR con frecuencia real (no una bloqueadora pura sin datos de finish). */
function isRealHandler(inputs: EnrichedInputs): boolean {
  const freqOk = inputs.pnrFreq === "P" || inputs.pnrFreq === "S";
  const isPureScreener = Boolean(inputs.screenerAction) && !inputs.pnrFinishLeft && !inputs.pnrFinishRight;
  const hasFinishData = Boolean(inputs.pnrFinishLeft || inputs.pnrFinishRight);
  return freqOk && !isPureScreener && hasFinishData;
}

function computeHandlerNote(inputs: EnrichedInputs, closeoutLight: CloseoutLight): HandlerNote | null {
  if (!isRealHandler(inputs)) return null;
  const values = [inputs.pnrFinishLeft, inputs.pnrFinishRight]
    .filter((v): v is NonNullable<typeof v> => v != null)
    .map((v) => PNR_FINISH_LEAN[v])
    .filter((v): v is number => v !== undefined);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const lean: HandlerLean = avg >= 0.3 ? "drives" : avg <= -0.3 ? "shoots" : "mixed";
  // El caso que Pablo pidió señalar: tira en el catch (rojo) pero de bote prefiere penetrar —
  // el "under" del bloqueo no la saca de su tiro, así que no hay que tratarla como pura tiradora ahí.
  const contradictsCloseout = closeoutLight === "red" && lean === "drives";
  return { lean, contradictsCloseout };
}

export function computeCloseoutThreat(
  inputs: EnrichedInputs,
  situations: RankedSituation[],
): CloseoutThreatReport {
  // Gate real: ¿hay ALGO scouteado de esta jugadora? Si el motor no detectó
  // ninguna situación ofensiva activa, no hay base para ningún color — ver
  // nota larga arriba sobre por qué esto reemplaza el gate por spotUpFreq.
  if (situations.length === 0) {
    return { light: "insufficient_data", index: null, watchDrive: false, handlerNote: null };
  }

  type Sig = { value: number; weight: number };
  const signals: Sig[] = [];

  if (inputs.spotUpAction && SPOT_ACTION_VALUE[inputs.spotUpAction] !== undefined) {
    const situW = Math.max(situationScore(situations, "catch_shoot"), 0.15);
    signals.push({ value: SPOT_ACTION_VALUE[inputs.spotUpAction], weight: situW });
  }
  if (inputs.offBallCutAction && OFFBALL_CUT_VALUE[inputs.offBallCutAction] !== undefined) {
    const situW = Math.max(situationScore(situations, "off_ball"), 0.15);
    signals.push({ value: OFFBALL_CUT_VALUE[inputs.offBallCutAction], weight: situW });
  }

  let light: CloseoutLight;
  let index: number | null;
  if (signals.length === 0) {
    light = "insufficient_data";
    index = null;
  } else {
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    if (totalWeight === 0) {
      light = "insufficient_data";
      index = null;
    } else {
      index = signals.reduce((s, sig) => s + sig.value * sig.weight, 0) / totalWeight;
      light = index >= RED_THRESHOLD ? "red" : index <= GREEN_THRESHOLD ? "green" : "yellow";
    }
  }

  // watchDrive: si no está marcada como tiradora en el catch, avisar cuando SÍ hay
  // señales reales de que ataca el aro en otras facetas (ISO o PnR con drive).
  let watchDrive = false;
  if (light !== "red") {
    const isoScore = situationScore(situations, "iso");
    const pnrScore = situationScore(situations, "pnr");
    const isoDrives =
      (inputs.isoStrongHandFinish === "drive" || inputs.isoWeakHandFinish === "drive") && isoScore >= 0.35;
    const pnrDrives =
      (inputs.pnrFinishLeft === "Drive to Rim" || inputs.pnrFinishRight === "Drive to Rim") && pnrScore >= 0.35;
    const offBallDrives = inputs.offBallCutAction === "catch_and_drive";
    watchDrive = isoDrives || pnrDrives || offBallDrives;
  }

  const handlerNote = computeHandlerNote(inputs, light);

  return { light, index, watchDrive, handlerNote };
}
