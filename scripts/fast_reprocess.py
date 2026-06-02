#!/usr/bin/env python3
"""
Reprocesado rápido con verificación real en Supabase.
Uso: python3 fast_reprocess.py [--reset] [--workers N]
"""
import json, time, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter

RAILWAY  = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H  = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}

WORKERS     = int(next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == '--workers' and i+1 < len(sys.argv)), 6))
SEASON      = 2092
TIMEOUT     = 25
VERIFY_WAIT = 600
VERIFY_POLL = 15

def supa(path):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def supa_count(table, where=''):
    q = f"{SUPA_URL}/rest/v1/{table}?select=id{('&'+where) if where else ''}"
    req = urllib.request.Request(q, headers={**H, 'Prefer': 'count=exact'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return int(r.headers.get('content-range','0-0/0').split('/')[-1])

def supa_delete(table, where):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{table}?{where}",
        headers={**H, 'Prefer': 'return=minimal'}, method='DELETE')
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def process_game(game_id):
    req = urllib.request.Request(
        f"{RAILWAY}/api/stats/admin/process-game/{game_id}?seasonId={SEASON}",
        method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return game_id, True, None
    except Exception as e:
        return game_id, False, str(e)[:80]

def get_pbp_game_ids():
    """
    Obtiene game_ids únicos de stats_pbp paginando por game_id (no por offset).
    Mucho más eficiente: O(N_partidos) queries en lugar de O(N_eventos/1000).
    """
    ids = set()
    cursor = 0
    while True:
        # Pide el primer evento de cada partido con game_id > cursor
        rows = supa(f"stats_pbp?select=game_id&game_id=gt.{cursor}&order=game_id.asc&limit=1")
        if not rows:
            break
        gid = rows[0]['game_id']
        ids.add(gid)
        cursor = gid
    return sorted(ids)

def get_audit_status():
    rows = supa(f"pbp_audit_log?select=status,diff_pts&season_id=eq.{SEASON}&limit=500")
    c = Counter(r['status'] for r in rows)
    max_diff = max((abs(r.get('diff_pts') or 0) for r in rows), default=0)
    return c, max_diff, len(rows)

# ── RESET ─────────────────────────────────────────────────────────────────────
if '--reset' in sys.argv:
    print("RESET: Eliminando tablas derivadas...")
    for table, where in [
        ('pbp_possessions',       'id=gt.0'),
        ('pbp_player_game_stats', 'id=gt.0'),
        ('pbp_lineup_stats',      'id=gt.0'),
        ('pbp_audit_log',         'id=gt.0'),
    ]:
        print(f"  DELETE {table}: HTTP {supa_delete(table, where)}")
    time.sleep(3)

# ── INVENTARIO ────────────────────────────────────────────────────────────────
print("\nIdentificando partidos con PBP...")
t0 = time.time()
pbp_ids = get_pbp_game_ids()
print(f"  Con PBP: {len(pbp_ids)} ({time.time()-t0:.1f}s)")

done_rows = supa(f"pbp_audit_log?select=game_id&status=eq.ok&season_id=eq.{SEASON}&limit=300")
already_ok = {r['game_id'] for r in done_rows}
to_process = sorted(set(pbp_ids) - already_ok)
print(f"  Ya ok: {len(already_ok)} | Pendientes: {len(to_process)}")

# ── PROCESAR ──────────────────────────────────────────────────────────────────
if to_process:
    print(f"\nProcesando {len(to_process)} partidos — {WORKERS} workers paralelos\n")
    ok_ids, err_ids = [], {}
    t_start = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(process_game, gid): gid for gid in to_process}
        for i, future in enumerate(as_completed(futures), 1):
            gid, success, err = future.result()
            if success: ok_ids.append(gid)
            else: err_ids[gid] = err
            if i % 20 == 0 or i == len(to_process):
                elapsed = time.time() - t_start
                rem = (len(to_process) - i) / (i / elapsed) if elapsed > 0 else 0
                print(f"  [{i}/{len(to_process)}] ok={len(ok_ids)} err={len(err_ids)} — {elapsed/60:.1f}min, ~{rem/60:.1f}min")

    if err_ids:
        print(f"\nReintentando {len(err_ids)} errores en serie...")
        for gid in list(err_ids.keys()):
            time.sleep(2)
            _, ok, e = process_game(gid)
            if ok: del err_ids[gid]
            else: print(f"  ❌ {gid}: {e}")

# ── ESPERAR Y VERIFICAR EN SUPABASE ──────────────────────────────────────────
expected_audit = len(pbp_ids) * 2
print(f"\nEsperando escrituras Railway → Supabase (máx {VERIFY_WAIT//60}min, poll {VERIFY_POLL}s)...")
t_wait = time.time()
last_total = 0

while time.time() - t_wait < VERIFY_WAIT:
    time.sleep(VERIFY_POLL)
    c, max_diff, total = get_audit_status()
    poss  = supa_count('pbp_possessions')
    lineup = supa_count('pbp_lineup_stats')
    elapsed_w = (time.time() - t_wait) / 60
    print(f"  [{elapsed_w:.1f}min] audit ok={c.get('ok',0)} err={c.get('error',0)} {total}/{expected_audit} | poss={poss} lineups={lineup} | diff={max_diff}")

    if total >= expected_audit and max_diff == 0 and c.get('error', 0) == 0:
        print(f"\n✅ COMPLETO — audit ok={c.get('ok',0)}, max_diff=0, lineups={lineup}")
        break
    if total > 0 and total == last_total:
        print(f"\n⚠️  Audit estabilizado en {total}/{expected_audit} — Railway terminó")
        break
    last_total = total
else:
    print(f"\n⚠️  Timeout {VERIFY_WAIT//60}min — verificar manualmente")

# ── RESULTADO FINAL ───────────────────────────────────────────────────────────
c, max_diff, total = get_audit_status()
poss  = supa_count('pbp_possessions')
lineup = supa_count('pbp_lineup_stats')
sample = supa("pbp_possessions?select=team_id&limit=200")
large  = [r['team_id'] for r in sample if r.get('team_id') and int(r['team_id']) > 100]

print(f"\n=== RESULTADO FINAL ===")
print(f"  audit: ok={c.get('ok',0)} err={c.get('error',0)} total={total}/{expected_audit} {'✅' if total==expected_audit and max_diff==0 else '❌'}")
print(f"  max_diff: {max_diff} {'✅' if max_diff==0 else '❌'}")
print(f"  pbp_possessions:  {poss}")
print(f"  pbp_lineup_stats: {lineup} {'✅' if lineup > 0 else '❌'}")
print(f"  IDs externos:     {len(large)} {'✅ LIMPIO' if not large else '❌'}")
print("\nDONE")
