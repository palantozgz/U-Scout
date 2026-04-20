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

## Estado actual — sesión 20 abr 2026

### Motor (motor-v2.1.ts + motor-v4.ts)
- **Calibración: 100% (551/551 checks, 66/66 perfiles)**
- **Quality eval: 91% (42/46 checks, 7/10 perfiles)** — baseline establecido
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

## Pendientes activos (priorizados)

1. **Rediseño slides 2–3** — slide 2 descriptivo + threat scores rankeados, slide 3 instrucción ejecutable, runners-up por tap
   → Requiere diseño en Figma antes de tocar código

3. **PlayerEditor input redesign** — ~48 campos finales (audit pendiente sección screener)
   → Prompt Cursor: `cursor_prompt_inputs_redesign.md`
   → Diagrama media pista ✅ implementado (`HalfCourtZoneSelector`, 5 zonas clicables, retrocompatible)

4. **`motorOutputToRichText`** — texto descriptivo por jugadora usando enrichedInputs en slide 1
   → Ya en main, revisar calidad

5. **Revision flow** — al guardar → pantalla revisión (ReportViewV4)

6. **ALLOW Tier 1: `allow_drive_weak_side`** — complementa FORCE dirección con "si te supera yendo a X, deja que llegue al aro"
   → Motor v2.1 + renderer EN/ES/ZH + perfil calibración
   → Diseño documentado en `scripts/allow_slot_design.md`

7. **Versiones inputs por coach** — tabla `player_inputs_versions` (requiere migración schema)

---

## Backlog futuro
- Iconos defensivos en slides: diseño Figma OBLIGATORIO antes de implementar. Nunca SVG generado.
- Favicon U Scout
- Logo club con imagen real (reemplaza emoji picker)
- Branding: SVG Figma → animación Rive
- Modo Simple vs Pro
- Offline queue + sincronización

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
# Regression tests (bugs)
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
# Score actual: 100% (551/551 checks, 66/66 perfiles)

# Quality eval
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
# Score actual: 100% (46/46 checks, 10/10 perfiles)
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
