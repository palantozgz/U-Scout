#!/usr/bin/env python3
"""
Reprocesa todos los partidos en Railway para recalcular plus_minus real.
Usa el endpoint sin auth: POST /api/stats/admin/process-game/:gameId
"""
import json, time, urllib.request, urllib.error

RAILWAY = "https://u-scout-production.up.railway.app"
GAME_IDS = [r['id'] for r in json.load(open('/tmp/game_ids.json'))]

print(f"Reprocesando {len(GAME_IDS)} partidos...")
ok, err = 0, 0

for i, gid in enumerate(GAME_IDS):
    url = f"{RAILWAY}/api/stats/admin/process-game/{gid}?seasonId=2092"
    try:
        req = urllib.request.Request(url, method='POST')
        with urllib.request.urlopen(req, timeout=10) as r:
            body = json.loads(r.read())
            if body.get('ok'):
                ok += 1
            else:
                print(f"  WARN game {gid}: {body}")
                err += 1
    except Exception as e:
        print(f"  ERROR game {gid}: {e}")
        err += 1

    # Log cada 20 partidos
    if (i + 1) % 20 == 0:
        print(f"  {i+1}/{len(GAME_IDS)} dispatched — ok={ok} err={err}")

    # Rate limit: no saturar Railway (proceso es async en el servidor)
    time.sleep(0.15)

print(f"\nDispatched: ok={ok} err={err}")
print("Railway procesa en background — esperar ~5 min antes de verificar audit.")
