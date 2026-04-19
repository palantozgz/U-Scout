path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

# Curry: update deny_text_contains — new text has "catch" and "perimeter" but not "deep"
old = '      deny_text_contains: ["deep", "catch"],'
new = '      deny_text_contains: ["catch"],  // "deep" removed — new text says "perimeter" instead'
if old in content:
    content = content.replace(old, new)
    print('OK Curry deny_text_contains fixed')
else:
    print('NOT FOUND')

with open(path, 'w') as f:
    f.write(content)
