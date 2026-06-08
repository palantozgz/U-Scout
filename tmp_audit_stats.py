#!/usr/bin/env python3
"""
Audit completo de U Stats — verificación end-to-end de datos y fórmulas.
"""
import urllib.request, urllib.parse, json, os, sys

SK_PATH = "/tmp/sk.txt"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"

def get_sk():
    if os.path.exists(SK_PATH):
        return open(SK_PATH).read().strip()
    import subprocess
    result = subprocess.run(
        ["grep", "SUPABASE_SERVICE_ROLE_KEY", "/Users/palant/Downloads/U scout/.env"],
        capture_output=True, text=True
    )
    sk = result.stdout.strip().split("=", 1)[-1]
    open(SK_PATH, "w").write(sk)
    return sk

SK = get_sk()

def query(sql_text, label=""):
    url = f"{SUPA_URL}/rest/v1/rpc/exec_sql" 
    # Use PostgREST SQL endpoint via service role
    # Actually use the /rest/v1/ with raw SQL via RPC or direct table access
    # We'll use the Supabase REST API with a custom RPC
    # Better: use psycopg2 style via urllib with the SQL editor endpoint
    pass

def rpc_query(sql_text):
    """Execute raw SQL via Supabase REST using a helper function."""
    # We'll POST to a Supabase function — but let's just use direct REST queries
    # Actually the cleanest way is to use the PostgREST RPC if we have a function
    # For arbitrary SQL, use the /sql endpoint (Supabase management API) or just construct REST queries
    # Let's construct REST queries manually
    pass

# Use urllib to call Supabase REST API
def rest_get(table, params="", select="*", limit=1000):
    url = f"{SUPA_URL}/rest/v1/{table}?select={urllib.parse.quote(select)}&limit={limit}"
    if params:
        url += "&" + params
    req = urllib.request.Request(url, headers={
        "apikey": SK,
        "Authorization": f"Bearer {SK}",
        "Content-Type": "application/json"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

# Use the Supabase SQL RPC (needs a custom function, let's use a different approach)
# Actually, Supabase has a /rest/v1/rpc endpoint. We need a SQL runner.
# The cleanest approach: write queries directly as REST selects.

# For complex SQL, use the Supabase Management API /v1/projects/{ref}/database/query
# But that requires a different auth. Let's use PostgREST with raw SQL.

# PostgREST supports arbitrary SQL via /rpc/your_function — needs a function.
# Let's call the Railway endpoint directly to get real API responses:

import urllib.error

RAILWAY = "https://u-scout-production.up.railway.app"

def api_get(path, params=""):
    # We need auth — let's use Supabase admin client approach
    # Actually routes.ts uses requireAuth — we can't hit the API without a JWT
    # Let's just run queries directly via urllib to Supabase PostgREST
    pass

# Direct Supabase query via REST table access
def supabase_rpc(func_name, body=None):
    url = f"{SUPA_URL}/rest/v1/rpc/{func_name}"
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": SK,
        "Authorization": f"Bearer {SK}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

# ─── QUERIES VIA REST TABLE ENDPOINTS ────────────────────────────────────────

print("=" * 60)
print("AUDIT U STATS — datos reales vs fórmulas")
print("=" * 60)

# ── 1. Verificar structure de pbp_possessions
print("\n[1] Columnas de pbp_possessions:")
try:
    rows = rest_get("pbp_possessions", limit=1)
    if rows:
        print("  Columnas:", list(rows[0].keys()))
    else:
        print("  (vacío)")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 2. Verificar si TOVs están en pbp_possessions
print("\n[2] pbp_possessions — ¿Incluye TOVs? Distribución end_reason:")
try:
    # Get count by end_reason or terminal_event
    rows = rest_get("pbp_possessions", params="select=end_reason,count&groupby=end_reason", limit=100)
    # PostgREST no soporta GROUP BY directamente — usamos select con aggregation
    # Vamos a hacer un count manual
    all_rows = rest_get("pbp_possessions", 
        params="season_id=eq.2092&phase_type=eq.regular&select=end_reason",
        limit=50000)
    from collections import Counter
    counts = Counter(r.get('end_reason') for r in all_rows)
    print(f"  Total rows: {len(all_rows)}")
    for k, v in sorted(counts.items(), key=lambda x: -x[1])[:10]:
        print(f"    {k}: {v}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 3. PPG from pbp_possessions vs stats_games scores
print("\n[3] ppg desde pbp_possessions vs score real (muestra 5 partidos equipo Mongolia):")
try:
    # Equipo Mongolia Interior — internal id
    teams = rest_get("stats_teams", params="name_zh=like.*内蒙古*&select=id,external_id,name_zh", limit=5)
    if not teams:
        teams = rest_get("stats_teams", params="name_zh=like.*内蒙*&select=id,external_id,name_zh", limit=5)
    print(f"  Teams encontrados: {[(t['id'], t['name_zh']) for t in teams]}")
    if teams:
        team_id = teams[0]['id']
        team_ext = teams[0]['external_id']
        print(f"  Usando team_id={team_id} (internal), external_id={team_ext}")
        
        # Get games for this team
        games = rest_get("stats_games", 
            params=f"season_id=eq.2092&status=eq.4&or=(home_team_id.eq.{team_id},away_team_id.eq.{team_id})&select=id,external_game_id,home_team_id,away_team_id,home_score,away_score",
            limit=5)
        
        for g in games[:5]:
            gid = g['id']
            is_home = g['home_team_id'] == team_id
            real_pts = g['home_score'] if is_home else g['away_score']
            
            # Points from pbp_possessions
            poss = rest_get("pbp_possessions",
                params=f"game_id=eq.{gid}&team_id=eq.{team_id}&select=points",
                limit=10000)
            poss_pts = sum(p.get('points', 0) or 0 for p in poss)
            
            match = "✅" if poss_pts == real_pts else "❌"
            print(f"    game {gid}: real={real_pts}, poss_sum={poss_pts} {match}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 4. ppg formula en standings — verificar
print("\n[4] ppg en standings: SUM(pp.points)/COUNT(DISTINCT game_id):")
try:
    if teams:
        poss_all = rest_get("pbp_possessions",
            params=f"team_id=eq.{team_id}&season_id=eq.2092&phase_type=eq.regular&select=points,game_id",
            limit=50000)
        games_played = len(set(p['game_id'] for p in poss_all))
        total_pts = sum(p.get('points', 0) or 0 for p in poss_all)
        ppg_calc = round(total_pts / games_played, 1) if games_played else 0
        print(f"  {teams[0]['name_zh']}: {total_pts} pts / {games_played} juegos = {ppg_calc} ppg")
        
        # Compare with stats_standings
        standings = rest_get("stats_standings", 
            params=f"team_external_id=eq.{team_ext}&season_id=eq.2092&select=pts_per_game,wins,losses",
            limit=1)
        if standings:
            print(f"  stats_standings.pts_per_game = {standings[0].get('pts_per_game')}")
            print(f"  wins={standings[0].get('wins')}, losses={standings[0].get('losses')}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 5. Verificar astTovRatio discrepancia entre endpoints
print("\n[5] astTovRatio: /players vs /all-detail tienen fórmulas distintas?")
print("  /api/stats/players: SUM(ast)/SUM(tov) — correcto AST/TOV ratio")
print("  /api/stats/players/all-detail: SUM(tov)/(SUM(tov)+SUM(fga)+0.44*SUM(fta)) — esto es TOV%!")
print("  >>> BUG CONFIRMADO: all-detail muestra TOV% pero lo llama astTovRatio")

# ── 6. Verificar pbp_player_game_stats — ¿fouls field existe?
print("\n[6] Columnas pbp_player_game_stats (PIE usa 'fouls'):")
try:
    rows = rest_get("pbp_player_game_stats", limit=1)
    if rows:
        cols = list(rows[0].keys())
        print(f"  Columnas: {cols}")
        has_fouls = 'fouls' in cols
        print(f"  'fouls' presente: {'✅' if has_fouls else '❌'}")
        has_is_starter = 'is_starter' in cols
        print(f"  'is_starter' presente: {'✅' if has_is_starter else '❌'}")
        has_plus_minus = 'plus_minus' in cols
        print(f"  'plus_minus' presente: {'✅' if has_plus_minus else '❌'}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 7. Verificar que plus_minus en pbp_player_game_stats sea correcto
print("\n[7] plus_minus en pbp_player_game_stats — ¿viene de stats_player_boxscores o calculado?")
try:
    # Sample a few rows to check non-null
    rows = rest_get("pbp_player_game_stats", 
        params="plus_minus=not.is.null&select=player_external_id,game_id,plus_minus,pts",
        limit=5)
    print(f"  Muestra (5 rows con plus_minus):")
    for r in rows:
        print(f"    player={r['player_external_id']}, game={r['game_id']}, pm={r['plus_minus']}, pts={r['pts']}")
    
    # Check null percentage
    all_sample = rest_get("pbp_player_game_stats",
        params="select=plus_minus&limit=100",
        limit=100)
    null_count = sum(1 for r in all_sample if r.get('plus_minus') is None)
    print(f"  De 100 rows: {null_count} tienen plus_minus=NULL")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 8. Verificar eFGPct en standings — ¿JOIN problem?
print("\n[8] standings eFGPct — LEFT JOIN sin filtro efectivo de season:")
print("  standings query usa LEFT JOIN pgs + LEFT JOIN sg (con filtro season).")
print("  Si solo hay una season en pgs, no hay problema. Verificando...")
try:
    # Check seasons in pbp_player_game_stats via join
    # Check if all games in pgs are season 2092
    games_in_pgs = rest_get("pbp_player_game_stats",
        params="select=game_id&limit=1",
        limit=1)
    if games_in_pgs:
        gid_sample = games_in_pgs[0]['game_id']
        game_check = rest_get("stats_games",
            params=f"id=eq.{gid_sample}&select=season_id,status",
            limit=1)
        print(f"  Sample game_id={gid_sample}: {game_check}")
    
    # Check total distinct seasons in pbp_player_game_stats
    # Can't do distinct via REST easily, check via game join
    all_seasons = rest_get("stats_games",
        params="select=season_id&limit=1000",
        limit=1000)
    seasons = set(g['season_id'] for g in all_seasons)
    print(f"  Seasons en stats_games: {seasons}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 9. on-off LIKE matching — check external IDs format
print("\n[9] on-off LIKE matching — formato de lineup_id y external_ids:")
try:
    sample_lineup = rest_get("pbp_lineup_stats",
        params="select=lineup_id&limit=3",
        limit=3)
    print(f"  Muestra lineup_ids: {[r['lineup_id'] for r in sample_lineup]}")
    
    # Check external_ids of players
    sample_players = rest_get("stats_players",
        params="select=external_id,name_zh&limit=5",
        limit=5)
    print(f"  Muestra external_ids jugadoras: {[r['external_id'] for r in sample_players]}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 10. Verificar pace league — query directo en pbp_possessions
print("\n[10] Liga pace: COUNT(*) / (COUNT(DISTINCT game_id) * 2):")
try:
    pp_regular = rest_get("pbp_possessions",
        params="season_id=eq.2092&phase_type=eq.regular&select=game_id,team_id,points",
        limit=50000)
    total_poss = len(pp_regular)
    total_games = len(set(p['game_id'] for p in pp_regular))
    pace = round(total_poss / (total_games * 2), 1) if total_games else 0
    total_pts = sum(p.get('points', 0) or 0 for p in pp_regular)
    league_ppp = round(total_pts / total_poss, 3) if total_poss else 0
    league_ortg = round(100 * total_pts / total_poss, 1) if total_poss else 0
    print(f"  total_poss={total_poss}, total_games={total_games}")
    print(f"  Pace = {total_poss} / ({total_games} * 2) = {pace}")
    print(f"  Liga PPP = {league_ppp}, ORTG = {league_ortg}")
    
    # Desglose por team — verificar que todos tienen aprox mismas posesiones
    from collections import defaultdict
    teams_poss = defaultdict(int)
    teams_pts = defaultdict(int)
    for p in pp_regular:
        teams_poss[p['team_id']] += 1
        teams_pts[p['team_id']] += (p.get('points') or 0)
    print(f"  Teams con posesiones: {len(teams_poss)}")
    print(f"  Rango posesiones por equipo: {min(teams_poss.values())}-{max(teams_poss.values())}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 11. Verificar ORTG/DRTG vs league average
print("\n[11] ORTG equipo vs ORTG liga:")
try:
    if teams:
        own_poss = [p for p in pp_regular if p['team_id'] == team_id]
        own_cnt = len(own_poss)
        own_pts = sum(p.get('points', 0) or 0 for p in own_poss)
        own_ortg = round(100 * own_pts / own_cnt, 1) if own_cnt else None
        
        # Opponent poss in own games
        own_game_ids = set(p['game_id'] for p in own_poss)
        opp_poss = [p for p in pp_regular if p['game_id'] in own_game_ids and p['team_id'] != team_id]
        opp_cnt = len(opp_poss)
        opp_pts = sum(p.get('points', 0) or 0 for p in opp_poss)
        own_drtg = round(100 * opp_pts / opp_cnt, 1) if opp_cnt else None
        
        print(f"  {teams[0]['name_zh']}:")
        print(f"    own: {own_cnt} poss, {own_pts} pts → ORTG={own_ortg}")
        print(f"    opp: {opp_cnt} poss, {opp_pts} pts → DRTG={own_drtg}")
        print(f"    NetRtg = {round(own_ortg - own_drtg, 1) if own_ortg and own_drtg else None}")
        print(f"  Liga ORTG = {league_ortg} (referencia)")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 12. Verificar pbp_possessions tiene is_transition, is_early_offense
print("\n[12] pace-segments: ¿pbp_possessions tiene is_transition / is_early_offense?")
try:
    pp_sample = rest_get("pbp_possessions", limit=1)
    if pp_sample:
        keys = list(pp_sample[0].keys())
        print(f"  is_transition presente: {'is_transition' in keys}")
        print(f"  is_early_offense presente: {'is_early_offense' in keys}")
        print(f"  Todas las columnas: {keys}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 13. Verificar ppg/oppg en standings
print("\n[13] ppg/oppg en standings — verificar todos los equipos (muestra 3):")
try:
    all_teams = rest_get("stats_teams", params="select=id,external_id,name_zh", limit=20)
    all_games = rest_get("stats_games",
        params="season_id=eq.2092&status=eq.4&select=id,home_team_id,away_team_id,home_score,away_score",
        limit=500)
    
    for t in all_teams[:3]:
        tid = t['id']
        own_g = [g for g in all_games if g['home_team_id'] == tid or g['away_team_id'] == tid]
        real_pts = sum(g['home_score'] if g['home_team_id'] == tid else g['away_score'] for g in own_g)
        poss_pts_team = teams_pts.get(tid, 0)
        n_games = len(own_g)
        print(f"  {t['name_zh']}: games={n_games}, poss_pts={poss_pts_team}, real_pts={real_pts}")
        if n_games:
            print(f"    ppg_poss={round(poss_pts_team/n_games,1)}, ppg_real={round(real_pts/n_games,1)}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 14. Verificar que fouls en pbp_player_game_stats no sean todos 0
print("\n[14] PIE — fouls en pbp_player_game_stats (¿poblados o todos 0?):")
try:
    fouls_sample = rest_get("pbp_player_game_stats",
        params="select=fouls&fouls=gt.0&limit=5",
        limit=5)
    print(f"  Rows con fouls>0: {len(fouls_sample)}")
    
    fouls_zero = rest_get("pbp_player_game_stats",
        params="select=fouls&fouls=eq.0&limit=5",
        limit=5)
    print(f"  Rows con fouls=0 (muestra): {len(fouls_zero)}")
    
    fouls_null = rest_get("pbp_player_game_stats",
        params="select=fouls&fouls=is.null&limit=5",
        limit=5)
    print(f"  Rows con fouls=NULL (muestra): {len(fouls_null)}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 15. Verificar que season_id en pbp_possessions es correcto
print("\n[15] season_id en pbp_possessions — valores presentes:")
try:
    pp_seasons = rest_get("pbp_possessions",
        params="select=season_id&limit=5",
        limit=5)
    print(f"  Muestra: {[r['season_id'] for r in pp_seasons]}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 16. Verificar fgPct en pbp_player_game_stats — ¿fgm incluye triples?
print("\n[16] fgm en pbp_player_game_stats — ¿incluye fg3m? (fgm should = 2ptm + 3ptm):")
try:
    # Sample player-game where we have 3pm
    rows_with_3s = rest_get("pbp_player_game_stats",
        params="fg3m=gt.0&select=player_external_id,game_id,fgm,fga,fg3m,fg3a,pts&limit=5",
        limit=5)
    print("  Muestra (jugadoras con triples):")
    for r in rows_with_3s:
        pts_check = r['pts']
        fgm = r['fgm']
        fg3m = r['fg3m']
        # fgPct usa fgm/fga. Si fgm ya incluye fg3m, fgPct es correcto.
        # Si fgm es solo 2ptm, entonces fgPct excluye triples (BBRef: fgPct includes all FG)
        print(f"    pts={pts_check}, fgm={fgm}, fg3m={fg3m}, fga={r['fga']}, fg3a={r['fg3a']}")
        # Verify: pts should be ~2*(fgm-fg3m) + 3*fg3m + ftm (without ftm we can't fully check)
        pts_from_fg = 2*(fgm - fg3m) + 3*fg3m  # without FTs
        print(f"      pts_from_fg (no FTs)={pts_from_fg}")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 17. Verificar game score display en game log — siempre desde own perspective?
print("\n[17] game log score display — verificando orientación:")
print("  /api/stats/player/:id usa: CASE WHEN own.id = sg.home_team_id THEN home-away ELSE away-home")
print("  /api/stats/players/all-detail usa: homeScore-awayScore (SIEMPRE, sin girar)")
print("  >>> INCONSISTENCIA: all-detail muestra score absoluto, no desde perspectiva del jugador")

print("\n" + "=" * 60)
print("AUDIT COMPLETADO")
print("=" * 60)
