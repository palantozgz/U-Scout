path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v4.ts'
with open(path, 'r') as f:
    content = f.read()

# The old fallback generates allow_transition etc. for high-threat situations
# Find the unique anchor and replace the block
OLD_ANCHOR = '    // No outputs for this category from v2.1.\n    // For \'allow\': derive from least-threatening situation in rawOutputs.\n    if (category === \'allow\') {'
NEW_ANCHOR = '    // No outputs for this category from v2.1.\n    // For \'allow\': derive only from GENUINELY low-threat situations (weight < 0.5).\n    // High-weight deny situations must never become "allow" recommendations.\n    if (category === \'allow\') {'

if OLD_ANCHOR in content:
    content = content.replace(OLD_ANCHOR, NEW_ANCHOR)
    print('anchor replaced')
else:
    print('NOT FOUND anchor')

OLD_FILTER = '      if (denySorted.length > 0) {\n        const least = denySorted[0];\n        const sitId = toSituationId(SOURCE_TO_SITUATION[least.source] ?? \'misc\', inputs);\n        const allowKey = `allow_${sitId}`;\n        return {\n          winner: { key: allowKey, score: Math.max(1 - least.weight, 0.3), situationRef: sitId, source: least.source },\n          alternatives: denySorted.slice(1, 4).map(o => {\n            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? \'misc\', inputs);\n            return { key: `allow_${s}`, score: Math.max(1 - o.weight, 0.3), situationRef: s, source: o.source };\n          }),\n        };\n      }\n    }'

NEW_FILTER = '      const genuinelyLow = denySorted.filter(o => o.weight < 0.5);\n      if (genuinelyLow.length > 0) {\n        const least = genuinelyLow[0];\n        const sitId = toSituationId(SOURCE_TO_SITUATION[least.source] ?? \'misc\', inputs);\n        const allowKey = `allow_${sitId}`;\n        return {\n          winner: { key: allowKey, score: Math.max(1 - least.weight, 0.3), situationRef: sitId, source: least.source },\n          alternatives: genuinelyLow.slice(1, 4).map(o => {\n            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? \'misc\', inputs);\n            return { key: `allow_${s}`, score: Math.max(1 - o.weight, 0.3), situationRef: s, source: o.source };\n          }),\n        };\n      }\n      // All deny situations high-threat: no allow recommendation needed.\n    }'

if OLD_FILTER in content:
    content = content.replace(OLD_FILTER, NEW_FILTER)
    print('filter replaced')
else:
    print('NOT FOUND filter')
    # Try to find what's there
    idx = content.find('genuinelyLow')
    if idx >= 0:
        print('genuinelyLow already present — already patched')

with open(path, 'w') as f:
    f.write(content)
print('done')
