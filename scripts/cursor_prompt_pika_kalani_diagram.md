# Cursor Agent Prompt — Pika closeout + Kalani transition + Half-court shooting diagram

## Context
3 cambios en una ejecución. `npm run check` al final.

---

## CHANGE 1 — motor-v2.1.ts: `deny_spot_deep` para tiradores primarios sin deepRange

**Problema:** Pika (`spotUpFreq=P`, `spotZone=top`, `deepRange=false`) no recibe `deny_spot_deep` porque el motor solo lo emite cuando `deepRange=true`. Una tiradora primaria excelente merece instrucción de closeout agresivo aunque no tenga deepRange.

**Busca** el bloque que emite `deny_spot_deep` — comienza con:
```
if (inputs.deepRange && inputs.spotUpFreq && inputs.spotUpFreq !== 'N') {
```

**Reemplaza** ese bloque entero con:
```typescript
    // deny_spot_deep: primary spot-up shooters ALWAYS deserve an explicit closeout instruction,
    // even without deepRange. A primary spot-up threat at the top/wing is a high-value shot.
    // deepRange adds weight but is not required for Primary frequency.
    if (inputs.spotUpFreq && inputs.spotUpFreq !== 'N') {
      if (inputs.deepRange) {
        const spotWeight = inputs.spotUpFreq === 'P' ? 0.98 : inputs.spotUpFreq === 'S' ? 0.82 : 0.62;
        outputs.push({
          key: 'deny_spot_deep',
          category: 'deny',
          weight: spotWeight,
          source: 'deep_range'
        });
      } else if (inputs.spotUpFreq === 'P') {
        // Primary spot-up without deepRange: still a major threat — aggressive closeout required.
        // Weight capped at 0.80 (below deepRange 0.98 — she can't shoot from 7m+ but still dangerous)
        outputs.push({
          key: 'deny_spot_deep',
          category: 'deny',
          weight: 0.80,
          source: 'deep_range'
        });
      }
    }
```

---

## CHANGE 2 — motor-v2.1.ts: suprimir `deny_spot_deep` secondary (no-deepRange) cuando pop screener ya lo suprime

El bloque de screener pop ya suprime `deny_spot_deep` para pop screeners con deepRange. Verificar que ese suppress también funciona para el nuevo caso sin deepRange. Buscar:
```typescript
          const spotDeepIdx = outputs.findIndex(o => o.key === 'deny_spot_deep');
          if (spotDeepIdx >= 0) outputs[spotDeepIdx].weight = 0.0;
```
Este bloque ya está dentro de `if (inputs.deepRange)` — moverlo fuera para que funcione también cuando `deepRange=false`:

Busca exactamente:
```typescript
        if (inputs.deepRange) {
          outputs.push({
            key: 'deny_pnr_pop',
            category: 'deny',
            weight: 0.98,
            source: 'screener_pop',
          });

          // For pop screener with deep range: deny_pnr_pop is the correct primary instruction.
          // Suppress deny_spot_deep — the threat is off the screen, not a generic spot-up.
          const spotDeepIdx = outputs.findIndex(o => o.key === 'deny_spot_deep');
          if (spotDeepIdx >= 0) outputs[spotDeepIdx].weight = 0.0;
        } else {
```

Reemplaza con:
```typescript
        if (inputs.deepRange) {
          outputs.push({
            key: 'deny_pnr_pop',
            category: 'deny',
            weight: 0.98,
            source: 'screener_pop',
          });
        } else {
          outputs.push({
            key: 'deny_pnr_pop',
            category: 'deny',
            weight: 0.80,
            source: 'screener_pop',
          });
        }
        // For pop screener: deny_pnr_pop is always the correct primary instruction.
        // Suppress deny_spot_deep regardless of deepRange — the threat is off the screen.
        const spotDeepIdx = outputs.findIndex(o => o.key === 'deny_spot_deep');
        if (spotDeepIdx >= 0) outputs[spotDeepIdx].weight = 0.0;
```

---

## CHANGE 3 — motor-v2.1.ts: añadir SOURCE_TO_SITUATION entry para nuevo source

En `SOURCE_TO_SITUATION`, ya existe `deep_range: 'spot'`. No hay que añadir nada — el nuevo output usa el mismo source `'deep_range'`. ✅ No change needed.

---

## CHANGE 4 — motor-v2.1.ts: calibration check — añadir perfil Pika spot-up

En `scripts/calibrate-motor.ts`, busca el perfil `cal_pika_pressure_break` y añade un nuevo perfil justo después:

```typescript
  {
    id: "cal_pika_spot_primary",
    name: "Pika-style — tiradora primaria sin deepRange, zona top",
    note: "perimeterThreats=Primary + spotZone=top + deepRange=false → debe generar deny_spot_deep con peso reducido",
    inputs: {
      pos: "PG", hand: "R", ath: 5, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF",
      trapResponse: "struggle",
      spotUpFreq: "P", spotZone: "top", deepRange: false,
      isoFreq: "R", postFreq: "N", transFreq: "P",
      offHandFinish: "capable", contactFinish: "avoids",
      floater: "N", isoDir: null, isoDec: null, isoEff: null,
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrFinishLeft: "Mid-range", pnrFinishRight: "Mid-range",
      screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null,
      ballHandling: "elite", pressureResponse: "breaks",
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 4,
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill", "deny_spot_deep"],
      top_situations: ["pnr_ball", "catch_shoot"],
      danger_min: 4,
    },
  },
```

---

## CHANGE 5 — PlayerEditor.tsx + mock-data.ts: Half-court shooting diagram

### 5a — mock-data.ts: asegurar que SpotZones ya existe en PlayerInput

`SpotZones` y `spotZones?: SpotZones | null` ya existen en `PlayerInput`. ✅ No change needed.

### 5b — PlayerEditor.tsx: reemplazar el selector de zona (corner/wing/top) con diagrama de media pista

**Busca** en PlayerEditor.tsx la sección de zona preferida spot-up. Comienza con:
```tsx
                  {/* Zona preferida */}
                  <div className="space-y-2">
                    <FieldLabel label={t("spot_zone")} tooltip={t("hint_spot_zone")} />
                    <div className="flex flex-wrap gap-3">
                      {([{ v: "corner" as const, lk: "opt_spot_zone_corner" }, { v: "wing" as const, lk: "opt_spot_zone_wing" }, { v: "top" as const, lk: "opt_spot_zone_top" }] as const).map(({ v, lk }) => (
```

**Reemplaza** todo ese bloque `<div className="space-y-2">` hasta su cierre `</div>` con el componente de diagrama:

```tsx
                  {/* Zonas de tiro — diagrama media pista */}
                  <div className="space-y-2">
                    <FieldLabel label={locale === "es" ? "Zonas de tiro" : "Shooting zones"} tooltip={locale === "es" ? "Marca las zonas donde es más peligrosa. Toca para activar/desactivar." : "Tap zones to mark where she is most dangerous."} />
                    <HalfCourtZoneSelector
                      value={(inputs as any).spotZones ?? null}
                      legacyZone={(inputs as any).spotZone ?? null}
                      onChange={(zones) => {
                        ui("spotZones" as any, zones);
                        // Keep legacy spotZone in sync for backwards compat
                        if (!zones) { ui("spotZone" as any, null); return; }
                        const hasCorner = zones.cornerLeft || zones.cornerRight;
                        const hasWing = zones.wing45Left || zones.wing45Right;
                        const hasTop = zones.top;
                        if (hasCorner && !hasWing && !hasTop) ui("spotZone" as any, "corner");
                        else if (hasWing && !hasCorner && !hasTop) ui("spotZone" as any, "wing");
                        else if (hasTop && !hasCorner && !hasWing) ui("spotZone" as any, "top");
                        else ui("spotZone" as any, null);
                      }}
                    />
                  </div>
```

### 5c — PlayerEditor.tsx: añadir el componente HalfCourtZoneSelector

Añade este componente **antes** de la función principal `PlayerEditorPage` (o junto a los otros componentes auxiliares del archivo):

```tsx
// ─── Half-court zone selector ─────────────────────────────────────────────────
interface SpotZonesValue {
  cornerLeft: boolean;
  wing45Left: boolean;
  top: boolean;
  wing45Right: boolean;
  cornerRight: boolean;
}

function HalfCourtZoneSelector({
  value,
  legacyZone,
  onChange,
}: {
  value: SpotZonesValue | null;
  legacyZone: "corner" | "wing" | "top" | null;
  onChange: (zones: SpotZonesValue | null) => void;
}) {
  // Hydrate from legacy single zone if spotZones not set
  const zones: SpotZonesValue = value ?? (() => {
    const z: SpotZonesValue = { cornerLeft: false, wing45Left: false, top: false, wing45Right: false, cornerRight: false };
    if (legacyZone === "corner") { z.cornerLeft = true; z.cornerRight = true; }
    if (legacyZone === "wing") { z.wing45Left = true; z.wing45Right = true; }
    if (legacyZone === "top") { z.top = true; }
    return z;
  })();

  const toggle = (key: keyof SpotZonesValue) => {
    const next = { ...zones, [key]: !zones[key] };
    const anyActive = Object.values(next).some(Boolean);
    onChange(anyActive ? next : null);
  };

  // Zone color: active = amber/orange gradient by threat level
  const zoneClass = (active: boolean) =>
    active
      ? "fill-amber-400 stroke-amber-500 opacity-90 cursor-pointer transition-all"
      : "fill-slate-200 dark:fill-slate-700 stroke-slate-300 dark:stroke-slate-600 opacity-60 cursor-pointer hover:opacity-80 transition-all";

  const labelClass = (active: boolean) =>
    active ? "fill-slate-900 font-bold text-[10px]" : "fill-slate-500 dark:fill-slate-400 text-[10px]";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 280 170"
        className="w-full max-w-xs rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
        style={{ touchAction: "manipulation" }}
      >
        {/* Court background */}
        <rect x="0" y="0" width="280" height="170" className="fill-slate-50 dark:fill-slate-900" />

        {/* Paint / key */}
        <rect x="100" y="90" width="80" height="80" rx="2" className="fill-slate-200 dark:fill-slate-700 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />

        {/* Free throw line */}
        <line x1="100" y1="90" x2="180" y2="90" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />

        {/* Three-point arc — approximate */}
        <path d="M 40,170 A 105,105 0 0,1 240,170" className="fill-none stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />
        {/* Corner straight lines */}
        <line x1="40" y1="140" x2="40" y2="170" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />
        <line x1="240" y1="140" x2="240" y2="170" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />

        {/* Basket */}
        <circle cx="140" cy="155" r="6" className="fill-none stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" />
        <line x1="134" y1="163" x2="146" y2="163" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" />

        {/* ── ZONE: Corner Left ── */}
        <polygon
          points="0,170 40,170 40,140 0,140"
          className={zoneClass(zones.cornerLeft)}
          strokeWidth="1.5"
          onClick={() => toggle("cornerLeft")}
        />
        <text x="20" y="158" textAnchor="middle" className={labelClass(zones.cornerLeft)}>CL</text>

        {/* ── ZONE: Corner Right ── */}
        <polygon
          points="240,170 280,170 280,140 240,140"
          className={zoneClass(zones.cornerRight)}
          strokeWidth="1.5"
          onClick={() => toggle("cornerRight")}
        />
        <text x="260" y="158" textAnchor="middle" className={labelClass(zones.cornerRight)}>CR</text>

        {/* ── ZONE: Wing 45 Left ── */}
        <path
          d="M 0,140 L 40,140 A 105,105 0 0,1 90,60 L 60,30 L 0,30 Z"
          className={zoneClass(zones.wing45Left)}
          strokeWidth="1.5"
          onClick={() => toggle("wing45Left")}
        />
        <text x="32" y="100" textAnchor="middle" className={labelClass(zones.wing45Left)}>WL</text>

        {/* ── ZONE: Wing 45 Right ── */}
        <path
          d="M 240,140 L 280,140 L 280,30 L 220,30 L 190,60 A 105,105 0 0,1 240,140 Z"
          className={zoneClass(zones.wing45Right)}
          strokeWidth="1.5"
          onClick={() => toggle("wing45Right")}
        />
        <text x="248" y="100" textAnchor="middle" className={labelClass(zones.wing45Right)}>WR</text>

        {/* ── ZONE: Top of key ── */}
        <path
          d="M 60,30 L 90,60 A 105,105 0 0,1 190,60 L 220,30 Z"
          className={zoneClass(zones.top)}
          strokeWidth="1.5"
          onClick={() => toggle("top")}
        />
        <text x="140" y="52" textAnchor="middle" className={labelClass(zones.top)}>TOP</text>
      </svg>

      {/* Reset */}
      {Object.values(zones).some(Boolean) && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
        >
          {/* clear */}
          ✕ clear
        </button>
      )}
    </div>
  );
}
```

---

## CHANGE 6 — mock-data.ts: bridge — usar spotZones en motor cuando disponible

En `playerInputToMotorInputs`, ya existe esta línea:
```typescript
    spotZones: inputs.spotZones ?? legacySpotZoneToSpotZones(inputs.spotZone) ?? null,
```
✅ Ya funciona. No change needed.

---

## Verification

```bash
cd "/Users/palant/Downloads/U scout"
npm run check
npx tsx scripts/calibrate-motor.ts 2>&1 | tail -10
npx tsx scripts/eval-motor-quality.ts 2>&1 | tail -5
```

Calibración debe mantener 100% + pasar el nuevo perfil `cal_pika_spot_primary`.
Quality eval sin cambios (42/46).

---

## Notas de diseño

**Por qué 0.80 para Primary sin deepRange:**
Una tiradora primaria excelente de 3 normal merece closeout agresivo. El 0.80 la pone por debajo de deepRange (0.98) pero por encima del threshold de eligibilidad (0.70), garantizando que aparece en el DENY slot.

**Por qué el diagrama reemplaza los pills:**
Los pills (corner/wing/top) son mutuamente excluyentes y no capturan amenazas múltiples. Pika tira de top Y puede abrir a wing. El diagrama de 5 zonas clicables permite combinaciones y es más intuitivo en móvil.

**Retrocompatibilidad:**
El bridge `spotZones → legacySpotZoneToSpotZones` sigue funcionando para perfiles guardados sin spotZones. El cambio en el editor no rompe perfiles existentes.
