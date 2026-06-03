#!/usr/bin/env python3
"""
Reprocesado secuencial con verificación real partido a partido.
- Endpoint async (fire-and-forget en Railway)
- Pero espera hasta que Supabase confirma antes de continuar
- Un partido a la vez: sin saturación
Uso: python3 seq_reprocess.py [--reset] [--from ID]
"""
import json, sys, time, urllib.request
from collections import Counter

RAILWAY  = "https://u-scout-production.up.railway.app"
SUPA_URL = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
SK = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
H  = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Content-Type': 'application/json'}
SEASON       = 2092
WAIT_PER_GAME = 90   # máx segundos esperando que Supabase tenga datos del partido
POLL_INTERVAL = 5    # segundos entre polls

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

def fire_game(gid):
    req = urllib.request.Request(
        f"{RAILWAY}/api/stats/admin/process-game/{gid}?seasonId={SEASON}",
        method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return True
    except Exception as e:
        return False

def wait_game(gid, timeout=WAIT_PER_GAME):
    """Espera hasta que pbp_audit_log tenga 2 filas para este partido."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(POLL_INTERVAL)
        rows = supa(f"pbp_audit_log?select=status,diff_pts&game_id=eq.{gid}&season_id=eq.{SEASON}&limit=2")
        if len(rows) >= 2:
            ok = all(r['status'] == 'ok' for r in rows)
            diff = max(abs(r.get('diff_pts') or 0) for r in rows)
            return True, ok, diff
    return False, False, -1  # timeout

# ── RESET ──────────────────────────────────────────────────────────────────────
if '--reset' in sys.argv:
    print("RESET...", flush=True)
    for t, w in [('pbp_possessions','id=gt.0'),('pbp_player_game_stats','id=gt.0'),
                  ('pbp_lineup_stats','id=gt.0'),('pbp_audit_log','id=gt.0')]:
        print(f"  {t}: {supa_delete(t, w)}", flush=True)
    time.sleep(2)

# ── INVENTARIO ─────────────────────────────────────────────────────────────────
print("Inventario...", flush=True)
all_games = supa(f"stats_games?select=id&status=eq.4&season_id=eq.{SEASON}&order=id.asc&limit=300")
all_ids = [g['id'] for g in all_games]

done_rows = supa(f"pbp_audit_log?select=game_id&status=eq.ok&season_id=eq.{SEASON}&limit=300")
done = {r['game_id'] for r in done_rows}

from_id = int(next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == '--from' and i+1 < len(sys.argv)), 0))
todo = [g for g in all_ids if g not in done and g >= from_id]
print(f"  Total: {len(all_ids)} | Ya ok: {len(done)} | Pendientes: {len(todo)}", flush=True)
print(f"  Estimado: ~{len(todo) * (WAIT_PER_GAME//2) // 60}min\n", flush=True)

# ── PROCESAR ───────────────────────────────────────────────────────────────────
ok_count = 0; err_list = []
t_start = time.time()

for i, gid in enumerate(todo, 1):
    fired = fire_game(gid)
    if not fired:
        print(f"  ❌ {gid}: HTTP fire failed", flush=True)
        err_list.append(gid)
        continue

    confirmed, audit_ok, diff = wait_game(gid)

    if confirmed and audit_ok and diff == 0:
        ok_count += 1
    elif confirmed:
        print(f"  ⚠️  {gid}: audit diff={diff} ok={audit_ok}", flush=True)
        ok_count += 1  # procesado aunque con warning
    else:
        print(f"  ⏱  {gid}: timeout ({WAIT_PER_GAME}s)", flush=True)
        err_list.append(gid)

    if i % 10 == 0 or i == len(todo):
        elapsed = time.time() - t_start
        rate = i / elapsed if elapsed > 0 else 1
        rem = (len(todo) - i) / rate
        print(f"  [{i}/{len(todo)}] ok={ok_count} err={len(err_list)} — {elapsed/60:.1f}min, ~{rem/60:.0f}min restantes", flush=True)

# ── RESULTADO FINAL ────────────────────────────────────────────────────────────
print("\nResultado final:", flush=True)
audit = supa(f"pbp_audit_log?select=status,diff_pts&season_id=eq.{SEASON}&limit=500")
c = Counter(r['status'] for r in audit)
max_diff = max((abs(r.get('diff_pts') or 0) for r in audit), default=0)
poss    = supa_count('pbp_possessions')
players = supa_count('pbp_player_game_stats')
lineup  = supa_count('pbp_lineup_stats')
print(f"  audit: ok={c.get('ok',0)} err={c.get('error',0)} total={len(audit)}/448", flush=True)
print(f"  max_diff: {max_diff} {'✅' if max_diff==0 else '❌'}", flush=True)
print(f"  poss={poss} players={players} lineup={lineup}", flush=True)
if err_list:
    print(f"  Timeouts/errores: {err_list}", flush=True)
print("DONE", flush=True)
