# Cursor Agent Prompt — ALLOW slot: supresión + UI condicional

## Context
Pasos 1 y 2 del diseño allow_slot_design.md.
Archivos: motor-v4.ts, ReportSlidesV1.tsx.
`npm run check` al final.

---

## CHANGE 1 — motor-v4.ts: buildDefenseInstruction recibe forceWinner

`buildDefenseInstruction` necesita saber qué generó FORCE para suprimir ALLOW
redundante. Hay que pasarle el winner de FORCE cuando calcula ALLOW.

### 1a — Añadir parámetro `forceWinnerKey` a la función

**Busca** la firma de la función:
```typescript
function buildDefenseInstruction(
  rawOutputs: MotorOutput[],
  category: "deny" | "force" | "allow",
  inputs: EnrichedInputs,
): DefenseInstruction {
```

**Reemplaza** con:
```typescript
function buildDefenseInstruction(
  rawOutputs: MotorOutput[],
  category: "deny" | "force" | "allow",
  inputs: EnrichedInputs,
  forceWinnerKey?: string,
): DefenseInstruction {
```

### 1b — Añadir lógica de supresión al inicio del cuerpo de la función

**Busca** (dentro de `buildDefenseInstruction`, justo después de `const sorted = ...`):
```typescript
  const sorted = rawOutputs
    .filter((o) => o.category === category && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const toCandidate = (o: MotorOutput): Candidate => ({
```

**Reemplaza** con:
```typescript
  const sorted = rawOutputs
    .filter((o) => o.category === category && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // ALLOW suppression: return "none" when allow would be redundant with force
  // or when the key is invalid (situationId concatenated with allow_)
  if (category === 'allow' && forceWinnerKey) {
    const INVALID_ALLOW_KEYS = new Set([
      'allow_iso_right', 'allow_iso_left', 'allow_iso_both',
      'allow_pnr_ball', 'allow_catch_shoot', 'allow_transition',
      'allow_off_ball', 'allow_cut', 'allow_floater', 'allow_oreb', 'allow_misc',
    ]);
    const FORCE_DIRECTION_KEYS = new Set([
      'force_direction', 'force_weak_hand',
    ]);
    const winner = sorted[0];
    if (winner) {
      // Suppress if key is invalid (situationId-based)
      if (INVALID_ALLOW_KEYS.has(winner.key)) {
        return { winner: EMPTY_CANDIDATE, alternatives: [] };
      }
      // Suppress allow_iso when force already covers direction
      if (
        (winner.key === 'allow_iso' || winner.key === 'allow_iso_both') &&
        FORCE_DIRECTION_KEYS.has(forceWinnerKey)
      ) {
        return { winner: EMPTY_CANDIDATE, alternatives: [] };
      }
    }
  }

  const toCandidate = (o: MotorOutput): Candidate => ({
```

### 1c — También suprimir en el fallback de allow (cuando sorted.length === 0)

**Busca** dentro de `buildDefenseInstruction` el bloque del fallback:
```typescript
    if (category === 'allow') {
      const denySorted = rawOutputs
```

**Reemplaza** con:
```typescript
    if (category === 'allow') {
      // If force already covers direction, no allow fallback needed
      const FORCE_DIRECTION_KEYS = new Set(['force_direction', 'force_weak_hand']);
      if (forceWinnerKey && FORCE_DIRECTION_KEYS.has(forceWinnerKey)) {
        return { winner: EMPTY_CANDIDATE, alternatives: [] };
      }
      const denySorted = rawOutputs
```

### 1d — También suprimir en el fallback: mapear buckets a keys válidos

**Busca** dentro del fallback de allow:
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
        // Map bucket → valid renderer key (never concatenate allow_ + situationId)
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
        const allowKey = bucketToAllowKey(least.source);
        // If mapped to 'none', suppress entirely
        if (allowKey === 'none') return { winner: EMPTY_CANDIDATE, alternatives: [] };
        return {
          winner: { key: allowKey, score: Math.max(1 - least.weight, 0.3), situationRef: sitId, source: least.source },
          alternatives: genuinelyLow.slice(1, 4).map(o => {
            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? 'misc', inputs);
            return {
              key: bucketToAllowKey(o.source),
              score: Math.max(1 - o.weight, 0.3),
              situationRef: s,
              source: o.source,
            };
          }).filter(c => c.key !== 'none'),
        };
      }
```

### 1e — Pasar forceWinnerKey al llamar a buildDefenseInstruction para allow

**Busca** en `generateMotorV4`:
```typescript
  const defense = {
    deny: buildDefenseInstruction(rawOutputs, "deny", enrichedInputs),
    force: buildDefenseInstruction(rawOutputs, "force", enrichedInputs),
    allow: buildDefenseInstruction(rawOutputs, "allow", enrichedInputs),
  };
```

**Reemplaza** con:
```typescript
  const denyInstruction = buildDefenseInstruction(rawOutputs, "deny", enrichedInputs);
  const forceInstruction = buildDefenseInstruction(rawOutputs, "force", enrichedInputs);
  const allowInstruction = buildDefenseInstruction(
    rawOutputs,
    "allow",
    enrichedInputs,
    forceInstruction.winner.key,
  );
  const defense = {
    deny: denyInstruction,
    force: forceInstruction,
    allow: allowInstruction,
  };
```

---

## CHANGE 2 — ReportSlidesV1.tsx: slot ALLOW condicional

El `DefenseCard` de ALLOW no debe renderizarse cuando el winner es `"none"`.

**Busca** en el slide 3 (donde se renderizan los tres DefenseCard) el bloque
que renderiza el card de allow. Será algo como:
```tsx
            <DefenseCard
              type="allow"
              label={report.defense.allow.label}
              instruction={report.defense.allow.instruction}
              coachMode={coachMode}
              onKebab={() => openSheet(
```

El bloque exacto puede variar. Lo que hay que hacer es envolverlo en una
condición. **Busca** la línea que abre el DefenseCard de allow (la que tiene
`type="allow"`) y añade una condición antes:

La estructura en el JSX será:
```tsx
{/* existing deny card */}
<DefenseCard type="deny" ... />
{/* existing force card */}  
<DefenseCard type="force" ... />
{/* existing allow card — wrap with condition */}
<DefenseCard type="allow" ... />
```

**Envuelve** el DefenseCard de allow con:
```tsx
{report.defense.allow.winner.key !== "none" && (
  <DefenseCard type="allow" ... {/* existing props unchanged */} />
)}
```

Mantén todos los props existentes del DefenseCard de allow sin cambios.
Solo añade el wrapper condicional.

---

## Verification

```bash
cd "/Users/palant/Downloads/U scout"
npm run check
npx tsx scripts/calibrate-motor.ts 2>&1 | tail -5
```

La calibración debe seguir en 100%. Verificar manualmente en local que:
- Pika (PnR Primary + force_weak_hand) → ALLOW desaparece
- Kalani (postFreq Primary) → ALLOW muestra allow_post_opposite o allow_spot_three según config
- Perfiles con allow_spot_three explícito → ALLOW sigue apareciendo
