#!/usr/bin/env python3
"""
1. Adds archetype + section title keys to i18n.ts
2. Patches mock-data.ts to store archetype keys instead of English strings
Run from project root: python3 patch_archetypes.py
"""
import sys

# ── Archetype key map ─────────────────────────────────────────────────────────
ARCHETYPE_MAP = {
    "Role Player":            "arch_role_player",
    "Versatile Big":          "arch_versatile_big",
    "Multi-Level Scorer":     "arch_multi_level_scorer",
    "Playmaking Big":         "arch_playmaking_big",
    "Stretch Big":            "arch_stretch_big",
    "Traditional Post Scorer":"arch_traditional_post_scorer",
    "Low Post Scorer":        "arch_low_post_scorer",
    "Inside-Out Threat":      "arch_inside_out_threat",
    "Offensive Engine":       "arch_offensive_engine",
    "Isolation Driver":       "arch_isolation_driver",
    "Isolation Scorer":       "arch_isolation_scorer",
    "Shot Creator":           "arch_shot_creator",
    "Combo Guard":            "arch_combo_guard",
    "PnR Maestro":            "arch_pnr_maestro",
    "PnR Shooter":            "arch_pnr_shooter",
    "PnR Creator":            "arch_pnr_creator",
    "Roll Man / Lob Threat":  "arch_roll_lob_threat",
    "Pick & Pop Wing":        "arch_pick_pop_wing",
    "Short Roll Big":         "arch_short_roll_big",
    "Slip Threat":            "arch_slip_threat",
    "Movement Shooter":       "arch_movement_shooter",
    "Spot-up Shooter":        "arch_spotup_shooter",
    "Cutting Threat":         "arch_cutting_threat",
    "3&D Wing":               "arch_3d_wing",
    "Connector":              "arch_connector",
    "Complementary Piece":    "arch_complementary_piece",
}

# ── Translations ──────────────────────────────────────────────────────────────
EN = {
    "arch_role_player":             "Role Player",
    "arch_versatile_big":           "Versatile Big",
    "arch_multi_level_scorer":      "Multi-Level Scorer",
    "arch_playmaking_big":          "Playmaking Big",
    "arch_stretch_big":             "Stretch Big",
    "arch_traditional_post_scorer": "Traditional Post Scorer",
    "arch_low_post_scorer":         "Low Post Scorer",
    "arch_inside_out_threat":       "Inside-Out Threat",
    "arch_offensive_engine":        "Offensive Engine",
    "arch_isolation_driver":        "Isolation Driver",
    "arch_isolation_scorer":        "Isolation Scorer",
    "arch_shot_creator":            "Shot Creator",
    "arch_combo_guard":             "Combo Guard",
    "arch_pnr_maestro":             "PnR Maestro",
    "arch_pnr_shooter":             "PnR Shooter",
    "arch_pnr_creator":             "PnR Creator",
    "arch_roll_lob_threat":         "Roll Man / Lob Threat",
    "arch_pick_pop_wing":           "Pick & Pop Wing",
    "arch_short_roll_big":          "Short Roll Big",
    "arch_slip_threat":             "Slip Threat",
    "arch_movement_shooter":        "Movement Shooter",
    "arch_spotup_shooter":          "Spot-up Shooter",
    "arch_cutting_threat":          "Cutting Threat",
    "arch_3d_wing":                 "3&D Wing",
    "arch_connector":               "Connector",
    "arch_complementary_piece":     "Complementary Piece",
    # Section titles
    "section_post":                 "Post & Interior Game",
    "section_iso":                  "Isolation Tendencies",
    "section_pnr":                  "Pick & Roll",
    "section_offball":              "Off-Ball",
    # Direction buttons
    "dir_left":                     "Left",
    "dir_right":                    "Right",
    "dir_balanced":                 "Balanced",
}

ES = {
    "arch_role_player":             "Rol Secundario",
    "arch_versatile_big":           "Interior Versátil",
    "arch_multi_level_scorer":      "Anotador Multinivel",
    "arch_playmaking_big":          "Interior Organizador",
    "arch_stretch_big":             "Interior Abierto",
    "arch_traditional_post_scorer": "Poste Tradicional",
    "arch_low_post_scorer":         "Anotador de Poste Bajo",
    "arch_inside_out_threat":       "Amenaza Interior-Exterior",
    "arch_offensive_engine":        "Motor Ofensivo",
    "arch_isolation_driver":        "Penetrador ISO",
    "arch_isolation_scorer":        "Anotador ISO",
    "arch_shot_creator":            "Creador de Tiro",
    "arch_combo_guard":             "Combo Guard",
    "arch_pnr_maestro":             "Maestro del Bloqueo",
    "arch_pnr_shooter":             "Tirador en Bloqueo",
    "arch_pnr_creator":             "Creador en Bloqueo",
    "arch_roll_lob_threat":         "Amenaza de Lob",
    "arch_pick_pop_wing":           "Alero Pick & Pop",
    "arch_short_roll_big":          "Interior Short Roll",
    "arch_slip_threat":             "Amenaza de Slip",
    "arch_movement_shooter":        "Tirador en Movimiento",
    "arch_spotup_shooter":          "Tirador Estático",
    "arch_cutting_threat":          "Amenaza de Corte",
    "arch_3d_wing":                 "Alero 3&D",
    "arch_connector":               "Conector",
    "arch_complementary_piece":     "Pieza Complementaria",
    "section_post":                 "Poste y Juego Interior",
    "section_iso":                  "Tendencias ISO",
    "section_pnr":                  "Bloqueo Directo",
    "section_offball":              "Sin Balón",
    "dir_left":                     "Izquierda",
    "dir_right":                    "Derecha",
    "dir_balanced":                 "Equilibrado",
}

ZH = {
    "arch_role_player":             "角色球员",
    "arch_versatile_big":           "全能内线",
    "arch_multi_level_scorer":      "多层次得分手",
    "arch_playmaking_big":          "组织型内线",
    "arch_stretch_big":             "拉开型内线",
    "arch_traditional_post_scorer": "传统低位得分手",
    "arch_low_post_scorer":         "低位得分手",
    "arch_inside_out_threat":       "内外兼顾威胁",
    "arch_offensive_engine":        "进攻引擎",
    "arch_isolation_driver":        "单打突破手",
    "arch_isolation_scorer":        "单打得分手",
    "arch_shot_creator":            "创造投篮机会者",
    "arch_combo_guard":             "双能卫",
    "arch_pnr_maestro":             "挡拆大师",
    "arch_pnr_shooter":             "挡拆投手",
    "arch_pnr_creator":             "挡拆创造者",
    "arch_roll_lob_threat":         "下顺/高抛威胁",
    "arch_pick_pop_wing":           "挡拆弹出侧翼",
    "arch_short_roll_big":          "短顺内线",
    "arch_slip_threat":             "提前溜走威胁",
    "arch_movement_shooter":        "移动投手",
    "arch_spotup_shooter":          "定点投手",
    "arch_cutting_threat":          "切入威胁",
    "arch_3d_wing":                 "3&D侧翼",
    "arch_connector":               "连接者",
    "arch_complementary_piece":     "角色互补球员",
    "section_post":                 "低位与内线进攻",
    "section_iso":                  "单打倾向",
    "section_pnr":                  "掩护配合",
    "section_offball":              "无球跑动",
    "dir_left":                     "左",
    "dir_right":                    "右",
    "dir_balanced":                 "均衡",
}

# ── 1. Patch i18n.ts ──────────────────────────────────────────────────────────
i18n_path = "client/src/lib/i18n.ts"
with open(i18n_path) as f:
    i18n = f.read()

def make_block(d):
    return "\n" + "\n".join(f'  {k}: "{v}",' for k, v in d.items()) + "\n  "

i18n = i18n.replace('settings_title: "Settings",',  make_block(EN) + 'settings_title: "Settings",')
i18n = i18n.replace('settings_title: "Ajustes",',   make_block(ES) + 'settings_title: "Ajustes",')
i18n = i18n.replace('settings_title: "设置",',       make_block(ZH) + 'settings_title: "设置",')

with open(i18n_path, 'w') as f:
    f.write(i18n)
print(f"✅ i18n.ts updated: {i18n.count(chr(10))} lines")

# ── 2. Patch mock-data.ts — replace archetype strings with keys ───────────────
motor_path = "client/src/lib/mock-data.ts"
with open(motor_path) as f:
    motor = f.read()

for string, key in ARCHETYPE_MAP.items():
    motor = motor.replace(f'mainArchetype = "{string}"', f'mainArchetype = "{key}"')
    motor = motor.replace(f"mainArchetype = '{string}'", f"mainArchetype = '{key}'")

# Also patch the guard rails that use string comparisons
for string, key in ARCHETYPE_MAP.items():
    motor = motor.replace(f'mainArchetype === "{string}"', f'mainArchetype === "{key}"')
    motor = motor.replace(f'mainArchetype === \'{string}\'', f"mainArchetype === '{key}'")

with open(motor_path, 'w') as f:
    f.write(motor)
print(f"✅ mock-data.ts updated: {motor.count(chr(10))} lines")

# Verify
count = sum(1 for s in ARCHETYPE_MAP.values() if f'"{s}"' in motor)
remaining = [s for s in ARCHETYPE_MAP.keys() if f'"{s}"' in motor]
print(f"✅ Archetype keys replaced: {len(ARCHETYPE_MAP) - len(remaining)}/{len(ARCHETYPE_MAP)}")
if remaining:
    print(f"⚠️  Still as strings: {remaining[:5]}")
