#!/usr/bin/env python3
"""
Reprocesa partidos uno a uno, esperando confirmación en Supabase antes del siguiente.
Robusto: no depende de la cola interna de Railway.
"""
import json, time, urllib.request

RAILWAY = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
SUPA_H = {'apikey': SK, 'Authorization': f'Bearer {SK}'}

def supa_get(path):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=SUPA_H)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def has_possessions(game_id):
    rows = supa_get(f"pbp_possessions?select=id&game_id=eq.{game_id}&limit=1")
    return len(rows) > 0

def has_pbp(game_id):
    rows = supa_get(f"stats_pbp?select=id&game_id=eq.{game_id}&limit=1")
    return len(rows) > 0

def process_game(game_id):
    url = f"{RAILWAY}/api/stats/admin/process-game/{game_id}?seasonId=2092"
    req = urllib.request.Request(url, method='POST')
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

# Obtener todos los partidos con PBP pero sin posesiones
games = supa_get("stats_games?select=id&status=eq.4&season_id=eq.2092&order=id.asc&limit=300")
game_ids = [g['id'] for g in games]
print(f"Total partidos: {len(game_ids)}")

# Filtrar los que tienen PBP pero no tienen posesiones aún
to_process = []
for gid in game_ids:
    if not has_possessions(gid) and has_pbp(gid):
        to_process.append(gid)

print(f"Con PBP sin posesiones: {len(to_process)}")
print(f"Primeros 5: {to_process[:5]}")

ok, skip, err = 0, 0, 0
for i, gid in enumerate(to_process):
    try:
        process_game(gid)
        # Esperar hasta que Supabase confirme las posesiones (max 30s)
        confirmed = False
        for _ in range(15):
            time.sleep(2)
            if has_possessions(gid):
                confirmed = True
                break
        if confirmed:
            ok += 1
        else:
            print(f"  TIMEOUT game {gid} — no possessions after 30s")
            err += 1
    except Exception as e:
        print(f"  ERROR game {gid}: {e}")
        err += 1

    if (i + 1) % 10 == 0 or i == 0:
        print(f"  [{i+1}/{len(to_process)}] ok={ok} err={err}")

print(f"\nFIN: ok={ok} err={err} skip={skip}/{len(game_ids)}")
