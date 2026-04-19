path = '/Users/palant/Downloads/U scout/client/src/lib/mock-data.ts'
with open(path, 'r') as f:
    content = f.read()

# Current trapResponse inference — only from vision
old = """  let trapResponse: PlayerInputs["trapResponse"] = null;
  if (isActive(inputs.pnrFrequency) && pnrIsHandler) {
    if (vision >= 5) trapResponse = "escape";
    else if (vision >= 3) trapResponse = "pass";
    else trapResponse = "struggle";
  }"""

# Fix: motorPressureResponse from editor (escapes/struggles) overrides the vision inference
# when it's set. This is the scout's direct observation taking priority over inference.
new = """  let trapResponse: PlayerInputs["trapResponse"] = null;
  if (isActive(inputs.pnrFrequency) && pnrIsHandler) {
    // Scout's direct observation has priority over vision inference
    if (inputs.motorPressureResponse === "struggles") {
      trapResponse = "struggle";
    } else if (inputs.motorPressureResponse === "escapes") {
      trapResponse = "escape";
    } else {
      // Infer from vision when not observed directly
      if (vision >= 5) trapResponse = "escape";
      else if (vision >= 3) trapResponse = "pass";
      else trapResponse = "struggle";
    }
  }"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print('OK trapResponse fix')
else:
    print('NOT FOUND')
    idx = content.find('let trapResponse')
    print('at:', idx)
    print(repr(content[idx:idx+200]))
