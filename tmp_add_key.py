#!/usr/bin/env python3
"""Add missing schedule_games_count key — use anchor that exists in all 3 locales"""

def add_after(path, anchor, new_line):
    with open(path) as f:
        content = f.read()
    if 'schedule_games_count' in content:
        print(f"Already present in {path.split('/')[-1]}")
        return
    count = content.count(anchor)
    assert count == 1, f"Expected 1 match for anchor in {path}, got {count}"
    content = content.replace(anchor, anchor + '\n' + new_line, 1)
    with open(path, 'w') as f:
        f.write(content)
    print(f"Fixed {path.split('/')[-1]}")

add_after(
    '/Users/palant/Downloads/U scout/ucore/client/src/lib/locales/en.ts',
    '  schedule_games_any: "Games: Any",',
    '  schedule_games_count: "Games in week",'
)
add_after(
    '/Users/palant/Downloads/U scout/ucore/client/src/lib/locales/es.ts',
    '  schedule_games_any: "Partidos: Cualquiera",',
    '  schedule_games_count: "Partidos en semana",'
)
add_after(
    '/Users/palant/Downloads/U scout/ucore/client/src/lib/locales/zh.ts',
    '  schedule_games_any: "比赛: 任意",',
    '  schedule_games_count: "本周比赛数",'
)
