#!/usr/bin/env python3
"""
U Scout — Motor keys patch
Changes motor outputs from translated strings to keys+params.
DB stores keys, Profile translates at render time.

Serialization format for dynamic keys:
  "for_direction|weak=left|wl=floater"

Run from project root: python3 patch_motor_keys.py
"""
import sys, re

filepath = "client/src/lib/mock-data.ts"
try:
    with open(filepath) as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: {filepath} not found")
    sys.exit(1)

# ── 1. Replace tm("key") → "key" (just store the key) ────────────────────────
content = re.sub(r'\btm\("([^"]+)"\)', r'"\1"', content)
print("✅ Static tm() → keys")

# ── 2. Replace tmp("key", { params }) → serialized key string ────────────────
# Format: "key|param1=value1|param2=value2"

replacements = [
    # def_deny_block
    (r'tmp\("def_deny_block",\s*\{\s*side\s*\}\)',
     '`def_deny_block|side=${side}`'),
    # def_shade_side
    (r'tmp\("def_shade_side",\s*\{\s*side:\s*internal\.dominantSide\.toLowerCase\(\)\s*\}\)',
     '`def_shade_side|side=${internal.dominantSide.toLowerCase()}`'),
    # for_direction
    (r'tmp\("for_direction",\s*\{\s*weak,\s*wl\s*\}\)',
     '`for_direction|weak=${weak}|wl=${wl}`'),
    # for_closeout_wing
    (r'tmp\("for_closeout_wing",\s*\{\s*better,\s*worse\s*\}\)',
     '`for_closeout_wing|better=${better}|worse=${worse}`'),
    # for_post_block
    (r'tmp\("for_post_block",\s*\{\s*block:\s*weakBlock\s*\}\)',
     '`for_post_block|block=${weakBlock}`'),
    # for_post_middle
    (r'tmp\("for_post_middle",\s*\{\s*block:\s*weakBlock\s*\}\)',
     '`for_post_middle|block=${weakBlock}`'),
    # for_pnr_funnel
    (r'tmp\("for_pnr_funnel",\s*\{\s*wl\s*\}\)',
     '`for_pnr_funnel|wl=${wl}`'),
    # con_iso_weak
    (r'tmp\("con_iso_weak",\s*\{\s*weak\s*\}\)',
     '`con_iso_weak|weak=${weak}`'),
]

count = 0
for pattern, replacement in replacements:
    new_content, n = re.subn(pattern, replacement, content)
    if n > 0:
        content = new_content
        count += 1
        print(f"✅ {pattern[:40]}... → {replacement}")
    else:
        print(f"⚠️  Not found: {pattern[:60]}")

# ── 3. Remove tm/tmp helper functions (no longer needed in motor) ─────────────
# Keep import of apiRequest, remove tm/tmp
content = re.sub(
    r'// Motor translation helpers.*?const tmp[^;]+;\n',
    '',
    content,
    flags=re.DOTALL
)
# Also remove the import of tm_raw
content = re.sub(
    r"import \{ t as tm_raw \} from ['\"]\.\/i18n['\"];\n",
    '',
    content
)
print("✅ Removed tm/tmp helpers from motor")

with open(filepath, 'w') as f:
    f.write(content)

print(f"\nDone. {count}/8 dynamic replacements applied.")
print("Motor now stores keys, not translated strings.")
print("Profile must translate at render time — see patch_profile_translate.py")
