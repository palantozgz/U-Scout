#!/usr/bin/env python3
"""Monitoriza el procesado del partido 2 en tiempo real."""
import urllib.request, json, time

SK   = [l.split('=',1)[1].strip() for l in open('/Users/palant/Downloads/U scout/.env').read().splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY=')][0]
SUPA = 'https://ybpzvkkxcmwwxrrouyhm.supabase.co'
H    = {'apikey': SK, 'Authorization': f'Bearer {SK}', 'Prefer': 'count=exact'}
RAILWAY = 'https://u-scout-production.up.railway.app'

def cnt(table, where='game_id=eq.2'):
    req = urllib.request.Request(f"{SUPA}/rest/v1/{table}?select=id&{where}", headers=H)
    cr  = urllib.request.urlopen(req, timeout=10).headers.get('content-range', '*/0')
    return cr.split('/')[-1]

# Borrar partido 2 de todas las tablas
for t in ['pbp_possessions','pbp_player_game_stats','pbp_lineup_stats','pbp_audit_log']:
    req = urllib.request.Request(f"{SUPA}/rest/v1/{t}?game_id=eq.2",
        headers={**H, 'Prefer': 'return=minimal'}, method='DELETE')
    r = urllib.request.urlopen(req, timeout=10)
    print(f"DELETE {t}: HTTP {r.status}")

# Disparar procesado
req = urllib.request.Request(f"{RAILWAY}/api/stats/admin/process-game/2?seasonId=2092",
    method='POST', headers={'Content-Type': 'application/json'})
r   = urllib.request.urlopen(req, timeout=15)
print(f"\nPOST process-game/2: {r.read().decode()}")

# Monitorizar
t0 = time.time()
for wait in [8, 15, 25, 40, 60, 90]:
    time.sleep(wait - (time.time() - t0) if wait > (time.time() - t0) else 0)
    t0r = time.time() - t0
    p = cnt('pbp_possessions')
    pl = cnt('pbp_player_game_stats')
    lu = cnt('pbp_lineup_stats')
    au = cnt('pbp_audit_log')
    print(f"  t+{t0r:.0f}s: poss={p} players={pl} lineup={lu} audit={au}")
    if int(au) >= 2:
        print("  ✅ Audit completo")
        break

print("DONE")
