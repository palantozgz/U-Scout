#!/usr/bin/env python3
"""
Audit U Stats via PostgREST API
"""
import urllib.request, urllib.parse, json, sys
from collections import defaultdict

SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
H = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}

def get(path, extra_headers=None):
    hdr = {**H, **(extra_headers or {})}
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=hdr)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def rpc(func, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/rpc/{func}", 
        data=data, headers=H, method='POST'
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

print("=" * 70)
print("U STATS AUDIT — 2026-06-08")
print("=" * 70)

# ─── 1. PPG from possessions vs game scores ───────────────────────────────
print("\n[1] PPG standings (pbp_possessions) vs game scores")
# Get games regular season 2092
games = get("stats_games?select=id,home_team_id,away_team_id,home_score,away_score&status=eq.4&season_id=eq.2092")
game_map = {g['id']: g for g in games}

# Get team list
teams = get("stats_teams?select=id,external_id,name_zh")
team_by_id = {t['id']: t for t in teams}
team_by_ext = {t['external_id']: t for t in teams}

# Get possessions aggregated by team
# PostgREST: select sum(points), count, game_id, team_id, phase_type
# We need to aggregate - get all regular possessions
print("  Cargando pbp_possessions (regular, season 2092)...")
# Paginate
all_poss = []
offset = 0
page = 1000
while True:
    chunk = get(f"pbp_possessions?select=team_id,game_id,points,phase_type,season_id&season_id=eq.2092&phase_type=eq.regular&limit={page}&offset={offset}",
                {'Range': f'{offset}-{offset+page-1}'})
    if not chunk:
        break
    all_poss.extend(chunk)
    if len(chunk) < page:
        break
    offset += page

print(f"  Total posesiones cargadas: {len(all_poss)}")

# Aggregate by team
team_pts = defaultdict(int)
team_games = defaultdict(set)
for p in all_poss:
    tid = p['team_id']
    team_pts[tid] += p['points'] or 0
    team_games[tid].add(p['game_id'])

# Compute ppg from possessions
poss_ppg = {}
for tid, pts in team_pts.items():
    ng = len(team_games[tid])
    if ng > 0:
        poss_ppg[tid] = round(pts / ng, 1)

# Compute ppg from game scores
game_ppg = defaultdict(list)
for g in games:
    home_id = g['home_team_id']
    away_id = g['away_team_id']
    home_score = g['home_score'] or 0
    away_score = g['away_score'] or 0
    # Only count if team has possessions (regular)
    if home_id in team_pts:
        game_ppg[home_id].append(home_score)
    if away_id in team_pts:
        game_ppg[away_id].append(away_score)

score_ppg = {}
for tid, scores in game_ppg.items():
    if scores:
        score_ppg[tid] = round(sum(scores) / len(scores), 1)

print(f"\n  {'EQUIPO':<25} {'PPG_POSS':>9} {'PPG_SCORE':>10} {'DIFF':>6}")
print("  " + "-" * 55)
diffs = []
for tid in sorted(poss_ppg.keys()):
    team = team_by_id.get(tid, {})
    name = team.get('name_zh', str(tid))[:24]
    pp = poss_ppg[tid]
    sp = score_ppg.get(tid)
    if sp is not None:
        diff = round(abs(pp - sp), 1)
        diffs.append((diff, name, pp, sp))

diffs.sort(reverse=True)
for diff, name, pp, sp in diffs:
    flag = " ⚠️" if diff > 1.0 else ""
    print(f"  {name:<25} {pp:>9.1f} {sp:>10.1f} {diff:>6.1f}{flag}")

# ─── 2. eFGPct formula check ──────────────────────────────────────────────
print("\n[2] eFGPct formula — fgm incluye o no fg3m?")
# Get player game stats sample
sample = get("pbp_player_game_stats?select=pts,fgm,fga,fg3m,fg3a,ftm,fta,phase_type&phase_type=eq.regular&fg3m=gt.1&pts=gt.0&limit=500")
total = len(sample)
# Check formula: if fgm includes 3s: pts = 2*fgm + fg3m + ftm
match_total = sum(1 for r in sample if r['pts'] == 2 * r['fgm'] + r['fg3m'] + r['ftm'])
# If fgm is 2P only: pts = 2*(fgm+fg3m) + ftm
match_2p = sum(1 for r in sample if r['pts'] == 2 * (r['fgm'] + r['fg3m']) + r['ftm'])
print(f"  Filas con fg3m>1: {total}")
print(f"  pts == 2*fgm + fg3m + ftm  (fgm=TOTAL inc. 3s): {match_total}/{total} ({100*match_total//total}%)")
print(f"  pts == 2*(fgm+fg3m) + ftm  (fgm=2P only):       {match_2p}/{total} ({100*match_2p//total}%)")

# Current eFGPct formula: (fgm + 0.5*fg3m) / fga
# If fgm includes 3s (FIBA): correct formula
# If fgm is 2P only: should be (fgm + 1.5*fg3m) / (fga + fg3a) OR (2PM + fg3m + 0.5*fg3m)/(2PA+fg3a)
# Check which interpretation the formula was written for:
# Code uses: (SUM(fgm) + 0.5*SUM(fg3m)) / SUM(fga) * 100
# If fgm=total: eFGPct = (fgm + 0.5*fg3m) / fga = standard FIBA ✓
# If fgm=2P only: eFGPct would be (2PM + 0.5*3PM) / (2PA) = WRONG numerator is off

print(f"\n  Conclusión:")
if match_total > match_2p:
    print(f"  fgm = TOTAL (incluye triples) — eFGPct formula es CORRECTA")
else:
    print(f"  ⚠️ fgm = 2P only — eFGPct formula puede ser INCORRECTA")
    # Show correct vs current for a few examples
    print(f"\n  Muestra con error:")
    errors = [(r['pts'], r['fgm'], r['fga'], r['fg3m'], r['fg3a'], r['ftm']) 
              for r in sample if r['pts'] != 2*r['fgm'] + r['fg3m'] + r['ftm']][:5]
    for e in errors:
        pts, fgm, fga, fg3m, fg3a, ftm = e
        print(f"  pts={pts} fgm={fgm} fga={fga} fg3m={fg3m} fg3a={fg3a} ftm={ftm}")
        print(f"    -> pts_calc_total = {2*fgm + fg3m + ftm}")
        print(f"    -> pts_calc_2p    = {2*(fgm+fg3m) + ftm}")

# ─── 3. mpg razonabilidad ────────────────────────────────────────────────
print("\n[3] mpg — rango de minutos jugados")
mpg_data = get("pbp_player_game_stats?select=seconds_played,phase_type&phase_type=eq.regular&limit=200")
max_sec = max(r['seconds_played'] for r in mpg_data if r['seconds_played'])
min_sec = min(r['seconds_played'] for r in mpg_data if r['seconds_played'] and r['seconds_played'] > 0)
avg_sec = sum(r['seconds_played'] for r in mpg_data if r['seconds_played']) / len([r for r in mpg_data if r['seconds_played']])
print(f"  Max: {max_sec}s = {max_sec/60:.1f} min (razonable si ≤ ~40 min)")
print(f"  Min (>0): {min_sec}s = {min_sec/60:.1f} min")
print(f"  Avg: {avg_sec:.0f}s = {avg_sec/60:.1f} min")
if max_sec > 2800:  # > 46 min
    print(f"  ⚠️ max_sec={max_sec} parece demasiado alto — ¿en segundos o en otro formato?")
elif max_sec > 200:
    print(f"  OK — formato en segundos correcto")
else:
    print(f"  ⚠️ max_sec={max_sec} parece muy bajo — ¿está en minutos, no segundos?")

# ─── 4. plus_minus check ────────────────────────────────────────────────
print("\n[4] plus_minus — rango razonable")
pm_data = get("pbp_player_game_stats?select=plus_minus,phase_type&phase_type=eq.regular&limit=500")
pm_vals = [r['plus_minus'] for r in pm_data if r['plus_minus'] is not None]
if pm_vals:
    print(f"  Min: {min(pm_vals)}, Max: {max(pm_vals)}, Nulls: {sum(1 for r in pm_data if r['plus_minus'] is None)}")
    if min(pm_vals) == 0 and max(pm_vals) == 0:
        print(f"  ⚠️ TODOS plus_minus = 0 — campo no está siendo llenado")
    elif abs(max(pm_vals)) > 60:
        print(f"  ⚠️ plus_minus máximo demasiado alto ({max(pm_vals)})")
    else:
        print(f"  OK — rango razonable")
else:
    print(f"  ⚠️ No hay datos de plus_minus")

# ─── 5. wins/losses standings vs real ────────────────────────────────────
print("\n[5] wins/losses standings vs juegos reales")
standings = get("stats_standings?select=team_external_id,wins,losses,season_id&season_id=eq.2092")
std_map = {s['team_external_id']: s for s in standings}

# Count W/L from game scores
team_wl = defaultdict(lambda: {'w': 0, 'l': 0})
for g in games:
    hs, as_ = (g['home_score'] or 0), (g['away_score'] or 0)
    if hs > as_:
        team_wl[g['home_team_id']]['w'] += 1
        team_wl[g['away_team_id']]['l'] += 1
    elif as_ > hs:
        team_wl[g['away_team_id']]['w'] += 1
        team_wl[g['home_team_id']]['l'] += 1

diff_found = False
for tid, wl in team_wl.items():
    team = team_by_id.get(tid, {})
    ext_id = team.get('external_id')
    if ext_id and ext_id in std_map:
        sw = std_map[ext_id]['wins']
        sl = std_map[ext_id]['losses']
        rw, rl = wl['w'], wl['l']
        if abs(rw - sw) > 0 or abs(rl - sl) > 0:
            name = team.get('name_zh', str(tid))
            print(f"  ⚠️ {name}: real W={rw} L={rl} vs standings W={sw} L={sl}")
            diff_found = True

if not diff_found:
    print("  OK — todos coinciden con stats_standings")

# ─── 6. avgOrbPerGame — per-player vs per-team aggregation ───────────────
print("\n[6] avgOrbPerGame — ¿per-player row o per-team-game?")
orb_data = get("pbp_player_game_stats?select=team_id,game_id,off_reb,phase_type&phase_type=eq.regular&limit=2000")
# Method A: AVG over all player rows (current endpoint)
orb_player_vals = [r['off_reb'] for r in orb_data if r['off_reb'] is not None]
avg_orb_player = sum(orb_player_vals) / len(orb_player_vals) if orb_player_vals else 0

# Method B: AVG of team totals per game
team_game_orb = defaultdict(int)
for r in orb_data:
    key = (r['team_id'], r['game_id'])
    team_game_orb[key] += r['off_reb'] or 0
avg_orb_team = sum(team_game_orb.values()) / len(team_game_orb) if team_game_orb else 0

print(f"  Método A (endpoint actual — AVG sobre player rows): {avg_orb_player:.2f}")
print(f"  Método B (AVG de totales por equipo-partido):       {avg_orb_team:.2f}")
if abs(avg_orb_player - avg_orb_team) > 0.5:
    print(f"  ⚠️ DIFERENCIA SIGNIFICATIVA — endpoint muestra valor de jugadora, no de equipo")
    print(f"  El label 'avgOrbPerGame' en UI es engañoso si muestra {avg_orb_player:.1f} en lugar de {avg_orb_team:.1f}")

# ─── 7. Verify standings ppg source ─────────────────────────────────────
print("\n[7] Standings: ¿ppg/oppg son de pbp_possessions o stats_standings table?")
# Check stats_standings fields
std_sample = get("stats_standings?select=*&season_id=eq.2092&limit=1")
if std_sample:
    keys = list(std_sample[0].keys())
    print(f"  Campos en stats_standings: {keys}")
    has_pts = 'pts_per_game' in keys or 'ppg' in keys
    print(f"  ¿Tiene ppg propio? {has_pts}")

# ─── 8. seconds_played coherence ─────────────────────────────────────────
print("\n[8] Verificar si el campo seconds_played es coherente con un partido FIBA")
# Max theoretical: 4 cuartos * 10 min = 40 min = 2400s. Con OT: 2700s
sec_data = get("pbp_player_game_stats?select=seconds_played,player_external_id,game_id&phase_type=eq.regular&seconds_played=gt.2400&limit=5")
if sec_data:
    print(f"  ⚠️ {len(sec_data)} filas con >2400s (>40min) — OT o error?")
    for r in sec_data[:3]:
        print(f"    player={r['player_external_id']} game={r['game_id']} sec={r['seconds_played']} = {r['seconds_played']/60:.1f} min")
else:
    print(f"  OK — ninguna fila supera 2400s (40 min)")

# Check if any player has exactly 0 seconds (should be filtered)
zero_sec = get("pbp_player_game_stats?select=player_external_id,game_id,pts&seconds_played=eq.0&phase_type=eq.regular&limit=5")
print(f"  Filas con 0 segundos: {len(zero_sec)} (estas afectan AVG mpg)")

# ─── 9. fg3m field: is it fg3m-only or total 3P attempts ─────────────────
print("\n[9] fga check — ¿fga incluye fg3a?")
fga_sample = get("pbp_player_game_stats?select=fgm,fga,fg3m,fg3a,pts,ftm,phase_type&phase_type=eq.regular&fg3a=gt.0&fgm=gt.0&limit=300")
# If fga includes 3PA: fga >= fg3a always
include_3 = sum(1 for r in fga_sample if r['fga'] >= r['fg3a'])
exclude_3 = sum(1 for r in fga_sample if r['fga'] < r['fg3a'])
print(f"  fga >= fg3a (fga incluye triples): {include_3}/{len(fga_sample)}")
print(f"  fga < fg3a  (fga NO incluye — bug): {exclude_3}/{len(fga_sample)}")

# ─── 10. pace-segments PPP correctness ───────────────────────────────────
print("\n[10] pace-segments PPP — ¿denominador correcto (posesiones totales)?")
# Get possessions breakdown by is_transition / is_early_offense
# Sample first team
our_team = [t for t in teams if 'Inner Mongolia' in (t.get('name_en','') or '') or '内蒙古' in (t.get('name_zh','') or '')]
if not our_team:
    # Get any team with most possessions
    our_team = sorted(teams, key=lambda t: len([p for p in all_poss if p['team_id'] == t['id']]), reverse=True)[:1]

if our_team:
    sample_tid = our_team[0]['id']
    segs = get(f"pbp_possessions?select=is_transition,is_early_offense,points,phase_type&team_id=eq.{sample_tid}&phase_type=eq.regular&limit=5000")
    
    by_seg = defaultdict(lambda: {'poss': 0, 'pts': 0})
    for p in segs:
        if p['is_transition']:
            seg = 'transition'
        elif p['is_early_offense']:
            seg = 'early'
        else:
            seg = 'halfcourt'
        by_seg[seg]['poss'] += 1
        by_seg[seg]['pts'] += p['points'] or 0
    
    print(f"  Equipo: {our_team[0].get('name_zh','?')} (id={sample_tid})")
    for seg, data in sorted(by_seg.items()):
        ppp = data['pts'] / data['poss'] if data['poss'] else 0
        print(f"  {seg}: {data['poss']} pos, {data['pts']} pts, PPP={ppp:.3f}")
    print(f"  NOTA: PPP usa COUNT(*) de pbp_possessions — incluye TOVs ✓")

# ─── 11. Win percentage formula ──────────────────────────────────────────
print("\n[11] win_pct en standings — ¿es wins/(wins+losses) o diferente?")
for s in standings[:5]:
    w = s['wins'] or 0
    l = s['losses'] or 0
    total = w + l
    expected_pct = round(w / total, 3) if total > 0 else 0
    actual_pct = round(s['win_pct'] or 0, 3) if s['win_pct'] else 0
    diff = abs(expected_pct - actual_pct)
    team_ext = s['team_external_id']
    team_name = team_by_ext.get(team_ext, {}).get('name_zh', str(team_ext))
    if diff > 0.01:
        print(f"  ⚠️ {team_name}: calc={expected_pct:.3f} actual={actual_pct:.3f} W={w} L={l}")
    else:
        print(f"  OK {team_name}: {actual_pct:.3f} W={w} L={l}")

print("\n" + "=" * 70)
print("AUDIT COMPLETO")
print("=" * 70)
