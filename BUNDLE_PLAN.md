# U CORE — Plan de optimización de bundle para TestFlight

> Creado: 25 abr 2026  
> Estado: planificado, pendiente ejecución (~3 may 2026, cuando vuelvan tokens Cursor)  
> Objetivo: <300 KB gzip (actual: 508.90 KB gzip / 1,836 KB minificado)  
> Prerequisito de: Capacitor → TestFlight

---

## Diagnóstico

### Build actual
```
dist/public/assets/index-DdSu8hBk.js   1,836.49 kB │ gzip: 508.90 kB
```
Un solo chunk. Vite sin `manualChunks` ni `rollupOptions`. Nada se lazy-loaded.

### Culpables verificados (líneas reales)
| Archivo | Líneas | Problema |
|---|---|---|
| `client/src/lib/i18n.ts` | 4,939 | 3 locales inline, todos cargan siempre |
| `client/src/lib/motor-v2.1-i18n.ts` | 484 | inline en bundle cliente |
| `client/src/lib/generatedTraitTxtGenderI18n.ts` | 675 | 3 locales, siempre |
| `client/src/lib/generatedPlanLineGenderI18n.ts` | 441 | 3 locales, siempre |
| `client/src/lib/generatedHintGenderI18n.ts` | 432 | 3 locales, siempre |
| `client/src/lib/clubGenderManualI18n.ts` | 458 | 3 locales, siempre |
| `client/src/lib/generatedSpatialGenderI18n.ts` | 144 | 3 locales, siempre |
| **Total i18n** | **7,573** | ~350–400 KB del bundle |
| `core/Schedule.tsx` | ~228 KB | god file, carga aunque no estés en Schedule |
| `client/src/pages/coach/PlayerEditor.tsx` | ~126 KB | god file |
| `client/src/lib/motor-v2.1.ts` | ~106 KB | debería ser server-side |

### Ahorro estimado por fase
| Fase | Acción | Ahorro gzip estimado | Riesgo |
|---|---|---|---|
| 1 | i18n lazy por locale | ~210–230 KB | bajo |
| 2 | Code splitting módulos | ~80–100 KB | medio |
| 3 | motor server-side | ~50–70 KB | alto |
| **Total** | | **~340–400 KB** | |

Objetivo alcanzable en fases 1+2 sin tocar el motor.

---

## Fase 1 — i18n lazy loading (mayor ROI)

### Principio
En vez de 3 objetos locale inline en un módulo → 3 archivos chunk separados que Vite
carga bajo demanda. Solo el locale activo del usuario entra en la sesión.

### Estructura objetivo
```
client/src/lib/
  i18n-core.ts          ← lógica pura: useLocale, t(), setLocale, tipos, listeners
  i18n.ts               ← re-export de compatibilidad (todos los imports existentes: sin cambios)
  locales/
    en.ts               ← merge: strings EN + generated*EN + motor-v2.1-i18n EN + clubGender EN
    es.ts               ← merge: strings ES + generated*ES + motor-v2.1-i18n ES + clubGender ES
    zh.ts               ← merge: strings ZH + generated*ZH + motor-v2.1-i18n ZH + clubGender ZH
```

### Mecanismo de carga
```typescript
// i18n-core.ts — carga dinámica
let activeBundle: Record<string, string> = {};

async function loadLocale(locale: Locale): Promise<void> {
  const mod = await import(`./locales/${locale}`);
  activeBundle = mod.default;
  localStorage.setItem("uscout_locale", locale);
  listeners.forEach(fn => fn());
}
```
Vite detecta el `import()` dinámico y genera 3 chunks separados automáticamente.

### Arranque sin flicker
- EN se pre-carga **síncrono** como fallback (default de todos modos)
- ES y ZH son async — el locale guardado se carga en el `useEffect` inicial
- `t()` estático devuelve del bundle EN hasta que el async bundle llegue

### Riesgo único: t() fuera de React
`t()` se usa fuera de componentes en algunos lugares. Con bundle async,
si se llama antes de que cargue → devuelve la key en texto plano.
**Solución**: EN inline como fallback síncrono. ES/ZH async. `t()` nunca devuelve vacío.

### Pasos de ejecución (Cursor)

**Paso 1 — Crear locales/en.ts, locales/es.ts, locales/zh.ts**
- Extraer bloque `en` de i18n.ts + `MOTOR_V2_1_I18N.en` + todos los `*_EN` de generated files
- Mismo para es y zh
- Export default del objeto merged
- `npm run check` — debe pasar limpio

**Paso 2 — Crear i18n-core.ts**
- Copiar lógica de i18n.ts: `useLocale`, `t()`, `setLocale`, `getLocale`, `listeners`
- Reemplazar `const translations = { en, es, zh }` por `loadLocale()` async
- EN cargado síncrono en módulo-load como fallback
- `npm run check`

**Paso 3 — Convertir i18n.ts en re-export**
```typescript
// i18n.ts — solo esto
export * from "./i18n-core";
export type { Locale } from "./i18n-core";
```
Todos los imports existentes (`from "@/lib/i18n"`) siguen funcionando sin cambios.
`npm run check` + build + medir gzip.

**Auditoría post-fase 1**
```bash
cd "/Users/palant/Downloads/U scout" && npm run build 2>&1 | tail -20
```
Esperado: ver 3 chunks nuevos `en-[hash].js`, `es-[hash].js`, `zh-[hash].js` + chunk principal reducido.
Si el chunk principal no baja ≥150 KB gzip → investigar antes de continuar.

**Verificación visual (5 min manual)**
- DevTools → Network → filtrar JS
- Cargar app en EN: solo carga chunk EN
- Cambiar a ES en Settings: carga chunk ES
- Recargar con ES en localStorage: carga ES directamente, no EN

---

## Fase 2 — Code splitting por módulo

### Principio
Cada módulo de U CORE (`Schedule`, `Scout`, `Wellness`) como chunk lazy.
Solo el módulo activo carga su código.

### Cambio en App.tsx / router
```typescript
// Antes
import Schedule from "./core/Schedule";
import PlayerEditor from "./pages/coach/PlayerEditor";

// Después
const Schedule = React.lazy(() => import("./core/Schedule"));
const PlayerEditor = React.lazy(() => import("./pages/coach/PlayerEditor"));
```
Envolver rutas en `<Suspense fallback={<LoadingSpinner />}>`.

### Targets prioritarios
| Archivo | Tamaño | Lazy candidate |
|---|---|---|
| `core/Schedule.tsx` | 228 KB | ✅ ruta entera |
| `pages/coach/PlayerEditor.tsx` | 126 KB | ✅ ruta entera |
| `pages/coach/ReportSlidesV1.tsx` | — | ✅ ruta entera |
| `core/Stats.tsx` | 0.6 KB | no vale la pena |

### Pasos de ejecución (Cursor)

**Paso 1 — Audit de imports**
```bash
grep -rn "import.*Schedule\|import.*PlayerEditor\|import.*ReportSlides" \
  "/Users/palant/Downloads/U scout/client/src" | grep -v "node_modules"
```
Identificar todos los puntos de import antes de tocar nada.

**Paso 2 — React.lazy en el router**
Convertir imports estáticos a lazy en `App.tsx` o el archivo de rutas.
Añadir `<Suspense>` wrapper con fallback visual consistente con el design system.

**Paso 3 — Build + medir**
```bash
cd "/Users/palant/Downloads/U scout" && npm run build 2>&1 | tail -30
```
Esperado: chunks separados por módulo. Chunk principal <200 KB gzip.

---

## Fase 3 — motor-v2.1 server-side (largo plazo)

**No ejecutar hasta tener Fase 1+2 completas y TestFlight funcionando.**

### Principio
`motor-v2.1.ts` (106 KB) se mueve a `server/`. El cliente llama a `/api/motor/run`
con los inputs y recibe los outputs. Elimina el motor del bundle cliente.

### Implicaciones
- Requiere nueva ruta Express: `POST /api/motor/run`
- `ReportViewV4` y `ReportSlidesV1` pasan de importar el motor a usar TanStack Query
- Los scripts de calibración siguen usando el motor local (no cambia)
- **Riesgo**: latencia añadida en generación de informe (mitigable con caché por playerInputs hash)

### No tocar hasta
- [ ] Fase 1 completada y medida
- [ ] Fase 2 completada y medida  
- [ ] Bundle <300 KB gzip confirmado
- [ ] Capacitor + TestFlight funcionando
- [ ] Beta con Inner Mongolia activa

---

## Fase 4 — Capacitor (prerequisito TestFlight)

**Solo después de <300 KB gzip.**

```bash
cd "/Users/palant/Downloads/U scout"
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "U Core" "com.ucore.app"
npx cap add ios
npm run build
npx cap sync
npx cap open ios
```
Después: configurar signing en Xcode + subir a TestFlight.

---

## Checklist de ejecución

### Fase 1 — i18n lazy
- [ ] Crear `client/src/lib/locales/en.ts`
- [ ] Crear `client/src/lib/locales/es.ts`
- [ ] Crear `client/src/lib/locales/zh.ts`
- [ ] Crear `client/src/lib/i18n-core.ts`
- [ ] Convertir `client/src/lib/i18n.ts` a re-export
- [ ] `npm run check` limpio
- [ ] Build: chunk principal reducido ≥150 KB gzip
- [ ] Verificación visual: chunks por locale en Network tab

### Fase 2 — Code splitting
- [ ] Audit imports de Schedule, PlayerEditor, ReportSlides
- [ ] React.lazy en App.tsx/router
- [ ] Suspense wrappers con fallback
- [ ] `npm run check` limpio
- [ ] Build: chunk principal <200 KB gzip

### Medición final pre-Capacitor
- [ ] Bundle <300 KB gzip confirmado
- [ ] App funciona en todos los locales (EN/ES/ZH)
- [ ] Calibración motor: 100% (551/551)
- [ ] Quality eval: 100% (46/46)

---

## Regla de oro

**Medir antes y después de cada fase.** Sin número de antes, el de después no significa nada.
Línea base confirmada: `508.90 KB gzip` (25 abr 2026).
