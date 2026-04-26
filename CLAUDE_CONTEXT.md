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
- `client/src/lib/motor-v4.ts` — scoring layer, scores + candidatos rankeados
- `client/src/lib/motor-v2.1.ts` — motor base, lógica de inferencia
- `client/src/lib/reportTextRenderer.ts` — texto EN/ES/ZH con gender
- `client/src/lib/mock-data.ts` — playerInputToMotorInputs, clubRowToMotorContext
- `client/src/pages/coach/ReportSlidesV1.tsx` — 3 slides (swipe + pips)
- `client/src/pages/coach/ReportViewV4.tsx` — shell coach_review
- `client/src/pages/coach/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/coach/Dashboard.tsx` — lista equipos/jugadores
- `server/routes.ts` — rutas API Express
- `server/storage.ts` — acceso Supabase
- `scripts/calibrate-motor.ts` — 66 perfiles (100% / 551 checks)
- `scripts/eval-motor-quality.ts` — 10 perfiles calidad

## i18n — arquitectura lazy (implementada 25 abr 2026)
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- `client/src/lib/i18n.ts` — re-export shim
- `client/src/lib/locales/en.ts` — bundle EN (estático)
- `client/src/lib/locales/es.ts` — chunk lazy ES (~23 KB gzip)
- `client/src/lib/locales/zh.ts` — chunk lazy ZH (~24 KB gzip)

## Capacitor (instalado 25 abr 2026)
- `capacitor.config.ts` — appId: com.ucore.app, webDir: dist/public
- iOS platform añadido: `ios/` en repo
- Xcode: NO instalado todavía (pesa ~10GB)
- Apple Developer Account: NO contratada ($99/año — pendiente para TestFlight)
- Estado: listo para compilar cuando se instale Xcode + cuenta developer
- Comando para retomar: `npx cap sync && npx cap open ios`

## NUNCA tocar
- `Profile.tsx`
- `schema.ts`
- `migrations/`
- SQL destructivo: solo en Supabase SQL Editor, nunca `drizzle-kit push`

---

## Arquitectura 4 capas
1. `motor-v4.ts` → scores numéricos + candidatos rankeados
2. `reportTextRenderer.ts` → texto EN/ES/ZH con gender
3. `overrideEngine.ts` → overrides + discrepancias + ML
4. `ReportSlidesV1.tsx` → UI 3 slides + `ReportViewV4.tsx` → shell

## Flujo de navegación
Dashboard → PlayerEditor → ReportViewV4 → Proponer/Publicar

---

## Estado actual — sesión 25 abr 2026 (noche)

### Commits de hoy (main)
- `perf: i18n lazy loading + React.lazy — bundle 509→268 KB gzip`
- `perf: remove framer-motion, lazy BasketballAvatar — 268→229 KB gzip`
- `perf: prefetch club data on Home mount + staleTime 5min`
- `fix: mobile responsive audit — 17 fixes across 6 files`

### Bundle ✅
- **229.49 KB gzip main chunk** (objetivo <300 KB cumplido)
- Margen para U Stats: +35 KB estimado → ~265 KB

### Motor ✅
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)

### U Stats DB ✅
- Schema completo ejecutado en Supabase (25 abr 2026)
- Tablas: stats_leagues, stats_teams, stats_players, stats_games,
  stats_boxscores, stats_season, stats_pbp, stats_standings,
  stats_insights_cache, stats_sync_log
- Seed: WCBA (competitionId=56, seasonId=2092) + 18 equipos
- Blueprint completo: `STATS_BLUEPRINT.md`

### Raspberry Pi
- Comprada en Taobao (Pi 5 8GB, ~1939 CNY)
- En tránsito — pendiente de llegar
- Uso: WCBA scraper + bot Telegram + Tailscale SSH
- NO para IA en tiempo real (eso es Claude API en Railway)

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Miembros: Pablo (owner) + Luffy + Yuming + Javier

---

## Contexto de producto — U CORE
- **U Schedule** — `core/Schedule.tsx` (228 KB, god file)
- **U Wellness** — check-in diario jugadores
- **U Scout** — scouting defensivo 1-on-1 (módulo más avanzado)
- **U Stats** — DB lista, collector pendiente (Pi en tránsito)
Shell: `core/ModulePage.tsx` + `core/ModuleNav.tsx`

---

## PLAN DE TRABAJO — 2-3 semanas antes de TestFlight

### ✅ COMPLETADO
- Bundle optimizado (509→229 KB gzip)
- Latencia Mi Club eliminada
- Responsive móvil (17 fixes)
- Capacitor instalado + iOS platform añadido
- U Stats DB schema en Supabase

### PRIORIDAD ACTUAL — por orden

**1. Figma → código** (1 mayo, reset créditos Figma MCP)
- File: https://www.figma.com/design/odswsQA5XDEgULEDh2UMZi
- Temas Gamenight/Office/Oldschool — CSS vars
- Iconos defensivos ReportSlidesV1 — OBLIGATORIO Figma antes de código

**2. U Scout — mejoras calidad**
- PlayerEditor audit completo (campo a campo)
- ReportSlidesV1 implementación definitiva
- Textos renderer en imperativo (sin sujeto)

**3. U Stats — UI con datos reales**
- POST /api/stats/ingest en Railway (Bearer token)
- Stats Home UI con standings de WCBA
- Opponent Report UI
- Collector en Pi cuando llegue

**4. U Schedule — estabilización**
- Schedule.tsx decomposition (god file 228 KB)
- localStorage → server persistence

**5. Audits y pruebas**
- PlayerEditor en móvil real
- ReportSlidesV1 swipe gestures
- Schedule landscape
- safe-area-inset iOS

### CUANDO LLEGUE APPLE DEVELOPER ACCOUNT ($99/año)
- Xcode (~10GB, Mac App Store)
- `npx cap sync && npx cap open ios`
- Signing & Capabilities → Team → cuenta developer
- Archive → TestFlight

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Coach usa la app en 2 min antes de un partido
- Mobile-first: diseño para 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio, nunca SVG generado desde código

---

## Reglas entrega código (no negociables)
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal con `cd`, O prompt Cursor completo
- `npm run check` después de cada cambio
- Cursor agent (Sonnet) para ejecución
- Destructive migrations: raw SQL en Supabase, nunca `drizzle-kit push`

## Scripts de validación
```bash
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-report-llm.ts
```

## Audit rápido
```bash
cd "/Users/palant/Downloads/U scout" && bash scripts/audit.sh > scripts/audit-output.txt
```

---

## Terminología
- SCOUT: zona trabajo entrenador
- DENY/FORCE/ALLOW: instrucciones defensivas del slide 3
- AWARE: alertas situacionales (max 2)
- Runners-up: alternativas rankeadas por el motor
- Override: decisión entrenador sobre output del motor
- Discrepancia: dos entrenadores con opciones distintas
- Archetype: perfil ofensivo primario
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual
