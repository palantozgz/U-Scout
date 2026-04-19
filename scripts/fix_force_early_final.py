path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# The bug: the else-if branch emits force_early at 0.2 even when hasExteriorThreat=true
# For ISO players with deepRange, force_early at 0.2 can still win FORCE if no other candidates
# Fix: remove the 0.2 branch entirely for hasExteriorThreat cases
# Reasoning: if a player has deepRange, pressing early means they shoot an open 3 — never correct

old = """    } else if (
      inputs.selfCreation === 'high' &&
      inputs.usage === 'primary' &&
      inputs.isoFreq === 'P' &&
      !isPnrHandler &&
      (hasExteriorThreat || isTransitionThreat)
    ) {
      // ISO primary but with exterior threat: emit at reduced weight as runner-up option
      outputs.push({
        key: 'force_early',
        category: 'force',
        weight: 0.2,
        source: 'self_creation',
      });
    }"""

new = """    }
    // NOTE: force_early is NEVER emitted for players with deepRange exterior threat.
    // Pressing early on a shooter creates open catch-and-shoot opportunities — strictly wrong."""

if old in content:
    content = content.replace(old, new)
    print('OK removed force_early 0.2 branch for exterior threat')
else:
    print('NOT FOUND force_early else-if branch')
    # Find nearby
    idx = content.find('ISO primary but with exterior threat')
    print('nearby:', idx)

with open(path, 'w') as f:
    f.write(content)
print('done')
