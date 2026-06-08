import urllib.request, urllib.parse, json

url = "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
with open('/tmp/sk.txt') as f:
    key = f.read().strip()

headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# Find Inner Mongolia team
req = urllib.request.Request(
    url + "/rest/v1/stats_teams?select=id,external_id,name_zh,name_en&limit=20",
    headers=headers
)
with urllib.request.urlopen(req) as r:
    teams = json.loads(r.read())
    for t in teams:
        print(t)

# Check clubs table to find the club
req2 = urllib.request.Request(
    url + "/rest/v1/clubs?select=id,name,competition_id&limit=5",
    headers=headers
)
with urllib.request.urlopen(req2) as r:
    clubs = json.loads(r.read())
    print("\nClubs:", clubs)
