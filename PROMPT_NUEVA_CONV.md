# Prompt — Nueva sesión Claude / U Core

## Ritual de inicio (OBLIGATORIO)
Lee `/Users/palant/Downloads/U scout/ucore/CLAUDE_CONTEXT.md` completo antes de cualquier acción.

---

## Estado al inicio de esta sesión
- ✅ Franja blanca home indicator: RESUELTA (ThemePlugin + body::after)
- ✅ App icon iOS: logo al 85% del canvas, verificado
- ✅ U Stats backend Fase 1: completo
- ✅ Schedule día correcto (UTC→local fix)
- ✅ Planner scroll bug: resuelto

---

## Prioridades (en orden)

### 1. Bug Settings.tsx — scroll bloqueado (rápido)
Settings no permite hacer scroll hasta el final en móvil — el botón de logout es inaccesible.
Leer Settings.tsx, identificar el contenedor de scroll y corregir el `pb` o `overflow`.

### 2. Desktop UI/UX — ALTA PRIORIDAD
El layout desktop está en mal estado en todos los módulos. Atacar en orden:

**2A — Home.tsx desktop**
- 2 columnas en lg+: contenido izquierda, sidebar KPIs + próximo partido derecha
- Grid módulos que aprovecha el espacio real del desktop

**2B — Stats.tsx desktop**
- Panel lateral en lg+: standings izquierda, líderes + PlayerSheet derecha
- Archivo grande → prompt Cursor

**2C — Schedule.tsx desktop**
- Split view horizontal: lista sesiones izquierda, detalle sesión derecha
- God file 228KB → prompt Cursor con contexto muy específico

### 3. U Stats — Fase 2 UI
Backend completo. Falta la UI con métricas avanzadas:
- TeamSheet: Cuatro Factores (eFG%, TOV%, FT Rate, ORB%, Pace) con semáforo vs liga
- PlayerSheet: PIE, TS%, eFG%, AST/TOV, Usage, home/away split
- Bubble chart: FGA/g vs TS% (Recharts, sin backend nuevo)
- Comparador: radar superpuesto 3 jugadoras
- StatsRadar: calibrar AXIS_MAX con percentiles reales (endpoint `/api/stats/player-percentiles` ya activo)

### 4. U Stats — Fase 3 nuevas pantallas
- Dashboard coaching en `/stats` home
- Shot zones: rediseño SVG FIBA correcto

### 5. U Scout — mejoras
- OverridePanel: integrar al frontend
- ReportViewV4 → rediseño 3 slides (spec en CLAUDE_CONTEXT.md)
- Bundle optimization: lazy i18n + React.lazy (target <300KB para TestFlight)

### 6. U Playbook — implementación
Diseñar antes de implementar. Ver spec en CLAUDE_CONTEXT.md.

---

## Reglas de trabajo
- Leer archivos antes de proponer cambios. Siempre.
- Diagnosticar completamente antes de implementar. Sin prueba/error.
- filesystem:write_file / Filesystem:edit_file para cambios directos
- Prompt Cursor para archivos grandes (Schedule.tsx, Stats.tsx, routes.ts)
- npm run check → exit 0 → git commit → git push
