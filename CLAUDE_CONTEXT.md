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

## Documentos de diseño
- `STATS_BLUEPRINT.md` — arquitectura U Stats + API WCBA + DB schema
- `EVAL_BLUEPRINT.md` — evaluador multi-juez LLM de reports
- `ROSTER_IMPORT_DESIGN.md` — sistema multi-coach + importación plantillas
- `docs/U_CORE_ARCHITECTURE.md` — arquitectura general (referencia)
- `docs/U_SCHEDULE_V2_SPEC.md` — spec futura de U Schedule V2 (no implementar aún)

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

## Estado actual — sesión 25 abr 2026 (cierre)

### Commits de hoy (main)
- `perf: i18n lazy loading + React.lazy — bundle 509→268 KB gzip`
- `perf: remove framer-motion, lazy BasketballAvatar — 268→229 KB gzip`
- `perf: prefetch club data on Home mount + staleTime 5min`
- `fix: mobile responsive audit — 17 fixes across 6 files`
- `fix: invitation flow — auto-accept after login, persist token through auth`
- `fix: hide owner kebab in ClubManagement MemberRow`
- `fix: bloque 2 — race condition sessions, landscape padding, safe-area, timezone wellness, expiry warning invites`
- `fix: bloque 1D redirect to report after save, 1E swipe hint first visit`

### Bundle ✅
- **229.49 KB gzip** — objetivo <300 KB cumplido

### Motor ✅
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)

### U Stats DB ✅
- Schema completo en Supabase (tablas stats_*)
- Seed: WCBA (competitionId=56, seasonId=2092) + 18 equipos

### Raspberry Pi
- Comprada (Pi 5 8GB, ~1939 CNY) — en tránsito

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

## PLAN DE IMPLEMENTACIÓN COMPLETO Y PRIORIZADO

### Estrategia de conversaciones
- Esta conversación = matriz de arquitectura y decisiones de producto
- Conversaciones hijas = una por bloque, arrancan leyendo CLAUDE_CONTEXT.md
- Cada conversación hija hace commit al final
- Esta conversación se reabre solo para decisiones de arquitectura

### Quién implementa qué
- **Claude → Cursor:** todo lo que toca el repo
- **ChatGPT:** Collector Pi (Node.js puro), textos renderer imperativo, pinyin mapping
- **Pablo ejecuta:** terminal en Pi, SQL en Supabase, Xcode

---

### BLOQUE A — Limpieza y reorganización
**Contenido:**
- Eliminar: `CLAUDE_CONTEXT.md.save`, `ReportSlidesV1.backup.tsx`,
  `report-limpieza-pendiente.md`, `BUNDLE_PLAN.md`,
  prompts Cursor ejecutados en `scripts/` (cursor_prompt_*.md),
  `scripts/archetype-test-results.json`, `scripts/calibration-results.json`,
  `scripts/audit-output.txt`, `scripts/eval-quality-results.txt`
- Mover `script/build.ts` → `scripts/build.ts`, eliminar carpeta `script/`
- Renombrar `pages/coach/` → `pages/scout/` (con fix de todos los imports)
- Revisar alias muerto `@assets` en vite.config.ts (carpeta `attached_assets` no existe)
- Auditar shadcn/ui components no usados (ver `report-limpieza-pendiente.md`)
- Revisar `translateMotorOutput.ts` vs `reportTextRenderer.ts` — posible duplicación
- NO mover Profile.tsx, schema.ts, migrations/
**Complejidad:** Baja-media (renombrar pages/coach/ tiene riesgo de imports)
**Quién:** Cursor

### BLOQUE B — Stats card oculta
**Contenido:**
- Ocultar HomeCard de U Stats hasta que haya datos reales en stats_standings
- Condición: `hasStatsData` desde query a stats_leagues
**Complejidad:** Mínima (puede ir junto al Bloque A)
**Quién:** Cursor

### BLOQUE C — Motor audit: bugs duros y inferencias (IMPORTANTE — antes de evaluar)
**Contenido — de `scripts/motor-audit.md`:**
- `spotZone: null` hardcoded en mock-data.ts → mapear desde inputs.spotZone
- `dhoFreq: "N"` hardcoded → mapear desde inputs.dhoFrequency
- `pnrSnake` existe en inputs pero motor no lo usa → añadir lógica en motor-v2.1
- `ftRating` no genera outputs → si contactFinish=seeks + ftRating>=4 → aware foul drawing
- `offHandFinish=strong + isoWeakHandFinish=drive` → suprimir force_weak_hand (ambidiestro)
- `ath` no modula force_full_court weight → añadir modulación
- `deepRange + spotUpFreq=P + closeoutReaction=Catch&Shoot` → aware_instant_shot
- `vision=4 + trapResponse=struggle` → texto diferenciado en aware_pressure_vuln
- `orebThreat` → inferir medium para C/PF con phys>=4 si null
- **Después de cambios: recalibrar motor (npx tsx scripts/calibrate-motor.ts)**
**Complejidad:** Media-alta (tocar motor requiere recalibración)
**Quién:** Claude → Cursor

### BLOQUE D — ALLOW slot design (de `scripts/allow_slot_design.md`)
**Contenido:**
- Motor v4: supresión ALLOW cuando es redundante con FORCE (ya hay lógica, revisar)
- UI: slot ALLOW condicional — si key === "none" no renderiza, libera espacio para 2ª AWARE
- Motor v2.1 + renderer: `allow_drive_weak_side` (nuevo, Tier 1)
- Motor v2.1 + renderer: `allow_post_opposite` (nuevo, Tier 2)
- Motor v2.1 + renderer: `allow_floater` / `allow_mid_range_close` (Tier 2)
- **Recalibrar motor después**
**Complejidad:** Media
**Quién:** Claude → Cursor

### BLOQUE E — Figma → código (1 mayo, reset créditos MCP)
**Contenido:**
- Figma file: https://www.figma.com/design/odswsQA5XDEgULEDh2UMZi
- Temas Gamenight/Office/Oldschool → CSS vars en index.css
- Iconos defensivos ReportSlidesV1 — OBLIGATORIO Figma antes de código
**Complejidad:** Media
**Quién:** Claude + Cursor

### BLOQUE F — Workflow aprobación UI + discrepancias actuales
**Contenido:**
- Indicadores visuales de los 3 niveles de aprobación en ReportViewV4
- Badge "Discrepancia detectada" en Dashboard (backend ya detecta)
- Vista comparación básica en ReportViewV4 (sistema actual de overrides)
**Complejidad:** Alta
**Quién:** Claude → Cursor

### BLOQUE G — Hot/Cold streaks
**Contenido:**
- Campo `recentForm: "hot" | "cold" | "stable"` en PlayerEditor
- Lógica en motor-v4.ts
- Renderer: texto específico por tendencia
- Slide 1: indicador visual
- Recalibrar motor
**Complejidad:** Media
**Quién:** Claude → Cursor

### BLOQUE H — Textos renderer en imperativo
**Contenido:**
- Revisar reportTextRenderer.ts completo
- Reescribir strings sin sujeto: "they drive left" → "drives left"
- Verificar EN/ES/ZH
**Complejidad:** Media-baja (mecánico pero extenso)
**Quién:** ChatGPT para el texto + Cursor para integrar

### BLOQUE I — Evaluador multi-juez LLM
**Contenido:**
- API keys: DeepSeek (móvil chino), Gemini (cuenta Google), Anthropic + OpenAI (móvil español)
- Probar con `--judge deepseek --fast`
- Perfiles de casos límite (10-15 adicionales)
- 3 reports de calibración en el prompt (malo/medio/bueno)
- Dimensión `completitud_inputs` (6ª dimensión)
- Ver: `EVAL_BLUEPRINT.md`
**Complejidad:** Media
**Quién:** Claude → Cursor + Pablo (keys)

### BLOQUE J — Offline system
**Contenido:**
- Queue de mutations: PlayerEditor save + ReportApproval + WellnessEntry
- Banner "Sin conexión"
- idb (IndexedDB) para persistir la queue
**Complejidad:** Alta
**Quién:** Claude → Cursor

### BLOQUE K — U Stats ingest + UI básica
**Contenido:**
- POST /api/stats/ingest en Railway con Bearer token
- Stats Home UI con standings reales
- Opponent Report UI básico
**Complejidad:** Alta
**Quién:** Claude → Cursor

### BLOQUE L — Collector Pi WCBA
**Contenido:**
- Node.js + TypeScript + axios + node-cron + PM2 + telegraf
- Sync nightly: standings, schedule, player stats
- Sync live: scores + PBP cada 3 min en game days
- Bot Telegram: /status /sync /reboot
- Tailscale SSH remoto
- Ver: `STATS_BLUEPRINT.md`
**Complejidad:** Alta
**Quién:** ChatGPT genera código + Pablo ejecuta en Pi
**Dependencia:** Pi debe llegar y tener Node.js 20 instalado

### BLOQUE M — Stats como soporte del motor (NUEVO — ver sección abajo)
**Contenido:** ver sección "Stats como soporte del motor" más abajo
**Complejidad:** Media-alta
**Dependencia:** Bloque L debe estar parcialmente operativo (standings + season stats)
**Quién:** Claude → Cursor

### BLOQUE N — Roster Import & Multi-Coach (varias sesiones)
**Contenido:**
- DB migrations: player_inputs_drafts + player_draft_discrepancies + roster_migration_log + ADD COLUMN en players
- Backend: endpoints drafts, comparación, fusión, importación, migración
- PlayerEditor: guardar en drafts + preview de report propio con runner-ups
- Dashboard: HUD X/Y coaches + badges + badge discrepancia
- Modo resolución: side-by-side + origen inputs + "Aprobar versión"
- Mi Club: alertas de plantilla y migración de temporada
- U Scout: botón "Gestionar plantillas"
- Pinyin: pinyin-pro frontend
- Ver: `ROSTER_IMPORT_DESIGN.md`
**Complejidad:** Muy alta
**Dependencia:** Bloque L para importación WCBA
**Quién:** Claude → Cursor (varias sesiones)

### BLOQUE O — U Schedule V2 (futuro, post-beta)
**Contenido:** ver `docs/U_SCHEDULE_V2_SPEC.md`
- session_groups, session_slots, session_templates, session_history
- Onboarding guiado para jugadoras
- Attendance policy avanzada
**Complejidad:** Muy alta
**Nota:** NO implementar antes de TestFlight. La spec está documentada para cuando llegue el momento.

### BLOQUE P — TestFlight
**Contenido:**
- Xcode (~10GB, Mac App Store)
- `npx cap sync && npx cap open ios`
- Signing → TestFlight
**Quién:** Pablo + Claude como guía

---

## Orden de ejecución recomendado

```
A+B (limpieza + stats card)
→ C (motor audit bugs duros)
→ D (ALLOW slot design)
→ E (Figma, 1 mayo)
→ F (aprobación UI)
→ G (hot/cold)
→ H (renderer imperativo)
→ I (evaluador LLM, cuando lleguen keys)
→ J (offline)
→ K+L (stats UI + collector Pi, en paralelo cuando llegue Pi)
→ M (stats como soporte motor)
→ N (roster import, varias sesiones)
→ O (Schedule V2, post-beta)
→ P (TestFlight)
```

Bloques A, B, C, D pueden ejecutarse antes del 1 de mayo.
Bloque E el 1 de mayo.
Bloques K, L, M, N después de que llegue la Pi.

---

## STATS COMO SOPORTE DEL MOTOR (Bloque M — diseño pendiente de debate)

### Principio de prioridad (aprobado)
1. Inputs del entrenador → fuente de verdad principal
2. Motor → lógica de inferencia
3. Stats numéricas → soporte, matiz, argumento — NUNCA override de los inputs

### Qué stats tiene disponibles U Stats (después del scraper)
- Season stats: pts/g, reb/g, ast/g, TS%, usage%, eFG%, TOV%, FTA/game
- Last 5 games: pts, min, eFG%, tendencia (sparkline)
- Situacionales (cuando haya PBP): PPP en ISO, PPP en PnR, PPP en spot-up, etc.

### Tres usos posibles de las stats en el contexto del report

**Uso 1 — Avisos al entrenador mientras rellena inputs (PlayerEditor)**
Cuando el entrenador abre una ficha, ve pequeños avisos contextuales:
- "Esta temporada anota 28.5 PPG — perfil de alta amenaza"
- "eFG% de 61% en los últimos 5 partidos — racha caliente"
- "Uso del 35% — primera opción confirmada"
Estos avisos NO modifican los inputs. Son información para que el entrenador
tome mejores decisiones al rellenar los campos.
Implementación: columna lateral o tooltip en PlayerEditor cuando la jugadora
tiene external_id y hay datos en stats_season / stats_pbp.

**Uso 2 — Argumentos en la vista de runners-up (ReportViewV4)**
Cuando el entrenador abre un runner-up para elegirlo, ve el argumento numérico:
- Runner-up: "FORCE left"
  Argumento: "Eficiencia yendo a la derecha: 0.42 PPP (temporada)"
- Runner-up: "DENY post-entry"
  Argumento: "Post-up: 18% de sus posesiones, 0.91 PPP"
Esto da confianza al entrenador para elegir o descartar un runner-up
con datos reales, no solo con la lógica del motor.

**Uso 3 — Enriquecimiento del modo discrepancias**
Cuando dos coaches tienen outputs distintos, el modo de resolución muestra:
- Las dos versiones del report
- El origen de inputs de cada versión
- Y opcionalmente: el dato estadístico que apoya una u otra versión
Ej: Coach A dice DENY post, Coach B dice FORCE left.
La app muestra: "Post-up esta temporada: 22% posesiones, 1.05 PPP"
→ apoya la decisión de Coach A.

### Qué NO hacen las stats
- No modifican el output del motor sin intervención del entrenador
- No generan instrucciones defensivas por sí solas
- No aparecen en el report publicado a la jugadora (son herramienta interna del staff)
- No sustituyen campos de input vacíos (el motor trabaja con lo que el entrenador da)

### Stats situacionales (PPP por play type) — dependencia de PBP
Los datos más valiosos (PPP en ISO, PPP en PnR) requieren PBP del scraper.
En una primera fase solo habrá season averages (pts, reb, TS%, usage%).
El diseño debe funcionar en modo degradado: si no hay PPP, mostrar solo averages.

### Preguntas de diseño abiertas (debatir antes de implementar)
1. ¿Dónde se almacena la vinculación jugadora ↔ external_id en players?
   → Ya está en el diseño de ROSTER_IMPORT_DESIGN.md (campo external_id en players)
2. ¿Qué pasa si la jugadora no tiene external_id (creada manualmente)?
   → Sin stats. El sistema funciona en modo solo-inputs como ahora.
3. ¿Con qué temporada/fase se muestran las stats?
   → Por defecto: temporada activa, todos los juegos. Con filtro manual si el entrenador quiere playoffs only.
4. ¿Se muestran stats de equipos rivales o solo de la jugadora individual?
   → Individual primero. Stats de equipo rival es territorio de U Stats home screen, no del report.

---

## Archivos basura detectados (para Bloque A)
- `CLAUDE_CONTEXT.md.save` — backup automático
- `ReportSlidesV1.backup.tsx` — backup manual
- `report-limpieza-pendiente.md` — ya procesado en este contexto
- `BUNDLE_PLAN.md` — plan completado
- `scripts/cursor_prompt_*.md` — prompts ya ejecutados (6 archivos)
- `scripts/archetype-test-results.json` — resultado puntual
- `scripts/calibration-results.json` — resultado puntual
- `scripts/audit-output.txt` — regenerable
- `scripts/eval-quality-results.txt` — regenerable
- Alias `@assets` en vite.config.ts → carpeta `attached_assets` no existe

## Archivos a revisar (no borrar sin audit)
- `translateMotorOutput.ts` — posible duplicación con reportTextRenderer.ts
- Componentes shadcn/ui no importados — ver `report-limpieza-pendiente.md`
- `sql/player_report_views.sql` — verificar si está aplicado en Supabase
- `scripts/test-profiles.json` — confirmar si calibrate-motor.ts lo usa
- `onboarding-state.ts` + `OnboardingFlow.tsx` — estado de implementación desconocido

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio, nunca SVG desde código
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva
- Stats: apoyo al motor, nunca override — inputs primero, motor segundo, stats tercero

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
- Discrepancia (actual): dos coaches con outputs distintos en sistema de overrides
- Draft discrepancy: dos coaches con reports visibles distintos desde sus propios inputs
- Canonical inputs: inputs aprobados finales tras fusión de borradores
- Hot/Cold/Stable: tendencia reciente jugador (pendiente Bloque G)
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual
- PPP: puntos por posesión (métrica Synergy)
