path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Find renderInstructionZH function
zh_start = content.find('function renderInstructionZH')
print('renderInstructionZH at:', zh_start)

# Find deny_oreb after that point
idx = content.find('case "deny_oreb"', zh_start)
if idx >= 0:
    print('ZH deny_oreb at:', idx)
    print(repr(content[idx:idx+150]))
else:
    print('NO deny_oreb in ZH section')
    # Find deny_dho or deny_pnr in ZH to anchor insertion point
    idx2 = content.find('case "deny_dho"', zh_start)
    print('ZH deny_dho at:', idx2)
    if idx2 >= 0:
        print(repr(content[idx2:idx2+100]))
