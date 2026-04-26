# U Scout — Evaluador LLM Multi-Juez
> Script: scripts/eval-report-llm.ts (v2 — multi-juez, con ground truth)
> Actualizado: 25 abr 2026

---

## ARQUITECTURA DEL PANEL

```
Report generado por motor
        ↓
┌─────────────────────────────────────────┐
│ Juez 1: Claude Sonnet   (Anthropic API) │
│ Juez 2: GPT-4o mini     (OpenAI API)    │
│ Juez 3: Gemini Flash    (Google AI)     │
│ Juez 4: DeepSeek-V3     (DeepSeek API)  │
└─────────────────────────────────────────┘
        ↓
Agregación + detección discrepancias (Δ≥2.0)
        ↓
Score consenso + flag casos para revisión manual
        ↓
Pablo revisa solo los casos discrepantes
```

## ESTADO API KEYS

- ANTHROPIC_API_KEY: ❌ pendiente (requiere SMS móvil español)
- OPENAI_API_KEY:    ❌ pendiente (requiere SMS móvil español)
- GOOGLE_API_KEY:    ❌ pendiente (cuenta Google, sin SMS, gratis)
- DEEPSEEK_API_KEY:  ❌ pendiente (se puede con móvil chino — hacer primero)

Cuando tengas DeepSeek: probar con --judge deepseek --fast

---

## GROUND TRUTH INCORPORADO (en el prompt del juez)

Fuentes reales incluidas en el prompt:
- Basketball Immersion / Synergy Sports (fragmentos reales de reports)
- Coach's Clipboard (principios DENY/FORCE/HELP)
- PPP de referencia por situación (Synergy / Frontiers en Psicología)
- Clasificación Rondo/Wade/Korver como estándar de tiradores

---

## MEJORAS PENDIENTES DE IMPLEMENTAR

### PRIORIDAD ALTA

**1. Perfiles de casos límite (10-15 adicionales)**
Los perfiles actuales (llm001-llm010) son demasiado limpios.
Necesitamos perfiles que estresen el sistema:
- Inputs contradictorios: iso dirección L pero isoFinishLeft = pull_up
- Combinaciones raras reales: C con deepRange, PG con postFreq=P
- Inputs mínimos: entrenador que no conoce bien al rival
- Jugadoras WCBA con características específicas del baloncesto chino
- Jugadoras amateur con datos muy limitados

**2. Calibración de jueces (ancla de escala)**
Sin calibración, Claude puede dar 7.5 y GPT-4o 5.0 al mismo report
por diferencia de baremo por defecto, no por diferencia real de criterio.
Solución: incluir en el prompt 3 reports de referencia con scores esperados:
- Report malo (score esperado: ~4.0) — genérico, contradictorio
- Report medio (score esperado: ~6.5) — correcto pero impreciso
- Report bueno (score esperado: ~8.5) — específico, ejecutable, proporcional
Los jueces calibran su escala contra estos ejemplos antes de evaluar.
→ Implementar cuando tengamos las 4 keys para poder medir el impacto.

**3. Dimensión completitud_inputs (6ª dimensión)**
Los jueces evalúan el texto pero no si los inputs son suficientes.
Si el report es mediocre porque faltan campos en el PlayerEditor,
el juez lo penaliza como "motor" o "renderer" cuando es un problema de "input".
Nueva dimensión: completitud_inputs (0-10):
"¿Los inputs disponibles son suficientes para generar un report de calidad,
o faltan campos clave para describir mejor a este tipo de jugador?"
→ Si score < 7: especificar qué campo faltaría (ej: "falta zona de spot-up preferida")

### PRIORIDAD MEDIA

**4. Ciclo de mejora semi-automático**
Flujo actual: eval → leer resultados → ajustar motor/renderer a mano → repetir
Flujo ideal: fallos consensuados → script genera sugerencias de cambio → aprobar → re-eval
No trivial — implementar cuando el panel esté estable y validado.

**5. Generador de variaciones sintéticas**
Para llegar a 500+ perfiles sin escribirlos a mano:
Producto cartesiano filtrado de: hand × ath × usage × isoDir × spotUpEff × etc.
Con validación de coherencia basketball antes de incluir en el batch.
→ Implementar después de calibrar los 10 perfiles base.

### PRIORIDAD BAJA

**6. Evaluación de inputs upstream**
Antes del motor: verificar que lo que el entrenador introduce en PlayerEditor
es internamente coherente y completo para el rol del jugador.
Ej: si isoFreq=P pero isoDir=null → warning antes de generar report.

---

## FILOSOFÍA DE MEJORA

El objetivo no es solo mejorar motor o renderer.
Si los jueces detectan un problema, el origen puede ser:
- input: el PlayerEditor no recoge suficiente info o permite inputs incoherentes
- motor: la lógica de inferencia es incorrecta dado los inputs
- renderer: el texto es genérico o no refleja bien los outputs del motor
- concepto: el diseño del slide/informe no funciona para ese tipo de jugador

Todos son válidos para mejorar. No limitarse a motor y renderer.

---

## COMANDOS

```bash
# Probar con DeepSeek solo (cuando tengas la key)
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-report-llm.ts --judge deepseek --fast

# Panel completo 10 perfiles
npx tsx scripts/eval-report-llm.ts

# Panel completo modo rápido (5 perfiles)
npx tsx scripts/eval-report-llm.ts --fast

# Un perfil específico
npx tsx scripts/eval-report-llm.ts --profile llm001
```

## VARIABLES DE ENTORNO NECESARIAS (.env)
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...
```
