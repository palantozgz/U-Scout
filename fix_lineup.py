
path = '/Users/palant/Downloads/U scout/ucore/client/src/pages/core/Stats.tsx'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

old = "      if (/^\\d+$/.test(t)) return `#${t.slice(-4)}`;"
new = "      if (/^\\d+$/.test(t)) return locale === 'zh' ? '\u7403\u5458' : 'Jug.';"

if old in src:
    src = src.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print('ok')
else:
    print('NOT FOUND')
    print(repr(src[5600:5700]))
