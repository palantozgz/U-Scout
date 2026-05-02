# U Stats — Blueprint técnico
> Documento de arquitectura. No es código. Es el diseño antes de implementar.
> Actualizado: 25 abr 2026 — COMPLETO ✅

---

## FILOSOFÍA
- Mismo principio que U Scout: máximo 3 outputs accionables por pantalla
- Heavy backend, light frontend
- El frontend nunca toca cba.net.cn — solo consulta nuestra API
- Una liga bien (WCBA) antes que muchas mal

---

## FILOSOFÍA DE RECOLECCIÓN

> **Recopilar todo. Filtrar en el output, nunca en la recolección.**
> Los datos crudos son baratos de almacenar y caros de volver a conseguir.
> Lo que hoy parece irrelevante mañana es la métrica que gana un partido.

El collector guarda absolutamente todo lo que devuelve la API WCBA: cada campo,
cada evento, cada coordenada. Railway calcula las métricas derivadas. La UI muestra
los outputs más influyentes. Pero en la recolección no se descarta nada.

---

## TODO LO QUE EXTRAEMOS

### Del endpoint `/api/v2/game/{gameId}/actions` — cada evento PBP:
```
gameId, quarter, clock (exacto), sequence
action_code (EN)         — parse y clasificación
action_title (ZH)        — guardar raw, nunca parsear
user_id                  — jugadora que actúa
team_id, action_owner_team
home_score, away_score   — marcador exacto en cada evento
                           → permite calcular: diferencial, rachas,
                             cambios de liderato, empates, momentum
```

### Campos calculados en el collector al procesar PBP:
```
rebound_type             — 'offensive'/'defensive'
                           REBOUND: team_id == team que acabó de fallar → ofensivo
assisted_by_external_id  — MADE precedido de evento mismo team distinto user_id
stint_id                 — tramo entre sustituciones (para lineup +/-)
players_on_court[]       — las 5 jugadoras en pista en cada momento
                           (acumulado desde SUB_IN/SUB_OUT)
score_differential       — home_score - away_score en cada evento
lead_change              — boolean: cambió el liderato
tie                      — boolean: empate en este evento
momentum_run             — puntos consecutivos del mismo equipo en curso
```

### Del endpoint `hotspotdata` — cada tiro:
```
pointX, pointY (raw)     — coordenadas originales, guardar siempre
normalizedX, normalizedY — sistema Home estandarizado
fgTypeStatus             — encestado/fallado
period, playerId, playerName, teamId, teamType, isStartLineUp

Campos calculados:
shot_zone                — 6 zonas FIBA calibradas
shot_band_side           — top_band / center / bottom_band
shot_dist_m              — distancia exacta al aro en metros
```

### Del endpoint `hotspotteam`:
```
JSON raw completo por equipo por partido   — guardar sin procesar
```

---

## MÉTRICAS DERIVADAS — calculadas en Railway sobre los datos crudos

### Por jugadora (tiros):
```
— Por zona
fg_pct_by_zone, shot_freq_by_zone
pts_per_shot_by_zone     — (2ó3) × fg_pct ← valor real de cada zona

— Distribución espacial
shot_x_mean, shot_y_mean     — centro de masa ofensivo
shot_x_std,  shot_y_std      — dispersión en cada eje
shot_spatial_entropy         — cuántas zonas usa (alta=versátil, baja=predecible)
shot_dist_mean, shot_dist_std

— Lateralidad
top_band_pct, bottom_band_pct
lateral_bias = |top_band_pct - 0.5| × 2   (0=centr.ada, 1=un solo lado)

— Perfil
paint_pct, midrange_pct, three_pct
corner_three_pct             — específicamente esquinas (el triple más eficiente)
```

### Por jugadora (PBP temporal):
```
pts_q1/q2/q3/q4
shot_attempts_q1/q2/q3/q4   — ¿suó o bajó el volumen?
early_game_fg_pct vs late_game_fg_pct

Clutch (Q4, clock<5:00, |diferencial|≤5):
  clutch_pts, clutch_fg_pct
  clutch_shot_zone            — ¿cambia de zona bajo presión?

big_run_involvement          — participación en rachas ≥5 puntos
```

### Por equipo (partido/temporada):
```
— Momentum y rachas
big_runs_for/against         — rachas ≥5 puntos
max_run_for/against          — máxima racha
lead_changes, times_tied
time_with_lead_pct

— Pace exacto desde PBP (no estimado)
possessions_count            — posesiones reales por partido
poss_per_40min               — ritmo real
time_per_poss_avg_sec        — velocidad de ataque en segundos

— Score differential
score_diff_max_for/against
q1/q2/q3/q4_winner           — qué cuartos gana

— Identidad táctica
team_paint_pct, team_three_pct, team_midrange_pct, team_corner_three_pct
team_shot_x_mean, team_shot_y_mean, team_shot_y_std
team_lateral_bias
team_pts_per_shot            — calidad de selección de tiro (shot quality)
team_spatial_entropy
```

### QUÉ DICE CADA MÉTRICA — valor de scouting:
```
lateral_bias alto (>0.6)     → ataca un solo lado → forzarla al lado débil
shot_spatial_entropy bajo    → predecible, pocas zonas
shot_dist_std alto           → versátil, amenaza en múltiples rangos
time_per_poss_avg <12s       → equipo de transición, no dar reb ofensivos
time_per_poss_avg >18s       → media pista, posesiones largas
corner_three_pct alto        → crean bien las esquinas, cuidar rotaciones
big_runs_for frecuentes      → equipo de rachas, cortarles el ritmo es clave
clutch_zone != normal_zone   → cambia el juego bajo presión
team_shot_y_std bajo         → bias lateral constante del equipo
```

### CAMPOS ADICIONALES EN stats_pbp — schema completo:
```sql
-- Ya decididos anteriormente:
shot_x NUMERIC, shot_y NUMERIC, shot_made BOOLEAN
shot_zone TEXT, shot_band_side TEXT

-- Añadir ahora:
shot_dist_m NUMERIC,           -- distancia exacta al aro en metros
rebound_type TEXT,             -- 'offensive' | 'defensive' | NULL
assisted_by_external_id INTEGER, -- player_id del asistente inferido
stint_id INTEGER,              -- tramo entre sustituciones
momentum_run INTEGER,          -- puntos consecutivos en curso del equipo
score_differential INTEGER,    -- home_score - away_score en este evento
lead_change BOOLEAN,           -- cambio de liderato
tie BOOLEAN                    -- empate
```



---

## INFRAESTRUCTURA DECIDIDA ✅

**Raspberry Pi 5 8GB** — comprada en Taobao (~1939 CNY con caja y cargador)
- Collector WCBA: scraper nightly + live sync en game days
- Siempre encendida en casa/club en China
- Consumo: ~3-5W idle, ~1-2€/mes electricidad
- Amortización vs Aliyun (~25€/mes): ~8 meses

**Remote management:**
- **Tailscale** — SSH desde móvil/Mac, gratis, funciona desde China
- **Bot Telegram** — `/status /sync /reboot` para día a día sin abrir terminal

**IA en producción:**
- Claude API (Railway) — para reports de calidad, coste negligible (~$0.05-0.10/report)
- Ollama en Pi — solo para batch nocturno experimental, no en ruta crítica
- ROG gaming con GPU — desarrollo y pruebas locales de modelos

**Test confirmado ✅ 25 abr 2026:**
```bash
curl -H "Referer: https://www.cba.net.cn/" \
     -H "Accept: application/json" \
     "https://www.cba.net.cn/datahub/cbamatch/rank/teamrankfirst?competitionId=56&seasonId=2092"
# → JSON de standings correcto desde red China
# → La Pi en la misma red funcionará igual
```

---

## API WCBA — ENDPOINTS CONFIRMADOS Y ESTRUCTURA

### 1. Menús de temporadas y rondas ✅
```
GET /datahub/cbamatch/games/matchmenus?competitionId=56&seasonId=2092
```
- `seasons[]` — 12 temporadas (2014-2026)
- `rounds[]` — roundIds 1-22 (regular) + 1-5 (playoffs)
- `teams[]` — 18 equipos con teamId y teamName_zh
- `currentPhaseId` — null si temporada terminada, valor si activa

**18 equipos 2025-2026:**
```
277   石家庄英励       710   江苏南钢         713   东莞新彤盛
717   福建金篮         723   山西竹叶青酒     726   武汉盛帆黄鹤
729   陕西榆林天泽     4900  四川蜀道远达     4913  新疆天山
19038 浙江稠州银行     20054 北京首钢园       20055 厦门银行
20064 上海浦发银行     20734 河南豫光金铅     20809 大连文体旅
20915 江西鲸裕清酒     20917 合肥文旅         21956 山东赤水河酒
```

**Temporadas históricas:**
```
2092→2025-26  1767→2024-25  1470→2023-24  1108→2022-23
873→2021-22   428→2020-21   253→2019-20   236→2018-19
```

### 2. Schedule ✅
```
GET /datahub/cbamatch/games/matchschedules
  ?competitionId=56&seasonId=2092&phaseId={1|2}&roundId={roundId}
```
- Regular: phaseId=1, roundId 1-22
- Playoffs: phaseId=2, roundId 1-5
- Iterar todos los roundIds para obtener todos los gameIds

```
GET /datahub/cbamatch/games/lastlymatch?competitionId=56&seasonId=2092
GET /datahub/cbamatch/games/lastlymatchschedule?competitionId=56&seasonId=2092
```

### 3. Standings ✅
```
GET /datahub/cbamatch/rank/teamrankfirst?competitionId=56&seasonId=2092
```
```typescript
interface WCBAStanding {
  teamId: number; teamName: string; teamLogo: string
  phaseId: string; phaseName: string  // "常规赛A组"|"常规赛B组"
  rank: number; wins: number; loses: number
  pts: number            // puntos anotados/partido
  losePts: number        // puntos recibidos/partido
  goalDifference: number // ≈ Net Rating en puntos
  winLoss: number        // racha (+/-)
  last10Win: number; last10Loses: number
  homeWin: number; homeLoses: number
  awayWin: number; awayLoses: number
}
```

### 4. Scores de partido ✅
```
GET /datahub/cbamatch/games/matchinfoscores?matchId=2603&gameId=1108582
```
- Scores por cuarto Q1-Q4
- gameStatus: 4=finalizado
- NO incluye stats por jugadora

### 5. Player stats ✅
```
GET /datahub/cbamatch/dc/playerbasicpage
  ?competitionId=56&seasonId=2092&phaseId={1|2}
  &teamId=0&roundSta=1&roundEnd=22
  &countType=1&page=1&size=50&sort=pts
```

### 6. PBP ✅
```
GET /api/v2/game/{gameId}/actions
```
556 eventos por partido. Array completo en una llamada.

```typescript
interface WCBAPBPAction {
  game_id: number
  current_period: number    // 1-4
  team_id: number
  home_score: number; away_score: number
  start_time: string        // "10:00" clock cuarto
  action_title: string      // texto chino — guardar raw, nunca parsear
  action_code: string       // "SUBOUT" — EN INGLÉS, usar para parseo
  action_id: string
  user_id: number           // ID jugadora
  action_owner_team: string // "Home" | "Away"
}

const ACTION_CODE_MAP: Record<string, string> = {
  'SUBOUT': 'sub_out', 'SUBIN': 'sub_in',
  'JUMPBALL': 'jumpball',
  'MADE2': 'shot_made', 'MISS2': 'shot_missed',
  'MADE3': 'shot_made_3', 'MISS3': 'shot_missed_3',
  'REBOUND': 'rebound', 'FOUL': 'foul',
  'FT_MADE': 'ft_made', 'FT_MISS': 'ft_missed',
  'TIMEOUT': 'timeout',
  // ampliar con más partidos
};
```

### 7. Shot Chart ✅ (confirmado 2 mayo 2026)
```
GET /datahub/cbamatch/games/hotspot/hotspotdata
  ?gameId=1108582&periods=1&periods=2&periods=3&periods=4
```
- ~27KB JSON por partido — todas las jugadoras, todos los cuartos en una sola llamada
- El filtrado por jugadora es **client-side** sobre el JSON completo (no hay param userId)
- Mismos headers requeridos: `Referer: https://www.cba.net.cn/`

```
GET /datahub/cbamatch/games/hotspot/hotspotteam?gameId=1108582
```
- ~4KB — agregado por equipo (zonas, no coordenadas individuales)
- Útil para el Opponent Report (tendencias de equipo por zona)

```typescript
// Estructura probable (confirmar con primer scrape real)
interface WCBAHotspotShot {
  userId: number       // ID jugadora — cruzar con stats_players.external_id
  x: number           // coordenada normalizada 0-1 sobre la cancha
  y: number           // coordenada normalizada 0-1
  made: boolean       // encestado o fallado
  period: number      // 1-4
  actionCode: string  // "MADE2" | "MISS2" | "MADE3" | "MISS3"
}
```

**Estrategia de ingest:** tras sincronizar PBP de un partido, hacer llamada adicional
a `hotspotdata` y escribir coordenadas en `stats_pbp.shot_x` / `shot_y` / `shot_made`
cruzando por `userId` + `period` + `clock`.

---

## RASPBERRY PI — COLLECTOR

### Stack
- Node.js 20 LTS + TypeScript
- axios con headers Referer cba.net.cn
- node-cron + PM2
- telegraf (bot Telegram)
- winston (logging)

### Headers requeridos
```typescript
const headers = {
  'Referer': 'https://www.cba.net.cn/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}
```

### Estructura
```
collector/
  index.ts          — entry point, cron setup
  config.ts         — env vars (seasonId, competitionId, API keys)
  client.ts         — axios instance
  sync/
    phases.ts       — matchmenus → fases y roundIds
    schedule.ts     — matchschedules iterando roundIds
    standings.ts    — teamrankfirst
    boxscores.ts    — matchinfoscores por gameId
    playerstats.ts  — playerbasicpage paginado
    pbp.ts          — api/v2/game/{id}/actions
  ingest.ts         — POST /api/stats/ingest con retry 3x
  bot.ts            — Telegram: /status /sync /reboot /season
  logger.ts         — winston
```

### Cron
```typescript
// Nightly 03:00 CST (19:00 UTC)
cron.schedule('0 19 * * *', async () => {
  await syncPhases();
  await syncSchedule();
  await syncStandings();
  await syncPlayerStats();
  await syncNewBoxscores();
  await syncNewPBP();
});

// Game day live cada 3 min
cron.schedule('*/3 * * * *', async () => {
  const game = await checkActiveGame();
  if (game?.status === 'live') {
    await syncLiveScore(game.gameId);
    await syncPBP(game.gameId);
  }
});

// Health 08:00 CST
cron.schedule('0 0 * * *', () => bot.sendDailyStatus());
```

---

## DATABASE SCHEMA (Supabase SQL Editor)

```sql
CREATE TABLE stats_leagues (
  id SERIAL PRIMARY KEY,
  name_en TEXT NOT NULL, name_zh TEXT,
  competition_id INTEGER UNIQUE,
  season_id INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stats_teams (
  id SERIAL PRIMARY KEY,
  league_id INTEGER REFERENCES stats_leagues(id),
  name_zh TEXT NOT NULL, name_en TEXT,
  logo_url TEXT,
  external_id INTEGER UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stats_players (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES stats_teams(id),
  name_zh TEXT NOT NULL, name_en TEXT,
  jersey INTEGER, position TEXT,
  is_foreign BOOLEAN DEFAULT false,
  external_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(external_id, team_id)
);

CREATE TABLE stats_games (
  id SERIAL PRIMARY KEY,
  league_id INTEGER REFERENCES stats_leagues(id),
  game_id INTEGER UNIQUE, match_id INTEGER,
  home_team_id INTEGER REFERENCES stats_teams(id),
  away_team_id INTEGER REFERENCES stats_teams(id),
  home_score INTEGER, away_score INTEGER,
  home_q1 INTEGER, home_q2 INTEGER, home_q3 INTEGER, home_q4 INTEGER,
  away_q1 INTEGER, away_q2 INTEGER, away_q3 INTEGER, away_q4 INTEGER,
  scheduled_at TIMESTAMPTZ,
  status TEXT, phase_id INTEGER, phase_name TEXT, round_id INTEGER,
  pbp_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stats_boxscores (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES stats_games(id),
  player_id INTEGER REFERENCES stats_players(id),
  team_id INTEGER REFERENCES stats_teams(id),
  minutes NUMERIC, pts NUMERIC, reb NUMERIC, ast NUMERIC,
  stl NUMERIC, blk NUMERIC, tov NUMERIC,
  fga NUMERIC, fgm NUMERIC, tpa NUMERIC, tpm NUMERIC,
  fta NUMERIC, ftm NUMERIC, eff NUMERIC,
  UNIQUE(game_id, player_id)
);

CREATE TABLE stats_season (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES stats_players(id),
  season_id INTEGER, phase_id INTEGER,
  games INTEGER,
  minutes NUMERIC, pts NUMERIC, reb NUMERIC, ast NUMERIC,
  stl NUMERIC, blk NUMERIC, tov NUMERIC,
  fgpct NUMERIC, tppct NUMERIC, ftpct NUMERIC, eff NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, season_id, phase_id)
);

CREATE TABLE stats_pbp (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES stats_games(id),
  quarter INTEGER, clock TEXT,
  event_type TEXT,           -- desde ACTION_CODE_MAP
  action_code TEXT,          -- raw de WCBA
  event_zh TEXT,             -- action_title original, nunca parsear
  player_id INTEGER REFERENCES stats_players(id),
  player_external_id INTEGER,
  team_id INTEGER REFERENCES stats_teams(id),
  home_score INTEGER, away_score INTEGER,
  action_owner_team TEXT,
  sequence INTEGER,
  shot_x NUMERIC,            -- coordenada x normalizada 0-1 (hotspotdata)
  shot_y NUMERIC,            -- coordenada y normalizada 0-1 (hotspotdata)
  shot_made BOOLEAN,         -- true=encestado, false=fallado, null=no es tiro
  UNIQUE(game_id, sequence)
);

CREATE TABLE stats_standings (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES stats_teams(id),
  season_id INTEGER, phase_id INTEGER, phase_name TEXT,
  rank INTEGER, wins INTEGER, losses INTEGER,
  win_pct NUMERIC,
  pts_per_game NUMERIC, pts_against_per_game NUMERIC,
  goal_diff NUMERIC, streak INTEGER, last10_wins INTEGER,
  home_wins INTEGER, home_losses INTEGER,
  away_wins INTEGER, away_losses INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, season_id, phase_id)
);

CREATE TABLE stats_insights_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT UNIQUE,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE stats_sync_log (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, status TEXT NOT NULL,
  records_processed INTEGER,
  error_message TEXT, duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## API ENDPOINTS RAILWAY

```
GET  /api/stats/dashboard          → next opponent + our last5 + top 3 alerts
GET  /api/stats/standings          → clasificación actual
GET  /api/stats/opponent/:teamId   → opponent report
GET  /api/stats/team/:teamId       → our team report
GET  /api/stats/player/:playerId   → player report

POST /api/stats/ingest             ← Pi only, Bearer STATS_INGEST_KEY
GET  /api/stats/admin/health       ← admin only
POST /api/stats/admin/sync         ← fuerza sync manual
```

---

## PANTALLAS UI (máx 3 outputs por pantalla)

### /stats — Home
```
┌─────────────────────────┐
│ PRÓXIMO RIVAL           │
│ 合肥文旅 · #1 B         │
│ Net +21.9 · Pace lento  │
│ ⚠ Elite ORB%            │
├─────────────────────────┤
│ NUESTRO EQUIPO · L5     │
│ Net +X · ↑/↓ tendencia  │
│ ⚠ [alerta principal]    │
├─────────────────────────┤
│ ALERTA CLAVE            │
│ [lo más importante hoy] │
└─────────────────────────┘
```

### /stats/standings — Tabla
rank · equipo · W-L · pts/g · +/- · racha

### /stats/opponent/:teamId
```
[Identidad]  nombre · record · grupo
[Métricas]   Net · eFG% · TOV% · ORB%
[Alertas]    máx 3 bullets
```

### /stats/player/:playerId
```
[Sparkline]  pts últimos 5
[Métricas]   TS% · Usage% · Min/g
[Flag]       🔥 Hot / ❄️ Cold / → Stable
```

---

## ORDEN DE CONSTRUCCIÓN

1. DB schema en Supabase SQL Editor
2. POST /api/stats/ingest en Railway
3. Collector Pi fase 1 — standings + schedule + boxscores
4. Stats Home UI con datos reales
5. Opponent Report UI
6. Collector Pi fase 2 — playerbasicpage
7. Player Trends UI
8. Collector Pi fase 3 — PBP
9. Métricas avanzadas desde PBP
10. Bot Telegram + Tailscale
11. Admin health panel

---

## RIESGOS

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| WCBA cambia JSON | Media | Tests de schema, alertas Telegram |
| seasonId cambia anual | Alta | Env var — matchmenus lo provee |
| action_code nuevos | Media | Log de unmapped codes |
| Pi se cae | Media | Bot Telegram avisa |
| user_id inconsistente | Desconocida | Triple clave: user_id + name_zh + team_id |
| Bundle creep | Baja | React.lazy, <120KB gzip |

## ESTADÍSTICAS Y GRÁFICAS — SPECS COMPLETAS

> Tenemos datos de TODA la liga WCBA (18 equipos, todas las temporadas desde 2014).
> No solo de nuestro equipo. Esto cambia radicalmente lo que se puede calcular.

---

### MÉTRICAS CALCULABLES — catálogo completo

#### Nivel liga / equipo (desde stats_boxscores + stats_standings + stats_games)

```
── EFICIENCIA OFENSIVA ──────────────────────────────────────────────────────
eFG%      = (FGM + 0.5 × 3PM) / FGA
            Ajusta FG% por el mayor valor de los triples. Mejor que FG% puro.

TS%       = PTS / (2 × (FGA + 0.44 × FTA))
            Eficiencia total incluyendo TL. La métrica de anotación más completa.

ORTG est. = (PTS / Posesiones) × 100
            Posesiones = FGA − ORB + TOV + 0.44 × FTA  (estimación sin PBP)
            Con PBP se calcula exacto: 1 posesión = termina en tiro/falta/pérdida.

── EFICIENCIA DEFENSIVA ─────────────────────────────────────────────────────
DRTG      = (PTS_contra / Posesiones_rival) × 100
            Calculable igual que ORTG pero con datos del equipo rival en stats_boxscores.

Net Rating = ORTG − DRTG  (equivalente numérico a pts_per_game − pts_against_per_game)
             Ya en standings como goalDifference, confirmar unidades.

── REBOTES ──────────────────────────────────────────────────────────────────
ORB%  = ORB_equipo / (ORB_equipo + DRB_rival)
        WCBA API da REB total, no split ofensivo/defensivo en boxscores básicos.
        DESDE PBP: un REBOUND con team_id = equipo que ACABA DE FALLAR → ofensivo.
        Con esto se puede calcular ORB split para cada partido.

DRB%  = DRB_equipo / (DRB_equipo + ORB_rival)  ← mismo enfoque PBP

TRB%  = (ORB + DRB) / (ORB + DRB + ORB_rival + DRB_rival)

── PÉRDIDAS Y AGRESIVIDAD ───────────────────────────────────────────────────
TOV%      = TOV / (FGA + 0.44 × FTA + TOV)  ← % de posesiones que terminan en pérdida
FT Rate   = FTA / FGA                        ← agresividad interior
3PA Rate  = 3PA / FGA                        ← identidad exterior vs interior
Pace est. = (FGA + 0.44 × FTA + TOV) / MIN × 5   ← posesiones/40min aprox

── CUATRO FACTORES (Dean Oliver) ────────────────────────────────────────────
Los 4 factores explican el ~95% de las victorias en baloncesto:
  1. Shooting:     eFG%            (peso ~40%)
  2. Turnovers:    TOV%            (peso ~25%)
  3. Rebounding:   ORB%            (peso ~20%)
  4. Free throws:  FT Rate         (peso ~15%)
Presentar los 4 en una card de equipo es el resumen más accionable posible.
```

#### Nivel jugadora (desde stats_boxscores + stats_season + stats_pbp)

```
── EFICIENCIA ────────────────────────────────────────────────────────────────
TS%         = PTS / (2 × (FGA + 0.44 × FTA))  ← mejor métrica individual de anotación
eFG%        = (FGM + 0.5 × 3PM) / FGA
AST/TOV     = AST / TOV                         ← control del balón
FT Rate     = FTA / FGA                         ← agresividad / falta provocada

── CREACIÓN / PLAYMAKING ────────────────────────────────────────────────────
AST%        = inferible desde PBP:
              Cada MADE2/MADE3 va precedido en el PBP de la secuencia de la jugada.
              Si el evento anterior es de la misma posesión y distinto user_id → asistencia.
              AST% = ASTs_mientras_en_pista / (FGM_compañeras_mientras_en_pista)
              NOTA: requiere cruzar SUB_IN/OUT con MADE para saber quién está en pista.
              Factible con los datos PBP disponibles.

AST_TO_RATIO estimado: si PBP da TURNOVER con user_id, se puede inferir pérdidas por jugadora
              aunque WCBA no garantiza que todos los turnovers tengan user_id asignado.

── REBOTES INDIVIDUALES ─────────────────────────────────────────────────────
ORB/g, DRB/g  → inferibles desde PBP igual que nivel equipo.
              REBOUND event + team_id del reboteador vs team_id del que falló → ofensivo/defensivo.

── IMPACTO ──────────────────────────────────────────────────────────────────
Plus/Minus  = ya en stats_boxscores (campo eff o calculable desde PBP)
Lineup +/-  = desde PBP: entre SUB_IN y SUB_OUT de cada jugadora,
              sumar home_score − away_score al entrar vs al salir.
              Calcular para unidades de 2, 3 y 5 jugadoras.
              Sample size en WCBA (~22 rondas regulares): suficiente para 2-man units,
              ajustado para 5-man units (requiere filtrar por mín. 50 posesiones juntas).

PIE (Player Impact Estimate) — NBA.com formula, CALCULABLE con liga completa:
  PIE = (PTS + FGM + FTM − FGA − FTA + DRB + 0.5×ORB + AST + STL + 0.5×BLK − PF − TOV)
        / (GamePTS + GameFGM + GameFTM − GameFGA − GameFTA + GameDRB +
           0.5×GameORB + GameAST + GameSTL + 0.5×GameBLK − GamePF − GameTOV)
  Necesita totales de todo el partido (ambos equipos) → calculable desde stats_boxscores
  agregando todos los jugadores del partido. Liga completa = contexto real para normalizar.

── TENDENCIA Y SPLITS ───────────────────────────────────────────────────────
L5 trend    = avg últimos 5 partidos vs season avg → 🔥 Hot (+15%) / ❄️ Cold (-15%) / → Stable
Home/Away   = split cruzando stats_boxscores.game_id con stats_games.home_team_id
Por cuarto  = desde PBP: PTS/AST/REB en Q1/Q2/Q3/Q4 por jugadora
Clutch      = desde PBP: eventos con quarter=4, clock<"05:00", |home−away|≤5
Usage%      = (FGA + 0.44×FTA + TOV) / (MIN × equipo_FGA_por_min × 5)
              Aproximable desde boxscores si MIN es fiable.
```

---

### VISUALIZACIONES — specs por pantalla

#### /stats — Home dashboard (3 cards, máximo 3 datos por card)
```
┌─────────────────────────────────────────┐
│ PRÓXIMO RIVAL           [nombre equipo] │
│ Rank #X · W-L · Grupo A/B              │
│ Net: +21.9 · eFG%: 52.3 · TOV%: 14.1  │
│ ⚠ Líder ofensiva: [nombre] — TS% 58    │
├─────────────────────────────────────────┤
│ NUESTRO EQUIPO · L5                     │
│ Net: +X.X ↑/↓/→  eFG%: XX.X            │
│ ⚠ [alerta más urgente del equipo]       │
├─────────────────────────────────────────┤
│ DATO DE LIGA HOY                        │
│ [insight de contexto liga — racha, etc] │
└─────────────────────────────────────────┘
```

#### /stats/standings — Clasificación
```
VISTA TABLA:
  Columnas: Rank · Equipo · W-L · Net · eFG% · Racha visual (●●●○●)
  Ordenable por cualquier columna
  Grupos A y B separados

VISTA GRÁFICA (toggle):
  Bar chart horizontal: Net Rating todos los equipos, coloreado por grupo
  Referencia visual: línea de net=0
```

#### NAVEGACIÓN — Arquitectura completa
```
/stats
  └── Toggle superior: [EQUIPOS]  [JUGADORAS]
      (persiste en localStorage)

  MODO EQUIPOS → /stats/teams
    └── Lista 18 equipos (card: nombre · W-L · Net · Pace)
        └── tap equipo → /stats/team/:teamId
            ├── Datos colectivos (Cuatro Factores, Radar, Lineup +/-)
            ├── Tap jugadora en Top 3 → /stats/player/:playerId (breadcrumb ← Equipo)
            └── Botón «Ver jugadoras» → /stats/team/:teamId/players
                └── Lista con buscador, tap → /stats/player/:playerId

  MODO JUGADORAS → /stats/players
    ├── [🔍 Buscar por nombre...]
    ├── [Equipo ▾]  [Pos ▾]  [MIN≥ ▾]  [Orden: TS% ▾]
    └── Lista paginada (20/página)
        └── tap → /stats/player/:playerId
            └── Botón «Ver equipo» → /stats/team/:teamId (breadcrumb ← Jugadora)

  COMPARTIDAS (accesibles desde ambos modos):
    /stats/standings      — clasificación
    /stats/bubble         — scatter chart liga
    /stats/compare        — comparador
    /stats/shotchart/:id  — shot chart individual
    /stats/lineups/:teamId — lineup +/-

  CROSS-NAV bidireccional:
    /stats/team/:teamId    → tap jugadora en cualquier lista = /stats/player/:playerId
    /stats/player/:playerId → tap equipo = /stats/team/:teamId
    /stats/bubble           → tap burbuja = /stats/player/:playerId
    Breadcrumb siempre visible: ← [pantalla anterior]
```

**Filtros en /stats/players** — client-side sobre cache TanStack, sin endpoint nuevo:
```
Buscador: texto libre (nombre zh o en)
Equipo:   dropdown 18 equipos
Posición: G / F / C / Todas
MIN/g:    ≥5 / ≥10 / ≥15 / ≥20
Orden:    PTS · REB · AST · TS% · PIE · FGA/g (desc)
```

---

#### /stats/teams — Lista equipos
```
Card por equipo (compact):
  [Logo] Nombre equipo    W-L
  Net: +12.3  Pace: 78.4  eFG%: 53.1
  Racha: ●●●●○

Ordenable por: Net · W% · eFG% · Pace
Grupos A / B como secciones separadas
```

#### /stats/team/:teamId — Equipo colectivo
```
Card 1 — Identidad + métricas clave:
  nombre · W-L · grupo · Net Rating
  Pace: 78.4  ←  VISIBLE porque cambia la preparación
    Pace alto (>82): equipo de transición, preparar defensa rápida
    Pace bajo (<70): partido de media pista, posesiones largas

Card 2 — Radar 5 ejes vs liga media:
  eFG% / TOV% / ORB% / FT Rate / Pace
  (Net Rating fuera del radar: es diferencial, distorsiona el polígono)
  Dos polígonos: equipo (color) + liga media (gris punteado)

Card 3 — Cuatro Factores + Pace, tabla vs liga:
             Equipo   Liga    Δ
  eFG%       53.1%   49.2%   ↑+3.9  🔴 difícil de defender
  TOV%       12.4%   15.1%   ↓-2.7  🟢 cuidan el balón
  ORB%       31.2%   27.8%   ↑+3.4  🔴 buscan el rebote
  FT Rate    0.28    0.24    ↑+0.04 🔴 buscan el foul
  Pace       78.4    74.2    ↑+4.2  🟡 equipo rápido
  Icono: 🔴=amenaza defensiva / 🟢=debilidad aprovechable / 🟡=neutral

Card 4 — Top 3 amenazas del equipo:
  Jugadoras con mayor PIE. Con TS%, L5 flag, tap → /stats/player/:playerId

Card 5 — Lineup +/- (si hay PBP):
  Top 3 unidades de 2-man más usadas con +/- per 100 pos
  «Ver todas» → /stats/lineups/:teamId

Botón fijo abajo: «Ver jugadoras →» → /stats/team/:teamId/players
```

#### /stats/player/:playerId — Player Profile
```
Header:
  nombre · equipo (tap = /stats/team/:teamId) · MIN/g · PTS/g · flag 🔥/❄️/→

Sparklines (últimas 5 salidas):
  Tres líneas mini en fila: PTS | REB | AST
  Valor actual vs promedio (punto de referencia horizontal)

4 chips de métricas:
  TS%   AST/TOV   PIE   ORB+DRB/g
  Todos con comparación vs liga (↑↓ coloreado)

Split card — Casa vs Fuera:
        Casa   Fuera
  PTS   18.4   14.2
  REB    7.1    5.8
  AST    3.2    2.1

Por cuartos — bar chart Q1/Q2/Q3/Q4:
  PTS por cuarto. Identifica jugadoras de Q4 o que decaen.

Clutch (solo si ≥20 eventos clutch en PBP):
  PTS/MIN clutch vs normal. Si no hay suficiente muestra, no mostrar.

Shot chart thumbnail (si hay PBP):
  Preview pequeño half-court. Tap → /stats/shotchart/:playerId

Botón: «Comparar» → /stats/compare con esta jugadora preseleccionada
```

#### /stats/shotchart/:playerId — Shot Chart
```
Fase 3 — requiere PBP sincronizado.

Cancha half-court SVG normalizada.
Dots: 🟢 encestado / 🔴 fallado, tamaño uniforme.

Filtros toggle superiores:
  [Temporada] [Últimos 5] [Por cuarto: Q1|Q2|Q3|Q4]

6 zonas FIBA (ver sección calibración más abajo):
  % FG por zona como overlay al activar toggle «Zonas»

Variante hexagonal (si ≥50 tiros/zona):
  Hexágono por zona: tamaño=frecuencia, color=eFG% vs liga
  Verde=por encima liga / Rojo=por debajo
```

#### /stats/lineups/:teamId — Lineup stats
```
Fase 3 — requiere PBP sincronizado.

Tabs: [2-man] [5-man]
2-man: top 10 unidades por minutos juntas → +/- per 100 pos, MIN juntas
5-man: top 5 con ≥50 posesiones → +/- per 100 pos
Filtro: temporada completa / últimos N partidos
```

#### /stats/compare — Comparador de jugadoras
```
Selector: hasta 3 jugadoras (de cualquier equipo)
Radar chart superpuesto — 6 ejes normalizados 0-100 vs liga:
  PTS · REB · AST · TS% · ORB% · PIE
Cada jugadora: polígono de color distinto
Cap en 3: con 4+ el radar se vuelve ilegible → mostrar máx 3
Alternativa para 4+: tabla comparativa side-by-side
```

#### /stats/bubble — Bubble chart liga
```
ScatterChart Recharts (ya en bundle).
Eje X: FGA/game  (volumen / frecuencia de uso)
Eje Y: TS%        (eficiencia real)
Tamaño burbuja: MIN/game (peso estadístico — burbujas grandes = muestra fiable)
Color: equipo
Tooltip: nombre · equipo · PTS/g · TS% · FGA/g · MIN/g
Línea horizontal: TS% media de liga
Línea vertical: FGA/g media de liga
→ 4 cuadrantes: estrellas (alto vol + alta ef) / dependientes (alto vol + baja ef)
               eficientes (bajo vol + alta ef) / rol players (bajo vol + baja ef)
Tap burbuja → /stats/player/:playerId
```

#### /stats/standings — Clasificación
```
Vista TABLA (default):
  Columnas: # · Equipo · W-L · Net · eFG% · Pace · Racha (●●●●○)
  Ordenable por cualquier columna
  Grupos A y B como secciones separadas
  Tap fila → /stats/team/:teamId

Vista GRÁFICA (toggle):
  Bar chart horizontal Net Rating todos los equipos
  Coloreado por grupo (A=azul, B=naranja)
  Tu equipo destacado con borde primario
  Línea vertical en Net=0
```

---

### NOTAS TÉCNICAS DE IMPLEMENTACIÓN

#### Cálculo ORB split desde PBP
```typescript
// En sync/pbp.ts, al procesar cada REBOUND:
// El evento anterior en la misma posesión es un MISS2 o MISS3.
// Si team_id del reboteador === team_id del que falló → OFENSIVO
// Si team_id del reboteador !== team_id del que falló → DEFENSIVO
// Guardar en stats_pbp.event_type: 'rebound_off' | 'rebound_def'
```

#### Cálculo AST% desde PBP
```typescript
// Secuencia en PBP de una canasta asistida:
// [evento N]: action_code = 'MADE2', user_id = tirador, team_id = X
// [evento N-1 o N-2 mismo team en misma posesión]: si existe un evento
//   del mismo team con user_id distinto justo antes → cuenta como asistencia
// Guardar en stats_pbp: campo 'assisted_by_external_id' INTEGER nullable
```

#### Cálculo Lineup +/- desde PBP
```typescript
// Para cada stint (tramo entre sustituciones):
//   - Jugadoras en pista: estado acumulado desde SUB_IN/SUB_OUT
//   - Score al inicio del stint: home_score, away_score del primer evento
//   - Score al final: del último evento antes de la siguiente sub
//   - Diferencial del stint: (score_fin_home - score_ini_home) ×
//     (1 si nuestro equipo es home, -1 si away)
// Acumular por combinación de player_external_ids[]
// Guardar en tabla nueva: stats_lineup_stints o calcular en Railway on-demand
```

#### PIE — cálculo por partido
```typescript
// Desde stats_boxscores de un partido:
// GamePTS = suma PTS de todos los jugadores del partido (ambos equipos)
// GameFGM = suma FGM, etc.
// PIE_jugadora = numerador_jugadora / denominador_juego
// Promediable por temporada: avg(PIE por partido)
// Contexto WCBA liga completa: all 18 equipos → distribución real normalizada
```

---

### CALIBRACIÓN ZONAS DE TIRO — hotspotdata WCBA

**CALIBRADO Y VERIFICADO 2 mayo 2026** con 2 partidos reales (12 tiros de referencia).

Resultados del script de verificación (`npm run calibrate`):
```
Cambage ARO (x=0.0575)     → restricted_area   dist=0.00m  ✅
Cambage RA  (x=0.036)      → restricted_area   dist=0.87m  ✅
Cambage paint (x=0.116)    → paint_non_ra      dist=1.87m  ✅
Howard mid  (x=0.200)      → paint_non_ra      dist=4.00m  ✅ (dentro zona TL)
TianGaoSong (x=0.274)      → three_above_break dist=7.85m  ✅
Jasperchi   (x=0.448)      → three_above_break dist=12.10m ✅
Austin ARO Away (x=0.9425) → restricted_area   dist=0.00m  ✅ (espejo perfecto)
Austin RA Away  (x=0.916)  → paint_non_ra      dist=1.36m  ✅ (11cm fuera de RA, correcto)
SongKexi corner (y=0.033)  → three_corner      dist=7.02m  ✅
KaraniBrown 3pt (x=0.687)  → three_above_break dist=7.55m  ✅
ZhangRu corner  (y=0.953)  → three_corner      dist=6.80m  ✅
Ogunbauer corner (y=0.018) → three_corner      dist=7.25m  ✅
```

Sistema de coordenadas confirmado:
- Cancha completa 28m × 15m, UN SOLO sistema global
- ARO HOME: x=0.0575, y=0.501
- ARO AWAY: x=0.9425, y=0.501 (simétrico)
- Eje Y compartido — NO se invierte para Away
- Away normalizado con (1 - pointX, pointY)

Archivo: `collector/src/sync/shotZones.ts`
Script:  `cd collector && npm run calibrate`

**Una vez confirmado el sistema de coordenadas**, la función de clasificación:

```typescript
// collector/src/sync/shotZones.ts
// Cancha FIBA half-court: 14m largo x 15m ancho
// Aro a 1.575m de la línea de fondo, centrado horizontalmente
// Radio zona restringida: 1.25m
// Línea de 3: 6.75m del centro del aro (excepto esquinas a 0.9m de la línea lateral)

export type ShotZone =
  | 'restricted_area'    // pintura restringida <1.25m del aro
  | 'paint_non_ra'       // dentro de la zona pero fuera de restricted area
  | 'midrange_baseline'  // mid-range cerca de la línea de fondo
  | 'midrange_elbow'     // mid-range zona del codo / línea de TL
  | 'three_corner'       // triple desde las esquinas
  | 'three_above_break'  // triple arriba del arco
  | 'unknown';           // fuera de rango o coordenadas nulas

// PLACEHOLDER — reemplazar con valores reales tras ver el JSON
// Asumiendo coordenadas normalizadas 0-1:
// x=0 es línea de fondo donde está el aro, x=1 es la línea de medio campo
// y=0 es la banda izquierda, y=1 es la banda derecha
// Aro en: x=0.112, y=0.5 (1.575m / 14m = 0.112)

const ARO = { x: 0.112, y: 0.5 }; // PENDIENTE CONFIRMAR
const RA_RADIUS = 0.089;           // 1.25m / 14m = 0.089
const THREE_DIST = 0.482;          // 6.75m / 14m = 0.482
const CORNER_Y = 0.06;             // 0.9m / 15m = 0.06 desde banda
const PAINT_X = 0.271;             // 3.6m (zona TL) / 14m
const PAINT_Y = 0.167;             // 2.45m (semianchura zona) / 15m = 0.163 cada lado

function distToAro(x: number, y: number): number {
  return Math.sqrt((x - ARO.x) ** 2 + (y - ARO.y) ** 2);
}

export function classifyZone(x: number | null, y: number | null): ShotZone {
  if (x == null || y == null) return 'unknown';

  const d = distToAro(x, y);
  const isCorner = (y < CORNER_Y || y > 1 - CORNER_Y) && x < PAINT_X * 2;
  const inPaint = x < PAINT_X && y > (0.5 - PAINT_Y) && y < (0.5 + PAINT_Y);
  const isThree = d > THREE_DIST;

  if (d <= RA_RADIUS) return 'restricted_area';
  if (inPaint) return 'paint_non_ra';
  if (isThree && isCorner) return 'three_corner';
  if (isThree) return 'three_above_break';
  if (x < PAINT_X * 0.8) return 'midrange_baseline';
  return 'midrange_elbow';
}

// Guardar shot_zone en stats_pbp para no recalcular en cada query
// ALTER TABLE stats_pbp ADD COLUMN IF NOT EXISTS shot_zone TEXT;
```

**Proceso de calibración** (cuando llegue el JSON real):
1. Identificar 5 tiros de referencia visualmente claros en la UI (aro, esquina, línea de 3, etc)
2. Comparar sus coordenadas JSON con su posición visual
3. Calcular factor de escala y offset del origen
4. Ajustar las constantes ARO, RA_RADIUS, THREE_DIST, etc.
5. Verificar con otros partidos que las zonas son consistentes

**Campo adicional en schema** (añadir a la migración de stats_pbp):
```sql
ALTER TABLE stats_pbp ADD COLUMN IF NOT EXISTS shot_zone TEXT;
ALTER TABLE stats_pbp ADD COLUMN IF NOT EXISTS shot_band_side TEXT;
COMMENT ON COLUMN stats_pbp.shot_zone IS
  'Zona clasificada: restricted_area|paint_non_ra|midrange_baseline|midrange_elbow|three_corner|three_above_break';
COMMENT ON COLUMN stats_pbp.shot_band_side IS
  'Lado del tiro en eje Y normalizado: top_band (y>0.56) | center (0.44-0.56) | bottom_band (y<0.44)';
```

---



### 1. Ingest endpoint Railway — ampliar para nuevos types
El endpoint `POST /api/stats/ingest` actual solo maneja el formato legacy
(`player_stats` plano). Hay que ampliarlo para manejar:
- `standings` → upsert en `stats_standings`
- `schedule`  → upsert en `stats_games` + crear `stats_teams` si no existen
- `boxscores` → upsert en `stats_boxscores` + actualizar `stats_games.status`
- `player_stats` → upsert en `stats_season` + crear `stats_players` si no existen
- `pbp`        → bulk insert en `stats_pbp` con `ON CONFLICT (game_id, sequence) DO NOTHING`
**Hacer en sesión Railway/backend cuando el SSD esté instalado y se pueda probar end-to-end.**

### 2. DB schema — ejecutar en Supabase SQL Editor
El CREATE TABLE completo del blueprint (con shot_x/y/made ya incluidos).
Si las tablas stats_* ya existen de la sesión 25 abr 2026, ejecutar solo
la migración de la sección "MIGRACIONES PENDIENTES".

### 3. Bot Telegram — telecontrol completo de la Pi
Comandos implementados: `/status` `/sync` `/reboot` `/season`
Comandos pendientes de añadir a `bot.ts`:
```
/logs [N]       — últimas N líneas de combined.log (default 20)
/errors         — últimas 10 líneas de error.log
/setseason XXXX — cambia WCBA_SEASON_ID en runtime sin reiniciar
/games          — lista partidos sincronizados vs pendientes
/test           — hace una llamada a standings y reporta si la API responde
```
Funcionalidad de alertas automáticas pendiente:
- Alerta si sync nocturno falla 2 noches seguidas
- Alerta si se detecta un `action_code` no mapeado en ACTION_CODE_MAP
- Alerta si la Pi lleva >30min sin hacer requests (posible caída de red)

### 4. STATS_INGEST_KEY — añadir en Railway env vars
Var pendiente de configurar en Railway dashboard:
`STATS_INGEST_KEY=<generar con openssl rand -hex 32>`

### 5. Collector — primer run y verificación
Tras instalar SSD y deployar:
1. Verificar que standings devuelve datos: `/test` via Telegram
2. Verificar que `POST /api/stats/ingest` acepta el payload
3. Forzar sync manual: `/sync` via Telegram
4. Verificar en Supabase que las tablas se popularon
5. Probar un gameId conocido para PBP + shot chart

---



### Shot chart — añadir a stats_pbp (2 mayo 2026)
Ejecutar si la tabla ya existe en producción:
```sql
ALTER TABLE stats_pbp
  ADD COLUMN IF NOT EXISTS shot_x NUMERIC,
  ADD COLUMN IF NOT EXISTS shot_y NUMERIC,
  ADD COLUMN IF NOT EXISTS shot_made BOOLEAN;

COMMENT ON COLUMN stats_pbp.shot_x    IS 'Coordenada x normalizada 0-1 desde hotspotdata WCBA';
COMMENT ON COLUMN stats_pbp.shot_y    IS 'Coordenada y normalizada 0-1 desde hotspotdata WCBA';
COMMENT ON COLUMN stats_pbp.shot_made IS 'true=encestado false=fallado null=evento no es tiro';
```
