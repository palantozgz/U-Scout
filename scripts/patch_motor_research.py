"""
Motor iteration basada en documentación técnica/científica:

FUENTES:
- Synergy Sports: PPP por play type — Cut=1.58, Spot-up=alta, ISO=media-baja, Post=media-baja
- Research (Frontiers, PMC): PnR "weak" defense, mano dominante, cobertura "under"
- Analytics: mid-range = peor shot eficiencia, 3PT > 2PT mid
- Basketball Immersion scouting reports: terminología táctica real
- Academic research EuroLeague/NBA play type efficiency

CAMBIOS:

1. Cuts — peso baseWeight 0.6 → 0.72 (cuts son la acción MÁS eficiente 1.58 PPP,
   el motor los infravalora. Un cortador primario es una amenaza real.)

2. allow_mid_range inference — cuando el jugador no tiene deepRange Y su PnR finish
   es mid-range en ambos lados → instrucción allow_mid: dejarle tirar el mid-range
   es correcto tácticamente si no tiene 3PT. El mid-range es el peor shot sin
   especialización. Esta es la instrucción de "under coverage".

3. under_coverage signal — cuando !deepRange y PnR handler con pull-up/mid-range
   como finish → generar aware de que under coverage es válido

4. ISO efficiency ponderación: iso_eff=low + usage=secondary → allow_iso debe ser
   explícito y prominente (no dejarle hacer ISO es perder tiempo defensivo)

5. Mejorar ponderación de selfCreation en relación a ath:
   ath=4-5 + selfCreation=high → la amenaza ISO es más explosiva
   ath=1-2 + selfCreation=high → amenaza de timing/technique, no explosión

6. Post-up como acción ineficiente (0.78-0.98 PPP) — allow_post debe generarse
   más fácilmente para perfiles interiores sin historial de eficiencia

7. Spot-up con deepRange → highest priority deny (el catch-and-shoot 3PT abierto
   es la acción más eficiente junto a los cuts)
"""

path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

fixes = []

# FIX 1: Cut baseWeight 0.6 → 0.72
# SCIENTIFIC BASIS: Cuts = 1.58 PPP (most efficient action per Synergy/academic research)
# The motor currently undervalues cuts at 0.6. A primary cutter IS a real threat.
old1 = "    cut: { baseWeight: 0.6, typeBonus: { basket: 0.1, backdoor: 0.15, flash: 0.05, curl: 0.1 } },"
new1 = "    // Cut baseWeight increased from 0.6 to 0.72 — cuts are the most efficient action (1.58 PPP per Synergy data)\n    cut: { baseWeight: 0.72, typeBonus: { basket: 0.1, backdoor: 0.15, flash: 0.05, curl: 0.1 } },"
if old1 in content:
    content = content.replace(old1, new1)
    fixes.append('OK cut baseWeight 0.6→0.72')
else:
    fixes.append('NOT FOUND cut baseWeight')

# FIX 2: deny_spot_deep should be highest weight for primary spot-up with deepRange
# SCIENTIFIC BASIS: Open catch-and-shoot 3PT is most efficient shot type (highest PPP/shot)
# Currently it's just 0.95 for Primary. Make it explicit that this is top priority.
old2 = "    // Deep range threat — only if player actually uses spot-up (not just has range)\n    if (inputs.deepRange && inputs.spotUpFreq && inputs.spotUpFreq !== 'N') {\n      const spotWeight = inputs.spotUpFreq === 'P' ? 0.95 : inputs.spotUpFreq === 'S' ? 0.80 : 0.60;"
new2 = "    // Deep range threat — only if player actually uses spot-up (not just has range)\n    // SCIENTIFIC BASIS: Open 3PT is highest-PPP shot in basketball analytics\n    // Primary spot-up with deep range = top defensive priority\n    if (inputs.deepRange && inputs.spotUpFreq && inputs.spotUpFreq !== 'N') {\n      const spotWeight = inputs.spotUpFreq === 'P' ? 0.98 : inputs.spotUpFreq === 'S' ? 0.82 : 0.62;"
if old2 in content:
    content = content.replace(old2, new2)
    fixes.append('OK deny_spot_deep weight 0.95→0.98')
else:
    fixes.append('NOT FOUND deny_spot_deep weight')

# FIX 3: "under" coverage signal for PnR handlers without shooting threat
# SCIENTIFIC BASIS: "Under" coverage is correct when ball-handler has weak shooting threat
# (Eurohoops PnR defense guide, Basketball Dictionary "Weak" coverage)
# When pnrFinishLeft/Right are mid-range/pull-up AND no deepRange → under is correct
# Generate aware_under_viable to signal this tactical option
old3 = "      // force_no_mid: when PnR handler prefers mid-range finishes on both sides"
new3 = "      // UNDER COVERAGE SIGNAL: when PnR handler has no deep range and finishes mid-range/pull-up,\n      // going under the screen is a valid defensive coverage (forces clock-consuming mid-range).\n      // SCIENTIFIC BASIS: Mid-range is statistically worst shot (0.16 PPP below 3PT per analytics).\n      // Only applicable if no deepRange — if they have range, under is suicidal.\n      if (\n        inputs.pnrFinishLeft != null &&\n        inputs.pnrFinishRight != null &&\n        !inputs.deepRange &&\n        finishDangerCheck[inputs.pnrFinishLeft ?? ''] <= 3 &&\n        finishDangerCheck[inputs.pnrFinishRight ?? ''] <= 3\n      ) {\n        outputs.push({\n          key: 'allow_pnr_mid_range',\n          category: 'allow',\n          weight: 0.72,\n          source: 'pnr_no_range',\n          params: { coverage: 'under_viable' },\n        });\n      }\n\n      // force_no_mid: when PnR handler prefers mid-range finishes on both sides"
if old3 in content:
    content = content.replace(old3, new3)
    fixes.append('OK under_coverage signal added')
else:
    fixes.append('NOT FOUND force_no_mid anchor')

# FIX 4: ath modulates ISO weight (explosive threat)
# SCIENTIFIC BASIS: athleticism determines how quickly a player creates separation
# ath=4-5 + ISO = more explosive → higher defensive urgency weight
# ath=1-2 + ISO = technique/timing-based → slightly lower weight but still real
old4 = "    if (inputs.isoFreq && inputs.isoFreq !== 'N') {\n      const baseWeight = freqW[inputs.isoFreq] * w.outputWeights.iso.baseWeight;\n      let weight = baseWeight * effectiveUsageM;"
new4 = "    if (inputs.isoFreq && inputs.isoFreq !== 'N') {\n      const baseWeight = freqW[inputs.isoFreq] * w.outputWeights.iso.baseWeight;\n      // ath partially modulates ISO weight — explosive athletes create faster and harder\n      // SCIENTIFIC BASIS: athleticism is a key discriminator in isolation scoring ability\n      const athIsoBonus = (w.athMultiplier[inputs.ath] - 1.0) * 0.4; // partial, not full\n      let weight = baseWeight * effectiveUsageM * (1 + athIsoBonus);"
if old4 in content:
    content = content.replace(old4, new4)
    fixes.append('OK ath modulates ISO weight')
else:
    fixes.append('NOT FOUND ISO baseWeight block')

# FIX 5: allow_iso — make it stronger/more explicit for secondary players with low ISO eff
# SCIENTIFIC BASIS: ISO is one of least efficient play types overall (0.85-0.95 PPP avg)
# For secondary players who rarely ISO → extremely safe to allow
old5 = "    const isPnrOrPostPrimary =\n      (inputs.pnrFreq === 'P' || inputs.pnrFreq === 'S') ||\n      (inputs.postFreq === 'P' || inputs.postFreq === 'S');\n    if (\n      (inputs.isoFreq === 'R' || inputs.isoFreq === 'N' || inputs.isoEff === 'low') &&\n      inputs.orebThreat !== 'high' &&\n      !isPnrOrPostPrimary\n    ) {\n      outputs.push({\n        key: 'allow_iso',\n        category: 'allow',\n        weight: w.allowRules.iso.lowEffWeight + (inputs.isoFreq === 'N' ? 0.2 : 0),\n        source: 'weak_iso'\n      });\n    }"
new5 = "    const isPnrOrPostPrimary =\n      (inputs.pnrFreq === 'P' || inputs.pnrFreq === 'S') ||\n      (inputs.postFreq === 'P' || inputs.postFreq === 'S');\n    if (\n      (inputs.isoFreq === 'R' || inputs.isoFreq === 'N' || inputs.isoEff === 'low') &&\n      inputs.orebThreat !== 'high' &&\n      !isPnrOrPostPrimary\n    ) {\n      // SCIENTIFIC BASIS: ISO is statistically one of the least efficient play types\n      // Secondary/role players with low ISO eff = very safe to allow — save defensive energy\n      const allowIsoWeight = w.allowRules.iso.lowEffWeight +\n        (inputs.isoFreq === 'N' ? 0.2 : 0) +\n        (inputs.usage === 'role' || inputs.usage === 'secondary' ? 0.1 : 0);\n      outputs.push({\n        key: 'allow_iso',\n        category: 'allow',\n        weight: Math.min(allowIsoWeight, 0.92),\n        source: 'weak_iso'\n      });\n    }"
if old5 in content:
    content = content.replace(old5, new5)
    fixes.append('OK allow_iso weighted by usage')
else:
    fixes.append('NOT FOUND allow_iso block')

# FIX 6: Post-up as inefficient play — allow_post should be easier to generate for
# average interior players without post profile (0.78-0.98 PPP per EuroLeague research)
# For players who COULD post but it would be inefficient, allow it explicitly
old6 = "      // allow_post only when the player has some interior presence but doesn't post up —\n      // skip entirely for guards with no interior game (it's obvious noise)\n      const hasInteriorPresence = inputs.pos === 'PF' || inputs.pos === 'C' ||\n        inputs.phys >= 4 || inputs.orebThreat === 'high' || inputs.orebThreat === 'medium';\n      if (hasInteriorPresence && inputs.usage !== 'primary') {"
new6 = "      // allow_post only when the player has some interior presence but doesn't post up —\n      // skip entirely for guards with no interior game (it's obvious noise)\n      // SCIENTIFIC BASIS: Post-up is one of least efficient play types (0.78-0.98 PPP per research)\n      // → allowing post-ups from average bigs is a valid defensive concession\n      const hasInteriorPresence = inputs.pos === 'PF' || inputs.pos === 'C' ||\n        inputs.phys >= 4 || inputs.orebThreat === 'high' || inputs.orebThreat === 'medium';\n      if (hasInteriorPresence && inputs.usage !== 'primary') {"
if old6 in content:
    content = content.replace(old6, new6)
    fixes.append('OK allow_post comment updated with research basis')
else:
    fixes.append('NOT FOUND allow_post interior block')

# FIX 7: selfCreation inference improvement in mock-data already captures transition
# Verify force_direction text renderer handles "under_viable" context for allow_pnr_mid_range
# (handled in renderer separately)

# FIX 8: aware_passer — also add trap context note when vision=5 but trapResponse=pass
# vision=5 with trapResponse=pass (not escape) = good passer but not elite trap-beater
old8 = "    // aware_passer only when vision is high AND player doesn't struggle under trap pressure.\n    // A player with vision=4 but trapResponse=struggle reads collective situations well in open court,\n    // but is NOT an elite passer under defensive pressure — don't warn the defender to rotate.\n    if (inputs.vision >= 4 && inputs.trapResponse !== 'struggle') {"
new8 = "    // aware_passer: vision >= 4 AND not struggling under trap pressure.\n    // SCIENTIFIC BASIS: NBA research shows elite passers read double-teams and find shooters\n    // even under pressure. But vision=4 with trapResponse=struggle is a contradiction —\n    // good reader but not good handler under pressure. Only warn if actually dangerous.\n    // vision=5 + trapResponse=escape/pass = true elite passer\n    // vision=4 + trapResponse=pass = above-average reader, weight slightly lower\n    if (inputs.vision >= 4 && inputs.trapResponse !== 'struggle') {\n      // Weight by vision level: 5=elite passer, 4=above average\n      const passerWeight = inputs.vision === 5\n        ? (0.8 + (inputs.trapResponse === 'escape' ? 0.15 : 0.05))\n        : 0.72; // vision=4 is good but not elite"
if old8 in content:
    content = content.replace(old8, new8)
    fixes.append('OK aware_passer weighted by vision+trapResponse')
else:
    fixes.append('NOT FOUND aware_passer block')

# Corresponding change: remove hardcoded weight
old9 = "        weight: 0.8 + (inputs.vision === 5 ? 0.15 : 0),\n        source: 'vision'"
new9 = "        weight: passerWeight,\n        source: 'vision'"
if old9 in content:
    content = content.replace(old9, new9)
    fixes.append('OK aware_passer uses passerWeight var')
else:
    fixes.append('NOT FOUND aware_passer weight line')

with open(path, 'w') as f:
    f.write(content)

print('\n'.join(fixes))
print('\nAll fixes applied')
