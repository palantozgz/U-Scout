# U Core — Contexto del proyecto para Claude

## Stack
- React + TypeScript + Vite
- Tailwind v4 (`@theme inline` en `client/src/index.css`, sin `tailwind.config.js`)
- shadcn/ui, wouter (routing), TanStack Query
- Capacitor 8.x (iOS + Mac Catalyst)
- Backend: Express + Drizzle ORM + PostgreSQL (Railway)
- Deploy: Railway auto-deploy en push a `main`

## Estructura de rutas clave
```
client/src/
  pages/
    core/          → Home, Schedule, ModulePage (shell), ModuleNav, Playbook, Scout.tsx (redirect)
    scout/         → CoachHome, MyScout, FilmRoom, GamePlan, Personnel, ClubManagement, PlayerEditor
    player/        → PlayerHome, PlayerTeamList, WellnessStandalone, Dashboard, PlayerHomeSettingsStub
  components/
    branding/      → ModuleHeader (logo animado por módulo), logos SVG
  lib/             → useAuth, capabilities, i18n, club-api, wellness, schedule, motor-v4
```

## Arquitectura de layout — REGLAS CRÍTICAS

### Regla de scroll (NUNCA romper esto)
Todas las páginas con `ModuleNav` deben usar:
```tsx
// Outer div — altura fija, NO min-h
<div className="flex flex-col h-[100dvh] bg-background ...">
// Main — scroll interno
<main className="flex-1 overflow-y-auto min-h-0 ...">
```
**PROHIBIDO usar:** `min-h-[100dvh]` ni `md:overflow-y-auto` en páginas con ModuleNav.
Motivo: `min-h` + safe-area padding en App.tsx hace que el wrapper supere 100dvh y active scroll en el wrapper en lugar de dentro de la página.

Páginas sin ModuleNav (Login, Join, JoinClub, OnboardingFlow): pueden usar `min-h-[100dvh]` — correcto.

### App.tsx wrapper (desktop sidebar)
```tsx
// línea ~459 en App.tsx
<div className="h-[100dvh] bg-background md:pl-12 lg:pl-48 relative overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ...">
```
- **`h-[100dvh]` (NO `min-h`)** — crítico para que el wrapper no scrollee
- **Sin `overflow-y-auto`** en el wrapper — el scroll va dentro de cada página
- Safe-area padding aquí, NO en las páginas individuales
- El sidebar (ModuleNav desktop) es `fixed left-0`, ocupa `w-16` (md) / `w-56` (lg)

### iOS WebView bounce (overscroll)
En `client/src/index.css`:
```css
html, body {
  background: hsl(var(--background));
  overscroll-behavior: none;
  overflow: hidden;
}
```
Esto elimina el rubber-band scroll de iOS que revelaba márgenes negros.

### ModuleNav mobile
`fixed bottom-0`, altura 56px. Padding requerido en páginas:
- `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` → estándar ModulePage shell
- `pb-16 md:pb-0` → outer div de páginas directas (CoachHome, PlayerTeamList, etc.)

### ModulePage shell (pages/core/ModulePage.tsx)
Shell compartido para módulos con panel lateral opcional en desktop:
```tsx
<ModulePageShell title="..." panel={<MyPanel />} panelLabel="DETAIL">
  {children}
</ModulePageShell>
```
Panel: `hidden md:flex w-80 lg:w-96` — solo desktop.

## Tipografía desktop — REGLAS

El breakpoint `md:` activa a ≥768px — confirmado que funciona en Mac Catalyst con ventana maximizada.

**Mínimo para labels en desktop:** `md:text-sm` (14px). NUNCA dejar labels a 8-11px en desktop.
- Labels pequeños mobile (`text-[8px]`, `text-[10px]`, `text-[11px]`) → añadir `md:text-xs` o `md:text-sm`
- Títulos y valores → `md:text-base` o mayor según contexto
- No usar `md:text-[11px]` — es insuficiente, el usuario lo verá igual de pequeño

Páginas ya corregidas: Home, CoachHome, MyScout, FilmRoom, GamePlan.

## Branding y naming
- Producto: **U Core** (antes "U Scout" — migración completada en UI)
- Módulo scout: **U Scout** (nombre del módulo dentro de U Core — OK internamente)
- `index.html`: title y meta description → "U Core" ✓
- `Home.tsx` footer: "U CORE" ✓
- `favicon.svg`: bull horns mark blanco sobre fondo oscuro (`client/public/favicon.svg`)
- App icon Xcode: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
  - 1024×1024 PNG, fondo #0d0d0d sólido (sin rx — iOS aplica su propia máscara de esquinas)
  - viewBox "262 169 500 500" sobre el SVG original 1024×1024
  - El mark bull horns cubre ~90% del ancho del icono
  - El logo es intrínsecamente más ancho que alto (ratio 2:1), espacio vertical es inevitable

## Estado de módulos
| Módulo    | Estado         | Ruta                    |
|-----------|----------------|-------------------------|
| Home      | ✅ activo       | `/home`                 |
| Schedule  | ✅ activo       | `/schedule`             |
| Scout     | ✅ activo       | `/scout`, `/coach/*`    |
| Stats     | ✅ activo       | `/stats`                |
| Playbook  | ✅ activo       | `/playbook`             |
| Player UX | ✅ activo       | `/player/*`             |

## i18n
- Idiomas: `en`, `es`, `zh`
- Hook: `useLocale()` → `{ t, locale }`
- Archivos: `client/src/lib/i18n.ts` (inline)
- Patrón para texto nuevo sin clave i18n:
  ```tsx
  locale === "zh" ? "中文" : locale === "es" ? "Español" : "English"
  ```

## Consulta de conversaciones anteriores del proyecto (todos los agentes: Director, El Arquitecto, El Aparejador)

Claude Code **no tiene acceso** a las conversaciones anteriores del proyecto en claude.ai/Claude Desktop — esa búsqueda (`conversation_search`) solo existe ahí, no aquí. Es una limitación real, no un descuido: en la sesión del 2026-09-10/11 se rediseñó sin querer un sistema (discrepancias entre entrenadores) que ya estaba diseñado con más detalle en conversaciones de abril, porque no se buscó ahí antes.

**Regla:** si vas a proponer o construir algo que "suena a que ya se pensó antes" — nombres de features ya establecidos (v2, v3, motor, discrepancias, aprobación, slides, arquetipos, etc.), decisiones de producto no triviales, o cualquier cosa donde te sorprendas pensando "esto seguramente ya se decidió de alguna forma" — **no lo diseñes desde cero**. En vez de eso:

1. Para el trabajo ahí y escribe 1-3 preguntas de búsqueda concretas y específicas (pocas palabras, términos que probablemente aparecieron literalmente en la conversación original — no "discrepancias" a secas, mejor "sistema discrepancias entrenadores versiones aprobadas").
2. Preséntaselas a Pablo así, literal: **"Antes de seguir, necesito que revises esto en Claude Desktop (proyecto U Core) y me pegues el resultado: [pregunta 1] / [pregunta 2]"**.
3. Pablo las copia en una conversación de Claude Desktop dentro del proyecto, pega el resultado de vuelta aquí, y entonces sigues con eso incorporado.

No lo hagas para dudas triviales o de implementación mecánica (eso ralentiza sin necesidad) — solo para decisiones de producto/arquitectura con riesgo real de que ya existan y las estés reinventando o contradiciendo.

## Cambios aplicados (todas las sesiones)

### App.tsx — mobile scroll fix
- Wrapper: `min-h-[100dvh] overflow-y-auto` → `h-[100dvh] overflow-hidden`
- Safe-area padding se mantiene en el wrapper (no en páginas individuales)

### index.css — iOS bounce fix
- Añadido `overscroll-behavior: none; overflow: hidden` en `html, body`
- `background: hsl(var(--background))` para evitar flash en notch/home bar

### Layout scroll fix (todas las páginas con ModuleNav)
- Outer div: `min-h-[100dvh]` → `h-[100dvh]`
- Main: añadido `overflow-y-auto min-h-0`
- Páginas corregidas (verificado real por auditoría 2026-09-14, no solo listado aquí de nombre — esta lista original tenía `ModulePage`/`Playbook` como "ya corregidas" cuando en realidad seguían con `h-screen`, corregido hoy): Home, CoachHome, Schedule, ModulePage, Playbook, FilmRoom, GamePlan, QuickScout, Personnel, MyScout, Settings, Dashboard (scout, código muerto — ver más abajo), PlayerHome, WellnessStandalone, Dashboard (player), ClubManagement, PlayerTeamList, PlayerHomeSettingsStub, Stats

### Auditoría UI/UX iOS + desktop, entrenador y jugadora (2026-09-14, spec sección 34)
- `Dashboard.tsx` (jugadora, `/player/team/:teamId`) tenía un hallazgo **crítico** real: sin `overflow-y-auto`/`min-h-0` en absoluto — con roster largo, tarjetas por debajo del pliegue quedaban inalcanzables, no solo difíciles de alcanzar. Corregido.
- `h-screen` → `h-[100dvh]` en `ModulePage.tsx`, `CoachHome.tsx`, `HomeDesktop.tsx`, `HomeMobile.tsx`, `Playbook.tsx` (x2) — estas 5 pantallas nunca habían pasado por el fix real pese a estar listadas arriba como corregidas.
- `PlayerHomeSettingsStub.tsx`: mismo patrón crítico que `Dashboard.tsx` (sin scroll real), corregido — no estaba en la lista de excepciones "páginas sin ModuleNav", es una subpágina real alcanzable desde el icono de ajustes.
- Safe-area inconsistente: 10 pantallas usaban `pb-16 md:pb-0` (64px fijo) sin sumar `env(safe-area-inset-bottom)` — el nav mobile sí lo hace (`ModuleNav.tsx`), pero el hueco que cada página reserva no coincidía. Estandarizado a `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0` en las 10.
- Tipografía: barrido de ~205 instancias de `text-[8-11px]` sin variante `md:` en Personnel, ClubManagement, PlayerEditor, Stats, GamePlan, QuickScout, WellnessStandalone, PlayerHome, PlayerTeamList, Dashboard, Settings. 2 excepciones dejadas a propósito (documentadas en el código): una etiqueta SVG dentro de un diagrama pequeño (`PlayerEditor.tsx`, el gráfico de zonas de poste) y un caso en `Stats.tsx` que ya resolvía desktop vía una variable JS `isDesktop`, no vía `md:`.
- `ModuleHeader.tsx`: botón de ajustes ampliado a ~44pt de objetivo táctil (antes ~36px).
- `ModuleNav.tsx`: el rol del sidebar desktop (`hidden lg:block`, nunca se ve en mobile) tenía `text-[10px]` fijo — subido a `text-xs` directamente (no tenía sentido un `md:`, ya es contenido solo-desktop).

### Tipografía desktop (md:text-sm mínimo)
- Home.tsx: todos los labels pequeños → `md:text-sm` o `md:text-xs`
- CoachHome.tsx: AlertSlot, NavCard, separadores → `md:text-sm`
- MyScout.tsx, FilmRoom.tsx, GamePlan.tsx: labels micro → `md:text-sm`/`md:text-xs`

### Home.tsx layout desktop
- KPI bar: `grid-cols-3` horizontal, valores `text-3xl md:text-4xl`
- Greeting: `text-[28px] md:text-[42px]`
- Module grid: `md:grid-cols-4`, tarjetas `md:h-[180px]` (fijo, no flex-1)
- Alert chips: `md:flex-none md:max-w-xs` (evita stretch full-width en flex-wrap)
- Footer: "U CORE" ✓

### App icon (v3 — instalado)
- Generado con cairosvg desde `favicon.svg`
- viewBox tightened a "262 169 500 500" → mark ocupa 90.4% del ancho
- Fondo #0d0d0d sólido, sin rx/transparencia en esquinas
- Instalado en `AppIcon.appiconset/AppIcon-512@2x.png`
- Para ver el cambio: eliminar app del dispositivo, Clean Build Folder, rebuild

### Branding cleanup
- `index.html`: "U Scout" → "U Core" en title y meta
- `Home.tsx` footer: "U SCOUT" → "U CORE"
- Comentarios internos con "U Scout" pendientes de limpiar (cosmético)

## PENDIENTES — Próximas sesiones

### Alta prioridad
1. ~~**Stats module**~~ — **CORREGIDO 2026-09-14**: NO es un placeholder, son 4761 líneas en producción (fichas, roster, eficiencia, comparador radar, bubble chart, game log). Este pendiente estaba obsoleto, descubierto por la auditoría de la sección 34. Existe un `Stats.tsx.bak` (907 líneas) que es probablemente el placeholder real que se sustituyó sin actualizar esta documentación — candidato a limpieza de arqueología, no investigado a fondo.
2. ~~**Playbook**~~ — **CORREGIDO 2026-09-14**: NO es un placeholder, son 1494 líneas en producción (hub de 4 secciones, wizard de sistema defensivo, lector de planes, vista jugadora). Mismo caso que Stats — pendiente obsoleto.
3. **Desktop content density** — Sigue vigente, pero más acotado de lo que decía este pendiente: `Home.tsx` (vía `HomeDesktop.tsx`) ya tiene layout de 2 columnas real, no es un hueco. Sigue abierto solo para `Schedule.tsx` en modo `staffView === "planner"` (el panel lateral se apaga a propósito ahí y queda una columna centrada con margen lateral vacío).

### Media prioridad
4. ~~**CoachHome desktop — densidad**~~ — **CORREGIDO** (ya antes de la auditoría del 2026-09-14, sin fecha exacta): las 3 `AlertSlot` de `CoachHome.tsx` (líneas 271-290) ya muestran próximo partido, contador de pendientes y conflictos.
5. **Notificaciones** — No existe sistema push/in-app. El coach avisa hoy por WhatsApp externo.
6. **Onboarding flow** — `OnboardingFlow.tsx` no revisado para desktop.
7. **PlayerEditor desktop** — **Acotado 2026-09-14**: confirmado que NO es una columna estrecha desperdiciando espacio lateral (el `main`/`Tabs` no tiene `max-w-*`, es ancho completo) — el problema real es lo contrario: los `grid grid-cols-2` de cada una de las 9 secciones se estiran al ancho total de una pantalla de 27", dando campos de formulario desproporcionados. Dos soluciones legítimas sin decidir: limitar el ancho (`max-w-3xl`/`max-w-4xl` centrado, cambio simple) o rediseñar a sidebar de navegación de secciones + panel de contenido (cambio de arquitectura). Decisión de Pablo pendiente.
8. **ModuleHeader en desktop** — **Acotado 2026-09-14**: el objetivo táctil del botón de ajustes ya se corrigió (44pt). Sigue sin decidir el problema de fondo: el logo *crece* de 56px a 88px en desktop (más espacio, no menos) mientras wordmark/tagline se quedan fijos en 10-11px vía `style={{fontSize}}` inline (no son clases Tailwind, invisibles a cualquier grep de `text-[`). Decisión de Pablo pendiente: comprimir el header en desktop (`md:hidden` parcial o versión horizontal) para liberar esas filas a contenido real.
9. **`ScoutDesktop.tsx` — código muerto descubierto 2026-09-14**: cero importadores reales en toda la app desde el commit `b09c640` (2026-05-21, Pablo Muñoz), que sustituyó esta vista de 2 columnas (lista + preview) por `CoachHome.tsx` como pantalla real de `/scout` en desktop. Pese a eso, las secciones 28/30/32 de esta spec (2026-09-14, mucho después) invirtieron trabajo real migrando `ScoutDesktop.tsx::ReportPreview` a motor-v1 sin que nadie notara que el archivo no se renderiza para ningún usuario. Decisión de Pablo pendiente: ¿revivir esa vista como la experiencia desktop real de `/scout` (hoy es literalmente el mismo `CoachHome` que en mobile), o borrarla del todo para no seguir invirtiendo en código fantasma?

### Baja prioridad / cosmético
9. **ModCard "SOON" badge** — `text-[8px]` → `md:text-[10px]`
10. **Alert chips sub-text** — `text-[10px]` → `md:text-xs`
11. **Wellness Home player** — Chip "✓ enviado" podría mostrar valores del día (sleep/energy).
12. **Film Room discrepancy UX** — Flujo de resolución de conflictos poco claro para coaches nuevos.
13. **Comentarios "// Prefetch U Scout"** — `Home.tsx` líneas 165, 169. Cosmético.

### Técnico
14. **Icono Xcode** — Después de cada cambio de icono: eliminar app del dispositivo + Clean Build Folder + rebuild. El caché de iconos en iOS es agresivo.
15. ~~**Verificar tipografía en pages restantes**~~ — **CORREGIDO 2026-09-14** (auditoría sección 34): Personnel, PlayerHome, Dashboard (player), WellnessStandalone, y de paso ClubManagement, PlayerEditor, Stats, GamePlan, QuickScout, PlayerTeamList, Settings — ~205 instancias en total.
