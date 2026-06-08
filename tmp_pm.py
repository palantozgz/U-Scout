#!/usr/bin/env python3
"""Mide mismatch de plus_minus pgs vs boxscore en todos los partidos disponibles."""
import urllib.request, json, os

SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = open("/tmp/sk.txt").read().strip()

def q(table, params, limit=5000):
    url = f"{SUPA_URL}/rest/v1/{table}?{params}&limit={limit}"
    req = urllib.request.Request(url, headers={"apikey":SK,"Authorization":f"Bearer {SK}","Prefer":"count=none"})
    with urllib.request.urlopen(req, timeout=25) as r: return json.loads(r.read())

# Get a batch of boxscore rows and compare with pgs
# Use a single game to get full picture
print("Fetching all box rows for game_id <= 50...")
box = q("stats_player_boxscores",
    "game_id=lt.50&select=game_id,player_external_id,plus_minus",
    limit=2000)
print(f"Box rows: {len(box)}")

pgs = q("pbp_player_game_stats",
    "game_id=lt.50&season_id=eq.2092&select=game_id,player_external_id,plus_minus",
    limit=2000)
print(f"PGS rows: {len(pgs)}")

# Index pgs by (game_id, player)
pgs_idx = {}
for r in pgs:
    key = (r['game_id'], str(r['player_external_id']))
    pgs_idx[key] = r['plus_minus']

ok = mis = no_match = 0
examples = []
for b in box:
    key = (b['game_id'], str(b['player_external_id']))
    if key not in pgs_idx:
        no_match += 1
        continue
    pgs_pm = pgs_idx[key]
    box_pm = b['plus_minus']
    if pgs_pm == box_pm:
        ok += 1
    else:
        mis += 1
        if len(examples) < 8:
            examples.append(f"  g={b['game_id']} p={b['player_external_id']}: box={box_pm} pgs={pgs_pm} diff={pgs_pm-box_pm if pgs_pm and box_pm else '?'}")

total = ok + mis
print(f"\nResults: OK={ok}, Mismatch={mis}, NoMatch={no_match} / {total} compared")
if total: print(f"Mismatch rate: {round(100*mis/total,1)}%")
print("Examples:")
for e in examples: print(e)
