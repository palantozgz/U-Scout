#!/usr/bin/env python3
"""Fix 3: plus_minus — usar stats_player_boxscores en game logs."""

path = "/Users/palant/Downloads/U scout/ucore/server/routes.ts"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ── Fix A: /api/stats/games endpoint ─────────────────────────────────────────
old_a = (
    '        pgs.plus_minus                                AS "plusMinus"\n'
    '      FROM pbp_player_game_stats pgs\n'
    '      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}\n'
    '      JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id\n'
    '      LEFT JOIN stats_teams st ON st.id = pgs.team_id\n'
    '      JOIN stats_teams own ON own.id = pgs.team_id\n'
    '      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id\n'
    '      LEFT JOIN stats_teams at ON at.id = sg.away_team_id'
)
new_a = (
    '        COALESCE(spb.plus_minus, pgs.plus_minus)      AS "plusMinus"\n'
    '      FROM pbp_player_game_stats pgs\n'
    '      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}\n'
    '      JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id\n'
    '      LEFT JOIN stats_teams st ON st.id = pgs.team_id\n'
    '      JOIN stats_teams own ON own.id = pgs.team_id\n'
    '      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id\n'
    '      LEFT JOIN stats_teams at ON at.id = sg.away_team_id\n'
    '      LEFT JOIN stats_player_boxscores spb ON spb.game_id = pgs.game_id AND spb.player_external_id::text = pgs.player_external_id'
)
n_a = content.count(old_a)
print(f"Fix A occurrences: {n_a}")
assert n_a == 1
content = content.replace(old_a, new_a, 1)

# ── Fix B: /api/stats/player/:id game log ─────────────────────────────────────
old_b = (
    '        pgs.plus_minus       AS "plusMinus",\n'
    '        pgs.is_starter       AS "isStart",\n'
    '        (own.id = sg.home_team_id) AS "isHome"\n'
    '      FROM pbp_player_game_stats pgs\n'
    '      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}\n'
    '      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id\n'
    '      LEFT JOIN stats_teams at ON at.id = sg.away_team_id\n'
    '      JOIN stats_teams own ON own.id = pgs.team_id\n'
    '      WHERE pgs.player_external_id = ${externalId}'
)
new_b = (
    '        COALESCE(spb2.plus_minus, pgs.plus_minus) AS "plusMinus",\n'
    '        pgs.is_starter       AS "isStart",\n'
    '        (own.id = sg.home_team_id) AS "isHome"\n'
    '      FROM pbp_player_game_stats pgs\n'
    '      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}\n'
    '      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id\n'
    '      LEFT JOIN stats_teams at ON at.id = sg.away_team_id\n'
    '      JOIN stats_teams own ON own.id = pgs.team_id\n'
    '      LEFT JOIN stats_player_boxscores spb2 ON spb2.game_id = pgs.game_id AND spb2.player_external_id::text = pgs.player_external_id\n'
    '      WHERE pgs.player_external_id = ${externalId}'
)
n_b = content.count(old_b)
print(f"Fix B occurrences: {n_b}")
assert n_b == 1
content = content.replace(old_b, new_b, 1)

# ── Fix C: /api/stats/players/all-detail game log ────────────────────────────
old_c = (
    '          pgs.plus_minus AS "plusMinus",\n'
    '          pgs.is_starter AS "isStart",\n'
    '          CASE WHEN pgs.seconds_played > 0 THEN LPAD((pgs.seconds_played / 60)::text, 1, \'0\') || \':\' || LPAD((pgs.seconds_played % 60)::text, 2, \'0\') ELSE NULL END AS minutes,\n'
    '          sg.home_score AS "homeScore", sg.away_score AS "awayScore",\n'
    '          ROW_NUMBER() OVER (PARTITION BY pgs.player_external_id ORDER BY sg.scheduled_at DESC) AS rn\n'
    '        FROM pbp_player_game_stats pgs\n'
    '        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}\n'
    '        JOIN stats_teams rival ON (\n'
    '          CASE WHEN sg.home_team_id = pgs.team_id THEN sg.away_team_id ELSE sg.home_team_id END = rival.id\n'
    '        )\n'
    '        WHERE pgs.phase_type = ${phaseType}'
)
new_c = (
    '          COALESCE(spb3.plus_minus, pgs.plus_minus) AS "plusMinus",\n'
    '          pgs.is_starter AS "isStart",\n'
    '          CASE WHEN pgs.seconds_played > 0 THEN LPAD((pgs.seconds_played / 60)::text, 1, \'0\') || \':\' || LPAD((pgs.seconds_played % 60)::text, 2, \'0\') ELSE NULL END AS minutes,\n'
    '          sg.home_score AS "homeScore", sg.away_score AS "awayScore",\n'
    '          ROW_NUMBER() OVER (PARTITION BY pgs.player_external_id ORDER BY sg.scheduled_at DESC) AS rn\n'
    '        FROM pbp_player_game_stats pgs\n'
    '        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}\n'
    '        JOIN stats_teams rival ON (\n'
    '          CASE WHEN sg.home_team_id = pgs.team_id THEN sg.away_team_id ELSE sg.home_team_id END = rival.id\n'
    '        )\n'
    '        LEFT JOIN stats_player_boxscores spb3 ON spb3.game_id = pgs.game_id AND spb3.player_external_id::text = pgs.player_external_id\n'
    '        WHERE pgs.phase_type = ${phaseType}'
)
n_c = content.count(old_c)
print(f"Fix C occurrences: {n_c}")
assert n_c == 1
content = content.replace(old_c, new_c, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Los 3 fixes de plus_minus aplicados.")

# Verify
with open(path, 'r', encoding='utf-8') as f:
    v = f.read()
print("Verify A:", "COALESCE(spb.plus_minus" in v)
print("Verify B:", "COALESCE(spb2.plus_minus" in v)
print("Verify C:", "COALESCE(spb3.plus_minus" in v)
