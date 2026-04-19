"""
Mejoras al renderer basadas en documentación técnica de scouting real:
- Basketball Immersion (Chris Oliver, Synergy-based scouting reports)
- Basketball HQ, HoopTactics, Pete Lonergan PnR concepts
- Principios: instrucciones ejecutables con CUÁNDO + CÓMO + POR QUÉ

Los textos actuales son correctos pero genéricos.
Los nuevos son específicos, accionables, con contexto de ejecución.
"""

path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

fixes = []

# ─── ENGLISH ───────────────────────────────────────────────────────────────────

# DENY ISO SPACE: add positioning context — when/how to deny
old = '''    case "deny_iso_space":
      return inputs.isoDir === "R"
        ? "Deny the right wing catch. Force them left before they set up."
        : inputs.isoDir === "L"
          ? "Deny the left wing catch. Force them right — their weaker side."
          : "Deny ISO catches on both wings. Make them work for every touch.";'''

new = '''    case "deny_iso_space": {
      const dirEN = inputs.isoDir === "R"
        ? "right wing"
        : inputs.isoDir === "L"
          ? "left wing"
          : "both wings";
      const forceEN = inputs.isoDir === "R"
        ? "Force left — contest every touch before they gather."
        : inputs.isoDir === "L"
          ? "Force right — do not let them set up going their way."
          : "Stay between ball and body — no free catches in space.";
      const athNote = (inputs.ath ?? 3) >= 4
        ? " Do not reach — they create off contact."
        : "";
      return `Deny the ${dirEN} catch. ${forceEN}${athNote}`;
    }'''

if old in content:
    content = content.replace(old, new)
    fixes.append('OK EN deny_iso_space enriched')
else:
    fixes.append('NOT FOUND EN deny_iso_space')

# DENY PNR DOWNHILL: add screen-specific instruction
old2 = '    case "deny_pnr_downhill":\n      return "Deny the downhill PnR attack. Get over the screen — do not go under.";'
new2 = '''    case "deny_pnr_downhill": {
      const deepEN = inputs.deepRange
        ? "Get over the screen — do not go under. She shoots immediately if you give her the pull-up."
        : "Stay attached over the screen. No space for a mid-range pull-up.";
      const passerNote = inputs.pnrPri === "PF"
        ? " She will look to pass first — stay connected to the roll man."
        : "";
      return `Deny the downhill PnR catch. ${deepEN}${passerNote}`;
    }'''

if old2 in content:
    content = content.replace(old2, new2)
    fixes.append('OK EN deny_pnr_downhill enriched')
else:
    fixes.append('NOT FOUND EN deny_pnr_downhill')

# DENY POST ENTRY: specific shoulder + technique
old3 = '''    case "deny_post_entry":
      return inputs.postShoulder === "R"
        ? "Front the right block entry. Three-quarter position on the right shoulder."
        : "Front the left block entry. Three-quarter position on the left shoulder.";'''
new3 = '''    case "deny_post_entry": {
      const sideEN = inputs.postShoulder === "R" ? "right" : inputs.postShoulder === "L" ? "left" : "preferred";
      const techEN = inputs.phys && inputs.phys >= 4
        ? `Front the ${sideEN} block. Three-quarter on the ${sideEN} shoulder — push high, do not let her establish deep position.`
        : `Deny the ${sideEN} block entry. Three-quarter position — get in front before she seals.`;
      const physNote = inputs.phys && inputs.phys >= 4 ? " She is physical — beat her to the spot before the ball arrives." : "";
      return techEN + physNote;
    }'''

if old3 in content:
    content = content.replace(old3, new3)
    fixes.append('OK EN deny_post_entry enriched')
else:
    fixes.append('NOT FOUND EN deny_post_entry')

# DENY SPOT DEEP: add closeout mechanics
old4 = '    case "deny_spot_deep":\n      return "Deny the deep catch. Extend your close-out — they shoot immediately off the catch.";'
new4 = '''    case "deny_spot_deep": {
      const instantEN = inputs.spotUpAction === "shoot"
        ? "Sprint to close out — no pump fake, no hesitation. She fires immediately on the catch."
        : "Close out under control — she may attack off the dribble on a soft closeout.";
      return `No open catch on the perimeter. ${instantEN} Contest every touch.`;
    }'''

if old4 in content:
    content = content.replace(old4, new4)
    fixes.append('OK EN deny_spot_deep enriched')
else:
    fixes.append('NOT FOUND EN deny_spot_deep')

# FORCE DIRECTION: enrich with ISO vs PnR context (already has shooter logic, add more)
old5 = '''    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "left" : "right";
      // Distinguish between directional force from PnR asymmetry vs mid-range shooter
      const isShooterForce = inputs.deepRange &&
        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
      if (isShooterForce) {
        return `Force ${weakSide} — deny the mid-range pull-up. She avoids driving to the rim; push her ${weakSide} and make her attack the paint.`;
      }
      return `Force ${weakSide}. Weaker finishing side in the PnR — shade ${weakSide}, make her go the hard way.`;
    }'''

new5 = '''    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "left" : "right";
      const isShooterForce = inputs.deepRange &&
        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
      const isIsoForce = (inputs.isoFreq === "P" || inputs.isoFreq === "S") &&
        inputs.isoDir !== "B";
      if (isShooterForce) {
        return `Force ${weakSide} — deny the mid-range pull-up. She avoids the rim; push her ${weakSide} and make her attack the paint.`;
      }
      if (isIsoForce) {
        const contactNote = inputs.contactFinish === "seeks"
          ? ` Stay square — she looks for contact going her way.`
          : "";
        return `Force ${weakSide} in ISO. She goes to her right — shade your body ${weakSide} before she gathers.${contactNote}`;
      }
      return `Force ${weakSide} off the screen. She finishes better going right — shade ${weakSide} early, before the screen is set.`;
    }'''

if old5 in content:
    content = content.replace(old5, new5)
    fixes.append('OK EN force_direction ISO context added')
else:
    fixes.append('NOT FOUND EN force_direction')

# FORCE EARLY: add mechanism
old6 = '    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";'
new6 = '''    case "force_early":
      return "Force early clock shots. Get into her in the first three seconds — do not let her survey the floor. She needs time to create.";'''

if old6 in content:
    content = content.replace(old6, new6)
    fixes.append('OK EN force_early mechanism')
else:
    fixes.append('NOT FOUND EN force_early')

# ALLOW SPOT THREE: change from passive to active redirect
old7 = '    case "allow_spot_three":\n      return "Allow spot-up threes. No deep range — the shot is below average.";'
new7 = '''    case "allow_spot_three":
      return "Allow spot-up catches. No deep range — the long two is her best perimeter shot. Protect the paint instead.";'''

if old7 in content:
    content = content.replace(old7, new7)
    fixes.append('OK EN allow_spot_three active redirect')
else:
    fixes.append('NOT FOUND EN allow_spot_three')

# ALLOW ISO: add redirect instruction
old8 = '    case "allow_iso":\n      return "Allow ISO attempts in non-primary situations. Low efficiency — make them use clock.";'
new8 = '''    case "allow_iso":
      return "Allow ISO attempts. Low efficiency when she creates off the dribble — give her the ball, stay upright, and contest the shot.";'''

if old8 in content:
    content = content.replace(old8, new8)
    fixes.append('OK EN allow_iso redirected')
else:
    fixes.append('NOT FOUND EN allow_iso')

# ALLOW DISTANCE: enrich
old9 = '    case "allow_distance":\n      return "Give distance. No exterior range — sag off and protect the paint.";'
new9 = '''    case "allow_distance":
      return "Sag off. No perimeter range — give her the catch and focus on protecting the paint and box-out.";'''

if old9 in content:
    content = content.replace(old9, new9)
    fixes.append('OK EN allow_distance')
else:
    fixes.append('NOT FOUND EN allow_distance')

# DENY TRANS RIM: add mechanism
old10 = '    case "deny_trans_rim":\n      return "Sprint back. No basket cuts in transition — get between them and the rim.";'
new10 = '''    case "deny_trans_rim":
      return "Sprint directly to the rim. She runs hard on every miss — get between her and the basket before the ball arrives.";'''

if old10 in content:
    content = content.replace(old10, new10)
    fixes.append('OK EN deny_trans_rim sprinting cue')
else:
    fixes.append('NOT FOUND EN deny_trans_rim')

# DENY OREB: add timing
old11 = '    case "deny_oreb":\n      return "Box out on every shot. Elite offensive rebounder — physical block-out required.";'
new11 = '''    case "deny_oreb":
      return "Find her before the shot goes up — not after. Box out early and physically. She crashes every possession.";'''

if old11 in content:
    content = content.replace(old11, new11)
    fixes.append('OK EN deny_oreb timing cue')
else:
    fixes.append('NOT FOUND EN deny_oreb')

# FORCE CONTACT: add context
old12 = '    case "force_contact":\n      return "Force into contact — be physical on every drive. Do not give easy layups.";'
new12 = '''    case "force_contact": {
      const handEN = inputs.hand === "R" ? "left" : "right";
      return `Be physical on drives — she avoids contact and looks for space to finish. Push her ${handEN} and make every layup contested.`;
    }'''

if old12 in content:
    content = content.replace(old12, new12)
    fixes.append('OK EN force_contact with direction')
else:
    fixes.append('NOT FOUND EN force_contact')

# AWARE PASSER — alert text enrichment
old_alert_en = '    if (key.includes("passer") || key.includes("vision"))\n      return "High-level passer — reads the double team instantly.";'
new_alert_en = '''    if (key.includes("passer") || key.includes("vision"))
      return "Elite passer — head up before the trap closes. Stay connected to the roll man.";'''

if old_alert_en in content:
    content = content.replace(old_alert_en, new_alert_en)
    fixes.append('OK EN aware_passer alert enriched')
else:
    fixes.append('NOT FOUND EN aware_passer alert')

# AWARE PRESSURE VULN — alert text
old_alert_p = '    if (key.includes("pressure_vuln"))\n      return "Struggles under pressure. Active hands — force the trap.";'
new_alert_p = '''    if (key.includes("pressure_vuln"))
      return "Vulnerable to pressure. Attack the ball on the catch — disrupt her before she can gather and survey.";'''

if old_alert_p in content:
    content = content.replace(old_alert_p, new_alert_p)
    fixes.append('OK EN aware_pressure_vuln alert')
else:
    fixes.append('NOT FOUND EN aware_pressure_vuln alert')

# ─── SPANISH ───────────────────────────────────────────────────────────────────

# ES deny_iso_space
old_es1 = '    case "deny_iso_space":\n      return inputs.isoDir === "R"\n        ? "Niega el agarre en banda derecha. Fuérzale a la izquierda antes de que se coloque."\n        : inputs.isoDir === "L"\n          ? "Niega el agarre en banda izquierda. Fuérzale a la derecha — su lado débil."\n          : "Niega el agarre en ambas bandas. Que trabaje cada contacto.";'
new_es1 = '''    case "deny_iso_space": {
      const dirES = inputs.isoDir === "R" ? "banda derecha" : inputs.isoDir === "L" ? "banda izquierda" : "ambas bandas";
      const forceES = inputs.isoDir === "R"
        ? "Fuérzale a la izquierda — contesta cada agarre antes de que se coloque."
        : inputs.isoDir === "L"
          ? "Fuérzale a la derecha — no le dejes atacar por su lado."
          : "Cuerpo entre balón y cuerpo — que trabaje para recibir.";
      const athES = (inputs.ath ?? 3) >= 4 ? " No estires la mano — crea desde el contacto." : "";
      return `Niega el agarre en ${dirES}. ${forceES}${athES}`;
    }'''

if old_es1 in content:
    content = content.replace(old_es1, new_es1)
    fixes.append('OK ES deny_iso_space enriched')
else:
    fixes.append('NOT FOUND ES deny_iso_space')

# ES deny_pnr_downhill
old_es2 = '    case "deny_pnr_downhill":\n      return "Niega el ataque en downhill. Pasa por encima de la pantalla — no por abajo.";'
new_es2 = '''    case "deny_pnr_downhill": {
      const deepES = inputs.deepRange
        ? "Pasa por encima de la pantalla — no vayas por abajo. Tira de inmediato si le das el pull-up."
        : "Pégate por encima. No le des espacio para el pull-up de media distancia.";
      const passerES = inputs.pnrPri === "PF" ? " Pasadora prioritaria — mantente conectado al bloqueador." : "";
      return `Niega el agarre en el bloqueo directo. ${deepES}${passerES}`;
    }'''

if old_es2 in content:
    content = content.replace(old_es2, new_es2)
    fixes.append('OK ES deny_pnr_downhill enriched')
else:
    fixes.append('NOT FOUND ES deny_pnr_downhill')

# ES deny_spot_deep
old_es3 = '    case "deny_spot_deep":\n      return "Niega el agarre en profundidad. Extiende el cierre — tira de inmediato al recibir.";'
new_es3 = '''    case "deny_spot_deep": {
      const instantES = inputs.spotUpAction === "shoot"
        ? "Cierre a máxima velocidad — sin finta de tiro, sin dudar. Lanza al recibir."
        : "Cierra controlado — puede atacar si llegas en exceso.";
      return `No dejar agarre limpio en el perímetro. ${instantES} Contestar cada toque.`;
    }'''

if old_es3 in content:
    content = content.replace(old_es3, new_es3)
    fixes.append('OK ES deny_spot_deep enriched')
else:
    fixes.append('NOT FOUND ES deny_spot_deep')

# ES force_direction (already has shooter logic, add ISO context)
old_es4 = '''    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";
      const isShooterForce = inputs.deepRange &&
        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
      if (isShooterForce) {
        return `Fuerza a la ${weakSide} — niega el pull-up de media distancia. Evita penetrar al aro; empújala a la ${weakSide} y oblígala a atacar la pintura.`;
      }
      return `Fuérzala a la ${weakSide}. Finaliza peor en el PnR por ese lado — cárgaste a la ${weakSide}, que tome el camino difícil.`;
    }'''
new_es4 = '''    case "force_direction": {
      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";
      const isShooterForce = inputs.deepRange &&
        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&
        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&
        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";
      const isIsoForceES = (inputs.isoFreq === "P" || inputs.isoFreq === "S") && inputs.isoDir !== "B";
      if (isShooterForce) {
        return `Fuerza a la ${weakSide} — niega el pull-up de media distancia. Evita el aro; empújala a la ${weakSide} y oblígala a atacar la pintura.`;
      }
      if (isIsoForceES) {
        const contactES = inputs.contactFinish === "seeks" ? ` Mantente cuadrado — busca el contacto por su lado.` : "";
        return `Fuerza a la ${weakSide} en el ISO. Va hacia su derecha — coloca tu cuerpo a la ${weakSide} antes de que recoja.${contactES}`;
      }
      return `Fuerza a la ${weakSide} por la pantalla. Finaliza peor por ese lado — cárgaste antes de que la pantalla esté puesta.`;
    }'''

if old_es4 in content:
    content = content.replace(old_es4, new_es4)
    fixes.append('OK ES force_direction ISO context')
else:
    fixes.append('NOT FOUND ES force_direction')

# ES allow_spot_three
old_es5 = '    case "allow_spot_three":\n      return "Permite los triples en spot-up. Sin rango — el tiro está por debajo de la media.";'
new_es5 = '    case "allow_spot_three":\n      return "Permite el agarre en el perímetro. Sin rango largo — el dos largo es su mejor tiro exterior. Protege la pintura.";'

if old_es5 in content:
    content = content.replace(old_es5, new_es5)
    fixes.append('OK ES allow_spot_three')
else:
    fixes.append('NOT FOUND ES allow_spot_three')

# ES deny_oreb
old_es6 = '    case "deny_oreb":\n      return "Bloqueo en cada tiro. Reboteadora ofensiva élite — bloqueo físico obligatorio.";'
new_es6 = '    case "deny_oreb":\n      return "Búscala antes de que salga el tiro — no después. Bloqueo anticipado y físico. Va al rebote en cada posesión.";'

if old_es6 in content:
    content = content.replace(old_es6, new_es6)
    fixes.append('OK ES deny_oreb timing')
else:
    fixes.append('NOT FOUND ES deny_oreb')

with open(path, 'w') as f:
    f.write(content)

print('\n'.join(fixes))
print(f'\nTotal: {len(fixes)} fixes')
