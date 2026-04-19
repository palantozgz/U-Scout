
# Motor Audit — Red de Inferencia U Scout
## Problemas identificados y fixes priorizados

---

## PRIORIDAD 1 — Inputs que existen pero NO llegan al motor (bugs duros)

### 1. spotZone hardcoded null
**Archivo: mock-data.ts**
```
spotZone: null,  // SIEMPRE NULL — nunca se mapea desde inputs.spotZone
```
**Fix:** `spotZone: (inputs.spotZone as SpotZone) ?? null`

### 2. dhoFreq hardcoded "N"
**Archivo: mock-data.ts**
```
dhoFreq: "N",  // HARDCODED
```
**Fix:** mapear desde `inputs.dhoFrequency` si existe el campo en PlayerInput

### 3. pnrSnake no conectado al motor
Existe en PlayerInput y se guarda en BD, pero motor-v2.1 no tiene ninguna regla para él.
Semántica: jugador que en PnR hace snake dribble (se va por el lado del bloqueo).
**Fix motor-v2.1:** si `pnrSnake=true`, generar aware sobre cambio de lado y reducir
el peso de force_direction desde asimetría (porque el snake compensa la debilidad).

### 4. ftRating no conectado al motor
Llega al `isoDanger` rating (UI) pero no genera ningún output motor.
Semántica: FT rating alto + contactFinish=seeks → amenaza real de foul drawing.
**Fix motor-v2.1:** si `contactFinish=seeks` + ftRating>=4 → boostar aware_physical
y añadir aware sobre foul drawing risk.

---

## PRIORIDAD 2 — Inferencias cruzadas faltantes (lógica de telaraña)

### 5. closeoutReaction → dirección de ataque en closeout
Actualmente: closeoutReaction solo determina `offHandFinish` y `deepRange`.
**Lo que falta:** si `closeoutReaction=Attacks Strong Hand` → el jugador ataca por su
mano dominante cuando el defensor cierra. Con `hand=R`, ataca por la derecha en el cierre.
Esto es una instrucción táctica importante: "en el cierre, va a atacar por su lado fuerte".
**Fix mock-data.ts:** añadir campo `closeoutAttackSide` derivado.
**Fix motor-v2.1:** generar `aware_closeout_direction` cuando closeoutReaction indica dirección.

### 6. offHandFinish=strong + isoWeakHandFinish=drive → suprimir force_weak_hand
Si el jugador tiene `offHandFinish=strong` Y `isoWeakHandFinish=drive` → es ambidiestro
en el remate. No tiene sentido generar force_weak_hand.
**Fix motor-v2.1:** en el bloque de force_weak_hand, añadir condición:
`if offHandFinish=strong && isoWeakHandFinish is not null → skip force_weak_hand y generar aware_hands`.

### 7. ath modula la capacidad de escape bajo presión
**Fix motor-v2.1:** `force_full_court` weight debe modularse por ath:
- ath=1-2 + pressureResponse=struggles → weight máximo
- ath=4-5 + pressureResponse=struggles → weight reducido

### 8. deepRange + spotUpFreq=P + closeoutReaction=Catch&Shoot → aware inmediato en cierre
**Fix motor-v2.1:** generar `aware_instant_shot` cuando:
`deepRange=true && spotUpFreq=P && spotUpAction=shoot`
Texto: "Immediate release on closeout — no pump fake, no hesitation."

### 9. vision=4 + trapResponse=struggle → texto diferenciado
aware_pressure_vuln debería distinguir:
- `ballHandling=limited + pressureResponse=struggles` → vulnerable a presión individual
- `trapResponse=struggle + vision>=4` → buen lector pero pierde con el blitz colectivo

---

## PRIORIDAD 3 — Ausencias como señal positiva

### 10. isoFreq=N + pnrFreq=N + spotUp=P → único peligro es el tiro
Mejorar texto de allow/deny para este perfil: instrucción muy clara.

### 11. pos=C + phys>=4 + orebThreat=null → inferir orebThreat=medium
Un C con fuerza que no tiene orebThreat seteado debería tener medium por defecto.

---

## RESUMEN DE CAMBIOS

### mock-data.ts:
1. spotZone: mapear desde inputs
2. dhoFreq: mapear desde inputs.dhoFrequency
3. orebThreat: inferir medium para C/PF con phys>=4 si null

### motor-v2.1.ts:
4. force_weak_hand: suprimir si isoWeakHandFinish=drive (ambidiestro)
5. aware_instant_shot: nueva key para shooters instantáneos
6. force_full_court: modular por ath
7. pnrSnake: añadir lógica (aware + reduce force_direction weight)
8. ftRating: boostar aware_physical si seeks+ftRating>=4

### reportTextRenderer.ts:
9. aware_pressure_vuln: texto diferenciado trap vs individual
10. allow_spot_three context: texto específico cuando es único peligro
