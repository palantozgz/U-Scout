path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

# The new Bam block — unique context around it
old = '''      allow_must_not: ["allow_iso"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      alert_keys: ["aware_passer"],
    },
  },
  // ─── WNBA / EUROPA FEMENINO ───────────────────────────────────────────────'''

new = '''      allow_must_not: ["allow_iso"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      // aware_oreb+aware_physical fill the 2 aware slots before aware_passer (0.72)
    },
  },
  // ─── WNBA / EUROPA FEMENINO ───────────────────────────────────────────────'''

if old in content:
    content = content.replace(old, new)
    print('OK')
else:
    print('NOT FOUND')

with open(path, 'w') as f:
    f.write(content)
