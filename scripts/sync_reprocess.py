#!/usr/bin/env python3
"""
Reprocesado síncrono robusto.
- Usa stats_games para el inventario (1 query, no 224)
- Endpoint síncrono: Railway procesa y responde cuando termina
- Sin paralelismo → sin saturación de Supabase
- ~8s/partido × 224 = ~30min
Uso: python3 sync_reprocess.py [--reset] [--from ID]
"""
import json, sys, time, urllib.request
from collections import Counter

RAILWAY  = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H  = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}
SEASON = 2092

def supa(path):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def supa_count(table, where=''):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{table}?select=id{('&'+where) if where else ''}",
        headers={**H, 'Prefer': 'count=exact'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return int(r.headers.get('content-range','*/0').split('/')[-1])

def supa_delete(table, where):
    req = urllib.request.Request(f"{SUPA_URL}/rest/v1/{table}?{where}",
        headers={**H, 'Prefer': 'return=minimal'}, method='DELETE')
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def process_sync(gid):
    req = urllib.request.Request(
        f"{RAILWAY}/api/stats/admin/process-game-sync/{gid}?seasonId={SEASON}",
        method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return True, json.loads(r.read())
    except urllib.request.HTTPError as e:
        return False, e.read().decode()[:150]
    except Exception as e:
        return False, str(e)[:80]

# ── RESET ──────────────────────────────────────────────────────────────────────
if '--reset' in sys.argv:
    print("RESET...", flush=True)
    for t, w in [('pbp_possessions','id=gt.0'),('pbp_player_game_stats','id=gt.0'),
                  ('pbp_lineup_stats','id=gt.0'),('pbp_audit_log','id=gt.0')]:
        print(f"  {t}: {supa_delete(t, w)}", flush=True)
    time.sleep(2)

# ── INVENTARIO — 1 sola query ──────────────────────────────────────────────────
print("Inventario (1 query)...", flush=True)
all_games = supa(f"stats_games?select=id&status=eq.4&season_id=eq.{SEASON}&order=id.asc&limit=300")
all_ids = [g['id'] for g in all_games]
print(f"  Partidos status=4: {len(all_ids)}", flush=True)

# Partidos ya procesados
done_rows = supa(f"pbp_audit_log?select=game_id&status=eq.ok&season_id=eq.{SEASON}&limit=300")
done = {r['game_id'] for r in done_rows}

# Opción --from para reanudar desde un ID específico
from_id = int(next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == '--from' and i+1 < len(sys.argv)), 0))

todo = [g for g in all_ids if g not in done and g >= from_id]
print(f"  Ya ok: {len(done)} | Pendientes: {len(todo)} | Desde ID: {from_id or 'inicio'}", flush=True)
print(f"  Estimado: ~{len(todo)*8/60:.0f}min\n", flush=True)

# ── PROCESAR ───────────────────────────────────────────────────────────────────
ok_ids, err_ids = [], {}
t_start = time.time()

for i, gid in enumerate(todo, 1):
    t_game = time.time()
    ok, result = process_sync(gid)
    elapsed_game = time.time() - t_game

    if ok:
        ok_ids.append(gid)
    else:
        err_ids[gid] = str(result)[:100]
        print(f"  ❌ game {gid}: {result}", flush=True)

    if i % 10 == 0 or i == len(todo):
        elapsed = time.time() - t_start
        rate = i / elapsed if elapsed > 0 else 1
        rem = (len(todo) - i) / rate
        print(f"  [{i}/{len(todo)}] ok={len(ok_ids)} err={len(err_ids)} — {elapsed/60:.1f}min transcurridos, ~{rem/60:.0f}min restantes (último: {elapsed_game:.1f}s)", flush=True)

# ── RESULTADO FINAL ────────────────────────────────────────────────────────────
print("\nResultado final:", flush=True)
audit = supa(f"pbp_audit_log?select=status,diff_pts&season_id=eq.{SEASON}&limit=500")
c = Counter(r['status'] for r in audit)
max_diff = max((abs(r.get('diff_pts') or 0) for r in audit), default=0)
print(f"  audit: ok={c.get('ok',0)} err={c.get('error',0)} total={len(audit)}/448", flush=True)
print(f"  max_diff: {max_diff} {'✅' if max_diff==0 else '❌'}", flush=True)
print(f"  poss={supa_count('pbp_possessions')} players={supa_count('pbp_player_game_stats')} lineup={supa_count('pbp_lineup_stats')}", flush=True)
if err_ids:
    print(f"  Errores: {list(err_ids.keys())}", flush=True)
print("DONE", flush=True)
