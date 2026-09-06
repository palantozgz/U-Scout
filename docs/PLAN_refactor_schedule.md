# Plan de refactor — Schedule.tsx (god file)

> Redactado 2026-09-06. NO EJECUTADO — pendiente de aprobación de Pablo.
> Regla explícita: no dividir este archivo sin discutirlo primero (ya hubo un
> intento fallido de separar Desktop/Mobile, revertido — ver CLAUDE_CONTEXT).

## Diagnóstico

- 3.621 líneas totales. El componente `export default function Schedule()`
  ocupa el 92% del archivo (líneas 99-3339). El resto (funciones auxiliares
  como WellnessRow, KpiCard, SessionRow, formatTime) ya está razonablemente
  separado, solo que co-ubicado en el mismo archivo.
- 45 `useState`, 32 `useQuery/useMemo/useCallback/useEffect` dentro de UN
  solo componente.
- 140 usos de `any` (coincide con lo detectado en el audit externo).
- Confirmado el hallazgo de "dos copias del formulario de wellness": el
  bloque de 4 `WellnessRow` (sleep/energy/soreness/readiness) + botón de
  guardar está duplicado literalmente en dos sitios (~L2280 y ~L2510) — una
  copia para el flujo "showLocalWellness" (fallback cuando el backend de
  wellness no está disponible) y otra para el flujo de edición de una entrada
  ya enviada ("wellnessEditing"). Comparten el mismo estado (sleepQuality,
  energyLevel, etc.) pero el JSX está pegado dos veces.

## Por qué NO proponer separar Desktop/Mobile otra vez

Ya se intentó antes y se revirtió (nota en CLAUDE_CONTEXT: "Schedule/Stats
still single files with surgical md: classes (by design after failed Desktop
split)"). El patrón actual (un solo árbol JSX con clases `md:` puntuales)
es una decisión consciente, no deuda accidental. Este plan NO la cuestiona —
se enfoca en sacar LÓGICA (no JSX responsive) del componente gigante, dejando
el JSX donde está.

## Plan por fases — cada fase es independiente y revertible por separado

### Fase 0 (más segura, ejecutar primero si se aprueba una sola cosa)
**Deduplicar el formulario de wellness.**
Extraer el bloque de 4 WellnessRow + botón guardar a un subcomponente
`WellnessEntryForm` (mismo archivo o `components/schedule/WellnessEntryForm.tsx`),
con props: valores actuales + setters + onSave + isPending. Usarlo en los dos
sitios que hoy tienen el JSX pegado. Cero cambio de comportamiento, solo
elimina la duplicación. Riesgo: mínimo (JSX idéntico, mismo estado).

### Fase 1
**Extraer las queries/hooks de datos a un hook propio.**
Crear `useScheduleData(clubId, userId)` en `lib/schedule.ts` (o un archivo
nuevo) que agrupe: todayEventsQ, tomorrowEventsQ, weekEventsQ, prevWeekQ,
myParticipantsQ, todayParticipantsQ, wellnessPctQ, nextSession (el useMemo).
El componente Schedule() pasa a consumir un solo `const data = useScheduleData(...)`
en vez de declarar cada hook suelto. No cambia el JSX ni el comportamiento,
solo mueve la lógica de fetching fuera del componente de render. Riesgo: bajo,
pero toca ~15-20 sitios donde se leen esos valores — requiere revisar cada
uno con cuidado.

### Fase 2
**Extraer el estado y los handlers del formulario de creación/edición de sesión.**
Gran parte de los 45 useState son campos del formulario de SessionCreateDialog
(createSessionType, createTitle, createDate, attendanceMode, groupsCount,
etc.) — ya hay un `useSessionForm.ts` parcial; ampliarlo para que absorba
TODO el estado del formulario, no solo writeConstraintsToNotes/readConstraintsFromNotes.
Riesgo: medio — el formulario tiene bastante lógica condicional (modos de
asistencia, grupos, repetición semanal) que hay que mover con cuidado de no
romper validaciones.

### Fase 3 (mayor alcance, dejar para el final)
**Separar las secciones de JSX en subcomponentes de presentación.**
El planner grid, la vista de lista, el panel de wellness y el diálogo de
detalle de sesión son secciones visualmente independientes dentro del mismo
retorno JSX. Se pueden extraer a componentes en `components/schedule/` que
reciban los datos ya calculados (de las fases 1-2) como props, sin lógica
propia. Esto es lo más parecido a "dividir el archivo", por eso va al final
y solo si las fases anteriores ya redujeron el tamaño real del problema
(estado + lógica), dejando la fase 3 como una extracción mecánica de JSX
puro sin re-litigar la decisión de no separar Desktop/Mobile.

## Cómo validar cada fase antes de dar por cerrada

1. `npm run check` limpio.
2. `npm run build` limpio, comparar tamaños de bundle (Schedule.tsx hoy
   pesa 91.06 KB / 20.86 KB gzip — no debería crecer significativamente,
   idealmente baja si el código compartido se aprovecha mejor).
3. Smoke test manual real en producción (no solo local): crear sesión,
   editar sesión, enviar wellness como jugador, editar wellness ya enviado,
   ver planner semana actual y siguiente — los mismos flujos que se
   verificaron en la sesión de QA del countdown.
4. Commit por fase, no todo junto — si algo se rompe, revertir un commit
   pequeño es mucho más fácil que revertir un refactor de 3.600 líneas de una vez.

## Recomendación

Empezar por la Fase 0 (deduplicar wellness) en una sesión separada, medir el
resultado, y decidir si seguir con la Fase 1 después. Las fases 2 y 3 son
opcionales y solo valen la pena si Schedule.tsx sigue siendo difícil de tocar
después de las primeras dos.
