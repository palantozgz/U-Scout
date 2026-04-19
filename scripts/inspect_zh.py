path = '/Users/palant/Downloads/U scout/client/src/lib/reportTextRenderer.ts'
with open(path, 'r') as f:
    content = f.read()

# Find the ZH force_early and print context
idx = content.rfind('case "force_early"')
print(repr(content[idx-4:idx+120]))
