# Prompt para nueva sesión Claude — U Core

## LO PRIMERO QUE DEBES HACER

Lee estos dos archivos completos antes de cualquier otra cosa:

1. `/Users/palant/Downloads/U scout/ucore/CLAUDE_CONTEXT.md` — estado completo del proyecto
2. `/Users/palant/Downloads/U scout/ucore/CLAUDE.md` — reglas de arquitectura, scroll, tipografía

---

## EL PROYECTO

**U Core** — plataforma de operaciones de club de baloncesto profesional. Full-stack, un solo repo.

- **Stack**: React + TypeScript + Vite + Tailwind v4, Express, Drizzle ORM, TanStack Query, shadcn/ui, Capacitor 8.x
- **Deploy**: Railway auto-deploy desde `main` → `https://u-scout-production.up.railway.app`
- **App nativa**: Capacitor iOS + opción "Designed for iPad" en Xcode para Mac (no Mac Catalyst)
- **Repo**: `/Users/palant/Downloads/U scout/ucore/` ← trabajar SIEMPRE aquí
- **GitHub**: `https://github.com/palantozgz/U-Scout.git`
- **DB**: Supabase PostgreSQL. SQL destructivo SOLO en Supabase SQL Editor, NUNCA drizzle-kit push
- **NUNCA tocar**: `Profile.tsx`, `schema.ts`, `migrations/`

---

## HERRAMIENTAS Y WORKFLOW

- **Cursor** (Claude Sonnet): ejecuta edits de código. Usar para cualquier cambio en archivos
- **Claude**: arquitectura, diagnóstico, generación de prompts para Cursor, lectura de archivos via Filesystem MCP
- **Filesystem MCP**: leer archivos antes de cualquier diagnóstico. Nunca diagnóstico especulativo
- **bash_tool corre en Linux sandbox**: no puede acceder al filesystem Mac. Usar Filesystem MCP para leer/escribir

**Reglas de entrega de código (no negociables):**
- NUNCA dar instrucciones "añade estas líneas aquí" — siempre: archivo completo para copiar/pegar, O comando terminal con `cd` incluido, O prompt Cursor completo
- Nunca mezclar métodos — elegir el más eficiente
- Garantizar resultado antes de implementar — sin push de prueba/error
- Después de cada cambio: `npm run check` antes de continuar

**Cursor agent:**
- Preferir prompts únicos comprensivos sobre iteraciones pequeñas
- Especificar siempre ruta completa a `ucore/` en cada prompt de Cursor
- Después de que Cursor edite `routes.ts`: leer últimas 50-80 líneas para verificar duplicados

---

## ESTADO ACTUAL — DESKTOP UI (lo que pasó esta sesión)

### Contexto técnico confirmado
- `window.innerWidth` en Mac fullscreen = **1910px**
- La app "Designed for iPad" en Mac da viewport COMPLETO cuando la ventana está maximizada
- Todos los breakpoints Tailwind funcionan: `md:` (768px), `lg:` (1024px), `xl:` (1280px), `2xl:` (1536px)
- El viewport cambia dinámicamente al redimensionar la ventana — responsive CSS funciona correctamente
- **No hay problema de arquitectura**. El problema es solo CSS

### Qué existe ahora en el repo (estado tras revert b8b3241)
```
client/src/pages/core/
  Home.tsx          → router fino: usa useIsDesktop() → HomeMobile | HomeDesktop
  HomeDesktop.tsx   → implementación desktop Home (2 columnas, datos reales)
  HomeMobile.tsx    → implementación mobile Home
  ScoutDesktop.tsx  → implementación desktop Scout
  Schedule.tsx      → componente ÚNICO sin variante desktop (god file ~5000 líneas)
  Stats.tsx         → componente ÚNICO sin variante desktop (~1500 líneas)

client/src/lib/
  useIsDesktop.ts   → hook: window.matchMedia("(min-width: 768px)")
  useHomeData.ts    → hook con todos los datos de Home
```

### Qué NO hacer (aprendido esta sesión — crítico)
- ❌ NUNCA crear archivos `*Desktop.tsx` separados para Schedule o Stats
- ❌ NUNCA hacer wrapper con `useIsDesktop()` que reemplaza el componente entero
- ❌ NUNCA hacer rewrite de un componente completo para desktop
- ❌ Estos enfoques destruyen funcionalidad existente (formularios, botones, lógica)

### La única forma correcta para desktop en este proyecto
Edits quirúrgicos dentro del archivo existente: añadir clases `md:` / `lg:` / `xl:` a los elementos que tienen texto pequeño o layout mobile.

**Ejemplo correcto:**
```tsx
// Antes (solo mobile):
<p className="text-[10px] font-bold">Label</p>

// Después (responsive):
<p className="text-[10px] md:text-sm font-bold">Label</p>
```

**Ejemplo de layout correcto:**
```tsx
// Antes:
<div className="flex flex-col gap-4">

// Después (2 columnas en desktop):
<div className="flex flex-col md:grid md:grid-cols-2 gap-4">
```

Esto es exactamente lo que funcionó en sesiones anteriores para Home, CoachHome, MyScout, FilmRoom, GamePlan.

### Trabajo pendiente desktop
1. **Schedule.tsx** — texto micro sin escalar, sin aprovechamiento de 1910px. Necesita: `md:text-sm` en labels, layout horizontal para el planner en pantallas grandes
2. **Stats.tsx** — mismo problema. Necesita: `md:text-sm` en labels, standings + detalle en grid horizontal en desktop
3. **Páginas pendientes de verificar**: Personnel, PlayerHome, Dashboard (player), WellnessStandalone

### Cómo auditar qué necesita arreglo
```bash
# Buscar texto micro sin escalado md: en un archivo
grep -n 'text-\[' client/src/pages/core/Schedule.tsx | grep -v 'md:'
```

---

## REGLAS DE ARQUITECTURA (del CLAUDE.md — críticas)

### Scroll (NUNCA romper)
```tsx
// Outer div — altura fija
<div className="flex flex-col h-[100dvh] bg-background">
// Main — scroll interno
<main className="flex-1 overflow-y-auto min-h-0">
```
PROHIBIDO: `min-h-[100dvh]` ni `md:overflow-y-auto` en páginas con ModuleNav

### Tipografía desktop mínima
- Labels pequeños mobile (`text-[8px]`, `text-[10px]`, `text-[11px]`) → añadir `md:text-xs` o `md:text-sm`
- Títulos y valores → `md:text-base` o mayor
- NUNCA `md:text-[11px]` — insuficiente

### ModuleNav mobile padding
- `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` — páginas con ModulePage shell
- `pb-16 md:pb-0` — páginas directas (CoachHome, PlayerTeamList, etc.)

---

## ESTADO MÓDULOS

| Módulo | Estado | Ruta | Nota |
|--------|--------|------|------|
| Home | ✅ desktop implementado | `/home` | HomeDesktop.tsx existe |
| Schedule | ⚠️ solo mobile | `/schedule` | god file, solo edits quirúrgicos |
| Scout | ✅ parcial desktop | `/scout` | ScoutDesktop.tsx existe |
| Stats | ⚠️ solo mobile | `/stats` | solo edits quirúrgicos |
| Playbook | 🚧 placeholder | `/playbook` | — |
| Player UX | ✅ activo | `/player/*` | — |

---

## U STATS — ESTADO TÉCNICO

- Fase 0 (schema audit) ✅ completa
- Fase 1 (backend métricas avanzadas) ✅ completa: eFGPct, TOV%, FT Rate, ORB%, PIE, home/away splits; endpoints `/api/stats/league-averages` y `/api/stats/player-percentiles`; hooks `useLeagueAverages` y `usePlayerPercentiles`
- Fase 2 (UI TeamSheet + PlayerSheet con métricas) ⏳ pendiente
- Fase 3 (bubble chart, comparador, coaching dashboard) ⏳ pendiente
- Fase 4 (Pi hotspot data / shot coordinates) ⏳ bloqueada hasta que shot_x/shot_y tengan datos

---

## U SCOUT — ESTADO TÉCNICO

- ReportSlidesV1.tsx — pendiente implementación 3 slides
- OverridePanel — frontend pendiente de integración
- Motor v2.1 — deuda técnica: actualmente client-side, debe moverse server-side
- Approval flow spec aprobada: Edit → Propose → Staff debate → Approve → Publish

---

## RASPBERRY PI / WCBA

- SSH: `192.168.1.59`, Node 20 + PM2
- Chain API confirmado: `phasemenus → matchmenusschedule → matchschedules?teamId= → matchinfoscores`
- Crítico: `teamId=''` (string vacío) requerido — con otro valor el endpoint devuelve 500
- Telegram bot bloqueado por firewall China — requiere VPN

---

## CIERRE DE SESIÓN

Al final de cada sesión importante:
1. Generar texto actualizado para sección "Estado sesión" de `CLAUDE_CONTEXT.md`
2. Aplicar via Filesystem MCP directamente — no pedir a Pablo que edite manualmente
