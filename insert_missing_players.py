
import urllib.request, json

sk = open('/tmp/sk.txt').read().strip()
supa = 'https://ybpzvkkxcmwwxrrouyhm.supabase.co/rest/v1'
h = {'apikey': sk, 'Authorization': 'Bearer ' + sk, 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates'}

team_map = {
    '723': 12, '726': 11, '4900': 3, '21956': 8,
    '729': 4, '20054': 9, '4913': 10, '710': 2,
}
team_short = {
    '723': '山西', '726': '武汉', '4900': '四川', '21956': '山东',
    '729': '陕西', '20054': '北京', '4913': '新疆', '710': '江苏',
}
player_ext_team = {
    '403870': '', '416140': '723', '452513': '723', '454177': '723',
    '461023': '726', '468561': '4900', '492623': '', '515858': '',
    '516656': '', '516981': '', '518128': '21956', '518165': '729',
    '518419': '4900', '518835': '20054', '518934': '4913',
    '520058': '20054', '520931': '', '522263': '710', '525540': '',
}

records = []
for pid, ext_tid in player_ext_team.items():
    short = team_short.get(ext_tid, '')
    name_zh = f"{short}#{pid[-4:]}" if short else f"球员#{pid[-4:]}"
    name_en = f"Player #{pid[-4:]}"
    records.append({
        'external_id': pid,
        'name_zh': name_zh,
        'name_en': name_en,
        'is_foreign': False,
        'team_id': team_map.get(ext_tid) if ext_tid else None,
    })

req = urllib.request.Request(
    supa + '/stats_players',
    data=json.dumps(records).encode(),
    headers=h,
    method='POST'
)
try:
    resp = urllib.request.urlopen(req)
    print('OK', resp.status, '— inserted', len(records), 'players')
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print('ERROR', e.code, body[:500])
