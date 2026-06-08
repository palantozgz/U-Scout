#!/usr/bin/env python3
import urllib.request, json, os
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = open("/tmp/sk.txt").read().strip()
def q(table, params, limit=500):
    url = f"{SUPA_URL}/rest/v1/{table}?{params}&limit={limit}"
    req = urllib.request.Request(url, headers={"apikey":SK,"Authorization":f"Bearer {SK}","Prefer":"count=none"})
    with urllib.request.urlopen(req, timeout=20) as r: return json.loads(r.read())

# Verificar PPG para Inner Mongolia (o primer equipo con muchos datos)
# Obtener team_id para equipo con más posesiones en regular season
# Sample: get first batch of regular possessions and find team with most
sample = q("pbp_possessions","season_id=eq.2092&phase_type=eq.regular&select=team_id,points",9000)
from collections import defaultdict
team_cnt = defaultdict(int); team_pts = defaultdict(int)
for p in sample:
    team_cnt[p['team_id']] += 1
    team_pts[p['team_id']] += p.get('points') or 0

# Top team by possession count in sample
top_tid = max(team_cnt, key=lambda k: team_cnt[k])
print(f"Top team in sample: id={top_tid}, poss_in_sample={team_cnt[top_tid]}, pts_in_sample={team_pts[top_tid]}")

# Get their full poss (up to 9000)
full = q("pbp_possessions", f"team_id=eq.{top_tid}&season_id=eq.2092&phase_type=eq.regular&select=game_id,points", 9000)
full_pts = sum(p.get('points') or 0 for p in full)
full_gids = set(p['game_id'] for p in full)
print(f"  Full poss (up to 9000): {len(full)} rows, {len(full_gids)} games, {full_pts} pts → ppg={round(full_pts/len(full_gids),1)}")

# Get real scores
tname = q("stats_teams", f"id=eq.{top_tid}&select=name_zh,external_id",1)
print(f"  Team name: {tname[0]['name_zh'] if tname else 'unknown'}")
real_gs = q("stats_games", f"season_id=eq.2092&status=eq.4&phase_id=not.in.(27743,27747,27753,27757)&or=(home_team_id.eq.{top_tid},away_team_id.eq.{top_tid})&select=id,home_team_id,home_score,away_score",200)
real_pts_total = sum((g['home_score'] if g['home_team_id']==top_tid else g['away_score']) or 0 for g in real_gs)
print(f"  Real: {len(real_gs)} games, {real_pts_total} pts → ppg={round(real_pts_total/len(real_gs),1)}")

# PM check - larger sample
print("\n--- PM check ---")
box = q("stats_player_boxscores","game_id=lt.30&select=game_id,player_external_id,plus_minus&plus_minus=not.is.null",300)
ok=mis=0; examples=[]
for b in box:
    r = q("pbp_player_game_stats",f"game_id=eq.{b['game_id']}&player_external_id=eq.{b['player_external_id']}&select=plus_minus",1)
    if r:
        if r[0]['plus_minus']==b['plus_minus']: ok+=1
        else:
            mis+=1
            if len(examples)<3: examples.append(f"g={b['game_id']} p={b['player_external_id']}: box={b['plus_minus']} pgs={r[0]['plus_minus']}")
print(f"OK={ok}, Mismatch={mis} / {ok+mis} checked ({round(100*mis/(ok+mis),1) if ok+mis else 0}%)")
for e in examples: print(f"  {e}")

# Check pbp_player_game_stats season_id
print("\n--- season check ---")
s = q("pbp_player_game_stats","select=season_id&limit=1",1)
print(f"pgs has season_id: {'season_id' in s[0] if s else False}")
