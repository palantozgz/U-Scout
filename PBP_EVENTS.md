# PBP_EVENTS.md — revisado
> Generado 2026-05-23. Primera versión fue solo lectura de código.
> Esta versión incorpora literatura externa verificada.

---

## 1. Qué es una posesión — definición estándar

Una posesión termina cuando: (1) se convierte un tiro de campo, (2) se falla un tiro y la defensa rebotea, (3) se convierte el último tiro libre, (4) se falla el último tiro libre y la defensa rebotea, (5) el ataque pierde el balón (TOV), o (6) termina el período.

Esto es importante: **los TOVs son un fin de posesión igual de válido que un tiro**. El código actual los excluye del denominador del PPP por tramo — eso es el bug documentado.

La fórmula de estimación de posesiones desde boxscore (Dean Oliver) es:

```
Poss ≈ FGA + 0.44 * FTA + TOV - ORB
```

Esta fórmula estima las posesiones a partir de los intentos de tiro (FGA), los tiros libres ponderados al 44% (FTA), las pérdidas de balón (TOV) y descontando los rebotes ofensivos (ORB) porque estos extienden la posesión sin consumirla.

El código usa exactamente esta fórmula para ORTG/DRTG. ✅

---

## 2. Tipos de inicio de posesión y su PPP esperado

No todas las posesiones valen lo mismo. Inpredictable clasifica el inicio de posesión en tres categorías: canasta encajada o pérdida de balón muerta (1.06 PPP), rebote defensivo (1.10 PPP), y robo de balón en vivo (1.25 PPP). El PPP promedio total es ~1.10.

Esto tiene implicación directa: **la clasificación por tiempo del código (≤8s, 8-14s, >14s) es un proxy del tipo de inicio, no el concepto correcto**. Transición real = defensa sin estar colocada, independiente del reloj.

---

## 3. Cómo se define transición en analítica estándar

Aquí está el problema más importante del código actual.

Synergy Sports — la referencia estándar en clasificación de posesiones — define transición como cualquier posesión donde la defensa no está colocada. No hay un corte en el tiempo del reloj que haga que una posesión sea de transición en lugar de media cancha.

Cleaning the Glass distingue tres contextos: transición (cuando la defensa no está establecida), putback (tras rebote ofensivo antes de que la defensa se reorganice), y media cancha (todo lo demás).

Lo que el código implementa es diferente: usa el tiempo transcurrido desde el inicio de la posesión (≤8s = transición, 8-14s = demi, >14s = media cancha). Esto es un **proxy basado en reloj de juego**, no la clasificación por estado defensivo que usa la industria.

### Comparación

| Metodología | Criterio de transición | Fuente |
|---|---|---|
| Synergy / industria | Defensa no colocada (necesita tracking o análisis de video) | Synergy Sports |
| Código actual | pos_time ≤ 8s desde inicio de posesión (reloj FIBA) | routes.ts |
| Una alternativa intermedia usada en college | Tiro en los primeros 10s del shot clock | statsbywill.substack.com |
| Otra variante usada en NBA data | Primeros 6s del shot clock | basketballimmersion.com |

Una definición práctica usada en análisis universitario es cualquier tiro dentro de los primeros 10 segundos del shot clock. Algunos consideran 7-8 segundos, ya que pocas defensas están completamente colocadas en ese período.

**La implementación del código no es incorrecta en concepto** — es razonable usar tiempo de posesión como proxy cuando no hay tracking de jugadores. Pero hay que tener en cuenta que:

1. No es la definición estándar de Synergy (que requiere datos de tracking o vídeo).
2. Los cortes (≤8s, 8-14s, >14s) son arbitrarios — no hay una referencia publicada con exactamente esos umbrales.
3. La clasificación demi-transición (8-14s) es una invención del código — no existe como categoría estándar en literatura.

---

## 4. PPP por tramo — benchmarks reales

### NBA / nivel elite (masculino)

En análisis NBA presentado por Jay Triano: PPP en transición ~1.23, PPP en media cancha ~1.07. El 15% de las posesiones son de transición, el 85% de media cancha. Los tiros en los primeros 6 segundos del shot clock valen un 33% más que los de los últimos 6 segundos.

### Nivel educativo / formación / HS

A nivel de high school, la referencia práctica de entrenadores es que cualquier marca por encima de 1.0 PPP es buena. Por debajo necesita trabajo. Defensivamente, mantener al rival por debajo de 0.8 se considera excelente.

### EuroLeague (masculino) — por tipo de ataque, no por tiempo

En EuroLeague 2022-24, el Corte (CUT) fue el tipo de ataque más eficiente con 1.58 PPP (82.4% de posesiones positivas), seguido de putback (1.33 PPP, 69%). Post Up, ISO y Spot Up fueron los menos eficientes, produciendo entre 0.78 y 0.98 PPP.

### Rango esperado para WCBA

La WCBA es baloncesto femenino profesional chino — comparable a Euroliga femenina o WNBA en intensidad competitiva. Los datos de referencia disponibles:

- WNBA (elite femenino): ~1.00-1.05 PPP promedio de temporada, transición ~1.15-1.25
- FIBA femenino europeo: similar, quizás ligeramente inferior por ritmo de juego
- High school femenino: ~0.85-0.95 PPP media cancha

Para la WCBA, un rango razonable a esperar (sin datos publicados específicos):
- Transición (definición tiempo): 1.10-1.30 PPP
- Media cancha: 0.90-1.05 PPP
- Liga total: ~1.00 PPP

**Importante:** tras el fix del TOV en el denominador, los PPP bajarán. Los valores actuales del código están inflados entre 15-20%.

---

## 5. PPP incluye TOVs — confirmado en literatura

Synergy Sports: ¿Los PPP incluyen pérdidas de balón? Sí, incluyen pérdidas y tiros libres convertidos.

Esto confirma que el bug del código es real. El PPP estándar de la industria **siempre incluye TOVs en el denominador**.

---

## 6. Catálogo de event_types usados en pace-segments

Este catálogo viene del código. Lo que la búsqueda añade es contexto sobre qué eventos son estándar en PBP de baloncesto.

### Fin de posesión (triggers del inicio de la siguiente)

| event_type en código | Definición estándar | ¿Común en PBP? |
|---|---|---|
| `rebound` | Captura del balón tras tiro fallado | ✅ universal |
| `steal` | Recuperación legal del balón por un defensor, causando una pérdida de balón al atacante. | ✅ |
| `turnover` | En baloncesto, ocurre cuando un equipo pierde la posesión del balón al rival antes de intentar un tiro. | ✅ |
| `foul` | Falta personal — puede o no cambiar posesión | ✅ |
| `ft_made` | Último tiro libre convertido → cambia posesión | ✅ |
| `ft_missed` | Tiro libre fallado → sigue con rebote | ✅ |
| `jumpball` | Salto entre dos | ✅ |

### Tiros (denominador actual — incompleto)

| event_type | Puntos asignados | Estado tras fix |
|---|---|---|
| `shot_made` | 2 | ✅ correcto |
| `shot_made_3` | 3 | ✅ correcto |
| `shot_missed` | 0 | ✅ correcto |
| `shot_missed_3` | 0 | ✅ correcto |
| `turnover` | 0 | ⚠️ ausente — debe añadirse |

### Decoradores (no cambian posesión, se usan como buffers LAG)

| event_type | Rol en queries |
|---|---|
| `assist` | LAG buffer antes de tiro |
| `block` | LAG buffer |
| `foul_drawn` | LAG buffer |
| `unknown` | Events no mapeados, pass-through |

---

## 7. Problema de la posesión como unidad vs. el tiro como unidad

Esta es la distinción conceptual más importante:

**Posesión** = unidad que puede terminar en tiro (made/missed), TOV, o FTs. Es la unidad correcta para PPP.

**Tiro** = subconjunto de posesiones. Puede usarse para métricas de eficiencia de tiro (eFG%, TS%) pero NO para PPP total.

El código mezcla ambas: usa "posesiones que acaban en tiro" como denominador del PPP. El nombre correcto de lo que calcula actualmente es **PPT** (Points Per Shot attempt) por tramo, no PPP por tramo.

**Implicación para el entrenador:** El PPT en transición siempre será mayor que el PPP en transición, porque excluye las posesiones donde el equipo perdió el balón antes de tirar. Esas posesiones "malas" se ocultan en el denominador actual.

---

## 8. Detección de posesión por tiempo: limitaciones conocidas

El método LAG sobre el reloj de juego tiene estas limitaciones documentadas:

**Shot clock vs. game clock:** El código usa el reloj de juego (game clock) restante en el cuarto, no el shot clock. Esto es relevante porque:

- En FIBA, el shot clock se resetea a 14 segundos tras un rebote ofensivo (vigente desde 2014-15).
- Eso significa que una posesión tras un rebote ofensivo puede durar hasta 14s en shot clock pero el tiempo transcurrido en game clock puede ser mayor o menor.
- El código aproxima el inicio de posesión usando el evento previo en el PBP (rebound, steal, etc.) y calcula `poss_start - shot_clock`. Esta aproximación es razonable cuando el PBP es denso pero introduce error cuando hay eventos no logueados.

**Rebotes ofensivos y continuidad de posesión:** Los rebotes ofensivos dan al equipo atacante otra oportunidad de anotar sin que haya cambio de posesión. El código trata cada secuencia como posesión independiente, lo cual puede inflar el conteo. El filtro anti-putback (≤3s desde rebote propio) intenta mitigarlo pero no cubre todos los casos.

**Eventos out-of-order:** pbpstats, la librería estándar para PBP de NBA/WNBA, tiene un módulo específico para corregir el orden de eventos en el PBP, ya que es habitual que lleguen desordenados en el feed oficial. El PBP de la WCBA puede tener el mismo problema — el código no tiene corrección de orden, confía en el campo `sequence`.

---

## 9. Gaps conocidos — actualizado

| Gap | Descripción | Impacto real |
|---|---|---|
| `shot_x / shot_y / shot_zone` | 0 filas — coordenadas no sincronizadas | `pointsByZone` usa split 70/30 hardcodeado, no válido |
| TOVs excluidos del PPP por tramo | Bug confirmado — denominador usa solo tiros | PPP inflado ~15-20% |
| Definición de transición por tiempo, no estado defensivo | No equivalente a Synergy | Métricas comparables con otras fuentes solo si se aclara la definición |
| Sin corrección de orden PBP | Eventos pueden llegar desordenados del WCBA API | Introduce ruido en la detección de posesión; magnitud desconocida |
| "demi-transición" (8-14s) | No es una categoría estándar en literatura | Puede confundir a usuarios que comparen con otras fuentes |
| OT quarters | No hay filtro específico para overtime | Cuartos 5+ tienen 5min shot clock FIBA, no 10min como Q1-Q4 |
| Rebote ofensivo → 14s shot clock FIBA | El código trata cada secuencia tras rebote ofensivo como posesión nueva | Puede duplicar posesiones cortas de putback que escapan al filtro ≤3s |

---

## 10. Visión PBP como fuente principal — revisada

Tras la investigación, la jerarquía correcta es:

| Métrica | Fuente recomendada | Por qué |
|---|---|---|
| PPG, RPG, FG% y stats básicas | Boxscore | Datos cuadrados y verificados por la API WCBA |
| ORTG/DRTG, Pace (estimado) | Boxscore (fórmula Dean Oliver) | Suficientemente preciso, no depende de PBP |
| PPP por tipo de ataque (Synergy-style) | Video/tracking → **no disponible** | El PBP de la WCBA no tiene el nivel de clasificación de Synergy |
| PPP por tramo temporal | PBP (con limitaciones documentadas) | Proxy razonable si se entiende que NO es la definición estándar de transición |
| Shot zones / hotspots | PBP (bloqueado: 0 filas shot_x/y/z) | Cuando Pi pipeline complete la Fase 4 |

**Conclusión para el entrenador:** Los datos de pace-segments son útiles como señal cualitativa ("este equipo tiende a atacar rápido/lento") pero no son directamente comparables con datos de Synergy Sports u otras fuentes estándar. La etiqueta "transición" en U Stats significa "posesión que llegó a tiro en ≤8s de game clock", no "transición con defensa sin colocar".

---

## 11. Referencias

- Dean Oliver, *Basketball on Paper* (2004) — fórmula de posesiones
- pbpstats.com / dblackrun — metodología estándar PBP NBA/WNBA
- Synergy Sports — clasificación estándar de tipos de ataque
- Cleaning the Glass (Ben Falk) — contextos de posesión (transición/putback/media cancha)
- Jay Triano / basketballimmersion.com — benchmarks NBA PPP por tipo
- NBA Official Rules, Rule 7 — shot clock
- FIBA Statisticians' Manual 2024 — definición oficial de TOVs y estadísticas
