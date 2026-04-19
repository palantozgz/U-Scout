path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Find exact bytes around deny_oreb in ZH
idx = content.find('case "deny_oreb"', 29541)
chunk = content[idx:idx+200]
print(repr(chunk))
