# Report — limpieza pendiente (revisión futura)

Última actualización: 2026-04-20. Este documento recoge **dudas y candidatos** tras restaurar scripts necesarios y eliminar archivos claramente huérfanos.

---

## Hecho en esta ronda

### Restaurado (desde `archive/pre-repo-cleanup-2026-04-18`)

- `scripts/regenerate-spanish-gender-bundles.mjs` — usado por `npm run i18n:regen-gender-bundles`; alimenta los `generated*GenderI18n.ts`.
- `scripts/test-motor.ts` — usado por `npm run motor:test`.

### Eliminado con criterio claro

- `vite-plugin-meta-images.ts` — no estaba registrado en `vite.config.ts` (resto de integración Replit/OpenGraph).
- `client/src/pages/Home.tsx` — ninguna ruta en `App.tsx` ni imports; landing muerta.
- `scripts/test-renderer.ts` — utilidad local sin referencias en el repo.

---

## Pendiente — componentes UI (shadcn) probablemente no usados en app

Los siguientes **no aparecen importados** desde `pages/`, `App.tsx` ni `components/ApprovalBar.tsx`. Parte del árbol solo se referencia entre sí (p. ej. `sidebar` → `skeleton`). **No implica** que ocupen bundle si nadie los importa (tree-shaking), pero **sí** ruido en el repo y mantenimiento.

Candidatos a auditar con [knip](https://github.com/webpro/knip) o búsqueda por imports antes de borrar:

- `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `breadcrumb`, `calendar`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `drawer`, `empty`, `field`, `form`, `hover-card`, `input-group`, `input-otp`, `item`, `kbd`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `separator` (solo interno), `skeleton`, `slider`, `sonner`, `spinner`, `table`, `textarea` (solo vía `input-group`), `toggle`, `toggle-group`, `button-group`, `sidebar`, etc.

**Recomendación:** no borrar en bloque hasta confirmar que no los añadiréis con `shadcn` ni usáis en ramas locales. Si se poda, hacer commit pequeño y `npm run check`.

---

## Pendiente — artefactos y documentación en `scripts/`

| Archivo | Notas |
|--------|--------|
| `scripts/audit-output.txt` | Salida de auditoría manual; puede quedar versionada o moverse a CI artefacto. |
| `scripts/motor-audit.md` | Notas; revisar si sigue alineado con el motor actual. |
| `scripts/calibration-results.json` | Resultados de calibración; útil para regresiones; revisar si debe ignorarse en git o actualizarse solo en CI. |
| `scripts/test-profiles.json` | Datos de prueba; confirmar uso desde `calibrate-motor.ts` / tests. |

---

## Pendiente — alias y carpetas

- En `vite.config.ts` existe alias `@assets` → `attached_assets`; en el repo **no hay** carpeta `attached_assets` (alias muerto o pendiente de crear / eliminar alias).

---

## Pendiente — seguridad / configuración

- El script `dev` en `package.json` incluye **URLs y claves** en línea (Supabase, DB). Conviene migrar a `.env` y no commitear secretos (revisión aparte).

---

## Rama de respaldo histórica

- `archive/pre-repo-cleanup-2026-04-18` — árbol anterior a la limpieza masiva de scripts; útil para recuperar archivos puntuales.
