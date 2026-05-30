#!/usr/bin/env python3
"""
Backfill home_q1..q4 / away_q1..q4 para los 224 partidos existentes.
Llama a matchinfoscores por cada partido y actualiza Supabase via REST.
"""
import json, time, urllib.request, urllib.error

SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = open('/Users/palant/Downloads/U scout/.env').read()
SK = [l.split('=',1)[1].strip() for l in SK.splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]

WCBA_HEADERS = {
    'Referer': 'https://www.cba.net.cn/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
}
SUPA_HEADERS = {
    'apikey': SK,
    'Authorization': f'Bearer {SK}',
    'Content-Type': 'application/json',
}

def supa_get(path, params=''):
    url = f"{SUPA_URL}/rest/v1/{path}?{params}"
    req = urllib.request.Request(url, headers=SUPA_HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def supa_patch(path, where, body):
    url = f"{SUPA_URL}/rest/v1/{path}?{where}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={**SUPA_HEADERS, 'Prefer': 'return=minimal'}, method='PATCH')
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status

def wcba_get(url):
    req = urllib.request.Request(url, headers=WCBA_HEADERS)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

# Obtener todos los partidos
games = supa_get('stats_games', 'select=id,external_game_id,match_id,home_q1,status&status=eq.4&order=id.asc&limit=300')
print(f"Total partidos status=4: {len(games)}")

# Solo los que no tienen cuartos aún
missing = [g for g in games if g['home_q1'] is None]
print(f"Sin cuartos: {len(missing)}")

ok, err = 0, 0
for i, g in enumerate(missing):
    game_ext_id = g['external_game_id']
    match_id = g['match_id'] or 2603
    internal_id = g['id']

    try:
        url = f"https://www.cba.net.cn/datahub/cbamatch/games/matchinfoscores?matchId={match_id}&gameId={game_ext_id}"
        data = wcba_get(url)
        home = data.get('data', {}).get('home', {})
        away = data.get('data', {}).get('away', {})
        hp = home.get('periods', [])
        ap = away.get('periods', [])

        if not hp or not ap:
            print(f"  SKIP {game_ext_id}: no periods data")
            err += 1
            continue

        patch = {
            'home_q1': int(hp[0]) if len(hp) > 0 else None,
            'home_q2': int(hp[1]) if len(hp) > 1 else None,
            'home_q3': int(hp[2]) if len(hp) > 2 else None,
            'home_q4': int(hp[3]) if len(hp) > 3 else None,
            'away_q1': int(ap[0]) if len(ap) > 0 else None,
            'away_q2': int(ap[1]) if len(ap) > 1 else None,
            'away_q3': int(ap[2]) if len(ap) > 2 else None,
            'away_q4': int(ap[3]) if len(ap) > 3 else None,
        }

        supa_patch('stats_games', f'id=eq.{internal_id}', patch)
        ok += 1

        if (i + 1) % 20 == 0:
            print(f"  {i+1}/{len(missing)} — ok={ok} err={err}")

        time.sleep(0.2)  # rate limit WCBA API

    except Exception as e:
        print(f"  ERROR {game_ext_id}: {e}")
        err += 1
        time.sleep(0.5)

print(f"\nDone: ok={ok} err={err}/{len(missing)}")
