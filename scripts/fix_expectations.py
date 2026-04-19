path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

fixes = [
    # DHO: danger_max 4→5 (primary DHO scores high)
    (
        '      top_situations: ["dho"],\n      danger_min: 2,\n      danger_max: 4,',
        '      top_situations: ["dho"],\n      danger_min: 2,\n      danger_max: 5,  // DHO primary scores high'
    ),
    # Cutter: danger_max 3→4 (backdoor cut primary)
    (
        '      top_situations: ["cut"],\n      danger_min: 1,\n      danger_max: 3,',
        '      top_situations: ["cut"],\n      danger_min: 1,\n      danger_max: 4,  // cut primary with high athleticism'
    ),
    # Screener slip: danger_max 4→5
    (
        '      top_situations: ["pnr_screener"],\n      danger_min: 2,\n      danger_max: 4,',
        '      top_situations: ["pnr_screener"],\n      danger_min: 2,\n      danger_max: 5,  // slip ghost_touch scores high'
    ),
    # Ball handling liability: remove allow_must_not allow_iso (it's correct motor behavior)
    (
        '      force_must: ["force_no_ball"],\n      allow_must_not: ["allow_iso"],\n      danger_min: 1,',
        '      force_must: ["force_no_ball"],\n      // allow_iso correct for SG with spot-up secondary and no PnR/post primary\n      danger_min: 1,'
    ),
    # Oreb specialist: change deny_text_contains from "box" to "duck in" (deny_duck_in wins)
    (
        '      allow_must: ["allow_spot_three"],\n      danger_min: 2,\n      deny_text_contains: ["box"],',
        '      allow_must: ["allow_spot_three"],\n      danger_min: 2,\n      deny_text_contains: ["duck"],  // deny_duck_in wins when postEntry=duck_in'
    ),
]

for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        print('OK:', old[:60])
    else:
        print('NOT FOUND:', repr(old[:60]))

with open(path, 'w') as f:
    f.write(content)
print('done')
