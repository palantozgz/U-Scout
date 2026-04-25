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
- `client/src/pages/coach/ReportSlidesV1.tsx` — 3 slides (swipe + pips), coachMode kebabs + runners-up bottom sheet
- `client/src/pages/coach/ReportViewV4.tsx` — shell coach_review: ReportSlidesV1 + barra aprobación
- `client/src/pages/coach/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/coach/Dashboard.tsx` — lista equipos/jugadores
- `server/routes.ts` — rutas API Express
- `server/storage.ts` — acceso Supabase
- `scripts/calibrate-motor.ts` — 66 perfiles con expectations (100% / 551 checks)
- `scripts/eval-motor-quality.ts` — 10 perfiles de calidad → scripts/eval-quality-results.txt

## i18n — arquitectura lazy (implementada 25 abr 2026)
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async bajo demanda
- `client/src/lib/i18n.ts` — re-export shim (todos los imports existentes sin cambios)
- `client/src/lib/locales/en.ts` — bundle EN (estático, fallback síncrono)
- `client/src/lib/locales/es.ts` — chunk lazy ES (~23 KB gzip)
- `client/src/lib/locales/zh.ts` — chunk lazy ZH (~24 KB gzip)
- Para añadir clave: añadir en `locales/en.ts`, `locales/es.ts`, `locales/zh.ts`
- Para añadir idioma: nuevo archivo en `locales/`, import dinámico en `i18n-core.ts`

## NUNCA tocar
- `Profile.tsx`
- `schema.ts`
- `migrations/`
- SQL destructivo: solo en Supabase SQL Editor, nunca `drizzle-kit push`

---

## Arquitectura 4 capas
1. `motor-v4.ts` → scores numéricos + candidatos rankeados
2. `reportTextRenderer.ts` → texto EN/ES/ZH con gender (instrucciones ejecutables)
3. `overrideEngine.ts` → overrides + discrepancias + ML
4. `ReportSlidesV1.tsx` → UI 3 slides + `ReportViewV4.tsx` → shell coach_review

## Flujo de navegación
Dashboard → PlayerEditor → ReportViewV4 (coach_review) → Proponer/Publicar

---

## Estado actual — sesión 25 abr 2026 (noche)

### Commits de hoy (main)
- `feat: splash + headers unificados con U mark — CORE/SCOUT/STATS coherentes`
- `fix: replace chatgpt logo with correct U mark SVGs, add module logos`
- `fix: ModuleHeader en Schedule — U SCHEDULE logo + tagline`
- `feat: ReportSlidesV1 rediseño visual — slides más legibles, DENY/FORCE/ALLOW/AWARE coherentes`
- `perf: i18n lazy loading + React.lazy code splitting — bundle 509→268 KB gzip`
- `perf: remove framer-motion, lazy BasketballAvatar — main bundle 268→229 KB gzip`

### Bundle — estado actual ✅
- **Build confirmado: 229.48 KB gzip (main chunk)**
- Línea base original: 508.90 KB gzip
- Reducción total: -55% en 3 fases
- Margen para U Stats completo: +35 KB estimado → ~265 KB, bien bajo 300 KB
- Chunks lazy activos: PlayerEditor, ReportSlidesV1, Schedule, ClubManagement, BasketballAvatar, ES, ZH
- `Profile.tsx` chunk: 47 KB gzip (contiene BasketballAvatar estático — aceptable, no bloqueante)
- Próximo fix opcional: `mock-data` 25 KB en main chunk (no bloqueante)

### Motor (motor-v2.1.ts + motor-v4.ts)
- **Calibración: 100% (551/551 checks, 66/66 perfiles)**
- **Quality eval: 100% (46/46 checks, 10/10 perfiles)** ✅

### Renderer (reportTextRenderer.ts)
Textos EN/ES/ZH actualizados a instrucciones ejecutables. ZH: paridad conseguida. ✅

### Campos FT
- `ftShooting` + `foulDrawing` conectados al motor
- `ftRating`: @deprecated, retrocompat only

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Miembros: Pablo (owner) + Luffy + Yuming + Javier (coaches)

---

## Contexto de producto — U CORE
Esta app ES U CORE. U Scout es un módulo dentro de U CORE junto a:
- **U Schedule** — planner semanal, creación sesiones, attendance, export (`core/Schedule.tsx` — 228 KB, god file)
- **U Wellness** — check-in diario jugadores, dashboard staff riesgo/tendencias
- **U Scout** — scouting defensivo 1-on-1 (este módulo, el más avanzado)
- **U Stats** — placeholder (`core/Stats.tsx` — 0.6 KB stub)
Shell: `core/ModulePage.tsx` + `core/ModuleNav.tsx`

---

## PLAN DE TRABAJO — Pre-TestFlight Beta (actualizado 25 abr 2026 noche)

### FASE 0 — Bundle ✅ COMPLETADA
- **229 KB gzip main chunk. Objetivo <300 KB cumplido con margen.**

### FASE PRE-BETA — Usabilidad mínima para primera beta (PRIORIDAD ACTUAL)
Antes de Capacitor, la app debe ser usable en móvil real.

**PB-1. Mi Club — latencia 4-5s en carga inicial**
- Síntoma: primera carga de /coach/club tarda 4-5 segundos
- Causa probable: waterfall de queries sin prefetch ni skeleton adecuado
- Fix: stale-while-revalidate en useClub, skeleton inmediato, prefetch desde Home
- Archivos: `client/src/lib/club-api.ts`, `client/src/pages/coach/ClubManagement.tsx`

**PB-2. Responsive móvil — portrait y landscape**
- Audit sistemático de todas las rutas en viewport móvil (375px portrait, 667px landscape)
- Tamaños de botones: mínimo 44px touch target
- Overflow, truncación, scroll, z-index en todos los módulos
- Archivos: App.tsx shell, todos los pages

**PB-3. Diseño Figma → código**
- Implementar los diseños aprobados en Figma que aún no están en código
- Temas visuales (Gamenight/Office/Oldschool) — CSS vars
- Iconos defensivos slides — OBLIGATORIO diseño Figma primero

### FASE 5 — Capacitor + TestFlight
```bash
cd "/Users/palant/Downloads/U scout"
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "U Core" "com.ucore.app"
npx cap add ios
npm run build
npx cap sync
npx cap open ios
```

### FASE 1 — U SCOUT pulido
**1A.** PlayerEditor audit completo
**1B.** ReportSlidesV1 implementación definitiva
**1C.** Textos renderer sin sujeto (imperativo)
**1D.** eval-report-llm.ts (ANTHROPIC_API_KEY en .env)

### FASE 2 — U SCHEDULE & WELLNESS
**2A.** Schedule.tsx decomposition
**2B.** localStorage → server persistence
**2C.** Offline queue

### FASE 3 — U STATS
**3A.** Definir scope → **3B.** Figma → **3C.** Implementación

### FASE 4 — Branding final
**4A.** Temas CSS vars · **4B.** Iconos Figma · **4C.** Favicon + Rive

### BACKLOG
- motor-v2.1 server-side
- mock-data lazy
- Deep Report
- Discrepancias coaches
- Versiones inputs por coach
- Hot/cold streaks
- Modo Simple vs Pro
- Refactor carpetas pages/coach/ → pages/scout/

---

- Scope: solo matchup 1-on-1. Sin situaciones colectivas.
- Report: 3 SLIDES — Slide 1: ¿Quién es?, Slide 2: ¿Qué hará?, Slide 3: ¿Qué hago yo?
- Mismo informe jugadora y entrenador (coachMode controla runners-up y edición)
- ClubContext a nivel club, no por jugadora
- Iconos: diseño Figma obligatorio. Nunca SVG generado desde código.

---

## Reglas entrega código (no negociables)
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo para copy-paste, O comando terminal con `cd`, O prompt Cursor completo
- Ejecutar `npm run check` después de cada cambio
- Cursor agent (Claude Sonnet) para ejecución multi-archivo
- Claude para arquitectura, motor, generación de prompts
- Destructive migrations: raw SQL en Supabase SQL Editor, nunca `drizzle-kit push`

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
- SCOUT: zona trabajo entrenador — editar inputs, revisar report, proponer al staff
- DENY/FORCE/ALLOW: las 3 instrucciones defensivas del slide 3
- AWARE: alertas situacionales (max 2 en el informe)
- Runners-up: alternativas rankeadas por el motor por línea del informe
- Override: decisión entrenador que sobreescribe output del motor
- Discrepancia: dos entrenadores eligieron opciones distintas para el mismo ítem
- Archetype: perfil ofensivo primario de la jugadora
- trapResponse: reacción a blitz/hedge colectivo en PnR (escape/pass/struggle)
- pressureResponse: reacción a presión individual (escapes/struggles)
