path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Add allow_pnr_mid_range EN
old_en = '    case "allow_iso_both":\n      return "Allow ISO attempts from either side. Low efficiency in isolation — make them use the clock.";'
new_en = '    case "allow_pnr_mid_range":\n      return "Allow mid-range pull-ups off the PnR. No deep range — the mid-range is the least efficient shot. Stay tight on transition and cutters instead.";\n    case "allow_iso_both":\n      return "Allow ISO attempts from either side. Low efficiency in isolation — make them use the clock.";'
if old_en in content:
    content = content.replace(old_en, new_en)
    print('OK EN allow_pnr_mid_range')
else:
    print('NOT FOUND EN allow_iso_both')

# ES
old_es = '    case "allow_iso_both":\n      return "Permite el ISO desde cualquier lado. Baja eficiencia en aislamiento — que use el reloj.";'
new_es = '    case "allow_pnr_mid_range":\n      return "Permite el pull-up de media distancia en el PnR. Sin rango largo — el mid-range es el tiro menos eficiente. Concéntrate en transición y cortadores.";\n    case "allow_iso_both":\n      return "Permite el ISO desde cualquier lado. Baja eficiencia en aislamiento — que use el reloj.";'
if old_es in content:
    content = content.replace(old_es, new_es)
    print('OK ES allow_pnr_mid_range')
else:
    print('NOT FOUND ES allow_iso_both')

# ZH
old_zh = '    case "allow_iso_both":\n      return "允许单打，单打效率低——让其消耗进攻时间。";'
new_zh = '    case "allow_pnr_mid_range":\n      return "允许挡拆后中距离跳投，无远射程——中距离是效率最低的投篮，专注于快攻和切入防守。";\n    case "allow_iso_both":\n      return "允许单打，单打效率低——让其消耗进攻时间。";'
if old_zh in content:
    content = content.replace(old_zh, new_zh)
    print('OK ZH allow_pnr_mid_range')
else:
    print('NOT FOUND ZH allow_iso_both')

with open(path, 'w') as f:
    f.write(content)
print('done')
