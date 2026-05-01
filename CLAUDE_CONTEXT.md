# U Scout — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
- Repo local: `/Users/palant/Downloads/U scout`

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind

## Archivos clave
- `client/src/lib/motor-v4.ts` — scoring layer
- `client/src/lib/motor-v2.1.ts` — motor base
- `client/src/lib/reportTextRenderer.ts` — texto EN/ES/ZH con gender
- `client/src/lib/mock-data.ts` — playerInputToMotorInputs, clubRowToMotorContext
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides (rediseño Figma YA APLICADO)
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/core/Schedule.tsx` — god file 228KB (U Schedule)
- `server/routes.ts` — rutas API Express
- `server/storage.ts` — acceso Supabase
- `scripts/calibrate-motor.ts` — 66 perfiles (100% / 551 checks)
- `scripts/eval-motor-quality.ts` — 10 perfiles calidad
- `scripts/eval-report-llm.ts` — evaluador multi-juez v2 (pendiente API keys)

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- `client/src/lib/i18n.ts` — re-export shim
- `client/src/lib/locales/en|es|zh.ts` — chunks lazy

## Capacitor
- `capacitor.config.ts` — appId: com.ucore.app, webDir: dist/public
- iOS platform añadido: `ios/` en repo
- Xcode: NO instalado · Apple Developer Account: NO ($99/año — pendiente)
- Retomar: `npx cap sync && npx cap open ios`

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Arquitectura 4 capas U Scout
1. `motor-v4.ts` → scores + candidatos
2. `reportTextRenderer.ts` → texto EN/ES/ZH
3. `overrideEngine.ts` → overrides + discrepancias
4. `ReportSlidesV1.tsx` + `ReportViewV4.tsx` → UI

## Flujo de navegación
Personnel → PlayerEditor → MyScout → FilmRoom → GamePlan

---

## Estado sesión 1 mayo 2026 (p2) — ACTUALIZADO fin de sesión

### Último commit
`fix: hasReport Primary/Secondary, Schedule scroll recentra en planner, kebab landscape simplificado`

### Bugs resueltos esta sesión ✅
- **hasReport MyScout**: lógica reemplazada — ya no usa `Object.keys(inp).length > 3`. Ahora evalúa `isoFrequency/pnrFrequency/postFrequency/transitionFrequency === "Primary" | "Secondary"`. Aplica en canonicalPlayers y sandboxPlayers.
- **Schedule scroll List→Planner**: `useEffect` de `tryScroll` ahora depende de `[staffView]` y hace `return` si `staffView !== "planner"`. Recentra en hoy cada vez que el coach activa la vista planner.
- **Schedule kebab landscape**: eliminados los 21 items "move to" (`days.flatMap(...)`) del `DropdownMenuContent` landscape. Menú ahora: edit / duplicate / template / cancel.

### 🔴 RIESGOS ACTIVOS
- **P1** Operaciones destructivas no transaccionales: publish/merge/clear en scout versions pueden dejar estado inconsistente en fallo parcial. Bajo impacto real en uso actual.

### 🟡 PENDIENTE PRÓXIMA SESIÓN (orden prioridad)
1. **Override UI en ReportViewV4**: `report_overrides` en DB y endpoint `POST /api/players/:id/overrides` existen, pero sin UI para que el coach haga hide/keep de situaciones antes de aprobar. Flujo Film Room → Game Plan incompleto.
2. **Limpieza capabilities.ts**: `readCoachBadges()`, `CoachBadges` type e `isPhysicalTrainer` son código muerto — `canManageWellness` no los usa. Eliminar sin efecto.
3. **Touch targets ReportSlidesV1**: flechas de navegación usan `p-2` = 32px, mínimo mobile es 44px.
4. **`useCapabilities` sin membership real**: se llama sin `membership` en varios contextos. `canManageClub` puede ser false incorrectamente para coaches con `operationsAccess`.
5. **Audit visual**: tokens hardcoded (`bg-emerald-600` en FilmRoom). Temas Gamenight/Office/Oldschool sin verificar end-to-end.
6. **Wellness standalone**: jugadora no tiene acceso directo al check-in sin ir a `/schedule`.
7. **Notificación jugadora**: sin badge/push cuando llega informe nuevo.

---

## U Scout — rutas activas (1 mayo 2026)
- `/coach` → CoachHome (4 contenedores + alertas smart)
- `/coach/personnel` → Personnel (fichas canónicas + sandbox + equipos)
- `/coach/my-scout` → MyScout (solo fichas sandbox propias del coach)
- `/coach/quick-scout/:id` → QuickScout (wizard adaptativo 7 ramas)
- `/coach/player/:id` → PlayerEditor (editor completo)
- `/coach/film-room` → FilmRoom (revisión colectiva anti-bias)
- `/coach/game-plan` → GamePlan (publicados al roster)
- `/coach/scout/:id/review` → ReportViewV4
- `/coach/scout/:id/preview` → ReportSlidesV1
- `/coach/club` → ClubManagement (4 tabs: Club/Liga/Equipo/Stats)
- `/settings` → Settings (3 temas: Gamenight/Office/Oldschool)

**Rutas eliminadas:** `/coach/editor`, `/coach/reports`, `/coach/team/:id`, `/coach/test`

## Flow U Scout (workflow correcto)
```
head_coach/badge → Personnel → crear ficha CANÓNICA → aparece en Film Room
cualquier coach  → MyScout  → crear ficha SANDBOX  → privada, solo visible a ese coach
coach            → PlayerEditor → rellenar inputs → guardar scout version
coach            → MyScout → "→ Film Room" → submit version
Film Room        → ver versiones → detectar discrepancias → elegir versión final
head_coach       → Game Plan → publicar a jugadoras
```

## Schema Supabase (fuera de schema.ts)
- `players.is_canonical` boolean DEFAULT false
- `player_scout_versions` (player_id, coach_id, inputs JSONB, status, submitted_at)
- `league_matches` (club_id, rival_name, match_date, location, match_type)
- `schedule_events`, `schedule_participants`, `wellness_entries` — RLS con `allow_all` aplicado
- `user_roles` (user_id UUID PK, role TEXT, granted_by UUID, granted_at TIMESTAMPTZ) — server-controlled, RLS deny_all para clientes
- CASCADE: players→teams, report_*→players, player_scout_versions→players

## Nombres EN/ES/ZH
| Menú | EN | ES | ZH |
|------|----|----|----|
| Infraestructura | Personnel | Plantilla | 球员档案 |
| Mi trabajo | My Scout | Mi Scout | 我的报告 |
| Trabajo grupo | Film Room | Sala de análisis | 集体分析 |
| Publicado | Game Plan | Plan de juego | 比赛方案 |

---

## U CORE — módulos
- **U Schedule** — `client/src/pages/core/Schedule.tsx` (god file, Schedule.tsx en pages/core/ no en src/core/)
- **U Wellness** — check-in jugadoras (embebido en Schedule)
- **U Scout** — scouting defensivo 1-on-1 (módulo más avanzado)
- **U Stats** — DB lista, collector pendiente Pi
Shell: `client/src/pages/core/ModulePage.tsx` + `client/src/pages/core/ModuleNav.tsx`

### Bundle
- **229 KB gzip** — objetivo <300 KB cumplido

### Motor
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Pablo (b334e51a) = owner + head_coach
- Javier (6c5b76ab) = coach
- Samuel/Luffy (3db8ec31) = coach
- Yuming (0d27576d) = coach
- rodman91jym (1d72e00d) = coach
- keitotm (3039a355) = coach
- Mario (ccf99303) = coach

### Raspberry Pi
- Comprada (Pi 5 8GB) — en tránsito
- Uso: WCBA scraper + Telegram bot + Tailscale SSH

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio, nunca SVG desde código
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor completo
- `npm run check` después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca `drizzle-kit push`

## Scripts
```bash
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-report-llm.ts --judge deepseek --fast
```

## Terminología
- DENY/FORCE/ALLOW: instrucciones defensivas slide 3
- AWARE: alertas situacionales (max 2)
- Runners-up: alternativas rankeadas por el motor
- Override: decisión entrenador sobre output del motor
- Discrepancia: dos entrenadores con opciones distintas
- Hot/Cold/Stable: tendencia reciente jugador — campo `recentForm` en PlayerInput
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual

## Notas de sesión (trampas conocidas)
- `Schedule.tsx` está en `client/src/pages/core/`, NO en `client/src/core/`
- bash_tool corre en Linux y NO puede acceder al filesystem del Mac — usar siempre Filesystem MCP para leer/escribir archivos del repo
- Filesystem MCP es de solo lectura para Claude en esta configuración (write disponible vía Filesystem:write_file)
- Figma MCP: `get_metadata` funciona en plan Starter; `get_design_context` falla por límite de llamadas — no usar salvo petición explícita
