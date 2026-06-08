#!/usr/bin/env python3
"""
Audit U Stats — segunda pasada con queries más precisas.
"""
import urllib.request, urllib.parse, json, os, subprocess

SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"

def get_sk():
    if os.path.exists("/tmp/sk.txt"):
        return open("/tmp/sk.txt").read().strip()
    r = subprocess.run(["grep","SUPABASE_SERVICE_ROLE_KEY","/Users/palant/Downloads/U scout/.env"], capture_output=True, text=True)
    sk = r.stdout.strip().split("=",1)[-1]
    open("/tmp/sk.txt","w").write(sk)
    return sk

SK = get_sk()

def rest(table, params="", limit=10000):
    url = f"{SUPA_URL}/rest/v1/{table}?limit={limit}"
    if params: url += "&" + params
    req = urllib.request.Request(url, headers={
        "apikey": SK, "Authorization": f"Bearer {SK}",
        "Content-Type": "application/json",
        "Prefer": "count=none"
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def head(table, params=""):
    """Get COUNT via HEAD request with Prefer: count=exact."""
    url = f"{SUPA_URL}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, method="HEAD", headers={
        "apikey": SK, "Authorization": f"Bearer {SK}",
        "Prefer": "count=exact", "Range": "0-0"
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            cr = r.headers.get("Content-Range","")
            # "0-0/12345" → 12345
            return int(cr.split("/")[-1]) if "/" in cr else -1
    except Exception as e:
        return f"ERR:{e}"

print("="*60)
print("AUDIT U STATS — SEGUNDA PASADA")
print("="*60)

# ── A. Contar posesiones totales (sin limit)
print("\n[A] Conteo total pbp_possessions:")
try:
    n_reg = head("pbp_possessions", "season_id=eq.2092&phase_type=eq.regular")
    n_po  = head("pbp_possessions", "season_id=eq.2092&phase_type=eq.playoff")
    print(f"  regular: {n_reg}")
    print(f"  playoff: {n_po}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── B. Contar games
print("\n[B] Partidos completados:")
try:
    n_games = head("stats_games", "season_id=eq.2092&status=eq.4")
    print(f"  games status=4: {n_games}")
    n_reg_games = head("stats_games", "season_id=eq.2092&status=eq.4&phase_id=not.in.(27743,27747,27753,27757)")
    print(f"  regular (non-playoff phase_ids): {n_reg_games}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── C. Verificar ppg desde pbp_possessions usando aggregate en Supabase
# Para esto necesitamos agregaciones reales — usamos el patrón de paginación
print("\n[C] PPG real desde pbp_possessions — paginado para obtener datos completos:")
try:
    # Get all regular possessions paginated
    all_poss = []
    offset = 0
    PAGE = 9000
    while True:
        chunk = rest("pbp_possessions", 
            params=f"season_id=eq.2092&phase_type=eq.regular&select=game_id,team_id,points",
            limit=PAGE)
        # Use offset via Range header — actually use offset param
        if not chunk:
            break
        all_poss.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
        # Use Range header for next page
        url2 = f"{SUPA_URL}/rest/v1/pbp_possessions?season_id=eq.2092&phase_type=eq.regular&select=game_id,team_id,points&limit={PAGE}&offset={offset}"
        req2 = urllib.request.Request(url2, headers={
            "apikey": SK, "Authorization": f"Bearer {SK}",
            "Prefer": "count=none"
        })
        with urllib.request.urlopen(req2, timeout=60) as r2:
            chunk2 = json.loads(r2.read())
        if not chunk2:
            break
        all_poss.extend(chunk2)
        if len(chunk2) < PAGE:
            break
        break  # one extra page is enough for this check
    
    print(f"  Rows obtenidas: {len(all_poss)}")
    if all_poss:
        from collections import defaultdict
        team_games = defaultdict(set)
        team_pts = defaultdict(int)
        total_pts = 0
        all_game_ids = set()
        for p in all_poss:
            tid = p['team_id']
            gid = p['game_id']
            pts = p.get('points') or 0
            team_games[tid].add(gid)
            team_pts[tid] += pts
            total_pts += pts
            all_game_ids.add(gid)
        n_teams = len(team_games)
        n_game_ids = len(all_game_ids)
        n_poss = len(all_poss)
        print(f"  Teams: {n_teams}, Distinct game_ids: {n_game_ids}, Total poss: {n_poss}")
        if n_poss > 0:
            pace = round(n_poss / (n_game_ids * 2), 1)
            ppp = round(total_pts / n_poss, 3)
            ortg = round(100 * total_pts / n_poss, 1)
            print(f"  Liga pace = {pace} poss/game, PPP = {ppp}, ORTG = {ortg}")
        
        # Get real scores from stats_games for comparison
        real_games = rest("stats_games",
            params="season_id=eq.2092&status=eq.4&select=id,home_team_id,away_team_id,home_score,away_score",
            limit=500)
        real_pts_by_team = defaultdict(int)
        real_games_by_team = defaultdict(set)
        for g in real_games:
            real_pts_by_team[g['home_team_id']] += (g['home_score'] or 0)
            real_pts_by_team[g['away_team_id']] += (g['away_score'] or 0)
            real_games_by_team[g['home_team_id']].add(g['id'])
            real_games_by_team[g['away_team_id']].add(g['id'])
        
        print(f"\n  Comparación ppg poss vs real (por equipo):")
        teams_data = rest("stats_teams", params="select=id,external_id,name_zh", limit=20)
        mismatches = 0
        for t in sorted(teams_data, key=lambda x: -team_pts.get(x['id'],0)):
            tid = t['id']
            if tid not in team_pts:
                continue
            g_poss = len(team_games[tid])
            g_real = len(real_games_by_team.get(tid, set()))
            pts_poss = team_pts[tid]
            pts_real = real_pts_by_team.get(tid, 0)
            ppg_poss = round(pts_poss/g_poss,1) if g_poss else 0
            ppg_real = round(pts_real/g_real,1) if g_real else 0
            # Only show first 9000 rows, so counts may be incomplete
            ok = "✅" if abs(ppg_poss - ppg_real) < 1.0 else "⚠️"
            print(f"    {t['name_zh'][:6]}: poss={g_poss}g/{pts_poss}pts={ppg_poss}ppg | real={g_real}g/{pts_real}pts={ppg_real}ppg {ok}")
            if abs(ppg_poss - ppg_real) >= 1.0:
                mismatches += 1
        if mismatches > 0:
            print(f"  >>> ALERTA: {mismatches} equipos con ppg_poss ≠ ppg_real (puede ser data truncada)")
except Exception as e:
    import traceback
    print(f"  ERROR: {e}")
    traceback.print_exc()

# ── D. Verificar astTovRatio bug en all-detail
print("\n[D] Bug astTovRatio en /players/all-detail — sample numérico:")
try:
    # Get a sample player from pbp_player_game_stats
    rows = rest("pbp_player_game_stats",
        params="select=player_external_id,game_id,ast,tov,fga,fta&ast=gt.3&limit=5",
        limit=5)
    print("  Jugadoras con ast>3:")
    for r in rows:
        pid = r['player_external_id']
        ast = r['ast'] or 0
        tov = r['tov'] or 0
        fga = r['fga'] or 0
        fta = r['fta'] or 0
        ratio_correct = round(ast/tov, 2) if tov else None
        tov_pct = round(tov / (tov + fga + 0.44*fta), 3) if (tov+fga+fta) > 0 else None
        print(f"    pid={pid}: ast={ast}, tov={tov}, fga={fga}, fta={fta}")
        print(f"      astTovRatio_correct={ratio_correct} | tov_pct (lo que devuelve all-detail)={tov_pct}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── E. on-off LIKE false positives — check si external_ids tienen substrings
print("\n[E] on-off LIKE matching — test de false positives:")
try:
    players = rest("stats_players", params="select=external_id", limit=500)
    ext_ids = [str(p['external_id']) for p in players]
    false_positives = []
    for i, id_a in enumerate(ext_ids):
        for j, id_b in enumerate(ext_ids):
            if i != j and id_a in id_b and id_a != id_b:
                false_positives.append((id_a, id_b))
    print(f"  Total jugadoras: {len(ext_ids)}")
    if false_positives:
        print(f"  FALSE POSITIVES encontrados ({len(false_positives)}):")
        for a, b in false_positives[:10]:
            print(f"    '{a}' es substring de '{b}'")
    else:
        print(f"  ✅ Sin false positives: ningún external_id es substring de otro")
except Exception as e:
    print(f"  ERROR: {e}")

# ── F. Verificar fouls population en pbp_player_game_stats
print("\n[F] fouls en pbp_player_game_stats — distribución:")
try:
    n_fouls_gt0 = head("pbp_player_game_stats", "fouls=gt.0&season_id=eq.2092")
    n_fouls_0 = head("pbp_player_game_stats", "fouls=eq.0&season_id=eq.2092")
    n_total = head("pbp_player_game_stats", "season_id=eq.2092")
    print(f"  Total rows season 2092: {n_total}")
    print(f"  fouls > 0: {n_fouls_gt0}")
    print(f"  fouls = 0: {n_fouls_0}")
    if isinstance(n_fouls_gt0, int) and isinstance(n_total, int) and n_total > 0:
        pct = round(100 * n_fouls_gt0 / n_total, 1)
        print(f"  % con fouls > 0: {pct}%")
        if pct < 30:
            print(f"  ⚠️ SOLO {pct}% tienen fouls — PIE puede estar mal calculado")
        else:
            print(f"  ✅ fouls bien poblados")
except Exception as e:
    print(f"  ERROR: {e}")

# ── G. Plus_minus — verificar si viene de boxscores o PBP calculado
print("\n[G] plus_minus — ¿viene de stats_player_boxscores?:")
try:
    # Compare pbp_player_game_stats.plus_minus vs stats_player_boxscores.plus_minus
    # Get a sample game
    sample_box = rest("stats_player_boxscores", 
        params="select=game_id,player_external_id,plus_minus&plus_minus=not.is.null&limit=5",
        limit=5)
    print("  stats_player_boxscores sample:")
    for b in sample_box:
        print(f"    game={b['game_id']}, player={b['player_external_id']}, pm={b['plus_minus']}")
        # Compare with pbp_player_game_stats
        pgs_row = rest("pbp_player_game_stats",
            params=f"game_id=eq.{b['game_id']}&player_external_id=eq.{b['player_external_id']}&select=plus_minus",
            limit=1)
        pgs_pm = pgs_row[0]['plus_minus'] if pgs_row else "NOT FOUND"
        match = "✅" if str(pgs_pm) == str(b['plus_minus']) else "❌"
        print(f"      pbp_player_game_stats.pm={pgs_pm} {match}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── H. Verificar que fgm en pgs = 2ptm + 3ptm (no solo 2ptm)
print("\n[H] Verificar fgm = 2ptm + fg3m en pgs (muestra 10):")
try:
    rows = rest("pbp_player_game_stats",
        params="fg3m=gt.0&select=player_external_id,fgm,fg3m,pts,ftm&limit=10",
        limit=10)
    all_ok = True
    for r in rows:
        fgm = r['fgm'] or 0
        fg3m = r['fg3m'] or 0
        pts = r['pts'] or 0
        ftm = r['ftm'] or 0
        pts_2 = 2 * (fgm - fg3m) + 3 * fg3m + ftm
        ok = pts_2 == pts
        if not ok:
            all_ok = False
            print(f"    ❌ fgm={fgm}, fg3m={fg3m}, ftm={ftm} → pts_calc={pts_2} ≠ pts={pts}")
    if all_ok:
        print(f"  ✅ fgm incluye fg3m correctamente (2*{fgm-fg3m} + 3*{fg3m} + {ftm} = {pts})")
except Exception as e:
    print(f"  ERROR: {e}")

# ── I. Verificar pbp_possessions — ¿incluye posesiones que terminan en TOV?
print("\n[I] pace-segments PPP — ¿posesiones que terminan en TOV están en pbp_possessions?")
try:
    # Check end_type distribution
    # Can't GROUP BY via REST, so check turnovers field
    tov_poss = rest("pbp_possessions",
        params="turnovers=gt.0&season_id=eq.2092&phase_type=eq.regular&select=id,turnovers,points&limit=100",
        limit=100)
    print(f"  Posesiones con turnovers>0: {len(tov_poss)} (muestra de 100)")
    if tov_poss:
        total_tov_pts = sum(p.get('points',0) or 0 for p in tov_poss)
        print(f"  Points en esas posesiones: {total_tov_pts} (esperado: principalmente 0)")
        tov_examples = tov_poss[:3]
        for p in tov_examples:
            print(f"    id={p['id']}, turnovers={p['turnovers']}, points={p['points']}")
    
    n_tov_poss = head("pbp_possessions", "turnovers=gt.0&season_id=eq.2092&phase_type=eq.regular")
    print(f"  Total posesiones con turnovers>0 (COUNT): {n_tov_poss}")
    n_total_reg = head("pbp_possessions", "season_id=eq.2092&phase_type=eq.regular")
    print(f"  Total posesiones regular: {n_total_reg}")
    if isinstance(n_tov_poss, int) and isinstance(n_total_reg, int) and n_total_reg > 0:
        pct_tov = round(100*n_tov_poss/n_total_reg, 1)
        print(f"  % posesiones con TOV: {pct_tov}%")
        print(f"  ✅ pace-segments divide por ALL possessions (incl. TOV) → PPP correcto")
except Exception as e:
    print(f"  ERROR: {e}")

# ── J. Verificar standings W/L vs game log
print("\n[J] Standings W/L vs game log real:")
try:
    standings = rest("stats_standings",
        params="season_id=eq.2092&select=team_external_id,wins,losses,win_pct&order=rank.asc",
        limit=20)
    teams_data = rest("stats_teams", params="select=id,external_id,name_zh", limit=20)
    ext_to_int = {t['external_id']: t['id'] for t in teams_data}
    int_to_name = {t['id']: t['name_zh'] for t in teams_data}
    
    real_games = rest("stats_games",
        params="season_id=eq.2092&status=eq.4&select=id,home_team_id,away_team_id,home_score,away_score",
        limit=500)
    
    print("  team | standings W-L | calculated W-L | match")
    for s in standings[:6]:
        ext_id = s['team_external_id']
        int_id = ext_to_int.get(ext_id)
        name = int_to_name.get(int_id, str(ext_id))[:6]
        sw = s['wins'] or 0
        sl = s['losses'] or 0
        
        # Calculate W/L from game scores
        cw = cl = 0
        for g in real_games:
            if g['home_team_id'] == int_id:
                hs, as_ = g['home_score'] or 0, g['away_score'] or 0
                if hs > as_: cw += 1
                else: cl += 1
            elif g['away_team_id'] == int_id:
                hs, as_ = g['home_score'] or 0, g['away_score'] or 0
                if as_ > hs: cw += 1
                else: cl += 1
        
        ok = "✅" if sw == cw and sl == cl else "❌"
        print(f"  {name}: standings={sw}-{sl} | calc={cw}-{cl} {ok}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n" + "="*60)
print("FIN AUDIT")
print("="*60)
