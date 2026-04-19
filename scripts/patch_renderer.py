path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Add force_direction in EN — before case "force_early"
old_en = '    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";\n    case "force_no_space":'
new_en = '    case "force_direction": {\n      const dir = (inputs as any)._lastParams?.direction ?? inputs.isoDir;\n      const side = dir === "L" ? "left" : dir === "R" ? "right" : null;\n      if (side) return `Force her to the ${side}. Weaker finishing side in the PnR — shade coverage to deny her strong hand.`;\n      return "Force to the weaker side. Shade coverage based on the scouted dominant direction.";\n    }\n    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";\n    case "force_no_space":'

# Actually the renderer doesn't have access to params directly — use a simpler approach
# The key insight: force_direction with direction=L means "force left"
# But renderInstructionText doesn't receive params. We need to check how params flow.
# Looking at renderInstruction — it calls renderInstructionText(instruction.winner.key, inputs, ctx)
# params are in the Candidate but not passed to renderInstructionText.
# Fix: use inputs to infer — for PnR, force_direction always means "force to weak side"
# which is opposite of dominant hand.

old_en2 = '    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";\n    case "force_no_space":'
new_en2 = '    case "force_direction": {\n      // For PnR handlers: force toward the weaker finishing side (opposite of dominant hand)\n      const weakSide = inputs.hand === "R" ? "left" : "right";\n      return `Force ${weakSide}. Weaker finishing side in the PnR — shade ${weakSide}, make her go the hard way.`;\n    }\n    case "force_early":\n      return "Force early clock shots. Apply ball pressure — do not let them settle.";\n    case "force_no_space":'

if old_en2 in content:
    content = content.replace(old_en2, new_en2)
    print('OK EN')
else:
    print('NOT FOUND EN — trying original')
    # Try what's actually there
    idx = content.find('case "force_early":')
    print('force_early at char:', idx)
    print('context:', repr(content[max(0,idx-20):idx+80]))

# ES
old_es = '    case "force_early":\n      return "Fuerza tiros de inicio de posesi\u00f3n. Presi\u00f3n sobre el bal\u00f3n \u2014 no le dejes asentarse.";\n    case "force_no_space":'
new_es = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";\n      return `Fuerza a la ${weakSide}. Finaliza peor en el PnR por ese lado \u2014 c\u00e1rgate a la ${weakSide}, que tome el camino dif\u00edcil.`;\n    }\n    case "force_early":\n      return "Fuerza tiros de inicio de posesi\u00f3n. Presi\u00f3n sobre el bal\u00f3n \u2014 no le dejes asentarse.";\n    case "force_no_space":'

if old_es in content:
    content = content.replace(old_es, new_es)
    print('OK ES')
else:
    print('NOT FOUND ES')

# ZH
old_zh = '    case "force_early":\n      return "\u9022\u8feb\u5176\u5728\u8fdb\u653b\u65f6\u95f4\u65e9\u671f\u51fa\u624b\uff0c\u6301\u7eed\u65bd\u538b\u4e0d\u8ba9\u5176\u7ad9\u7a33\u3002";\n    case "force_no_space":'
new_zh = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "\u5de6\u4fa7" : "\u53f3\u4fa7";\n      return `\u9022\u8feb\u5176\u5411${weakSide}\u8fdb\u653b\uff0cPnR\u4e2d\u8be5\u4fa7\u7ec8\u7ed3\u80fd\u529b\u8f83\u5f31\u2014\u2014\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8d70\u96be\u8def\u3002`;\n    }\n    case "force_early":\n      return "\u9022\u8feb\u5176\u5728\u8fdb\u653b\u65f6\u95f4\u65e9\u671f\u51fa\u624b\uff0c\u6301\u7eed\u65bd\u538b\u4e0d\u8ba9\u5176\u7ad9\u7a33\u3002";\n    case "force_no_space":'

if old_zh in content:
    content = content.replace(old_zh, new_zh)
    print('OK ZH')
else:
    print('NOT FOUND ZH')

with open(path, 'w') as f:
    f.write(content)
print('done')
