path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    lines = f.readlines()

# Line 1701 (0-indexed: 1700) is the alert_keys line for new Bam
# Verify context
print('Lines 1699-1703:')
for i in range(1698, 1703):
    print(i+1, repr(lines[i]))

# Replace line 1701
if 'alert_keys: ["aware_passer"]' in lines[1700]:
    lines[1700] = '      // alert_keys: ["aware_passer"],  // aware_oreb+physical fill the 2 aware slots\n'
    with open(path, 'w') as f:
        f.writelines(lines)
    print('OK fixed line 1701')
else:
    print('NOT found at 1701:', repr(lines[1700]))
