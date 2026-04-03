#!/usr/bin/env python3
import sys

filepath = "client/src/lib/i18n.ts"
try:
    with open(filepath) as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: {filepath} not found")
    sys.exit(1)

en_keys = """
  section_offball_activity: "Off-Ball Activity",
  left_wing: "Left Wing",
  right_wing: "Right Wing",
  center_court: "center court",
  left_block: "LEFT BLOCK",
  right_block_label: "RIGHT BLOCK",
  block_right_baseline: "Right block → Baseline",
  block_right_middle: "Right block → Middle",
  block_left_baseline: "Left block → Baseline",
  block_left_middle: "Left block → Middle",
  top_view_label: "TOP VIEW — PLAYER'S BACK TO THE BASELINE",
"""

es_keys = """
  section_offball_activity: "Actividad Sin Balón",
  left_wing: "Ala Izquierda",
  right_wing: "Ala Derecha",
  center_court: "centro del campo",
  left_block: "BLOQUE IZQ",
  right_block_label: "BLOQUE DER",
  block_right_baseline: "Bloque der → Línea de fondo",
  block_right_middle: "Bloque der → Centro",
  block_left_baseline: "Bloque izq → Línea de fondo",
  block_left_middle: "Bloque izq → Centro",
  top_view_label: "VISTA SUPERIOR — ESPALDA A LA LÍNEA DE FONDO",
"""

zh_keys = """
  section_offball_activity: "无球跑动",
  left_wing: "左侧翼",
  right_wing: "右侧翼",
  center_court: "中场方向",
  left_block: "左侧低位",
  right_block_label: "右侧低位",
  block_right_baseline: "右侧低位 → 底线",
  block_right_middle: "右侧低位 → 中路",
  block_left_baseline: "左侧低位 → 底线",
  block_left_middle: "左侧低位 → 中路",
  top_view_label: "俯视图 — 球员背对底线",
"""

def insert_before(text, marker, new_keys):
    if marker in text:
        return text.replace(marker, new_keys.strip() + "\n  " + marker)
    print(f"WARNING: marker not found: {marker[:40]}")
    return text

content = insert_before(content, 'settings_title: "Settings",', en_keys)
content = insert_before(content, 'settings_title: "Ajustes",', es_keys)
content = insert_before(content, 'settings_title: "设置",', zh_keys)

with open(filepath, 'w') as f:
    f.write(content)

with open(filepath) as f:
    check = f.read()

print(f"Done: {check.count(chr(10))} lines")
print(f"section_offball_activity in 3 langs: {check.count('section_offball_activity:')}")
