# U Scout — Diseño ALLOW slot (decisiones de producto)

## Principio rector

ALLOW solo aparece cuando aporta información táctica nueva que DENY y FORCE no cubren.
Si no hay nada que decir, el slot desaparece en la UI y el espacio puede ocuparse
con un segundo AWARE u otro output de mayor valor.

---

## Reglas de emisión — motor v2.1

ALLOW se emite cuando se cumple UNA de estas condiciones:

### Caso 1 — Complementa FORCE de dirección (Tier 1)
- FORCE es `force_direction` o `force_weak_hand` hacia lado X
- El jugador tiene `offHandFinish = weak` o `contactFinish = avoids`
- Output: `allow_drive_weak_side`
- Texto: "Si te supera yendo a X, deja que llegue al aro — la finalización
  débil/el contacto es peor para ella que el pull-up que estás negando"
- NO emitir si FORCE ya dice exactamente esto

### Caso 2 — Floater de baja eficiencia (Tier 2)
- `floater = R/S` + eficiencia baja inferida (`offHandFinish = weak` + `ath <= 3`)
- DENY no es `deny_floater`
- Output: `allow_floater`
- Texto: "Concede el floater — no es su mejor arma. Niega el drive al aro y el pull-up limpio"

### Caso 3 — Mid-range sin deepRange (Tier 2)
- `deepRange = false` + DENY de spot-up activo + `pnrFinish != Mid-range`
- Output: `allow_mid_range_close`
- Texto: "Recupera rápido hacia el aro — concede la media si necesario. El triple es más caro"

### Caso 4 — Poste de un solo bloque (Tier 2)
- `postFreq = P` + `postShoulder` definido
- Output: `allow_post_opposite`
- Texto: "Permite el posteo en el bloque contrario — su eficiencia cae fuera del preferido"

### Caso 5 — ISO ineficiente SIN FORCE de dirección (Tier 1)
- `isoFreq` activo + `isoEff = low`
- NO hay `force_direction` ni `force_weak_hand` en outputs de FORCE
- Output: `allow_iso`
- Texto activo: cruza contacto + mano débil + PnR si aplica

---

## Reglas de supresión — motor v4

Motor v4 devuelve `key: "none"` cuando:

1. Winner de ALLOW es `allow_iso` Y winner de FORCE es `force_direction` o
   `force_weak_hand` → duplicidad de dirección
2. Winner de ALLOW es key inválido (contiene situationId concatenado:
   `allow_iso_right`, `allow_catch_shoot`, etc.) → siempre suprimir
3. ALLOW score < 0.25

Motor v4 pasa el winner de FORCE a `buildDefenseInstruction` como parámetro
para aplicar supresión cruzada.

---

## Cambio en UI — ReportSlidesV1.tsx

```tsx
{report.defense.allow.winner.key !== "none" && (
  <DefenseCard type="allow" ... />
)}
```

Espacio liberado → segunda AWARE si existe, o más respiro visual.

---

## Nuevo output — allow_drive_weak_side (Tier 1)

Condición en motor v2.1 (después de calcular FORCE outputs):
```typescript
const hasForceDir = outputs.some(o =>
  o.key === 'force_direction' || o.key === 'force_weak_hand'
);
if (
  hasForceDir &&
  (inputs.offHandFinish === 'weak' || inputs.contactFinish === 'avoids') &&
  inputs.isoFreq && inputs.isoFreq !== 'N'
) {
  outputs.push({
    key: 'allow_drive_weak_side',
    category: 'allow',
    weight: 0.70,
    source: 'allow_weak_side',
  });
}
```

---

## Orden de implementación (sin desandar camino)

1. Motor v4: supresión ALLOW redundante con FORCE
2. UI: slot condicional (key === "none" → no renderiza)
3. Motor v2.1 + renderer: `allow_drive_weak_side` EN/ES/ZH
4. Motor v2.1 + renderer: `allow_post_opposite`
5. Motor v2.1 + renderer: `allow_floater` / `allow_mid_range_close`
