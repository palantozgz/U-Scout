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
- `client/src/lib/overrideEngine.ts` — overrides + discrepancias + ML patterns
- `client/src/lib/approval-api.ts` — useApprovalStatus + helpers invalidación
- `client/src/pages/coach/ReportViewV4.tsx` — shell mínimo: renderiza ReportSlidesV1 con coachMode + barra fija de aprobación (proponer/publicar). Solo activo en coach_review.
- `client/src/pages/coach/ReportSlidesV1.tsx` — 3 slides (swipe táctil + pips). Prop coachMode: kebab ⋮ por ítem + bottom sheet runners-up. Usado por ReportViewV4 (coach_review) y directo en /player/report/:id
- `client/src/pages/coach/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/coach/Dashboard.tsx` — lista equipos/jugadores, PlayerRow
- `client/src/lib/mock-data.ts` — usePlayer, playerInputToMotorInputs, clubRowToMotorContext
- `client/src/lib/i18n.ts` — strings EN/ES/ZH
- `server/routes.ts` — rutas API Express
- `server/storage.ts` — acceso Supabase

## NUNCA tocar
- `Profile.tsx`
- `schema.ts`
- `migrations/`
- SQL destructivo: solo en Supabase SQL Editor, nunca `drizzle-kit push`

---

## Arquitectura 4 capas (producción)
1. `motor-v4.ts` → scores numéricos + candidatos rankeados (sin texto)
2. `reportTextRenderer.ts` → texto EN/ES/ZH con gender
3. `overrideEngine.ts` → overrides + discrepancias + ML
4. `ReportSlidesV1.tsx` → UI: 3 slides swipe, coachMode kebabs · `ReportViewV4.tsx` → shell coach_review: ReportSlidesV1 + barra aprobación

## Flujo de navegación (producción)
Dashboard (coach/editor)
└─ [tap nombre/posición jugadora]  →  ReportViewV4 (coach_review)
└─ botón "Revisar" (✓)            →  ReportViewV4 (coach_review)
└─ "Proponer al staff"              →  POST /approve → Dashboard
└─ "Publicar"                       →  POST /publish
└─ ← atrás                          →  Dashboard
└─ botón "Edit"  →  PlayerEditor
└─ Guardar  →  persiste en sitio (se queda en editor)
└─ ← atrás  →  ReportViewV4 (coach_review) si jugadora existente
→  /coach/editor si jugadora nueva

## Rutas activas
- `/coach/editor` → Dashboard modo editor
- `/coach/scout/:id/review` → ReportViewV4 modo coach_review
- `/coach/scout/:id/preview` → ReportSlidesV1 (vista jugador, acceso directo desde coach)
- `/player/report/:id` → ReportSlidesV1 (vista jugador nativa)
- `/coach/player/:id` → PlayerEditor

## API aprobación (todas en routes.ts)
- `GET  /api/players/:id/approval-status` → approvals, totalStaff, overrides, isPublished, hasDiscrepancy
- `POST /api/players/:id/overrides` → guarda override {slide, itemKey, action}
- `DELETE /api/players/:id/overrides/:key` → elimina override
- `POST /api/players/:id/approve` → coach aprueba
- `DELETE /api/players/:id/approve` → retira aprobación
- `POST /api/players/:id/publish` → publica (requiere ≥1 aprobación)
- `POST /api/players/:id/unpublish` → despublica

---

## Estado actual

### ✅ En producción (main) — commit 98ac07e
- Runners-up: bottom sheet en ReportSlidesV1 — situaciones alternativas + alternativas DENY/FORCE/ALLOW
- contactType en tab Contexto → Perfil físico (visible siempre, aplica a ISO + PnR + cualquier drive)
- motor-v4.ts: allow fallback solo para situaciones genuinamente low-threat (<0.5) — fix allow_transition incorrecto
- motor-v2.1.ts: force_early solo para ISO puros sin exterior/transición threat; force_direction desde asimetría PnR (pnrFinishLeft/Right); force_contact suprimido para spot-up primarias; allow_iso filtrado para PnR/post primarias; allow_post solo para interiores con presencia real
- mock-data.ts: deepRange = true también para spotUp Secondary + catch&shoot o isoEff high
- reportTextRenderer.ts: renderizado completo para todos los keys del motor — force_direction (EN/ES/ZH con side inference desde hand), deny_duck_in, deny_pnr_pop/roll, deny_oreb, deny_dho, deny_floater, allow_cut/catch_shoot/transition/post/iso_both, force_contact/full_court/no_push/no_ball/paint_deny, allow_distance/ball_handling
- scripts/calibrate-motor.ts: 26 perfiles NBA/WNBA con expectations concretas. Score: **100% (228/228 checks, 26/26 perfiles)**

### ⚠️ Pendiente operacional (no código)
- **Yuming + Luffy** — ejecutar en Supabase SQL Editor:
  ```sql
  SELECT id, email FROM auth.users
  WHERE email ILIKE '%yuming%' OR email ILIKE '%luffy%';
  SELECT id, name FROM clubs;
  -- Luego:
  INSERT INTO club_members (club_id, user_id, role, display_name, status, joined_at)
  VALUES ('<CLUB_ID>', '<YUMING_ID>', 'coach', 'Yuming', 'active', NOW()),
         ('<CLUB_ID>', '<LUFFY_ID>', 'coach', 'Luffy', 'active', NOW())
  ON CONFLICT (club_id, user_id) DO UPDATE SET role='coach', status='active', joined_at=NOW();
  ```
- **Pika FORCE → forzar izquierda**: requiere que en el editor PnR tab estén seteados `pnrFinishBallLeft = Pull-up` y `pnrFinishBallRight = Drive to Rim`. Sin esos campos el motor no detecta asimetría.

### 🔄 Pendientes activos (priorizados)
1. **Versiones inputs por coach** — tabla player_inputs_versions (sprint futuro, requiere migración schema)

### 🗓 Backlog futuro
- **Iconos/ilustraciones defensivas en slides** — diseño obligatorio en Figma antes de implementar. Nunca SVG generado.
- Favicon U Scout
- Logo club con imagen real
- Branding: SVG Figma → animación Rive
- Modo Simple vs Pro
- Offline queue + sincronización

---

## Decisiones de producto (bloqueadas)
- Scope: solo matchup 1-on-1. Sin situaciones colectivas.
- Report: 3 SLIDES — Slide 1: ¿Quién es?, Slide 2: ¿Qué hará? (top 3 situaciones), Slide 3: ¿Qué hago yo? (DENY/FORCE/ALLOW + max 2 AWARE)
- Mismo informe jugadora y entrenador
- ClubContext a nivel club, no por jugadora
- Iconos: diseño Figma obligatorio antes de implementar. Nunca SVG generado.

---

## Reglas entrega código (no negociables)
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, comando terminal con cd, o prompt Cursor
- Ejecutar `npm run check` después de cada cambio
- Cursor agent para ejecución multi-archivo
- Claude para arquitectura, motor, generación de prompts

## Calibración motor
```
cd "/Users/palant/Downloads/U scout"
npx tsx scripts/calibrate-motor.ts
```
Escribe: `scripts/calibration-results.json`
Score actual: **100% (228/228 checks, 26/26 perfiles)**
Perfiles: Luka, Jokic, Curry, Giannis, Klay, Embiid, Haliburton, Gobert, A'ja Wilson, Breanna Stewart, Ionescu, Clark, Plum, 3-and-D wing, Pika-style, Pop screener, Pressure vuln, Interior role, ISO europeo, DHO, Cutter, Slip screener, Ball liability, Oreb specialist, PnR asimetría, Floater guard

## Audit rápido
```
cd "/Users/palant/Downloads/U scout" && bash scripts/audit.sh > scripts/audit-output.txt
```

---

## Terminología
- SCOUT: zona trabajo entrenador — editar inputs, revisar report, proponer al staff, aprobar
- REPORTS: zona entrenador para reports ya publicados
- Runners-up: alternativas rankeadas por el motor por línea del informe
- Override: decisión entrenador que sobreescribe output del motor
- Discrepancia: dos entrenadores eligieron opciones distintas para el mismo ítem
- Archetype: perfil ofensivo primario de la jugadora
