
import urllib.request, json

sk = open('/tmp/sk.txt').read().strip()
missing = ['403870','416140','452513','454177','461023','468561','492623','515858','516656','516981','518128','518165','518419','518835','518934','520058','520931','522263','525540']

req = urllib.request.Request(
  'https://ybpzvkkxcmwwxrrouyhm.supabase.co/rest/v1/stats_player_boxscores?player_external_id=in.(' + ','.join(missing) + ')&select=player_external_id,team_external_id&limit=50',
  headers={'apikey': sk, 'Authorization': 'Bearer ' + sk}
)
rows = json.loads(urllib.request.urlopen(req).read())

team_ids = list({r['team_external_id'] for r in rows if r['team_external_id']})
req2 = urllib.request.Request(
  'https://ybpzvkkxcmwwxrrouyhm.supabase.co/rest/v1/stats_teams?external_id=in.(' + ','.join(str(t) for t in team_ids) + ')&select=external_id,name_zh,name_en',
  headers={'apikey': sk, 'Authorization': 'Bearer ' + sk}
)
teams = {str(t['external_id']): t for t in json.loads(urllib.request.urlopen(req2).read())}

player_team = {}
for r in rows:
    pid = r['player_external_id']
    tid = r['team_external_id']
    if pid not in player_team:
        player_team[pid] = str(tid) if tid else ''

vals = []
for pid in missing:
    tid = player_team.get(pid, '')
    team_zh = teams.get(tid, {}).get('name_zh', '') if tid else ''
    team_short = team_zh[:2] if team_zh else ''
    name_zh = f"{team_short}#{pid[-4:]}" if team_short else f"球员#{pid[-4:]}"
    name_en = f"Player #{pid[-4:]}"
    vals.append(f"  ('{pid}', '{name_zh}', '{name_en}', '{tid}')")

sql = "INSERT INTO stats_players (external_id, name_zh, name_en, team_external_id)\nVALUES\n"
sql += ',\n'.join(vals)
sql += "\nON CONFLICT (external_id) DO NOTHING;"
print(sql)
