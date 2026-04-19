path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# The Math.min(trapWeight, 0.85) cap is wrong for non-shooters
# For non-shooters, force_trap should keep weight * 0.85 uncapped
old = "        const shooterContext = inputs.deepRange && inputs.spotUpFreq != null && inputs.spotUpFreq !== 'N';\n        const trapWeight = shooterContext ? weight * 0.60 : weight * 0.85;\n        outputs.push({\n          key: 'force_trap',\n          category: 'force',\n          weight: Math.min(trapWeight, 0.85),"

new = "        const shooterContext = inputs.deepRange && inputs.spotUpFreq != null && inputs.spotUpFreq !== 'N';\n        // For shooters: reduce trap weight — 1-on-1 directional instruction is more relevant than team trap\n        // For non-shooters (drivers like Giannis): keep full weight, trap is the right call\n        const trapWeight = shooterContext ? Math.min(weight * 0.60, 0.72) : weight * 0.85;\n        outputs.push({\n          key: 'force_trap',\n          category: 'force',\n          weight: trapWeight,"

if old in content:
    content = content.replace(old, new)
    print('OK force_trap fix')
else:
    print('NOT FOUND')

with open(path, 'w') as f:
    f.write(content)
print('done')
