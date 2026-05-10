# U Core — Contexto del proyecto para Claude

## Stack
- React + TypeScript + Vite
- Tailwind v4 (`@theme inline` en `client/src/index.css`, sin `tailwind.config.js`)
- shadcn/ui, wouter (routing), TanStack Query
- Capacitor 8.x (iOS + Mac Catalyst)
- Backend: Express + Drizzle ORM + PostgreSQL (Railway)

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

## Arquitectura de layout (IMPORTANTE)

### Regla de scroll
Todas las páginas con `ModuleNav` deben usar:
```tsx
// Outer div
<div className="flex flex-col h-[100dvh] bg-background ...">
// Main
<main className="flex-1 overflow-y-auto min-h-0 ...">
```
**NO usar** `min-h-[100dvh]` ni `md:overflow-y-auto` — eso activa scroll en App.tsx en lugar de dentro de la página.

Páginas sin ModuleNav (Login, Join, JoinClub, OnboardingFlow): pueden usar `min-h-[100dvh]` — correcto.

### App.tsx wrapper (desktop sidebar)
```tsx
// línea ~369 en App.tsx
<div className="... md:pl-16 lg:pl-56 ...">
```
El sidebar (ModuleNav desktop) es `fixed left-0`, ocupa `w-16` (md) / `w-56` (lg). El contenido se desplaza via `pl-*` en el wrapper.

### ModuleNav mobile
`fixed bottom-0`, altura 56px. Las páginas deben tener suficiente `pb-*` para no quedar ocultas detrás:
- `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` → estándar ModulePage shell
- `pb-16 md:pb-0` → en el outer div (CoachHome, PlayerTeamList, etc.)

### ModulePage shell (pages/core/ModulePage.tsx)
Shell compartido para módulos con panel lateral opcional en desktop:
```tsx
<ModulePageShell title="..." panel={<MyPanel />} panelLabel="DETAIL">
  {children}
</ModulePageShell>
```
Panel: `hidden md:flex w-80 lg:w-96` — solo desktop.

## Branding y naming
- Producto: **U Core** (antes "U Scout" — migración en curso)
- Módulo scout: **U Scout** (nombre del módulo dentro de U Core, OK usarlo internamente)
- `index.html`: title y meta description → "U Core"
- `Home.tsx` footer: "U CORE" ✓
- `favicon.svg`: bull horns mark blanco sobre fondo oscuro
- App icon Xcode: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` → bull horns 1024×1024

## Estado de módulos
| Módulo    | Estado         | Ruta                    |
|-----------|----------------|-------------------------|
| Home      | ✅ activo       | `/home`                 |
| Schedule  | ✅ activo       | `/schedule`             |
| Scout     | ✅ activo       | `/scout`, `/coach/*`    |
| Stats     | 🚧 placeholder  | `/stats`                |
| Playbook  | 🚧 placeholder  | `/playbook`             |
| Player UX | ✅ activo       | `/player/*`             |

## i18n
- Idiomas: `en`, `es`, `zh`
- Hook: `useLocale()` → `{ t, locale }`
- Archivos: `client/src/lib/i18n.ts` (inline) o `locales/*.json`
- Patrón para texto nuevo sin clave i18n:
  ```tsx
  locale === "zh" ? "中文" : locale === "es" ? "Español" : "English"
  ```

## Cambios aplicados (últimas sesiones)

### Layout mobile scroll fix (todas las páginas)
- `min-h-[100dvh] md:h-[100dvh]` → `h-[100dvh]` en todos los outer divs de páginas con ModuleNav
- `md:overflow-y-auto md:min-h-0` → `overflow-y-auto min-h-0` en todos los main
- Páginas corregidas: Home, CoachHome, Schedule, ModulePage, Playbook, FilmRoom, GamePlan, QuickScout, Personnel, MyScout, Settings, Dashboard (scout), PlayerHome, WellnessStandalone, Dashboard (player), ClubManagement, PlayerTeamList

### Desktop improvements (Home.tsx)
- KPI bar: `grid-cols-3` horizontal, valores `text-3xl md:text-4xl`, labels `md:text-[11px] md:tracking-wide`
- Greeting: `text-[28px] md:text-[42px]`
- Module grid: `md:grid-cols-4`, tarjetas `md:h-[180px]`
- Alert chips: `md:flex-none md:max-w-xs` (evita stretch a full-width)
- Footer: "U SCOUT" → "U CORE"
- MODULES label: `md:text-[11px]`

### Desktop improvements (otras páginas)
- CoachHome: eliminado `md:justify-center`, content ya no flota en centro
- Schedule panel: empty state con string trilingüe inline (i18n key no existía)
- ModulePage panelLabel: `md:text-xs`

### App icon
- Generado `U_Core_Icon_logo.png` (1024×1024): bull horns mark exacto de `favicon.svg`, fondo `#0d0d0d`, esquinas `rx=95`, sin colores adicionales
- Instalado en Xcode assets

## PENDIENTES — Próximas sesiones

### Alta prioridad
1. **Stats module** — Actualmente placeholder. Implementar: KPIs de temporada por jugador, filtros por equipo/período, gráficas de asistencia y wellness agregado.
2. **Desktop CoachHome — densidad** — Las 3 NavCards (My Scout, Film Room, Game Plan) en desktop podrían tener más info contextual (contador de pendientes, último acceso).
3. **Playbook** — Definir alcance MVP: ¿solo game plan viewer? ¿editor de jugadas? Ahora mismo es un placeholder vacío.

### Media prioridad
4. **Notificaciones** — No existe sistema de push/in-app. Definir cómo el head coach avisa al equipo (hoy depende de WhatsApp externo).
5. **Onboarding flow** — `OnboardingFlow.tsx` existe pero no está revisado para desktop. Revisar layout.
6. **PlayerEditor desktop** — `PlayerEditor.tsx` usa `min-h-[100dvh]` sin sidebar — es una página standalone, pero el layout no está optimizado para desktop.
7. **ClubManagement desktop** — Recién corregido el scroll. Revisar que el contenido (formularios largos) se vea bien en desktop.
8. **Xcode rebuild** — Después de cambios de icono + código: Product → Clean Build Folder → Build en Xcode.

### Baja prioridad / cosmético
9. **ModCard "SOON" badge** — `text-[8px]` en todos los viewports. Subir a `md:text-[10px]`.
10. **Alert chips sub-text** — El `sub` de HomeAlertChip es `text-[10px]` siempre. Subir a `md:text-xs` en desktop.
11. **Wellness en Home player** — El chip "✓ wellness enviado" podría mostrar los valores del día (sleep/energy) en lugar de solo confirmar envío.
12. **Film Room discrepancy UX** — Cuando hay conflictos, el flujo de resolución no es completamente claro para coaches nuevos.

### Técnico / deuda
13. **Comentarios internos `// Prefetch U Scout`** — Hay referencias a "U Scout" en comentarios de código (`Home.tsx` líneas 165, 169). No afecta UI pero deberían limpiarse.
14. **Git push pendiente** — Todos los cambios están en local. Hacer commit + push a main para Railway (web) y luego rebuild Xcode para Mac/iOS.
