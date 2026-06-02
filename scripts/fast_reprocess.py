#!/usr/bin/env python3
"""
Reprocesado rápido con paralelismo controlado.
Uso: python3 fast_reprocess.py [--reset] [--workers N]
  --reset    DELETE tablas derivadas antes de procesar
  --workers  N partidos en paralelo (default: 6)
"""
import json, time, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter

RAILWAY  = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H  = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}

WORKERS  = int(next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == '--workers' and i+1 < len(sys.argv)), 6))
SEASON   = 2092
TIMEOUT  = 25

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
    """
    Obtiene los game_ids distintos de stats_pbp de forma eficiente.
    Pagina por game_id en lugar de por offset para evitar duplicados.
    Cada página pide el primer evento de cada rango de game_id.
    """
    ids = set()
    # stats_pbp tiene hasta game_id=374. Verificamos de 1 en 1 en lotes usando
    # stats_games como fuente de verdad y confirmamos con una query por lote.
    # Un partido tiene ~500 eventos. Para verificar existencia usamos limit=1 por partido.
    all_games = supa(f"stats_games?select=id&status=eq.4&season_id=eq.{SEASON}&order=id.asc&limit=300")
    all_ids = [g['id'] for g in all_games]
    
    # Verificar de 1 en 1 pero con requests paralelas (más rápido)
    print(f"  Verificando {len(all_ids)} partidos (1 request cada uno, paralelo)...")
    
    def check_pbp(gid):
        rows = supa(f"stats_pbp?select=id&game_id=eq.{gid}&limit=1")
        return gid if rows else None
    
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(check_pbp, all_ids))
    
    ids = {r for r in results if r is not None}
    return sorted(ids)

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

# ── OBTENER GAME IDS ──────────────────────────────────────────────────────────
print("\nIdentificando partidos con PBP...")
t0 = time.time()
pbp_ids = get_pbp_game_ids()
print(f"  Con PBP real: {len(pbp_ids)} ({time.time()-t0:.1f}s)")

# ── YA PROCESADOS ─────────────────────────────────────────────────────────────
print("Verificando ya procesados (audit_log ok)...")
done_rows = supa(f"pbp_audit_log?select=game_id&status=eq.ok&season_id=eq.{SEASON}&limit=300")
already_ok = {r['game_id'] for r in done_rows}
print(f"  Ya con audit ok: {len(already_ok)}")

to_process = sorted(set(pbp_ids) - already_ok)
print(f"  Pendientes: {len(to_process)}")

if not to_process:
    print("\nTodo ya procesado.")
else:
    est_min = len(to_process) / WORKERS * 3 / 60
    print(f"\nProcesando {len(to_process)} partidos — {WORKERS} workers — estimado: ~{est_min:.0f}min\n")

    ok_ids, err_ids = [], {}
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(process_game, gid): gid for gid in to_process}
        for i, future in enumerate(as_completed(futures), 1):
            gid, success, err = future.result()
            if success:
                ok_ids.append(gid)
            else:
                err_ids[gid] = err

            if i % 10 == 0 or i == len(to_process):
                elapsed   = time.time() - t_start
                rate      = i / elapsed
                remaining = (len(to_process) - i) / rate if rate > 0 else 0
                print(f"  [{i}/{len(to_process)}] ok={len(ok_ids)} err={len(err_ids)} "
                      f"— {elapsed/60:.1f}min, ~{remaining/60:.1f}min restantes")

    print(f"\nRequests: ok={len(ok_ids)} err={len(err_ids)}")
    if err_ids:
        print(f"  Primeros errores: {dict(list(err_ids.items())[:5])}")

    # Reintentar errores en serie
    if err_ids:
        print(f"\nReintentando {len(err_ids)} errores...")
        for gid in list(err_ids.keys()):
            time.sleep(2)
            _, ok, e = process_game(gid)
            if ok:
                del err_ids[gid]
            else:
                print(f"  ❌ definitivo {gid}: {e}")

# ── VERIFICACIÓN FINAL ────────────────────────────────────────────────────────
print("\nEsperando 15s para escrituras finales...")
time.sleep(15)
print("Verificación final...")
audit = supa(f"pbp_audit_log?select=status,diff_pts&season_id=eq.{SEASON}&limit=500")
c = Counter(r['status'] for r in audit)
max_diff = max((abs(r.get('diff_pts') or 0) for r in audit), default=0)
print(f"  Audit: ok={c.get('ok',0)} warning={c.get('warning',0)} error={c.get('error',0)}")
print(f"  max_diff: {max_diff} {'✅' if max_diff == 0 else '❌'}")

poss_sample = supa("pbp_possessions?select=team_id&limit=200")
large = [r['team_id'] for r in poss_sample if r.get('team_id') and int(r['team_id']) > 100]
print(f"  IDs externos en possessions: {len(large)} {'✅ LIMPIO' if not large else '❌ HAY MEZCLA'}")
print("\nDONE")
