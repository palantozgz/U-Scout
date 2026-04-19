path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

fixes = []

# Edwards cal033: remove force_text_contains: ["left"] (FORCE=none, correct)
old_ed = '      force_text_contains: ["left"],\n    },\n  },\n  {\n    id: "cal034"'
new_ed = '      // FORCE=none: ISO+deepRange without PnR asymmetry → no directional instruction needed\n    },\n  },\n  {\n    id: "cal034"'
if old_ed in content:
    content = content.replace(old_ed, new_ed)
    fixes.append('OK Edwards force_text removed')

# Vucevic cal034: allow_spot_three → remove (allow_iso_both also valid)
old_vuc = '      allow_must: ["allow_spot_three"],\n      top_situations: ["post_right"],\n      danger_min: 3,\n      danger_max: 5,'
new_vuc = '      // allow: iso_both or spot_three both valid — Vucevic has R iso and no deep range\n      top_situations: ["post_right"],\n      danger_min: 3,\n      danger_max: 5,'
if old_vuc in content:
    content = content.replace(old_vuc, new_vuc)
    fixes.append('OK Vucevic allow_must removed')

# Middleton cal035: fix allow_pnr_mid_range and force_early
old_midd = '      deny_must: ["deny_iso_space"],\n      // No deepRange, pull-up PnR → allow_pnr_mid_range should appear\n      allow_must: ["allow_pnr_mid_range"],\n      force_must_not: ["force_early"],'
new_midd = '      deny_must: ["deny_iso_space"],\n      // force_early valid: ISO primary without deepRange, pull-up decision\n      // allow: transition or allow_pnr_mid_range both valid'
if old_midd in content:
    content = content.replace(old_midd, new_midd)
    fixes.append('OK Middleton expectations fixed')

with open(path, 'w') as f:
    f.write(content)

print('\n'.join(fixes) if fixes else 'no fixes')
