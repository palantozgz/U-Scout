#!/usr/bin/env python3
"""Audit parte 3 — queries rápidas sin pagination masiva."""
import urllib.request, json, os
from collections import defaultdict

SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = open("/tmp/sk.txt").read().strip()

def rest(table, params="", limit=1000):
    url = f"{SUPA_URL}/rest/v1/{table}?{params}&limit={limit}"
    req = urllib.request.Request(url, headers={
        "apikey": SK, "Authorization": f"Bearer {SK}", "Prefer": "count=none"
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

print("=== AUDIT 3 ===\n")

# ── 1. PPG sample — comparar 5 equipos con sus scores reales (toda la temporada)
# Estrategia: tomar un equipo específico y sumar todos sus puntos de posesiones
print("[1] PPG poss vs real — team interno específico (top 2 por poss count):")
# Get all teams
teams = rest("stats_teams", params="select=id,name_zh", limit=20)

for t in teams[:3]:
    tid = t['id']
    # Get total pts from possessions in batches
    total_pts = 0
    total_poss = 0
    game_ids = set()
    offset = 0
    while True:
        chunk = rest("pbp_possessions",
            params=f"team_id=eq.{tid}&season_id=eq.2092&phase_type=eq.regular&select=game_id,points",
            limit=9000)
        if offset == 0:
            # only first chunk to avoid timeout
            for p in chunk:
                total_pts += (p.get('points') or 0)
                total_poss += 1
                game_ids.add(p['game_id'])
        break
    
    # Real score from stats_games
    real_games = rest("stats_games",
        params=f"season_id=eq.2092&status=eq.4&phase_id=not.in.(27743,27747,27753,27757)&or=(home_team_id.eq.{tid},away_team_id.eq.{tid})&select=id,home_team_id,home_score,away_score",
        limit=200)
    real_pts = sum((g['home_score'] if g['home_team_id']==tid else g['away_score']) or 0 for g in real_games)
    real_g = len(real_games)
    
    # Note: poss chunk may be truncated at 9000 rows
    poss_g = len(game_ids)
    poss_ppg = round(total_pts/poss_g,1) if poss_g else 0
    real_ppg = round(real_pts/real_g,1) if real_g else 0
    print(f"  {t['name_zh'][:8]}: poss_chunk={total_poss}rows/{poss_g}g → ppg={poss_ppg} | real={real_g}g → ppg={real_ppg}")

# ── 2. Plus_minus — sample targeted
print("\n[2] PM pgs vs boxscores — muestra 20:")
box = rest("stats_player_boxscores",
    params="game_id=lt.50&select=game_id,player_external_id,plus_minus&plus_minus=not.is.null",
    limit=100)
ok_count = mis_count = 0
examples = []
for b in box[:50]:
    pgs = rest("pbp_player_game_stats",
        params=f"game_id=eq.{b['game_id']}&player_external_id=eq.{b['player_external_id']}&select=plus_minus",
        limit=1)
    if pgs:
        pm_box = b['plus_minus']
        pm_pgs = pgs[0]['plus_minus']
        if pm_box == pm_pgs:
            ok_count += 1
        else:
            mis_count += 1
            if len(examples) < 5:
                examples.append(f"  g={b['game_id']} p={b['player_external_id']}: box={pm_box} pgs={pm_pgs}")

print(f"  OK={ok_count}, Mismatch={mis_count} (de {ok_count+mis_count} checked)")
if examples:
    print("  Ejemplos mismatch:")
    for e in examples: print(e)

# ── 3. ppg real via agg — tomar un equipo concreto con todos sus datos
print("\n[3] Verificación ppg — equipo con más juegos (todos sus datos):")
# Get one team's full poss data — Mongolia Interior is team id, let's find it
mongol = rest("stats_teams", params="name_zh=like.*蒙古*&select=id,name_zh", limit=3)
if not mongol:
    mongol = rest("stats_teams", params="select=id,name_zh&limit=1", limit=1)
if mongol:
    t = mongol[0]
    tid = t['id']
    all_poss = []
    for batch_offset in [0, 9000]:
        url = f"{SUPA_URL}/rest/v1/pbp_possessions?team_id=eq.{tid}&season_id=eq.2092&phase_type=eq.regular&select=game_id,points&limit=9000&offset={batch_offset}"
        req = urllib.request.Request(url, headers={"apikey": SK, "Authorization": f"Bearer {SK}", "Prefer": "count=none"})
        with urllib.request.urlopen(req, timeout=30) as r:
            chunk = json.loads(r.read())
        all_poss.extend(chunk)
        if len(chunk) < 9000: break
    
    poss_pts = sum((p.get('points') or 0) for p in all_poss)
    poss_gids = set(p['game_id'] for p in all_poss)
    poss_g = len(poss_gids)
    ppg_poss = round(poss_pts/poss_g, 1) if poss_g else 0
    
    real_g2 = rest("stats_games",
        params=f"season_id=eq.2092&status=eq.4&phase_id=not.in.(27743,27747,27753,27757)&or=(home_team_id.eq.{tid},away_team_id.eq.{tid})&select=id,home_team_id,home_score,away_score",
        limit=200)
    real_pts2 = sum((g['home_score'] if g['home_team_id']==tid else g['away_score']) or 0 for g in real_g2)
    real_g_cnt = len(real_g2)
    ppg_real = round(real_pts2/real_g_cnt, 1) if real_g_cnt else 0
    
    match = "✅" if abs(ppg_poss - ppg_real) < 0.5 else "❌"
    print(f"  {t['name_zh']}: poss={len(all_poss)}rows/{poss_g}g/{poss_pts}pts → ppg_poss={ppg_poss}")
    print(f"  real={real_g_cnt}g/{real_pts2}pts → ppg_real={ppg_real} {match}")

# ── 4. season_id en pbp_player_game_stats
print("\n[4] pbp_player_game_stats season_id check:")
pgs_s = rest("pbp_player_game_stats", params="select=season_id&limit=3", limit=3)
print(f"  Sample season_ids: {[r.get('season_id') for r in pgs_s]}")
other = rest("pbp_player_game_stats", params="season_id=neq.2092&select=season_id&limit=3", limit=3)
if other:
    print(f"  ⚠️ Otros season_ids encontrados: {[r['season_id'] for r in other]}")
else:
    print(f"  ✅ Solo season_id=2092")

print("\n=== FIN ===")
