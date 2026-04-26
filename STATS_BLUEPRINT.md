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
