# FORMULAS_STATS.md
> Generado 2026-05-23 leyendo `server/routes.ts` + búsqueda en literatura externa.
> Estado: ✅ correcto · ⚠️ desviación conocida vs estándar · ❌ bug confirmado

---

## Fuentes de datos

| Tabla | Contenido | Notas |
|---|---|---|
| `stats_player_boxscores` | fgm/fga, tpm/tpa, ftm/fta, pts, reb, ast, stl, blk, tov, off_reb, def_reb, fouls, plus_minus, minutes (TEXT "MM:SS") | teamId NO viene del API; team_external_id derivado en ingest |
| `stats_games` | home_score, away_score, status, season_id, scheduled_at | status=4 = partido finalizado |
| `stats_pbp` | game_id, quarter, sequence, clock ("MM:SS"), event_type, action_code, team_id | 116.700 eventos. shot_x/y/zone = 0 rows |
| `stats_standings` | wins, losses, pts_per_game, pts_against_per_game, win_pct, streak | Datos oficiales WCBA API |

---

## Métricas por jugadora — `/api/stats/player/:id` y `/api/stats/players`

### PPG / RPG / APG / SPG / BPG / TOPg

| Campo | Fórmula en código | Fórmula estándar | Estado |
|---|---|---|---|
| ppg | `AVG(pb.pts)` | Media aritmética por partido | ✅ |
| rpg | `AVG(pb.reb)` | Media reb totales (off+def) | ✅ |
| apg | `AVG(pb.ast)` | Media asistencias | ✅ |
| spg | `AVG(pb.stl)` | Media robos | ✅ |
| bpg | `AVG(pb.blk)` | Media tapones | ✅ |
| topg | `AVG(pb.tov)` | Media pérdidas | ✅ |
| mpg | `AVG((min*60+sec)/60)` filtrando `minutes ~ '^\d+:\d{2}$'` | Media minutos | ✅ |

### Porcentajes de tiro

| Campo | Fórmula en código | Fórmula estándar (FIBA/BBRef) | Estado |
|---|---|---|---|
| fgPct | `SUM(fgm)/SUM(fga)*100` | FG% = FGM/FGA | ✅ |
| fg3Pct | `SUM(tpm)/SUM(tpa)*100` | 3P% = 3PM/3PA | ✅ |
| ftPct | `SUM(ftm)/SUM(fta)*100` | FT% = FTM/FTA | ✅ |
| tsPct | `SUM(pts) / (2*(SUM(fga)+0.44*SUM(fta))) * 100` | TS% = PTS/(2*(FGA+0.44*FTA)) | ✅ |
| eFGPct | `(SUM(fgm)+0.5*SUM(tpm)) / SUM(fga) * 100` | eFG% = (FGM+0.5*3PM)/FGA | ✅ |

> Nota: fgPct incluye triples en numerador y denominador (estándar). eFGPct pondera los triples con 0.5 adicional.

### Métricas avanzadas de jugadora

#### FT Rate

```
ftRate = SUM(fta) / SUM(fga)
```

Estándar BBRef: FTr = FTA/FGA. Ratio sin multiplicar por 100.  
Estado: ✅ (coincide con BBRef definition)

#### AST/TOV Ratio

```
astTovRatio = SUM(ast) / SUM(tov)   [NULLIF tov=0]
```

Estándar: AST/TOV acumulado de temporada. ✅

#### ORB / DRB per game

```
orbPerGame = AVG(pb.off_reb)
drbPerGame = AVG(pb.def_reb)
```

✅ — depende de que `off_reb`/`def_reb` estén bien separados en boxscores. Confirmado: estos campos existen y tienen datos.

#### PIE (Player Impact Estimate)

```sql
player_num = pts + fgm + ftm - fga - fta
             + def_reb + 0.5*off_reb
             + ast + stl + 0.5*blk - fouls - tov

game_den   = SUM(player_num) sobre TODOS los jugadores del partido

PIE = AVG(100 * player_num / game_den)   [promediado sobre partidos]
```

Estándar NBA/BBRef: misma fórmula. Valor ~10% = jugadora media.  
Estado: ✅

#### USG% (Usage Rate)

```sql
-- Por partido:
player_poss = fga + 0.44*fta + tov
team_poss   = SUM(team: fga + 0.44*fta + tov)
player_min  = minutos jugados (en segundos)
team_min    = SUM(team: minutos) -- 5 jugadoras simultáneas

USG% = 100 * SUM(player_poss * (team_min/5))
            / SUM(player_min * team_poss)
```

Estándar BBRef: `USG% = 100 * (FGA + 0.44*FTA + TOV) * (Tm MP / 5) / (MP * (Tm FGA + 0.44*Tm FTA + Tm TOV))`  
Estado: ✅ — implementación correcta. Filtra `minutes ~ '^\d+:\d{2}$'` para evitar valores corruptos.

---

## Métricas por equipo — `/api/stats/team/:id`

### Básicas de standings

Provienen directamente de `stats_standings` (API WCBA oficial): wins, losses, ppg, oppg, win_pct, streak, last10, home/away splits. No calculadas localmente.  
Estado: ✅ (fuente oficial)

### eFGPct de equipo

```
eFGPct = (SUM(fgm) + 0.5*SUM(tpm)) / SUM(fga) * 100
```
✅

### TOV% de equipo

```
tovPct = SUM(tov) / (SUM(fga) + 0.44*SUM(fta) + SUM(tov)) * 100
```

Estándar: TOV% = TOV/(FGA+0.44*FTA+TOV). Mide qué porcentaje de posesiones acaban en pérdida.  
Estado: ✅

### FT Rate de equipo

```
ftRate = SUM(fta) / SUM(fga)
```
✅

### ORB% / DRB% de equipo

```sql
own_orb  = SUM(off_reb)   [equipo propio, en partidos propios]
rival_drb = SUM(def_reb)  [rival en esos mismos partidos]
own_drb  = SUM(def_reb)   [equipo propio]
rival_orb = SUM(off_reb)  [rival]

ORB% = 100 * own_orb  / (own_orb  + rival_drb)
DRB% = 100 * own_drb  / (own_drb  + rival_orb)
```

Estándar BBRef: ORB% = ORB / (ORB + Opp DRB). Requiere datos del rival en los mismos partidos.  
Estado: ✅ — query correcta con `rival_reb` CTE filtrada a partidos propios.

### Offensive/Defensive Rating (ORTG/DRTG)

```sql
-- Posesiones estimadas (Pace formula Dean Oliver):
poss = fga + 0.44*fta + tov - off_reb

ORTG = 100 * team_pts_season / SUM(poss_own)
DRTG = 100 * opp_pts_season  / SUM(poss_rival_in_own_games)
netRtg = ORTG - DRTG
```

Estándar: Dean Oliver / BBRef. Posesiones = FGA + 0.44*FTA + TOV - ORB.  
Estado: ⚠️ **Desviación menor**: el estándar BBRef añade un ajuste por rebotes ofensivos (`- ORB`). El código usa `fga + 0.44*fta + tov - off_reb` = correcto. Sin embargo `rival_box` CTE incluye TODOS los rivales en esos partidos pero no filtra exactamente el equipo rival del partido (toma todos los que no son el equipo propio en esos game_ids). Para equipos con 1 rival por partido esto es correcto.

### PPP ofensivo/defensivo

```
pppOf  = SUM(team_pts) / SUM(poss_own)
pppDef = SUM(opp_pts)  / SUM(poss_rival)
```

PPP = ORTG/100 (sin multiplicar por 100).  
Estado: ✅ matemáticamente. **Ver sección "Bug PPP por tramo"** para el endpoint pace-segments.

### Pace Estimado

```
paceEst = (SUM(poss_own) + SUM(poss_rival)) / 2 / num_games
```

Estándar: Pace = (Tm Poss + Opp Poss) / 2 / Games. Posesiones por partido.  
Estado: ✅

### Points By Zone (pointsByZone)

```js
paint2Pts = SUM(fgm - tpm) * 2   // canastas de 2 → asume todas son "pintura"
fg3Pts    = SUM(tpm) * 3
ftPts     = SUM(ftm)
total     = paint2Pts + fg3Pts + ftPts

paint = paint2Pts * 0.70 / total  // 70% de los 2s asignados a pintura
mid   = paint2Pts * 0.30 / total  // 30% a mid-range
fg3   = fg3Pts / total
ft    = ftPts / total
```

Estado: ❌ **Aproximación muy burda.** No hay datos de shot_zone (0 filas en shot_x/y/zone). El split 70/30 pintura/mid es un valor hardcodeado arbitrario, no basado en datos reales. Solo útil como proxy visual hasta que lleguen datos de coordenadas de tiro (Fase 4 Pi pipeline).

---

## Métricas de liga — `/api/stats/league-averages`

### ORTG/DRTG de liga

```sql
-- Posesiones por equipo y partido:
poss = fga + 0.44*fta + tov - off_reb

-- Parear home vs away en cada partido:
paired = JOIN own (home) con own (away) por game_id

ligaOrtg = 100*(home_pts+away_pts) / (poss_home+poss_away)
ligaDrtg  = misma fórmula (simétrica en liga)
```

Estado: ⚠️ **ligaOrtg === ligaDrtg** por definición — en una liga los puntos marcados = puntos recibidos en aggregate. El código calcula ambos con la misma fórmula y devuelve el mismo número. Esto es matemáticamente correcto pero redundante. Para uso en UI, el valor único es el rating promedio de liga (~puntos por 100 posesiones).

### Pace de liga

```
pace = (SUM(poss_home) + SUM(poss_away)) / 2 / COUNT(games)
```
✅

### PPP de liga

```
ppp = (home_pts + away_pts) / (poss_home + poss_away)
```
✅ = ligaOrtg/100

---

## Bug confirmado: PPP por tramo en `/api/stats/team/:id/pace-segments`

### Descripción

El cálculo de PPP por tramo (transición, demi, halfcourt) tiene el denominador incorrecto.

**Denominador actual:** número de posesiones que **terminan en tiro** (shot_made o shot_missed en ese tramo de tiempo).

**Denominador correcto:** número de posesiones **totales** en ese tramo (incluyendo las que acaban en TOV antes de tiro).

### Por qué ocurre

La query SQL filtra los eventos PBP a:
```sql
event_type IN ('shot_made','shot_missed','shot_made_3','shot_missed_3')
```

Esto excluye las posesiones que acaban en TOV antes de llegar a tiro. Esas posesiones nunca entran al CTE `team_shots` ni a `possession_times`. El JavaScript luego divide:

```js
ptsTransition / transition   // transition = COUNT de tiros ≤8s, no posesiones
```

### Impacto matemático

Ejemplo: 100 posesiones de transición, 15 acaban en TOV, 85 en tiro (60 canasta = 120 pts, 25 fallados = 0 pts).

| Cálculo | Valor |
|---|---|
| PPP actual (solo tiros) | 120/85 = **1.41** |
| PPP correcto (posesiones totales) | 120/100 = **1.20** |
| Error | +17.5% inflación |

### Fix requerido en `server/routes.ts`

Ver sección "Prompt Cursor — Fix PPP por tramo" al final de este documento.

---

## Lo que la búsqueda externa cambia respecto a la primera versión

### 1. El bug PPP es más profundo que solo TOVs

Lo que el código calcula actualmente tiene un nombre correcto: **PPT (Points Per Shot attempt) por tramo**, no PPP por tramo. La industria define PPP incluyendo siempre TOVs en el denominador. Synergy Sports lo confirma explícitamente: "Do Points Per Possession stats include turnovers? Yes, they include turnovers and foul shots made."

### 2. La definición de transición del código no es estándar

Synergy Sports (referencia global) define transición como: posesiones donde la defensa no está colocada. Esto requiere tracking o análisis de vídeo. No hay corte en el tiempo del reloj.

El código usa ≤8s de tiempo de posesión como proxy. Esto es razonable sin tracking, pero significa que los datos de U Stats NO son directamente comparables con datos de Synergy u otras fuentes estándar. Hay que comunicarlo claramente en la UI.

Otras variantes usadas en la industria:
- ≤10s del shot clock (statsbywill, uso común en college analytics)
- ≤6s del shot clock (Jay Triano / NBA analytics)
- Sin corte temporal (Synergy, definición por estado defensivo)

### 3. La categoría "demi-transición" (8-14s) no existe en literatura

No hay referencia publicada que use tres categorías (transición / demi / media cancha) con esos umbrales exactos. Es una creación original del código. Esto no es necesariamente malo para uso interno de entrenador, pero hay que saber que no es comparable con ninguna fuente externa.

### 4. Benchmarks PPP verificados

| Contexto | PPP transición | PPP media cancha | Fuente |
|---|---|---|---|
| NBA elite (pre-fix del bug) | ~1.23 | ~1.07 | Jay Triano / Basketball Immersion |
| NBA PPP total promedio | ~1.10 | — | Inpredictable / BBRef |
| EuroLeague CUT (mejor tipo) | 1.58 | — | ResearchGate 2022-24 |
| EuroLeague ISO/SpotUp (peor) | 0.78-0.98 | — | ResearchGate 2022-24 |
| High school referencia práctica | >1.0 = bueno | <0.8 = excelente defensivo | Hudl / entrenadores |

Para WCBA (no datos publicados específicos), estimado razonable tras el fix:
- Transición (definición por tiempo ≤8s): 1.05-1.25
- Media cancha (>14s): 0.85-1.00
- Liga total: ~0.95-1.05

### 5. Posesiones — la unidad correcta

Una posesión termina por: tiro de campo (made/missed), último tiro libre (made/missed), TOV, o fin de período. Los rebotes ofensivos extienden la posesión en lugar de crear una nueva (el shot clock se resetea a 14s en FIBA desde 2014-15, no a 24s). El filtro anti-putback del código (≤3s desde rebote propio) intenta manejar esto pero puede no cubrir todos los casos.


