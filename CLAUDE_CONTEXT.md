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
- `client/src/pages/coach/ReportSlidesV1.tsx` — 3 slides (swipe táctil + pips). Prop coachMode: muestra kebab ⋮ por ítem (runners-up próximo sprint). Usado por ReportViewV4 (coach_review) y directo en /player/report/:id
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

### ✅ En producción (main)
- Campos nuevos PlayerInput: isoFinishLeft/Right, pnrSnake, contactType, ftRating — tipo + motor + editor
- Migración isoStrongHandFinish/isoWeakHandFinish → isoFinishLeft/Right con fallback hacia atrás
- contactType afecta contactFinish en motor; ftRating afecta isoDanger; pnrSnake afecta pnrDanger
- Motor v4 calibrado y activo
- Flujo aprobación conectado: handlePropose → POST /approve, handlePublish → POST /publish
- Barra inferior coach_review: X/Y propuesto, banner discrepancias, botón Publicar
- renderSituationDescription exportada en reportTextRenderer.ts
- Dashboard: botón preview (📄) eliminado; tap en card jugadora → review; botón "Revisar" único entry point
- i18n: editor_review_report, report_preview_as_player, report_back_to_review, report_staff_proposed, report_discrepancy_banner
- ReportSlidesV1 activo: 3 slides (Quién es / Qué hará / Qué hago yo), swipe táctil + pips clickeables, header fijo con club-emoji. coachMode=true añade kebab ⋮ por ítem. Iconos DENY/FORCE/ALLOW: SVG placeholder. Temas heredados por CSS.
- i18n: slides_who_is, slides_what_will_do, slides_what_do_i añadidos en EN/ES/ZH
- PlayerEditor: Guardar ya no navega (se queda en editor). Flecha atrás → review. i18n: editor_save_inputs, editor_back_to_report.
- ReportViewV4: eliminados previewMode, toggle "Ver como jugadora", scroll vertical propio, overrides, sheet. Ahora es shell: ReportSlidesV1 + barra aprobación fixed bottom.

### 🔄 Pendientes activos (priorizados)
1. **Runners-up** — tap en cada línea del report → bottom sheet con alternativas rankeadas
2. **Versiones inputs por coach** — tabla player_inputs_versions (sprint futuro, requiere migración schema)

### 🗓 Backlog futuro
- **Iconos/ilustraciones/animaciones en slides del report** — cada instrucción defensiva (DENY/FORCE/ALLOW/AWARE) tiene un icono SVG placeholder. Pendiente: ilustraciones reales de acción de baloncesto en Figma, y animaciones (ej. "force early" = contacto temprano animado). Ancla mental: repetición del mismo icono = memoria muscular visual. Referencia: Duolingo, Nike Training Club. Diseño obligatorio en Figma antes de implementar.
- Favicon U Scout
- Logo club con imagen real
- Branding: SVG Figma → animación Rive
- Modo Simple vs Pro
- Iconos output: diseño Figma obligatorio antes de implementar
- Offline queue + sincronización
- Versiones inputs por coach (player_inputs_versions)

---

## Decisiones de producto (bloqueadas)
- Scope: solo matchup 1-on-1. Sin situaciones colectivas.
- Report final (vista jugador + zona REPORTS entrenador): 3 SLIDES, mismo componente para ambos
  - Slide 1: ¿Quién es? — foto, archetype, tagline, nivel amenaza
  - Slide 2: ¿Qué hará? — top 3 situaciones primarias con descripción (sin secundarias)
  - Slide 3: ¿Qué hago yo? — DENY/FORCE/ALLOW + máximo 2 AWARE
  - Sin slide de contexto — esa info es para el entrenador al scoutear, no para el jugador
  - Razón: 3 slides = 3 preguntas mentales, máxima retención, formato móvil
- Mismo informe jugadora y entrenador
- ClubContext a nivel club, no por jugadora
- Lenguaje neutro por defecto, ajustado al ClubContext
- Iconos: diseño Figma obligatorio antes de implementar. Nunca SVG generado.
- Jugadora como entidad compartida del staff (mismo ID), overrides por coach
- HEAD COACH paga, invita staff y jugadoras. Staff: permisos iguales salvo invitar/expulsar.

---

## Reglas entrega código (no negociables)
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, comando terminal con cd, o prompt Cursor
- Ejecutar `npm run check` después de cada cambio
- Cursor agent para ejecución multi-archivo
- Claude para arquitectura, motor, generación de prompts

## Calibración motor
cd "/Users/palant/Downloads/U scout"
npx tsx scripts/test-motor-v4.ts
Lee: scripts/test-profiles.json
Escribe: scripts/test-results-v4.json

## Audit rápido
cd "/Users/palant/Downloads/U scout" && bash scripts/audit.sh > scripts/audit-output.txt

---

## Terminología
- SCOUT: zona trabajo entrenador — editar inputs, revisar report, proponer al staff, aprobar
- REPORTS: zona del entrenador para consultar reports ya publicados — mismo contenido que ve la jugadora, pero acceso desde auth de entrenador. NO es la interfaz de las jugadoras.
- Runners-up: alternativas rankeadas por el motor por línea del informe
- Override: decisión entrenador que sobreescribe output del motor
- Discrepancia: dos entrenadores eligieron opciones distintas para el mismo ítem
- Archetype: perfil ofensivo primario de la jugadora
