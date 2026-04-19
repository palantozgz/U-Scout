path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# The finish danger ranking — Drive > Pull-up > Floater > Mid-range
# We insert force_direction after the aware_pnr_direction block

OLD = '''      if (inputs.pnrFinishLeft && inputs.pnrFinishRight) {
        const leftEff = inputs.pnrEffLeft ?? null;
        const rightEff = inputs.pnrEffRight ?? null;
        const meaningfulDiff =
          inputs.pnrFinishLeft !== inputs.pnrFinishRight ||
          (leftEff && rightEff && leftEff !== rightEff);
        if (meaningfulDiff) {
          outputs.push({
            key: 'aware_pnr_direction',
            category: 'aware',
            weight: 0.72,
            source: 'pnr_finish_asymmetry',
            params: { left: inputs.pnrFinishLeft, right: inputs.pnrFinishRight },
          });
        }
      }'''

NEW = '''      if (inputs.pnrFinishLeft && inputs.pnrFinishRight) {
        const leftEff = inputs.pnrEffLeft ?? null;
        const rightEff = inputs.pnrEffRight ?? null;
        const meaningfulDiff =
          inputs.pnrFinishLeft !== inputs.pnrFinishRight ||
          (leftEff && rightEff && leftEff !== rightEff);
        if (meaningfulDiff) {
          outputs.push({
            key: 'aware_pnr_direction',
            category: 'aware',
            weight: 0.72,
            source: 'pnr_finish_asymmetry',
            params: { left: inputs.pnrFinishLeft, right: inputs.pnrFinishRight },
          });
        }
        // force_direction from PnR finish asymmetry:
        // If one side is clearly more dangerous, force toward the weaker side.
        // Danger ranking: Drive to Rim > Pull-up > Floater > Mid-range
        const finishDanger: Record<string, number> = {
          'Drive to Rim': 4, 'Pull-up': 3, 'Floater': 2, 'Mid-range': 1,
        };
        const dangerL = finishDanger[inputs.pnrFinishLeft ?? ''] ?? 0;
        const dangerR = finishDanger[inputs.pnrFinishRight ?? ''] ?? 0;
        const dangerDiff = Math.abs(dangerL - dangerR);
        if (dangerDiff >= 1) {
          // Force toward the less dangerous side
          // hand R: right=strong side (R=right hand dominant), left=L=weak
          // hand L: left=strong, right=weak
          const strongSide = inputs.hand === 'R' ? 'R' : 'L';
          const weakSide = inputs.hand === 'R' ? 'L' : 'R';
          const strongDanger = strongSide === 'R' ? dangerR : dangerL;
          const weakDanger = weakSide === 'R' ? dangerR : dangerL;
          // Only emit if strong side is indeed more dangerous (confirms scouted asymmetry)
          if (strongDanger > weakDanger) {
            const forceDir = weakSide; // Force toward the weaker finishing side
            outputs.push({
              key: 'force_direction',
              category: 'force',
              weight: Math.min(weight * 0.80, 0.85),
              params: { direction: forceDir },
              source: 'pnr_finish_asymmetry',
            });
          }
        }
      }'''

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(path, 'w') as f:
        f.write(content)
    print('OK')
else:
    print('NOT FOUND')
