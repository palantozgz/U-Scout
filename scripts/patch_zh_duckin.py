path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

old = '    case "deny_oreb":\n      return "\u6bcf\u6b21\u51fa\u624b\u90fd\u8981\u5361\u4f4d\uff0c\u9876\u7ea7\u8fdb\u653b\u7bf9\u677f\u624b\u2014\u2014\u5fc5\u987b\u7269\u7406\u963b\u6321\u3002";\n    case "deny_dho":'
new = '    case "deny_duck_in":\n      return "\u5c01\u5835\u8eab\u540e\u63a5\u7403\uff0c\u63d0\u524d\u536b\u4f4d\u2014\u2014\u9632\u6b62\u5176\u6df1\u4f4d\u5c01\u4f4d\u8f7b\u677e\u63a5\u7403\u5f97\u5206\u3002";\n    case "deny_oreb":\n      return "\u6bcf\u6b21\u51fa\u624b\u90fd\u8981\u5361\u4f4d\uff0c\u9876\u7ea7\u8fdb\u653b\u7bf9\u677f\u624b\u2014\u2014\u5fc5\u987b\u7269\u7406\u963b\u6321\u3002";\n    case "deny_dho":'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print('OK ZH deny_duck_in')
else:
    print('NOT FOUND')
