# Prompt — Nueva sesión Claude / U Core

## Ritual de inicio (OBLIGATORIO)
Lee `/Users/palant/Downloads/U scout/ucore/CLAUDE_CONTEXT.md` completo antes de cualquier acción.

---

## Prioridades de esta sesión (ordenadas)

### 1. Verificar ThemePlugin iOS (5 min)
Confirmar con Pablo si la franja blanca inferior desapareció tras el build con ThemePlugin.
Si persiste → implementar ViewController.swift con constraints `view.bottomAnchor` (instrucciones en CLAUDE_CONTEXT.md sección "Franja blanca pendiente").

### 2. Desktop UI/UX — ALTA PRIORIDAD
El layout desktop está en mal estado. Atacar en este orden:

**2A — Home.tsx desktop**
- 2 columnas en lg+: contenido principal izquierda, sidebar KPIs + próximo partido derecha
- Grid módulos 2×2 que aprovecha el espacio real del desktop
- Leer archivo completo antes de proponer (usar filesystem:read_text_file con head/tail)

**2B — Stats.tsx desktop**
- Panel lateral en lg+: standings a la izquierda, líderes + PlayerSheet a la derecha
- Aprovechar el espacio horizontal que actualmente se desperdicia
- Archivo grande → prompt Cursor

**2C — Schedule.tsx desktop**
- Split view horizontal: lista sesiones izquierda, detalle sesión derecha
- God file ~228KB → prompt Cursor con contexto muy específico

### 3. U Stats — Fase 2 UI
Backend completo. Falta la UI con las métricas avanzadas:
- TeamSheet: Cuatro Factores (eFG%, TOV%, FT Rate, ORB%, Pace) con semáforo vs liga
- PlayerSheet: PIE, TS%, eFG%, AST/TOV, Usage, home/away split
- Bubble chart: FGA/g vs TS% con Recharts (datos ya en cache, sin backend nuevo)
- Comparador: radar superpuesto 3 jugadoras

### 4. U Stats — Fase 3 nuevas pantallas
- Dashboard coaching en `/stats` home: Próximo rival / L5 propio / Alerta liga
- StatsRadar calibración: percentiles reales ya en `/api/stats/player-percentiles`

### 5. U Scout — mejoras
- OverridePanel: integrar al frontend (backend `report_overrides` existe)
- ReportViewV4 → rediseño 3 slides (spec aprobada, ver CLAUDE_CONTEXT.md)
- hasReport fix (prompt preparado)
- Motor v2.1 mover a server-side

### 6. U Playbook — implementación
Ver spec en CLAUDE_CONTEXT.md. Empezar por el diseño antes de implementar.

### 7. Bundle optimization
Target <300KB gzip para TestFlight:
- Lazy i18n por locale (−120KB)
- React.lazy code splitting (−100KB)

---

## Contexto técnico clave para esta sesión
- Repo: `/Users/palant/Downloads/U scout/ucore/`
- ThemePlugin.swift: añadido al proyecto Xcode esta sesión
- Stats backend Fase 1: completado, todos los endpoints con métricas avanzadas activos
- Schedule día correcto: `localDateKey()` helper implementado (fix UTC→local)
- App icon: regenerado con logo al 85% del canvas

## NO hacer sin investigar primero
- No tocar `ViewController.swift` en Xcode sin leer el estado del storyboard primero
- No tocar `Schedule.tsx` sin leer chunks específicos primero (228KB)
- No hacer fixes de prueba/error — diagnosticar completamente antes de implementar
