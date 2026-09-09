# Auditoría U Schedule / U Wellness — comparativa y propuestas
_Generado 2026-09-08, corregido 2026-09-09 tras verificar contra el código real (no solo la pantalla con datos de prueba limitados)._

> **Nota de procedencia:** este archivo se generó originalmente como salida de una conversación de Claude y nunca se guardó en el repo — por eso no existía aquí hasta ahora. Esta versión reconstruye el contenido original y corrige los dos errores que Pablo detectó verbalmente en la sesión siguiente.

---

## 0. Principio transversal: feedback optimista en TODA la app

**Petición explícita de Pablo:** que el patrón usado en My Club (toggle instantáneo, PATCH en segundo plano) se aplique en todos los sitios equivalentes, no solo ahí.

**Respaldo externo:** el patrón "optimistic update" es estándar en apps modernas (React Query, SWR, Relay lo soportan nativamente). La investigación de UX indica que el feedback visual inmediato reduce la *percepción* de espera hasta un ~40%, aunque el tiempo real de red no cambie — la gente juzga la app por cómo se *siente*, no por el tiempo real de respuesta. Regla general de la industria: aplicar optimismo a acciones de alta probabilidad de éxito (toggles, ediciones simples); evitarlo en acciones destructivas o transacciones financieras, donde sí conviene esperar confirmación.

**Estado real encontrado y corregido (sesiones 2026-09-08/09):**
- `usePatchClub`, `useDeleteClubMember`, `useBanClubMember`, `useSetClubMemberOperationsAccess` — los 4 mutations de `club-api.ts` tenían el mismo bug: la query key usada en el optimistic update (`["/api/club"]`) no coincidía con la key real de `useClub()` (`["/api/club", userId]`). El "optimismo" era un no-op silencioso en los 4 casos. **Corregido y verificado en producción.**
- El select "U Scout default report view" (1/3 slides) y el resto de campos de My Club (logo, liga, género/nivel/edad) tenían el mismo patrón de `disabled={... isPending}` bloqueando entre sí. **Corregido y verificado**: todos los campos responden al instante sin bloqueos cruzados. El bloqueo legítimo de género/nivel/edad según tipo de liga (WCBA) se mantuvo intacto, sin confundirse con el bug.
- Barrido del resto de la app en busca del mismo patrón (`isPending`/`isLoading` bloqueando toggles): revisado Wellness — el patrón ahí es correcto, solo bloquea durante el submit final del check-in, no por cada toque. **Sin revisar todavía**: Playbook, los wizards de Scout/PlayerEditor, y Personnel/InviteTeamDialog.

---

## 1. U Schedule — comparativa

### Lo que ya funciona bien (verificado en producción)
- Duración visible en tarjetas de sesión (09:30–11:30).
- Doble clic para editar en desktop; clic simple abre detalle. Long-press se reserva para móvil, donde sí tiene sentido.
- Drag-and-drop de sesiones entre día/franja en el planner de escritorio, con feedback visual de la celda destino.
- "Sessions Today" / "Next Session" calculan correctamente cruzando la medianoche, con día ancla en hora de China explícita (no la del dispositivo). `mondayOf()` del Planner también anclado a hora de China.
- Exportación de calendario `.ics` (`/api/ical/:token.ics`) a Google/Apple/Outlook — implementada esta misma ronda de sesiones.
- **RSVP explícito por sesión — YA EXISTÍA, corrección a la versión anterior de este documento.** El diálogo de creación de sesión tiene un selector de modo de participación (全队/分组/报名/选球员 = todo el equipo / por grupos / **inscripción** / jugadoras seleccionadas). El modo "报名" (inscripción/signup) es exactamente el RSVP explícito: botones "Joined"/"Leave" conectados a `schedule_participants`, con su propio optimistic update. El motivo de que no apareciera al probar como jugadora es que las sesiones de prueba usadas eran todas modo "todo el equipo" (donde el RSVP no aplica, correctamente). No hay que construir nada nuevo aquí.

### Comparativa con TeamSnap (líder de mercado, scheduling deportivo)
| Función | TeamSnap | U Schedule | Nota |
|---|---|---|---|
| Vista lista + vista calendario | Sí | Sí (List/Planner) | Paridad |
| Sincronización con calendario externo (Google/Outlook/Apple) | Sí, vía iCal/export | Sí (`.ics`, implementado) | Paridad alcanzada — pendiente de que Pablo lo pruebe suscribiéndolo en un calendario real (fuera del alcance de Claude) |
| Confirmación de asistencia por parte del jugador (RSVP) | Sí, con recordatorios automáticos | Sí, vía modo de sesión "报名"/signup | Paridad alcanzada (ver corrección arriba) |
| Drag-and-drop para reorganizar | Sí (en rosters/divisiones) | Sí, también en sesiones del planner | Paridad |

### Recomendaciones pendientes — Schedule
1. Recordatorios automáticos antes de una sesión con RSVP pendiente (TeamSnap los tiene; U Schedule no) — mejora menor, no bloqueante.
2. Duplicación de código en `Schedule.tsx`: la lógica de "mostrar título/hora de una sesión" está repetida en ~9 sitios del archivo — fuente de varios bugs de esta sesión (arreglar un sitio dejaba otro casi idéntico roto). Evaluar extraer un componente `SessionSummary`/`SessionCard` compartido (con cuidado, archivo de 3000+ líneas, ya muy tocado).

---

## 2. U Wellness — comparativa

### Lo que ya funciona bien (verificado en producción)
- Escala 1–5 con anclas verbales claras en cada extremo ("muy mal / excelente") — coincide con la buena práctica documentada (SimpliFaster: usar anclas verbales claras para que el atleta entienda qué significa cada puntuación).
- Corrección aplicada de la inversión de la escala de dolor muscular.
- Vista de staff con "Missing today" / "Highest risk" / alertas.
- Zona horaria corregida en 8 sitios (`todayKey()` y afines usaban el reloj del dispositivo en vez de Asia/Shanghai; añadida `dateKeyNDaysAgo()` reutilizable).
- **Línea base individual — implementada esta misma ronda.** El score de riesgo por jugadora ya no usa solo un umbral absoluto (≤2/5 igual para todas): ahora compara contra la media personal de sus últimos 30 días (mínimo 5 registros para que el baseline sea fiable). Se unificaron dos implementaciones duplicadas del score en una sola función compartida. Confirmado con una prueba real: una entrada con score 40 se mostró correctamente en rojo.
- **Gráfico de tendencia — YA EXISTÍA, corrección a la versión anterior de este documento.** La vista de staff de Wellness tiene un gráfico de tendencia 7d/30d por jugadora y por equipo, no solo el snapshot del día. No apareció en la primera revisión por falta de datos históricos de prueba suficientes en las cuentas QA, no porque faltara construirlo.

### Comparativa con literatura y apps especializadas (CoachMePlus, SimpliFaster, Svexa, Fractall)
| Práctica recomendada por la industria | U Wellness hoy | Estado |
|---|---|---|
| Comparar cada atleta contra su propia línea base (no la media del equipo) | Implementado: media personal de 30 días, mínimo 5 registros | **Paridad alcanzada** |
| Vista de tendencia (varias semanas), no solo el día de hoy | Gráfico 7d/30d por jugadora y equipo | **Paridad alcanzada** |
| Dashboard de excepción ("quién no ha rellenado, quién está en rojo") como primera pantalla del día | Missing today / Highest risk | Paridad |
| Escala corta y de baja fricción | 4 preguntas, escala 1-5 | Paridad |
| Semáforo simple (verde/ámbar/rojo) visible de un vistazo | Colores por barra individual; semáforo agregado por jugadora en la lista de staff sin confirmar | Pendiente de revisar si ya existe como agregado o solo por barra |

### Recomendaciones pendientes — Wellness
1. Confirmar si falta o no un semáforo *agregado* (un solo color por jugadora en la lista de staff, no solo por barra individual) — bajo esfuerzo si falta.

---

## 3. Historial de correcciones a este documento

- **2026-09-08 (versión original, no guardada en el repo):** primera pasada, basada en pantallas con datos de prueba limitados. Marcaba como "gap" el RSVP explícito por sesión y el gráfico de tendencia de Wellness — **ambos incorrectos**, ya existían en el código.
- **2026-09-09:** corregidos ambos puntos tras revisar el código real (`Schedule.tsx`, `schedule_participants`, vista de staff de Wellness). Añadida la línea base individual del score de riesgo, implementada y verificada en esta misma ronda. Documento recreado en `ucore/docs/` ya que el original solo existía como archivo de salida de un chat, nunca llegó al repo.
