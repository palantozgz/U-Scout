#!/usr/bin/env python3
"""
U Scout — Motor i18n patch
Run from project root: python3 patch_motor.py
Adds tm()/tmp() translation helpers and replaces all hardcoded output strings.
"""
import re, sys

filepath = "client/src/lib/mock-data.ts"
try:
    with open(filepath, "r") as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: {filepath} not found. Run from project root.")
    sys.exit(1)

# 1. Add translation helpers after first import line
tm_helpers = '''// Motor translation helpers — tm() static, tmp() with params
import { t as tm_raw } from "./i18n";
const tm = (key: string): string => tm_raw(key as any);
const tmp = (key: string, params: Record<string, string>): string => {
  let s = tm_raw(key as any);
  Object.entries(params).forEach(([k, v]) => { s = s.replace(new RegExp("{" + k + "}", "g"), v); });
  return s;
};
'''
if 'const tm = ' not in content:
    content = content.replace(
        'import { apiRequest } from "./queryClient";',
        'import { apiRequest } from "./queryClient";\n' + tm_helpers
    )
    print("✅ Added tm/tmp helpers")
else:
    print("⏭  tm/tmp helpers already present")

# 2. Static string replacements
static_replacements = [
    # DEFENDER
    ('defender.push("Meet at the elbow. No free catches at the high post — body up before the catch.");',
     'defender.push(tm("def_high_post_meet"));'),
    ('defender.push("Use your most physical defender. Soft coverage loses every time in the post.");',
     'defender.push(tm("def_post_physical"));'),
    ('defender.push("Front on the block. Do not allow a catch in position.");',
     'defender.push(tm("def_post_front"));'),
    ('defender.push("No body fouls in the post — elite FT shooter who draws contact.");',
     'defender.push(tm("def_post_no_foul"));'),
    ('defender.push("Stay in front. Gets downhill in one dribble — no reach fouls.");',
     'defender.push(tm("def_iso_stay_front"));'),
    ('defender.push("Pre-shade dominant hand on every closeout — predictable direction.");',
     'defender.push(tm("def_iso_shade_strong"));'),
    ('defender.push("Tight coverage on the catch. Creates off the bounce — no free catches.");',
     'defender.push(tm("def_iso_tight"));'),
    ('defender.push("Go OVER every screen. Under coverage = open shot or open lane.");',
     'defender.push(tm("def_pnr_go_over"));'),
    ('defender.push("Under screens is safe. Pack the paint and eliminate the drive.");',
     'defender.push(tm("def_pnr_under_safe"));'),
    ('defender.push("Pick up full court — drag screens before the defense is organized.");',
     'defender.push(tm("def_pnr_drag"));'),
    ('defender.push("Never over-deny. Every over-play is a backdoor layup.");',
     'defender.push(tm("def_backdoor"));'),
    ('defender.push("Avoid unnecessary contact — elite FT shooter who actively draws fouls.");',
     'defender.push(tm("def_ft_dangerous"));'),
    ('defender.push("Physical contact on post catches is safe — poor FT shooter who rarely draws fouls.");',
     'defender.push(tm("def_hackable"));'),
    ('defender.push("Box out every possession — crashes every shot.");',
     'defender.push(tm("def_orb"));'),
    ('defender.push("High vision player — no open looks nearby. Tag all shooters before the action.");',
     'defender.push(tm("def_vision"));'),
    ('defender.push("No dominant scoring threat. Play honest team defense.");',
     'defender.push(tm("def_no_threat"));'),
    # tagReads in PnR section
    ('"Tag the roll early. Contact before position at the dunker."',
     'tm("def_screen_roll")'),
    ('"Communicate and switch — pops to the arc immediately."',
     'tm("def_screen_pop")'),
    ('"Tag the elbow pop. Two options: shoot or find the cutter."',
     'tm("def_screen_pop_elbow")'),
    ('"Stop at the free throw line. No face-up — contest or switch."',
     'tm("def_screen_short_roll")'),
    ('"Treat every screen as a potential cut — slips early."',
     'tm("def_screen_slip")'),
    ('"Deny the lob — no other option."',
     'tm("def_screen_lob")'),
    # transitionRole map values
    ('"Pick up full court — pushes the moment you give space."',
     'tm("def_trans_pusher")'),
    ('"Deny the outlet catch in transition."',
     'tm("def_trans_outlet")'),
    ('"Sprint back. Beats you to the rim in transition."',
     'tm("def_trans_runner")'),
    ('"Tag the trailer on every made basket."',
     'tm("def_trans_trailer")'),
    # FORZAR static
    ('forzar.push("Force contact — weak finisher in traffic.");',
     'forzar.push(tm("for_weak_finisher"));'),
    ('forzar.push("Push the pace. Not an athlete — struggles in transition.");',
     'forzar.push(tm("for_no_athlete"));'),
    ('forzar.push("Dare them to create 1-on-1 — no self-creation game.");',
     'forzar.push(tm("for_no_iso"));'),
    ('forzar.push("Post touches — no interior game. Sag and help.");',
     'forzar.push(tm("for_no_post"));'),
    ('forzar.push("No clear exploitable weakness. Contest all actions.");',
     'forzar.push(tm("for_no_weakness"));'),
    # CONCEDE static
    ('concede.push("Intentional fouls on post catches are safe — poor FT shooter, rarely draws them.");',
     'concede.push(tm("con_hackable"));'),
    ('concede.push("Avoid unnecessary contact — elite FT shooter who actively seeks fouls.");',
     'concede.push(tm("con_ft_dangerous"));'),
    ('concede.push("No intentional fouls — decent FT shooter.");',
     'concede.push(tm("con_ft_decent"));'),
    ('concede.push("Physical defense acceptable — poor FT shooter.");',
     'concede.push(tm("con_ft_poor"));'),
    ('concede.push("Under screens in PnR — will not punish it.");',
     'concede.push(tm("con_pnr_under"));'),
    ('concede.push("Open catch on the wing — not a catch-and-shoot threat.");',
     'concede.push(tm("con_no_shooter"));'),
    ('concede.push("Post touches — no interior game.");',
     'concede.push(tm("con_no_post"));'),
    ('concede.push("Transition — not a threat in the open floor.");',
     'concede.push(tm("con_no_transition"));'),
    ('concede.push("Sag off at the arc — no perimeter threat.");',
     'concede.push(tm("con_no_perimeter"));'),
]

# Dynamic replacements
dynamic_replacements = [
    # defender dynamic
    ('defender.push(`Deny the ${side} block entry. Front before the catch — dominant there.`);',
     'defender.push(tmp("def_deny_block", { side }));'),
    ('defender.push(`Shade ${internal.dominantSide.toLowerCase()} from the start — almost never goes the other way.`);',
     'defender.push(tmp("def_shade_side", { side: internal.dominantSide.toLowerCase() }));'),
    # forzar dynamic
    ('forzar.push(`Force ${weak} — only a ${wl} on that side.`);',
     'forzar.push(tmp("for_direction", { weak, wl }));'),
    ('forzar.push(`Close out ${better} wing more carefully — more dangerous there. ${worse} wing is safer.`);',
     'forzar.push(tmp("for_closeout_wing", { better, worse }));'),
    ('forzar.push(`Force ${weakBlock} block — no scouted moves there.`);',
     'forzar.push(tmp("for_post_block", { block: weakBlock }));'),
    ('forzar.push(`Force ${weakBlock} block middle — no established move in that quadrant.`);',
     'forzar.push(tmp("for_post_middle", { block: weakBlock }));'),
    ('forzar.push(`Funnel PnR to weaker side — only a ${wl}.`);',
     'forzar.push(tmp("for_pnr_funnel", { wl }));'),
    # concede dynamic
    ('concede.push(`ISO going ${weak} — accept it, it is weaker side.`);',
     'concede.push(tmp("con_iso_weak", { weak }));'),
]

count = 0
not_found = []
for old, new in static_replacements + dynamic_replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1
    else:
        not_found.append(old[:60])

with open(filepath, "w") as f:
    f.write(content)

print(f"✅ Applied {count} replacements")
if not_found:
    print(f"⚠️  {len(not_found)} strings not found (may already be patched):")
    for s in not_found[:5]:
        print(f"   {s}")
print(f"\nDone! Regenerate player profiles to see translations.")
