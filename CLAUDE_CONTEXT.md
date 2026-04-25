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

## Estado actual — sesión 25 abr 2026 (tarde)

### Commits de hoy (main)
- `feat: splash + headers unificados con U mark — CORE/SCOUT/STATS coherentes`
- `fix: replace chatgpt logo with correct U mark SVGs, add module logos`
- `fix: ModuleHeader en Schedule — U SCHEDULE logo + tagline`
- `feat: ReportSlidesV1 rediseño visual — slides más legibles, DENY/FORCE/ALLOW/AWARE coherentes`
- `perf: i18n lazy loading + React.lazy code splitting — bundle 509→268 KB gzip`

### Bundle — estado actual ✅
- **Build confirmado: 978 KB min / 267.99 KB gzip** (objetivo <300 KB conseguido)
- Línea base anterior: 1,836 KB min / 508.90 KB gzip
- Fase 1 completada: i18n lazy — ES/ZH como chunks separados (-43 KB gzip)
- Fase 2 completada: React.lazy en App.tsx — 17 rutas lazy (-197 KB gzip)
- Chunks lazy notables: `PlayerEditor` 15 KB, `ReportSlidesV1` 24 KB, `Schedule` 29 KB, `ClubManagement` 22 KB
- **Capacitor / TestFlight: prerequisito de bundle cumplido**
- Próximo fix de bundle (opcional, no bloqueante): `mock-data` 25 KB en main chunk

### Motor (motor-v2.1.ts + motor-v4.ts)
- **Calibración: 100% (551/551 checks, 66/66 perfiles)**
- **Quality eval: 100% (46/46 checks, 10/10 perfiles)** ✅
- Script calibración: `cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts`
- Script quality: `cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts`
- Perfiles cubiertos: Luka, Jokic, Curry, Giannis, Klay, Embiid, Haliburton, Gobert, A'ja Wilson, Breanna Stewart, Ionescu, Clark, Plum, Micic, Mirotic, SGA, Sabonis, Booker, JB, AD, Trae Young, Middleton, Bam (x2), Taurasi, Jonquel Jones, Alyssa Thomas + 4 amateurs + 4 universitarios + Pika-style + Draymond + otros perfiles de rol (total 66)

**Inferencias clave implementadas (motor + bridge):**
- `trapResponse` desde `motorPressureResponse` del editor (scout > inferencia de visión)
- `force_direction` para tiradora PnR mid-range ambos lados (shooter context)
- `force_early` suprimido cuando `isoDir` está definido (L/R) — `force_direction` siempre gana con dirección conocida
- `aware_passer` suprimido cuando `trapResponse = struggle`
- `force_weak_hand` suprimido si `isoWeakHandFinish = drive` (ambidiestro)
- `orebThreat = medium` inferido para C/PF con phys≥4 si no seteado
- `force_full_court` suprimido para C/PF sin transición activa (bug Kalani corregido)
- `aware_instant_shot` para tiradores primarios con release inmediato
- `pnrSnake` conectado (reduce force_direction weight + aware)
- `allow_pnr_mid_range` para PnR handler sin deepRange (under coverage válido)
- `deny_pnr_pop` suprime `deny_spot_deep` para pop screener (con/sin deepRange)
- `deny_spot_deep` ahora se emite para `spotUpFreq=P` sin deepRange (peso 0.80)
- `force_trap` reformulado como instrucción 1-on-1 (over screen + canal débil)
- `offHandFinish` derivado de `isoFinishLeft/Right` en bridge
- `force_post_channel`: infiere canal dominante cruzando `hand` + `postMoves`
- ath modula ISO weight parcialmente
- `aware_passer` ponderado: vision=5+escape=0.95, vision=4+pass=0.72

**Base científica:**
- Synergy Sports: PPP por play type (Cuts=1.58, Spot-up alta, ISO/Post 0.78-0.98)
- Frontiers/PMC: PnR weak/under coverage, mano dominante
- Analytics: mid-range -0.16 PPP vs 3PT; open 3PT = shot más eficiente
- Basketball Immersion scouting reports

### Renderer (reportTextRenderer.ts)
Textos EN/ES/ZH actualizados a instrucciones ejecutables (CUÁNDO + CÓMO + POR QUÉ). ZH: paridad con EN/ES conseguida. ✅

### Campos FT
- `ftShooting` + `foulDrawing` conectados al motor (isoDanger, hackable, ftDangerous)
- `ftRating`: @deprecated, ignorado por el motor, mantenido solo por retrocompat

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

## PLAN DE TRABAJO — U CORE (actualizado 25 abr 2026 tarde)

### FASE 0 — Prerequisitos técnicos ✅ COMPLETADA
- **0A. i18n lazy loading** ✅ — ES/ZH como chunks lazy, EN estático
- **0B. React.lazy code splitting** ✅ — 17 rutas lazy en App.tsx
- **Resultado: 509 → 268 KB gzip. Objetivo <300 KB cumplido.**
- **0C. Refactor arquitectura carpetas** — aplazado (no bloqueante para TestFlight)

### FASE 5 — Capacitor + TestFlight (desbloqueada)
```bash
cd "/Users/palant/Downloads/U scout"
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "U Core" "com.ucore.app"
npx cap add ios
npm run build
npx cap sync
npx cap open ios
```
Después: configurar signing en Xcode + subir a TestFlight.

### FASE 1 — U SCOUT (módulo más maduro, pulir antes de escalar)

**1A. PlayerEditor audit completo**
- Revisar campo a campo con metodología scouting científica
- Prompt Cursor: `cursor_prompt_inputs_redesign.md`

**1B. ReportSlidesV1 → implementación definitiva**
- Diseño visual en Figma ✅ (Gamenight/Office/Oldschool)
- ALLOW Tier 1: `allow_drive_weak_side` → `allow_slot_design.md`
- Iconos: OBLIGATORIO diseño Figma antes de implementar

**1C. Textos renderer sin sujeto**
- Reescribir en imperativo: "drives left" no "they drive left"

**1D. eval-report-llm.ts**
- Añadir ANTHROPIC_API_KEY en `.env`

### FASE 2 — U SCHEDULE & WELLNESS
**2A.** Schedule.tsx decomposition (god file 228 KB)
**2B.** localStorage → server persistence (attendance/signup)
**2C.** Offline queue + sincronización

### FASE 3 — U STATS (diseño + implementación desde cero)
**3A.** Definir scope de producto antes de tocar código
**3B.** Diseño en Figma (referencia: `elradardelscout.com`)
**3C.** Implementación con Cursor

### FASE 4 — Branding y experiencia final
**4A.** 3 temas visuales (Gamenight / Office / Oldschool) — Figma ✅, implementar CSS vars
**4B.** Iconos defensivos — Figma OBLIGATORIO antes de implementar
**4C.** Favicon + logos definitivos + animación Rive (largo plazo)

### BACKLOG SIN FECHA
- motor-v2.1 server-side (elimina ~50 KB gzip adicional del bundle)
- mock-data server-side o lazy (25 KB gzip en main chunk, no bloqueante)
- Deep Report: scope pendiente
- Discrepancias entre coaches: detección + debate (overrideEngine)
- Versiones inputs por coach: tabla `player_inputs_versions`
- Hot/cold streaks: tendencia reciente en informe
- Modo Simple vs Pro
- Refactor carpetas: `pages/coach/` → `pages/scout/` (mantenibilidad, no urgente)

### ORDEN LÓGICO RECOMENDADO
```
Fase 5 (Capacitor/TestFlight) → Fase 1 (Scout pulido) → Fase 3A+3B (Stats definición+diseño)
→ Fase 2 (Schedule estabilización) → Fase 3C (Stats implementación)
→ Fase 4 (branding) → motor server-side (bundle final)
```

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
# Regression tests (bugs) — lógica de outputs
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
# Score actual: 100% (551/551 checks, 66/66 perfiles)

# Quality eval — calidad texto + coherencia básica (checks hardcodeados)
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
# Score actual: 100% (46/46 checks, 10/10 perfiles)

# LLM Report Evaluator — calidad profesional del report completo (Claude como juez)
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-report-llm.ts
npx tsx scripts/eval-report-llm.ts --fast        # solo 5 perfiles
npx tsx scripts/eval-report-llm.ts --profile llm001  # un perfil
# Requiere ANTHROPIC_API_KEY en .env
# Output: scripts/eval-report-llm-results.json + .txt
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
