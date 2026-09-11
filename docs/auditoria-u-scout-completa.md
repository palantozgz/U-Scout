# Auditoría completa — U Scout

> Estado del documento: **EN PROGRESO, arrancado desde cero** (no había auditoría previa de U Scout).
> Mismo criterio que `auditoria-u-stats-completa.md`: `[VERIFICADO]` = comprobado contra código real; `[PENDIENTE]` = hueco conocido, no relleno.

---

## 0. Corrección importante sobre el encargo — "motor v3" no existe en el código actual

**[VERIFICADO 2026-09-10]** El encargo original pide documentar el "motor v3 (motor de scouting individual defensivo)" como apartado propio. Busqué en todo el repo (`client/src`, `server`) cualquier archivo o referencia a `motor-v3` / `motorV3` / `MotorV3` / cualquier fichero con `v3` en el nombre dentro de `client/src`: **no existe nada con ese nombre**.

Lo que sí existe, verificado:
- `client/src/lib/motor-v2.1.ts` — **2.802 líneas**. El motor de reglas real (import `UScoutMotor`, tipo `EnrichedInputs`). Es, con diferencia, el archivo más grande de todo el módulo Scout.
- `client/src/lib/motor-v4.ts` — 543 líneas. **No es un motor independiente ni un reemplazo de v2.1**: en su línea 6 hace `import { UScoutMotor } from "./motor-v2.1"` y reexporta/envuelve tipos de v2.1 (línea 12). Es una capa de ranking/salida (`generateMotorV4`, tipo `RankedSituation`) construida **encima** de v2.1, no un motor nuevo desde cero.
- `client/src/lib/motor-v2.1-i18n.ts` — traducciones específicas del motor v2.1, usadas por `locales/es.ts`, `en.ts`, `zh.ts`.

**Conclusión:** no hay "v3" en el código. La memoria del proyecto tampoco lo menciona (habla de "Motor v4 con ftShooting/foulDrawing wired a isoDanger"). Trato el encargo de documentar "motor v3" como referido al **motor de scouting individual defensivo actual = v2.1 (núcleo de reglas) + v4 (capa de ranking/salida que consume v2.1)**, que es lo único que existe y coincide en función (defensivo, individual) con lo pedido. Si Pablo se refería a algo distinto (quizás una versión intermedia que se borró al pasar de v2 a v4, o un nombre usado solo en conversación), que lo indique y lo corrijo — no voy a inventar un v3 que no está en el repo.

### CORRECCIÓN (2026-09-11) — la conclusión de arriba estaba incompleta, no falsa

**[VERIFICADO por `conversation_search` sobre conversaciones anteriores del proyecto, no encontrado antes por no haber buscado ahí]** "Motor v3" **sí existe** — como diseño teórico completo hecho en sesiones de abril 2026, nunca implementado en código (por eso el `grep` de arriba, correcto en sí mismo, no lo encontró). El núcleo del diseño v3: **reglas de cruce entre situaciones**, algo que v2.1 no hace (calcula cada situación de forma independiente). El cruce más importante ya diseñado: distinguir entre dos perfiles que v2.1 trata igual —

- **"Star creator"** (isoFreq=P + pnrFreq=P + usage=primary): activa `selfCreation=high` → `force_early` como FORCE principal, máxima prioridad — busca tiro propio constantemente, hay que presionar desde el primer segundo.
- **"Specialist creator"** (isoFreq=S + pnrFreq=S + isoEff=high + usage=secondary): mismo patrón superficial de frecuencias altas en ISO/PnR, pero **NO** activa `force_early` — el peligro no es que controle el reloj, es que convierte cuando le llega el balón en posición favorable. La instrucción correcta aquí es "no le des ritmo"/"cierra antes de que reciba en su zona", no presión de reloj.

Esto viene de una validación directa de Pablo en esa sesión ("es principalmente correcto, especialmente si es jugador estrella, hay otros casos donde la eficiencia es alta pero la frecuencia media, significa que serán jugadores suplentes o especialistas"). **Motor 1.0 debería incorporar estas reglas de cruce ya diseñadas y nunca implementadas**, no reinventarlas ni tratarlas como si no existiera nada — es trabajo de diseño real que se quedó sin construir cuando el proyecto saltó de v2.1 a v4 en vez de a v3.

---

## 1. Producto y funcionalidades — inventario de páginas (arrancado)

**[VERIFICADO por `find` + lectura de nombres]** — estructura real en `client/src/pages/scout/` y `client/src/pages/core/`:

| Archivo | Líneas | Qué es (por nombre/contexto, sin abrir todavía cada uno) |
|---|---|---|
| `PlayerEditor.tsx` | 1.969 | Editor de ~48 campos por jugadora rival (según `u-scout-design-decisions.md` ya en memoria) |
| `ClubManagement.tsx` | 1.630 | Gestión del club/equipo dentro de Scout |
| `Personnel.tsx` | 1.197 | Probablemente roster/plantilla del rival |
| `ReportSlidesV1.tsx` | 815 | El formato de informe de 3 slides ya documentado en memoria (`u-scout-design-decisions.md`) |
| `QuickScout.tsx` | 703 | Vista rápida de scouting (modo "Quick") |
| `MyScout.tsx` | 585 | "My Scout" — mencionado en el encargo original |
| `Dashboard.tsx` | 480 | Panel principal de Scout |
| `CoachHome.tsx` | 350 | Home del entrenador dentro de Scout |
| `FilmRoom.tsx` | 342 | "Film Room" — mencionado en el encargo original |
| `ScoutDesktop.tsx` (en `pages/core/`) | 332 | Layout desktop específico de Scout |
| `OverridePanel.tsx` (en `components/scout/`) | 278 | Mencionado en memoria: "construido pero integración pendiente" |
| `Settings.tsx` | 244 | Ajustes del módulo |
| `GamePlan.tsx` | 242 | "Game Plan" — mencionado en el encargo original |
| `ReportViewV4.tsx` | 232 | Vista de informe — memoria dice "necesita rediseño a formato slides", aún scroll vertical |
| `InviteTeamDialog.tsx` | 146 | Diálogo de invitar equipo |
| `PlayerEditorStatsChip.tsx` (en `components/scout/`) | 86 | Chip de stats dentro del editor de jugadora |
| `Scout.tsx` (en `pages/core/`) | 44 | Probablemente el router/entry point del módulo, muy pequeño |

**`[PENDIENTE]`** — no abierto todavía ninguno de estos archivos en detalle: qué hace cada pantalla exactamente, cada botón, los tres modos (My Scout/Film Room/Game Plan) explicados uno a uno, tipos de informe, vistas rápidas vs. completas. Esto es solo el mapa de archivos, no el inventario funcional que pide el encargo.

---

## 2. Lógica de negocio y fórmulas del motor — arrancado

### Aviso metodológico importante, antes de nada

El motor de U Scout **no es del mismo tipo de sistema que U Stats**. U Stats calcula estadísticas objetivas (PPP, ORTG, eFG%) que tienen una fórmula estándar de industria publicada (Dean Oliver, BBRef, Synergy) contra la que comparar directamente. El motor de U Scout es un **sistema experto de reglas y pesos ponderados a mano** (scouting cualitativo del staff traducido a números), no una fórmula estadística derivada de datos. Para esto **no existe un "Dean Oliver" único** — la comparación correcta no es "¿coincide con la fórmula estándar de la industria?" (pregunta mal planteada aquí) sino: (a) ¿es internamente consistente?, (b) ¿los pesos están calibrados contra algo real cuando existe un dato real disponible?, (c) ¿el álgebra que combina los pesos es razonable? Lo marco así explícitamente para no forzar una comparación que no aplica y así falsear el rigor del documento.

### Arquitectura del motor — `class UScoutMotor` (línea 746)

**[VERIFICADO]** Estructura de métodos (todos en `motor-v2.1.ts`):
- `generateReport()` (754) — entrada pública.
- `applyClubContextModifiers()` (797) — pendiente de leer.
- `calculateThreatScores()` (871) — **la agregación final de amenaza por situación, ver abajo, verificado completo**.
- `applyInferences()` (914) + `matchesCondition()` (945) — motor de inferencia de campos no rellenados por el staff, basado en `INFERENCE_RULES` (reglas condicionales tipo `when {...} then {...}`), coincide con lo que dice la memoria del proyecto ("Motor inference over new inputs: prefer inferring from existing fields").
- `calculateOutputs()` (962-2384) — **~1.400 líneas, el núcleo real de la lógica situación por situación (ISO/PnR/Post/Transición/Spot-up/DHO/Cut/etc.). NO leído en detalle esta sesión — es, con diferencia, el bloque más grande y crítico pendiente.**
- `categorizeOutputs()` (2384), `selectTopOutputs()` (2418), `generateSlides()` (2531) y las funciones `generate*Slide()` que le siguen — construyen las 3 slides del informe (coincide con `ReportSlidesV1` ya documentado en memoria).

### `calculateThreatScores()` — verificado completo (líneas 871-914)

Esta es la función que decide, para cada "situación" ofensiva (iso, pnr, post, transición, spot-up, dho, cut, misc), qué tan amenazante es la jugadora rival, y de ahí sale el ranking que alimenta las slides 2 y 3 del informe (¿Qué hará? / ¿Qué hago yo?).

Algoritmo real, paso a paso:
1. Se filtran los `outputs` a solo los de `category === 'deny'` (recomendaciones de tipo "niega esto") con `weight > 0`.
2. Se detectan las "situaciones primarias" de la jugadora: cualquier situación (iso/pnr/post/transición/spot/dho/cut) cuya frecuencia declarada por el staff sea `'P'` (Principal). Si hay **2 o más** situaciones primarias (`manyPrimaries`), cualquier situación NO primaria ve su peso limitado a un máximo de **0,72** — es decir, el motor evita que una jugadora "todoterreno" (muchas amenazas primarias) infle artificialmente amenazas secundarias.
3. Por cada situación, se queda con el **peso máximo** (`maxWeight`) entre todos sus outputs — **no es una suma ni una media, es un máximo**. Esto es una decisión de diseño explícita: la amenaza de una situación la marca su punto más fuerte, no un promedio de todos sus outputs.
4. Se ordena de mayor a menor peso.

**Evaluación:** ✅ el algoritmo es internamente consistente y la regla del cap a 0,72 tiene lógica basketbolística clara (evitar que "hace de todo" se traduzca en "es máxima amenaza en todo"). `[PENDIENTE]` no hay forma de comparar esto contra un estándar externo porque no existe uno para este tipo de agregación — queda como evaluación de consistencia interna, no de fidelidad a fórmula publicada.

### `WEIGHTS` (líneas 429-628, ~200 líneas) — constantes verificadas parcialmente

Estructura confirmada (primeras ~40 líneas leídas):
- `frequencyToWeight`: P=1.0, S(secundaria)=0.7, R(rara)=0.3, N(nunca)=0.0.
- `efficiencyMultiplier`: alta=1.2, media=1.0, baja=0.8.
- `usageMultiplier`: primaria=1.0, secundaria=0.85, rol=0.6.
- `athMultiplier`/`physMultiplier`: escalas 1-5 → 0.6/0.75/0.9/1.0/1.1.
- `outputWeights.*`: peso base por tipo de situación (iso=0.85, pnr=0.9, post=0.85, transición=0.8, spotUp=0.75, dho=0.85, **cut=0.72**, oreb=0.7, floater=0.7) más bonificaciones específicas (ej. pnr: `+0.1` si es alero, `+0.05` si es ala-pívot; dho: `+0.15/+0.05/+0.20` según sea dadora/receptora/ambas).

**✅ Hallazgo positivo, verificado literalmente en el código (comentario en línea ~442):**
```
// Cut baseWeight increased from 0.6 to 0.72 — cuts are the most efficient action (1.58 PPP per Synergy data)
```
Esto es exactamente el mismo dato (CUT = 1,58 PPP en EuroLeague, el tipo de ataque más eficiente) que cita `FORMULAS_STATS.md` en su tabla de benchmarks EuroLeague, con la misma fuente (Synergy/ResearchGate 2022-24). **Es decir: al menos este peso concreto SÍ está calibrado contra un dato externo real, no puesto a ojo.** Es la única evidencia encontrada hasta ahora de calibración externa explícita — el resto de `baseWeight` (0.85, 0.9, 0.8, 0.75...) no tienen comentario de origen, `[PENDIENTE]` confirmar si están calibrados igual o son estimación del staff sin fuente citada.

### `calculateOutputs()` (962-2384, ~1.400 líneas) — mapa estructural verificado, contenido aún NO leído regla a regla

**[VERIFICADO]** La función se divide en 13 bloques marcados con separadores `// ===` en el propio código, cada uno generando los outputs de una situación — y coincide, bloque a bloque, con los campos del `PlayerEditor` (~48 campos) ya documentados en `u-scout-design-decisions.md`:

| Línea aprox. | Bloque |
|---|---|
| 977 | ISO outputs |
| 1082 | PnR Handler outputs |
| 1223 | Screener outputs |
| 1288 | Post outputs (v2.1 ENHANCED con `postEff`/`postMoves`) |
| 1557 | Transition outputs (v2.1 ENHANCED con `transRole`) |
| 1714 | Ball handling & pressure outputs (v2.1) |
| 1926 | Cut outputs (v2.1 — coment. "duck_in removed from cutType", indicio de que hubo un campo eliminado en algún momento, coherente con la limpieza de campos que documenta `u-scout-design-decisions.md`) |
| 1959 | Off-ball screens (indirects) — screener / cut actions |
| 2074 | Offensive rebounding |
| 2131 | Floater |
| 2157 | Force weak hand |
| 2311 | Aware outputs |

**✅ Segundo hallazgo de calibración externa, verificado literalmente (líneas ~1890-1891, dentro del bloque de ISO):**
```
// SCIENTIFIC BASIS: ISO is statistically one of the least efficient play types
// Secondary/role players with low ISO eff = very safe to allow — save defensive energy
```
Esto coincide con el hallazgo de `FORMULAS_STATS.md`: en EuroLeague 2022-24, ISO fue uno de los tipos de ataque menos eficientes (0,78-0,98 PPP, el rango más bajo de la tabla). Segunda evidencia real de que el motor **sí** incorpora literatura de eficiencia por tipo de acción donde importa — refuerza el hallazgo del peso de `cut` de la sección anterior. Con dos casos ya encontrados sin buscarlos explícitamente, es razonable sospechar que hay más comentarios de este tipo en los otros 11 bloques — `[PENDIENTE]` revisarlo bloque a bloque.

Otros comentarios de diseño encontrados de pasada (sin leer la lógica completa que los rodea): línea ~1121 "force_direction from PnR finish asymmetry", ~1152 "force_no_mid: cuando la manejadora de PnR prefiere finalizar en tiro medio por ambos lados — captura tiradoras que usan el PnR para crear tiros medios, no ataques al aro", ~1504 detección de "elbow ISO" (`postProfile==='FU' && isoFreq==='S'`), ~1880-1881 lógica para saltarse `allow_iso` si `orebThreat=high` o si la jugadora no hace ISO por diseño. Son indicios de que las reglas tienen razonamiento basketbolístico explícito detrás, no son arbitrarias — pero **no está verificado el detalle numérico de cada regla todavía**, solo su existencia y su comentario.

**Honestidad sobre el alcance real de lo hecho aquí:** esto es un mapa estructural + 2 hallazgos puntuales de calibración, NO una lectura línea a línea de las ~1.400 líneas. Dar una valoración ✅/⚠️/❌ bloque por bloque (como pide el encargo) requiere entrar en cada uno de los 13 bloques a leer las condiciones y pesos exactos — trabajo pendiente real, no hecho todavía.

### `OUTPUT_CATALOG` (líneas 628-746) — verificado completo

Catálogo de plantillas de texto para los 4 tipos de recomendación del motor: **deny** (29 entradas — qué negarle a la rival), **force** (11 — hacia dónde forzarla), **allow** (5 — qué se le puede permitir por baja amenaza), **aware** (27 — datos a tener en cuenta sin acción directa). Cada entrada tiene `key`, `i18nKey` (para traducción vía `locales/es|en|zh.ts`) y un `template` en inglés con placeholders (`{direction}`, `{shoulder}`, `{finish}`...).

**Dos hallazgos menores, verificados:**
- **Inconsistencia de idioma en las plantillas:** casi todos los `template` están en inglés, pero al menos 4 están directamente en español dentro del código fuente (`force.no_space`: "no dar distancia de tiro", `force.paint_deny`: "mantener fuera de la pintura", `force.post_channel` mezclado, `aware.screen_hold`: "Pantalla aguantada — comunicar antes del bloqueo", `aware.selfish_pattern`: "Jugador egoísta — busca su opción siempre, no especular"). Si existe un sistema de `i18nKey` para traducir a es/en/zh, tener plantillas base ya en español rompe la consistencia — `[PENDIENTE]` confirmar si esto es un olvido o si esas claves específicas no pasan por el sistema de i18n por algún motivo.
- **Entrada `deny.duck_in` sigue en el catálogo** aunque el comentario del bloque "Cut outputs" de `calculateOutputs()` (línea ~1926) dice literalmente "duck_in removed from cutType" — posible entrada huérfana en el catálogo tras eliminar el campo de origen. `[PENDIENTE]` confirmar si `deny_duck_in` todavía puede generarse por alguna otra vía o es código muerto.

### `INFERENCE_RULES` (línea 507) — estructura verificada, contenido de las 8 reglas no leído al detalle

**[VERIFICADO]** Tiene una lista `neverInfer` explícita (líneas 508-527+) con ~20 campos que el motor **nunca** rellena automáticamente aunque estén vacíos — deben venir siempre de observación directa del staff (`isoDir`, `postShoulder`, `cutType`, `screenerAction`, `pressureResponse`, `transRole` y sus variantes, `postMoves`, `pnrEff`, etc.). Esto coincide con la memoria del proyecto ("Motor inference over new inputs"). Hay **8 bloques de `conditions:`** en el archivo — 8 campos que SÍ se pueden inferir con reglas condicionales — `[PENDIENTE]` no leídos todavía cuáles son ni su lógica exacta.

---

## 2.5. BUG GRANDE, VERIFICADO — dos motores de scoring independientes coexisten y dos rutas de jugadora los usan por separado

**Este es el hallazgo más importante de la auditoría de U Scout hasta ahora.** Verificado con lectura de código real (imports + `grep` de rutas), no es hipótesis.

### Lo que hay, verificado paso a paso

1. **Existe un segundo motor de scoring, completo e independiente, dentro de `client/src/lib/mock-data.ts`** (2.359 líneas — pese al nombre del archivo, no son datos de prueba: es una librería de producción activa). Contiene su propia lógica de amenaza: función `danger()` (línea 482), cálculo de `isoDanger`/`postDanger` (líneas ~1525-2032), determinación de `mainArchetype`, generación de plan defensivo — todo dentro de `generateProfile()` (línea 1469). Usa las mismas variables de entrada del editor (`ftShooting`, `foulDrawing`, `isoFrequency`, `contactType`...) pero con su propia fórmula, totalmente distinta y separada del `WEIGHTS`/`calculateOutputs()` de `motor-v2.1.ts` documentados arriba.
2. **El motor "oficial" documentado en memoria del proyecto** (`motor-v2.1.ts` + `motor-v4.ts`, función `generateMotorV4()`) es un código completamente distinto, con su propio sistema de pesos (`WEIGHTS`) y su propio `calculateThreatScores()`.
3. **Ambos están vivos en producción a la vez**, verificado por rutas reales en `client/src/App.tsx`:
   - `/player/:id` y `/coach/player/:id/profile` → `PlayerProfileViewer` (`pages/player/Profile.tsx`, línea 3: `generateProfile` importado de `mock-data.ts`) — **usa el motor legacy**.
   - `/player/report/:id` → `PlayerReportV4Route` (envuelve `ReportSlidesV1.tsx`, que importa `generateMotorV4` de `motor-v4.ts`) — **usa el motor oficial v4/v2.1**.
4. **Ambas rutas están enlazadas activamente desde pantallas de jugadora distintas**, no es una ruta muerta:
   - `client/src/pages/player/PlayerHome.tsx:131` — `setLocation(\`/player/${r.opponentPlayerId}\`)` → va al motor **legacy**.
   - `client/src/pages/player/Dashboard.tsx:88` — `setLocation(\`/player/report/${p.playerId}\`, ...)` → va al motor **v4/oficial**.

### Por qué importa

Si una jugadora entra a ver el scouting de una rival desde `PlayerHome` ve un archetype/plan defensivo calculado por un motor; si entra desde `Dashboard` (u otro camino que enlace a `/player/report/:id`) ve el calculado por otro motor completamente distinto — **para la misma jugadora rival, potencialmente con conclusiones diferentes**, sin que nada en la UI indique que son dos sistemas distintos. Esto choca directamente con el diseño aprobado ya documentado en memoria (`u-scout-design-decisions.md`): *"Same component is used for the player view and the coach REPORTS zone"* — en la práctica hay al menos dos componentes/motores distintos alcanzables por rutas de jugadora reales, no uno.

### Actualización del punto pendiente más grave — el flujo de aprobación SÍ es compartido entre los dos motores

**[VERIFICADO]** `client/src/lib/approval-api.ts` (150 líneas, leído completo): el sistema de aprobación/overrides (`useApprovalStatus`, `useSetReportOverride`, `useApproveReport`, `usePublishReport`, todos contra `/api/players/:id/...`) es **genérico y único** — no distingue de qué motor viene el contenido, solo guarda `{ slide, itemKey, action }`. Confirmado que **`player/Profile.tsx` (motor legacy) y `ReportSlidesV1.tsx` (motor v4) importan exactamente el mismo módulo `approval-api.ts`** — es decir, el flujo de aprobación del staff SÍ está conectado a ambos consumidores, no es que uno lo ignore por completo.

Pero eso no resuelve el riesgo, lo desplaza: la aprobación se guarda por `itemKey` (string). Si los dos motores generan `itemKey`s con convenciones distintas para conceptualmente "lo mismo" (son código separado, sin garantía de que coincidan), una aprobación/ocultación hecha revisando el contenido de un motor **podría no aplicar** al contenido equivalente del otro motor — o aplicar a un item que por coincidencia de nombre no es el que el staff creyó aprobar. `[PENDIENTE]` comparar los `itemKey` reales que genera cada motor para el mismo concepto (ej. "amenaza de ISO") y confirmar si coinciden o no. Esto es lo único que falta para saber si el bug de los dos motores es "cosmético" (ambos caminos muestran contenido válido aunque distinto) o "grave" (las aprobaciones del staff no protegen consistentemente lo que ve la jugadora según por dónde entre).
### Evidencia de `git log` sobre cuál camino está realmente vivo — verificado, y corrige una suposición anterior

**[VERIFICADO con `git log -1` por archivo]** Antes asumía (marcado como especulación, sin confirmar) que `PlayerHome.tsx`/legacy sería "lo viejo" y `Dashboard.tsx`/v4 "lo nuevo". **Los commits reales dicen lo contrario de lo esperado, y es más mixto de lo que parecía:**

| Archivo | Último commit | Antigüedad desde hoy (10/09) |
|---|---|---|
| `PlayerHome.tsx` (enlaza a legacy) | 2026-09-06 | 4 días |
| `mock-data.ts` (motor legacy) | 2026-09-07 | 3 días — fix real de mapeo `pnrDominantFinish/pnrOppositeFinish` |
| `PlayerEditor.tsx` | 2026-09-06 | 4 días |
| `ReportSlidesV1.tsx` (consumidor v4) | 2026-09-08 | 2 días |
| `Dashboard.tsx` (enlaza a v4) | 2026-05-09 | ~4 meses |
| `motor-v4.ts` | 2026-04-21 | ~4,5 meses |
| `motor-v2.1.ts` | 2026-04-21 | ~4,5 meses |
| `QuickScout.tsx` (usa legacy) | 2026-05-09 | ~4 meses |

**Lectura honesta, sin sobre-interpretar:** el núcleo de reglas (`motor-v2.1.ts`/`motor-v4.ts`) lleva ~4,5 meses sin tocarse — relativamente estable/congelado. `ReportSlidesV1.tsx` (su consumidor de UI) SÍ recibe fixes recientes (i18n del nombre, 08/09). `mock-data.ts` también recibe fixes recientes (07/09) — **pero ese archivo contiene tanto el adaptador compartido `playerInputToMotorInputs()` (usado por AMBOS caminos, confirmado en línea 716 con el comentario `"... (legacy, por mano dominante) → motor"`) como el motor legacy standalone (`generateProfile`)**, y el campo tocado en el commit del 07/09 (`pnrDominantFinish`/`pnrOppositeFinish`) se usa en ambas partes del archivo (líneas ~716-742 del adaptador Y líneas ~1889-2128 dentro de la lógica standalone de `generateProfile`). **No puedo afirmar con esta evidencia sola si el commit reciente arregló el adaptador compartido, el motor legacy standalone, o ambos** — `[PENDIENTE]` mirar el diff exacto de ese commit (`git show`) para saberlo con certeza.

**Conclusión provisional, corregida respecto a mi suposición anterior:** no hay una señal limpia de "uno es el viejo, otro es el nuevo" por fecha de commit — los dos caminos de jugadora (`PlayerHome`→legacy y `Dashboard`→v4) reciben mantenimiento en fechas parecidas o el legacy incluso más reciente. Esto hace **más probable, no menos, que ambos caminos estén realmente en uso activo hoy**, lo cual aumenta la severidad real del hallazgo de los dos motores en vez de restarle importancia.
- `[PENDIENTE]` Comparar output real: generar el mismo perfil de jugadora por ambos caminos y ver si el archetype/plan difieren de verdad en la práctica, o si por casualidad convergen en la mayoría de casos. **— HECHO, ver abajo.**

### Comparación de output real — EJECUTADA, no solo leída (2026-09-10)

**[VERIFICADO por ejecución real]** Construí un test con Vitest (entorno `happy-dom`, instalado temporalmente como devDependency y desinstalado después de usarlo — `git status` confirma que `package.json`/`package-lock.json` quedaron limpios, sin cambios permanentes) que alimenta el **mismo objeto de entrada** (`PlayerInput`, generado desde `createDefaultPlayer()` ya existente en el propio código, con overrides para un perfil claro: ISO primaria, diestra, atlética 5/5, busca contacto, FT/foul-drawing 5/5) a los dos caminos:

**Motor legacy (`generateProfile()`, `mock-data.ts`):**
```
archetype: arch_isolation_driver
defender: "Cerrar el espacio — no dejar recepción cómoda. Ataca preferentemente por derecha. Decide rápido."
forzar:    "Forzar hacia la izquierda. Ataca preferentemente por derecha — canalizar al lado débil."
concede:   con_ft_dangerous, con_no_post, con_no_transition
aware:     "Busca el contacto activamente. Disciplina en las ayudas."
```

**Motor oficial (`generateMotorV4()`, v4 sobre v2.1):**
```
archetypeKey: archetype_iso_scorer   (dangerLevel 4, difficultyLevel 5)
deny winner:  deny_iso_space   (score 0.884, situationRef iso_right)
force winner: force_direction (score 0.778, situationRef iso_right)
allow winner: none
```

### Lectura honesta del resultado

**Para este caso de prueba, los dos motores CONVERGEN en la sustancia de la recomendación:** ambos dicen "niega el espacio de ISO" y ambos dicen "fuerza hacia el lado débil/izquierda" (jugadora diestra). No es un caso donde un entrenador reciba consejos contradictorios. **Esto es una noticia genuinamente buena que suaviza (no elimina) la gravedad del hallazgo de la sección 2.5.**

Pero, verificado también en el mismo resultado, **el naming NO converge**: `arch_isolation_driver` (legacy) vs. `archetype_iso_scorer` (oficial) son strings distintos para el mismo concepto. Esto confirma exactamente el riesgo que ya se había señalado sobre las aprobaciones del staff por `itemKey`: si el sistema de `report_overrides` referencia el archetype o los outputs por su `key`/`itemKey` (no confirmado aún si lo hace a este nivel), una aprobación hecha viendo `arch_isolation_driver` no reconocería `archetype_iso_scorer` como "el mismo" concepto, aunque el contenido sea equivalente.

**Límites reales de esta verificación — un solo caso, no una prueba exhaustiva:**
- Es **un** perfil de prueba (ISO primaria pura, sin otras situaciones activas). Los casos más propensos a divergir de verdad son jugadoras con **múltiples situaciones primarias** (donde entra en juego el cap a 0,72 de `calculateThreatScores()` del motor oficial, lógica que el motor legacy podría no replicar igual — no verificado) o campos que solo uno de los dos adaptadores mapea bien (ej. el fix reciente de `pnrDominantFinish`/`pnrOppositeFinish` visto en el commit del 07/09).
- No comparé los campos `alerts`/`situations` completos del output oficial (solo `identity` y `defense`) contra el `aware` del legacy — podría haber más divergencia ahí que no vi.

### Conclusión y recomendación sobre "motor v5"

Con esta evidencia (estructural completa + una ejecución real convergente en sustancia pero divergente en naming), mi recomendación es:

**SÍ, consolidar en un único motor es lo correcto a medio plazo** — tener dos implementaciones independientes de la misma lógica de negocio crítica (aunque hoy coincidan en casos simples) es deuda técnica real y un riesgo latente de divergencia silenciosa a futuro, agravado por el hecho de que las aprobaciones del staff no están garantizadas de aplicar de forma consistente entre ambos (naming distinto).

**Pero NO es una emergencia para arreglar ya mismo**, porque: (a) el caso probado converge en sustancia, no hay evidencia de que una jugadora esté viendo hoy un consejo defensivo contradictorio real; (b) no he probado los casos más complejos (múltiples situaciones primarias) donde sí podría haber divergencia real de sustancia, no solo de naming.

**Antes de decidir "construir v5" como proyecto formal**, lo que yo haría es exactamente un paso más barato: correr 5-10 perfiles de prueba más (incluyendo multi-situación) por ambos caminos con este mismo arnés de test que ya deja construido el patrón (puede recrearse en 5 minutos, reinstalando `happy-dom` temporalmente) y ver si la divergencia de sustancia aparece en algún caso real. Si aparece aunque sea una vez, v5/consolidación pasa de "recomendable" a "necesario".

**Ubicación exacta para decidir después (no tocado):** `client/src/lib/mock-data.ts` (motor legacy completo), `client/src/pages/player/Profile.tsx` (consumidor legacy), `client/src/pages/player/PlayerHome.tsx:131` (enlace que lleva al legacy), `client/src/App.tsx:154,181` (rutas registradas).

---

## 3. Motor / pipeline de datos — `[PENDIENTE]` entero

No revisado. Incluye: de dónde salen los inputs del `PlayerEditor` (¿solo lo que teclea el staff, o hay algo derivado de U Stats/PBP?), dónde se ejecuta el motor (cliente vs. servidor — de momento todo lo visto está en `client/src/lib/`, lo cual sugiere que el motor corre **en el cliente**, no en el servidor — `[PENDIENTE]` confirmarlo, es una diferencia arquitectónica grande respecto a U Stats que corre todo en SQL/servidor), qué se cachea, pasos manuales.

---

## 4. Código y arquitectura — arrancado

**[VERIFICADO]** Tabla de tamaños de archivo de arriba. Primeras observaciones:
- El motor real (`motor-v2.1.ts`) vive en `client/src/lib/`, no en `server/` — a diferencia de U Stats, donde toda la lógica pesada está en `server/routes.ts` y SQL. Esto implica que el cálculo del motor de scouting corre en el navegador del usuario, no en el servidor — `[PENDIENTE]` confirmar y valorar qué implica (consistencia entre dispositivos, posibilidad de manipulación del lado cliente, etc.)
- `PlayerEditor.tsx` (1.969 líneas) y `ClubManagement.tsx` (1.630 líneas) son candidatos a estar sobrecargados, en la misma línea que `Schedule.tsx` en su día y `Stats.tsx` ahora (4.761 líneas) — patrón repetido en el repo de páginas monolíticas. `[PENDIENTE]` confirmar si están realmente sobrecargadas o si el tamaño está justificado (ej. 48 campos de editor necesitan mucho JSX).

---

## 5. Pipeline de construcción de informes — `[PENDIENTE]` entero

Ya hay contexto previo en memoria (`u-scout-design-decisions.md`: flujo de aprobación edición→propuesta→revisión de staff→publicación, `report_overrides` para tracking) pero no se ha verificado esta sesión contra el código de `ReportSlidesV1.tsx`/`ReportViewV4.tsx`/`OverridePanel.tsx`.

---

## 6. UI/UX — `[PENDIENTE]` entero

No se ha abierto el navegador todavía. Pendiente: login con cuentas QA, recorrido de pantallas en desktop/portrait/landscape, y el ciclo QA coach→head_coach→revertir por SQL si algún módulo está bloqueado por rol.

---

## 7. Fuentes usadas en esta sesión

- `find`/`grep`/`wc -l` sobre `client/src/pages/scout/`, `client/src/pages/core/`, `client/src/components/scout/`, `client/src/lib/motor-v4.ts`, `motor-v2.1.ts`.
- Memoria del proyecto (`overview.md`, `u-scout-design-decisions.md`) como contexto heredado, no reverificada línea a línea todavía salvo lo indicado arriba.
- Sin investigación web nueva esta sesión.
