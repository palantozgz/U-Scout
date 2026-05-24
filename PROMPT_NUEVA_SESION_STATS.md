# PROMPT NUEVA SESIÓN — U Stats PBP Pipeline Audit

## Contexto
Leer CLAUDE_CONTEXT.md completo antes de cualquier acción.

## Objetivo de esta sesión
Auditar y validar el pipeline completo PBP → stats. El pipeline está implementado pero 
el re-sync del PBP estaba en curso al cerrar la sesión anterior. Esta sesión arranca 
verificando el estado real y arreglando lo que sea necesario hasta conseguir diff_pts=0 
en todos los partidos del audit.

## Orden estricto de trabajo

### PASO 1 — Verificar re-sync PBP
```bash
ssh pablo@ucore-pi.local
pm2 logs ucore-collector --lines 20 --nostream
```
Si no ha terminado: esperar. Si ha terminado con errores: investigar.

### PASO 2 — Verificar 0 unknowns
```sql
SELECT action_code, COUNT(*)
FROM stats_pbp WHERE event_type = 'unknown'
GROUP BY action_code ORDER BY COUNT(*) DESC;
```
Si hay unknowns que sean tiros (2PM*, 3PM*, 2PA*, 3PA*): añadir al ACTION_CODE_MAP 
del collector, hacer build, restart PM2, TRUNCATE stats_pbp, reiniciar desde Paso 1.

### PASO 3 — TRUNCATE derivadas + reprocesar
```sql
TRUNCATE TABLE pbp_possessions;
TRUNCATE TABLE pbp_player_game_stats;
TRUNCATE TABLE pbp_lineup_stats;
TRUNCATE TABLE pbp_audit_log;
```
```bash
curl -s -X POST "https://u-scout-production.up.railway.app/api/stats/admin/trigger-possessions?seasonId=2092"
```

### PASO 4 — Verificar audit
```sql
SELECT team_external_id, box_pts, pbp_pts, diff_pts, status
FROM pbp_audit_log WHERE season_id = 2092
ORDER BY ABS(diff_pts) DESC LIMIT 20;
```
**Objetivo: diff_pts = 0 en todos los partidos.**

Si hay diferencias:
1. Identificar el game_id con mayor diff
2. Comparar eventos PBP del partido con el boxscore
3. Determinar si es bug del scraper (unknown codes) o del procesador (possessions.ts)
4. Fix → re-test → repeat hasta diff=0

### PASO 5 — Verificar UI
Con datos limpios en las tablas derivadas, verificar que la UI muestra datos correctos:
- Stats de jugadoras (ppg, rpg, etc.)
- Stats de equipo (ORTG, DRTG, PPP, Pace)
- Liga averages

### PASO 6 — Si todo OK
Eliminar endpoints admin sin auth del routes.ts:
- `/api/stats/admin/trigger-possessions` (sin auth)
- `/api/stats/admin/process-game/:gameId` (sin auth)

## Contexto técnico importante

### possessions.ts v6 — bugs ya corregidos
- Decoradores (assist, block, foul_drawn, sub_in, sub_out) nunca abren posesión
- shot_made del equipo contrario: cierra posesión actual y abre para el que anota
- And-1: look-ahead detecta foul rival tras shot_made → mantiene posesión abierta

### Action codes WCBA — 75 únicos, todos mapeados
Verificado con script contra API real. Los únicos que dieron unmapped en el sync anterior
(3PATRN, TNO8SC, TNO5SC, FOLPER) ya estaban en el mapa — el Pi tenía código viejo.
Con el código actualizado no debe haber unknowns.

### Arquitectura Fase D — completada
Todos los endpoints de stats leen de tablas derivadas PBP:
- `/api/stats/players` → pbp_player_game_stats
- `/api/stats/team/:id` → pbp_possessions + pbp_player_game_stats  
- `/api/stats/league-averages` → pbp_possessions + pbp_player_game_stats
- `/api/stats/player-percentiles` → pbp_player_game_stats
Solo standings (stats_standings) y boxscore por partido (stats_player_boxscores) 
siguen de fuente oficial.

### Pi connection
```bash
ssh pablo@ucore-pi.local  # contraseña: skapol
cd ~/ucore/collector
```
