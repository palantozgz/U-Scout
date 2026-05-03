# U Stats — UX Specification
> Documento de diseño previo a implementación. Aprobado antes de tocar Stats.tsx.
> Última actualización: 3 mayo 2026

---

## Principios de diseño

1. **Mobile portrait primero** — 375px, thumb zone inferior, navegación con una mano
2. **Landscape = profundidad** — shot chart, comparador y gráficas complejas fuerzan landscape
3. **Progresividad** — los datos más útiles arriba, los más complejos behind tap o scroll
4. **Sin mistaps** — acciones destructivas o de navegación mayor siempre separadas visualmente
5. **Vacío honesto** — cuando no hay datos, se explica por qué y cuándo llegarán

---

## Arquitectura de navegación

```
/stats  (entry — Stats.tsx)
├── Header: "U Stats · WCBA 2024-25 ▾"  (selector temporada, discreto)
├── Tab bar: Liga | Jugadoras | Equipos
│
├── /stats?tab=liga
│   ├── Segment: Clasificación | Líderes
│   ├── Clasificación → tabla vertical (rank · equipo · W-L · PPG · OPPG)
│   └── Líderes → toggle PPG/RPG/APG/SPG/BPG/FG%/3P%/FT% → lista top 10
│
├── /stats?tab=jugadoras
│   ├── Filtro equipo (dropdown, "Todos" default)
│   ├── Sort: PPG | RPG | APG (chips horizontales)
│   ├── Lista jugadoras → tap → /stats/player/:externalId
│   └── /stats/player/:externalId  (StatsPlayerSheet)
│       ├── Header: foto · nombre · equipo · dorsal
│       ├── Resumen: PPG / RPG / APG / SPG / BPG en 5 chips
│       ├── Radar 6 ejes (sparkline): PTS·REB·AST·STL·BLK·TO (tap para expandir)
│       ├── Game log: lista últimos 10 partidos (PTS/REB/AST · MIN · +/-)
│       ├── Shot chart: landscape-only, con rotate hint en portrait
│       └── [Comparar con...] → selector segunda jugadora → split view landscape
│
└── /stats?tab=equipos
    ├── Lista 18 equipos (logo · nombre · W-L · NET RTG)
    ├── tap → /stats/team/:externalId  (StatsTeamSheet)
    │   ├── Header: logo · nombre · record
    │   ├── Métricas: PACE · ORTG · DRTG · NET · eFG% · TS%
    │   ├── Plantilla: lista jugadoras con PPG/RPG/APG → tap → StatsPlayerSheet
    │   └── [Comparar con...] → selector segundo equipo → split view landscape
    └── (no shot chart a nivel equipo — solo hot zones agregadas, fase 2)
```

---

## Selector de temporada

**Ubicación:** Header de Stats.tsx, junto al título.
**Diseño:** `"2024-25 ▾"` — texto pequeño, semibold, con chevron. Al tap abre un sheet modal con las temporadas disponibles.
**Comportamiento:** Cambia `seasonId` en un context/estado global de Stats. Todas las vistas hijas lo consumen.
**Temporadas disponibles:** Las que tienen datos en `stats_games` (query dinámica).
**Default:** La más reciente con datos.

```tsx
// Header Stats
<div className="flex items-center gap-2">
  <h1>U Stats</h1>
  <button className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
    2024-25 <ChevronDown className="w-3 h-3" />
  </button>
</div>
```

---

## Gráficas — política de visibilidad

| Gráfica | Portrait | Landscape | Interacción |
|---------|----------|-----------|-------------|
| Sparkline 5 stats | ✅ visible siempre | ✅ | ninguna |
| Radar 6 ejes | 🔒 behind tap "Ver radar" | ✅ visible | tap para abrir/cerrar |
| Shot chart | ❌ rotate hint | ✅ visible | ninguna |
| Game log | ✅ lista compacta | ✅ tabla | tap fila = nada (datos inline) |
| Comparador | ❌ rotate hint | ✅ split 2 col | selector within sheet |

**Rotate hint:** Componente reutilizable `<LandscapeHint />` — icono de rotación + texto "Gira para ver" / "Rotate to view" / "横屏查看". Se muestra en lugar de la gráfica cuando `window.innerWidth < window.innerHeight`.

---

## Integración MyScout ↔ U Stats

**Condición:** Solo se muestra si existe un `stats_players.external_id` que matchee con la jugadora canónica. El match se hace por nombre (name_zh o name_en) — no hay FK directa entre `players` y `stats_players`.

**Match logic (server):**
```sql
SELECT external_id, name_zh, name_en
FROM stats_players
WHERE name_zh = $playerName OR name_en = $playerName
LIMIT 1
```

**Endpoint nuevo:** `GET /api/stats/player-link?name=X` → `{ externalId: string | null, ppg, rpg, apg }`

**UI en MyScout (ficha canónica expandida):**
```tsx
{statsLink && (
  <button
    onClick={() => navigate(`/stats?player=${statsLink.externalId}`)}
    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 w-full text-left"
  >
    <div className="flex gap-3 text-xs font-black tabular-nums text-foreground">
      <span>{statsLink.ppg.toFixed(1)} <span className="font-normal text-muted-foreground">PPG</span></span>
      <span>{statsLink.rpg.toFixed(1)} <span className="font-normal text-muted-foreground">RPG</span></span>
      <span>{statsLink.apg.toFixed(1)} <span className="font-normal text-muted-foreground">APG</span></span>
    </div>
    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
  </button>
)}
```

**Anti-mistap:** El chip está ENTRE el nombre y los botones de acción (Ver informe / Editar). Visualmente es datos, no CTA. Color de fondo neutro (muted), sin color primary. El tap lleva a Stats con deep link — se puede volver con back.

**Deep link desde MyScout:** `/stats?tab=jugadoras&player=EXTERNAL_ID` → Stats.tsx detecta el param y abre directamente `StatsPlayerSheet` de esa jugadora.

---

## Comparador — diseño anti-fricción

**Entrada:** Desde dentro de `StatsPlayerSheet` o `StatsTeamSheet`, botón secundario en el footer.
**Flujo:**
1. Usuario está en ficha de Jugadora A
2. Tap "Comparar con..." → sheet modal con lista de jugadoras
3. Selecciona Jugadora B → rotate hint si portrait → en landscape: split 2 columnas

**Split layout landscape:**
```
┌──────────────────┬──────────────────┐
│  Jugadora A      │  Jugadora B      │
│  8.2 PPG         │  12.4 PPG        │
│  5.1 RPG         │  3.2 RPG         │
│  [radar]         │  [radar]         │
│  [game log]      │  [game log]      │
└──────────────────┴──────────────────┘
```

**Anti-mistap:** El botón "Comparar con..." es ghost/outline, en el footer de la sheet, claramente secundario respecto a "Editar ficha scout" (si viene de MyScout) o a los datos principales.

---

## Componentes nuevos necesarios

| Componente | Descripción | Prioridad |
|------------|-------------|-----------|
| `SeasonPicker` | Dropdown temporada en header Stats | P1 |
| `StatsPlayerSheet` | Ficha completa jugadora (radar+log+shot) | P1 |
| `StatsTeamSheet` | Ficha completa equipo | P2 |
| `LandscapeHint` | Rotate to view prompt | P1 |
| `StatsMiniChip` | Chip 3 stats para MyScout link | P1 |
| `StatsRadar` | Radar 6 ejes con recharts | P2 |
| `StatsComparator` | Split view landscape | P3 |
| `ShotChart` | Hexbin media pista landscape | P3 |

---

## Endpoints Railway necesarios

| Endpoint | Estado | Descripción |
|----------|--------|-------------|
| `GET /api/stats/players` | ✅ | Promedios temporada |
| `GET /api/stats/games` | ✅ | Game log por jugadora |
| `GET /api/stats/teams` | ✅ | Lista equipos |
| `GET /api/stats/standings` | ❌ | Clasificación con W-L-PCT |
| `GET /api/stats/leaders` | ❌ | Top 10 por stat |
| `GET /api/stats/player/:id` | ❌ | Ficha individual con métricas avanzadas |
| `GET /api/stats/team/:id` | ❌ | Ficha equipo con PACE/ORTG/DRTG |
| `GET /api/stats/player-link` | ❌ | Match nombre → externalId + 3 stats |
| `GET /api/stats/seasons` | ❌ | Temporadas con datos disponibles |

---

## Orden de implementación

**Fase 1 — Datos funcionales (esta semana)**
1. Confirmar sync completo (pbp + player_boxscores > 0)
2. `GET /api/stats/standings` — clasificación real
3. `GET /api/stats/leaders` — líderes por stat
4. `GET /api/stats/player-link` — integración MyScout
5. `SeasonPicker` + `LandscapeHint` + `StatsMiniChip` en MyScout

**Fase 2 — Vistas principales**
6. Stats.tsx refactor: tab bar Liga | Jugadoras | Equipos
7. `StatsPlayerSheet` — ficha jugadora (sin radar, sin shot chart)
8. `StatsTeamSheet` — ficha equipo
9. Deep link desde MyScout → Stats player sheet

**Fase 3 — Visualizaciones**
10. `StatsRadar` con recharts (6 ejes, portrait behind tap)
11. Shot chart landscape (hexbin, recharts o canvas)
12. `StatsComparator` landscape split

---

## Notas técnicas

- **State management:** `seasonId` en URL param o React context, no Zustand. Persiste en navegación.
- **Caché:** TanStack Query staleTime=5min para standings/leaders, staleTime=60s para live si hay partido.
- **Sin localStorage** — restricción conocida de artifacts/app.
- **Recharts** — ya en bundle. Usar para radar y sparklines. Shot chart con SVG custom o canvas.
- **Landscape detection:** `window.innerWidth > window.innerHeight` en un hook `useIsLandscape()` con resize listener.
- **Deep link:** Stats.tsx lee `useSearch()` de wouter para params `?tab=&player=&team=`.
