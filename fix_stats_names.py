
path = '/Users/palant/Downloads/U scout/ucore/client/src/pages/core/Stats.tsx'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

# Fix 1: Roster names should respect locale
old1 = 'const name = p.nameEn?.trim() || p.nameZh || "\u2014";'
new1 = 'const name = pickName(p.nameZh, p.nameEn, locale) || "\u2014";'
if old1 in src:
    src = src.replace(old1, new1, 1)
    print('Fix 1 ok: roster locale')
else:
    lines = src.split('\n')
    for i, l in enumerate(lines[4580:4592], 4581):
        print(i, repr(l))
    raise SystemExit('Fix 1 NOT FOUND')

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print('done')
