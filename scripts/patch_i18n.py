path = '/Users/palant/Downloads/U scout/client/src/lib/i18n.ts'
with open(path, 'r') as f:
    content = f.read()

# ── Bloque EN ──────────────────────────────────────────────────────────────────
# Insertar slides_* antes de report_how_attacks EN
content = content.replace(
    '  report_how_attacks: "How they attack",',
    '  slides_who_is: "Who are they",\n  slides_what_will_do: "What will they do",\n  slides_what_do_i: "What do I do",\n  report_how_attacks: "How they attack",'
)

# Insertar editor_save_inputs / editor_inputs_saved / editor_back_to_report EN
# La clave save existe justo antes de cancel
content = content.replace(
    '  save: "Save",\n  cancel:',
    '  save: "Save",\n  editor_save_inputs: "Save",\n  editor_inputs_saved: "Inputs saved",\n  editor_back_to_report: "Report",\n  cancel:'
)

# ── Bloque ES ──────────────────────────────────────────────────────────────────
content = content.replace(
    '  report_how_attacks: "C\u00f3mo ataca",',
    '  slides_who_is: "\u00bfQui\u00e9n es?",\n  slides_what_will_do: "\u00bfQu\u00e9 har\u00e1?",\n  slides_what_do_i: "\u00bfQu\u00e9 hago yo?",\n  report_how_attacks: "C\u00f3mo ataca",'
)

content = content.replace(
    '  save: "Guardar",\n  cancel:',
    '  save: "Guardar",\n  editor_save_inputs: "Guardar",\n  editor_inputs_saved: "Inputs guardados",\n  editor_back_to_report: "Informe",\n  cancel:'
)

# ── Bloque ZH ──────────────────────────────────────────────────────────────────
content = content.replace(
    '  report_how_attacks: "\u8fdb\u653b\u7279\u70b9",',
    '  slides_who_is: "\u5979\u662f\u8c01",\n  slides_what_will_do: "\u5979\u4f1a\u505a\u4ec0\u4e48",\n  slides_what_do_i: "\u6211\u8be5\u600e\u4e48\u505a",\n  report_how_attacks: "\u8fdb\u653b\u7279\u70b9",'
)

content = content.replace(
    '  save: "\u4fdd\u5b58",\n  cancel:',
    '  save: "\u4fdd\u5b58",\n  editor_save_inputs: "\u4fdd\u5b58",\n  editor_inputs_saved: "\u5df2\u4fdd\u5b58",\n  editor_back_to_report: "\u62a5\u544a",\n  cancel:'
)

with open(path, 'w') as f:
    f.write(content)

# Verificar
import subprocess
result = subprocess.run(
    ['grep', '-c', 'slides_who_is\|editor_save_inputs\|editor_inputs_saved'],
    capture_output=True, text=True, input=content
)
checks = ['slides_who_is', 'editor_save_inputs', 'editor_inputs_saved', 'editor_back_to_report']
for k in checks:
    count = content.count(k)
    status = 'OK(3)' if count == 3 else f'ERROR({count})'
    print(f'{status}: {k}')

print('DONE')
