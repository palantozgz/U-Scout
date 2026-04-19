path = '/Users/palant/Downloads/U scout/CLAUDE_CONTEXT.md'
with open(path, 'r') as f:
    content = f.read()

r = [
    (
        '- reportTextRenderer.ts: renderizado completo para force_contact, force_full_court, force_no_push, force_paint_deny, force_no_ball, allow_distance, allow_ball_handling en EN/ES/ZH',
        '- reportTextRenderer.ts: renderizado completo para force_contact, force_full_court, force_no_push, force_no_ball, allow_distance, allow_ball_handling, deny_pnr_pop, deny_pnr_roll, deny_oreb, deny_dho, deny_floater, allow_cut, allow_catch_shoot, allow_transition, allow_post, allow_iso_both en EN/ES/ZH\n- motor-v4.ts: allow fallback solo para situaciones genuinamente low-threat (<0.5) — fix bug Pika (allow_transition incorrecto)\n- motor-v2.1.ts: force_early solo para ISO puros; suprimido para PnR handlers, deepRange, y transicion threat\n- scripts/calibrate-motor.ts: 18 perfiles NBA/WNBA con expectations. Score: 96% (164/171). Ejecutar: npx tsx scripts/calibrate-motor.ts'
    ),
    (
        '### \U0001f504 Pendientes activos (priorizados)\n1. **Calibraci\u00f3n motor con perfiles reales** \u2014 iterar motor v2.1 con jugadoras NBA/WNBA conocidas para validar calidad de outputs. Script: `npx tsx scripts/test-motor-v4.ts`\n2. **Versiones inputs por coach** \u2014 tabla player_inputs_versions (sprint futuro, requiere migraci\u00f3n schema)',
        '### \U0001f504 Pendientes activos (priorizados)\n1. **Versiones inputs por coach** \u2014 tabla player_inputs_versions (sprint futuro, requiere migraci\u00f3n schema)'
    ),
    (
        '## Calibraci\u00f3n motor\ncd "/Users/palant/Downloads/U scout"\nnpx tsx scripts/test-motor-v4.ts\nLee: scripts/test-profiles.json\nEscribe: scripts/test-results-v4.json',
        '## Calibraci\u00f3n motor\ncd "/Users/palant/Downloads/U scout"\nnpx tsx scripts/calibrate-motor.ts\nEscribe: scripts/calibration-results.json\nScore actual: 96% (164/171 checks, 12/18 perfiles perfectos)'
    ),
]

for old, new in r:
    if old in content:
        content = content.replace(old, new)
        print('OK: ' + old[:60])
    else:
        print('NOT FOUND: ' + old[:60])

with open(path, 'w') as f:
    f.write(content)
print('DONE')
