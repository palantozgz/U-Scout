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
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/scout/Dashboard.tsx` — lista equipos/jugadores
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
Dashboard → PlayerEditor → ReportViewV4 → Proponer/Publicar

---

## Estado actual — sesión 27 abr 2026

### Commits de hoy (main)
- `feat: bloque-A limpieza repo — 15 archivos basura, aliases muertos, pages/coach→pages/scout`
- `feat: bloque 1 — hot/cold streaks, approval indicators, discrepancy UI, Home crash fix`
- `feat: sprint 1+2A — U Scout workflow redesign, player_scout_versions schema, Schedule crash fix`
- `feat: sprints 2B+3 — Personnel UI, MyScout UI, Schedule crash fix, header spacing, isCanonical schema`

### U Scout — nuevo workflow (sprints 1–3)
**Arquitectura de 4 contenedores aprobada e implementada:**
- `/coach` → CoachHome rediseñado: alertas smart + Personnel + separador WORKFLOW + MY SCOUT → FILM ROOM → GAME PLAN
- `/coach/personnel` → Personnel.tsx: fichas canónicas (head_coach) + modo sandbox (coaches normales)
- `/coach/my-scout` → MyScout.tsx: mis fichas, botón → Film Room solo si isCanonical + tiene report
- `/coach/film-room` → FilmRoom.tsx: stub (Sprint 4)
- `/coach/game-plan` → GamePlan.tsx: stub (Sprint 5)

**Schema añadido (SQL Supabase, no schema.ts):**
- `players.is_canonical` boolean DEFAULT false
- `player_scout_versions` tabla: (player_id, coach_id, inputs JSONB, status, submitted_at)
- Datos de experimentos limpiados (DELETE FROM players/approvals/overrides)

**Backend añadido (storage.ts + routes.ts):**
- `POST /api/players/:id/canonical` — promover a canónica (head_coach/master)
- `PUT /api/players/:id/scout-version` — guardar versión coach
- `POST /api/players/:id/scout-version/submit` — enviar al Film Room
- `GET /api/players/:id/scout-versions` — listar versiones (anti-bias: solo si ya enviaste)

**PlayerProfile en mock-data.ts:**
- `isCanonical?: boolean`
- `createdByCoachId?: string`

**Hotfixes:**
- Schedule.tsx: `clubQ.data.club.` → `clubQ.data.club?.` (2 puntos)
- ModuleHeader.tsx: MARK_SIZE 120→88, HEADER_PT 1.25→0.75rem (todos los módulos)
- Home.tsx cards: eliminado `uppercase` CSS (solo U Core mantiene mayúsculas)

**Nombres finales EN/ES/ZH:**
| Menú | EN | ES | ZH |
|------|----|----|----|
| Infraestructura | Personnel | Plantilla | 球员档案 |
| Mi trabajo | My Scout | Mi Scout | 我的报告 |
| Trabajo grupo | Film Room | Sala de análisis | 集体分析 |
| Publicado | Game Plan | Plan de juego | 比赛方案 |

**Sprints completados:**
- Sprint 4 ✅ Film Room UI — vista colectiva, anti-bias lock, panel discrepancias, → Game Plan
- Sprint 5 ✅ Game Plan UI — lista publicados, badge emerald, ↩ Retirar (head_coach)

**Pendiente:**
- Sprint 6: Stats badges (cuando Pi esté activa)
- Wizard rápido 3 preguntas (entrada opcional PlayerEditor)
- Offline approve-en-hold
- Alertas smart CoachHome (conectar datos reales de próximo partido y pendientes)

### Sesión anterior (25 abr)
- `perf: i18n lazy loading + React.lazy — bundle 509→268 KB gzip`
- `perf: remove framer-motion, lazy BasketballAvatar — 268→229 KB gzip`
- `perf: prefetch club data on Home mount + staleTime 5min`
- `fix: mobile responsive audit — 17 fixes across 6 files`
- `fix: invitation flow — auto-accept after login, persist token through auth`
- `fix: hide owner kebab in ClubManagement MemberRow`
- `fix: bloque 2 — race condition sessions, landscape padding, safe-area, timezone wellness, expiry warning invitaciones`

### Bundle ✅
- **229.49 KB gzip** — objetivo <300 KB cumplido
- Margen para U Stats completo: ~265 KB estimado

### Motor ✅
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)

### U Stats DB ✅
- Schema completo en Supabase (tablas stats_*)
- Seed: WCBA (competitionId=56, seasonId=2092) + 18 equipos
- Blueprint: `STATS_BLUEPRINT.md` · Evaluador: `EVAL_BLUEPRINT.md`

### Raspberry Pi
- Comprada (Pi 5 8GB, ~1939 CNY) — en tránsito
- Uso: WCBA scraper + Telegram bot + Tailscale SSH

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Miembros: Pablo (owner) + Luffy + Yuming + Javier + Mario (coach)

---

## U CORE — módulos
- **U Schedule** — `core/Schedule.tsx` (228 KB god file)
- **U Wellness** — check-in jugadoras (embebido en Schedule)
- **U Scout** — scouting defensivo 1-on-1 (módulo más avanzado)
- **U Stats** — DB lista, collector pendiente Pi
Shell: `core/ModulePage.tsx` + `core/ModuleNav.tsx`

---

## PLAN PRE-TESTFLIGHT

### ✅ BLOQUE 0 — Bundle
- 509 → 229 KB gzip

### ✅ BLOQUE 2 — Bugs bloqueantes (completado)
- 2A ✅ Race condition "no sessions" en Home player
- 2B ✅ HomeCards landscape:py-2.5
- 2C ✅ Safe-area padding en main Home
- 2D ✅ todayKey() timezone-aware
- 2E ✅ Expiry warning en invitaciones (<2 días → amber)
- 2F ✅ isSelf check en MemberRow variant="player" (ya estaba OK)
- Stats card falsa — POSPUESTO (en diseño Figma)
- Schedule localStorage → server persistence — POSPUESTO (Fase 2B)

### ✅ BLOQUE 1 — U Scout features incompletas (completado 27 abr)
- 1A ✅ Approval workflow UI — stage 1/2/3 en ReportViewV4 (draft → approved → published)
- 1B ✅ Discrepancias — badge amber en Dashboard + detalle de items en conflicto en ReportViewV4
- 1C ✅ Hot/Cold streaks — `recentForm` en PlayerInput, selector en PlayerEditor, badge en slide 1
- 1D ✅ Redirect post-PlayerEditor (ya estaba implementado)
- 1E ✅ Swipe hint ReportSlidesV1 (ya estaba implementado)
- 1F ✅ Textos imperativos renderer (ya estaba implementado)
- NOTA: flujo nivel 2 "visible al staff" requiere schema change — pendiente Fase 2

### hotfix (27 abr)
- Home.tsx crash — `clubData.club` sin optional chaining en 3 puntos (showClubActivityDot, useEffect roster, clubId)

### ✅ BLOQUE 3 — Offline system (completado 27 abr)
- Queue de mutations offline PlayerEditor: ya existía en queryClient.ts (enqueueOfflinePlayerMutation + flushOfflinePlayerMutations)
- Indicador visual OfflineBanner: `client/src/components/OfflineBanner.tsx` — banner fijo top, amber pulse, desaparece al reconectar
- WellnessEntry offline — POSPUESTO (requiere queue separada, bajo impacto TestFlight)

### BLOQUE 4 — Figma (1 mayo)
- File: https://www.figma.com/design/odswsQA5XDEgULEDh2UMZi
- Temas + iconos defensivos

### BLOQUE 5 — Evaluador multi-juez
- DeepSeek: platform.deepseek.com (móvil chino — primero)
- Gemini: aistudio.google.com (gratis, sin SMS)
- Anthropic + OpenAI: requieren SMS español

### BLOQUE 6 — U Stats UI
- POST /api/stats/ingest Railway + Stats Home + Opponent Report

### BLOQUE 7 — Limpieza
- Eliminar archivos basura, reorganizar carpetas

### CUANDO LLEGUE APPLE DEVELOPER ACCOUNT
- Xcode + `npx cap sync && npx cap open ios` → TestFlight

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio, nunca SVG desde código
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva

---

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

---

## Terminología
- DENY/FORCE/ALLOW: instrucciones defensivas slide 3
- AWARE: alertas situacionales (max 2)
- Runners-up: alternativas rankeadas por el motor
- Override: decisión entrenador sobre output del motor
- Discrepancia: dos entrenadores con opciones distintas
- Hot/Cold/Stable: tendencia reciente jugador — campo `recentForm` en PlayerInput
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual
