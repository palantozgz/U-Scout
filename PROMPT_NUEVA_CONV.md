# Prompt — Nueva conversación Claude / Cowork

## Contexto del proyecto
Estamos construyendo **U Core**, una app de gestión deportiva (basketball) con React + TypeScript + Vite + Tailwind v4 + Capacitor 8.x (iOS + Mac Catalyst). El CLAUDE.md en la raíz del proyecto tiene TODO el contexto técnico actualizado. Léelo primero antes de hacer nada.

## Trabajo de hoy — prioridad decidida

### 1. Stats module (alta prioridad)
El módulo Stats (`/stats`) es actualmente un placeholder vacío. Hay que implementarlo.

Antes de escribir código, necesito que:
- Leas `client/src/pages/core/Home.tsx` para ver cómo están estructuradas las páginas activas
- Leas `client/src/lib/club-api.ts` para ver qué endpoints existen en el backend
- Leas `client/src/lib/wellness.ts` y `client/src/lib/schedule.ts` para entender los datos disponibles
- Leas la página placeholder actual de Stats (búscala en `client/src/pages/`)

Luego propones el diseño MVP antes de implementar. El módulo debe mostrar:
- KPIs de temporada por jugador (asistencia a entrenamientos, wellness promedio)
- Filtros por período (semana / mes / temporada)
- Layout compatible con las reglas de scroll del CLAUDE.md (h-[100dvh] + overflow-y-auto en main)
- Tipografía desktop mínimo `md:text-sm` en todos los labels

### 2. Si Stats queda pendiente de datos de backend
Si el backend no expone los endpoints necesarios para Stats, cambia a:
- **Desktop content density en CoachHome** — Las 3 NavCards (My Scout, Film Room, Game Plan) deben mostrar info contextual: contador de items pendientes de cada sección, último acceso. Lee `client/src/pages/scout/CoachHome.tsx` y los hooks relevantes.

## Reglas de trabajo
- Lee CLAUDE.md completo al inicio de la sesión
- No rompas las reglas de scroll (h-[100dvh] + overflow-y-auto min-h-0)
- Tipografía desktop: mínimo `md:text-sm` (14px) — nunca dejes labels a 8-11px en desktop
- Cuando termines cambios: dar el comando git completo para que yo lo ejecute
- Actualiza CLAUDE.md al final de la sesión con los cambios aplicados y nuevos pendientes
