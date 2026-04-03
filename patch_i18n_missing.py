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
  hybrid_detection_active: "{position} selected — hybrid detection active",
  isolation_tendencies: "Isolation Tendencies",
  offhand_finish_going: "Off-hand finish — going {direction}",
  pnr_primary_option: "Primary option",
  pnr_weaker_option: "Weaker option",
  per_wing_override: "Per-wing override (optional)",
  scouting_reports: "Scouting Reports",
  scouting_reports_subtitle: "Select a matchup to study your opponent.",
  going_left: "left",
  going_right: "right",
  subarchetype_label: "Also:",
"""

es_keys = """
  hybrid_detection_active: "{position} seleccionado — detección híbrida activa",
  isolation_tendencies: "Tendencias ISO",
  offhand_finish_going: "Finalización con mano débil — yendo a {direction}",
  pnr_primary_option: "Opción principal",
  pnr_weaker_option: "Opción débil",
  per_wing_override: "Por ala (opcional)",
  scouting_reports: "Informes de scouting",
  scouting_reports_subtitle: "Selecciona un enfrentamiento para estudiar al rival.",
  going_left: "izquierda",
  going_right: "derecha",
  subarchetype_label: "También:",
"""

zh_keys = """
  hybrid_detection_active: "{position} 已选 — 混合检测激活",
  isolation_tendencies: "单打倾向",
  offhand_finish_going: "弱手终结 — 向{direction}侧",
  pnr_primary_option: "主要选项",
  pnr_weaker_option: "弱侧选项",
  per_wing_override: "按翼区设置（可选）",
  scouting_reports: "球探报告",
  scouting_reports_subtitle: "选择一个对位来研究对手。",
  going_left: "左",
  going_right: "右",
  subarchetype_label: "兼：",
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

count = check.count('hybrid_detection_active:')
print(f"Done: {check.count(chr(10))} lines")
print(f"hybrid_detection_active in {count} languages: {'ok' if count == 3 else 'ERROR'}")
