path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# FIX 1: suppress aware_passer when trapResponse = struggle
# Currently: if (inputs.vision >= 4) push aware_passer
# Fix: add condition that trapResponse !== 'struggle'
old1 = "    if (inputs.vision >= 4) {\n      outputs.push({\n        key: 'aware_passer',\n        category: 'aware',\n        weight: 0.8 + (inputs.vision === 5 ? 0.15 : 0),\n        source: 'vision'\n      });\n    }"

new1 = "    // aware_passer only when vision is high AND player doesn't struggle under trap pressure.\n    // A player with vision=4 but trapResponse=struggle reads collective situations well in open court,\n    // but is NOT an elite passer under defensive pressure — don't warn the defender to rotate.\n    if (inputs.vision >= 4 && inputs.trapResponse !== 'struggle') {\n      outputs.push({\n        key: 'aware_passer',\n        category: 'aware',\n        weight: 0.8 + (inputs.vision === 5 ? 0.15 : 0),\n        source: 'vision'\n      });\n    }"

if old1 in content:
    content = content.replace(old1, new1)
    print('OK Fix1 aware_passer')
else:
    print('NOT FOUND Fix1')

# FIX 2: force_no_mid rule for mid-range-preferring PnR handlers who are also shooters
# When pnrFinishLeft and pnrFinishRight are both mid-range or pull-up (no drive),
# AND the player is a spot-up threat with deepRange,
# → force_no_mid_range: do not allow comfortable mid-range catches; force penetration to weak side
# This is the tactical situation: deny the mid-range pull-up, make her drive (which she avoids)
# Insert after the pnr_finish_asymmetry block

old2 = "      if (inputs.trapResponse === 'struggle') {\n        outputs.push({\n          key: 'force_trap',\n          category: 'force',\n          weight: weight * 0.85,\n          source: 'trap_response',\n        });"

new2 = "      // force_no_mid: when PnR handler prefers mid-range finishes on both sides\n      // AND is a shooter (deepRange + spotUpFreq), the tactical instruction is:\n      // deny the mid-range catch — force penetration to weak side instead.\n      // This captures: shooter who uses PnR to create mid-range pull-ups (not rim attacks).\n      const finishDangerCheck: Record<string, number> = {\n        'Drive to Rim': 4, 'Pull-up': 3, 'Floater': 2, 'Mid-range': 1,\n      };\n      const leftDanger = finishDangerCheck[inputs.pnrFinishLeft ?? ''] ?? 0;\n      const rightDanger = finishDangerCheck[inputs.pnrFinishRight ?? ''] ?? 0;\n      const bothMidOrLower = leftDanger > 0 && rightDanger > 0 &&\n        leftDanger <= 3 && rightDanger <= 3 && Math.abs(leftDanger - rightDanger) <= 1;\n      const isShooter = inputs.deepRange && inputs.spotUpFreq != null && inputs.spotUpFreq !== 'N';\n      if (bothMidOrLower && isShooter) {\n        // Force toward weak hand — for R-handed players, force left\n        const weakSide = inputs.hand === 'R' ? 'L' : 'R';\n        outputs.push({\n          key: 'force_direction',\n          category: 'force',\n          weight: Math.min(weight * 0.82, 0.88),\n          params: { direction: weakSide, context: 'no_mid_range' },\n          source: 'pnr_shooter_weak_side',\n        });\n      }\n\n      if (inputs.trapResponse === 'struggle') {\n        outputs.push({\n          key: 'force_trap',\n          category: 'force',\n          weight: weight * 0.85,\n          source: 'trap_response',\n        });"

if old2 in content:
    content = content.replace(old2, new2)
    print('OK Fix2 force_no_mid')
else:
    print('NOT FOUND Fix2')
    # try to find nearby context
    idx = content.find("if (inputs.trapResponse === 'struggle')")
    print('trapResponse struggle at:', idx)

# Also add 'pnr_shooter_weak_side' to SOURCE_TO_SITUATION map
old3 = "  pnr_finish_asymmetry: 'pnr',"
new3 = "  pnr_finish_asymmetry: 'pnr',\n  pnr_shooter_weak_side: 'pnr',"

if old3 in content:
    content = content.replace(old3, new3)
    print('OK Fix3 source map')
else:
    print('NOT FOUND Fix3')

with open(path, 'w') as f:
    f.write(content)
print('done')
