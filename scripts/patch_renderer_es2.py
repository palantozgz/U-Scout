path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

fixes = []

replacements = [
    # ES deny_spot_deep
    (
        '    case "deny_spot_deep":\n      return "Niega el catch largo. Cierre anticipado — lanza de inmediato tras recibir.";',
        '    case "deny_spot_deep": {\n      const instES = inputs.spotUpAction === "shoot"\n        ? "Cierre a máxima velocidad — sin finta, sin dudar. Lanza al recibir."\n        : "Cierra controlado — puede atacar si llegas en exceso.";\n      return `No dejar catch limpio. ${instES} Contesta cada toque.`;\n    }'
    ),
    # ES deny_trans_rim
    (
        '    case "deny_trans_rim":\n      return "Corre de vuelta. Sin cortes al aro en transición — ponte entre él/ella y el aro.";',
        '    case "deny_trans_rim":\n      return "Corre directo al aro. Va en carrera en cada pérdida — ponte entre ella y el aro antes de que llegue el balón.";'
    ),
    # ES force_early
    (
        '    case "force_early":\n      return "Fuerza tiros de inicio de posesión. Presión sobre el balón — no le dejes asentarse.";',
        '    case "force_early":\n      return "Fuerza el tiro en los primeros tres segundos. Métele encima desde el inicio — necesita tiempo para crear.";'
    ),
    # ES allow_spot_three
    (
        '    case "allow_spot_three":\n      return "Permite el tres en estático. Sin rango largo — el tiro está por debajo de la media.";',
        '    case "allow_spot_three":\n      return "Permite el catch en el perímetro. Sin rango largo — el dos largo es su mejor tiro exterior. Protege la pintura.";'
    ),
    # ES allow_iso
    (
        '    case "allow_iso":\n      return "Permite el ISO en situaciones no primarias. Baja eficiencia — que consuma posesión.";',
        '    case "allow_iso":\n      return "Permite el ISO. Baja eficiencia creando — dale el balón, mantente erguido/a y contesta el tiro.";'
    ),
    # ES force_contact
    (
        '    case "force_contact":\n      return "Fuerza el contacto — sé físico/a en cada penetración. No regalar mates fáciles.";',
        '    case "force_contact": {\n      const handES3 = inputs.hand === "R" ? "izquierda" : "derecha";\n      return `Sé físico/a en cada penetración — evita el contacto y busca espacio para finalizar. Empújala a la ${handES3} y contesta cada bandeja.`;\n    }'
    ),
    # ES force_direction — add ISO context
    (
        '      return `Fuerzala a la ${weakSide}. Finaliza peor en el PnR por ese lado — cárgate a la ${weakSide}, que tome el camino difícil.`;',
        '      const isIsoES = (inputs.isoFreq === "P" || inputs.isoFreq === "S") && inputs.isoDir !== "B";\n      if (isIsoES) {\n        const cES = inputs.contactFinish === "seeks" ? ` Mantente cuadrado/a — busca el contacto por su lado.` : "";\n        return `Fuerza a la ${weakSide} en el ISO. Va hacia su derecha — coloca el cuerpo a la ${weakSide} antes de que recoja.${cES}`;\n      }\n      return `Fuerza a la ${weakSide} por la pantalla. Finaliza peor por ese lado — cárgaste antes de que la pantalla esté puesta.`;'
    ),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        fixes.append(f'OK: {old[:50].strip()}')
    else:
        fixes.append(f'NOT FOUND: {old[:50].strip()}')

with open(path, 'w') as f:
    f.write(content)

print('\n'.join(fixes))
