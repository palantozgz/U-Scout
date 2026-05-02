/**
 * shotZones.ts — Clasificación de zonas de tiro para hotspotdata WCBA
 *
 * SISTEMA DE COORDENADAS (calibrado 2 mayo 2026, 2 partidos reales):
 *
 *   La API usa UN SOLO sistema global para toda la cancha (28m × 15m).
 *   NO normaliza cada equipo desde su propia línea de fondo.
 *
 *   pointX: 0.0 = línea de fondo equipo Home (izquierda en imagen)
 *           1.0 = línea de fondo equipo Away (derecha en imagen)
 *   pointY: 0.0 = banda inferior / 1.0 = banda superior
 *           (eje Y COMPARTIDO — no se invierte para Away)
 *
 *   ARO HOME: x≈0.0575, y≈0.501  ✅ confirmado con 3+ tiros desde el aro
 *   ARO AWAY: x≈0.9425, y≈0.501  ✅ simétrico (0.0575 + 0.9425 = 1.0)
 *
 *   Para clasificar tiros Away: transformar con (1 - pointX, pointY)
 *   El eje Y es compartido y NO se invierte.
 *
 * CONSTANTES FIBA (cancha completa 28m × 15m):
 *   Aro a 1.575m de línea de fondo → xNorm = 1.575/28 = 0.05625 ≈ 0.0575 ✅
 *   Zona restringida radio: 1.25m
 *   Línea de 3: 6.75m del aro
 *   Esquinas triple: 0.90m de banda → yNorm_límite = 0.90/15 = 0.060
 *   Zona TL: 3.60m ancho → halfY = 1.80/15 = 0.120
 *            5.80m largo → xNorm_max = (1.575 + 5.80)/28 = 0.2625
 */

const COURT_LENGTH_M = 28;
const COURT_WIDTH_M  = 15;

const ARO_HOME_X = 0.0575;
const ARO_HOME_Y = 0.5010;

const RA_RADIUS_M    = 1.25;
const THREE_RADIUS_M = 6.75;
const CORNER_BAND_M  = 0.90;

const PAINT_X_MAX  = (1.575 + 5.80) / COURT_LENGTH_M; // 0.2625
const PAINT_HALF_Y = 1.80 / COURT_WIDTH_M;             // 0.1200

export type BandSide = 'top_band' | 'center' | 'bottom_band';

export type ShotZone =
  | 'restricted_area'
  | 'paint_non_ra'
  | 'midrange_baseline'
  | 'midrange_elbow'
  | 'three_corner'
  | 'three_above_break'
  | 'unknown';

export interface ShotPoint {
  pointX: number;
  pointY: number;
  fgTypeStatus: boolean;
  playerId: number;
  playerName?: string;
  teamId: number;
  teamType: 'Home' | 'Away';
  period: number;
  isStartLineUp: boolean;
}

export interface ClassifiedShot extends ShotPoint {
  zone: ShotZone;
  bandSide: BandSide;   // posición en el eje Y: top_band / center / bottom_band
  distToAroM: number;
  normalizedX: number;
  normalizedY: number;
}

function distToAroMeters(nx: number, ny: number): number {
  const xM = (nx - ARO_HOME_X) * COURT_LENGTH_M;
  const yM = (ny - ARO_HOME_Y) * COURT_WIDTH_M;
  return Math.sqrt(xM * xM + yM * yM);
}

function normalizeToHome(shot: ShotPoint): { nx: number; ny: number } {
  if (shot.teamType === 'Away') return { nx: 1 - shot.pointX, ny: shot.pointY };
  return { nx: shot.pointX, ny: shot.pointY };
}

function getBandSide(ny: number): BandSide {
  if (ny < 0.44) return 'bottom_band';
  if (ny > 0.56) return 'top_band';
  return 'center';
}

export function classifyZone(shot: ShotPoint): ClassifiedShot {
  const { nx, ny } = normalizeToHome(shot);
  const distM = distToAroMeters(nx, ny);
  const yFromCenterM = Math.abs(ny - ARO_HOME_Y) * COURT_WIDTH_M;
  const bandDistM    = Math.min(ny, 1 - ny) * COURT_WIDTH_M;

  if (distM <= RA_RADIUS_M) {
    return { ...shot, zone: 'restricted_area', bandSide: getBandSide(ny), distToAroM: distM, normalizedX: nx, normalizedY: ny };
  }

  const inPaintX = nx <= PAINT_X_MAX;
  const inPaintY = yFromCenterM <= (PAINT_HALF_Y * COURT_WIDTH_M);

  if (inPaintX && inPaintY) {
    return { ...shot, zone: 'paint_non_ra', bandSide: getBandSide(ny), distToAroM: distM, normalizedX: nx, normalizedY: ny };
  }

  if (distM >= THREE_RADIUS_M) {
    if (bandDistM <= CORNER_BAND_M) {
      return { ...shot, zone: 'three_corner', bandSide: getBandSide(ny), distToAroM: distM, normalizedX: nx, normalizedY: ny };
    }
    return { ...shot, zone: 'three_above_break', bandSide: getBandSide(ny), distToAroM: distM, normalizedX: nx, normalizedY: ny };
  }

  if (inPaintX && !inPaintY) {
    return { ...shot, zone: 'midrange_baseline', bandSide: getBandSide(ny), distToAroM: distM, normalizedX: nx, normalizedY: ny };
  }

  return { ...shot, zone: 'midrange_elbow', bandSide: getBandSide(ny), distToAroM: distM, normalizedX: nx, normalizedY: ny };
}

export function classifyShots(shots: ShotPoint[]): ClassifiedShot[] {
  return shots.map(classifyZone);
}

export interface ZoneStats {
  zone: ShotZone;
  attempts: number;
  made: number;
  fgPct: number;
}

export function computeZoneStats(shots: ClassifiedShot[]): ZoneStats[] {
  const map = new Map<ShotZone, { attempts: number; made: number }>();
  for (const s of shots) {
    const e = map.get(s.zone) ?? { attempts: 0, made: 0 };
    map.set(s.zone, { attempts: e.attempts + 1, made: e.made + (s.fgTypeStatus ? 1 : 0) });
  }
  return Array.from(map.entries()).map(([zone, { attempts, made }]) => ({
    zone, attempts, made,
    fgPct: attempts > 0 ? Math.round((made / attempts) * 1000) / 10 : 0,
  }));
}

// npx tsx collector/src/sync/shotZones.ts
if (require.main === module) {
  const tests: ShotPoint[] = [
    // HOME — tiro desde el aro (x=0.0575) → restricted_area
    { pointX: 0.0575, pointY: 0.501,  fgTypeStatus: false, playerId: 415080, playerName: 'Cambage ARO',         teamId: 28173, teamType: 'Home', period: 1, isStartLineUp: true },
    // HOME — muy cerca del aro → restricted_area
    { pointX: 0.0365, pointY: 0.544,  fgTypeStatus: true,  playerId: 415080, playerName: 'Cambage RA',          teamId: 28173, teamType: 'Home', period: 3, isStartLineUp: true },
    // HOME — zona pintada → paint_non_ra
    { pointX: 0.1156, pointY: 0.562,  fgTypeStatus: false, playerId: 415080, playerName: 'Cambage paint',       teamId: 28173, teamType: 'Home', period: 1, isStartLineUp: true },
    // HOME — mid-range centro → midrange_elbow
    { pointX: 0.2003, pointY: 0.496,  fgTypeStatus: false, playerId: 517744, playerName: 'Howard mid',          teamId: 28173, teamType: 'Home', period: 1, isStartLineUp: true },
    // HOME — cerca línea 3, banda → three_corner o midrange_baseline
    { pointX: 0.2742, pointY: 0.169,  fgTypeStatus: true,  playerId: 18987,  playerName: 'TianGaoSong',         teamId: 28173, teamType: 'Home', period: 1, isStartLineUp: true },
    // HOME — más lejano del dataset (x=0.448) → three_above_break
    { pointX: 0.4483, pointY: 0.156,  fgTypeStatus: false, playerId: 18738,  playerName: 'Jasperchi 3pt',       teamId: 28173, teamType: 'Home', period: 4, isStartLineUp: true },
    // AWAY — aro Away espejado → restricted_area
    { pointX: 0.9425, pointY: 0.501,  fgTypeStatus: true,  playerId: 530931, playerName: 'Austin ARO Away',     teamId: 28175, teamType: 'Away', period: 3, isStartLineUp: true },
    // AWAY — cerca del aro → restricted_area
    { pointX: 0.9157, pointY: 0.577,  fgTypeStatus: true,  playerId: 530931, playerName: 'Austin RA Away',      teamId: 28175, teamType: 'Away', period: 2, isStartLineUp: true },
    // AWAY — esquina banda (y=0.033) → three_corner
    { pointX: 0.9373, pointY: 0.033,  fgTypeStatus: true,  playerId: 6560,   playerName: 'SongKexi corner',     teamId: 28175, teamType: 'Away', period: 2, isStartLineUp: true },
    // AWAY — triple arriba del arco (x=0.687) → three_above_break
    { pointX: 0.6871, pointY: 0.339,  fgTypeStatus: true,  playerId: 525760, playerName: 'KaraniBrown 3pt',     teamId: 28175, teamType: 'Away', period: 1, isStartLineUp: true },
    // AWAY — banda superior extrema (y=0.953) → three_corner
    { pointX: 0.9237, pointY: 0.953,  fgTypeStatus: false, playerId: 18731,  playerName: 'ZhangRu corner top',  teamId: 28175, teamType: 'Away', period: 3, isStartLineUp: true },
    // HOME — triple esquina inferior (x=0.060, y=0.018) → three_corner
    { pointX: 0.0601, pointY: 0.018,  fgTypeStatus: false, playerId: 530378, playerName: 'Ogunbauer corner',    teamId: 28173, teamType: 'Home', period: 4, isStartLineUp: false },
  ];

  console.log('\n=== SHOT ZONE CALIBRATION — WCBA 2 partidos ===\n');
  console.log('✓/✗  Player                       xRaw   yRaw   xNorm  dist(m)  zona');
  console.log('─'.repeat(88));

  for (const s of classifyShots(tests)) {
    const made  = s.fgTypeStatus ? '✓' : '✗';
    const name  = (s.playerName ?? '').padEnd(28);
    const xRaw  = s.pointX.toFixed(4).padEnd(7);
    const yRaw  = s.pointY.toFixed(4).padEnd(7);
    const xNorm = s.normalizedX.toFixed(4).padEnd(7);
    const dist  = s.distToAroM.toFixed(2).padEnd(8);
    console.log(`${made}  ${name} ${xRaw} ${yRaw} ${xNorm} ${dist} ${s.zone}`);
  }
}
