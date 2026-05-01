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
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides (rediseño Figma pendiente de aplicar)
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
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

## Estado sesión 1 mayo 2026 — CIERRE

### Último commit
`fix: Mi Club crash, Schedule ends_at, RLS policies, flow U Scout sandbox/canonical, Personnel/MyScout visibility, auth resolveRole, planner timezone, matches Bearer token`

### Bugs resueltos esta sesión ✅
- Mi Club crash `Array.isArray` guard en `matchesQ` filters — el crash era `(matchesQ.data ?? []).filter` cuando `matchesQ.data` era un objeto truthy no-array. Fix: `(Array.isArray(matchesQ.data) ? matchesQ.data : []).filter`
- Schedule `ends_at` calculado desde `durationMins` como fallback cuando no hay hora de fin
- RLS Supabase: políticas `allow_all` en `schedule_events`, `schedule_participants`, `wellness_entries`
- `matchesQ` queryFn y mutations usan `apiRequest` con Bearer (ya no `fetch` sin auth)
- Partidos Mi Club: formulario separado `<input type="date">` + `<input type="time">`, hora por defecto 12:00
- Planner Schedule: timezone fix con `toLocaleDateString("sv")` en todos los filtros de día
- Planner Schedule: auto-scroll a hoy con retry loop (hasta 15 intentos × 100ms)
- Planner Schedule: remarcado visual hoy con `border-2 border-primary`
- Planner Schedule: `useCreateScheduleEvent.onSettled` invalida `["schedule","events"]` completo con `exact:false`
- Flow U Scout sandbox privado: `MyScout` solo muestra fichas sandbox propias (excluye canónicas)
- `Personnel`: head_coach no ve sandbox de otros coaches; filtro tanto en `playersByTeam` como en `unassigned`
- `hasReport` usa `player.inputs` / `player.scoutingInputs` con `Object.keys(inp).length > 3`
- `canManageRoster` solo `isHeadCoach` (quitado `operationsAccess` del perfil auth que siempre era false)
- Botón "Make official" visible para head_coach en cualquier ficha sandbox (propias o ajenas)
- `server/auth.ts`: `resolveRole()` con logging de roles privilegiados (`head_coach`/`master`)
- `client/src/lib/club-api.ts`: `useClub` queryFn sanitiza respuesta — lanza error si no hay `club`, normaliza `members`/`pendingInvitations` a arrays

### 🔴 RIESGOS ACTIVOS (seguridad — sesión dedicada pendiente)
- **P0** Privilege escalation: `user_metadata.role` confiado en servidor → cualquier usuario puede autopromocionar a `head_coach`/`master`. `resolveRole()` solo loguea, no bloquea. Fix real: tabla `user_roles` en Supabase server-controlled.
- **P0** Endpoints sin scope de org: `/api/teams` devuelve todos los equipos a cualquier usuario autenticado. `/api/players` sin filtro por club.
- **P0** `is_canonical` vs `isCanonical` mismatch: servidor devuelve `is_canonical` (snake_case), código cliente a veces lee `isCanonical` (camelCase). Film Room puede mostrar/ocultar jugadoras incorrectamente.
- **P1** Race condition invitaciones: doble accept concurrent puede pasar ambos "unused" checks antes de marcar usada.
- **P1** Operaciones destructivas no transaccionales: publish/merge/clear pueden dejar estado inconsistente en fallo parcial.

### 🟡 PENDIENTE PRÓXIMA SESIÓN (prioridad orden)
1. **ReportSlidesV1 rediseño Figma**: prompt completo generado en sesión 1may. Estructura Figma leída via `get_metadata` (nodos 1:2 Slide1, 1:43 Slide2, 1:101 Slide3). Cambios: Slide 1 con Threat Card barra lateral izquierda + TOP SITUATIONS lista con barras; Slide 2 con número `01/02/03` grande + badge tier PRIMARY/SECONDARY + barra frecuencia; Slide 3 con `When:/How:/Why:` en DENY/FORCE + "N alternatives ›" link + ALSO WATCH separador. Campos `when/how/why` pueden no existir en tipo actual → usar `(report.defense.deny as any).when`.
2. **Seguridad P0**: tabla `user_roles` server-controlled, scope org en endpoints `/api/teams` y `/api/players`.
3. **Audit visual completo**: tokens semánticos en todas las pantallas (sin `bg-white`, `bg-slate-*`, hex hardcoded). Temas Gamenight/Office/Oldschool funcionando.
4. **Figma MCP**: `get_metadata` funciona (probado sesión 1may). `get_design_context` falla por límite plan Starter. NO intentar Figma MCP salvo que Pablo lo pida explícitamente.
5. **TestMode.tsx**: archivo sin ruta activa — eliminar en limpieza.
6. **Audit general**: flows end-to-end, responsive 375px, touch targets 44px.

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
- **U Schedule** — `core/Schedule.tsx` (228 KB god file)
- **U Wellness** — check-in jugadoras (embebido en Schedule)
- **U Scout** — scouting defensivo 1-on-1 (módulo más avanzado)
- **U Stats** — DB lista, collector pendiente Pi
Shell: `core/ModulePage.tsx` + `core/ModuleNav.tsx`

### Bundle
- **229 KB gzip** — objetivo <300 KB cumplido

### Motor
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Miembros: Pablo (owner) + Luffy + Yuming + Javier + Mario (coach)

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
