path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# Increase force_direction weight from pnr_finish_asymmetry
old = "              weight: Math.min(weight * 0.80, 0.85),"
new = "              weight: Math.min(weight * 0.88, 0.92),"

if old in content:
    content = content.replace(old, new)
    print('OK weight')
else:
    print('NOT FOUND weight')

# force_no_push from dribble_push transition sub is good but should not override
# halfcourt directional instruction — reduce its base weight slightly
old2 = "          const pushWeight = inputs.ballHandling === 'elite' ? 0.9 : 0.75;"
new2 = "          const pushWeight = inputs.ballHandling === 'elite' ? 0.82 : 0.68;"

if old2 in content:
    content = content.replace(old2, new2)
    print('OK pushWeight')
else:
    print('NOT FOUND pushWeight')

with open(path, 'w') as f:
    f.write(content)
print('done')
