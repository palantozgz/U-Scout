# Cursor Agent Prompt — Renderer ZH quality upgrade
## Context
`client/src/lib/reportTextRenderer.ts` — función `renderInstructionZH`.

EN/ES usan `inputs` para generar texto dinámico (dirección, atletismo, deepRange, contacto, etc).
ZH tiene strings estáticas en la mayoría de casos. El objetivo es llevar ZH a paridad con EN.

No tocar ningún otro archivo. `npm run check` al final.

---

## Tarea

En `renderInstructionZH`, reemplaza los cases estáticos por versiones dinámicas que repliquen
exactamente la misma lógica condicional que `renderInstructionEN`. Sigue cada case uno a uno:

---

### `deny_iso_space`
EN usa: `inputs.isoDir`, `inputs.ath`

```typescript
case "deny_iso_space": {
  const dirZH = inputs.isoDir === "R" ? "右翼" : inputs.isoDir === "L" ? "左翼" : "两翼";
  const forceZH =
    inputs.isoDir === "R"
      ? "迫使其向左——在其站稳前干扰每次接球。"
      : inputs.isoDir === "L"
        ? "迫使其向右——不让其按惯用方向发起进攻。"
        : "保持身体在球与对手之间——不给轻松接球机会。";
  const athZH = (inputs.ath ?? 3) >= 4 ? " 不要伸手犯规——她善于利用对抗。" : "";
  return `封堵${dirZH}接球。${forceZH}${athZH}`;
}
```
*(Este case ya está bien — verificar que coincide y dejarlo)*

---

### `deny_pnr_downhill`
EN usa: `inputs.deepRange`, `inputs.pnrPri`

```typescript
case "deny_pnr_downhill": {
  const deepZH = inputs.deepRange
    ? "绕过掩护上方——不要走底线。给她急停跳投空间就是失误。"
    : "贴身绕过掩护——不让其舒适接球后中距离出手。";
  const passerZH = inputs.pnrPri === "PF" ? " 她以传球为优先——保持与滚篮者的联系。" : "";
  return `封堵挡拆顺下接球。${deepZH}${passerZH}`;
}
```

---

### `deny_post_entry`
EN usa: `inputs.postShoulder`, `inputs.phys`

```typescript
case "deny_post_entry": {
  const sideZH = inputs.postShoulder === "R" ? "右侧" : inputs.postShoulder === "L" ? "左侧" : "惯用侧";
  const techZH = inputs.phys && inputs.phys >= 4
    ? `封堵${sideZH}低位接球。前防低位——从${sideZH}肩膀四分之三位置，在其完成密封前推高卡位。`
    : `封堵${sideZH}低位接球。四分之三站位——在其完成密封前抢占位置。`;
  const physZH = inputs.phys && inputs.phys >= 4 ? " 她身体对抗强——在球到达前抢到位置。" : "";
  return techZH + physZH;
}
```

---

### `deny_spot_deep`
EN usa: `inputs` via `spotZonesPhraseZH()`, `inputs.spotUpAction`

```typescript
case "deny_spot_deep": {
  const dondeZH = spotZonesPhraseZH(inputs);
  const instantZH = inputs.spotUpAction === "shoot"
    ? "全速补防——无假动作，无犹豫。接球即出手。"
    : "控制补防节奏——补防过快可能被突破利用。";
  return `不让其在${dondeZH}轻松接球。${instantZH} 争抢每次接球机会。`;
}
```
*(Este case ya está bien — verificar y dejar)*

---

### `deny_spot_corner`
EN usa: `cornerFocusZH()`, `inputs.spotUpAction`

```typescript
case "deny_spot_corner": {
  const wcZH = cornerFocusZH(inputs);
  const instZH = inputs.spotUpAction === "shoot"
    ? "长距离快速补防——该区域接球投篮很果断。"
    : "长补防但保持平衡——不给节奏型接球投篮。";
  return `定点进攻时优先照顾${wcZH}。${instZH}`;
}
```
*(Este case ya está bien — verificar y dejar)*

---

### `force_direction`
EN usa: `inputs.hand`, `inputs.deepRange`, `inputs.spotUpFreq`, `inputs.pnrFinishLeft/Right`, `inputs.isoFreq`, `inputs.isoDir`, `inputs.contactFinish`

```typescript
case "force_direction": {
  const weakSideZH = inputs.hand === "R" ? "左侧" : "右侧";
  const isShooterForce =
    inputs.deepRange &&
    inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
    inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
    inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
  if (isShooterForce) {
    return `逼迫其向${weakSideZH}突破——封堵中距离接球机会。她逃避冲击篮筐；靠向${weakSideZH}，迫其进攻禁区。`;
  }
  const isIsoZH = (inputs.isoFreq === "P" || inputs.isoFreq === "S") && inputs.isoDir !== "B";
  if (isIsoZH) {
    const handZH = inputs.hand === "R" ? "右" : "左";
    const cZH = inputs.contactFinish === "seeks" ? ` 保持身体方正——她喜欢从惯用侧寻求对抗。` : "";
    return `在单打中逼迫其向${weakSideZH}——她惯用${handZH}手，在其接球前靠向${weakSideZH}。${cZH}`;
  }
  return `从掩护中逼迫其向${weakSideZH}进攻，该侧终结能力较弱——掩护建立前提早靠位。`;
}
```
*(Este case ya está bien — verificar y dejar)*

---

### `force_early`
EN: texto estático, no usa inputs. ZH actual OK. Dejar como está.

---

### `force_contact`
EN usa: `inputs.hand`

```typescript
case "force_contact": {
  const handZH = inputs.hand === "R" ? "左侧" : "右侧";
  return `每次突破都要身体对抗——她躲避对抗寻找空位终结。靠向${handZH}，让每次上篮都有争抢。`;
}
```
*(Este case ya está bien — verificar y dejar)*

---

### `force_full_court`
EN usa: `inputs.pressureResponse`

```typescript
case "force_full_court":
  return inputs.pressureResponse === "struggles"
    ? "全场紧逼。在过渡防守中压迫持球——她在压力下容易出错。"
    : "主动施压——让球的推进变得困难。";
```

---

### `deny_trans_rim`
ZH actual: `"直接回追篮筐。她在每次失误后全力冲刺——在球到达前卡在她与篮筐之间。"`
EN: `"Sprint directly to the rim. She runs hard on every miss — get between her and the basket before the ball arrives."`
ZH es buena traducción. Dejar como está.

---

### `deny_cut_backdoor` / `deny_cut_basket` / `deny_cut_flash` / `deny_cut_curl`
Añadir estos 4 cases que fueron añadidos en EN/ES pero pueden faltar en ZH:

```typescript
case "deny_cut_backdoor":
  return "保持球侧站位。预判背刺切入——当防守者转头时读出切入时机。同时关注球和身体位置。";
case "deny_cut_basket":
  return "保持球侧。强力切向篮下——不让其在你前面接球。禁区内无轻松接球。";
case "deny_cut_flash":
  return "封堵闪切至肘区，提前卡在传球线上——接球后读切入者并攻击。";
case "deny_cut_curl":
  return "绕掩护追赶弧线切入。不给节奏型接球——接球后立即突破或投篮。";
```
Añadir **antes** del `default` case.

---

### `allow_iso_both`
ZH actual usa `消耗` con carácter potencialmente corrupto. Verificar y limpiar:

```typescript
case "allow_iso_both":
  return "允许双侧单打，单打效率低——让其消耗进攻时间。";
```

---

### `renderAlertText` ZH — añadir cases faltantes

Comparar con EN. Faltan en ZH:
- `post_hook`
- `screen_hold`  
- `physical`
- `aware_deep` (tiene `deep` pero no el key exacto `aware_deep`)

```typescript
if (key.includes("post_hook"))
  return "低位勾手投篮，两侧均可出手，难以预判。";
if (key.includes("screen_hold"))
  return "掩护时间比预期长——滑出来得晚，保持警觉。";
if (key.includes("physical"))
  return "用身体创造空间——存在身体错位风险。";
if (key === "aware_deep")
  return "超远射程威胁——在标准弧线外很远处即可出手。保持防守距离。";
```

Añadir estos 4 bloques en el `if (locale === "zh")` de `renderAlertText`, antes del `return key.replace`.

---

### `renderTriggerCue` ZH — añadir cases faltantes

Faltan en ZH vs EN:
- `post_fade`
- `post_hook`
- `oreb`

```typescript
if (base.includes("post_fade"))
  return "低位接球后感觉到防守者在右肩——后仰跳投即将出手。";
if (base.includes("post_hook"))
  return "低位接球并转身——勾手可从任意一侧出手。";
if (base.includes("oreb"))
  return "每次出手——她在球到达前就已经开始卡位。";
```

Añadir en el `if (locale === "zh")` de `renderTriggerCue`, antes del `return "每次进攻都需注意。"`.

---

## Verificación

```bash
cd "/Users/palant/Downloads/U scout"
npm run check
npx tsx scripts/calibrate-motor.ts 2>&1 | tail -5
npx tsx scripts/eval-motor-quality.ts 2>&1 | tail -5
```

Ambos scripts deben mantener sus scores actuales (551/551 y 42/46).
No se espera mejora en el quality eval — los tests son EN only.
