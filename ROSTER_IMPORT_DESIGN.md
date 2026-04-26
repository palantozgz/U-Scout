# U Scout — Roster Import & Multi-Coach Input System
> Diseño aprobado y completo. Pendiente de implementar.
> Fecha: 25 abr 2026

---

## VISIÓN

Cada entrenador del staff introduce sus propios inputs de forma independiente.
Esto sirve para:
A. Mejorar la calidad de los reports (múltiples perspectivas)
B. Generar debate entre el staff
C. Entrenar internamente al staff

---

## REGLA DE DISCREPANCIA — DEFINICIÓN EXACTA

**Una discrepancia existe si y solo si el report visible en cualquiera de los 3 slides
es diferente entre dos o más coaches.**

Lo que NO genera discrepancia:
- Runners-up distintos pero mismo output principal visible
- Diferencia de peso/score interno pero mismo output en pantalla
- Inputs distintos que el motor resuelve al mismo output visible

Lo que SÍ genera discrepancia:
- Slide 1 diferente (archetype, tagline, nivel de amenaza)
- Slide 2 diferente (situaciones top mostradas)
- Slide 3 diferente (instrucción DENY, FORCE, ALLOW o AWARE distinta)

El detector opera sobre outputs renderizados, no sobre inputs raw ni scores internos.

---

## WORKFLOW COMPLETO — APROBADO

### FASE 0 — Importación de plantillas
- Head coach importa plantillas desde WCBA (botón en U Scout)
- Se crean fichas canónicas vacías: nombre + número + equipo
- Todo el staff ve las fichas vacías en el Dashboard

### FASE 1 — Trabajo individual (privado)
- Cualquier coach abre una ficha y rellena SUS inputs
- Se guardan en `player_inputs_drafts` (status: "draft")
- No ve los inputs de los demás
- Puede editar libremente su borrador

### FASE 1.5 — Preview del report propio (CONFIRMADO)
- Antes de enviar al staff, el coach ve su propio report generado desde sus inputs
- Puede clicar en cada output y ver los runners-up disponibles
- Puede elegir un runner-up o cancelar un output en cada string
- Solo cuando está satisfecho → envía al staff

### FASE 2 — Propuesta (envío al staff)
- Coach pulsa "Enviar al staff" → status: "proposed"
- El report (con las elecciones de runner-ups) queda visible al resto del staff
- En el HUD de Scout: contador "X/Y coaches han enviado su report"
  - X = número de propuestas recibidas
  - Y = total de coaches del staff

### FASE 3 — Detección de discrepancias (automático desde la primera propuesta)
- En cuanto hay ≥1 propuesta, el sistema puede mostrar el contador X/Y
- En cuanto hay ≥2 propuestas, el sistema compara outputs y detecta discrepancias
- Si hay discrepancia → badge de aviso visible para todo el staff en el Dashboard
- El staff puede elegir:
  A. Esperar a que más coaches envíen su report antes de resolver
  B. Abrir modo resolución ya con las propuestas disponibles

### FASE 4 — Modo resolución (cualquier coach puede ejecutarlo)
**Diseño del modo resolución:**

- Vista clara de qué bloques de output difieren (slide 1 / 2 / 3)
- Para cada discrepancia: muestra las versiones de cada coach side-by-side
- Debajo de cada versión: origen de los inputs que causaron ese output
  - Ej: "Pablo → DENY post-entry (postFreq=Primary, postEff=high)"
  - Ej: "Javier → DENY pnr-space (pnrFreq=Primary, postFreq=Secondary)"
- Si la diferencia proviene de un runner-up elegido → se indica explícitamente
  - Ej: "Javier eligió este runner-up manualmente"

**Resolución:**
- Cualquier coach del staff puede abrir el modo resolución
- Elige UNA versión final (la de cualquier coach) como report canónico
- Con que un coach lo ejecute basta (están todos juntos en la reunión)
- La resolución adopta los inputs del coach elegido como canonical_inputs
- El report se genera automáticamente desde esos inputs

**No hay chat ni comentarios inline** — la resolución se debate en reunión física,
la app solo sirve de soporte para ejecutar la decisión tomada en reunión.

### FASE 5 — Aprobación y publicación
- Cuando se elige una versión final → report aprobado
- Publicación a jugadoras (flujo existente, ya implementado)
- Borradores de los demás coaches → archivados (conservados para aprendizaje)

---

## HUD DE SCOUT — INDICADORES

En el Dashboard (lista de jugadoras), cada ficha muestra:

```
[Nombre jugadora]  [Equipo]
                   ○ Sin reports      → nadie ha enviado aún
                   ◐ 1/3 reports      → 1 de 3 coaches ha enviado
                   ◑ 2/3 reports      → 2 de 3 coaches han enviado
                   ● 3/3 reports      → todos han enviado
                   ⚠ 2/3 · Discrepancia → hay discrepancias detectadas
                   ✓ Aprobado         → versión final elegida
                   ✦ Publicado        → la jugadora puede verlo
```

El badge de discrepancia aparece en cuanto hay ≥2 propuestas con outputs distintos,
independientemente de si todos los coaches han enviado o no.

---

## PERMISOS

| Acción | head_coach | coach con ops_badge | coach sin badge |
|---|---|---|---|
| Crear fichas canónicas | ✅ | ✅ | ❌ |
| Crear borrador de inputs | ✅ | ✅ | ✅ |
| Enviar report al staff | ✅ | ✅ | ✅ |
| Ver reports de otros coaches | ✅ | ✅ | ✅ |
| Abrir modo resolución | ✅ | ✅ | ✅ |
| Ejecutar aprobación de versión final | ✅ | ✅ | ✅ |
| Publicar a jugadoras | ✅ | ✅ | con ≥1 aprobación |
| Importar plantillas WCBA | ✅ | ✅ | ❌ |
| Gestionar fichajes / migración | ✅ | ✅ | ❌ |

Nota: la resolución de discrepancias la puede ejecutar cualquier coach porque
el flujo asume que están en reunión física — la app es el instrumento de la decisión,
no el árbitro de quién puede decidir.

---

## ARQUITECTURA DE DATOS

```
players (ficha canónica)
  id, name, team_id, number, image_url
  status: "empty" | "active" | "archived"
  canonical_inputs JSONB       -- inputs aprobados finales (null hasta aprobación)
  published BOOLEAN
  source: "manual" | "wcba_import"
  external_id INTEGER          -- ID WCBA para matching con scraper
  name_zh TEXT
  name_en TEXT

player_inputs_drafts (borrador por coach)
  id UUID
  player_id → players.id
  coach_id UUID
  inputs JSONB
  rendered_output JSONB        -- snapshot del report al enviar al staff
  runner_up_overrides JSONB    -- runner-ups elegidos manualmente por este coach
  status: "draft" | "proposed" | "approved" | "archived"
  created_at, updated_at
  UNIQUE(player_id, coach_id)

player_draft_discrepancies (calculado al comparar proposed)
  id UUID
  player_id → players.id
  field_key TEXT               -- "slide1.archetype" | "slide3.deny" | etc.
  slide INTEGER                -- 1, 2 o 3
  values JSONB                 -- { coach_id: rendered_value, ... }
  input_traces JSONB           -- { coach_id: [input_fields_causantes] }
  resolved BOOLEAN
  resolved_by UUID             -- coach_id que ejecutó la resolución
  resolved_value JSONB
  resolution_type TEXT         -- "chose_coach_X" | "manual_edit" | "chose_runnerup"
  created_at

roster_migration_log (auditoría de cambios de plantilla)
  id UUID
  player_id → players.id
  player_name_zh TEXT
  change_type TEXT             -- "transfer" | "new" | "retired"
  from_team_id UUID
  to_team_id UUID
  migration_type TEXT          -- "A_keep" | "B_clear" | "C_ignore"
  applied_by UUID
  inputs_archived JSONB        -- copia antes de borrar
  created_at
```

---

## GESTIÓN DE CAMBIOS DE PLANTILLA

### Cambio individual (scrap nocturno)

**Alta:** ficha canónica vacía creada automáticamente + notificación en Mi Club
**Baja:** notificación → head coach elige archivar o borrar
**Fichaje:** notificación → head coach elige:
  A. Mover conservando inputs (marcar "pendiente revisión")
  B. Mover borrando inputs (sin sesgo de confirmación)
  C. Ignorar

### Cambio masivo de temporada (verano)
- Vista especial: todas las jugadoras afectadas agrupadas por tipo de cambio
- Opciones individuales (una a una) O en bloque para todas
- Opción recomendada en bloque al inicio de temporada: B (borrar inputs)
- Todo queda registrado en roster_migration_log con los inputs archivados

---

## IMPORTACIÓN DE PLANTILLAS WCBA

- Botón "Gestionar plantillas" en U Scout (solo head_coach o ops_badge)
- Sub-acciones: Importar desde WCBA | Crear equipo manual | Crear jugadora manual
- Al importar: Railway llama a Pi → Pi devuelve equipos + jugadoras de temporada activa
- Crea fichas canónicas vacías (canonical_inputs = null)
- Nombres en name_zh siempre, name_en si disponible
- Pinyin calculado en frontend (librería pinyin-pro) cuando locale ≠ zh
- Detección de duplicados: match por external_id primero, luego name_zh + jersey + team

---

## NOMBRES EN MÚLTIPLES IDIOMAS

- Jugadoras WCBA: name_zh siempre presente, pinyin calculado en frontend
- Jugadoras ligas occidentales: name_en como base, name_zh null
- No se traduce automáticamente — se muestra el nombre original de la liga

---

## DB CHANGES REQUERIDAS

```sql
-- Añadir a players (no destructivo)
ALTER TABLE players ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE players ADD COLUMN external_id INTEGER;
ALTER TABLE players ADD COLUMN canonical_inputs JSONB;
ALTER TABLE players ADD COLUMN name_zh TEXT;
ALTER TABLE players ADD COLUMN name_en TEXT;

-- Nueva tabla borradores
CREATE TABLE player_inputs_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  rendered_output JSONB,
  runner_up_overrides JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, coach_id)
);

-- Nueva tabla discrepancias
CREATE TABLE player_draft_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  slide INTEGER NOT NULL,
  values JSONB NOT NULL,
  input_traces JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_value JSONB,
  resolution_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Nueva tabla auditoría migraciones
CREATE TABLE roster_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  player_name_zh TEXT,
  change_type TEXT NOT NULL,
  from_team_id UUID,
  to_team_id UUID,
  migration_type TEXT,
  applied_by UUID,
  inputs_archived JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX ON player_inputs_drafts(player_id);
CREATE INDEX ON player_inputs_drafts(coach_id);
CREATE INDEX ON player_inputs_drafts(status);
CREATE INDEX ON player_draft_discrepancies(player_id);
CREATE INDEX ON player_draft_discrepancies(resolved);
CREATE INDEX ON players(external_id);
CREATE INDEX ON players(name_zh);
CREATE INDEX ON roster_migration_log(player_id);
```

---

## ORDEN DE IMPLEMENTACIÓN

1. DB migrations (SQL en Supabase SQL Editor)
2. Backend: endpoints drafts + discrepancias + fusión + importación + migración
3. Pi collector: roster export + detección de cambios entre temporadas
4. PlayerEditor: guardar en drafts + preview de report propio con runner-ups
5. Dashboard: HUD con contador X/Y + badges de estado + badge discrepancia
6. Modo resolución: vista side-by-side con origen de inputs + botón "Aprobar versión"
7. Mi Club: alertas de plantilla y vista de migración de temporada
8. U Scout: botón "Gestionar plantillas"
9. Frontend: pinyin-pro para transliteración

---

## NOTAS DE PRODUCTO

- El sesgo de confirmación es el enemigo — trabajo privado hasta la propuesta
- La discrepancia es información valiosa, no un error
- La resolución es física (reunión) — la app ejecuta la decisión, no la toma
- Cualquier coach puede ejecutar la resolución porque se asume están juntos
- Los inputs archivados se conservan siempre para aprendizaje futuro del motor
- "Borrar inputs al inicio de temporada" es la recomendación por defecto
- El audit trail de migraciones es obligatorio para trazabilidad
