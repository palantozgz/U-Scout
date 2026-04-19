path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# The allow_pnr_mid_range block uses finishDangerCheck before it's declared
# Move it to AFTER the finishDangerCheck declaration (after the shooter force_direction block)
# Remove from current position and re-insert after the bothMidOrLower block

old_misplaced = """      // UNDER COVERAGE SIGNAL: when PnR handler has no deep range and finishes mid-range/pull-up,
      // going under the screen is a valid defensive coverage (forces clock-consuming mid-range).
      // SCIENTIFIC BASIS: Mid-range is statistically worst shot (0.16 PPP below 3PT per analytics).
      // Only applicable if no deepRange — if they have range, under is suicidal.
      if (
        inputs.pnrFinishLeft != null &&
        inputs.pnrFinishRight != null &&
        !inputs.deepRange &&
        finishDangerCheck[inputs.pnrFinishLeft ?? ''] <= 3 &&
        finishDangerCheck[inputs.pnrFinishRight ?? ''] <= 3
      ) {
        outputs.push({
          key: 'allow_pnr_mid_range',
          category: 'allow',
          weight: 0.72,
          source: 'pnr_no_range',
          params: { coverage: 'under_viable' },
        });
      }

      // force_no_mid: when PnR handler prefers mid-range finishes on both sides"""

new_without = "      // force_no_mid: when PnR handler prefers mid-range finishes on both sides"

if old_misplaced in content:
    content = content.replace(old_misplaced, new_without)
    print('OK removed misplaced block')
else:
    print('NOT FOUND misplaced block')

# Now insert AFTER the bothMidOrLower+isShooter block, where finishDangerCheck is already declared
old_insert_after = """      if (bothMidOrLower && isShooter) {
        // Force toward weak hand — for R-handed players, force left
        const weakSide = inputs.hand === 'R' ? 'L' : 'R';
        outputs.push({
          key: 'force_direction',
          category: 'force',
          weight: Math.min(weight * 1.05, 1.10),  // must beat force_trap in 1-on-1 context
          params: { direction: weakSide, context: 'no_mid_range' },
          source: 'pnr_shooter_weak_side',
        });
      }

      if (inputs.trapResponse === 'struggle') {"""

new_insert_after = """      if (bothMidOrLower && isShooter) {
        // Force toward weak hand — for R-handed players, force left
        const weakSide = inputs.hand === 'R' ? 'L' : 'R';
        outputs.push({
          key: 'force_direction',
          category: 'force',
          weight: Math.min(weight * 1.05, 1.10),  // must beat force_trap in 1-on-1 context
          params: { direction: weakSide, context: 'no_mid_range' },
          source: 'pnr_shooter_weak_side',
        });
      }

      // UNDER COVERAGE SIGNAL: when PnR handler has no deep range and finishes mid/pull-up,
      // going under the screen is valid — forces clock-consuming mid-range (worst shot in analytics).
      // SCIENTIFIC BASIS: Mid-range is 0.16 PPP less efficient than 3PT (basketball analytics).
      if (
        inputs.pnrFinishLeft != null &&
        inputs.pnrFinishRight != null &&
        !inputs.deepRange &&
        finishDangerCheck[inputs.pnrFinishLeft ?? ''] <= 3 &&
        finishDangerCheck[inputs.pnrFinishRight ?? ''] <= 3
      ) {
        outputs.push({
          key: 'allow_pnr_mid_range',
          category: 'allow',
          weight: 0.72,
          source: 'pnr_no_range',
          params: { coverage: 'under_viable' },
        });
      }

      if (inputs.trapResponse === 'struggle') {"""

if old_insert_after in content:
    content = content.replace(old_insert_after, new_insert_after)
    print('OK inserted after finishDangerCheck')
else:
    print('NOT FOUND insert after point')

with open(path, 'w') as f:
    f.write(content)
print('done')
