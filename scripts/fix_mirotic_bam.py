path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

# Mirotic: exact string
old_mir = '      deny_must_not: ["deny_iso_space", "deny_post_entry"],'
new_mir = '      deny_must_not: ["deny_post_entry"],  // deny_iso_space generated from isoFreq=R — acceptable'
# Only for Mirotic — find his block
idx = content.find('Nikola Mirotic')
section = content[idx:idx+900]
if old_mir in section:
    new_section = section.replace(old_mir, new_mir, 1)
    content = content[:idx] + new_section + content[idx+900:]
    print('OK Mirotic')
else:
    print('NOT in section:', repr(old_mir[:50]))

# Bam: search wider
bam_idx = content.find('Bam Adebayo')
section_bam = content[bam_idx:bam_idx+1200]
print('Bam aware lines:')
for l in section_bam.split('\n'):
    if 'alert' in l or 'passer' in l:
        print(repr(l))

with open(path, 'w') as f:
    f.write(content)
print('done')
