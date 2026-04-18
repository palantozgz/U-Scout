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
- `client/src/pages/coach/ReportViewV4.tsx` — UI scroll vertical, kebab, bottom sheet, barra aprobación, toggle Ver como jugadora
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
4. `ReportViewV4.tsx` → UI: scroll vertical, kebab ⋮, bottom sheet, barra aprobación

## Flujo de navegación (producción)
Dashboard (coach/editor)
└─ [tap nombre/posición jugadora]  →  ReportViewV4 (coach_review)
└─ botón "Revisar" (✓)            →  ReportViewV4 (coach_review)
└─ botón "Ver como jugadora" (Eye)  →  toggle previewMode interno
└─ "Proponer al staff"              →  POST /approve → Dashboard
└─ "Publicar"                       →  POST /publish
└─ ← atrás                          →  Dashboard
└─ botón "Edit"  →  PlayerEditor
└─ Guardar  →  ReportViewV4 (coach_review) del mismo jugador
└─ ← atrás  →  ReportViewV4 (coach_review) si jugadora existente
→  /coach/editor si jugadora nueva

## Rutas activas
- `/coach/editor` → Dashboard modo editor
- `/coach/scout/:id/review` → ReportViewV4 modo coach_review
- `/coach/scout/:id/preview` → ReportViewV4 modo player (acceso directo, sin botón en Dashboard)
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
- ReportViewV4: scroll vertical, kebab ⋮, bottom sheet runners-up
- Overrides persistidos al servidor (POST/DELETE /api/players/:id/overrides)
- Flujo aprobación conectado: handlePropose → POST /approve, handlePublish → POST /publish
- Barra inferior coach_review: X/Y propuesto, banner discrepancias, botón Publicar
- Toggle "Ver como jugadora" / "Volver a revisión" en header de coach_review
- Post-save en PlayerEditor → redirige a /coach/scout/:id/review
- Dashboard: botón preview (📄) eliminado; tap en card jugadora → review; botón "Revisar" único entry point
- i18n: editor_review_report, report_preview_as_player, report_back_to_review, report_staff_proposed, report_discrepancy_banner

### 🔄 Pendientes activos (priorizados)
1. **Runners-up** — tap en cada línea del report → bottom sheet con alternativas rankeadas
2. **Runners-up** — tap en cada línea del report → bottom sheet con alternativas rankeadas
3. **Versiones inputs por coach** — tabla player_inputs_versions (sprint futuro, requiere migración schema)

### 🗓 Backlog futuro
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
- Report: 3 capas scroll — Identidad / Cómo ataca / Cómo defenderla+AWARE+Contexto
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
- SCOUT: zona trabajo entrenador (editor, review)
- REPORTS: zona lectura jugadoras
- Runners-up: alternativas rankeadas por el motor por línea del informe
- Override: decisión entrenador que sobreescribe output del motor
- Discrepancia: dos entrenadores eligieron opciones distintas para el mismo ítem
- Archetype: perfil ofensivo primario de la jugadora
