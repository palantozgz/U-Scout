# Prompt de inicio de sesión — U Core

> Pega esto completo al inicio de cada nueva conversación con Claude.

---

Lee `/Users/palant/Downloads/U scout/CLAUDE_CONTEXT.md` antes de cualquier cosa y confirma que lo has leído con un resumen de una línea del estado actual.

Somos sesión p26 (o la siguiente que corresponda según el contexto).

---

## Cómo trabajamos

**Entrega de código — REGLA ABSOLUTA:**
- NUNCA texto para copiar/pegar manualmente. Pablo no edita archivos.
- Para archivos pequeños o cambios quirúrgicos: usa Edit/Write directamente.
- Para archivos grandes (Schedule.tsx ~228KB, Stats.tsx, routes.ts): da un prompt listo para pegar en el agente de Cursor.
- Para comandos de terminal: da el comando exacto, Pablo lo ejecuta.
- Después de cada cambio: `npm run check` para verificar TypeScript.

**Antes de trabajar:**
- Si la tarea tiene varios pasos o es ambigua, pregunta primero con AskUserQuestion. No empieces sin entender el objetivo.
- Lee el SKILL.md relevante si vas a crear .docx, .pptx, .pdf, .xlsx.
- Actualiza siempre CLAUDE_CONTEXT.md al cerrar sesión.

**Restricciones técnicas:**
- Tailwind v4: animaciones en `index.css`, NUNCA en tailwind.config (no existe).
- Migrations destructivas: raw SQL en Supabase, NUNCA drizzle-kit push.
- Pi: NUNCA compilar en Pi — build en Mac + scp dist/.
- bash_tool corre en Linux sandbox — NO accede al Mac directamente.
- Cursor duplica handlers en routes.ts — verificar siempre después de que Cursor edite ese archivo.
- `Profile.tsx`, `schema.ts`, `migrations/` — NUNCA tocar.

**Preferencias de Pablo:**
- Información veraz primero. Si algo no es posible o las expectativas son bajas, decirlo antes de empezar.
- Sin bullet points en respuestas conversacionales — prosa normal.
- Sin emojis salvo que los use él primero.

---

## Stack y repo

- Repo: `/Users/palant/Downloads/U scout`
- Prod: https://u-scout-production.up.railway.app (Railway, auto-deploy en push a main)
- DB: Supabase (PostgreSQL)
- Stack: React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4

---

## Estado actual (cerrado p25)

El logo U mark está finalizado con D=25 en todos los assets:
- Técnica: cuernos clip en y=427, conector scaleY=102/77 anclado en y=544, SCOUT sin transform
- Paleta módulos: Core #6B6B9A · Scout #3A81FE · Schedule #10B981 · Wellness #A78BFA · Stats #F59E0B · Playbook #EF4444
- Archivos actualizados: UScoutLogo.tsx (main+ucore), UScoutBrand.tsx (main+ucore), ModuleHeader.tsx, logo.svg, favicon.svg, logo-scout/core/schedule/wellness/playbook.svg (todos en client/public/ y ucore/client/public/)
- Responsive shell completo (App.tsx, ModuleNav.tsx, ModulePage.tsx, Home.tsx)

---

## Pendiente — por orden de prioridad

### 🔴 1. App icon iOS (Xcode) — tarea #10
Reemplazar el escudo genérico de Capacitor con el logo U Core.
- La imagen fuente es el símbolo U (sin texto SCOUT) — usar el SVG de favicon.svg como base pero con fondo blanco/oscuro.
- Xcode necesita un AppIcon.appiconset con PNGs en múltiples tamaños (1024×1024 master + los que genera Xcode).
- Pasos: generar PNG 1024×1024 del logo → sustituir en `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- Estado iOS: `ios/` generado, Xcode abierto, cuenta Apple Developer FREE (válido en dispositivo propio via USB 7 días).

### 🔴 2. Responsive fase 2 — archivos grandes (Cursor)
Base responsive implementada en p24. Faltan los módulos con contenido:
- **Schedule.tsx** (~228KB god file): split view horizontal en desktop — columna izquierda lista, columna derecha detalle.
- **Stats.tsx**: panel lateral fijo con filtros en desktop, charts ocupan el espacio restante.
- **Home.tsx**: grid más amplio en lg+ (3 o 4 columnas en lugar de 2×2).
- **Scout (MyScout.tsx, ReportViewV4.tsx)**: layout desktop con sidebar o paneles laterales.
- Todos estos requieren prompt para Cursor (archivos demasiado grandes para Edit directo).

### 🟡 3. U Stats — backlog visual (sesiones dedicadas)
- **Radar "hide radar"**: se ve feo, necesita fix visual urgente.
- **Shoot zones**: diagrama mal dibujado, colores no funcionan en theme-oldschool — rediseñar desde cero.
- **Tooltips stats**: click en cada stat → tooltip con definición + fórmula (todas las stats, incluso básicas).
- **Stats avanzadas de equipos**: faltan muchas métricas, definir lista en sesión dedicada.
- **Team slide**: click en equipo → slide con datos completos + botón Roster → scroll del roster.
- **Landscape**: no aporta nada en portrait — layout dedicado split view o landscape chart.
- StatsRadar: AXIS_MAX son estimaciones — verificar contra datos reales de Supabase.

### 🟡 4. U Scout — backlog features
- **PlayerEditor**: auditoría completa de campos — hay inputs obsoletos o mal mapeados.
- **ReportViewV4**: diseño 3 slides — actualmente placeholder, necesita diseño real.
- **ReportSlidesV1**: revisar con datos reales y ajustar layout.

### 🟡 5. Personnel — migración asistida
Sesión dedicada de diseño — flujo para importar/migrar plantillas entre temporadas o clubes.

### ⚪ 6. Bugs menores conocidos
- Jugadoras extranjeras con `-` en name_zh: `fix-player-names.js` las salta → `name_en null`.
- Schedule scroll List→Planner: NO tocar — intentado múltiples veces, comportamiento aceptable tal cual.

---

## TestFlight / distribución (cuando sea el momento)
- Pagar $99/año en developer.apple.com → cambiar Team en Xcode a la cuenta de pago → Archive → Distribute App → TestFlight
- appId actual: `com.ucore.app` (cambiar a `com.pablomgz.ucore` si conflicto)
- La app carga desde Railway — requiere internet (no hay bundle offline)

---

## Raspberry Pi — recordatorio workflow
```bash
cd "/Users/palant/Downloads/U scout/collector"
npm run build
scp -r dist/ pablo@192.168.1.59:~/ucore/collector/dist/
ssh pablo@192.168.1.59 "cd ~/ucore/collector && pm2 restart ucore-collector"
```
IP Pi: 192.168.1.59 — NUNCA compilar en Pi.
