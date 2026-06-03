#!/usr/bin/env python3
"""
Reprocesado conservador: lotes de 10, espera confirmación real en Supabase entre lotes.
Más lento pero fiable con Railway free tier.
Uso: python3 batch_reprocess.py [--reset] [--batch N]
"""
import json, time, sys, urllib.request
from collections import Counter

RAILWAY  = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H  = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}

BATCH   = int(next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == '--batch' and i+1 < len(sys.argv)), 10))
SEASON  = 2092
TIMEOUT = 20

def supa(path):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def supa_count(table, where=''):
    q = f"{SUPA_URL}/rest/v1/{table}?select=id{('&'+where) if where else ''}"
    req = urllib.request.Request(q, headers={**H, 'Prefer': 'count=exact'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return int(r.headers.get('content-range','*/0').split('/')[-1])

def supa_delete(table, where):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{table}?{where}",
        headers={**H, 'Prefer': 'return=minimal'}, method='DELETE')
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def process_game(gid):
    req = urllib.request.Request(
        f"{RAILWAY}/api/stats/admin/process-game/{gid}?seasonId={SEASON}",
        method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return True, None
    except Exception as e:
        return False, str(e)[:60]

def get_pbp_ids():
    ids = set()
    cursor = 0
    while True:
        rows = supa(f"stats_pbp?select=game_id&game_id=gt.{cursor}&order=game_id.asc&limit=1")
        if not rows: break
        ids.add(rows[0]['game_id'])
        cursor = rows[0]['game_id']
    return sorted(ids)

def wait_for_batch(game_ids, timeout=120):
    """Espera hasta que todos los game_ids del lote tengan audit entries."""
    ids_str = ','.join(str(g) for g in game_ids)
    expected = len(game_ids) * 2  # 2 equipos por partido
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(8)
        rows = supa(f"pbp_audit_log?select=game_id,status&game_id=in.({ids_str})&season_id=eq.{SEASON}&limit=100")
        got = len(rows)
        errors = sum(1 for r in rows if r['status'] == 'error')
        if got >= expected:
            return True, errors
        # Si lleva más de 60s y no hay progreso, continuar de todos modos
        if time.time() - t0 > 60 and got == 0:
            return False, 0
    return False, 0

# ── RESET ──────────────────────────────────────────────────────────────────────
if '--reset' in sys.argv:
    print("RESET...")
    for table, where in [
        ('pbp_possessions','id=gt.0'), ('pbp_player_game_stats','id=gt.0'),
        ('pbp_lineup_stats','id=gt.0'), ('pbp_audit_log','id=gt.0'),
    ]:
        print(f"  DELETE {table}: {supa_delete(table, where)}")
    time.sleep(2)

# ── INVENTARIO ─────────────────────────────────────────────────────────────────
print("\nInventario PBP...")
t0 = time.time()
all_ids = get_pbp_ids()
print(f"  {len(all_ids)} partidos ({time.time()-t0:.0f}s)")

done = {r['game_id'] for r in supa(f"pbp_audit_log?select=game_id&status=eq.ok&season_id=eq.{SEASON}&limit=300")}
todo = [g for g in all_ids if g not in done]
print(f"  Ya ok: {len(done)} | Pendientes: {len(todo)}")

# ── PROCESAR EN LOTES ──────────────────────────────────────────────────────────
total_ok = 0; total_err = 0
t_start = time.time()

for b in range(0, len(todo), BATCH):
    batch = todo[b:b+BATCH]
    batch_n = b // BATCH + 1
    total_batches = (len(todo) + BATCH - 1) // BATCH
    
    # Enviar lote
    http_ok = 0
    for gid in batch:
        ok, err = process_game(gid)
        if ok: http_ok += 1
        else: print(f"  HTTP error {gid}: {err}")
    
    # Esperar confirmación
    confirmed, errors = wait_for_batch(batch)
    total_ok += http_ok
    total_err += errors
    
    elapsed = (time.time() - t_start) / 60
    done_pct = (b + len(batch)) / len(todo) * 100
    rem_est  = elapsed / done_pct * (100 - done_pct) if done_pct > 0 else 0
    status = "✅" if confirmed else "⚠️ timeout"
    print(f"  Lote {batch_n}/{total_batches}: {batch} {status} | {elapsed:.1f}min transcurridos, ~{rem_est:.0f}min restantes")

# ── RESULTADO FINAL ────────────────────────────────────────────────────────────
print("\nResultado final...")
time.sleep(10)
audit = supa(f"pbp_audit_log?select=status,diff_pts&season_id=eq.{SEASON}&limit=500")
c = Counter(r['status'] for r in audit)
max_diff = max((abs(r.get('diff_pts') or 0) for r in audit), default=0)
poss  = supa_count('pbp_possessions')
lineup = supa_count('pbp_lineup_stats')
players = supa_count('pbp_player_game_stats')
print(f"  audit: ok={c.get('ok',0)} err={c.get('error',0)} total={len(audit)}/448")
print(f"  max_diff: {max_diff} {'✅' if max_diff==0 else '❌'}")
print(f"  poss={poss} players={players} lineup={lineup}")
print("DONE")
