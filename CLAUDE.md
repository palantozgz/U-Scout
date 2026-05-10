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
// línea ~369 en App.tsx
<div className="h-[100dvh] bg-background md:pl-16 lg:pl-56 relative overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ...">
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
| Stats     | 🚧 placeholder  | `/stats`                |
| Playbook  | 🚧 placeholder  | `/playbook`             |
| Player UX | ✅ activo       | `/player/*`             |

## i18n
- Idiomas: `en`, `es`, `zh`
- Hook: `useLocale()` → `{ t, locale }`
- Archivos: `client/src/lib/i18n.ts` (inline)
- Patrón para texto nuevo sin clave i18n:
  ```tsx
  locale === "zh" ? "中文" : locale === "es" ? "Español" : "English"
  ```

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
- Páginas corregidas: Home, CoachHome, Schedule, ModulePage, Playbook, FilmRoom, GamePlan, QuickScout, Personnel, MyScout, Settings, Dashboard (scout), PlayerHome, WellnessStandalone, Dashboard (player), ClubManagement, PlayerTeamList

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
1. **Stats module** — Placeholder vacío. Implementar: KPIs de temporada por jugador, filtros por equipo/período, gráficas de asistencia y wellness. Requiere definir qué datos expone el backend.
2. **Playbook** — Placeholder vacío. Definir alcance MVP: ¿solo game plan viewer? ¿editor de jugadas?
3. **Desktop content density** — Las páginas (Home, Scout, Schedule) tienen mucho espacio negro vacío en desktop. Problema de contenido/producto, no de CSS. Necesitan más info contextual real.

### Media prioridad
4. **CoachHome desktop — densidad** — Las 3 NavCards (My Scout, Film Room, Game Plan) podrían mostrar: contador de pendientes, último acceso, estado rápido.
5. **Notificaciones** — No existe sistema push/in-app. El coach avisa hoy por WhatsApp externo.
6. **Onboarding flow** — `OnboardingFlow.tsx` no revisado para desktop.
7. **PlayerEditor desktop** — `PlayerEditor.tsx` standalone, sin optimización desktop.
8. **ModuleHeader en desktop** — Ocupa ~120px por página (logo + título). Considerar `md:hidden` o versión compacta.

### Baja prioridad / cosmético
9. **ModCard "SOON" badge** — `text-[8px]` → `md:text-[10px]`
10. **Alert chips sub-text** — `text-[10px]` → `md:text-xs`
11. **Wellness Home player** — Chip "✓ enviado" podría mostrar valores del día (sleep/energy).
12. **Film Room discrepancy UX** — Flujo de resolución de conflictos poco claro para coaches nuevos.
13. **Comentarios "// Prefetch U Scout"** — `Home.tsx` líneas 165, 169. Cosmético.

### Técnico
14. **Icono Xcode** — Después de cada cambio de icono: eliminar app del dispositivo + Clean Build Folder + rebuild. El caché de iconos en iOS es agresivo.
15. **Verificar tipografía en pages restantes** — Personnel, PlayerHome, Dashboard (player), WellnessStandalone — pueden tener labels pequeños sin corregir.
