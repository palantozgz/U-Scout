# U Core — Contexto del proyecto para Claude

## Stack
- React + TypeScript + Vite
- Tailwind v4 (`@theme inline` en `client/src/index.css`, sin `tailwind.config.js`)
- shadcn/ui, wouter (routing), TanStack Query
- Capacitor 8.x (iOS + Mac Catalyst)
- Backend: Express + Drizzle ORM + PostgreSQL (Railway)
- Deploy: Railway auto-deploy en push a `main`

## Estructura de rutas clave
```
client/src/
  pages/
    core/          → Home, Schedule, ModulePage (shell), ModuleNav, Playbook, Scout.tsx (redirect)
    scout/         → CoachHome, MyScout, FilmRoom, GamePlan, Personnel, ClubManagement, PlayerEditor
    player/        → PlayerHome, PlayerTeamList, WellnessStandalone, Dashboard, PlayerHomeSettingsStub
  components/
    branding/      → ModuleHeader (logo animado por módulo), logos SVG
    ModuleGate.tsx → gate de activación por módulo + tarjeta de intro de primera vez (spec 44)
    ModuleIntroCard.tsx → tarjeta compacta de "primera vez que abres este módulo" (spec 44)
  lib/             → useAuth, capabilities, i18n, club-api, wellness, schedule, motor-v1 (motor real en producción, ver docs/motor-1.0-spec.md; motor-v4/motor-v2.1 siguen como núcleo interno que motor-v1 envuelve, nunca se llaman directamente desde la UI), onboarding-state (onboarding principal + intros de módulo, spec 44), module-intro-content (copy de esas tarjetas)
```

## Arquitectura de layout — REGLAS CRÍTICAS

### Regla de scroll (NUNCA romper esto)
Todas las páginas con `ModuleNav` deben usar:
```tsx
// Outer div — altura fija, NO min-h
<div className="flex flex-col h-[100dvh] bg-background ...">
// Main — scroll interno
<main className="flex-1 overflow-y-auto min-h-0 ...">
```
**PROHIBIDO usar:** `min-h-[100dvh]` ni `md:overflow-y-auto` en páginas con ModuleNav.
Motivo: `min-h` + safe-area padding en App.tsx hace que el wrapper supere 100dvh y active scroll en el wrapper en lugar de dentro de la página.

Páginas sin ModuleNav (Login, Join, JoinClub, OnboardingFlow): **esta línea decía que `min-h-[100dvh]` era correcto ahí — era un error real, corregido 2026-09-14 (spec sección 42).** Estas 4 pantallas se renderizan igualmente dentro del wrapper raíz `h-[100dvh] overflow-hidden` de `App.tsx` (línea ~487, ver arriba) — el mismo mecanismo que prohíbe `min-h-[100dvh]` en páginas con ModuleNav aplica aquí exactamente igual. Usan el mismo patrón de una sola pieza (no hay `<main>` separado con nav fijo): outer div `h-[100dvh] overflow-y-auto` directamente, sin `min-h`.

### App.tsx wrapper (desktop sidebar)
```tsx
// línea ~459 en App.tsx
<div className="h-[100dvh] bg-background md:pl-12 lg:pl-48 relative overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ...">
```
- **`h-[100dvh]` (NO `min-h`)** — crítico para que el wrapper no scrollee
- **Sin `overflow-y-auto`** en el wrapper — el scroll va dentro de cada página
- Safe-area padding aquí, NO en las páginas individuales
- El sidebar (ModuleNav desktop) es `fixed left-0`, ocupa `w-16` (md) / `w-56` (lg)

### iOS WebView bounce (overscroll)
En `client/src/index.css`:
```css
html, body {
  background: hsl(var(--background));
  overscroll-behavior: none;
  overflow: hidden;
}
```
Esto elimina el rubber-band scroll de iOS que revelaba márgenes negros.

### ModuleNav mobile
`fixed bottom-0`, altura 56px. Padding requerido en páginas:
- `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` → estándar ModulePage shell
- `pb-16 md:pb-0` → outer div de páginas directas (CoachHome, PlayerTeamList, etc.)

### ModulePage shell (pages/core/ModulePage.tsx)
Shell compartido para módulos con panel lateral opcional en desktop:
```tsx
<ModulePageShell title="..." panel={<MyPanel />} panelLabel="DETAIL">
  {children}
</ModulePageShell>
```
Panel: `hidden md:flex w-80 lg:w-96` — solo desktop.

## Tipografía desktop — REGLAS

El breakpoint `md:` activa a ≥768px — confirmado que funciona en Mac Catalyst con ventana maximizada.

**Mínimo para labels en desktop:** `md:text-sm` (14px). NUNCA dejar labels a 8-11px en desktop.
- Labels pequeños mobile (`text-[8px]`, `text-[10px]`, `text-[11px]`) → añadir `md:text-xs` o `md:text-sm`
- Títulos y valores → `md:text-base` o mayor según contexto
- No usar `md:text-[11px]` — es insuficiente, el usuario lo verá igual de pequeño

Páginas ya corregidas: Home, CoachHome, MyScout, FilmRoom, GamePlan.

## Branding y naming
- Producto: **U Core** (antes "U Scout" — migración completada en UI)
- Módulo scout: **U Scout** (nombre del módulo dentro de U Core — OK internamente)
- `index.html`: title y meta description → "U Core" ✓
- `Home.tsx` footer: "U CORE" ✓
- `favicon.svg`: bull horns mark blanco sobre fondo oscuro (`client/public/favicon.svg`)
- App icon Xcode: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
  - 1024×1024 PNG, fondo #0d0d0d sólido (sin rx — iOS aplica su propia máscara de esquinas)
  - viewBox "262 169 500 500" sobre el SVG original 1024×1024
  - El mark bull horns cubre ~90% del ancho del icono
  - El logo es intrínsecamente más ancho que alto (ratio 2:1), espacio vertical es inevitable

## Estado de módulos
| Módulo    | Estado         | Ruta                    |
|-----------|----------------|-------------------------|
| Home      | ✅ activo       | `/home`                 |
| Schedule  | ✅ activo       | `/schedule`             |
| Scout     | ✅ activo       | `/scout`, `/coach/*`    |
| Stats     | ✅ activo       | `/stats`                |
| Playbook  | ✅ activo       | `/playbook`             |
| Player UX | ✅ activo       | `/player/*`             |

## i18n
- Idiomas: `en`, `es`, `zh`
- Hook: `useLocale()` → `{ t, locale }`
- Archivos: `client/src/lib/i18n.ts` (inline)
- Patrón para texto nuevo sin clave i18n:
  ```tsx
  locale === "zh" ? "中文" : locale === "es" ? "Español" : "English"
  ```

## Consulta de conversaciones anteriores del proyecto (todos los agentes: Director, El Arquitecto, El Aparejador)

Claude Code **no tiene acceso** a las conversaciones anteriores del proyecto en claude.ai/Claude Desktop — esa búsqueda (`conversation_search`) solo existe ahí, no aquí. Es una limitación real, no un descuido: en la sesión del 2026-09-10/11 se rediseñó sin querer un sistema (discrepancias entre entrenadores) que ya estaba diseñado con más detalle en conversaciones de abril, porque no se buscó ahí antes.

**Regla:** si vas a proponer o construir algo que "suena a que ya se pensó antes" — nombres de features ya establecidos (v2, v3, motor, discrepancias, aprobación, slides, arquetipos, etc.), decisiones de producto no triviales, o cualquier cosa donde te sorprendas pensando "esto seguramente ya se decidió de alguna forma" — **no lo diseñes desde cero**. En vez de eso:

1. Para el trabajo ahí y escribe 1-3 preguntas de búsqueda concretas y específicas (pocas palabras, términos que probablemente aparecieron literalmente en la conversación original — no "discrepancias" a secas, mejor "sistema discrepancias entrenadores versiones aprobadas").
2. Preséntaselas a Pablo así, literal: **"Antes de seguir, necesito que revises esto en Claude Desktop (proyecto U Core) y me pegues el resultado: [pregunta 1] / [pregunta 2]"**.
3. Pablo las copia en una conversación de Claude Desktop dentro del proyecto, pega el resultado de vuelta aquí, y entonces sigues con eso incorporado.

No lo hagas para dudas triviales o de implementación mecánica (eso ralentiza sin necesidad) — solo para decisiones de producto/arquitectura con riesgo real de que ya existan y las estés reinventando o contradiciendo.

## Cambios aplicados (todas las sesiones)

### App.tsx — mobile scroll fix
- Wrapper: `min-h-[100dvh] overflow-y-auto` → `h-[100dvh] overflow-hidden`
- Safe-area padding se mantiene en el wrapper (no en páginas individuales)

### index.css — iOS bounce fix
- Añadido `overscroll-behavior: none; overflow: hidden` en `html, body`
- `background: hsl(var(--background))` para evitar flash en notch/home bar

### Layout scroll fix (todas las páginas con ModuleNav)
- Outer div: `min-h-[100dvh]` → `h-[100dvh]`
- Main: añadido `overflow-y-auto min-h-0`
- Páginas corregidas (verificado real por auditoría 2026-09-14, no solo listado aquí de nombre — esta lista original tenía `ModulePage`/`Playbook` como "ya corregidas" cuando en realidad seguían con `h-screen`, corregido hoy): Home, CoachHome, Schedule, ModulePage, Playbook, FilmRoom, GamePlan, QuickScout, Personnel, MyScout, Settings, Dashboard (scout, código muerto — ver más abajo), PlayerHome, WellnessStandalone, Dashboard (player), ClubManagement, PlayerTeamList, PlayerHomeSettingsStub, Stats

### Auditoría UI/UX iOS + desktop, entrenador y jugadora (2026-09-14, spec sección 34)
- `Dashboard.tsx` (jugadora, `/player/team/:teamId`) tenía un hallazgo **crítico** real: sin `overflow-y-auto`/`min-h-0` en absoluto — con roster largo, tarjetas por debajo del pliegue quedaban inalcanzables, no solo difíciles de alcanzar. Corregido.
- `h-screen` → `h-[100dvh]` en `ModulePage.tsx`, `CoachHome.tsx`, `HomeDesktop.tsx`, `HomeMobile.tsx`, `Playbook.tsx` (x2) — estas 5 pantallas nunca habían pasado por el fix real pese a estar listadas arriba como corregidas.
- `PlayerHomeSettingsStub.tsx`: mismo patrón crítico que `Dashboard.tsx` (sin scroll real), corregido — no estaba en la lista de excepciones "páginas sin ModuleNav", es una subpágina real alcanzable desde el icono de ajustes.
- Safe-area inconsistente: 10 pantallas usaban `pb-16 md:pb-0` (64px fijo) sin sumar `env(safe-area-inset-bottom)` — el nav mobile sí lo hace (`ModuleNav.tsx`), pero el hueco que cada página reserva no coincidía. Estandarizado a `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0` en las 10.
- Tipografía: barrido de ~205 instancias de `text-[8-11px]` sin variante `md:` en Personnel, ClubManagement, PlayerEditor, Stats, GamePlan, QuickScout, WellnessStandalone, PlayerHome, PlayerTeamList, Dashboard, Settings. 2 excepciones dejadas a propósito (documentadas en el código): una etiqueta SVG dentro de un diagrama pequeño (`PlayerEditor.tsx`, el gráfico de zonas de poste) y un caso en `Stats.tsx` que ya resolvía desktop vía una variable JS `isDesktop`, no vía `md:`.
- `ModuleHeader.tsx`: botón de ajustes ampliado a ~44pt de objetivo táctil (antes ~36px).
- `ModuleNav.tsx`: el rol del sidebar desktop (`hidden lg:block`, nunca se ve en mobile) tenía `text-[10px]` fijo — subido a `text-xs` directamente (no tenía sentido un `md:`, ya es contenido solo-desktop).

### Tipografía desktop (md:text-sm mínimo)
- Home.tsx: todos los labels pequeños → `md:text-sm` o `md:text-xs`
- CoachHome.tsx: AlertSlot, NavCard, separadores → `md:text-sm`
- MyScout.tsx, FilmRoom.tsx, GamePlan.tsx: labels micro → `md:text-sm`/`md:text-xs`

### Home.tsx layout desktop
- KPI bar: `grid-cols-3` horizontal, valores `text-3xl md:text-4xl`
- Greeting: `text-[28px] md:text-[42px]`
- Module grid: `md:grid-cols-4`, tarjetas `md:h-[180px]` (fijo, no flex-1)
- Alert chips: `md:flex-none md:max-w-xs` (evita stretch full-width en flex-wrap)
- Footer: "U CORE" ✓

### App icon (v3 — instalado)
- Generado con cairosvg desde `favicon.svg`
- viewBox tightened a "262 169 500 500" → mark ocupa 90.4% del ancho
- Fondo #0d0d0d sólido, sin rx/transparencia en esquinas
- Instalado en `AppIcon.appiconset/AppIcon-512@2x.png`
- Para ver el cambio: eliminar app del dispositivo, Clean Build Folder, rebuild

### Branding cleanup
- `index.html`: "U Scout" → "U Core" en title y meta
- `Home.tsx` footer: "U SCOUT" → "U CORE"
- Comentarios internos con "U Scout" pendientes de limpiar (cosmético)

### Las 4 decisiones de diseño desktop de la auditoría, resueltas por Pablo (2026-09-14, spec sección 35)
Ver ítems 3/7/8/9 de PENDIENTES más abajo (ya marcados corregidos): `ScoutDesktop.tsx` borrado, `PlayerEditor.tsx` con `max-w-3xl`, `ModuleHeader.tsx` compacto en desktop, panel lateral de `Schedule.tsx` planner reactivado.

### La jugadora nunca ve alternativas del motor (2026-09-14, spec sección 33)
`ReportSlidesV1.tsx`: las 3 tarjetas deny/force/allow de la vista completa eran interactivas (abrían el sheet "Alternativas del motor" con puntuaciones) para cualquiera, jugadora incluida. Ahora solo son interactivas en `coachMode` — en modo jugadora son de solo lectura, sin sheet, sin puntuaciones, sin opciones descartadas visibles. Mandato de Pablo: "la jugadora solo ve la opcion que hemos aprobado... categorico, sencillo, sintetizado".

### "El decantador" / Nivel B — calibración cerrada end-to-end (2026-09-14, spec secciones 38-41)
- Gate de publicación reconciliado: ≥1 aprobación sigue siendo obligatoria para todos sin excepción, pero una vez que existe, cualquier coach del club puede publicar (el badge `reportPublishAccess` ya no controla quién publica).
- `reportPublishAccess`/`canAccessCalibrationPanel` (renombrada, antes `canPublishReports`) ahora controla el panel nuevo "Calibración" en `ClubManagement.tsx`: entrenadores con permiso ven patrones de sustitución que convergen entre ≥N (2-5, configurable) entrenadores distintos de jugadoras canónicas del mismo arquetipo, y pueden promocionarlos a permanentes — **reversible sin deploy** (tabla `promoted_patterns`, mecanismo puro `aplicarPatronesPromocionados()` en `motor-v1.ts`, aplicado en `ReportSlidesV1.tsx` vía `useActivePromotedPatterns()`).
- `detectPatterns()` (`overrideEngine.ts`) corregido: cuenta entrenadores distintos, no jugadoras distintas (bug real que hubiera permitido a un solo coach "promocionar" su propia preferencia repetida).
- Seguridad: `POST /api/stats/import-team`/`import-league` no comprobaban rol ni pertenencia de `targetTeamId` al club — IDOR cross-tenant real, cerrado.
- Aviso de "pendientes" en `CoachHome.tsx` ahora refleja a todo el staff (cuántos entrenadores distintos tienen fichas sin enviar), no solo al propio coach — sin nombres, por coste de la API admin de Supabase en una ruta de carga frecuente.
- `useDeletePlayer`: no encolaba el borrado sin conexión (a diferencia de create/update) — corregido, mismo patrón de cola offline ya existente en `queryClient.ts`.

Detalle completo, decisiones reconciliadas y verificación en `docs/motor-1.0-spec.md` secciones 27, 33-41.

### Restos de marca "U Scout"/"U Stats"/"U Playbook" en Home móvil y ClubManagement (2026-09-14, spec sección 43)
8 casos reales visibles a usuarios (no solo comentarios de código) corregidos reutilizando las claves `ucore_nav_*` ya establecidas. Ver ítem 12 de PENDIENTES más abajo.

### Onboarding por módulo + "ver tutoriales otra vez" en Ajustes (2026-09-14, spec sección 44)
Cada uno de los 5 módulos (Scout/Schedule/Stats/Playbook/Club) muestra una tarjeta compacta y no bloqueante la primera vez real que se abre — no otro wizard de varias slides (fatiga real si se abren varios módulos seguidos). Copy diferenciada por rol donde el contenido real difiere (Scout/Schedule/Playbook), única para ambos en Stats (misma pantalla, verificado). Repetible desde Ajustes ("Tutoriales" → "Ver los tutoriales otra vez"), que también fuerza el onboarding principal a mostrarse de nuevo — de paso se encontró y cerró un bug real: `shouldOfferOnboarding()` nunca se activaba para cuentas creadas antes del 12 de abril de 2026 sin importar el flag, lo que habría hecho ese botón un no-op silencioso para cuentas antiguas. `client/src/lib/onboarding-state.ts` (flags), `client/src/lib/module-intro-content.ts` (copy), `client/src/components/ModuleIntroCard.tsx` (UI), cableado en `ModuleGate.tsx` (único punto real para los 4 módulos con gate) y en `ClubManagement.tsx` (Club, no pasa por ModuleGate).

### Recordatorios diarios en iOS — scout reports + wellness (2026-09-14, spec sección 45)
Notificaciones **locales** (`@capacitor/local-notifications`, sin servidor ni APNs — criterio propio, evita infraestructura push que Pablo no tiene montada) para 2 avisos diarios a jugadoras: revisar scout reports y rellenar wellness, hora configurable por separado por el head coach en My Club (`clubs.scout_reports_notify_time`/`wellness_notify_time`, `HH:MM`, null = 21:30 por defecto). Wellness se mantiene como un único check-in (no se separa "calidad del sueño" de mañana del resto — ya estaba diseñado así, una sola fila por día; separar añadiría fricción real sin beneficio claro). `client/src/lib/local-notifications.ts` (permiso + programación, no-op fuera de iOS), `NotificationsPrimingCard.tsx` (explica los avisos antes de disparar el diálogo real de iOS, una vez por jugadora), cableado en `HomeMobile.tsx` y `HomeDesktop.tsx` (las 2 — un iPad puede caer en cualquiera). **Nota real durante el trabajo**: `npx cap sync ios` (necesario para registrar el plugin) sobrescribió sin querer el `PRODUCT_BUNDLE_IDENTIFIER` que Pablo tenía cambiado localmente sin commitear en Xcode — detectado y revertido de inmediato, sin tocar nada más de su trabajo en curso de preparación para App Store (ver spec 45.5, hay una inconsistencia de bundle id entre 3 sitios que sigue sin resolver, decisión suya).

### Bug real cerrado: los overrides de un entrenador se borraban al publicar en vez de congelarse (2026-09-15, spec secciones 46-47)
Confirmado por Pablo vía investigación de Claude Desktop (diseño original de abril, "el decantador"): al publicar un informe a Game Plan, el conjunto de overrides ("reemplazar alternativa") del entrenador que publica debe congelarse como la versión final que ve la jugadora — en su lugar, se borraba entero sin aplicarse a nada, así que ningún pick manual de ningún entrenador llegaba jamás al informe publicado. Además, `GET /api/players/:id/overrides` filtraba siempre por "coachId === quien pregunta", lo que hacía que una jugadora (nunca "coach" de nada) nunca pudiera ver ningún override, independientemente de si se borraban o no. Corregido: `report_overrides` ya no se borra al publicar (nueva `clearScoutVersionsAfterPublish`, que reemplaza a `mergeAndClearScoutVersions` solo en el paso de publicación — esta última se queda igual, es el reset real de "unpublish"), y el endpoint devuelve la versión congelada del `publishedBy` cuando el informe ya está publicado. `hasDiscrepancy` ya no se muestra en informes ya publicados (consecuencia directa: ahora los overrides persisten, así que sin este ajuste un informe resuelto seguiría marcado "en conflicto" para siempre).

### Resolución de discrepancias campo a campo en Film Room (2026-09-15, spec sección 48)
Un supervisor (`canAccessCalibrationPanel` — head_coach/master/coach con `reportPublishAccess`) puede adoptar, campo a campo, el pick de un compañero directamente desde `DiscrepancyPanel` — antes solo se mostraba el conflicto, sin forma de resolverlo en la app. Reutiliza el mismo endpoint del picker de alternativas de siempre (`POST /api/players/:id/overrides`), sin tabla ni mecanismo nuevo: el supervisor va componiendo su propio conjunto de overrides mezclando lo mejor de cada propuesta, y al publicar (spec 47) ese conjunto compuesto se congela como versión final.

### Pasada de fricción/cosmética — primer lote (2026-09-15, spec sección 49)
Mandato de Pablo: revisar flujos UX y cosmética para usuarios nuevos, mínima fricción, trabajo autónomo. Estados vacíos sin CTA arreglados en `MyScout.tsx` (botón "Ir a Plantilla", condicionado a que el usuario pueda acceder de verdad) y `FilmRoom.tsx` (botón "Ir a Mi Scout") — otras pantallas ya tenían esto bien (`GamePlan.tsx`, `Personnel.tsx`, `Playbook.tsx`, no tocadas). **Hallazgo no anticipado, no solo cosmético**: registrarse como "Coach" desde `/login` sin invitación previa deja una cuenta real sin club, sin forma de arreglarlo sola, y ninguna pantalla lo explicaba (`ClubSecurityGate` no capturaba ese 404 en absoluto). Corregido: texto aclaratorio bajo el selector de rol en `Login.tsx`, y `ClubSecurityGate` (`App.tsx`) ahora muestra una pantalla real ("todavía no perteneces a ningún club, pide el enlace a tu head coach") en vez de dejar pasar a pantallas rotas en silencio.

### Pasada de fricción/cosmética — segundo lote: contraseñas (2026-09-15, spec sección 50)
`Login.tsx`/`JoinClub.tsx`: `autoComplete` en los 3 campos (email/nombre/contraseña, faltaba en los 2 formularios) y botón de mostrar/ocultar contraseña (ningún campo de la app lo tenía). **Hallazgo no anticipado más importante**: no existía ninguna forma de recuperar el acceso a la cuenta — cerrado de punta a punta con `resetPasswordForEmail`/`updatePassword` (`supabase.ts`), un nuevo modo "forgot" en `Login.tsx`, y `PasswordRecoveryModal.tsx` (nuevo, montado en la raíz de `App.tsx`, escucha el evento `PASSWORD_RECOVERY` del SDK de Supabase). Verificado interactivamente el envío del enlace; el flujo de clic-real-en-el-correo no es reproducible sin credenciales de prueba, ver spec 50.3 para el detalle honesto de qué se verificó y qué no.

### Pasada de fricción/cosmética — tercer lote: Settings.tsx (2026-09-15, spec sección 51)
Añadido enlace de soporte (`mailto:support@uscout.app`) a `Settings.tsx` (staff) — ya existía en `PlayerHomeSettingsStub.tsx` (jugadoras) pero faltaba en el de staff, mismas claves i18n reutilizadas. De pasada, 2 datos técnicos desactualizados en la tarjeta "Acerca de": decía "v4 — Motor" y "18 arquetipos" (era motor-v4/legacy) — corregido a "Motor 1.0"/"10" (contado directamente del union type real `ArchetypeKey` en `motor-v1-types.ts`, no adivinado).

### Bloqueo de registro público de nuevos clubes — preparación App Store (2026-09-15, spec sección 52)
Sin sistema de pagos todavía: `GET /api/club` (único sitio real donde un `head_coach` auto-crea un club nuevo) ahora exige que el email esté en `HEAD_COACH_SIGNUP_ALLOWLIST` (variable de entorno de Railway, csv) — si no, `403 signup_closed`, sin crear nada. `master` nunca se restringe. Enforced en servidor, no solo escondido en el cliente. El flujo de invitación a un club existente (coach/jugadora) no se toca, ya estaba correctamente cerrado. Variable configurada en producción con el único email real de head_coach que existe hoy (`pablomgz@hotmail.com`) — ampliar la lista es cambiar la variable en Railway, sin deploy.

### Auditoría de datos reales de producción — antes de limpiar el club de Jiangxi (2026-09-15, spec sección 53, SIN cambios de datos)
Pablo pidió preparar el club real de Jiangxi para la entrada del staff/jugadoras reales. Consultado el estado real vía SQL directo (solo lectura) antes de proponer nada: 1 solo club, 3 cuentas totales (Pablo real + 2 marcadas "QA TEST" por el propio Pablo), 307 de las 309 jugadoras son el roster real de la WCBA ya importado (no tocar), solo 2 son fichas de prueba. Plan de migración a un club de pruebas nuevo propuesto y pendiente de confirmación — 2 cosas preguntadas directamente en vez de asumidas: qué hacer con 12 sesiones de calendario ambiguas, y que Pablo cree él mismo la cuenta "head coach test" (crear cuentas nuevas está prohibido para mí por las reglas de seguridad de la sesión). Ver spec sección 53 para el detalle completo de la consulta.

### Pasada de fricción/cosmética — cuarto lote: teclado numérico + validación instantánea (2026-09-15, spec sección 54)
`inputMode="numeric"` en los campos de dorsal (`MyScout.tsx`, `Personnel.tsx`). Validación instantánea de campos vacíos en `Login.tsx`/`JoinClub.tsx` — verificado que `required` de HTML no habría bastado (ninguno de los 2 formularios está dentro de un `<form>` real), añadida una comprobación manual equivalente al principio de `handleSubmit`/`handleAuth`.

### Eliminar/banear miembros unificado + aviso real al expulsado (2026-09-15, spec sección 55)
Pablo, contexto de tryouts reales: unificar "eliminar"/"banear" en una sola acción. Hallazgo real antes de tocar nada: el borrado duro (`DELETE /api/club/members/:id`) no disparaba NINGUNA limpieza de datos locales ni aviso — solo el baneo lo hacía, y encima en completo silencio (cierre de sesión instantáneo, sin pantalla). `ClubManagement.tsx`: un único botón "Eliminar"/"Restaurar" por fila (usa el mecanismo de baneo, reversible, por debajo — valioso en tryouts donde un error es plausible), `useDeleteClubMember` retirado por dejar de usarse. `App.tsx::ClubSecurityGate`: el borrado de datos locales ahora se dispara para los 3 casos de "sin acceso" (eliminado, sin club, registro cerrado); ya no se fuerza el cierre de sesión automático para el caso de baneo, se muestra una pantalla real explicando qué pasó, igual que los otros 2 casos. Traducciones revisadas de paso: `club_status_banned`/`club_unban` desalineadas con el nuevo concepto, corregidas; `club_ban` (huérfana) eliminada. **Confirmado a Pablo**: el flujo de invitación (`JoinClub.tsx`) es un endpoint totalmente aparte del gate de registro de la sección 52, no se ve afectado.

### Gate de registro preparado para pagos, sin acoplarse a ningún procesador (2026-09-15, spec sección 56)
Pablo: una vez haya pagos, quien pague debe poder crearse cuenta head_coach sin fricción manual — "plantea como dejar eso listo solo para cuando tengamos pagos levantar el bloqueo y yasta". Se encontró (protocolo "esto huele a ya decidido antes") una tabla `subscriptions` real en Supabase producción, 0 filas, no declarada en `shared/schema.ts` ni usada en ningún endpoint. Pablo confirmó vía Claude Desktop el diseño original (con un giro importante a mitad de esa conversación: el modelo pasó de "el club compra slots" a **"el head coach es el cliente, paga y su compra crea su propio universo"** — autoservicio, sin aprobación manual). Precios/límites reales de pro/elite: no decididos en ninguna parte, hueco real de producto. Implementado solo el mecanismo (cero Stripe/Apple IAP/etc., decisión aparte de Pablo): `subscriptions` cableada en Drizzle, `storage.getActiveSubscriptionForUser()`, y el gate de la sección 52 ahora es un OR — allowlist **o** suscripción activa. Con 0 filas hoy, el comportamiento no cambia para nadie. El único punto que faltará cuando exista un procesador de pago: que su webhook inserte una fila en `subscriptions` — el gate, la creación de club y las invitaciones ya están listos para leerla, sin tocar código.

### Migración de Jiangxi + panel Calibración explicado + horarios feos + publicación directa (2026-09-15, spec sección 57)
Migración real ejecutada en Supabase (SQL directo, sin tocar esquema): las 2 cuentas QA (coach + jugadora), su ficha sandbox y sus 5 entradas de wellness, movidas del club real de Jiangxi al nuevo club de pruebas (`ucore.qa.headcoach@test.com`, que no tenía club aún porque nunca había hecho login — creado con el mismo patrón exacto que el endpoint real). Jiangxi queda con 1 solo miembro (Pablo) y 308 jugadoras reales del roster WCBA, listo para la entrada de staff/jugadoras reales. Panel de "Calibración" ("no sé para qué sirve"): añadida una frase fija en los 3 idiomas explicando qué lo activa (≥N entrenadores coincidiendo en el mismo cambio) y qué hace "Hacer permanente". Cuadros de hora feos: `input[type=time]`/`type=date` nunca declaraban `color-scheme` — el navegador dibujaba sus controles nativos con chrome claro por defecto en temas oscuros; corregido en `index.css` (`color-scheme: light`/`dark` por tema), verificado visualmente. **Publicación directa de un solo clic**: Pablo propuso 2 alternativas y prefirió la segunda — nada de "modo simplificado" nuevo, solo un botón junto a "Enviar a sala" en la pantalla de overrides (`ReportViewV4.tsx`) que aprueba automáticamente y publica en el acto, reusando el mismo endpoint (`game-plan`) y el mismo gate (≥1 aprobación) que ya usaba Film Room — investigado primero que el paso por Film Room nunca fue una dependencia real del motor, solo indirección de UI.

### [Sin tocar, documentación] Hosting alternativo a Railway + web empaquetada vs. remota en iOS (2026-09-15, spec sección 58)
Pablo pegó un log de arranque real en iOS (Xcode) para revisar — sin bugs de U Core, todo ruido normal de iOS/WebKit. Lo único con sustancia: `capacitor.config.ts` carga la web en vivo desde Railway (`server.url`) en vez de empaquetarla en el `.app` — si el servidor cae, la app no abre. Discutidas alternativas de hosting (Render como reemplazo más directo, Fly.io, Heroku, DigitalOcean, AWS/GCP) y el trade-off real de empaquetar la web local (protege de que la app no abra, pero pierde el despliegue instantáneo que estamos usando activamente — cualquier cambio pasaría a necesitar review de Apple). Recomendado NO empaquetar todavía, aparcado para revisar cuando el ritmo de cambios baje. Ver spec sección 58 para el detalle completo, incluida la vía intermedia de "live update" (Capgo/Appflow) sin investigar aún.

## PENDIENTES — Próximas sesiones

### Alta prioridad
1. ~~**Stats module**~~ — **CORREGIDO 2026-09-14**: NO es un placeholder, son 4761 líneas en producción (fichas, roster, eficiencia, comparador radar, bubble chart, game log). Este pendiente estaba obsoleto, descubierto por la auditoría de la sección 34. Existe un `Stats.tsx.bak` (907 líneas) que es probablemente el placeholder real que se sustituyó sin actualizar esta documentación — candidato a limpieza de arqueología, no investigado a fondo.
2. ~~**Playbook**~~ — **CORREGIDO 2026-09-14**: NO es un placeholder, son 1494 líneas en producción (hub de 4 secciones, wizard de sistema defensivo, lector de planes, vista jugadora). Mismo caso que Stats — pendiente obsoleto.
3. ~~**Desktop content density**~~ — **CORREGIDO 2026-09-14** (spec sección 35): `Home.tsx` ya tenía layout de 2 columnas real. El hueco real que quedaba, `Schedule.tsx` en modo `staffView === "planner"` (panel lateral apagado a propósito), se reactivó (`panel={desktopPanel}` sin condicionar a `staffView`) — Pablo confirmó reactivarlo tras revisar el hallazgo. Pendiente de que Pablo lo vea en un portátil real con datos, no se pudo verificar interactivamente (requiere sesión autenticada).

### Media prioridad
4. ~~**CoachHome desktop — densidad**~~ — **CORREGIDO** (ya antes de la auditoría del 2026-09-14, sin fecha exacta): las 3 `AlertSlot` de `CoachHome.tsx` (líneas 271-290) ya muestran próximo partido, contador de pendientes y conflictos.
5. ~~**Notificaciones**~~ — **PARCIAL 2026-09-14** (spec sección 45): 2 recordatorios diarios locales en iOS (scout reports, wellness) para jugadoras, hora configurable por el head coach en My Club. Sigue sin existir un sistema general de push/in-app para avisos ad-hoc del staff (p. ej. "entreno cancelado hoy") — el coach sigue usando WhatsApp externo para eso; sería remote push real (APNs), no local, alcance distinto y mayor coste (infraestructura de servidor + certificados de Apple).
6. ~~**Onboarding flow**~~ — **REVISADO 2026-09-14** (spec sección 42): en desktop el layout ya es correcto tal cual (tarjeta centrada `max-w-md`, mismo patrón que `Login.tsx`, apropiado para un wizard de un solo paso a la vez — no necesita ensancharse). Lo que sí era un hallazgo real y **crítico**, no anticipado por el pendiente original: `OnboardingFlow.tsx`, `Login.tsx`, `Join.tsx` y `JoinClub.tsx` (las únicas pantallas que se renderizan *antes* del shell de `ModuleNav`, por eso la auditoría de la sección 34 no las cubrió) usaban `min-h-[100dvh]` sin scroll real, anidadas dentro del wrapper raíz `overflow-hidden` de `App.tsx` — mismo mecanismo del hallazgo crítico de `Dashboard.tsx`. Con el teclado abierto en un móvil pequeño, los formularios de registro (`Login.tsx`/`JoinClub.tsx`) o el último paso del tutorial de onboarding podían quedar recortados sin forma de llegar al botón. Corregido en las 4 (`min-h-[100dvh]` → `h-[100dvh] overflow-y-auto`), verificado interactivamente en el navegador con viewport 380×300.
7. ~~**PlayerEditor desktop**~~ — **CORREGIDO 2026-09-14** (spec sección 35): Pablo eligió limitar el ancho. `<Tabs>` pasa de `w-full` a `w-full max-w-3xl mx-auto` — mismo formulario, ya no se estira a un ancho absurdo en pantallas anchas.
8. ~~**ModuleHeader en desktop**~~ — **CORREGIDO 2026-09-14** (spec sección 35): Pablo eligió la versión compacta. En `md:`+ el header pasa a una fila horizontal (logo 36px, más pequeño que en móvil) con wordmark/tagline en línea usando tamaños reales (`text-sm`/`text-xs`) que sí escalan, en vez de crecer 56px→88px con texto fijo en 10-11px. Móvil sin cambios.
9. ~~**`ScoutDesktop.tsx` — código muerto**~~ — **BORRADO 2026-09-14** (spec sección 35): Pablo eligió borrarlo del todo, confirmado sin importadores reales antes de eliminar. Ruta `/scout` en desktop sigue siendo `CoachHome.tsx` (igual que mobile).

### Baja prioridad / cosmético
9. ~~**ModCard "SOON" badge / Alert chips sub-text**~~ — **DESCARTADO 2026-09-14** (spec sección 43): premisa incorrecta. `HomeMobile.tsx` nunca renderiza en desktop — `Home.tsx` elige entre `HomeMobile`/`HomeDesktop` por JS (`useIsDesktop()`, mismo breakpoint 768px que `md:`), no son el mismo árbol con clases responsive. Un `md:text-[10px]` ahí sería CSS muerto, nunca se aplicaría. No hace falta ningún cambio.
10. ~~**Wellness Home player**~~ — **YA RESUELTO, pendiente obsoleto (verificado 2026-09-15)**: no es un simple "✓ enviado" — `HomeMobile.tsx`/`HomeDesktop.tsx` ya leen `sleep_quality`/`mental_readiness`/`energy_level` del día y muestran un mensaje contextual distinto según el valor (aviso si `sleep <= 2`, ánimo si `readiness`/`energy >= 4`, genérico en el resto) en vez de números en crudo — más legible que "😴 3/5 · ⚡ 4/5", decisión ya tomada antes de esta sesión, no se ha tocado.
11. ~~**Film Room discrepancy UX**~~ — **CORREGIDO 2026-09-15** (spec secciones 46-47): investigarlo destapó un bug real y más importante que la UX — confirmado por Pablo vía investigación de Claude Desktop (diseño original de abril): al publicar, el pick de "reemplazar alternativa" del entrenador que publica debía congelarse como versión final del informe, y en su lugar se borraba entero sin aplicarse a nada. Corregido: `report_overrides` ya no se borra al publicar (`clearScoutVersionsAfterPublish` sustituye a `mergeAndClearScoutVersions` ahí), `GET /api/players/:id/overrides` devuelve la versión congelada del entrenador que publicó cuando el informe ya está publicado (antes, una jugadora nunca podía ver ningún override — el filtro comparaba contra su propio id, que nunca es un `coachId`). El texto de ayuda original del `DiscrepancyPanel` queda como pendiente cosmético menor, ya no bloqueante.
12. ~~**Restos de marca antigua "U Scout"**~~ — **CORREGIDO 2026-09-14** (spec sección 43): no eran solo comentarios cosméticos como decía este pendiente (esos sí son inofensivos y se dejan). Encontrados 8 casos **visibles a usuarios reales**: los 4 títulos de tarjeta de módulo en el Home de móvil (`ucore_card_scout_title`/`_schedule_title`/`_stats_title` decían literalmente "U Scout"/"U Stats"/"U Schedule..." en los 3 idiomas; Playbook ni siquiera tenía clave i18n, `title="U Playbook"` fijo) y 3 más en `ClubManagement.tsx` (lista de módulos activables del club, y la etiqueta del selector de vista de informe por defecto). Corregidos reutilizando las claves `ucore_nav_*` ya establecidas (mismo texto que ya usa el sidebar desktop, sin inventar naming nuevo) — 224/224 pruebas, `npm run check` limpio.

### Técnico
14. **Icono Xcode** — Después de cada cambio de icono: eliminar app del dispositivo + Clean Build Folder + rebuild. El caché de iconos en iOS es agresivo.
15. ~~**Verificar tipografía en pages restantes**~~ — **CORREGIDO 2026-09-14** (auditoría sección 34): Personnel, PlayerHome, Dashboard (player), WellnessStandalone, y de paso ClubManagement, PlayerEditor, Stats, GamePlan, QuickScout, PlayerTeamList, Settings — ~205 instancias en total.
16. **[Decisión aparcada, no urgente] Web empaquetada local vs. carga remota en iOS** (2026-09-15, spec sección 58) — hoy la app de iOS carga la web en vivo desde Railway (`capacitor.config.ts::server.url`), no lleva nada empaquetado dentro. Si el servidor cae, la app no abre. Revisar cuando el ritmo de cambios/despliegues baje (hoy perder el despliegue instantáneo cuesta más de lo que protege) — candidato natural: plugins de "live update" (Capgo/Ionic Appflow) que permitirían empaquetar local sin perder la velocidad de iterar. No investigado a fondo todavía.
