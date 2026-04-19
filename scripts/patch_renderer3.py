path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    lines = f.readlines()

content = ''.join(lines)

# EN: insert force_direction before first occurrence of case "force_early"
en_old = '    case "force_early":\n      return "Force early clock shots. Apply ball pressure \u2014 do not let them settle.";\n    case "force_no_space":\n      return "Force them into no-space catches. Tight on the catch, no room to set up.";'
en_new = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "left" : "right";\n      return `Force ${weakSide}. Weaker finishing side in the PnR \u2014 shade ${weakSide}, make her go the hard way.`;\n    }\n    case "force_early":\n      return "Force early clock shots. Apply ball pressure \u2014 do not let them settle.";\n    case "force_no_space":\n      return "Force them into no-space catches. Tight on the catch, no room to set up.";'

# ES
es_old = '    case "force_early":\n      return "Fuerza tiros de inicio de posesi\u00f3n. Presi\u00f3n sobre el bal\u00f3n \u2014 no le dejes asentarse.";\n    case "force_no_space":\n      return "Fuerza el catch sin espacio. Pegado/a en la recepci\u00f3n \u2014 sin margen para prepararse.";'
es_new = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";\n      return `Fuerzala a la ${weakSide}. Finaliza peor en el PnR por ese lado \u2014 c\u00e1rgate a la ${weakSide}, que tome el camino dif\u00edcil.`;\n    }\n    case "force_early":\n      return "Fuerza tiros de inicio de posesi\u00f3n. Presi\u00f3n sobre el bal\u00f3n \u2014 no le dejes asentarse.";\n    case "force_no_space":\n      return "Fuerza el catch sin espacio. Pegado/a en la recepci\u00f3n \u2014 sin margen para prepararse.";'

# ZH
zh_old = '    case "force_early":\n      return "\u9022\u8feb\u5176\u5728\u8fdb\u653b\u65f6\u95f4\u65e9\u671f\u51fa\u624b\uff0c\u6301\u7eed\u65bd\u538b\u4e0d\u8ba9\u5176\u7ad9\u7a33\u3002";\n    case "force_no_space":\n      return "\u9022\u8feb\u5176\u5728\u65e0\u7a7a\u95f4\u5904\u63a5\u7403\uff0c\u7d27\u8d34\u9632\u5b88\u3002";'
zh_new = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "\u5de6\u4fa7" : "\u53f3\u4fa7";\n      return `\u9022\u8feb\u5176\u5411${weakSide}\u8fdb\u653b\uff0cPnR\u4e2d\u8be5\u4fa7\u7ec8\u7ed3\u80fd\u529b\u8f83\u5f31\u2014\u2014\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8d70\u96be\u8def\u3002`;\n    }\n    case "force_early":\n      return "\u9022\u8feb\u5176\u5728\u8fdb\u653b\u65f6\u95f4\u65e9\u671f\u51fa\u624b\uff0c\u6301\u7eed\u65bd\u538b\u4e0d\u8ba9\u5176\u7ad9\u7a33\u3002";\n    case "force_no_space":\n      return "\u9022\u8feb\u5176\u5728\u65e0\u7a7a\u95f4\u5904\u63a5\u7403\uff0c\u7d27\u8d34\u9632\u5b88\u3002";'

count = 0
for old, new in [(en_old, en_new), (es_old, es_new), (zh_old, zh_new)]:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print('OK')
    else:
        print('NOT FOUND:', repr(old[:60]))

with open(path, 'w') as f:
    f.write(content)
print(f'done ({count}/3)')
