#!/usr/bin/env python3
"""
Reset completo y reprocesado limpio.
1. Trunca pbp_possessions, pbp_player_game_stats, pbp_lineup_stats, pbp_audit_log
2. Procesa cada partido con PBP uno a uno, esperando confirmación antes del siguiente
"""
import json, time, urllib.request

RAILWAY = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}

def supa_get(path):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def supa_delete(table, where):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{table}?{where}",
        headers={**H, 'Prefer': 'return=minimal'},
        method='DELETE'
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def process_game(game_id):
    req = urllib.request.Request(
        f"{RAILWAY}/api/stats/admin/process-game/{game_id}?seasonId=2092",
        method='POST', headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def has_possessions(game_id):
    rows = supa_get(f"pbp_possessions?select=id&game_id=eq.{game_id}&limit=1")
    return len(rows) > 0

def has_pbp(game_id):
    rows = supa_get(f"stats_pbp?select=id&game_id=eq.{game_id}&limit=1")
    return len(rows) > 0

# ── PASO 1: Truncar tablas derivadas ──────────────────────────
print("PASO 1: Truncando tablas derivadas...")
for table, where in [
    ('pbp_possessions',        'id=gt.0'),
    ('pbp_player_game_stats',  'id=gt.0'),
    ('pbp_lineup_stats',       'id=gt.0'),
    ('pbp_audit_log',          'id=gt.0'),
]:
    status = supa_delete(table, where)
    print(f"  DELETE {table}: HTTP {status}")

time.sleep(2)

# Verificar que están vacías
for table in ['pbp_possessions','pbp_player_game_stats','pbp_lineup_stats','pbp_audit_log']:
    rows = supa_get(f"{table}?select=id&limit=1")
    print(f"  {table}: {len(rows)} filas {'✅' if len(rows)==0 else '❌ NO VACÍA'}")

# ── PASO 2: Obtener partidos con PBP ─────────────────────────
print("\nPASO 2: Identificando partidos con PBP...")
games = supa_get("stats_games?select=id&status=eq.4&season_id=eq.2092&order=id.asc&limit=300")
game_ids = [g['id'] for g in games]

# Filtrar solo los que tienen PBP real
to_process = [gid for gid in game_ids if has_pbp(gid)]
print(f"  Partidos status=4: {len(game_ids)}")
print(f"  Con PBP real: {len(to_process)}")
print(f"  Primeros 5: {to_process[:5]}")

# ── PASO 3: Procesar uno a uno ────────────────────────────────
print(f"\nPASO 3: Procesando {len(to_process)} partidos...")
ok, err = 0, 0
start = time.time()

for i, gid in enumerate(to_process):
    try:
        process_game(gid)
        # Esperar confirmación (max 45s)
        confirmed = False
        for _ in range(22):
            time.sleep(2)
            if has_possessions(gid):
                confirmed = True
                break
        if confirmed:
            ok += 1
        else:
            print(f"  ⚠️ TIMEOUT game {gid}")
            err += 1
    except Exception as e:
        print(f"  ❌ ERROR game {gid}: {e}")
        err += 1
        time.sleep(3)

    if (i+1) % 10 == 0:
        elapsed = (time.time()-start)/60
        remaining = elapsed/(i+1)*(len(to_process)-i-1)
        print(f"  [{i+1}/{len(to_process)}] ok={ok} err={err} — {elapsed:.1f}min transcurridos, ~{remaining:.1f}min restantes")

print(f"\n{'='*50}")
print(f"COMPLETADO: ok={ok} err={err}/{len(to_process)}")

# ── PASO 4: Verificar audit final ─────────────────────────────
print("\nPASO 4: Verificación final...")
audit = supa_get("pbp_audit_log?select=status&season_id=eq.2092&limit=500")
from collections import Counter
c = Counter(r['status'] for r in audit)
print(f"  Audit: ok={c.get('ok',0)} error={c.get('error',0)}")

poss_count = supa_get("pbp_possessions?select=id&limit=1")
print(f"  pbp_possessions: {len(poss_count)} (muestra de 1 — confirma que hay datos)")

# Sanity check team_ids
poss_sample = supa_get("pbp_possessions?select=team_id&limit=200")
tids = set(r['team_id'] for r in poss_sample if r['team_id'])
large = [t for t in tids if int(t) > 100]
print(f"  IDs externos en possessions: {len(large)} {'✅ 0 — LIMPIO' if not large else '❌ HAY MEZCLA'}")

print("\nDONE")
