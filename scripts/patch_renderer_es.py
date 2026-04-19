path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

fixes = []

# ES deny_iso_space (exact text)
old = '''    case "deny_iso_space":
      return inputs.isoDir === "R"
        ? "Niégale el catch en el ala derecha. Fórzale a la izquierda antes de que se sitúe."
        : inputs.isoDir === "L"
          ? "Niégale el catch en el ala izquierda. Fórzale a la derecha — su lado débil."
          : "Niégale el catch en ambas alas. Que trabaje cada balón.";'''
new = '''    case "deny_iso_space": {
      const dirES = inputs.isoDir === "R" ? "ala derecha" : inputs.isoDir === "L" ? "ala izquierda" : "ambas alas";
      const forceES = inputs.isoDir === "R"
        ? "Fuérzale a la izquierda — contesta cada toque antes de que se coloque."
        : inputs.isoDir === "L"
          ? "Fuérzale a la derecha — no le dejes atacar por su lado."
          : "Cuerpo entre balón y cuerpo — que trabaje para recibir.";
      const athES2 = (inputs.ath ?? 3) >= 4 ? " No estires — crea desde el contacto." : "";
      return `Niega el catch en ${dirES}. ${forceES}${athES2}`;
    }'''
if old in content:
    content = content.replace(old, new)
    fixes.append('OK ES deny_iso_space')
else:
    fixes.append('NOT FOUND ES deny_iso_space')

# ES deny_pnr_downhill
old2 = '    case "deny_pnr_downhill":\n      return "Niega el ataque directo en el PnR. Por encima del bloqueo — nunca por debajo.";'
new2 = '''    case "deny_pnr_downhill": {
      const deepES2 = inputs.deepRange
        ? "Por encima del bloqueo — nunca por debajo. Tira de inmediato si le das el pull-up."
        : "Pégale por encima. No le des espacio para el medio largo.";
      const passerES2 = inputs.pnrPri === "PF" ? " Prioriza el pase — mantente conectado al bloqueador." : "";
      return `Niega el catch en el bloqueo directo. ${deepES2}${passerES2}`;
    }'''
if old2 in content:
    content = content.replace(old2, new2)
    fixes.append('OK ES deny_pnr_downhill')
else:
    fixes.append('NOT FOUND ES deny_pnr_downhill')

# ES deny_spot_deep — find exact text
import re
# find it
idx = content.find('case "deny_spot_deep":', content.find('renderInstructionES'))
chunk = content[idx:idx+200]
print('ES deny_spot_deep:', repr(chunk[:150]))

# ES allow_spot_three
old5 = '    case "allow_spot_three":\n      return "Permite triples en spot-up. Sin rango — el tiro es deficiente desde lejos.";'
new5 = '    case "allow_spot_three":\n      return "Permite el catch en el perímetro. Sin rango largo — el dos largo es su mejor tiro exterior. Protege la pintura.";'
if old5 in content:
    content = content.replace(old5, new5)
    fixes.append('OK ES allow_spot_three')
else:
    # Try to find
    idx5 = content.find('allow_spot_three', content.find('renderInstructionES'))
    print('ES allow_spot_three at:', idx5, repr(content[idx5:idx5+100]))

# ES deny_oreb
old6 = '    case "deny_oreb":\n      return "Bloqueo en cada tiro. Reboteadora ofensiva élite — bloqueo físico obligatorio.";'
new6 = '    case "deny_oreb":\n      return "Búscala antes de que salga el tiro. Bloqueo anticipado y físico — va al rebote en cada posesión.";'
if old6 in content:
    content = content.replace(old6, new6)
    fixes.append('OK ES deny_oreb')
else:
    idx6 = content.find('deny_oreb', content.find('renderInstructionES'))
    print('ES deny_oreb at:', idx6, repr(content[idx6:idx6+120]))

# ES force_direction — find and update
old_es_fd_idx = content.find('case "force_direction":', content.find('renderInstructionES'))
print('ES force_direction at line approx:', content[:old_es_fd_idx].count('\n'))

with open(path, 'w') as f:
    f.write(content)
print('\n'.join(fixes))
