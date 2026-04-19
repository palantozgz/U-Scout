# Prompt nueva conversación — U Scout

## Instrucción de inicio
Al inicio de esta sesión, lee el archivo `CLAUDE_CONTEXT.md` del repo antes de proponer nada:

```
Filesystem MCP → read file: /Users/palant/Downloads/U scout/CLAUDE_CONTEXT.md
```

---

## Contexto del proyecto
U Scout es una app de scouting defensivo individual para baloncesto. El defensor (jugador) lee el informe en su móvil antes del partido para preparar su matchup 1-on-1. Sin situaciones colectivas, sin coberturas de equipo — solo instrucciones individuales.

**Stack:** React+TypeScript+Vite, Express, Drizzle ORM, Supabase
**Repo:** `/Users/palant/Downloads/U scout`
**Producción:** https://u-scout-production.up.railway.app (Railway, auto-deploy push a main)
**NO tocar:** Profile.tsx, schema.ts, migrations/

---

## Estado del motor (referencia rápida)

El motor tiene dos capas:
- `motor-v2.1.ts` — lógica de inferencia, genera outputs con pesos
- `motor-v4.ts` — scoring layer, selecciona winner + alternativas

**Calibración actual: 100% (551 checks, 66 perfiles)**
```bash
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
```

El motor genera 3 instrucciones defensivas (DENY/FORCE/ALLOW) + alertas (AWARE, max 2).
El renderer (`reportTextRenderer.ts`) convierte los keys del motor en texto EN/ES/ZH.

---

## Tarea principal de esta sesión

### Rediseño de Slides 2 y 3 (ReportSlidesV1.tsx)

**Slide 2 — ¿Qué hará? (situaciones ofensivas)**
- Layout actual: lista de situaciones con label + score
- Objetivo: diseño descriptivo — cada situación tiene label + descripción corta + threat score visual (barra o número de 1-5)
- Top 3 situaciones primarias
- El entrenador puede ver runners-up con tap en ⋮ (ya funciona)
- Leer: `renderSituationDescription()` en `reportTextRenderer.ts` — ya genera el texto descriptivo

**Slide 3 — ¿Qué hago yo? (instrucción defensiva)**
- Layout actual: 3 cards (DENY/FORCE/ALLOW) + AWARE section
- Objetivo: cada card muestra:
  - Label (DENY/FORCE/ALLOW) + icono placeholder (círculo de color por categoría)
  - Instrucción principal en texto grande y legible
  - Tap en ⋮ → bottom sheet con runners-up (ya funciona)
- AWARE: max 2 alertas, trigger cue + texto corto
- Sin cambios en la lógica — solo UI

**Principios de diseño:**
- Mobile-first: el jugador lo lee en el vestuario antes del partido
- Texto grande y legible, sin ruido visual
- Colores por categoría: DENY=rojo, FORCE=azul, ALLOW=verde, AWARE=naranja
- No iconos finales — placeholders de color hasta que estén diseñados en Figma

### Constraint importante
Los iconos definitivos se diseñarán en Figma (referencias reales de acción defensiva, no SVG genérico). Por ahora usar círculos de color como placeholder. NO implementar iconos reales hasta tener el diseño de Figma aprobado.

---

## Contexto técnico para el rediseño

### Componente actual
`client/src/pages/coach/ReportSlidesV1.tsx`

Lo que ya funciona y no debe romperse:
- Swipe táctil entre slides + pips de navegación
- `coachMode`: prop que activa el menú ⋮ en cada línea
- Bottom sheet runners-up (situaciones + DENY/FORCE/ALLOW)
- `ReportViewV4.tsx` lo usa con `coachMode={true}` + barra de aprobación

Lo que debe mejorar:
- Slide 2: layout más descriptivo con threat scores
- Slide 3: instrucción más prominente, AWARE más clara

### Datos disponibles
```typescript
// Desde renderReport():
report.situations[].label        // "PnR ball-handler"
report.situations[].description  // "Uses the screen to read coverage. Preferred finish: Mid-range."
report.situations[].score        // 0.0–1.0
report.situations[].tier         // "primary" | "secondary" | "situational"

report.defense.deny.instruction  // "Deny the downhill PnR catch. Get over the screen..."
report.defense.force.instruction // "Force left — deny the mid-range pull-up..."
report.defense.allow.instruction // "Allow spot-up catches. No deep range..."

report.alerts[].text             // "Elite passer — head up before the trap closes."
report.alerts[].triggerCue       // "When you double — their head is already up..."
```

---

## Reglas de entrega (no negociables)

- **NUNCA** "añade estas líneas aquí" — siempre archivo completo o prompt Cursor
- `npm run check` después de cada cambio
- Para cambios multi-archivo: generar prompt Cursor completo
- Para cambios de un archivo: archivo completo para copy-paste
- Calibración motor debe mantenerse 100% en cada cambio

---

## Preguntas abiertas para esta sesión

1. ¿El threat score visual en slide 2 debe ser numérico (1-5) o barra de progreso?
2. ¿Las descripciones de situación en slide 2 van en texto completo o truncadas con "más"?
3. ¿El AWARE en slide 3 muestra el `triggerCue` directamente o solo en tap?

Decide según el principio: el defensor lee el informe una vez, 3 minutos antes del partido. La información crítica debe estar visible sin tap.
