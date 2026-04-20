# Cursor Agent Prompt — Fix ALLOW fallback + AWARE off_ball_role + ALLOW text philosophy

## Context
Fixes en motor-v4.ts y reportTextRenderer.ts.
`npm run check` al final.

---

## CHANGE 1 — motor-v4.ts: fix fallback ALLOW key mapping

El fallback de `buildDefenseInstruction` cuando no hay outputs de `allow` genera keys como
`allow_iso_right` usando `bucketToSituationId`. Estos keys no existen en el renderer.

**Busca** este bloque en motor-v4.ts:
```typescript
      const genuinelyLow = denySorted.filter(o => o.weight < 0.5);
      if (genuinelyLow.length > 0) {
        const least = genuinelyLow[0];
        const sitId = toSituationId(SOURCE_TO_SITUATION[least.source] ?? 'misc', inputs);
        const allowKey = `allow_${sitId}`;
        return {
          winner: { key: allowKey, score: Math.max(1 - least.weight, 0.3), situationRef: sitId, source: least.source },
          alternatives: genuinelyLow.slice(1, 4).map(o => {
            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? 'misc', inputs);
            return { key: `allow_${s}`, score: Math.max(1 - o.weight, 0.3), situationRef: s, source: o.source };
          }),
        };
      }
```

**Reemplaza** con:
```typescript
      const genuinelyLow = denySorted.filter(o => o.weight < 0.5);
      if (genuinelyLow.length > 0) {
        const least = genuinelyLow[0];
        const sitId = toSituationId(SOURCE_TO_SITUATION[least.source] ?? 'misc', inputs);
        // Map situation bucket → valid renderer key. Never concatenate allow_ + situationId.
        const bucketToAllowKey = (src: string): string => {
          const b = SOURCE_TO_SITUATION[src] ?? 'misc';
          switch (b) {
            case 'iso': return 'allow_iso';
            case 'pnr': return 'allow_pnr_mid_range';
            case 'screener': return 'allow_post';
            case 'post': return 'allow_post';
            case 'spot': return 'allow_spot_three';
            case 'transition': return 'allow_transition';
            case 'cut': return 'allow_cut';
            default: return 'none';
          }
        };
        return {
          winner: {
            key: bucketToAllowKey(least.source),
            score: Math.max(1 - least.weight, 0.3),
            situationRef: sitId,
            source: least.source,
          },
          alternatives: genuinelyLow.slice(1, 4).map(o => {
            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? 'misc', inputs);
            return {
              key: bucketToAllowKey(o.source),
              score: Math.max(1 - o.weight, 0.3),
              situationRef: s,
              source: o.source,
            };
          }),
        };
      }
```

---

## CHANGE 2 — reportTextRenderer.ts: AWARE aware_off_ball_role

**Busca** en `renderAlertText` EN branch:
```typescript
    if (key.includes("physical"))
      return "Uses body to create space — physical mismatch risk.";
    return key.replace(/_/g, " ");
```
**Reemplaza:**
```typescript
    if (key.includes("physical"))
      return "Uses body to create space — physical mismatch risk.";
    if (key === "aware_off_ball_role")
      return "Active off the ball — cuts and screens without the ball. Do not lose sight off-ball.";
    return key.replace(/_/g, " ");
```

**Busca** en `renderAlertText` ES branch:
```typescript
    if (key.includes("physical"))
      return "Usa el cuerpo para crear espacio — riesgo de desajuste físico.";
    return key.replace(/_/g, " ");
```
**Reemplaza:**
```typescript
    if (key.includes("physical"))
      return "Usa el cuerpo para crear espacio — riesgo de desajuste físico.";
    if (key === "aware_off_ball_role")
      return "Activa sin balón — cortes y bloqueos sin el balón. No perder el contacto visual fuera del balón.";
    return key.replace(/_/g, " ");
```

**Busca** en `renderAlertText` ZH branch (justo después de `"后撤步跳投"`):
```typescript
    if (key.includes("stepback"))
      return "后撤步跳投，两次运球即可创造空间。";
```
**Añade después:**
```typescript
    if (key === "aware_off_ball_role")
      return "无球积极跑动——无球切入和掩护。不要在无球时失去视线。";
```

---

## CHANGE 3 — reportTextRenderer.ts: FORCE force_weak_hand context-aware para PnR shooter

**Busca** en `renderInstructionEN` el case `force_weak_hand`:
```typescript
    case "force_weak_hand": {
      const weakHandEN = inputs.hand === "R" ? "left" : "right";
      const strongHandEN = inputs.hand === "R" ? "right" : "left";
      return `Force ${weakHandEN} — she finishes much better going ${strongHandEN}. Channel every drive to her weak side and contest at the rim.`;
    }
```
**Reemplaza:**
```typescript
    case "force_weak_hand": {
      const weakHandEN = inputs.hand === "R" ? "left" : "right";
      const strongHandEN = inputs.hand === "R" ? "right" : "left";
      const isPnrShooter = inputs.pnrFreq === "P" &&
        (inputs.pnrFinishLeft === "Mid-range" || inputs.pnrFinishRight === "Mid-range") &&
        !inputs.deepRange;
      if (isPnrShooter) {
        return `Force ${weakHandEN} off every screen — deny the mid-range pull-up going ${strongHandEN}. Push her toward the paint: help is there, pull-up is not. No free space at the arc.`;
      }
      return `Force ${weakHandEN} — she finishes much better going ${strongHandEN}. Channel every drive to her weak side and contest at the rim.`;
    }
```

**Busca** en `renderInstructionES` el case `force_weak_hand`:
```typescript
    case "force_weak_hand": {
      const weakHandES = inputs.hand === "R" ? "izquierda" : "derecha";
      const strongHandES = inputs.hand === "R" ? "derecha" : "izquierda";
      return `Fuerza a la ${weakHandES} — finaliza mucho mejor por la ${strongHandES}. Canaliza cada penetración a su lado débil y contesta en el aro.`;
    }
```
**Reemplaza:**
```typescript
    case "force_weak_hand": {
      const weakHandES = inputs.hand === "R" ? "izquierda" : "derecha";
      const strongHandES = inputs.hand === "R" ? "derecha" : "izquierda";
      const isPnrShooterES = inputs.pnrFreq === "P" &&
        (inputs.pnrFinishLeft === "Mid-range" || inputs.pnrFinishRight === "Mid-range") &&
        !inputs.deepRange;
      if (isPnrShooterES) {
        return `Fuerza a la ${weakHandES} en cada bloqueo — niega el pull-up de media distancia por la ${strongHandES}. Empújala a la pintura: la ayuda está ahí, el pull-up no. Sin espacio libre en el arco.`;
      }
      return `Fuerza a la ${weakHandES} — finaliza mucho mejor por la ${strongHandES}. Canaliza cada penetración a su lado débil y contesta en el aro.`;
    }
```

---

## CHANGE 4 — reportTextRenderer.ts: ALLOW — filosofía activa

El ALLOW no es "concede esta acción pasivamente". Es "actívame esta situación porque es donde ella pierde más".
Cruzar: mano débil + `offHandFinish` + `contactFinish` + `pnrFinishLeft/Right` para generar texto activo.

**Busca** en `renderInstructionEN` el case `allow_iso`:
```typescript
    case "allow_iso":
      return "Allow ISO attempts. Low efficiency when she creates off the dribble — give her the ball, stay upright, and contest the shot.";
```
**Reemplaza:**
```typescript
    case "allow_iso": {
      const weakSide = inputs.hand === "R" ? "left" : "right";
      const avoidsContact = inputs.contactFinish === "avoids";
      const weakHandWeak = inputs.offHandFinish === "weak";
      const hasPnrMidRange = inputs.pnrFreq === "P" &&
        (inputs.pnrFinishLeft === "Mid-range" || inputs.pnrFinishRight === "Mid-range");
      if (avoidsContact && weakHandWeak && hasPnrMidRange) {
        return `Force drives ${weakSide} into contact — she avoids it and her ${weakSide}-hand finish is weak. A contested drive left is better than a free mid-range pull-up or an open three. Make her choose between the worst shot and the hardest one.`;
      }
      if (avoidsContact) {
        return `Allow ISO into contact — she avoids physical finishes. Be physical, stay upright, and make her earn every shot at the rim. No free catch-and-shoot look.`;
      }
      if (hasPnrMidRange) {
        return `Allow ISO attempts. Low efficiency creating off the dribble — give her the ball in ISO, stay upright, and contest. A forced ISO is better than a PnR mid-range pull-up.`;
      }
      return `Allow ISO attempts. Low efficiency when she creates off the dribble — give her the ball, stay upright, and contest the shot.`;
    }
```

**Busca** en `renderInstructionES` el case `allow_iso`:
```typescript
    case "allow_iso":
      return "Permite el ISO. Baja eficiencia creando — dale el balón, mantente erguido/a y contesta el tiro.";
```
**Reemplaza:**
```typescript
    case "allow_iso": {
      const weakSideES = inputs.hand === "R" ? "izquierda" : "derecha";
      const avoidsContactES = inputs.contactFinish === "avoids";
      const weakHandWeakES = inputs.offHandFinish === "weak";
      const hasPnrMidRangeES = inputs.pnrFreq === "P" &&
        (inputs.pnrFinishLeft === "Mid-range" || inputs.pnrFinishRight === "Mid-range");
      if (avoidsContactES && weakHandWeakES && hasPnrMidRangeES) {
        return `Fuerza penetraciones a la ${weakSideES} con contacto — lo evita y su mano ${weakSideES} es débil. Una penetración forzada a la izquierda es mejor que un pull-up de media distancia libre o un triple abierto. Que elija entre el peor tiro y el más difícil.`;
      }
      if (avoidsContactES) {
        return `Permite el ISO con contacto — evita los finales físicos. Sé físico/a, mantente erguido/a y haz que se lo gane en el aro. Sin catch-and-shoot limpio.`;
      }
      if (hasPnrMidRangeES) {
        return `Permite el ISO. Baja eficiencia creando — dale el balón en ISO, mantente erguido/a y contesta. Un ISO forzado es mejor que un pull-up de media distancia en el bloqueo.`;
      }
      return `Permite el ISO. Baja eficiencia creando — dale el balón, mantente erguido/a y contesta el tiro.`;
    }
```

**Busca** en `renderInstructionZH` el case `allow_iso`:
```typescript
    case "allow_iso":
      return "允许单打。她持球创造的效率偏低——给球，保持直立姿势，封堵出手。";
```
**Reemplaza:**
```typescript
    case "allow_iso": {
      const avoidsContactZH = inputs.contactFinish === "avoids";
      const weakHandWeakZH = inputs.offHandFinish === "weak";
      const weakSideZH = inputs.hand === "R" ? "左侧" : "右侧";
      if (avoidsContactZH && weakHandWeakZH) {
        return `引导其向${weakSideZH}突破并施加身体对抗——她回避对抗且弱手终结能力差。被迫向弱手突破好过给她空位三分或中距离。`;
      }
      if (avoidsContactZH) {
        return `允许单打，但施加身体对抗——她回避身体接触。保持直立，让每次上篮都有争抢。`;
      }
      return `允许单打。持球创造效率偏低——给球，保持直立姿势，封堵出手。`;
    }
```

---

## Verification

```bash
cd "/Users/palant/Downloads/U scout"
npm run check
npx tsx scripts/calibrate-motor.ts 2>&1 | tail -5
```
