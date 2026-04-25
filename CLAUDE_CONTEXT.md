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

## Estado actual — sesión 25 abr 2026 (cierre definitivo)

### Commits de hoy (main)
- `feat: splash + headers unificados con U mark — CORE/SCOUT/STATS coherentes`
- `fix: replace chatgpt logo with correct U mark SVGs, add module logos`
- `fix: ModuleHeader en Schedule — U SCHEDULE logo + tagline`
- `feat: ReportSlidesV1 rediseño visual — slides más legibles, DENY/FORCE/ALLOW/AWARE coherentes`

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
- `deny_spot_deep` ahora se emite para `spotUpFreq=P` sin deepRange (peso 0.80) — tiradora primaria merece closeout agresivo aunque no tenga rango extra-largo
- `force_trap` reformulado como instrucción 1-on-1 (over screen + canal débil) — elimina lenguaje colectivo
- `offHandFinish` derivado de `isoFinishLeft/Right` en bridge (era incorrecto via `closeoutReaction`)
- `force_post_channel`: infiere canal dominante cruzando `hand` + `postMoves` (up_and_under/hook)
- ath modula ISO weight parcialmente
- `aware_passer` ponderado: vision=5+escape=0.95, vision=4+pass=0.72

**Base científica:**
- Synergy Sports: PPP por play type (Cuts=1.58, Spot-up alta, ISO/Post 0.78-0.98)
- Frontiers/PMC: PnR weak/under coverage, mano dominante
- Analytics: mid-range -0.16 PPP vs 3PT; open 3PT = shot más eficiente
- Basketball Immersion scouting reports

### Renderer (reportTextRenderer.ts)
Textos EN/ES/ZH actualizados a instrucciones ejecutables (CUÁNDO + CÓMO + POR QUÉ):
- `deny_iso_space`: dirección + contexto atlético
- `deny_pnr_downhill`: deepRange + passer context
- `deny_post_entry`: "Deny the X block entry" explícito + técnica fronting + phys
- `deny_spot_deep`: closeout mechanics (shoot vs attack)
- `deny_trans_rim`: cue de sprint al aro
- `deny_oreb`: timing (antes del tiro, no después)
- `deny_cut_backdoor/basket/flash/curl`: casos explícitos EN/ES/ZH con contexto ball-side
- `deny_pnr_pop`: menciona "catch" — "No space to catch — they shoot off the screen"
- `force_direction`: ISO context vs PnR context vs shooter
- `force_contact`: dirección + por qué
- `force_trap`: reformulado 1-on-1 — over screen + canal débil + no lenguaje colectivo
- `allow_spot_three`: redirige a proteger pintura
- `allow_iso`: instrucción activa (give ball, stay upright, contest)
- `force_post_channel`: canal dominante en poste (up_and_under/hook cruzado con `hand`)

**ZH**: paridad con EN/ES conseguida — `renderInstructionZH` dinámico, `renderAlertText` y `renderTriggerCue` ZH completos. ✅

### Campos FT
- `ftShooting` + `foulDrawing` conectados al motor (isoDanger, hackable, ftDangerous)
- `ftRating`: @deprecated, ignorado por el motor, mantenido solo por retrocompat

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Miembros: Pablo (owner) + Luffy + Yuming + Javier (coaches)
- SQL completado en Supabase

---

## Contexto de producto — U CORE
Esta app ES U CORE. U Scout es un módulo dentro de U CORE junto a:
- **U Schedule** — planner semanal, creación sesiones, attendance, export (`core/Schedule.tsx` — 228 KB, god file)
- **U Wellness** — check-in diario jugadores, dashboard staff riesgo/tendencias
- **U Scout** — scouting defensivo 1-on-1 (este módulo, el más avanzado)
- **U Stats** — placeholder (`core/Stats.tsx` — 0.6 KB stub)
Shell: `core/ModulePage.tsx` + `core/ModuleNav.tsx`

## Bundle — estado actual
- Build confirmado: `1,836 KB minificado / 508.90 KB gzip` (1 solo chunk, sin splitting)
- Vite config: sin `manualChunks` ni `rollupOptions` — chunk único por defecto
- **i18n.ts: 4,939 líneas** — 3 locales inline (en/es/zh), todos cargan al inicio
- Archivos generated*i18n: 2,634 líneas adicionales (6 archivos, 3 locales cada uno)
- `motor-v2.1-i18n.ts`: 484 líneas, también inline en bundle cliente
- Total i18n: ~7,573 líneas / estimado ~350–400 KB del bundle inicial
- `Schedule.tsx` 228 KB god file
- `PlayerEditor.tsx` 126 KB god file
- `motor-v2.1.ts` 106 KB (debería ser server-side only)
- Plan completo documentado en `BUNDLE_PLAN.md` (ver sección Bundle)
- **Tokens Cursor agotados hasta ~3 may** — ejecución del plan aplazada
- Fix mayor impacto: **i18n lazy por locale** → elimina ~350 KB del bundle inicial
- Fix mediano: **code splitting por módulo** via React.lazy
- Fix largo: **motor server-side** → API call en vez de bundle cliente
- **Capacitor** para TestFlight una vez bundle optimizado

## PLAN DE TRABAJO — U CORE (actualizado 25 abr 2026)

### FASE 0 — Prerequisitos técnicos (con Cursor, ~3 may)
Esto desbloquea TestFlight y hace la app mantenible.

**0A. i18n lazy loading** — mayor ROI, menor riesgo
- Separar en/es/zh en archivos independientes, importar solo el locale activo
- Ahorro estimado: ~210-230 KB gzip
- Plan detallado en `BUNDLE_PLAN.md`

**0B. Code splitting con React.lazy**
- Schedule, Scout, Wellness como chunks separados
- Ahorro estimado: ~80-100 KB gzip
- Objetivo: bundle <300 KB gzip → TestFlight viable

**0C. Refactor arquitectura de carpetas**
- `pages/coach/` → `pages/scout/`, `pages/core/`
- Ver sección "Deuda técnica" al final de este archivo
- Prerequisito de mantenibilidad: sin esto cada sesión perdemos contexto

---

### FASE 1 — U SCOUT (módulo más maduro, pulir antes de escalar)

**1A. PlayerEditor audit completo**
- Revisar campo a campo con metodología scouting científica
- Secciones: Post, ISO, PnR, Off-Ball, Spot-up
- Prompt Cursor: `cursor_prompt_inputs_redesign.md`
- Diagrama media pista: `HalfCourtZoneSelector` ✅ implementado

**1B. ReportSlidesV1 → implementación definitiva**
- Diseño visual en Figma ✅ (Gamenight/Office/Oldschool)
- Implementar con Cursor: 3 slides definitivos con colores, iconos, layout
- ALLOW Tier 1: `allow_drive_weak_side` → `allow_slot_design.md`
- Iconos: OBLIGATORIO diseño Figma antes de implementar (nunca SVG generado)

**1C. Textos renderer sin sujeto**
- Reescribir en imperativo: "drives left" no "they drive left"
- Afecta `reportTextRenderer.ts` — Cursor, ~300 líneas

**1D. eval-report-llm.ts**
- Añadir ANTHROPIC_API_KEY en `.env` (console.anthropic.com)
- Ejecutar evaluador LLM para diagnóstico de calidad

---

### FASE 2 — U SCHEDULE & WELLNESS (módulo funcional, necesita estabilización)

**2A. Schedule.tsx decomposition**
- Partir god file 228 KB en subcomponentes
- Añadir ModuleHeader correctamente
- Sesión Cursor dedicada (alto impacto en legibilidad + bundle)

**2B. localStorage → server persistence**
- Attendance/signup aún usa localStorage
- Migración a tabla Supabase con schema + migration

**2C. Offline queue + sincronización**
- Cola de cambios offline, sync al reconectar
- Afecta principalmente Schedule y Wellness

---

### FASE 3 — U STATS (diseño + implementación desde cero)

**Estado actual:** stub de 0.6 KB — solo título + placeholder.

**3A. Definir scope de producto** (antes de tocar código)
Preguntas a decidir:
- ¿Qué datos existen ya en Supabase vs qué hay que importar?
- ¿Stats de attendance del Schedule? ¿Stats de scouting (jugadoras más scouted)? ¿Stats de wellness del equipo?
- ¿Es un módulo para entrenadores, jugadores, o ambos?
- ¿Requiere fuente externa (Synergy, importación CSV) o solo datos propios de U CORE?

**3B. Diseño en Figma**
- Dashboard principal con métricas clave
- Referencia visual: `elradardelscout.com` (bubble chart frecuencia vs eficiencia)
- Gráficos: attendance trends, wellness trends, scouting coverage
- Misma arquitectura visual que el resto de módulos

**3C. Implementación con Cursor**
- Schema + migrations si necesita nuevas tablas
- Componentes: KPI cards, charts (recharts ya disponible en el stack)
- Integración con datos existentes de Schedule (sessions, attendance) y Wellness

---

### FASE 4 — Branding y experiencia final

**4A. 3 temas visuales en código** (Gamenight / Office / Oldschool)
- Diseño en Figma ✅
- Implementar CSS vars + selector en Settings
- ~300 líneas en `index.css` + toggle

**4B. Iconos defensivos en slides**
- Diseño Figma OBLIGATORIO antes de implementar
- Nunca SVG generado desde código sin referencia visual

**4C. Favicon + logos definitivos**
- Favicon con U mark
- Club logo con imagen real (reemplaza emoji picker)
- SVG Figma → animación Rive (largo plazo)

---

### FASE 5 — TestFlight + distribución

**5A. Capacitor setup**
- Prerequisito: bundle <300 KB gzip (Fase 0)
- Wrapper iOS, configuración Xcode
- Build + submit a TestFlight

**5B. motor-v2.1 server-side**
- Eliminar del bundle cliente (106 KB)
- Mover a endpoint API en Express
- Mayor refactor — después de TestFlight inicial

---

### BACKLOG SIN FECHA
- Deep Report: scope pendiente de decisión. Candidatos: situaciones adicionales, notas entrenador, clips de vídeo
- Discrepancias entre coaches: detección + debate (overrideEngine)
- Versiones inputs por coach: tabla `player_inputs_versions` (requiere migración)
- Hot/cold streaks: tendencia reciente en informe
- Modo Simple vs Pro
- Branding: animación Rive del U mark

---

### ORDEN LÓGICO RECOMENDADO
```
Fase 0 (prerequisitos) → Fase 1 (Scout pulido) → Fase 3A+3B (Stats definición+diseño)
→ Fase 2 (Schedule estabilización) → Fase 3C (Stats implementación)
→ Fase 4 (branding) → Fase 5 (TestFlight)
```
U Stats necesita definición de producto ANTES de implementar.
U Schedule necesita decomposición ANTES de añadir features.
TestFlight necesita bundle optimizado ANTES de Capacitor.


- Scope: solo matchup 1-on-1. Sin situaciones colectivas. Sin cobertura PnR de equipo.
- Report: 3 SLIDES — Slide 1: ¿Quién es?, Slide 2: ¿Qué hará? (top 3 situaciones), Slide 3: ¿Qué hago yo? (DENY/FORCE/ALLOW + max 2 AWARE)
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
# Evalúa: coherencia, accionabilidad, proporción, especificidad, narrativa
# Diagnostica origen del fallo: input | motor | renderer | concepto
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

---

## Deuda técnica — refactor de arquitectura de carpetas (PENDIENTE CURSOR)

**Problema:** La estructura de carpetas no refleja que U CORE es la plataforma contenedora.
La home de U SCOUT está en `pages/coach/CoachHome.tsx` por razón histórica (era la app original).
Todo lo de U SCOUT está mezclado en `pages/coach/`.

**Estado actual:**
```
pages/
  coach/          ← mezcla: U SCOUT home + PlayerEditor + Report* + ClubManagement
  core/           ← U CORE home + módulos
  player/         ← vista jugador
```

**Objetivo:**
```
pages/
  core/           ← U CORE shell (Home, ModuleNav, ModulePage, Settings, ClubManagement)
  scout/          ← todo U SCOUT (ScoutHome, PlayerEditor, Report*, Dashboard)
  schedule/       ← U SCHEDULE & WELLNESS
  stats/          ← U STATS
  player/         ← vista jugador (sin cambios)
```

**Archivos a mover con Cursor:**
- `pages/coach/CoachHome.tsx` → `pages/scout/ScoutHome.tsx`
- `pages/coach/PlayerEditor.tsx` → `pages/scout/PlayerEditor.tsx`
- `pages/coach/ReportSlidesV1.tsx` → `pages/scout/ReportSlides.tsx`
- `pages/coach/ReportViewV4.tsx` → `pages/scout/ReportView.tsx`
- `pages/coach/Dashboard.tsx` → `pages/scout/Dashboard.tsx`
- `pages/coach/ClubManagement.tsx` → `pages/core/ClubManagement.tsx`
- `pages/coach/Settings.tsx` → `pages/core/Settings.tsx`
- Actualizar todos los imports en `App.tsx` y demás archivos

**Componentes a renombrar:**
- `components/branding/UScoutBrand.tsx` → `UCoreShell.tsx` (es el splash de U CORE)
- `components/UScoutLogo.tsx` → el U mark es de U CORE, no exclusivo de U SCOUT

**Impacto:** Alto. Requiere sesión dedicada con Cursor. No hacer en partes.
