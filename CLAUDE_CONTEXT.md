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
- `client/src/pages/coach/ReportSlidesV1.tsx` — 3 slides
- `client/src/pages/coach/ReportViewV4.tsx` — shell coach_review
- `client/src/pages/coach/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/coach/Dashboard.tsx` — lista equipos/jugadores
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

## Estado actual — sesión 25 abr 2026

### Commits de hoy (main)
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

### 🎯 BLOQUE 1 — U Scout features incompletas (PRIORIDAD ACTUAL)

**1A. Workflow de aprobación — indicadores de estado**
El flujo de 3 niveles existe en backend pero la UI no lo comunica:
- Nivel 1: Coach edita inputs → report privado
- Nivel 2: Coach aprueba → visible al staff
- Nivel 3: Cualquier aprobado publica → llega a jugadora
Fix: indicadores visuales claros en ReportViewV4 del estado actual + siguiente acción.
Archivos: `client/src/pages/coach/ReportViewV4.tsx`, `client/src/lib/approval-api.ts`

**1B. Discrepancias entre entrenadores — UI no implementada**
Backend detecta discrepancias (hasDiscrepancy en routes.ts) pero nunca se muestran.
Fix: badge "Discrepancia" en Dashboard + vista comparación en ReportViewV4.
Archivos: `Dashboard.tsx`, `ReportViewV4.tsx`

**1C. Hot/Cold streaks — no implementado**
No existe en motor ni en PlayerEditor.
Fix: campo `recentForm: "hot"|"cold"|"stable"` en PlayerEditor + motor + slide 1.

**1D. Flujo post-PlayerEditor**
Guardar jugador → vuelve al Dashboard → entrenador navega al report manualmente.
Fix: redirect automático a ReportViewV4 tras guardar.
Archivo: `client/src/pages/coach/PlayerEditor.tsx`

**1E. Hint de swipe en ReportSlidesV1**
Sin indicador visual de que los slides son swipeables.
Fix: micro-animación nudge (8px) en el primer slide, solo primera visita (localStorage flag).
Archivo: `client/src/pages/coach/ReportSlidesV1.tsx`

**1F. Textos renderer en imperativo**
Textos con sujeto: "they drive left" → imperativo: "drives left".
Archivo: `client/src/lib/reportTextRenderer.ts`

### BLOQUE 3 — Offline system
- Queue de mutations offline con retry al recuperar conexión
- Indicador visual "Sin conexión"
- Scope mínimo: PlayerEditor save + ReportApproval + WellnessEntry

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
- Hot/Cold/Stable: tendencia reciente jugador (pendiente 1C)
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual
