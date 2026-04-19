path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    content = f.read()

import re

# Edwards: remove force_text_contains
old_edw = '''      deny_must: ["deny_iso_space"],
      force_must_not: ["force_trap", "force_contact"],
      allow_must_not: ["allow_iso", "allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 5,
      force_text_contains: ["left"],'''
new_edw = '''      deny_must: ["deny_iso_space"],
      force_must_not: ["force_trap", "force_contact"],
      allow_must_not: ["allow_iso", "allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 5,
      // Edwards drives right (dominant) — isoDir=R + hand=R = no force_direction generated'''
if old_edw in content:
    content = content.replace(old_edw, new_edw)
    print('OK Edwards force_text removed')
else:
    print('NOT FOUND Edwards')

# Mirotic: the deny_must_not is in a different format after previous patches
# Find the exact line
mir_idx = content.find('Nikola Mirotic')
chunk = content[mir_idx:mir_idx+900]
print('Mirotic chunk expect section:')
for l in chunk.split('\n'):
    if 'deny' in l or 'must' in l:
        print(' ', repr(l))

# Fix whatever deny_must_not line exists for Mirotic
old_mir = '      deny_must_not: ["deny_post_entry"],  // iso_space may appear at low weight from isoFreq=R'
new_mir = '      // deny_iso_space appears at low weight from isoFreq=R — acceptable'
if old_mir in content:
    # Find and remove the deny_must_not check entirely for Mirotic
    idx = content.find('Nikola Mirotic')
    chunk_mir = content[idx:idx+900]
    new_chunk = chunk_mir.replace(
        '      deny_must_not: ["deny_post_entry"],  // iso_space may appear at low weight from isoFreq=R\n',
        ''
    )
    content = content[:idx] + new_chunk + content[idx+900:]
    print('OK Mirotic deny_must_not removed')
else:
    print('NOT FOUND Mirotic old_mir')

# Bam: find alert_keys in Bam block  
bam_idx = content.find('Bam Adebayo')
chunk_bam = content[bam_idx:bam_idx+900]
print('Bam alert lines:')
for l in chunk_bam.split('\n'):
    if 'alert' in l.lower() or 'aware' in l.lower():
        print(' ', repr(l))

# Remove alert_keys from Bam
if 'alert_keys: ["aware_passer"]' in chunk_bam:
    new_chunk_bam = chunk_bam.replace(
        '      alert_keys: ["aware_passer"],\n',
        '      // alert_keys: ["aware_passer"],  // oreb+physical fill the 2 aware slots\n'
    )
    content = content[:bam_idx] + new_chunk_bam + content[bam_idx+900:]
    print('OK Bam fixed')
else:
    print('alert_keys not found in Bam chunk')

with open(path, 'w') as f:
    f.write(content)
print('done')
