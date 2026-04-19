# Cursor Agent Prompt — Renderer ZH + Pending improvements

## Contexto
Archivo: `client/src/lib/reportTextRenderer.ts`
Función: `renderInstructionZH(key, inputs)` (línea ~873)

Las funciones EN y ES ya fueron mejoradas con textos específicos, ejecutables y con contexto (CUÁNDO + CÓMO). El bloque ZH está desactualizado — textos cortos y genéricos. También hay keys nuevas sin cobertura ZH.

**NO tocar**: ningún otro archivo. Solo `reportTextRenderer.ts`.
**Después de cada cambio**: `npm run check` para verificar TypeScript.

---

## TAREA 1 — Actualizar textos ZH con calidad equivalente a EN/ES

Reemplaza los siguientes `case` en `renderInstructionZH`:

### `deny_iso_space`
```typescript
// REEMPLAZAR:
case "deny_iso_space":
  return inputs.isoDir === "R"
    ? "封堵右翼接球，迫使其向左运球。"
    : "封堵左翼接球，迫使其向右运球。";

// POR:
case "deny_iso_space": {
  const dirZH = inputs.isoDir === "R" ? "右翼" : inputs.isoDir === "L" ? "左翼" : "两翼";
  const forceZH = inputs.isoDir === "R"
    ? "迫使其向左——在其站稳前干扰每次接球。"
    : inputs.isoDir === "L"
      ? "迫使其向右——不让其按惯用方向发起进攻。"
      : "保持身体在球与对手之间——不给轻松接球机会。";
  const athZH = (inputs.ath ?? 3) >= 4 ? " 不要伸手犯规——她善于利用对抗。" : "";
  return `封堵${dirZH}接球。${forceZH}${athZH}`;
}
```

### `deny_pnr_downhill`
```typescript
// REEMPLAZAR:
case "deny_pnr_downhill":
  return "封堵挡拆下坡进攻，绕过掩护，不要走底线。";

// POR:
case "deny_pnr_downhill": {
  const deepZH = inputs.deepRange
    ? "绕过掩护，不要走底线——给她急停跳投机会就是失误。"
    : "紧贴绕过掩护，不让其舒适接球后中距离出手。";
  const passerZH = inputs.pnrPri === "PF" ? " 她以传球为优先——保持与滚篮者的联系。" : "";
  return `封堵挡拆接球。${deepZH}${passerZH}`;
}
```

### `deny_post_entry`
```typescript
// REEMPLAZAR:
case "deny_post_entry":
  return "封堵低位接球，保持前防位置。";

// POR:
case "deny_post_entry": {
  const sideZH = inputs.postShoulder === "R" ? "右侧" : inputs.postShoulder === "L" ? "左侧" : "惯用侧";
  const techZH = inputs.phys && inputs.phys >= 4
    ? `前防${sideZH}低位，从${sideZH}肩膀四分之三位置封堵——将其推高，不让其建立深位。`
    : `封堵${sideZH}低位接球，四分之三位置——在其完成密封前抢占位置。`;
  const physZH = inputs.phys && inputs.phys >= 4 ? " 她身体对抗强——在球到达前抢到位置。" : "";
  return techZH + physZH;
}
```

### `deny_spot_deep`
```typescript
// REEMPLAZAR:
case "deny_spot_deep":
  return "封堵远距离接球，提前补防。";

// POR:
case "deny_spot_deep": {
  const instantZH = inputs.spotUpAction === "shoot"
    ? "全速补防——无假动作，无犹豫。接球即出手。"
    : "控制补防节奏——补防过快可能被突破利用。";
  return `不让其干净接球。${instantZH} 争抢每次接球机会。`;
}
```

### `deny_trans_rim`
```typescript
// REEMPLAZAR:
case "deny_trans_rim":
  return "全速回防，不让其快攻上篮。";

// POR:
case "deny_trans_rim":
  return "直接回追篮筐。她在每次失误后全力冲刺——在球到达前卡在她与篮筐之间。";
```

### `force_direction`
```typescript
// REEMPLAZAR 整个 case（已有部分逻辑，需扩展）:
case "force_direction": {
  const weakSide = inputs.hand === "R" ? "左侧" : "右侧";
  const isShooterForce = inputs.deepRange &&
    inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
    inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
    inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
  if (isShooterForce) {
    return `逼迫其向${weakSide}突破——封堵中距离接球机会。她逃避冲击篮筐，靠向${weakSide}，迫其进攻禁区。`;
  }
  const isIsoZH = (inputs.isoFreq === "P" || inputs.isoFreq === "S") && inputs.isoDir !== "B";
  if (isIsoZH) {
    const cZH = inputs.contactFinish === "seeks" ? ` 保持身体方正——她喜欢从惯用侧寻求对抗。` : "";
    return `在单打中逼迫其向${weakSide}——她惯用右手，在其接球前靠向${weakSide}。${cZH}`;
  }
  return `从掩护中逼迫其向${weakSide}进攻，该侧终结能力较弱——掩护建立前提早靠位。`;
}
```

### `force_early`
```typescript
// REEMPLAZAR:
case "force_early":
  return "逼迫其在进攻时间早期出手，持续施压不让其站稳。";

// POR:
case "force_early":
  return "逼迫其在前三秒出手。从一开始就紧逼——她需要时间来创造机会。";
```

### `allow_iso`
```typescript
// REEMPLAZAR:
case "allow_iso":
  return "在非主要进攻位置允许单打，效率低，让其消耗进攻时间。";

// POR:
case "allow_iso":
  return "允许单打。她持球创造的效率偏低——给球，保持直立姿势，封堵出手。";
```

### `allow_spot_three`
```typescript
// REEMPLAZAR:
case "allow_spot_three":
  return "允许定点三分，射程有限，命中率偏低。";

// POR:
case "allow_spot_three":
  return "允许外线接球。射程有限——中远距离两分是她最好的外线选择。专注保护禁区。";
```

### `allow_distance`
```typescript
// REEMPLAZAR lo que haya actualmente para allow_distance en ZH
// Si no existe, AÑADIR antes del default:
case "allow_distance":
  return "松防。无外线射程——允许接球，专注保护禁区和卡位篮板。";
```

### `force_contact`
```typescript
// REEMPLAZAR:
case "force_contact":
  return "逼迫对抗——每次突破都要身体对抗，不给轻松上篮机会。";

// POR:
case "force_contact": {
  const handZH = inputs.hand === "R" ? "左侧" : "右侧";
  return `每次突破都要身体对抗——她躲避对抗寻找空位终结。靠向${handZH}，让每次上篮都有争抢。`;
}
```

### `deny_oreb`
```typescript
// REEMPLAZAR:
// (busca el case deny_oreb en ZH y reemplaza)
case "deny_oreb":
  return "出手前找到她——不是出手后。提前身体卡位。每次进攻她都冲抢篮板。";
```

---

## TAREA 2 — Añadir keys nuevas que faltan en ZH

Busca en `renderInstructionZH` los siguientes `case` y AÑÁDELOS si no existen (antes del `default`):

```typescript
case "aware_instant_shot":
  return "补防时立即出手——无假动作，无犹豫。";

case "allow_pnr_mid_range":
  return "允许挡拆后中距离跳投，无远射程——中距离是效率最低的投篮，专注快攻和切入防守。";

case "allow_iso_both":
  return "允许双侧单打，单打效率低——让其消耗进攻时间。";

case "deny_duck_in":
  return "封堵低位切入接球。提前卡位——她深度密封后接球即可轻松终结。";

case "allow_post":
case "allow_post_right":
case "allow_post_left":
  return "允许低位进攻，低位威胁有限——松防并协助内线。";

case "deny_ball_advance":
  return "施压运球推进，压力下处理球能力有限——在半场早期进行干扰。";

case "force_paint_deny":
  return "将其逼离禁区——迫使在外线接球，不在内线。";

case "force_no_ball":
  return "封堵接球。运球是弱项——每次持球都要上抢。";
```

---

## TAREA 3 — Alert texts ZH

Busca la función de alerts en ZH (función que genera `triggerCue` o `text` para alertas). Actualiza:

```typescript
// Busca el equivalente ZH de estos alert texts y actualiza:

// aware_passer:
// ANTES: "传球视野极佳，夹击时能立刻找到出球点。"
// DESPUÉS: "传球精英——补防闭合前头部已抬起寻找出球。保持与滚篮者的联系。"

// aware_instant_shot:  
// ANTES: "补防时立即出手——无假动作，无犹豫。"
// DESPUÉS: 同上（ya correcto si se añadió en Tarea 2）

// aware_pressure_vuln:
// ANTES: cualquier texto que haya
// DESPUÉS: "压力下易出错。接球时主动施压——在其站稳前干扰。"
```

---

## Verificación final

```bash
cd "/Users/palant/Downloads/U scout" && npm run check
npx tsx scripts/calibrate-motor.ts
```

Debe: TypeScript sin errores, calibración 100% (66/66 perfiles).
