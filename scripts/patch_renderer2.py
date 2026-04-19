path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

old_zh = '    case "force_early":\n      return "\u9022\u8feb\u5176\u5728\u8fdb\u653b\u65f6\u95f4\u65e9\u671f\u51fa\u624b\uff0c\u6301\u7eed\u65bd\u538b\u4e0d\u8ba9\u5176\u7ad9\u7a33\u3002";\n    case "force_no_space":\n      return "\u9022\u8feb\u5176\u5728\u65e0\u7a7a\u95f4\u5904\u63a5\u7403\uff0c\u7d27\u8d34\u9632\u5b88\u3002";'
new_zh = '    case "force_direction": {\n      const weakSide = inputs.hand === "R" ? "\u5de6\u4fa7" : "\u53f3\u4fa7";\n      return `\u9022\u8feb\u5176\u5411${weakSide}\u8fdb\u653b\uff0cPnR\u4e2d\u8be5\u4fa7\u7ec8\u7ed3\u80fd\u529b\u8f83\u5f31\u2014\u2014\u9760\u5411${weakSide}\uff0c\u8feb\u5176\u8d70\u96be\u8def\u3002`;\n    }\n    case "force_early":\n      return "\u9022\u8feb\u5176\u5728\u8fdb\u653b\u65f6\u95f4\u65e9\u671f\u51fa\u624b\uff0c\u6301\u7eed\u65bd\u538b\u4e0d\u8ba9\u5176\u7ad9\u7a33\u3002";\n    case "force_no_space":\n      return "\u9022\u8feb\u5176\u5728\u65e0\u7a7a\u95f4\u5904\u63a5\u7403\uff0c\u7d27\u8d34\u9632\u5b88\u3002";'

if old_zh in content:
    content = content.replace(old_zh, new_zh)
    print('OK ZH')
    with open(path, 'w') as f:
        f.write(content)
else:
    print('NOT FOUND ZH')
    # Find where the ZH force_early is
    idx = content.rfind('case "force_early":')
    print('last force_early at:', idx)
    print(repr(content[idx:idx+120]))
print('done')
