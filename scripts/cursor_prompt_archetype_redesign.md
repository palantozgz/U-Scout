# Cursor Agent Prompt — Rediseño buildIdentity: arquetipos basados en situaciones

## Context
`buildIdentity` en motor-v4.ts usa condiciones de inputs para asignar arquetipos.
Esto es frágil: jugadoras con múltiples amenazas primarias (ej. Pika: spot-up + PnR)
caen en `archetype_versatile` porque ninguna condición individual se cumple.

La solución: usar `situations` (ya calculadas y rankeadas) como fuente de verdad.
El arquetipo primario = situación #1. El sub-arquetipo = situación #2.

`npm run check` al final.

---

## CHANGE — motor-v4.ts: reescribir buildIdentity

**Busca** la función `buildIdentity` completa:
```typescript
function buildIdentity(
  inputs: EnrichedInputs,
  situations: RankedSituation[],
  rawOutputs: MotorOutput[],
): MotorV4Output["identity"] {
  const archetypePriority: Array<[string, boolean]> = [
    [
      "archetype_post_scorer",
      (inputs.pos === "PF" || inputs.pos === "C") && inputs.postFreq === "P",
    ],
    [
      "archetype_iso_scorer",
      inputs.usage === "primary" &&
        inputs.isoFreq === "P" &&
        inputs.selfCreation === "high",
    ],
    [
      "archetype_pnr_orchestrator",
      inputs.usage === "primary" &&
        inputs.pnrFreq === "P" &&
        inputs.selfCreation === "high",
    ],
    [
      "archetype_stretch_big",
      (inputs.pos === "PF" || inputs.pos === "C") && inputs.spotUpFreq === "P",
    ],
    [
      "archetype_playmaker",
      inputs.usage === "primary" &&
        inputs.vision >= 4 &&
        inputs.selfCreation === "high",
    ],
    [
      "archetype_spot_up_shooter",
      inputs.spotUpFreq === "P" && inputs.selfCreation === "low",
    ],
    ["archetype_transition_threat", inputs.transFreq === "P"],
    ["archetype_role_player", inputs.usage === "role"],
    ["archetype_versatile", true],
  ];

  const matched = archetypePriority.filter(([, condition]) => condition);
  const archetypeKey = matched[0]?.[0] ?? "archetype_versatile";
  const archetypeCandidates: Candidate[] = matched.slice(1, 3).map(([key], i) => ({
    key,
    score: i === 0 ? 0.65 : 0.45,
  }));
```

**Reemplaza** con:
```typescript
function situationToArchetype(
  sitId: SituationId,
  inputs: EnrichedInputs,
): string {
  const isBig = inputs.pos === "PF" || inputs.pos === "C";
  switch (sitId) {
    case "catch_shoot":
      // Stretch big = big + spot-up primary (spacing role)
      // Spot-up shooter = guard/wing with spot-up as primary weapon
      return isBig ? "archetype_stretch_big" : "archetype_spot_up_shooter";
    case "pnr_ball":
      return "archetype_pnr_orchestrator";
    case "iso_right":
    case "iso_left":
    case "iso_both":
      return "archetype_iso_scorer";
    case "post_right":
    case "post_left":
      return "archetype_post_scorer";
    case "post_high":
      // High post primary = stretch big if they have exterior range, else post scorer
      return inputs.deepRange ? "archetype_stretch_big" : "archetype_post_scorer";
    case "pnr_screener":
      // Screener primary = stretch big if deep range, else role player
      return inputs.deepRange ? "archetype_stretch_big" : "archetype_role_player";
    case "transition":
      return "archetype_transition_threat";
    case "cut":
    case "off_ball":
    case "oreb":
      return "archetype_role_player";
    default:
      return "archetype_versatile";
  }
}

function buildIdentity(
  inputs: EnrichedInputs,
  situations: RankedSituation[],
  rawOutputs: MotorOutput[],
): MotorV4Output["identity"] {
  // Primary archetype = top situation by score
  // Sub-archetype = second situation (if meaningfully different from primary)
  const primarySit = situations[0];
  const secondarySit = situations[1];

  let archetypeKey = "archetype_versatile";
  const archetypeCandidates: Candidate[] = [];

  if (primarySit) {
    archetypeKey = situationToArchetype(primarySit.id, inputs);
  }

  // Sub-archetype: only add if meaningfully different from primary
  if (secondarySit) {
    const subKey = situationToArchetype(secondarySit.id, inputs);
    if (subKey !== archetypeKey && subKey !== "archetype_versatile") {
      archetypeCandidates.push({ key: subKey, score: secondarySit.score });
    }
  }

  // Tertiary: third situation if exists and different
  const tertiarySit = situations[2];
  if (tertiarySit && archetypeCandidates.length < 2) {
    const tertiaryKey = situationToArchetype(tertiarySit.id, inputs);
    if (
      tertiaryKey !== archetypeKey &&
      tertiaryKey !== "archetype_versatile" &&
      !archetypeCandidates.some(c => c.key === tertiaryKey)
    ) {
      archetypeCandidates.push({ key: tertiaryKey, score: tertiarySit.score });
    }
  }

  // Special case: role player override
  // If usage=role AND no situation is primary tier, use role_player regardless
  const hasPrimarySituation = situations.some(s => s.tier === "primary");
  if (inputs.usage === "role" && !hasPrimarySituation) {
    archetypeKey = "archetype_role_player";
  }

  // Special case: playmaker
  // High vision + PnR orchestrator = playmaker as sub if not already present
  if (
    archetypeKey === "archetype_pnr_orchestrator" &&
    inputs.vision >= 5 &&
    inputs.pnrPri === "PF" &&
    !archetypeCandidates.some(c => c.key === "archetype_playmaker")
  ) {
    archetypeCandidates.unshift({ key: "archetype_playmaker", score: 0.75 });
    archetypeCandidates.splice(2); // keep max 2
  }
```

**Mantén** el resto de la función `buildIdentity` exactamente igual (las líneas de
`dangerLevel`, `difficultyLevel`, y el return) — no las toques.

---

## Verification

```bash
cd "/Users/palant/Downloads/U scout"
npm run check
npx tsx scripts/calibrate-motor.ts 2>&1 | tail -5
npx tsx scripts/eval-motor-quality.ts 2>&1 | tail -5
```

Verificar manualmente en local:
- Pika (catch_shoot #1, pnr_ball #2) → archetype_spot_up_shooter + sub pnr_orchestrator
- Kalani (post #1, oreb #2) → archetype_post_scorer + sub role_player (oreb)
- Curry-style (catch_shoot #1, pnr_ball #2, iso #3) → archetype_spot_up_shooter + pnr sub
- Jokic-style (post #1, pnr_ball #2) → archetype_post_scorer + pnr sub
- Role player puro → archetype_role_player
