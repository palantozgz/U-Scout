#!/usr/bin/env python3
"""
Fix 1: astTovRatio en all-detail — TOV% → AST/TOV ratio correcto
Fix 2: on-off LIKE → regex para evitar false positives
"""
import re

path = "/Users/palant/Downloads/U scout/ucore/server/routes.ts"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ── FIX 1: astTovRatio en all-detail ─────────────────────────────────────────
old1 = '          ROUND(CASE WHEN SUM(pgs.tov) + SUM(pgs.fga) + 0.44 * SUM(pgs.fta) > 0 THEN SUM(pgs.tov)::numeric / (SUM(pgs.tov) + SUM(pgs.fga) + 0.44 * SUM(pgs.fta)) END, 3) AS "astTovRatio",'
new1 = '          ROUND(CASE WHEN SUM(pgs.tov) > 0 THEN SUM(pgs.ast)::numeric / SUM(pgs.tov) END, 2) AS "astTovRatio",'

count1 = content.count(old1)
print(f"Fix 1 occurrences found: {count1}")
assert count1 == 1, f"Expected exactly 1, found {count1}"
content = content.replace(old1, new1, 1)

# ── FIX 2: on-off LIKE → regex ────────────────────────────────────────────────
# Old: WHEN lineup_id LIKE ${`%${playerExternalId}%`} THEN 'on'
# New: WHEN lineup_id ~ ${`(^|-)${playerExternalId}(-|$)`} THEN 'on'
old2 = "            WHEN lineup_id LIKE ${`%${playerExternalId}%`} THEN 'on'"
new2 = "            WHEN lineup_id ~ ${`(^|-)${playerExternalId}(-|$)`} THEN 'on'"

count2 = content.count(old2)
print(f"Fix 2 occurrences found: {count2}")
assert count2 == 1, f"Expected exactly 1, found {count2}"
content = content.replace(old2, new2, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Ambos fixes aplicados.")

# Verify
with open(path, 'r', encoding='utf-8') as f:
    verify = f.read()

print("Verification fix1:", "SUM(pgs.ast)::numeric / SUM(pgs.tov)" in verify)
print("Verification fix2:", "(^|-)${playerExternalId}(-|$)" in verify)
