#!/usr/bin/env python3
"""
Reprocesado rápido con verificación real en Supabase.
Uso: python3 fast_reprocess.py [--reset] [--workers N]
  --reset    DELETE tablas derivadas antes de procesar
  --workers  N partidos en paralelo para Railway (default: 6)
"""
import json, time, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter

RAILWAY  = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H  = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}

WORKERS       = int(next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == '--workers' and i+1 < len(sys.argv)), 6))
SEASON        = 2092
TIMEOUT       = 25
VERIFY_WAIT   = 600   # segundos máx esperando que Railway termine de escribir
VERIFY_POLL   = 15    # cada cuántos segundos verificamos

def supa(path):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def supa_delete(table, where):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{table}?{where}",
        headers={**H, 'Prefer': 'return=minimal'}, method='DELETE'
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def process_game(game_id):
    req = urllib.request.Request(
        f"{RAILWAY}/api/stats/admin/process-game/{game_id}?seasonId={SEASON}",
        method='POST', headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return game_id, True, None
    except Exception as e:
        return game_id, False, str(e)[:80]

def get_pbp_game_ids():
    """Verificar qué partidos tienen PBP — 8 workers para no throttlear Supabase."""
    all_games = supa(f"stats_games?select=id&status=eq.4&season_id=eq.{SEASON}&order=id.asc&limit=300")
    all_ids = [g['id'] for g in all_games]

    def check_pbp(gid):
        rows = supa(f"stats_pbp?select=id&game_id=eq.{gid}&limit=1")
        return gid if rows else None

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(check_pbp, all_ids))
    return sorted(r for r in results if r is not None)

def get_audit_status():
    rows = supa(f"pbp_audit_log?select=status,diff_pts&season_id=eq.{SEASON}&limit=500")
    c = Counter(r['status'] for r in rows)
    max_diff = max((abs(r.get('diff_pts') or 0) for r in rows), default=0)
    return c, max_diff, len(rows)

def get_counts():
    poss  = supa("pbp_possessions?select=id&limit=1")   # solo para saber si hay datos
    lineup = supa("pbp_lineup_stats?select=id&limit=1")
    # count real via header
    def count(table):
        req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{table}?select=id", headers={**H, 'Prefer': 'count=exact'})
        with urllib.request.urlopen(req, timeout=10) as r:
            cr = r.headers.get('content-range', '0-0/0')
            return int(cr.split('/')[-1])
    return count('pbp_possessions'), count('pbp_lineup_stats'), count('pbp_audit_log')

# ── RESET ─────────────────────────────────────────────────────────────────────
if '--reset' in sys.argv:
    print("RESET: Eliminando tablas derivadas...")
    for table, where in [
        ('pbp_possessions',       'id=gt.0'),
        ('pbp_player_game_stats', 'id=gt.0'),
        ('pbp_lineup_stats',      'id=gt.0'),
        ('pbp_audit_log',         'id=gt.0'),
    ]:
        s = supa_delete(table, where)
        print(f"  DELETE {table}: HTTP {s}")
    time.sleep(3)

# ── INVENTARIO ────────────────────────────────────────────────────────────────
print("\nIdentificando partidos con PBP (8 workers)...")
t0 = time.time()
pbp_ids = get_pbp_game_ids()
print(f"  Con PBP: {len(pbp_ids)} ({time.time()-t0:.1f}s)")

done_rows = supa(f"pbp_audit_log?select=game_id&status=eq.ok&season_id=eq.{SEASON}&limit=300")
already_ok = {r['game_id'] for r in done_rows}
to_process = sorted(set(pbp_ids) - already_ok)
print(f"  Ya ok en audit: {len(already_ok)} | Pendientes: {len(to_process)}")

if not to_process:
    print("\nTodo procesado. Verificando...")
else:
    est = len(to_process) / WORKERS * 3 / 60
    print(f"\nProcesando {len(to_process)} partidos — {WORKERS} workers — estimado requests: ~{est:.0f}min\n")

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
                rate = i / elapsed
                rem = (len(to_process) - i) / rate if rate > 0 else 0
                print(f"  [{i}/{len(to_process)}] ok={len(ok_ids)} err={len(err_ids)} — {elapsed/60:.1f}min, ~{rem/60:.1f}min restantes")

    print(f"\nHTTP requests: ok={len(ok_ids)} err={len(err_ids)}")
    if err_ids:
        print(f"  Errores: {dict(list(err_ids.items())[:5])}")
        print("  Reintentando en serie...")
        for gid in list(err_ids.keys()):
            time.sleep(2)
            _, ok, e = process_game(gid)
            if ok: del err_ids[gid]
            else: print(f"  ❌ definitivo {gid}: {e}")

# ── VERIFICACIÓN REAL EN SUPABASE ─────────────────────────────────────────────
print(f"\nEsperando que Railway escriba en Supabase (máx {VERIFY_WAIT//60}min)...")
expected_audit = len(pbp_ids) * 2   # 2 equipos por partido
t_wait = time.time()
last_audit_total = 0

while time.time() - t_wait < VERIFY_WAIT:
    time.sleep(VERIFY_POLL)
    c, max_diff, audit_total = get_audit_status()
    poss_count, lineup_count, _ = get_counts()
    elapsed_w = (time.time() - t_wait) / 60
    print(f"  [{elapsed_w:.1f}min] audit: ok={c.get('ok',0)} err={c.get('error',0)} total={audit_total}/{expected_audit} | poss={poss_count} lineups={lineup_count} | max_diff={max_diff}")

    # Terminado cuando audit tiene todas las filas esperadas y max_diff=0
    if audit_total >= expected_audit and max_diff == 0 and c.get('error', 0) == 0:
        print(f"\n✅ VERIFICADO: audit ok={c.get('ok',0)}, max_diff=0, lineups={lineup_count}")
        break
    # Parar si el total de audit dejó de crecer (Railway terminó aunque haya errores)
    if audit_total > 0 and audit_total == last_audit_total:
        print(f"\n⚠️  Audit estabilizado en {audit_total} filas. Verificando resultado final...")
        break
    last_audit_total = audit_total
else:
    print(f"\n⚠️  Timeout — verificar manualmente")

# ── RESULTADO FINAL ───────────────────────────────────────────────────────────
c, max_diff, audit_total = get_audit_status()
poss_count, lineup_count, _ = get_counts()
print(f"\n=== RESULTADO FINAL ===")
print(f"  audit: ok={c.get('ok',0)} warning={c.get('warning',0)} error={c.get('error',0)} total={audit_total}")
print(f"  max_diff: {max_diff} {'✅' if max_diff == 0 else '❌'}")
print(f"  pbp_possessions: {poss_count}")
print(f"  pbp_lineup_stats: {lineup_count} {'✅' if lineup_count > 0 else '❌'}")

poss_sample = supa("pbp_possessions?select=team_id&limit=200")
large = [r['team_id'] for r in poss_sample if r.get('team_id') and int(r['team_id']) > 100]
print(f"  IDs externos en possessions: {len(large)} {'✅ LIMPIO' if not large else '❌ HAY MEZCLA'}")
print("\nDONE")
