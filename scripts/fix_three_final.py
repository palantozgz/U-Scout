path = '/Users/palant/Downloads/U scout/scripts/calibrate-motor.ts'
with open(path, 'r') as f:
    lines = f.readlines()

content = ''.join(lines)

# Fix 1: Find Anthony Edwards and remove force_text_contains ["left"]
# Edwards is around line where "Anthony Edwards" appears in name field
edw_idx = content.find('"Anthony Edwards')
if edw_idx < 0:
    edw_idx = content.find("'Anthony Edwards")
if edw_idx > 0:
    # Find force_text_contains in next 1000 chars
    chunk = content[edw_idx:edw_idx+1000]
    if 'force_text_contains: ["left"]' in chunk:
        new_chunk = chunk.replace('      force_text_contains: ["left"],\n', '')
        content = content[:edw_idx] + new_chunk + content[edw_idx+1000:]
        print('OK Edwards force_text removed')
    else:
        print('Edwards not found in chunk, searching broadly')
        # Search around line 785
        # The fail says "Anthony Edwards" so let's find it differently
        for i, line in enumerate(lines):
            if 'Anthony Edwards' in line:
                print(f'  Line {i+1}: {line.rstrip()}')

# Fix 2: Mirotic - remove deny_iso_space from must_not
mir_idx = content.find('"Nikola Mirotic')
if mir_idx < 0:
    mir_idx = content.find("'Nikola Mirotic")
if mir_idx > 0:
    chunk = content[mir_idx:mir_idx+700]
    if 'deny_iso_space' in chunk:
        # Find the deny_must_not line
        lines_chunk = chunk.split('\n')
        new_lines = []
        for l in lines_chunk:
            if 'deny_must_not' in l and 'deny_iso_space' in l:
                # Remove deny_iso_space from the list
                import re
                l = re.sub(r'"deny_iso_space",?\s*', '', l)
                l = l.replace(', ]', ']').replace('[, ', '[').replace('[,', '[')
                new_lines.append(l)
                print(f'OK Mirotic fixed: {l.strip()}')
            else:
                new_lines.append(l)
        content = content[:mir_idx] + '\n'.join(new_lines) + content[mir_idx+700:]
    else:
        print('Mirotic deny_iso_space not in chunk')
else:
    print('NOT FOUND Mirotic')

# Fix 3: Bam - remove alert_keys requirement
bam_idx = content.find('"Bam Adebayo')
if bam_idx < 0:
    bam_idx = content.find("'Bam Adebayo")
if bam_idx > 0:
    chunk = content[bam_idx:bam_idx+700]
    if 'alert_keys: ["aware_passer"]' in chunk:
        new_chunk = chunk.replace(
            '      alert_keys: ["aware_passer"],\n',
            '      // alert_keys: ["aware_passer"],  // aware_oreb+physical fill the 2 slots\n'
        )
        content = content[:bam_idx] + new_chunk + content[bam_idx+700:]
        print('OK Bam alert_keys commented out')
    else:
        print('Bam alert_keys not found')
        # Check what's there
        for l in chunk.split('\n'):
            if 'alert' in l.lower():
                print(f'  found: {l}')
else:
    print('NOT FOUND Bam')

with open(path, 'w') as f:
    f.write(content)
print('done')
