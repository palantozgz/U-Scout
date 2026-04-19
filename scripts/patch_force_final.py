path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# Bump force_direction from shooter context to always beat force_trap
# force_trap can reach 1.02+, so we need force_direction to be capped higher
old = "          weight: Math.min(weight * 0.90, 0.92),"
new = "          weight: Math.min(weight * 1.05, 1.10),  // must beat force_trap in 1-on-1 context"

if old in content:
    content = content.replace(old, new)
    print('OK weight')
else:
    print('NOT FOUND')
    idx = content.find("context: 'no_mid_range'")
    print(repr(content[max(0,idx-100):idx+20]))

# Also: force_trap should be lower weight when the player is a shooter with deepRange
# because trap is a team action (out of 1-on-1 scope) — reduce its relevance
old2 = "      if (inputs.trapResponse === 'struggle') {\n        outputs.push({\n          key: 'force_trap',\n          category: 'force',\n          weight: weight * 0.85,\n          source: 'trap_response',\n        });"

new2 = "      if (inputs.trapResponse === 'struggle') {\n        // force_trap is a team action — in 1-on-1 context, reduce weight if player is\n        // primarily a shooter (the defender's job is individual positioning, not trap coordination)\n        const shooterContext = inputs.deepRange && inputs.spotUpFreq != null && inputs.spotUpFreq !== 'N';\n        const trapWeight = shooterContext ? weight * 0.60 : weight * 0.85;\n        outputs.push({\n          key: 'force_trap',\n          category: 'force',\n          weight: Math.min(trapWeight, 0.85),\n          source: 'trap_response',\n        });"

if old2 in content:
    content = content.replace(old2, new2)
    print('OK force_trap reduction')
else:
    print('NOT FOUND force_trap')

with open(path, 'w') as f:
    f.write(content)
print('done')
