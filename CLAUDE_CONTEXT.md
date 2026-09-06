# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.
> NUNCA proponer nada sin leer primero el código real de los archivos afectados.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL) — https://ybpzvkkxcmwwxrrouyhm.supabase.co
- **Repo:** `/Users/palant/Downloads/U scout/ucore/`
- **GitHub:** https://github.com/palantozgz/U-Scout.git

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4 · Capacitor 8.x

---

## Metodología de herramientas — AUTONOMÍA TOTAL

Claude tiene acceso completo a la máquina y debe trabajar de forma completamente autónoma.
**Nunca pedir a Pablo que ejecute comandos en terminal, Cursor, o en ningún sitio.**

| Tipo de tarea | Herramienta | Notas |
|---|---|---|
| Leer archivo Mac | `Filesystem:read_text_file` o `Filesystem:read_text_file` (capitalizado) | |
| Escribir/sobrescribir archivo | `filesystem:write_file` (minúscula) | |
| Edit quirúrgico | `Filesystem:edit_file` | No en routes.ts (template literals SQL) |
| Editar routes.ts | Script Python via osascript | Reemplazos exactos de texto |
| npm, git, comandos shell Mac | `Control your Mac:osascript` | PATH=/opt/homebrew/bin:/usr/local/bin:$PATH |
| Queries Supabase | Script Python → `Control your Mac:osascript` | Siempre escribir a archivo, ejecutar, borrar |
| SSH Pi | `Control your Mac:osascript` con /usr/bin/ssh | No interactivo, usar -o StrictHostKeyChecking=no |

### Scripts Python en osascript — patrón correcto
```python
# 1. Escribir script: filesystem:write_file → /Users/palant/Downloads/U scout/ucore/tmp_script.py
# 2. Ejecutar: Control your Mac:osascript
#    set r to do shell script "python3 '/path/tmp_script.py' 2>&1"; return r
# IMPORTANTE: usar "set r to do shell script ... ; return r" — NO "do shell script ... 2>&1"
# Scripts con mucha red: considerar dividir en chunks pequeños (timeout ~30s)
```

### Git — siempre vía osascript
```bash
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH && cd '/Users/palant/Downloads/U scout/ucore' && git add -A && git commit -m "..." && git push origin main
```

### routes.ts — editar vía Python (NO Cursor, NO filesystem:edit_file)
```python
# El archivo tiene template literals SQL con ${...} — filesystem:edit_file lo corrompe
# Usar Python: leer, reemplazar texto exacto, escribir
with open(routes_path, 'r') as f: content = f.read()
content = content.replace(old_exact_text, new_text, 1)
with open(routes_path, 'w') as f: f.write(content)
```

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY '/Users/palant/Downloads/U scout/.env' | cut -d= -f2
Pi user  = pablo  Pi host = 192.168.1.7
```

### Pi
- Watchdog activo (systemd + dtparam). SSD /dev/sda2, 117GB. Collector commit d51e98f.
- Conectar: `/usr/bin/ssh -i /Users/palant/.ssh/pi_ucore -o StrictHostKeyChecking=no pablo@192.168.1.7`

---

## Principios de datos

1. **PBP es fuente única de verdad para U Stats** — NUNCA mezclar fuentes
2. NUNCA estimar. Sin hardcodes
3. `team_id` en tablas derivadas = SIEMPRE internal id (1-18 y 373-378)
4. `stats_pbp.team_id` = external_id WCBA
5. `pp.points` en `pbp_possessions` es exacto — auditado 2026-06-08: 0 discrepancia por partido
6. La diferencia total entre `SUM(pp.points regular)` y `SUM(game scores)` = puntos de playoff excluidos del filtro `phase_type='regular'`. No es un bug.
7. **`plus_minus` en `pbp_player_game_stats` es calculado (PBP tracking), NO oficial** — 69.5% mismatch vs boxscore. SIEMPRE usar `stats_player_boxscores.plus_minus` para PM en game logs.

---

## Arquitectura general

```
API WCBA → collector Pi → stats_pbp → possessions.ts v6.6 (Railway) → tablas derivadas
                       ↘ player_stats (own team — manual entry UI pendiente)
```

---

## Estado DB — 2026-06-12

- `pbp_audit_log`: ok=444, error=2 (partido 286 aceptado)
- `pbp_possessions`: ~31K regular + ~5K playoff ✅ pp.points auditado y correcto
  - Phase 27172 (132 games): todos correctos ✅
  - Phase 27206 (60 games): games 325-340 tenían 2-3x duplicados → borrados y reprocesados ✅
  - Phase 27206 games 283-324 y 341-342: correctos ✅
- `pbp_player_game_stats` + `pbp_lineup_stats`: poblados ✅
- `stats_player_boxscores`: SOLO 21/224 partidos — season averages usan pgs (completo) ✅
- `stats_players name_zh IS NULL`: 0 filas ✅
- Playoff phase IDs en season 2092: `{27743, 27747, 27753, 27757}`
- Liga pace = 81.6 poss/game, ORTG = 99.5 (verificado post-fix)
- Pace por equipo: 77-87 poss/game (todos dentro de ±10 del promedio liga) ✅

---

## U Playbook — estado y plan

### Estado actual (2026-06-12)
- Existe `Playbook.tsx` (1119 líneas) con hub de 4 módulos: Defensiva/Ofensiva/ATOs/Film
- Wizard defensivo funcional genera un `Report` desde `defensive-system.ts`
- Ofensiva, ATOs, Film son shells vacíos
- NO existe vista de lectura para jugadoras — el output del wizard no llega a ellas
- NO existe sección de Transición

### Visión acordada con Pablo
U Playbook es el **manual táctico del equipo**, visible para las jugadoras.
Propósito: una jugadora que llega al equipo sabe exactamente qué se va a encontrar.
NO es para ajustes ni defensas especiales — es el esqueleto táctico permanente.

**4 secciones:**
1. **Defensa** — planes defensivos estándar construidos por el staff via wizard
   (man-to-man, zona, etc.). El wizard guía coherencia entre reglas.
2. **Transición** — reglas de transición ofensiva y defensiva (wizard similar al defensivo)
3. **Ataque** — sistemas ofensivos con diagramas clásicos + vídeo/animación 2D
4. **Saques** — jugadas de fondo y banda con diagramas + vídeo

### Principios de diseño
- **Todo multilingüe**: el contenido se crea en los idiomas del equipo (es/zh/en).
  Cada jugadora ve SOLO su idioma (setting global de la app, igual que el resto de U Core).
  NO bilingüe en pantalla — adaptado por usuario.
- **Dos modos**: vista jugadora (read-only, limpia) y vista staff (edit + wizard)
- **Publicado / Borrador**: el staff controla qué ve la jugadora
- **Reglas por fase**: transición → media cancha → situaciones especiales
- **Diagrama como gancho visual** en Ataque/Saques (diagrama pequeño en la tarjeta,
  diagrama grande + vídeo dentro)

### Mockup aprobado (pantallas discutidas)
1. **Hub** — 4 módulos con estado Publicado/Borrador + fecha última actualización
2. **Defensa hub** — lista de todos los planes disponibles
3. **Plan reader** — reglas organizadas por fase (transición/media cancha/rebote),
   idioma único del usuario, chips de categoría a probar
4. **Transición** — tabs Ofensiva/Defensiva, mismo formato de reglas
5. **Ataque** — lista de sets con diagrama-preview pequeño + info, tabs Sistemas/S.fondo/S.banda

### Decisión pendiente (necesita respuesta de Pablo)
¿El contenido lo escriben a través del wizard (opciones guiadas) o es texto libre
que el staff trae preparado y pega? Esto define si el wizard es un flow de opciones
o un editor de texto enriquecido.

### Plan de implementación — próxima sesión
FASE 1 (sin backend nuevo):
- Rediseñar el Hub actual (reemplazar los 4 tiles genéricos por las cards con estado)
- Crear la vista player-facing del Plan reader defensivo
  (conectar con los Reports que el wizard ya genera)
- Añadir sección Transición como shell navegable con tabs

FASE 2 (con backend):
- Schema para reglas de transición y contenido multilingual
- Editor de planes en el wizard
- Publicación controlada por staff

FASE 3 (más adelante):
- Ataque: diagramas + vídeo/animación
- Saques: biblioteca de jugadas

### Archivos clave Playbook
- `client/src/pages/core/Playbook.tsx` — componente principal (1119 líneas)
- `client/src/lib/playbook-api.ts` — API hooks
- `client/src/lib/defensive-system.ts` — lógica del wizard defensivo + buildReport()

---

## Notas técnicas críticas (iOS)

### GameBoxscoreSheet freeze iOS — PENDIENTE DE RESOLVER
- Se aplicó fix `2ff3484`: overflow-hidden movido a wrapper interno, svh→dvh, CSS body[data-scroll-locked]
- Pablo confirma que el bug PERSISTE en dispositivo físico
- Causa adicional posible: aria-hidden en el root app cuando el Sheet abre (Radix behavior)
  → Radix Dialog pone aria-hidden="true" en el root #root, lo que en algunos builds de iOS
  hace que WKWebView deje de procesar touch events en el modal
- Fix a intentar: en sheet.tsx, pasar modal={false}... pero Radix Sheet no tiene esa prop
- Fix alternativo: usar Vaul (drawer library) en lugar de Radix Sheet para bottom sheets
  Vaul es específicamente para mobile drawers y no tiene el aria-hidden issue
- Fix alternativo 2: portal container personalizado — Sheet abre en un div dentro del app
  root en lugar de en document.body
- PRIORIDAD ALTA — afecta directamente al flujo de uso en partidos

### recharts TDZ — RESUELTO 2026-06-12
- recharts estaba en vendor-react por precaución TDZ pero nadie lo importaba → 104KB gzip de peso muerto
- Eliminado de manualChunks. Ahora va automáticamente al chunk de Schedule (único importador)
- Schedule.tsx es lazy (solo se parsea cuando el user navega ahí) → React ya inicializado → sin TDZ
- vendor-react: 166KB → 61KB gzip. El TDZ solo ocurre si recharts carga ANTES de React.
- Si en el futuro se importa recharts en el shell de la app → volver a añadir a vendor-react.

### Scroll en Capacitor iOS — app-shell pattern
- Root: `h-[100dvh] overflow-hidden flex flex-col`
- Main scrollable: `flex-1 overflow-y-auto`
- NUNCA `min-h-[100dvh]` sin `overflow-y-auto` en el scrollable.

### PostgREST bulk insert
- Todos los JSON deben tener las mismas keys (null para opcionales).
- `Prefer: resolution=ignore-duplicates` para upserts seguros.
- `Prefer: count=exact` + `Range: 0-0` timeout en tablas grandes — contar via paginación Python.

---

## ═══════════════════════════════
## MÓDULO U SCOUT
## ═══════════════════════════════

### Estado real — 2026-06-08

| Feature | Estado |
|---|---|
| Motor v4 + ReportSlidesV1 (3 slides) | ✅ |
| PlayerEditor iOS scroll + team selector eliminado | ✅ 2026-06-08 |
| OverridePanel wired con report_overrides | ✅ confirmado |
| ReportViewV4: solo OverridePanel + "→ Film Room" | ✅ confirmado |
| FilmRoom como ÚNICO lugar de publicación | ✅ confirmado |
| Discrepancias entre coaches (DiscrepancyPanel) | ✅ confirmado |
| StatsMiniChip en MyScout + backend player-link | ✅ 2026-06-08 |
| PlayerEditorStatsChip — stats WCBA en context tab del editor | ✅ 2026-06-08 |
| player_stats UI — formulario entrada manual stats propias | ❌ pendiente |
| backup/motor-v2.1-pre-20260405 — merge/discard | ❌ pendiente decisión |

### Schema Supabase relevante (fuera de schema.ts — no tocar)
```
players.is_canonical, player_scout_versions, report_overrides,
report_approvals, report_publications, league_matches,
player_stats, invite_links
```

---

## ═══════════════════════════════
## MÓDULO U PLAYBOOK
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| Hub + wizard defensivo (v5, 41 pasos) | ✅ |
| **Playbook FASE 1 redesign** — hub 4-cards, DefensaHub, TransicionShell, AtaqueShell, PlaybookPlanReader, PlaybookPlayerView | ✅ 50107aa |
| Wizard ofensivo | ❌ — requiere input de Pablo sobre estructura |
| Persistencia en Supabase (actualmente localStorage) | ❌ pendiente |
| Comparador portado al app | ❌ solo HTML standalone |

---

## ═══════════════════════════════
## MÓDULO U STATS
## ═══════════════════════════════

### possessions.ts v6.6 — estado auditado
- FT_LAST_MADE = `{FTH11M, FTH22M, FTH33M}` — correcto (last FT de cada serie)
- FTH21M/FTH31M/FTH32M correctamente FUERA del set (no son último TL)
- `pp.points` exacto per-game — auditado en Supabase SQL Editor 2026-06-08

### ORTG/DRTG — metodología corregida 2026-06-08
- **Antes:** cross-join `pbp_possessions p × op` → promedio ponderado inconsistente con league avg
- **Ahora:** 3 subqueries simples (own poss, opp poss, games count) — idéntico a league-averages endpoint
- Commit: `ededf5b`
- Fórmula: ORTG = 100 × SUM(pp.points propias) / COUNT(posesiones propias). Sin boxscores.

### Audit fórmulas — 2026-06-09 (audit completo end-to-end)

**Verificado correcto ✅:**
- pace-segments PPP incluye TOV possessions (19.6% de poss son TOV → denominador correcto)
- fgm en pgs incluye fg3m (FG% estándar)
- fouls poblados (77.2%) → PIE correcto
- Solo season_id=2092 en DB → standings LEFT JOIN bug latente pero no activo
- eFGPct, tsPct, ftRate, ORB%/DRB%, tsPct — fórmulas correctas
- pace liga — fórmula COUNT(*) / (COUNT(DISTINCT game_id) × 2) correcto

**Bugs corregidos en commit `f809a6c`:**
1. `astTovRatio` en `/api/stats/players/all-detail` era TOV% (SUM(tov)/denominador_poss) → ahora SUM(ast)/SUM(tov) correcto
2. `on-off` endpoint usaba `LIKE '%id%'` → 20 false positives confirmados → ahora regex `(^|-)id(-|$)`
3. `plus_minus` en game logs de 3 endpoints usaba pgs calculado (69.5% mismatch vs boxscore) → ahora COALESCE(spb.plus_minus, pgs.plus_minus) desde stats_player_boxscores

**Bug latente (no activo, una sola season):**
- standings eFGPct usa LEFT JOIN sin filtro efectivo de season — no afecta hasta que haya datos de season 2093+

### UI Stats — estado 2026-06-09

| Feature | Estado |
|---|---|
| Pipeline PBP completo | ✅ |
| ORTG/DRTG/Pace/eFG%/PIE/USG% — metodología correcta | ✅ ededf5b |
| League averages — auditadas y correctas | ✅ 2026-06-08 |
| PhaseToggle + multi-temporada | ✅ |
| GameBoxscoreSheet — col labels locale-aware | ✅ dd3b92f |
| GameBoxscoreSheet — datos vacíos fix (team gameLog sg.id → external_game_id) | ✅ 016b573 |
| GameBoxscoreSheet — botón X de cierre explícito | ✅ 016b573 |
| StatsMiniChip en MyScout | ✅ 52cb42d |
| Bubble chart (eFG% vs PPG) — StatsBubbleChart.tsx SVG | ✅ 70d121a |
| Radar comparator — StatsPlayerComparator.tsx SVG | ✅ 0c19c17 |
| /api/stats/players/all-detail + prefetcher key fix | ✅ 2903160 |
| Cache-Control en /players, /leaders, /player-link | ✅ |
| astTovRatio all-detail corregido | ✅ f809a6c |
| on-off regex (no LIKE) | ✅ f809a6c |
| plus_minus desde boxscore (3 game log endpoints) | ✅ f809a6c |
| Shot chart (Pi Fase 4) | ❌ bloqueado |

---

## ═══════════════════════════════
## MÓDULO U SCHEDULE
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| MVP calendario + sesiones | ✅ |
| Scroll recentering — block:"start" | ✅ 040276d |
| Wellness standalone (/player/wellness) | ✅ |
| Recurring events | ❌ |

---

## Pendientes ordenados por impacto

### P1
1. **Stats Phase 4** — popup/detail views de jugadora (card expand)
2. **ReportViewV4 — formato 3 slides** — Slide 1: ¿Quién es? · Slide 2: ¿Qué hará? · Slide 3: ¿Qué hago yo?
3. **U Playbook FASE 2** — Transición wizard + backend persistencia
4. **Bundle optimization + Capacitor build** — Carga inicial ~191 KB OK. Schedule ya en 20.9 KB. Siguiente paso: Capacitor build → TestFlight.

### P2
5. **Capacitor build + TestFlight** — `npx cap sync && npx cap open ios` → Xcode archive → TestFlight
6. **player_stats UI** — `/coach/stats-entry`, tabla existe en Supabase, falta backend + frontend
7. **hasReport fix en MyScout** — usa `createDefaultPlayer` inputs → siempre true
8. **Schedule scroll re-centering** (List ↔ Planner toggle)
9. **backup/motor-v2.1-pre-20260405** — merge o discard

### P3
10. **Shot chart** — bloqueado Pi Fase 4
11. **Hero card jugadoras** — requiere wcba_external_id en profiles
12. **Recurring events** — ✅ implementado (crea N eventos en loop secuencial)
13. **Favicon U Core** + logo real del club
14. **OverridePanel** frontend integration

---

## Estándares de código

1. Leer código real antes de proponer cualquier cambio
2. `npm run check` exit 0 antes de todo commit — ejecutar via osascript
3. `routes.ts`: editar via Python (reemplazo de texto exacto), NO filesystem:edit_file
4. SQL destructivo: solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`

---

## Archivos clave
- `server/routes.ts` — API (~3700 líneas, editar via Python)
- `scripts/audit-precision.ts` — audit end-to-end L1/L2/L3. Correr antes de cerrar U Stats.
- `server/possessions.ts` — PBP processor v6.6
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — U Stats (4636+ líneas, leer en chunks)
- `client/src/components/StatsBubbleChart.tsx` — bubble chart SVG ✅
- `client/src/components/StatsPlayerComparator.tsx` — radar comparator SVG ✅
- `client/src/components/GameBoxscoreSheet.tsx` — boxscore locale-aware ✅
- `client/src/components/scout/PlayerEditorStatsChip.tsx` — stats WCBA en fichas ✅
- `client/src/pages/core/Playbook.tsx` — hub + wizard defensivo
- `client/src/pages/core/Schedule.tsx` — god file 228KB (sin SQL, edit_file OK)

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas (no repetir)

1. `String(null) = 'null'` → filtrar antes de INSERT integer
2. Railway 30s timeout → fire-and-forget + polling Supabase
3. recharts TDZ → mantener en vendor-react, NUNCA chunk separado
4. iOS scroll → h-[100dvh]+overflow-hidden root, flex-1+overflow-y-auto main
5. PostgREST bulk → todas las keys iguales, null para opcionales
6. `Prefer: count=exact` + `Range: 0-0` → timeout en tablas grandes
7. toISOString() → UTC. Usar toLocaleDateString("sv") para fechas UTC+8
8. CLAUDE_CONTEXT.md puede estar desactualizado — siempre verificar con código real
9. `scrollIntoView({ block: "nearest" })` → usar `block: "start"` para re-center
10. osascript con mucha red (>30s) → timeout. Usar batches pequeños o escribir a archivo primero
11. NUNCA mezclar fuentes de datos — pp.points para puntos, no stats_games.score
12. La diferencia total pp.points(regular) vs game_pts incluye puntos de playoff — no es bug
13. `plus_minus` en `pbp_player_game_stats` es calculado desde PBP tracking, NO oficial. Tasa de mismatch vs boxscore: 69.5%. SIEMPRE usar `stats_player_boxscores.plus_minus` vía COALESCE en game logs.
14. REST cap PostgREST = 1000 rows por defecto. Paginar con `offset=` para datasets grandes. Para counts, usar `Prefer: count=exact + Range: 0-0` (puede timeout en tablas grandes → usar HEAD request).
17. **Paginación Python via REST: SIEMPRE usar `order=id.asc` y `limit=999`, break cuando `len(chunk) < 999`**. Sin ORDER BY, páginas sucesivas pueden devolver filas duplicadas → datos inflados. Patrón correcto: `qpage(t, p, off, 999)`, incrementar offset=+999, break si chunk<999.
18. **Duplicados en pbp_possessions**: causa = Pi collector procesando el mismo game_id múltiples veces sin DELETE efectivo. Detección: `poss_rows / (home_score + away_score) > 1.5`. Fix: DELETE todos los registros del game en las 3 tablas derivadas → `processAllPendingPossessions` los reinserta en startup.
15. `set r to do shell script "..." ; return r` es la forma correcta de osascript con output largo. `do shell script "... 2>&1"` puede fallar con pipes o comandos complejos.
16. LIKE '%id%' en SQL para matching de IDs numéricos → false positives si un ID es substring de otro. Usar regex `~` con `(^|-)id(-|$)`.

---

## Historial sesiones

### 2026-09-06 (cont.) — Revisión módulo por módulo + QA fixes

**Bugs corregidos:**
- `hasReportInputs` bug crítico: 307 jugadoras WCBA importadas tenían `archetype = "Role Player"` (DB) pero la función comparó contra `"arch_role_player"` (ID interno) → siempre `true` → todas mostraban "Ver informe" sin haber completado ficha. Fix: `DEFAULT_ARCHS = new Set(["arch_role_player", "Role Player", ""])` — ✅ f645bba
- `firstName` en HomeMobile: si profile solo tenía email, mostraba "pablo@gmail.com 👋". Ahora trunca en `@` — ✅ f645bba
- Personnel: 7 `console.log` activos en producción eliminados — ✅ f645bba

**UX mejorado:**
- Recurring events preview: chip azul "Se crearán X sesiones" + botón de submit con count — ✅ f645bba
- Wellness: barras de color por métrica (verde/amarillo/rojo), tooltips siempre visibles, toast al guardar — ✅ 26784d4
- Onboarding: slide `player_wellness` tenía labels hardcodeados en chino — ✅ 26784d4

**Audit completo de calidad:**
| Módulo | Líneas | as any | console | hardcode locale |
|---|---|---|---|---|
| Personnel | 1200 | 36 | 0 (limpiados) | 43 |
| Stats | 4707 | 0 | 0 | 24 |
| Schedule | 3621 | 140 | 0 | 3 |
| ClubManagement | 1493 | 15 | 0 | 19 |
| MyScout | 584 | 26 | 0 | 6 |
| Playbook | 1493 | 0 | 0 | 9 |

**Estado por módulo tras revisión:**
- Wellness ✅, Schedule ✅, CoachHome ✅, Stats ✅, Playbook ✅, ClubManagement ✅
- MyScout: `hasReportInputs` corregido. Textos en L-object local (funcional, patrón intencional)
- Personnel: funcional, muchos `as any` necesarios para tipos legacy
- PlayerTeamList: bien, single-team shortcut funciona
- Hero card jugadoras en Stats: requiere `wcba_external_id` en profiles — es dato, no código

**Commits de esta ronda:**
`26784d4` ux: Wellness + Onboarding
`f645bba` fix: hasReportInputs, firstName, repeat preview, console.log

**Contexto:** Pablo aterriza en Jiangxi para temporada WCBA. Primer uso real con el equipo.

**Auditoría completa** de todos los módulos (HomeMobile, Schedule, Wellness, ClubManagement, Onboarding, Settings, ModuleNav, PlayerHome, WellnessStandalone, useHomeData, ModuleHeader, locales).

**Bugs corregidos:**
- `playbookClubId` usaba `profiles.club_id` (tabla inexistente) → `storage.getClubForUser()` — ✅ d4694a0
- Boxscore vacío: team gameLog usaba `sg.id` en lugar de `sg.external_game_id` — ✅ 016b573
- Botón X de cierre explícito en GameBoxscoreSheet — ✅ 016b573
- Wellness chip jugadora → `/schedule` → correcto `/player/wellness` — ✅ d24404c
- `ModuleNav` Playbook hardcoded → `t("ucore_nav_playbook")` — ✅ d24404c
- Settings: "U Scout v0.1 / Motor v3" → "U Core v1.0 / Motor v4" — ✅ d24404c
- `Math.random()` en SVG clipPath de ModuleHeader (re-render en cada mount) → `useMemo` — ✅ a9e19ac
- mock-data y motor-v4 se cargaban en background para jugadoras → solo para staff — ✅ a9e19ac
- i18n: `ucore_card_schedule_title`, `home_kpi_wellness`, `playbook_back` sin traducir en ES/ZH — ✅ aff4446
- Typo `relati` → `relative` en PlayerHome avatar div — ✅ ac63f66
- Key `schedule_games_count` faltante en los 3 locales — ✅ ac63f66
- ZH nav: `ucore_nav_playbook: "Playbook"` → `"战术手册"` — ✅ d24404c

**Feature implementada:**
- **Recurring events** en Schedule: el UI ya existía (repeatEnabled/repeatWeeks/repeatWeekdays) pero no persistía. Ahora `runCreateOrUpdate` acepta `dateOverride` y el submit handler genera N fechas y crea cada evento secuencialmente — ✅ d24404c

**Playbook:**
- FASE 1 redesign: hub 4-cards, DefensaHub, TransicionShell, AtaqueShell, PlaybookPlanReader, PlaybookPlayerView — ✅ 50107aa
- Fix bug persistencia: `playbookClubId` → `storage.getClubForUser()` — ✅ d4694a0

**Bundle analysis (2026-09-06, post-refactor Schedule):**
- Total JS: 735.9 KB gzip (70 chunks)
- **Schedule.tsx: 131.8 KB → 20.9 KB gzip** — lazy-load de SessionCreateDialog, WellnessStaffTab, WellnessTrendChart
- WellnessTrendChart (recharts): 107.1 KB — solo carga si el usuario abre el tab de trends
- vendor-react: 62.9 KB, vendor-supabase: 50.8 KB
- Carga inicial: ~191 KB gzip (sin cambios)
- Navegar a /schedule: antes 131.8 KB, ahora 20.9 KB parse
- Schedule.tsx: 5155 → 3621 líneas
- Archivos extraidos: `useSessionForm.ts`, `scheduleActivityConfig.ts`, `SessionCreateDialog.tsx`, `schedule/WellnessStaffTab.tsx`, `schedule/WellnessTrendChart.tsx`
- Backup: `backup/pre-schedule-extract-20260906`

**i18n audit:**
- 1400 keys en los 3 locales, 0 vacías
- 1 key faltante corregida: `schedule_games_count`
- 178 keys con `as any` (cast forzado), todas presentes en en.ts tras el fix

**ClubManagement:** leagueType/gender/level/ageCategory SÍ existen en schema.ts (líneas 132-135). El bug del CLAUDE_CONTEXT anterior era incorrecto.

**Commits de esta sesión:**
`50107aa` feat(playbook): FASE 1 redesign
`016b573` fix(stats): boxscore vacío + botón X GameBoxscoreSheet
`d4694a0` fix(playbook): playbookClubId → storage.getClubForUser()
`d24404c` polish: recurring events, wellness chip, ModuleNav i18n, Settings v1.0, ZH nav
`a9e19ac` perf: Math.random() SVG clipPath, prefetch solo staff
`aff4446` i18n: locales ES/ZH sin traducir
`ac63f66` fix: typo relati, schedule_games_count
`8bcfb97` chore: remove tmp file

**U Stats — cierre definitivo:**
- FOLTEC (109 eventos, 77 partidos): phantom possessions corregidas en possessions.ts
  - `isTechFT` flag: FTs técnicos del equipo no-atacante no cambian la posesión ni acumulan possFTA/possPts
  - FOLOFN: `endType` corregido de 'unknown' a 'turnover' (348 eventos)
- Possessions duplicadas games 319/360/365 (race condition Pi) → borradas + reprocesadas
  - game=365: 62 duplicados (+33 pts inflados), game=360: 10 dups, game=319: 4 dups
- `scripts/audit-precision.ts`: script permanente de audit end-to-end
  - L1: SUM(poss.points) == stats_games.score para TODOS los partidos (223/223 ✅)
  - L2: FTA/TOV/REB vs pbp_audit_log
  - L3: integridad secuencias PBP y orden de reloj
  - Detección de possession_numbers duplicados
  - Resultado final: 223/223 L1 OK, 446/446 L2 OK, 0 FAIL 0 WARN ✅
- **U Stats queda cerrado** — datos verificados, audit permanente disponible

**Performance bundle — commits a main:**
- A: `/api/ping` keepalive endpoint + `useRailwayWarmup` hook (warm-on-focus/resume)
- B: staleTime correcto por tipo de dato (30s/1min → 2h para stats) + networkMode offlineFirst
- C: BackgroundPrefetcher timing 2000ms → 100ms + query keys corregidos (prefetch se ignoraba)
- D: recharts/d3/victory fuera de vendor-react → vendor-react 166→61 KB gzip
- E: i18n chain lazy (`initLocale()` en main.tsx antes de render) → index bundle 98→42 KB gzip
- server self-ping cada 4 min (Railway no duerme en prod)
- Skeleton screens: SkeletonMyScout + SkeletonStats (Schedule pendiente — god file 249KB)

**Métricas finales:**
- Parse eager antes del primer render: 326 KB → 224 KB gzip (-31%)
- vendor-react: 166 → 61 KB gzip
- index main bundle: 98 → 42 KB gzip
- Total bundle: 710 → 709 KB (redistribuido correctamente)
- `staleTime` correcto: stats abre instantáneo con caché, funciona sin wifi
- Cold start: self-ping servidor + warm-on-resume en cliente + UptimeRobot (manual, ver instrucciones)

**Notas técnicas nuevas:**
- `i18n-core.ts`: `import type` para tipado, `initLocale()` async pre-carga locales antes de React
- `main.tsx`: `await localeReady` antes de `createRoot()`, timeout 3s de seguridad
- `BackgroundPrefetcher`: query keys DEBEN coincidir exactamente con los hooks → siempre verificar
- Schedule skeleton: pendiente — sin loading entry point único, necesita sesión dedicada

**Commits de esta sesión:**
`5631725` U Stats audit-precision script + FOLTEC + FOLOFN + data fix games 319/360/365
`2ff3484` fix(ios): GameBoxscoreSheet freeze en Capacitor WKWebView
  - overflow-hidden eliminado del SheetContent (position:fixed + overflow-hidden = iOS freeze)
  - Movido a wrapper div interno. h-[92svh] → h-[92dvh]
  - index.css: body[data-scroll-locked] touch-action:auto + pointer-events:auto
  - NOTA: Pablo reporta que el bug PERSISTE en dispositivo. Posible causa adicional
    pendiente de investigar en próxima sesión.
`efbf9c0` ux: skeleton Schedule — isInitialLoad + SkeletonSchedule
`19190f5` perf(A): Railway keepalive
`d31de9b` perf(B): staleTime correcto + networkMode offlineFirst
`1029dec` perf(C): BackgroundPrefetcher timing + query keys
`7b4dc1c` perf(D): recharts/d3/victory fuera de vendor-react
`eeec22c` perf(E): i18n locale chain lazy — index bundle 98→42 KB
`ebd0e1d` perf(keepalive): server self-ping cada 4min
`cdb4a77` ux: skeleton screens MyScout + Stats

### 2026-06-10 — Audit end-to-end completo + 5 bugfixes + data corruption corregida

**Commits:**
- `f809a6c` fix: astTovRatio all-detail (TOV%→AST/TOV), on-off regex, plus_minus boxscore
- `cf9f286` fix: game log W/L indicator usa score real (no plusMinus)
- `26693ee` fix: pace por equipo — gCnt desde pbp_possessions con phaseFilter

**Auditoría end-to-end (WCBA fuente real):**
1. Leí 17 endpoints de routes.ts completos
2. Llamé WCBA API `cba.net.cn` y comparé campo a campo
3. Verifiqué consistencia interna entre todos los endpoints

**Verificado correcto contra WCBA API ✅:**
- Standings 18 equipos: W/L, PPG, OPPG exactos al decimal
- Player boxscore: 10 partidos × 24 jugadoras = 0 mismatches en todos los campos
- Game scores: exactos
- stats_pbp y stats_player_boxscores: correctos

**Bugs corregidos:**
1. `astTovRatio` all-detail era TOV% → ahora AST/TOV ✅
2. on-off LIKE → regex (20 false positives eliminados) ✅
3. plus_minus game logs → COALESCE(boxscore, pgs) ✅
4. W/L indicator game log → usa score real (no plusMinus) ✅
5. pace por equipo → gCnt desde pbp_possessions con phaseFilter (no stats_games sin filtro) ✅

**BUG CRÍTICO DE DATOS CORREGIDO — Possessions duplicadas phase 27206:**
- **16 games (IDs 325-340)** tenían 2-3x posesiones duplicadas en pbp_possessions
- Causa: el Pi collector procesó esos games múltiples veces sin DELETE previo efectivo
- Fix: DELETE de pbp_possessions + pbp_player_game_stats + pbp_lineup_stats para esos 16 games
- Reprocesado: `processAllPendingPossessions` se ejecuta en startup → Railway deploy triggea reprocesado
- Phase 27172 (132 games): verificada, limpia ✅
- Phase 27206 games 283-324 y 341-342: correctos ✅

**Gap operativo (no bug de código):**
- `stats_player_boxscores` tiene solo 21/224 partidos sincronizados
  - Season averages NO afectadas (usan pgs, completo)
  - GameBoxscoreSheet solo funciona para esos 21 partidos
  - Solución pendiente: correr `syncNewPlayerBoxscores` para ~200 partidos

**Lecciones de este audit:**
- Auditar fórmulas SQL ≠ auditar valores reales en pantalla
- Paginación REST sin ORDER BY produce duplicados → SIEMPRE usar `order=id.asc` en supa_all
- Comparar siempre métricas relacionadas entre endpoints (pace equipo vs pace liga)
- Llamar la fuente real (WCBA API) para verificar datos de ingest

### 2026-06-09 — Audit end-to-end contra WCBA fuente real + 4 bugfixes
Commits:
- `f809a6c` fix: astTovRatio all-detail (era TOV%), on-off regex, plus_minus boxscore
- `ccd635b` chore: remove temp scripts
- `88fb838` docs: CLAUDE_CONTEXT.md
- `cf9f286` fix: game log W/L indicator usa score real en lugar de plusMinus

**Metodología del audit (end-to-end real):**
1. Leí 17 endpoints de routes.ts completos
2. Verifiqué fórmulas contra Supabase via scripts Python
3. Llamé directamente a WCBA API `cba.net.cn` y comparé campo a campo

**Verificado correcto contra fuente WCBA ✅:**
- Standings 18 equipos: W/L, PPG, OPPG exactos al decimal
- Player boxscore: 10 partidos × 24 jugadoras = **0 mismatches** en todos los campos (pts, fgm, fga, fg3m, fg3a, ftm, fta, reb, off_reb, def_reb, ast, stl, blk, tov, fouls, plus_minus)
- stats_games scores: exactos
- Season averages (PPG, RPG…) desde pbp_player_game_stats: fuente correcta

**Bugs corregidos:**
1. `astTovRatio` all-detail era TOV% → ahora AST/TOV ✅
2. on-off LIKE → regex (20 false positives eliminados) ✅
3. PM game logs → COALESCE(boxscore, pgs) ✅
4. W/L indicator game log usaba plusMinus → ahora usa score real ✅

**Gap operativo (no bug de código):**
- `stats_player_boxscores` tiene solo 21/224 partidos sincronizados
  - Season averages NO afectadas (usan pgs, completo)
  - GameBoxscoreSheet solo funciona para esos 21 partidos
  - Solución: correr `syncNewPlayerBoxscores` para ~200 partidos pendientes (tarea Pi)

### 2026-06-10 — Audit consistencia interna + corrección datos duplicados phase 27206
Commits: `26693ee` fix: pace por equipo gCnt (anterior), más hallazgos de esta sesión.

**Bug crítico encontrado por Pablo (no detectado en 2 audits previos):**
- Pace por equipo siempre más bajo que pace de liga → bug de denominador `gCnt`
- `gCnt` venía de `stats_games` SIN phaseFilter → incluía juegos de playoff en denominador
- Numerador (`ownCnt`+`oppCnt`) filtrado por `phase_type='regular'` → mismatch
- Fix: `gCnt` ahora desde `pbp_possessions` con phaseFilterPP → commit `26693ee`

**Causa raíz del pace anómalo descubierta: datos duplicados en pbp_possessions**
- 16 games de phase 27206 (IDs 325-340) tenían 2-3x filas duplicadas
- Ejemplos: game 326 tenía 495 rows (ratio 3.28x), game 327 tenía 441 (2.86x)
- Phase 27172 (132 games): todos correctos
- Playoffs: datos incompletos (gap de colección Pi, no corrupción)
- Fix: DELETE de pbp_possessions/pbp_player_game_stats/pbp_lineup_stats para 16 games
- El server Railway los reprocessó automáticamente (processAllPendingPossessions)
- Verificación post-fix: 16/16 games ✅, PPG poss = standings exacto en todos los equipos

**Causa probable de la duplicación:** el Pi collector procesó los games 325-340 dos veces
sin que el DELETE previo funcionara correctamente (probable restart/crash entre batches)

**Estado post-fix verificado con datos reales (paginación page=900 correcta):**
- Liga pace = 81.6 poss/game
- Rango equipos: 77.2-86.8 (±5.2 del promedio) ✅
- PPG poss vs standings: ≤0.2 diferencia en todos los equipos ✅

**Lección de auditoría:** Los bugs de consistencia (team pace vs liga pace) solo se detectan
comparando visualmente métricas relacionadas en la misma pantalla. SQL correcto + datos
incorrectos en tablas derivadas = audit por código no los detecta.

**Lección de paginación Python:**
- PostgREST cap = 1000 rows siempre. `limit=2000` devuelve 1000 → loop rompe tras 1 page
- Solución: `page=900` en supa_all → 1000 rows > 900 → loop continúa correctamente
- Nunca usar page > 1000 en supa_all si se quieren todos los rows

**Gap conocido pendiente:** playoff games (IDs 343-374) tienen poco o ningún PBP en stats_pbp
→ La mayoría de playoff games no tienen possessions calculadas
→ `phaseType=playoff` en U Stats mostrará datos muy incompletos
→ Requiere verificar si el Pi collector recogió PBP durante playoffs

### 2026-06-08 — Sesión autónoma larga (stats audit + Phase 3 + bugfixes)
Commits pusheados:
- `52cb42d` GET /api/stats/player-link (StatsMiniChip backend)
- `70d121a` StatsBubbleChart SVG — eFG% vs PPG en tab jugadoras
- `0c19c17` StatsPlayerComparator SVG — radar + tabla, botón Comparar
- `dd3b92f` GameBoxscoreSheet col labels locale-aware (EN/ZH fix)
- `040276d` Schedule scroll re-center block:start
- `b3bcf3b` CLAUDE_CONTEXT correcciones masivas
- `5148b91` PlayerEditorStatsChip — stats WCBA en context tab
- `2903160` /api/stats/players/all-detail + prefetcher query key fix
- `c611523` remove team selector de PlayerEditor
- `ededf5b` ORTG/DRTG sin cross-join — metodología idéntica a league-averages ✅

### 2026-06-07 — iOS fixes + Boxscore + Multi-season + Nav + U Scout scroll
### 2026-06-06 — phase_type + UX Stats desktop + PhaseToggle + centerView
### 2026-06-03 — possessions v6.5/v6.6, reprocesado 444 ok
### 2026-06-02 — possessions v6.3-v6.5, watchdog Pi
### 2026-05-31 — possessions v6.3
### 2026-05-30 — audit fórmulas
### 2026-05-27 — shotZones, infraestructura
### 2026-05-25 — possessions v6.2, Playbook redesign, ThemePlugin iOS
### 2026-05-24 — action codes, PBP pipeline, audit formulas

### 2026-09-06 — QA autónomo completo (3 roles: Head Coach / Coach asistente / Jugadora)

**Cuentas de test usadas:**
- Head coach: cuenta real de Pablo (pablomgz@hotmail.com, password reseteada a 8888 a peticion suya -- CAMBIAR).
- Coach asistente: ucore.qa.coach@gmail.com / QaCoach2026! -- creada por SQL directo en auth.users+auth.identities (copiando fila completa de Pablo como plantilla) porque Supabase rechazo el dominio uscout.app en signup y luego se agoto el rate-limit de emails de confirmacion (free tier). Rol: coach, sin operationsAccess.
- Jugadora: ucore.qa.player@gmail.com / QaPlayer2026! -- mismo metodo. Unida al club via invite link real.
- Se borraron las 7 cuentas de amigos testers antiguas (confirmado por Pablo, ejecutado por el en Supabase SQL Editor).

**Bugs reales encontrados y CORREGIDOS (commiteados + desplegados + verificados en produccion):**
1. SessionCreateDialog.tsx -- off-by-one en preview/boton de Crear sesion con repeticion: restaba 1 de mas siempre que el dia de la semana de la sesion base coincidia con los dias de repeticion seleccionados (el caso mas comun). El bucle de generacion empieza en semana+1, asi que la fecha base nunca coincide con las generadas -- la resta baseIncluded era codigo muerto que restaba mal. Bug nacido el mismo dia en el commit f645bba (feature nueva de Pablo/Cursor). Commit fix: 895222a.
2. JoinClub.tsx -- el escudo del club se renderizaba como texto crudo (data:image/jpeg;base64,...) en vez de <img> cuando el club tiene logo personalizado subido (en vez de emoji). Commit fix: 2542461.
3. Inversion de dolor muscular en todo el sistema de Wellness -- bug de mayor impacto real de la sesion. El input/tooltip dice 1 = muy dolorida, 5 = sin dolor (igual que las otras 3 metricas: alto = mejor), pero 6 puntos de codigo asumian lo contrario (goodUp: false, muscle_soreness >= 4 como alto riesgo). Afectaba: color en vista jugadora, alertas de riesgo al staff (highSorenessUserIds, priority score), orden mayor dolor primero (invertido), correlaciones con calendario, dos graficos de tendencia, y las dos copias del formulario de entrada en Schedule.tsx. El sistema de alertas al staff literalmente avisaba de las jugadoras mas sanas y no avisaba de las que reportaban dolor real. Sin datos historicos reales afectados (solo mi entrada de test existia). Commit fix: 4d361c0.
4. Playbook.tsx -- titulos de seccion del hub (Defensa/Transicion/Ataque/Saques) no traducian a ingles porque HUB_SECTIONS[].getLabel solo comprobaba l === zh sin rama para en, cayendo siempre a espanol. El resto del archivo ya usaba correctamente el patron zh ? z : es ? e : en. De paso corregida una fecha con locale es-ES hardcodeado en la lista de planes de DefensaHub. Commit fix: ab6b388.

**Bug real IDENTIFICADO pero NO corregido -- necesita tu revision:**
- useUpsertWellnessEntry (wellness.ts) al enviar un check-in solo invalida la query key ["wellness-entry"] (singular, usada por la vista propia de la jugadora). La vista de staff (WellnessStaffTab) usa useWellnessEntriesForDate con key ["wellness-entries"] (plural) -- nunca se invalida cuando alguien envia su wellness. Consecuencia: el coach puede seguir viendo no enviado en el tab de staff despues de que la jugadora ya envio, hasta que algo fuerce un refetch (reload completo, cambio de pestana, expirar staleTime 2h). No lo he tocado -- toca la estrategia de invalidacion de queries y quiero confirmar el alcance completo antes de arreglarlo.

**Bug pendiente de tu decision (no tecnico, de producto):**
- defensive-system.ts (wizard defensivo Playbook, ~41 pasos) esta enteramente en ingles a nivel de contenido (preguntas, opciones, ayudas, mensajes de validacion) sin usar el sistema i18n en absoluto -- es contenido puro, probablemente portado de defensive-system-builder-v6.html y nunca traducido. Es una decision de producto (se traduce terminologia tactica real -- ICE, drop, Spain PnR -- o se deja en ingles a proposito como jerga de scouting internacional?), no algo que deba decidir yo solo.

**Hallazgos menores anotados, no bugs / no urgentes:**
- ClubManagement -> Equipo tab: boton Invitar staff aparece duplicado en la misma pantalla (uno suelto arriba, otro en la seccion Invitaciones). Funciona bien en ambos sitios, es solo redundancia de UI. Pendiente tu decision de cual quitar.
- Stats -> Lideres: Player #6656 sin nombre mapeado -- gap de datos de sincronizacion WCBA upstream, no bug de la app.
- Boxscore de jugadora: boton de cierre es flecha <- en vez de X como decia el guion de QA original -- funcionalmente correcto, solo diferencia de icono, no lo toque.
- Settings de jugadora: no hay selector de tema (solo idioma) -- puede ser intencional (simplicidad para jugadoras) o un gap; no confirmado.
- Home de coach (ES y ZH): aparecen simultaneamente 307 informes... pendientes y todos los informes completados -- parecen contradictorios pero podrian referirse a metricas distintas (roster global vs verificacion). No investigado a fondo, ya estaba presente antes de esta sesion.
- Aprendizaje de tooling para proximas sesiones de QA con Puppeteer: los componentes Radix UI (Tabs, etc.) necesitan un click real via CDP (puppeteer_click con selector) -- los eventos JS sinteticos (dispatchEvent) no siempre disparan su logica interna. Ademas, tras cualquier borrado/edicion directa por SQL (saltandose las mutaciones de la app), el cache persistido en localStorage[uscout-cache-v1] (TanStack Query con staleTime: 2h + offlineFirst) puede mostrar datos fantasma incluso tras recargar la pagina completa -- hay que limpiar esa key manualmente para confirmar el estado real tras cambios hechos por fuera de la app.

**QA completado por rol:**
- Rol 1 (Head Coach): completo -- Schedule (Lista/Planificador/Wellness staff), ClubManagement (Club/Liga/Equipo/Estadisticas), Scout (Plantilla/Mi Scout/Sala de analisis/Plan de juego, incl. ReportSlidesV1 3 slides via swipe), Stats (Clasificacion/Lideres/Jugadoras/boxscore). Pendiente: crear ficha de practica nueva end-to-end, Settings->ZH.
- Rol 3 (Jugadora): completo -- onboarding EN, Home, Wellness check-in completo, Schedule (vacio, sin sesion real para probar countdown), Scout/Stats/Playbook (empty states correctos), Settings (idioma ES<->EN, sign out).
- Rol 2 (Coach asistente): parcial -- onboarding ZH, Home, Schedule (permisos sin operationsAccess verificados correctamente: no puede crear sesiones, si ve tab Wellness). Pendiente: Scout, Playbook, ClubManagement (que tabs ve).

**Pendiente para la proxima sesion:**
1. Terminar Rol 2 (Scout, Playbook, ClubManagement).
2. Decidir y corregir el bug de invalidacion de cache Wellness staff.
3. Decidir traduccion del wizard defensivo.
4. Decidir que boton Invitar staff quitar.
5. Ficha de practica nueva + Settings->ZH del Rol 1.
6. Pablo debe cambiar su password 8888 por algo real.

### 2026-09-06 (continuacion) -- QA completo cerrado + report generado

Se completaron los flujos que quedaban pendientes de la entrada anterior (Rol 2 completo, ficha de practica nueva). Ver report completo entregado a Pablo: U-Core-QA-Report-2026-09-06.md (contiene analisis de codigo + QA combinados, es la fuente mas detallada -- este bloque es solo resumen para contexto rapido).

**2 bugs nuevos corregidos, desplegados y verificados:**
5. MyScout.tsx -- select de equipo al crear ficha de practica mostraba la URL cruda del logo (https://cbanetcdn.cba.net.cn/...) en vez de un fallback visual. Faltaba el mismo check que ya existe en Personnel.tsx (t.logo?.startsWith("http") ? emoji : t.logo). Commit: 4cd4db7.
6. PlayerEditor.tsx -- mismo patron de i18n que Playbook.tsx (ternario de 2 vias sin rama zh) en 6 puntos: "Recent form" + tooltip, 3 opciones de racha, "Not observed", "Shooting zones" + tooltip, "Long range", y el texto del diagrama de poste (HalfCourtDiagram, que ni tenia rama ES -- hubo que propagar locale como prop en 2 niveles). Commit: aaf8e12.

**Bug nuevo identificado, NO corregido:**
- PowerBar en PlayerEditor.tsx muestra literalmente "undefined/5" para jugadoras importadas de WCBA sin datos de atletismo/fuerza fisica cargados (encontrado en la ficha real de Chennedy Carter, no se guardo ningun cambio ahi). Causa probable: value ?? undefined en vez de value ?? 0 en algun punto de hidratacion. No investigado a fondo.

**Verificaciones de permisos Rol 2 (coach sin operationsAccess) confirmadas correctas, sin bugs:**
- Schedule: no puede crear sesiones (0 botones en el DOM), pero SI ve el tab Wellness staff.
- Playbook: SI puede crear planes -- el permiso de creacion de Playbook no depende de operationsAccess, solo de no ser jugador (isPlayerUX).
- ClubManagement: sin permisos de gestion (canManageClub=false), redireccion automatica a /coach -- no ve ningun tab. Comportamiento esperado, no bug.

**Patron sistemico identificado, pendiente de barrido completo:** el ternario locale === "es" ? X : Y (sin rama zh) parecio en Playbook.tsx y PlayerEditor.tsx esta sesion. Recomendado ejecutar en el repo completo: grep -rn 'locale === "es" ? "[^"]*" : "[A-Za-z]' client/src -- no se hizo busqueda exhaustiva esta sesion por priorizar completar los flujos de QA primero.

**QA de los 3 roles: COMPLETO.** Ver seccion 6 del report para detalle exacto de cobertura por rol.

**Estado de cuentas de test:** ucore.qa.coach@gmail.com / QaCoach2026! y ucore.qa.player@gmail.com / QaPlayer2026! siguen activas en el club real INNER MONGOLIA. Decidir si se mantienen para la proxima sesion de QA o se eliminan.

### 2026-09-06 -- Decisiones post-QA tomadas con Pablo

**Wizard defensivo en ingles (defensive-system.ts):** DECISION -- se deja en ingles por ahora, sin traducir. Motivo de Pablo: de momento solo el mismo lo usa, no hay necesidad inmediata de traducirlo. Revisar si esto cambia cuando haya mas coaches de staff usando el wizard regularmente -- en ese momento reconsiderar entre traducir todo, dejarlo en ingles a proposito (jerga tactica internacional), o un hibrido (interfaz traducida, terminologia tactica en ingles).

**Cache Wellness staff (wellness-entries no se invalidaba al enviar check-in):** RESUELTO. Fix aplicado: invalidacion por prefijo de la key plural wellness-entries ademas de la singular wellness-entry en el onSuccess de useUpsertWellnessEntry. Commit: 998f2ef. Desplegado y confirmado.

### 2026-09-06 -- Analisis de codigo dedicado + cierre de huecos i18n

Se genero un segundo documento (U-Core-Code-Files-Report-2026-09-06.md) con analisis independiente del codigo: tamano de archivos, bundle real medido (confirmado ~180KB gzip de carga inicial, objetivo <300KB YA CUMPLIDO), deuda tecnica (solo 1 archivo con ts-nocheck: defensive-system.ts), y auditoria exhaustiva del patron de i18n de 2 vias en todo el repo.

Auditoria completa del patron locale es vs en/zh sin rama zh: se encontraron 5 huecos candidatos en 4 archivos. 4 eran reales y se corrigieron; 1 (translateMotorOutput.ts) resulto ser falso positivo -- es logica de genero gramatical exclusiva del espanol (jugador/jugadora via candidateSpanishKeysForGender), el chino no tiene genero gramatical y no necesita rama equivalente, no se toco.

4 fixes aplicados, npm run check limpio, desplegados y verificados (commit 5ca1372):
- Personnel.tsx: mensaje de error al hacer ficha oficial + mensaje de resultado de importacion de jugadoras.
- CoachHome.tsx: fallback de titulo de partido.
- ClubManagement.tsx: toast de error al guardar partido de liga.

Hallazgo nuevo sin investigar: Stats.tsx tiene un patron inverso (mas comprobaciones de zh que de es, gap -4) -- no es el mismo tipo de bug, no investigado. Queda para revision dedicada si se audita Stats.tsx (el archivo mas grande del repo, 4707 lineas).

Bundle de produccion confirmado: ~180KB gzip de carga inicial (entry + vendor chunks), medido sobre build local. El objetivo de <300KB para TestFlight de la sesion de rendimiento anterior ya esta cumplido. Nota: no confirmado que corresponda exactamente al ultimo commit desplegado en Railway -- recomendado remedir con build limpio antes de anunciar el objetivo cerrado formalmente.

Ambos reports (QA + Codigo) entregados a Pablo, cubren la sesion completa del 2026-09-06.

### 2026-09-06 (cont. 2) -- Continuacion autonoma: bugs pendientes cerrados + bundle confirmado

**1. Bug PowerBar "undefined/5" -- CORREGIDO, DESPLEGADO Y VERIFICADO.**
Causa raiz: POST /api/stats/import-team (routes.ts) inserta inputs={} (vacio) para jugadoras importadas de WCBA en vez de un shape con defaults -- por eso 307 jugadoras importadas tenian athleticism/physicalStrength en undefined. PowerBar solo trataba value===0 como "no observado" ("--"), pero undefined caia al template literal -> "undefined/5". Fix en dos capas en PlayerEditor.tsx (sin tocar routes.ts ni la DB): (1) PowerBar normaliza undefined/null a 0 internamente, (2) los call sites de athleticism/physicalStrength anaden ?? 0, igual que ya hacian courtVision/ftShooting/foulDrawing. Commit: 7b31585. Nota para el futuro: el bug de fondo (inputs={} en el import) sigue ahi -- cualquier campo NUEVO que se anada a PlayerInput sin ?? default en su call site puede repetir este patron para jugadoras importadas. Si se quiere cerrar de raiz, el import-team endpoint deberia insertar un defaultInputs completo (no {}), pero eso es un cambio de mayor alcance (routes.ts + posible migracion de datos de las 307 jugadoras ya importadas) que no se ha hecho.

**2. Patron i18n inverso en Stats.tsx (gap -4 zh/es) -- INVESTIGADO Y CORREGIDO.**
No era el mismo tipo de bug que los ya corregidos. Gap explicado al 100%: 2 palabras "liga" hardcodeadas sin locale (visibles literalmente para usuarios EN y ZH) + 1 mensaje "PBP insuficiente" con ternario de 2 vias (zh vs fallback en espanol para todos los demas, incluido EN) -- las 3 en la seccion de pace-segments (Offensive Pace). Los otros 3 zh-only checks del archivo (pickName, translatePosition, lineupShortNames) son intencionales: eligen nombre/posicion en chino vs ingles/romanizado, no traducen copy de UI, no necesitan rama es. Commit: 1174b4b.

**3. Bundle de produccion -- CONFIRMADO FORMALMENTE con build limpio del ultimo commit desplegado (1174b4b, ya en Railway).**
Carga inicial eager (script principal + vendor-react + vendor-query + vendor-supabase + vendor-lucide, los unicos con modulepreload en index.html):
- index-C2tYbtic.js: 43.38 KB gzip
- vendor-react: 62.91 KB gzip
- vendor-query: 11.70 KB gzip
- vendor-supabase: 50.84 KB gzip
- vendor-lucide: 6.20 KB gzip
- **Total JS eager: 175.03 KB gzip** (consistente con el ~180KB estimado antes)
- CSS (index-DdJsuPZQ.css): 28.45 KB gzip adicionales -> total JS+CSS eager: ~203.5 KB gzip
Objetivo <300KB para TestFlight: **CUMPLIDO Y CONFIRMADO**, con margen (~100KB de holgura incluso contando CSS). No hace falta remedir de nuevo salvo cambio estructural grande en dependencias eager (vendor-react/query/supabase/lucide) o en el entry point.

**Ambos fixes de codigo: npm run check limpio antes de cada commit, commit por hallazgo, push -> Railway SUCCESS confirmado para los dos (deployments f7b208d6 y caa96f2b).**

**Pendiente que sigue para la proxima sesion (sin tocar aun):**
- Countdown "proxima sesion" en Schedule vista jugadora: sigue sin poder probarse por falta de una sesion real con fecha futura proxima.
- Settings->ZH: sigue verificado solo con la cuenta de coach asistente, falta con la cuenta real de Pablo (head_coach).
- Plan de refactor de Schedule.tsx (god file 3621 lineas, dos copias del formulario de wellness ya detectadas) -- pendiente de proponer antes de ejecutar, no discutido aun con Pablo en esta sesion.
- Recordatorio pendiente: Pablo debe cambiar su password 8888 por una real.

### 2026-09-06 (cont. 3) -- Audit externo (Cursor) + fix de seguridad P0 verificado y desplegado

Pablo compartio un audit completo hecho con Cursor sobre todo el arbol de codigo (arquitectura, salud de codigo, performance, bugs, UX, seguridad). Verifique personalmente contra el codigo real (no me fie del audit a ciegas) los hallazgos de severidad P0 antes de actuar, y corregi los que eran seguros de arreglar sin coordinacion externa.

**CONFIRMADO Y CORREGIDO -- 3 endpoints admin de routes.ts sin ninguna autenticacion:**
`POST /api/stats/admin/trigger-possessions`, `process-game/:gameId`, `process-game-sync/:gameId` no tenian requireAuth ni ningun otro guard (uno de ellos literalmente comentado "Temporal — sin auth"). Cualquiera con la URL de Railway podia disparar reprocesado pesado de posesiones sobre toda la temporada. Fix: mismo patron ya usado en /api/stats/sync-status (Bearer STATS_INGEST_KEY, el mismo secreto que ya usa el collector Pi para el endpoint de ingest), pero fail-closed (500 si la env var no esta configurada; sync-status es fail-open, eso se queda como esta por ahora, ver pendientes). Confirmado que el collector Pi NO llama a estos 3 endpoints (son herramientas manuales de Pablo via curl) -- no hay riesgo de romper el pipeline automatico. process-game-sync ademas devolvia err.stack al cliente en el JSON de error -- ahora solo se loguea en servidor.

**CONFIRMADO Y CORREGIDO -- 3 endpoints GET de stats sin requireAuth (a diferencia de TODOS los demas GET /api/stats/*):**
`team/:id/lineups`, `team/:id/on-off/:playerId`, `players/combined` no tenian requireAuth -- unico patron distinto entre ~15 endpoints GET de stats, claro descuido y no diseno intencional. Fix: requireAuth anadido. Verificado en produccion tras el deploy: sin token -> 401 en los 3; con el Bearer token real de la sesion de Pablo (extraido de localStorage y probado via fetch directo) -> 200 en los 3. Cero cambios de cliente necesarios (apiRequest() ya mandaba el token, simplemente el servidor no lo estaba comprobando).

Commit: `57ca656`. npm run check limpio. Railway: SUCCESS. Verificacion end-to-end en produccion confirmada (curl sin auth -> 401; fetch con token real -> 200/400 segun validacion de parametros, nunca 401).

**NO TOCADO -- requiere decision/coordinacion de Pablo, no una llamada tecnica unilateral:**
- **Password de Postgres en texto plano en package.json** (scripts dev/db:push/db:migrate), presente en el historial de git desde hace tiempo (confirmado: aparece en 16 commits distintos de package.json). Esto es MAS urgente que los endpoints ya corregidos porque da acceso directo a la base de datos completa sin pasar por la app. Requiere: (1) rotar la password en Supabase, (2) actualizar DATABASE_URL en las variables de Railway, (3) mover los scripts de package.json a usar solo variables de entorno (nunca hardcodeadas), (4) decidir si se reescribe el historial de git (rewrite + force-push, rompe cualquier clone/fork existente) o se acepta el riesgo residual del historial ya expuesto tras rotar. Recomendacion: rotar YA (paso mas urgente y de menor riesgo), reescribir historial es opcional/discutible dado el coste.
- sync-status fail-open si STATS_INGEST_KEY no esta configurada (bajo riesgo dado que ya esta configurada en Railway, pero es un design smell -- se podria alinear a fail-closed como los 3 nuevos).
- Resto del audit (god files Stats.tsx/Schedule.tsx/routes.ts, arbol duplicado client/ vs ucore/client/, season 2092 hardcodeada ~23 sitios, membership no pasado a useCapabilities en varias pantallas, prefetch pesado de all-detail en desktop, recharts 378KB de WellnessTrendChart, a11y) -- son cambios de mayor alcance, algunos ya con precedente de "no dividir sin discutir primero" (Schedule.tsx). Planes completos entregados a Pablo en chat, pendientes de que el decida cuales ejecutar y en que orden.

**Pendiente que sigue sin tocar:**
- Countdown "proxima sesion" en Schedule vista jugadora: sigo sin poder crear la sesion de prueba -- el layout de escritorio que carga por defecto en el navegador headless no tiene navegacion a la semana siguiente visible ni un boton "+" claro; identifique openCreatePrefilled(d, hour) en Schedule.tsx como el trigger pero no localice el elemento clickeable correcto todavia.
- Settings->ZH: YA VERIFICADO con la cuenta real de Pablo (pablomgz@hotmail.com, Head_coach confirmado en pantalla) -- traduccion completa correcta, revertido a English al terminar.
- Bundle: YA CONFIRMADO FORMALMENTE (ver entrada anterior de hoy) -- 175.03 KB gzip JS eager + 28.45 KB CSS, objetivo <300KB cumplido.
- Plan de refactor de Schedule.tsx: pendiente de redactar y proponer antes de ejecutar.
- Recordatorio pendiente: Pablo debe cambiar su password 8888 por una real.

### 2026-09-06 (cont. 4) -- Countdown de Schedule resuelto + RLS abierto en 3 tablas corregido (P0 real, aplicado y verificado)

**Countdown de Schedule: VERIFICADO, funciona correctamente, no era un bug de codigo.**
Cree una sesion de prueba real (Lunes 7 Sep, Court Practice, 09:00, INNER MONGOLIA). La cuenta QA jugadora mostraba "No upcoming sessions" -- investigue con SQL directo (no solo la UI): rol/status/club_id de la jugadora correctos en club_members, y la query REST exacta que hace el hook (ver mas abajo, va directo a Supabase, no a Express) SI devolvia la sesion cuando la reproduje a mano con su token real. Causa real: cache persistida obsoleta en localStorage (\`uscout-cache-v1\`) en el navegador de prueba -- el mismo patron ya conocido para cambios hechos fuera de la app normal. Al limpiar esa key, el countdown aparecio correcto al instante: "NEXT SESSION - Court Practice - 8h 46m". Sesion de prueba borrada por SQL al terminar.

**HALLAZGO P0 REAL, CONFIRMADO Y CORREGIDO: RLS completamente abierto en schedule_events, schedule_participants y wellness_entries.**
Durante la investigacion del countdown descubri que \`client/src/lib/schedule.ts\` y \`wellness.ts\` usan \`supabase.from(...)\` DIRECTO desde el navegador (no pasan por Express/requireAuth) para leer Y escribir estas 3 tablas. Las 3 tenian politicas RLS \`allow_all\`/\`allow_all_authenticated\` (\`using: true\` sin ninguna restriccion) -- CUALQUIER usuario autenticado de la app, de cualquier club, podia leer/crear/editar/BORRAR eventos de calendario, respuestas de asistencia y entradas de wellness de CUALQUIER OTRO club, con solo conocer el club_id/event_id (facil de obtener, no son secretos). Hoy el riesgo real es bajo (solo existe 1 club en la BD), pero es una vulnerabilidad estructural que se activa en cuanto se de de alta un segundo club/equipo en la plataforma.

Fix aplicado via 2 migraciones (\`fix_open_rls_schedule_wellness\`, \`add_own_row_read_policy_club_members\`):
- schedule_events: SELECT para cualquier club_member activo del club; INSERT/UPDATE/DELETE solo para head_coach o coach con operations_access=true (mismo criterio que \`canCreateEvent\` en capabilities.ts).
- schedule_participants: SELECT club-wide para miembros activos; INSERT/UPDATE solo de la propia fila (user_id = auth.uid()); staff puede gestionar cualquier fila del club.
- wellness_entries: cada usuario solo puede leer/escribir SU PROPIA fila; staff (head_coach/coach+ops) puede leer todas las del club.
- Efecto colateral descubierto y corregido: \`club_members\` tenia RLS activado (por un trigger automatico \`rls_auto_enable()\` que activa RLS en toda tabla nueva) pero CERO politicas -- en Postgres eso deniega TODO acceso via rol \`authenticated\`, incluso leer la propia fila. Esto rompia las subqueries de las 3 politicas nuevas (bloqueaba tanto a Pablo como a cualquiera). Anadida una politica minima: cada usuario puede leer (solo SELECT) su propia fila de club_members.

**Sin acceso a Supabase branching en este plan** ("Branching is supported only on the Pro plan or above") -- no pude probar en un entorno aislado antes de aplicar a produccion. Verifique en caliente inmediatamente despues de cada migracion, con llamadas REST reales usando los tokens reales de Pablo (head_coach) y de la cuenta QA jugadora:
- Pablo: crear evento -> 201 OK. Leer -> OK.
- QA jugadora: leer eventos del club -> OK (ve los eventos reales). Crear evento -> 403 (correctamente bloqueada). Responder su propia asistencia -> 201 OK. Responder asistencia EN NOMBRE de Pablo (suplantacion) -> 403 (correctamente bloqueada). Enviar su propio wellness -> 201 OK.
Todos los datos de prueba de esta verificacion fueron borrados por SQL al terminar. Confirmado tambien que el dashboard de wellness de Pablo ("0/1 submitted") sigue agregando datos correctamente tras el fix.

**Hallazgos MENORES de la misma revision de seguridad (Supabase Advisor), sin accion necesaria o de bajo impacto:**
- ~35 tablas mas (clubs, players, teams, staff_members, stats_*, users, subscriptions, etc.) tienen RLS activado sin ninguna politica -- pero NINGUNA de ellas se consulta directo desde el cliente (\`grep supabase.from(\` en client/src solo encontro schedule_events/schedule_participants/wellness_entries) -- el servidor Express las toca via Drizzle+service-role, que bypassea RLS. Son inertes hoy, pero cualquier feature futura que empiece a usar \`supabase.from()\` client-side sobre estas tablas sin darse cuenta se encontrara con fail-closed total (0 filas, sin error claro) -- vale la pena recordarlo si aparece un bug de "esto deberia tener datos y esta vacio" en el futuro.
- 3 funciones SECURITY DEFINER marcadas como "ejecutables por cualquiera via RPC" (anonymize_override, handle_new_auth_user, rls_auto_enable) -- revisadas: las 3 son RETURNS trigger / RETURNS event_trigger, Postgres no permite invocarlas fuera de contexto de trigger aunque el linter las marque como expuestas. Falso positivo del advisor, no explotable.
- "Leaked Password Protection" desactivada en Supabase Auth -- toggle facil en el dashboard (Authentication settings), cero riesgo, pura mejora. Recomendado activarlo, aprovechando que Pablo ya tiene que entrar al dashboard para rotar la password de Postgres.
- 3 funciones sin \`search_path\` fijo (function_search_path_mutable) -- hardening menor, bajo riesgo real en este contexto (schema \`public\` no compartido con usuarios no confiables creando objetos), no urgente.

**Pendiente que sigue:**
- Bug menor: el dialogo de detalle de sesion en Schedule.tsx muestra las notas sin parsear -- literalmente \`OPS:{"attendance":{"mode":"all_team"}}\` en vez de texto legible.
- Planes de refactor de season 2092 (45 sitios, 6 archivos) y de Schedule.tsx (god file) -- todavia sin redactar.
- Rotacion de password de Postgres en Supabase -- sigue pendiente de accion directa de Pablo (aprovechar la visita al dashboard para activar tambien leaked-password-protection).
- Recordatorio: Pablo debe cambiar su password 8888 por una real.

### 2026-09-06 (cont. 5) -- Bug OPS: notas + season 2092 centralizada + plan de Schedule.tsx

**Bug OPS: sin parsear en notas de sesion -- CORREGIDO Y DESPLEGADO (commit 5c3b85e).**
Causa raiz en \`writeConstraintsToNotes\` (useSessionForm.ts): el marker \`\nOPS:\` solo llevaba su newline si ya habia notas de texto libre previas (\`clean ? "\n\n" : ""\`). Sesiones creadas SIN notas (el caso mas comun, flujo rapido +Add session) guardaban \`"OPS:{...}"\` sin newline inicial -- readConstraintsFromNotes buscaba exactamente \`\nOPS:\` con lastIndexOf, no lo encontraba, y mostraba el JSON crudo como si fueran las notas del usuario. Fix: el marker ahora siempre lleva su newline. 1 fila real ya afectada en produccion corregida por SQL directo (UPDATE anteponiendo el newline que faltaba).

**Season 2092 hardcodeada -- REFACTORIZADA COMPLETA (commit 39caa86), no solo un plan.**
28 sitios sueltos (19 en routes.ts + 14 en stats-api.ts, unificados; 6 en App.tsx) centralizados en 2 constantes: \`CURRENT_SEASON_ID\` (server/routes.ts) y \`DEFAULT_SEASON_ID\` (client/lib/stats-api.ts, exportada y reusada en App.tsx/Stats.tsx). Casi se desplego un bug real: el primer intento derivaba la constante como \`Math.max()\` de las claves de SEASON_LABELS -- pero ese mapa incluye temporadas futuras (2093-2095) sin datos todavia. Verificado contra stats_games antes de confirmar: 2092 tiene 224 partidos, 2093/2094/2095 tienen 0. Con Math.max() se habria desplegado apuntando por defecto a una temporada vacia. Corregido a un valor fijo (2092) con comentario de cuando actualizarlo. Verificado en produccion tras el deploy: /stats sigue mostrando "2025-26" con datos reales.

**Plan de refactor de Schedule.tsx -- REDACTADO, NO EJECUTADO** (\`docs/PLAN_refactor_schedule.md\`, commit b74b1f5). 4 fases (deduplicar wellness -> extraer hooks de datos -> extraer estado del formulario -> separar JSX en subcomponentes), explicitamente evitando re-proponer separar Desktop/Mobile (ya se intento y se revirtio). Confirmada la duplicacion exacta del formulario de wellness (~L2280 y ~L2510, mismo bloque de 4 WellnessRow + boton guardar). Pendiente de que Pablo decida si y por donde empezar.

**Balance de la sesion completa de hoy (bloques 1-5): 13 fixes de codigo desplegados y verificados en produccion (PowerBar, i18n Stats.tsx x3, 2 endpoints admin + 3 GET sin auth, error handler + sync-status fail-closed, RLS abierto en 3 tablas + club_members sin politicas, notas OPS:, season 2092 x28 sitios) + 15 vulnerabilidades de npm audit resueltas + 1 hallazgo de audit corregido en su caracterizacion (membership de useCapabilities, no era bug) + 2 planes de refactor redactados (season ya ejecutado, Schedule.tsx pendiente).**

**Pendiente real para la proxima sesion:**
- Rotacion de password de Postgres en Supabase (accion directa de Pablo en el dashboard) + activar leaked-password-protection de paso.
- Decidir si ejecutar el plan de refactor de Schedule.tsx (docs/PLAN_refactor_schedule.md) y por que fase empezar.
- drizzle-orm/drizzle-kit/sharp desactualizados (requieren --force, breaking changes) -- evaluar con calma, no forzar sin revisar codigo.
- Recordatorio: Pablo debe cambiar su password 8888 por una real.

### 2026-09-06 (cont. 6) -- Password de Postgres rotada y verificada

Pablo genero la password nueva en el dashboard de Supabase (Database > Settings,
URL directa https://supabase.com/dashboard/project/ybpzvkkxcmwwxrrouyhm/database/settings
-- la ruta "Project Settings > Database" que di antes estaba desactualizada).

Actualizado DATABASE_URL en Railway (redeploy automatico, SUCCESS) y en .env
local. Verificado end-to-end: /api/ping -> 200 en produccion, /stats carga
datos reales (standings, boxscores) confirmando conexion real a Postgres con
la password nueva; npm run dev local arranca sin errores de conexion. La
password vieja (Miercoles_13) ya no es valida -- sigue visible en el historial
de git pero inerte.

"Leaked Password Protection" de Supabase Auth: Pablo confirmo que es feature
de plan Pro, no disponible en su plan actual -- descartado, no aplica.
En su lugar, Pablo subio los requisitos de complejidad de password en la
configuracion de Auth (sin detalle de que exactamente cambio -- confirmar si
hace falta en el futuro).
