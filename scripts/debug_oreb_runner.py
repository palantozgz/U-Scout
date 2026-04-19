path = '/Users/palant/Downloads/U scout/scripts/debug_oreb.py'

script = """
import subprocess, json

# Quick debug via calibrate output
result = subprocess.run(
    ['npx', 'tsx', '-e', '''
import { generateMotorV4 } from "./client/src/lib/motor-v4";
import { renderReport } from "./client/src/lib/reportTextRenderer";

const inputs = {
  pos: "C", hand: "R", ath: 4, phys: 5, usage: "role",
  selfCreation: "low",
  orebThreat: "high", putbackQuality: "primary",
  postFreq: "R", postEntry: "duck_in",
  transFreq: "S", transRole: "rim_run",
  isoFreq: "N", pnrFreq: "N",
  spotUpFreq: "N", deepRange: false,
  vision: 2, floater: "N",
  cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
  contactFinish: "seeks", offHandFinish: "capable",
  screenerAction: null, ballHandling: null, pressureResponse: null,
};

const r = generateMotorV4(inputs as any);
const rd = renderReport(r, { locale: "en", gender: "n" });
console.log("deny winner:", r.defense.deny.winner.key);
console.log("deny text:", rd.defense.deny.instruction);
console.log("situations:", r.situations.slice(0,3).map((s:any)=>s.id+"("+s.score.toFixed(2)+")").join(", "));
'''],
    capture_output=True, text=True, cwd='/Users/palant/Downloads/U scout'
)
print(result.stdout)
print(result.stderr[:500] if result.stderr else '')
"""

with open(path, 'w') as f:
    f.write(script)
print('written')
