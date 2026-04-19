"""
Motor inference network fixes — Priority 1 + 2
"""
import re

# ─── mock-data.ts fixes ────────────────────────────────────────────────────────
path_md = '/Users/palant/Downloads/U scout/client/src/lib/mock-data.ts'
with open(path_md, 'r') as f:
    md = f.read()

fixes_md = []

# FIX 1: spotZone hardcoded null → map from inputs
old = '    spotZone: null,'
new = '    spotZone: (inputs as any).spotZone ?? null,'
if old in md:
    md = md.replace(old, new, 1)
    fixes_md.append('OK spotZone mapped')
else:
    fixes_md.append('NOT FOUND spotZone')

# FIX 2: orebThreat — infer medium for C/PF with phys>=4 if not set
# Currently: "Never" → "low" for orebThreat
# Add: pos=C or PF with phys>=4 and orebFreq=Never → medium
old2 = '''  const orebThreat: PlayerInputs["orebThreat"] =
    inputs.offensiveReboundFrequency === "Primary"
      ? "high"
      : inputs.offensiveReboundFrequency === "Secondary"
        ? "medium"
        : inputs.offensiveReboundFrequency === "Rare"
          ? "low"
          : "low";'''

new2 = '''  const orebThreat: PlayerInputs["orebThreat"] = (() => {
    if (inputs.offensiveReboundFrequency === "Primary") return "high";
    if (inputs.offensiveReboundFrequency === "Secondary") return "medium";
    if (inputs.offensiveReboundFrequency === "Rare") return "low";
    // Never / unset: infer medium for interior players with strength — they crash boards by default
    if ((pos === "C" || pos === "PF") && phys >= 4) return "medium";
    return "low";
  })();'''

if old2 in md:
    md = md.replace(old2, new2)
    fixes_md.append('OK orebThreat interior inference')
else:
    fixes_md.append('NOT FOUND orebThreat')

with open(path_md, 'w') as f:
    f.write(md)

print('\n'.join(fixes_md))

# ─── motor-v2.1.ts fixes ────────────────────────────────────────────────────────
path_m = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path_m, 'r') as f:
    motor = f.read()

fixes_m = []

# FIX 3: force_weak_hand — suppress if isoWeakHandFinish=drive (ambidextrous finisher)
old3 = '''    // =========================================================================
    // Force weak hand
    // =========================================================================
    if (inputs.offHandFinish === 'weak') {
      const weakHand = inputs.hand === 'R' ? 'L' : 'R';
      if (inputs.contactFinish === 'avoids') {
        outputs.push({
          key: 'force_contact',
          category: 'force',
          weight: 0.85,
          params: { hand: weakHand, instruction: 'physical_to_weak_hand' },
          source: 'contact_weak_hand_combined',
        });
      } else {
        outputs.push({
          key: 'force_weak_hand',
          category: 'force',
          weight: w.forceRules.weakHand.baseWeight + w.forceRules.weakHand.offHandWeakBonus,
          params: { hand: weakHand },
          source: 'off_hand',
        });
      }
    }'''

new3 = '''    // =========================================================================
    // Force weak hand
    // =========================================================================
    if (inputs.offHandFinish === 'weak') {
      const weakHand = inputs.hand === 'R' ? 'L' : 'R';
      // Suppress force_weak_hand if scout observed the player drives with weak hand too —
      // isoWeakHandFinish=drive means they CAN finish on the off-hand despite low efficiency.
      // In that case, generate aware_hands instead (ambidextrous finisher, just less efficient).
      const canFinishWeakHand = inputs.isoWeakHandFinish === 'drive';
      if (canFinishWeakHand) {
        // Ambidextrous but less efficient on weak side — warn but don\'t force
        if (!outputs.some(o => o.key === 'aware_hands')) {
          outputs.push({
            key: 'aware_hands',
            category: 'aware',
            weight: 0.65,
            source: 'both_hands',
          });
        }
      } else if (inputs.contactFinish === 'avoids') {
        outputs.push({
          key: 'force_contact',
          category: 'force',
          weight: 0.85,
          params: { hand: weakHand, instruction: 'physical_to_weak_hand' },
          source: 'contact_weak_hand_combined',
        });
      } else {
        outputs.push({
          key: 'force_weak_hand',
          category: 'force',
          weight: w.forceRules.weakHand.baseWeight + w.forceRules.weakHand.offHandWeakBonus,
          params: { hand: weakHand },
          source: 'off_hand',
        });
      }
    }'''

if old3 in motor:
    motor = motor.replace(old3, new3)
    fixes_m.append('OK force_weak_hand ambidextrous suppression')
else:
    fixes_m.append('NOT FOUND force_weak_hand block')

# FIX 4: force_full_court — modulate by ath
old4 = '''    if (inputs.pressureResponse === 'struggles') {
      if (inputs.ballHandling !== 'elite') {
        outputs.push({
          key: 'force_full_court',
          category: 'force',
          weight: w.forceRules.fullCourt.baseWeight,
          source: 'pressure_struggles',
        });
      }'''

new4 = '''    if (inputs.pressureResponse === 'struggles') {
      if (inputs.ballHandling !== 'elite') {
        // Athletic players who struggle with pressure are harder to trap — reduce weight
        // Low athleticism + struggles = very easy to pressure full court
        const athPenalty = inputs.ath >= 4 ? 0.15 : inputs.ath <= 2 ? 0 : 0.08;
        outputs.push({
          key: 'force_full_court',
          category: 'force',
          weight: Math.max(w.forceRules.fullCourt.baseWeight - athPenalty, 0.5),
          source: 'pressure_struggles',
        });
      }'''

if old4 in motor:
    motor = motor.replace(old4, new4)
    fixes_m.append('OK force_full_court ath modulation')
else:
    fixes_m.append('NOT FOUND force_full_court block')

# FIX 5: aware_instant_shot for immediate-release shooters
# Insert after the deep_range deny block
old5 = '''    // ALLOW spot-up threes when poor shooter
    if (
      !inputs.deepRange &&
      (inputs.spotUpFreq === 'N' || inputs.spotUpFreq === 'R') &&
      inputs.isoFreq !== 'P'
    ) {'''

new5 = '''    // aware_instant_shot: shooter who fires immediately on closeout — no hesitation, no drive
    // This is the most actionable closeout instruction: arrive high and fast at the catch.
    if (
      inputs.deepRange &&
      inputs.spotUpFreq === 'P' &&
      inputs.spotUpAction === 'shoot'
    ) {
      outputs.push({
        key: 'aware_instant_shot',
        category: 'aware',
        weight: 0.75,
        source: 'deep_range',
      });
    }

    // ALLOW spot-up threes when poor shooter
    if (
      !inputs.deepRange &&
      (inputs.spotUpFreq === 'N' || inputs.spotUpFreq === 'R') &&
      inputs.isoFreq !== 'P'
    ) {'''

if old5 in motor:
    motor = motor.replace(old5, new5)
    fixes_m.append('OK aware_instant_shot added')
else:
    fixes_m.append('NOT FOUND spot-up allow block')

# FIX 6: aware_pressure_vuln — differentiate trap vs individual pressure
# Add params to distinguish context
old6 = '''      outputs.push({
        key: 'aware_pressure_vuln',
        category: 'aware',
        weight: 0.8,
        source: 'pressure_struggles'
      });'''

new6 = '''      // Distinguish: trap context (trapResponse=struggle) vs individual pressure (pressureResponse=struggles)
      const trapCtx = inputs.trapResponse === 'struggle';
      const pressCtx = inputs.pressureResponse === 'struggles';
      outputs.push({
        key: 'aware_pressure_vuln',
        category: 'aware',
        weight: 0.8,
        source: 'pressure_struggles',
        params: {
          context: trapCtx && !pressCtx ? 'trap_only' : pressCtx && !trapCtx ? 'individual' : 'both',
        },
      });'''

if old6 in motor:
    motor = motor.replace(old6, new6)
    fixes_m.append('OK aware_pressure_vuln context params')
else:
    fixes_m.append('NOT FOUND aware_pressure_vuln block')

# FIX 7: pnrSnake — add logic (after the PnR finish asymmetry block)
# pnrSnake=true means they reverse direction off the screen — this neutralizes the side-based forcing
old7 = '''      if (inputs.trapResponse === 'struggle') {
        // force_trap is a team action — in 1-on-1 context, reduce weight if player is'''

new7 = '''      // pnrSnake: if the handler reverses direction off the screen (snake dribble),
      // the side-based force_direction is less reliable — they can escape to either side.
      if (inputs.pnrSnake) {
        const dirIdx = outputs.findIndex(o => o.key === 'force_direction' &&
          (o.source === 'pnr_finish_asymmetry' || o.source === 'pnr_shooter_weak_side'));
        if (dirIdx >= 0) {
          // Reduce weight — snake partially neutralizes directional forcing
          outputs[dirIdx].weight = Math.max(outputs[dirIdx].weight * 0.70, 0.5);
          outputs[dirIdx].params = { ...(outputs[dirIdx].params ?? {}), note: 'snake_reduces_certainty' };
        }
        outputs.push({
          key: 'aware_screen_hold',  // closest existing aware for screen complexity
          category: 'aware',
          weight: 0.68,
          source: 'screen_timing',
          params: { note: 'snake_dribble_possible' },
        });
      }

      if (inputs.trapResponse === 'struggle') {
        // force_trap is a team action — in 1-on-1 context, reduce weight if player is'''

if old7 in motor:
    motor = motor.replace(old7, new7)
    fixes_m.append('OK pnrSnake logic added')
else:
    fixes_m.append('NOT FOUND pnrSnake insertion point')

with open(path_m, 'w') as f:
    f.write(motor)

print('\n'.join(fixes_m))

# ─── reportTextRenderer.ts fixes ────────────────────────────────────────────────
path_r = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path_r, 'r') as f:
    renderer = f.read()

fixes_r = []

# FIX 8: aware_instant_shot text EN
old8 = '    case "allow_catch_shoot":\n      return "Allow catch-and-shoot attempts. Contest from distance — no free drives from closeout.";'
new8 = '    case "aware_instant_shot":\n      return "Immediate release on closeout — no pump fake, no hesitation. Must arrive high and fast at the catch.";\n    case "allow_catch_shoot":\n      return "Allow catch-and-shoot attempts. Contest from distance — no free drives from closeout.";'
if old8 in renderer:
    renderer = renderer.replace(old8, new8)
    fixes_r.append('OK aware_instant_shot EN')
else:
    fixes_r.append('NOT FOUND allow_catch_shoot EN')

# FIX 9: aware_pressure_vuln with context — EN
old9 = '    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";\n    case "force_no_space":'
new9 = '    case "aware_instant_shot":\n      return "Immediate release on closeout — no pump fake, no hesitation. Must arrive high and fast at the catch.";\n    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";\n    case "force_no_space":'

# Already added above, skip if duplicate check needed
# Just add aware_pressure_vuln context differentiation in alert text
old_alert = '    if (key.includes("passer") || key.includes("vision"))\n      return "High-level passer — reads the double team instantly.";'
new_alert = '    if (key.includes("instant_shot"))\n      return "Fires immediately on closeout — no look, no hesitation.";\n    if (key.includes("passer") || key.includes("vision"))\n      return "High-level passer — reads the double team instantly.";'
if old_alert in renderer:
    renderer = renderer.replace(old_alert, new_alert)
    fixes_r.append('OK aware_instant_shot alert EN')
else:
    fixes_r.append('NOT FOUND passer alert EN')

# ES version
old_alert_es = '    if (key.includes("passer") || key.includes("vision"))\n      return "Pasador/a de alto nivel — lee el doble de inmediato.";'
new_alert_es = '    if (key.includes("instant_shot"))\n      return "Lanza de inmediato en el cierre — sin finta, sin dudar.";\n    if (key.includes("passer") || key.includes("vision"))\n      return "Pasador/a de alto nivel — lee el doble de inmediato.";'
if old_alert_es in renderer:
    renderer = renderer.replace(old_alert_es, new_alert_es)
    fixes_r.append('OK aware_instant_shot alert ES')
else:
    fixes_r.append('NOT FOUND passer alert ES')

# ZH version
old_alert_zh = '    if (key.includes("passer") || key.includes("vision"))\n      return "传球视野极佳，夹击时能立刻找到出球点。";'
new_alert_zh = '    if (key.includes("instant_shot"))\n      return "补防时立即出手——无假动作，无犹豫。";\n    if (key.includes("passer") || key.includes("vision"))\n      return "传球视野极佳，夹击时能立刻找到出球点。";'
if old_alert_zh in renderer:
    renderer = renderer.replace(old_alert_zh, new_alert_zh)
    fixes_r.append('OK aware_instant_shot alert ZH')
else:
    fixes_r.append('NOT FOUND passer alert ZH')

with open(path_r, 'w') as f:
    f.write(renderer)

print('\n'.join(fixes_r))
print('ALL DONE')
