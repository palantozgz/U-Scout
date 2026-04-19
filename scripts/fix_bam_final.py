path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

old = '''      top_situations: ["pnr_ball"],
      danger_min: 4,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal037",'''

new = '''      top_situations: ["pnr_ball"],
      danger_min: 4,
      // aware_oreb(0.8) + aware_physical(0.75) fill the 2 alert slots → aware_passer(0.72) pruned
    },
  },

  {
    id: "cal037",'''

if old in content:
    content = content.replace(old, new)
    print('OK Bam alert_keys removed')
else:
    # find by context
    idx = content.find('Bam Adebayo')
    print(repr(content[idx:idx+800]))

with open(path, 'w') as f:
    f.write(content)
print('done')
