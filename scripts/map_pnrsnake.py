path = '/Users/palant/Downloads/U scout/client/src/lib/mock-data.ts'
with open(path, 'r') as f:
    content = f.read()

old = '    pnrScreenTiming: inputs.pnrScreenTiming ?? null,'
new = '    pnrScreenTiming: inputs.pnrScreenTiming ?? null,\n    pnrSnake: inputs.pnrSnake ?? null,'

if old in content:
    content = content.replace(old, new)
    print('OK pnrSnake mapped in mock-data')
else:
    print('NOT FOUND pnrScreenTiming in mock-data')

with open(path, 'w') as f:
    f.write(content)
