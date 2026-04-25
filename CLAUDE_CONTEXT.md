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

## Estado actual — sesión 25 abr 2026

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

## Pendientes activos — U Scout (priorizados)

1. **Rediseño slides 2–3** — slide 2: threat scores rankeados, slide 3: DENY/FORCE/ALLOW ejecutable + runners-up por tap
   → Requiere diseño en Figma antes de tocar código

2. **ALLOW Tier 1: `allow_drive_weak_side`** — complementa FORCE dirección
   → Diseño documentado en `scripts/allow_slot_design.md`

3. **PlayerEditor input redesign** — audit sección screener pendiente
   → Prompt Cursor: `cursor_prompt_inputs_redesign.md`
   → Diagrama media pista ✅ (`HalfCourtZoneSelector`, 5 zonas clicables)

4. **Revision flow** — al guardar → pantalla revisión (ReportViewV4)

5. **Offline queue + sincronización** — cola de cambios offline, sync al reconectar

6. **Discrepancias entre coaches** — dos entrenadores eligen opciones distintas → detección + debate

7. **Hot/cold streaks** — tendencia reciente de jugadora en informe

8. **Versiones inputs por coach** — tabla `player_inputs_versions` (requiere migración schema)

## Pendientes activos — U CORE / TestFlight

1. **i18n lazy loading** — mayor ROI, menor riesgo. Plan completo en `BUNDLE_PLAN.md`. Ejecutar con Cursor ~3 may.
2. **Code splitting** — Schedule, Scout, Wellness como chunks separados via React.lazy
3. **motor-v2.1 server-side** — eliminar del bundle cliente
4. **Schedule.tsx decomposition** — partir en subcomponentes
5. **Capacitor setup** — wrapper iOS para TestFlight
6. **localStorage → server persistence** — attendance/signup aún usa localStorage

---

## Backlog futuro
- Iconos defensivos en slides: diseño Figma OBLIGATORIO antes de implementar. Nunca SVG generado.
- Favicon U Scout
- Logo club con imagen real (reemplaza emoji picker)
- Branding: SVG Figma → animación Rive
- Modo Simple vs Pro
- Offline queue + sincronización
- Cards por los 3 estilos visuales (gamenight/office/oldschool) — pendiente diseño Figma
- Elementos gráficos en slides para reconocimiento de patrones (iconos situacionales, flecha de dirección, etc.) — pendiente diseño Figma
- Deep Report: reconsiderar como feature OPCIONAL para el jugador que quiere estudiar más a su rival (no para el entrenador). Pendiente decisión de producto: ¿qué añade exactamente? Candidatos: situaciones adicionales, notas del entrenador, clips de vídeo. No implementar hasta definir scope.
- Textos renderer: reescribir en estilo imperativo sin sujeto ("drives left" no "they drive left") — pendiente Cursor ~3 may
- 3 estilos visuales a rediseñar: Gamenight (dark, base sólida — pulir profundidad), Office (blanco roto, líneas de cancha como fondo, pizarra táctica), Oldschool (textura cuero balón, granulado, naranja/negro/crema, tipografía bold condensada universitaria años 80)
- U SCHEDULE: ModuleHeader pendiente — Schedule.tsx es god file 228KB, no tocar sin Cursor (~3 may)
- eval-report-llm.ts: pendiente ANTHROPIC_API_KEY en .env (console.anthropic.com → API Keys)
- Implementar 3 temas visuales en código: pendiente Cursor (~3 may)
- Textos renderer sin sujeto ("drives left" no "they drive left"): pendiente Cursor (~3 may)

---

## Decisiones de producto (bloqueadas)
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
