/**
 * shotZones.ts — Clasificación de zonas de tiro FIBA
 *
 * Calibrado con datos reales WCBA hotspotdata (verificado 2026-05-27, partido 1106508).
 * Verificación: 142 shots — match exacto PBP vs hotspot, 0 diferencias por jugadora.
 *
 * Sistema de coordenadas confirmado:
 *   - Cancha completa: 28m × 15m, normalizada 0–1
 *   - Aro Home: x=0.0575, y=0.5
 *   - Aro Away: x=0.9425, y=0.5
 *   - Away: normalizedX = 1 – pointX  (espejo solo en X, Y compartido)
 *   - Todos los cálculos con "aro en x=0.0575" tras normalizar
 *
 * Zonas FIBA (6):
 *   restricted_area    — ≤1.25m del aro
 *   paint_non_ra       — zona pintada FIBA (4.9m×5.8m) fuera de RA
 *   midrange_baseline  — mid-range por línea de fondo (fuera zona pintada)
 *   midrange_elbow     — mid-range zona codo/TL (lateral a la zona pintada)
 *   three_corner       — triple de esquina (≤3.0m de línea lateral)
 *   three_above_break  — triple arriba del arco
 *
 * Lado de ataque (bandSide):
 *   'left' | 'right' | 'center'  — relativo al ataque del equipo (Y < 0.5 = left)
 */

export type ShotZone =
  | 'restricted_area'
  | 'paint_non_ra'
  | 'midrange_baseline'
  | 'midrange_elbow'
  | 'three_corner'
  | 'three_above_break';

export type BandSide = 'left' | 'right' | 'center';

// ─── Constantes calibradas ────────────────────────────────────────────────────

const COURT_W    = 28.0;   // metros longitud total
const COURT_H    = 15.0;   // metros anchura total

const ARO_X_NORM = 0.0575; // aro Home en coordenadas normalizadas (0–1)
const ARO_Y_NORM = 0.5;    // eje Y centrado

// Umbrales FIBA en metros
const RA_RADIUS    = 1.25;  // restricted area
const PAINT_DEPTH  = 5.8;   // profundidad zona pintada desde línea de fondo
const PAINT_WIDTH  = 4.9;   // ancho zona pintada (±2.45m del centro)
const THREE_RADIUS = 6.75;  // distancia mínima triple
const CORNER_DIST  = 3.0;   // triples de esquina: ≤3.0m de línea lateral

// ─── Tipos de entrada/salida ──────────────────────────────────────────────────

/** Datos crudos de un shot del hotspot endpoint */
export interface ShotPoint {
  pointX:       number;
  pointY:       number;
  fgTypeStatus: boolean;          // true = made, false = missed
  playerId:     number;
  teamId:       number;
  teamType:     'Home' | 'Away' | string;
  period:       number;
  isStartLineUp: boolean;
  // Enriquecidos por classifyShots():
  zone?:         ShotZone;
  bandSide?:     BandSide;
  normalizedX?:  number;
  normalizedY?:  number;
  distToAroM?:   number;
}

export interface ZoneStat {
  zone:     ShotZone;
  attempts: number;
  made:     number;
  fgPct:    number;
}

// ─── Funciones principales ────────────────────────────────────────────────────

/**
 * Normaliza coordenadas al sistema "siempre atacando hacia x=0".
 * Home: sin cambio. Away: espejo en X.
 */
export function normalizeCoords(
  pointX: number,
  pointY: number,
  teamType: 'Home' | 'Away' | string,
): { nx: number; ny: number } {
  return {
    nx: teamType === 'Away' ? 1.0 - pointX : pointX,
    ny: pointY,
  };
}

/** Distancia al aro en metros desde coordenadas normalizadas (0–1). */
export function distToAroMeters(nx: number, ny: number): number {
  const dx = (nx - ARO_X_NORM) * COURT_W;
  const dy = (ny - ARO_Y_NORM) * COURT_H;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clasifica un tiro en una de las 6 zonas FIBA.
 *
 * @param pointX   coordenada X raw del hotspot (0–1, full court)
 * @param pointY   coordenada Y raw del hotspot (0–1, full court)
 * @param teamType 'Home' | 'Away'
 */
export function classifyZone(
  pointX: number,
  pointY: number,
  teamType: 'Home' | 'Away' | string,
): ShotZone {
  const { nx, ny } = normalizeCoords(pointX, pointY, teamType);
  const dist = distToAroMeters(nx, ny);

  // 1. Restricted area
  if (dist <= RA_RADIUS) return 'restricted_area';

  // 2. Paint (zona pintada FIBA fuera de RA)
  const xMeters  = nx * COURT_W;
  const yMeters  = ny * COURT_H;
  const aroXm    = ARO_X_NORM * COURT_W;
  const aroYm    = ARO_Y_NORM * COURT_H;
  const inPaintX = xMeters <= aroXm + PAINT_DEPTH;
  const inPaintY = Math.abs(yMeters - aroYm) <= PAINT_WIDTH / 2;
  if (inPaintX && inPaintY) return 'paint_non_ra';

  // 3. Triple
  if (dist > THREE_RADIUS) {
    const distFromSideline = Math.min(yMeters, COURT_H - yMeters);
    return distFromSideline <= CORNER_DIST ? 'three_corner' : 'three_above_break';
  }

  // 4. Mid-range
  // Fuera de la profundidad de la zona (por la línea de fondo) → baseline
  if (!inPaintX) return 'midrange_baseline';
  // Lateral a la zona (entre zona y arco de 3) → codo/elbow
  return 'midrange_elbow';
}

/**
 * Clasifica el lado de ataque de un tiro.
 * 'left': banda inferior (Y < 0.45), 'right': banda superior (Y > 0.55), 'center': resto.
 */
export function classifyBandSide(ny: number): BandSide {
  if (ny < 0.45) return 'left';
  if (ny > 0.55) return 'right';
  return 'center';
}

/**
 * Enriquece un array de ShotPoint con zone, bandSide, normalizedX, normalizedY, distToAroM.
 * Los nombres de campos son compatibles con el uso en pbp.ts.
 */
export function classifyShots(shots: ShotPoint[]): ShotPoint[] {
  return shots.map(s => {
    const { nx, ny } = normalizeCoords(s.pointX, s.pointY, s.teamType);
    return {
      ...s,
      zone:        classifyZone(s.pointX, s.pointY, s.teamType),
      bandSide:    classifyBandSide(ny),
      normalizedX: nx,
      normalizedY: ny,
      distToAroM:  distToAroMeters(nx, ny),
    };
  });
}

/** Agrega shots por zona → ZoneStat[] */
export function computeZoneStats(shots: ShotPoint[]): ZoneStat[] {
  const map = new Map<ShotZone, { made: number; att: number }>();
  for (const s of shots) {
    if (!s.zone) continue;
    const cur = map.get(s.zone) ?? { made: 0, att: 0 };
    cur.att++;
    if (s.fgTypeStatus) cur.made++;
    map.set(s.zone, cur);
  }
  return Array.from(map.entries()).map(([zone, { made, att }]) => ({
    zone,
    attempts: att,
    made,
    fgPct:    att > 0 ? Math.round((made / att) * 1000) / 10 : 0,
  }));
}
