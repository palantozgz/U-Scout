#!/usr/bin/env python3
"""
U Scout — Profile translation patch
Adds translateOutput() helper that converts stored keys back to translated strings.
Handles both static keys ("def_screen_roll") and dynamic ("for_direction|weak=left|wl=floater")

Run from project root: python3 patch_profile_translate.py
"""
import sys, re

filepath = "client/src/pages/player/Profile.tsx"
try:
    with open(filepath) as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: {filepath} not found")
    sys.exit(1)

# ── Add translateOutput helper after imports ──────────────────────────────────
translate_helper = '''
// ─── translateOutput ──────────────────────────────────────────────────────────
// Converts motor output keys to translated strings at render time.
// Static key:  "def_screen_roll" → t("def_screen_roll")
// Dynamic key: "for_direction|weak=left|wl=floater" → t("for_direction", {weak:"left", wl:"floater"})
// Fallback:    if key not in i18n, display as-is (backwards compatible with old saved data)
function translateOutput(item: string, tFn: (key: any) => string): string {
  if (!item) return item;
  // Check if it\'s a serialized dynamic key
  if (item.includes("|")) {
    const [key, ...paramParts] = item.split("|");
    const params: Record<string, string> = {};
    paramParts.forEach(p => {
      const [k, v] = p.split("=");
      if (k && v !== undefined) params[k] = v;
    });
    let s = tFn(key);
    // If t() returned the key itself, it\'s not in i18n — show raw
    if (s === key) return item;
    Object.entries(params).forEach(([k, v]) => {
      s = s.replace(new RegExp(`\\\\{${k}\\\\}`, "g"), v);
    });
    return s;
  }
  // Static key
  const translated = tFn(item);
  // If t() returned the key itself, it\'s not in i18n — show raw
  return translated === item ? item : translated;
}

'''

# Insert after the last import line
last_import = content.rfind('\nimport ')
if last_import != -1:
    insert_pos = content.find('\n', last_import + 1) + 1
    content = content[:insert_pos] + translate_helper + content[insert_pos:]
    print("✅ Added translateOutput helper")
else:
    print("⚠️  Could not find import block")

# ── Update getTraits to use translateOutput ───────────────────────────────────
old_get_traits = '''  const getTraits = (arr: any[] = []) =>
    arr.map((t: any) => typeof t === "string" ? t : t?.value).filter(Boolean) as string[];'''

new_get_traits = '''  const getTraits = (arr: any[] = []) =>
    arr.map((item: any) => {
      const raw = typeof item === "string" ? item : item?.value;
      return raw ? translateOutput(raw, t) : null;
    }).filter(Boolean) as string[];'''

content = content.replace(old_get_traits, new_get_traits)
print("✅ Updated getTraits to use translateOutput")

# ── Update defensivePlan arrays to use translateOutput ────────────────────────
old_plan = '''  const defender = dp.defender ?? [];
  const forzar   = dp.forzar   ?? [];
  const concede  = dp.concede  ?? [];'''

new_plan = '''  const defender = (dp.defender ?? []).map(s => translateOutput(s, t));
  const forzar   = (dp.forzar   ?? []).map(s => translateOutput(s, t));
  const concede  = (dp.concede  ?? []).map(s => translateOutput(s, t));'''

content = content.replace(old_plan, new_plan)
print("✅ Updated defensivePlan arrays to translate at render")

with open(filepath, 'w') as f:
    f.write(content)

print("\nDone. Profile now translates outputs at render time.")
print("Changing language in Settings will show outputs in new language immediately.")
