path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# The shooter force_direction weight: 0.82 → 0.90 so it beats force_trap (0.85)
# This is correct because in a 1-on-1 matchup context, directional instruction beats trap recommendation
old = "          weight: Math.min(weight * 0.82, 0.88),\n          params: { direction: weakSide, context: 'no_mid_range' },"
new = "          weight: Math.min(weight * 0.90, 0.92),\n          params: { direction: weakSide, context: 'no_mid_range' },"

if old in content:
    content = content.replace(old, new)
    print('OK weight bump')
else:
    print('NOT FOUND')
    idx = content.find("context: 'no_mid_range'")
    print('no_mid_range at:', idx)
    print(repr(content[max(0,idx-80):idx+40]))

with open(path, 'w') as f:
    f.write(content)
print('done')
