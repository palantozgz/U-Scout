path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# The current force_direction case uses inputs.hand to determine weak side
# We need to keep it working for both the PnR asymmetry case and the new shooter case
# The renderer doesn't have access to params, so we use hand + context from inputs

# Current EN:
old_en = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "left" : "right";\n      return `Force ${weakSide}. Weaker finishing side in the PnR — shade ${weakSide}, make her go the hard way.`;\n    }'

new_en = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "left" : "right";\n      // Distinguish between directional force from PnR asymmetry vs mid-range shooter\n      const isShooterForce = inputs.deepRange &&\n        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&\n        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&\n        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";\n      if (isShooterForce) {\n        return `Force ${weakSide} — deny the mid-range pull-up. She avoids driving to the rim; push her ${weakSide} and make her attack the paint.`;\n      }\n      return `Force ${weakSide}. Weaker finishing side in the PnR — shade ${weakSide}, make her go the hard way.`;\n    }'

if old_en in content:
    content = content.replace(old_en, new_en)
    print('OK EN force_direction')
else:
    print('NOT FOUND EN')

# ES:
old_es = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";\n      return `Fuerzala a la ${weakSide}. Finaliza peor en el PnR por ese lado \u2014 c\u00e1rgate a la ${weakSide}, que tome el camino dif\u00edcil.`;\n    }'

new_es = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";\n      const isShooterForce = inputs.deepRange &&\n        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&\n        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&\n        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";\n      if (isShooterForce) {\n        return `Fuerza a la ${weakSide} — niega el pull-up de media distancia. Evita penetrar al aro; emp\u00fajala a la ${weakSide} y obl\u00edgala a atacar la pintura.`;\n      }\n      return `Fuerzala a la ${weakSide}. Finaliza peor en el PnR por ese lado \u2014 c\u00e1rgate a la ${weakSide}, que tome el camino dif\u00edcil.`;\n    }'

if old_es in content:
    content = content.replace(old_es, new_es)
    print('OK ES force_direction')
else:
    print('NOT FOUND ES')

# ZH:
old_zh = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "\u5de6\u4fa7" : "\u53f3\u4fa7";\n      return `\u9022\u8feb\u5176\u5411${weakSide}\u8fdb\u653b\uff0cPnR\u4e2d\u8be5\u4fa7\u7ec8\u7ed3\u80fd\u529b\u8f83\u5f31\u2014\u2014\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8d70\u96be\u8def\u3002`;\n    }'

new_zh = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "\u5de6\u4fa7" : "\u53f3\u4fa7";\n      const isShooterForce = inputs.deepRange &&\n        inputs.spotUpFreq != null && inputs.spotUpFreq !== "N" &&\n        inputs.pnrFinishLeft != null && inputs.pnrFinishRight != null &&\n        inputs.pnrFinishLeft !== "Drive to Rim" && inputs.pnrFinishRight !== "Drive to Rim";\n      if (isShooterForce) {\n        return `\u9022\u8feb\u5176\u5411${weakSide}\u7a81\u7834\u2014\u2014\u5c01\u5835\u4e2d\u8ddd\u79bb\u63a5\u7403\u673a\u4f1a\u3002\u5979\u9003\u907f\u7a81\u7834\u7b50\u4e0b\uff0c\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8fdb\u653b\u7981\u533a\u3002`;\n      }\n      return `\u9022\u8feb\u5176\u5411${weakSide}\u8fdb\u653b\uff0cPnR\u4e2d\u8be5\u4fa7\u7ec8\u7ed3\u80fd\u529b\u8f83\u5f31\u2014\u2014\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8d70\u96be\u8def\u3002`;\n    }'

if old_zh in content:
    content = content.replace(old_zh, new_zh)
    print('OK ZH force_direction')
else:
    print('NOT FOUND ZH')

with open(path, 'w') as f:
    f.write(content)
print('done')
