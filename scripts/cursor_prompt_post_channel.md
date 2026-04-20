# Cursor Agent Prompt — Post channel inference (dominant hand)

## Context
`client/src/lib/motor-v2.1.ts` + `client/src/lib/reportTextRenderer.ts`

Problema: el motor sabe `postShoulder` y `hand` pero nunca los cruza para inferir si el
ataque va hacia la mano dominante, y si es así, qué dirección de channel aplicar.

Ejemplo Kalani Brown (hand=L):
- Right block, up&under → termina con izquierda (mano fuerte) → channel right
- Left block, hook al medio → termina con izquierda (mano fuerte) → channel right
Sin este cruce, el report solo dice "three-quarter on the right shoulder" sin mencionar
que el objetivo es negar la mano izquierda.

`npm run check` al final. No tocar otros archivos.

---

## PARTE 1 — motor-v2.1.ts

### 1a. Añadir nueva source al SOURCE_TO_SITUATION

Busca el objeto `SOURCE_TO_SITUATION` y añade esta línea junto a las demás de 'post':

```typescript
post_channel: 'post',
```

### 1b. Añadir nueva output al OUTPUT_CATALOG

En `OUTPUT_CATALOG.force`, añade tras `paint_deny`:

```typescript
post_channel: { key: 'force_post_channel', i18nKey: 'output.force.post_channel', template: 'FORCE post channel — deny dominant hand finish' },
```

### 1c. Añadir la inferencia en calculateOutputs, sección Post outputs

Busca el comentario `// =========================================================================` 
que precede a `// Post outputs - v2.1 ENHANCED` y dentro del bloque `if (inputs.postFreq && inputs.postFreq !== 'N')`,
añade este bloque **justo después** de donde se emite `deny_post_entry` (tras el `if (inputs.postFreq === 'P' || ...)`):

```typescript
      // =========================================================================
      // Post channel inference — cross hand + postShoulder + postMoves
      //
      // Goal: determine if the player's attacks converge on their dominant hand,
      // and if so, emit force_post_channel with the correct direction.
      //
      // Rules:
      // 1. up_and_under always terminates with the dominant hand (the move exists
      //    to pivot back to it). Regardless of block or shoulder.
      // 2. hook from the SAME shoulder as dominant hand → dominant hand finish.
      //    hook from the OPPOSITE shoulder → can go either way (skip or reduce confidence).
      // 3. turnaround/fade from any shoulder → ambiguous (skip).
      // 4. If offHandFinish === 'strong' → ambidextrous finisher → skip entirely.
      //
      // Channel direction: always AWAY from dominant hand.
      //   hand=L → force right (deny left finish)
      //   hand=R → force left (deny right finish)
      //
      // Confidence scoring:
      // - up_and_under present → high confidence (+0.15 weight bonus)
      // - hook on dominant shoulder → medium confidence (base weight)
      // - both present → max confidence (0.90)
      // - Ambidextrous (offHandFinish=strong) → skip
      // =========================================================================
      if (inputs.offHandFinish !== 'strong' && inputs.hand) {
        const dominantHand = inputs.hand; // 'L' or 'R'
        const dominantShoulder = dominantHand; // same direction
        const channelDir = dominantHand === 'L' ? 'R' : 'L'; // force AWAY from dominant

        let channelEvidence = 0;

        // up_and_under always returns to dominant hand
        if (inputs.postMoves?.includes('up_and_under')) {
          channelEvidence += 2;
        }

        // hook: only count if on dominant shoulder (same side = same hand finish)
        if (inputs.postMoves?.includes('hook') && inputs.postShoulder === dominantShoulder) {
          channelEvidence += 1;
        }

        // drop_step to dominant side (postShoulder === dominant) → dominant hand finish
        if (inputs.postMoves?.includes('drop_step') && inputs.postShoulder === dominantShoulder) {
          channelEvidence += 1;
        }

        // Only emit if there's clear evidence (at least 1 strong signal)
        if (channelEvidence >= 1) {
          const channelWeight = channelEvidence >= 3 ? 0.90
            : channelEvidence === 2 ? 0.82
            : 0.72;
          outputs.push({
            key: 'force_post_channel',
            category: 'force',
            weight: channelWeight,
            source: 'post_channel',
            params: {
              channelDir,
              dominantHand,
              evidence: String(channelEvidence),
            },
          });
        }
      }
```

---

## PARTE 2 — reportTextRenderer.ts

### 2a. Añadir case `force_post_channel` en renderInstructionEN

Busca el case `"force_paint_deny":` y añade **antes** de él:

```typescript
case "force_post_channel": {
  const channelDir = inputs.hand === "L" ? "right" : "left";
  const dominantHand = inputs.hand === "L" ? "left" : "right";
  const hasUpUnder = inputs.postMoves?.includes("up_and_under");
  const hasHook = inputs.postMoves?.includes("hook");
  const movesNote = hasUpUnder && hasHook
    ? "The up-and-under and hook both terminate with the left hand."
    : hasUpUnder
      ? "The up-and-under always pivots back to the dominant hand."
      : "Hook on the dominant shoulder finishes with the dominant hand.";
  return `Force ${channelDir} in the post — deny the ${dominantHand}-hand finish. ${movesNote} Channel ${channelDir} before she seals.`;
}
```

### 2b. Añadir case `force_post_channel` en renderInstructionES

Busca el case `"force_paint_deny":` en la función `renderInstructionES` y añade **antes**:

```typescript
case "force_post_channel": {
  const channelDir = inputs.hand === "L" ? "derecha" : "izquierda";
  const dominantHand = inputs.hand === "L" ? "izquierda" : "derecha";
  const hasUpUnder = inputs.postMoves?.includes("up_and_under");
  const hasHook = inputs.postMoves?.includes("hook");
  const movesNote = hasUpUnder && hasHook
    ? "El up-and-under y el gancho terminan con la mano izquierda."
    : hasUpUnder
      ? "El up-and-under siempre pivota hacia la mano dominante."
      : "El gancho por el hombro dominante termina con la mano dominante.";
  return `Canaliza a la ${channelDir} en el poste — niega el remate con la mano ${dominantHand}. ${movesNote} Cárgala a la ${channelDir} antes de que selle.`;
}
```

### 2c. Añadir case `force_post_channel` en renderInstructionZH

Busca el case `"force_paint_deny":` en `renderInstructionZH` y añade **antes**:

```typescript
case "force_post_channel": {
  const channelDir = inputs.hand === "L" ? "右侧" : "左侧";
  const dominantHand = inputs.hand === "L" ? "左手" : "右手";
  const hasUpUnder = inputs.postMoves?.includes("up_and_under");
  const hasHook = inputs.postMoves?.includes("hook");
  const movesNote = hasUpUnder && hasHook
    ? "上步转身和勾手都以左手终结。"
    : hasUpUnder
      ? "上步转身动作总会转回主导手方向。"
      : "主导肩侧的勾手以惯用手终结。";
  return `在低位向${channelDir}引导——封堵${dominantHand}终结。${movesNote} 在其建立密封前向${channelDir}卡位。`;
}
```

---

## PARTE 3 — Calibration profile para Kalani Brown

Añade este perfil al array `profiles` en `scripts/calibrate-motor.ts`, justo antes del comentario `// ─── WNBA STARS` o al final del bloque WNBA:

```typescript
  {
    id: "cal_kalani",
    name: "Kalani Brown — Post channel left hand",
    note: "Mano izquierda dominante. Up&under + hook vuelven siempre a la izquierda. Channel right obligatorio.",
    inputs: {
      pos: "C", hand: "L", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high",
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "up_and_under"],
      postEntry: "seal",
      isoFreq: "N", pnrFreq: "N", transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "capable",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry"],
      force_must: ["force_post_channel"],
      force_must_not: ["force_weak_hand"],
      top_situations: ["post_right"],
      force_text_contains: ["right", "left"],  // "Force right — deny left-hand finish"
    },
  },
```

---

## Verificación

```bash
cd "/Users/palant/Downloads/U scout"
npm run check
npx tsx scripts/calibrate-motor.ts 2>&1 | tail -10
npx tsx scripts/eval-motor-quality.ts 2>&1 | tail -5
```

Calibración debe seguir 100% (ahora +1 perfil). Quality eval sin cambios.

---

## Notas de diseño

**¿Por qué no inferir para ambidextros?**
`offHandFinish === 'strong'` significa que el scout observó terminación eficiente con
ambas manos. En ese caso channel es ambiguo — el report solo debería decir "finishes
with both hands" (ya cubierto por `aware_hands`). No emitir `force_post_channel`.

**¿Por qué turnaround/fade no suman evidencia?**
Turnaround y fade son shots estáticos que pueden ejecutarse con cualquier mano según
la posición del defensor. No tienen la lógica de "retorno a mano dominante" que tiene
el up&under. Incluirlos generaría falsos positivos para jugadores como Jokic (hook+fade,
ambas manos competentes).

**¿Por qué solo hook en shoulder dominante?**
Un hook desde el hombro no-dominante puede ir en cualquier dirección. Solo el hook
desde el hombro dominante garantiza terminación con la mano dominante.
