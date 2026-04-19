path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

insert_at = content.find('case "deny_oreb":\n      return "\u6bcf\u6b21\u51fa\u624b', 29541)
if insert_at >= 0:
    insert_text = '    case "deny_duck_in":\n      return "\u5c01\u5835\u8eab\u540e\u63a5\u7403\uff0c\u63d0\u524d\u536b\u4f4d\u2014\u2014\u9632\u6b62\u5176\u6df1\u4f4d\u5c01\u4f4d\u8f7b\u677e\u63a5\u7403\u5f97\u5206\u3002";\n    '
    content = content[:insert_at] + insert_text + content[insert_at:]
    with open(path, 'w') as f:
        f.write(content)
    print('OK ZH deny_duck_in inserted')
else:
    print('NOT FOUND at', insert_at)
