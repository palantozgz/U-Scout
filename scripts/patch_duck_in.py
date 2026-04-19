path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Add deny_duck_in EN — before deny_oreb case in EN section
old_en = '    case "deny_oreb":\n      return "Box out on every shot. Elite offensive rebounder — physical block-out required.";'
new_en = '    case "deny_duck_in":\n      return "Deny the duck-in. Get in front early — they seal deep for the easy catch and finish.";\n    case "deny_oreb":\n      return "Box out on every shot. Elite offensive rebounder — physical block-out required.";'

if old_en in content:
    content = content.replace(old_en, new_en)
    print('OK EN deny_duck_in')
else:
    print('NOT FOUND EN deny_oreb context')

# Add deny_duck_in ES
old_es = '    case "deny_oreb":\n      return "Bloquear en cada tiro. Reboteador/a ofensivo/a élite — bloqueo físico obligatorio.";'
new_es = '    case "deny_duck_in":\n      return "Niega el duck-in. Ponte por delante pronto — sella profundo para recibir y anotar fácil.";\n    case "deny_oreb":\n      return "Bloquear en cada tiro. Reboteador/a ofensivo/a élite — bloqueo físico obligatorio.";'

if old_es in content:
    content = content.replace(old_es, new_es)
    print('OK ES deny_duck_in')
else:
    print('NOT FOUND ES deny_oreb context')

# Add deny_duck_in ZH
old_zh = '    case "deny_oreb":\n      return "\u6bcf\u6b21\u51fa\u624b\u90fd\u8981\u5361\u4f4d\uff0c\u9876\u7ea7\u8fdb\u653b\u7bf9\u677f\u624b\u2014\u2014\u5fc5\u987b\u7269\u7406\u963b\u6321\u3002";'
new_zh = '    case "deny_duck_in":\n      return "\u5c01\u5835\u8eab\u540e\u63a5\u7403\uff0c\u63d0\u524d\u536b\u4f4d\u2014\u2014\u9632\u6b62\u5176\u6df1\u4f4d\u5c01\u4f4d\u8f7b\u677e\u63a5\u7403\u5f97\u5206\u3002";\n    case "deny_oreb":\n      return "\u6bcf\u6b21\u51fa\u624b\u90fd\u8981\u5361\u4f4d\uff0c\u9876\u7ea7\u8fdb\u653b\u7bf9\u677f\u624b\u2014\u2014\u5fc5\u987b\u7269\u7406\u963b\u6321\u3002";'

if old_zh in content:
    content = content.replace(old_zh, new_zh)
    print('OK ZH deny_duck_in')
else:
    print('NOT FOUND ZH deny_oreb context')

with open(path, 'w') as f:
    f.write(content)
print('done')
