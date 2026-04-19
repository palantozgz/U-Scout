path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Find ZH deny_oreb actual text
idx = content.find('case "deny_oreb"', content.find('renderInstructionZH'))
if idx >= 0:
    print(repr(content[idx:idx+120]))
else:
    print('NOT FOUND in ZH section')
    # find all occurrences
    i = 0
    while True:
        idx2 = content.find('case "deny_oreb"', i)
        if idx2 < 0: break
        print('at', idx2, ':', repr(content[idx2:idx2+100]))
        i = idx2 + 1
