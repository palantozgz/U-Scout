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

## Estado actual — sesión 25 abr 2026 (noche, cierre)

### Commits de hoy (main)
- `perf: i18n lazy loading + React.lazy — bundle 509→268 KB gzip`
- `perf: remove framer-motion, lazy BasketballAvatar — 268→229 KB gzip`
- `perf: prefetch club data on Home mount + staleTime 5min`
- `fix: mobile responsive audit — 17 fixes across 6 files`
- `fix: invitation flow — auto-accept after login, persist token through auth`
- `fix: hide owner kebab in ClubManagement MemberRow`

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

## PLAN PRE-TESTFLIGHT — backlog priorizado

### BLOQUE 1 — U Scout features incompletas (CRÍTICO para beta)

**1A. Workflow de aprobación — 3 niveles sin implementar completo**
El flujo diseñado existe en backend (approval_api, overrideEngine) pero la UI no lo comunica claramente:
- Nivel 1: Coach edita inputs → genera report (privado)
- Nivel 2: Coach aprueba su versión → visible al staff
- Nivel 3: Cualquier aprobado publica → llega a jugadora
Problema actual: el entrenador no entiende en qué nivel está ni qué le falta hacer.
Fix: indicadores visuales claros en ReportViewV4 del estado actual + siguiente acción requerida.

**1B. Sistema de discrepancias entre entrenadores — NO implementado en UI**
El backend detecta discrepancias (overrideEngine.ts, `hasDiscrepancy` en routes.ts).
La UI nunca las muestra. El staff no sabe cuándo dos entrenadores tienen versiones distintas.
Fix: badge "Discrepancia detectada" en Dashboard + vista de comparación en ReportViewV4.

**1C. Hot/Cold streaks — NO implementado**
El motor no genera tendencia reciente del jugador (últimos 5 partidos).
Diseñado en CLAUDE_CONTEXT pero pendiente de implementar en motor + renderer + UI.
Fix: añadir campo `recentForm: "hot" | "cold" | "stable"` al PlayerEditor + motor + slide 1.

**1D. Flujo post-PlayerEditor — 2 taps innecesarios**
Al guardar un jugador, el entrenador vuelve al Dashboard y tiene que navegar manualmente al report.
Fix: redirect automático a ReportViewV4 tras guardar el jugador.

**1E. Hint de swipe en ReportSlidesV1 — primer uso**
No hay indicador visual de que los slides son swipeables. El usuario no lo sabe en la primera visita.
Fix: micro-animación de nudge (8px) en el primer slide, solo la primera vez (localStorage flag).

**1F. Textos renderer en imperativo**
Textos actuales tienen sujeto: "they drive left". Deben ser imperativos: "drives left" / "Force left".
Fix: revisar reportTextRenderer.ts y reescribir sin sujeto.

### BLOQUE 2 — Bugs bloqueantes para beta real

**2A. Home player: race condition "no sessions"**
Si las 3 queries (today/tomorrow/week) no han terminado, muestra "No sessions" aunque las haya.
Fix: mostrar skeleton hasta que isSuccess en las 3, luego evaluar empty state.

**2B. Schedule localStorage → sin sincronización multi-dispositivo**
Attendance y wellness usan localStorage. Cambio de dispositivo = pérdida de datos.
Fix: migrar a server persistence (ya planeado, Fase 2B del plan).

**2C. Stats card visible con módulo vacío**
Home muestra HomeCard de U Stats pero la página está vacía → expectativa falsa.
Fix: ocultar HomeCard de Stats hasta que haya datos reales, o mostrar "Próximamente".

**2D. Timezone wellness**
`todayKey()` usa fecha local del dispositivo. En China (CST +8) puede desfasarse vs UTC del servidor.
Fix: añadir timezone del club en ClubContext y usarla para entry_date.

**2E. Home landscape — demasiado scroll**
HomeCards con py-5 en landscape 375px de alto requieren mucho scroll.
Fix: `landscape:py-3` en HomeCards.

**2F. isSelf check en variant="player" de MemberRow**
El fix del kebab owner se aplicó en variant="staff". Verificar que aplica también en "player".

### BLOQUE 3 — Offline-first system

**3A. Estado actual**
`networkMode: "offlineFirst"` en todas las queries (lectura OK offline).
Las mutations fallan silenciosamente sin conexión (guardar player, aprobar report, etc.).

**3B. Fix requerido para beta**
Queue de mutations offline con retry automático al recuperar conexión.
Librería candidata: `@tanstack/query` + `idb` (IndexedDB) para persistir la queue.
Scope mínimo: PlayerEditor save + ReportApproval + WellnessEntry.

**3C. Indicador visual de estado offline**
La app no muestra si está offline. El usuario no sabe por qué sus cambios no se guardan.
Fix: banner "Sin conexión — los cambios se guardarán cuando vuelva la red" cuando offline.

### BLOQUE 4 — Figma → código (1 mayo)
- File: https://www.figma.com/design/odswsQA5XDEgULEDh2UMZi
- Temas Gamenight/Office/Oldschool — CSS vars
- Iconos defensivos ReportSlidesV1 — OBLIGATORIO Figma antes de código

### BLOQUE 5 — Evaluador multi-juez
- DeepSeek: platform.deepseek.com (móvil chino — hacer primero)
- Gemini: aistudio.google.com (cuenta Google, gratis, sin SMS)
- Anthropic: console.anthropic.com (requiere SMS español)
- OpenAI: platform.openai.com (requiere SMS español)
- Ver: `EVAL_BLUEPRINT.md`

### BLOQUE 6 — U Stats UI
- POST /api/stats/ingest en Railway (Bearer token)
- Stats Home con standings reales de WCBA
- Opponent Report UI

### BLOQUE 7 — Limpieza y reorganización
- Eliminar: `CLAUDE_CONTEXT.md.save`, `ReportSlidesV1.backup.tsx`, `report-limpieza-pendiente.md`, `BUNDLE_PLAN.md`, prompts Cursor ejecutados en scripts/
- Reorganizar: `pages/coach/` → `pages/scout/`, `script/` → `scripts/`
- Revisar duplicaciones: `translateMotorOutput.ts` vs `reportTextRenderer.ts`

### CUANDO LLEGUE APPLE DEVELOPER ACCOUNT
- Xcode (~10GB, Mac App Store) + `npx cap sync && npx cap open ios`
- Signing → TestFlight

---

## Audit U CORE — hallazgos sesión 25 abr 2026

### Bugs detectados por código (sin ejecutar)
Ver audit completo en la sesión. Resumen:
- Home player: race condition nextSession (Bloque 2A)
- Schedule: localStorage sin sync (Bloque 2B)
- Stats card falsa (Bloque 2C)
- Wellness timezone (Bloque 2D)
- Scout.tsx: flash de spinner antes de redirect
- MemberRow isSelf en variant="player" (Bloque 2F)

### Fortalezas confirmadas
- Bundle 229 KB gzip — excepcional para la complejidad
- Motor 100% calibrado — core diferencial sólido
- capabilities.ts — sistema de permisos coherente y extensible
- homeSignals — lógica de prioridades centralizada y testeable
- i18n lazy — escalable sin tocar nada
- ModuleNav — safe-area, landscape:hidden, active state correcto

### Potenciaciones de alto ROI
1. Notificaciones push con Capacitor — diferencial vs mercado chino
2. U Stats + U Scout integración — stats reales en el report
3. physical_trainer badge — TODO hardcodeado en capabilities.ts
4. Modo offline-first completo — crítico para pabellón sin wifi
5. Onboarding guiado — no existe, bloquea adopción de nuevos usuarios
6. Historial versiones report — "Actualizado el X" en slide 1

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
- Hot/Cold/Stable: tendencia reciente del jugador (pendiente implementar)
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual
