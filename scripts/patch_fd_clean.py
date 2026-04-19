path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# force_direction case to insert in each language block
# EN: insert before the FIRST case "force_early"
# ES: insert before the SECOND case "force_early"  
# ZH: insert before the THIRD (last) case "force_early"

FD_EN = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "left" : "right";\n      return `Force ${weakSide}. Weaker finishing side in the PnR — shade ${weakSide}, make her go the hard way.`;\n    }\n    '
FD_ES = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "izquierda" : "derecha";\n      return `Fuerza a la ${weakSide}. Finaliza peor en el PnR por ese lado \u2014 c\u00e1rgate a la ${weakSide}, que tome el camino dif\u00edcil.`;\n    }\n    '
FD_ZH = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "\u5de6\u4fa7" : "\u53f3\u4fa7";\n      return `\u9022\u8feb\u5176\u5411${weakSide}\u8fdb\u653b\uff0cPnR\u4e2d\u8be5\u4fa7\u7ec8\u7ed3\u80fd\u529b\u8f83\u5f31\u2014\u2014\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8d70\u96be\u8def\u3002`;\n    }\n    '

ANCHOR = 'case "force_early":'

# Find all three positions
positions = []
start = 0
while True:
    idx = content.find(ANCHOR, start)
    if idx == -1:
        break
    positions.append(idx)
    start = idx + 1

print(f'Found {len(positions)} force_early anchors at positions: {positions}')

if len(positions) != 3:
    print('ERROR: expected exactly 3')
else:
    # Insert in REVERSE ORDER to preserve positions
    # ZH (last)
    content = content[:positions[2]] + FD_ZH + content[positions[2]:]
    # ES (second) — positions[1] unchanged since we inserted after it
    content = content[:positions[1]] + FD_ES + content[positions[1]:]
    # EN (first)
    content = content[:positions[0]] + FD_EN + content[positions[0]:]
    
    count = content.count('force_direction')
    print(f'force_direction count after: {count}')
    
    with open(path, 'w') as f:
        f.write(content)
    print('OK')
