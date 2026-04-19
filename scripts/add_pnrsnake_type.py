path = '/Users/palant/Downloads/U scout/client/src/lib/motor-v2.1.ts'
with open(path, 'r') as f:
    content = f.read()

# Add pnrSnake to PlayerInputs interface after pnrScreenTiming
old = "  pnrScreenTiming?: 'holds_long' | 'quick_release' | 'ghost_touch' | 'slip' | null;"
new = "  pnrScreenTiming?: 'holds_long' | 'quick_release' | 'ghost_touch' | 'slip' | null;\n  pnrSnake?: boolean | null;  // Handler reverses direction off the screen"

if old in content:
    content = content.replace(old, new)
    print('OK pnrSnake added to PlayerInputs')
else:
    print('NOT FOUND pnrScreenTiming')

with open(path, 'w') as f:
    f.write(content)
