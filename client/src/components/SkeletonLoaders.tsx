/**
 * Skeleton loaders para las pantallas principales de U Core.
 *
 * Diseño:
 * - Usamos bg-muted/60 + animate-pulse (Tailwind) para consistencia con el theme.
 * - Cada skeleton refleja la estructura REAL de la pantalla que está cargando.
 *   Un usuario que vea el skeleton sabe exactamente qué va a aparecer.
 * - Sin spinners: el spinner cenital rompe la continuidad visual entre
 *   "cargando" y "cargado". El skeleton no.
 */

function SkeletonLine({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} rounded-md bg-muted/60 animate-pulse`} />;
}

function SkeletonAvatar({ size = "w-10 h-10" }: { size?: string }) {
  return <div className={`${size} rounded-full bg-muted/60 animate-pulse flex-shrink-0`} />;
}

// ─── MyScout — lista de jugadoras rivales ─────────────────────────────────────
function SkeletonPlayerRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <SkeletonLine w="w-32" h="h-4" />
        <SkeletonLine w="w-20" h="h-3" />
      </div>
      <SkeletonLine w="w-16" h="h-6" />
    </div>
  );
}

export function SkeletonMyScout() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header del equipo */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <SkeletonAvatar size="w-8 h-8" />
        <SkeletonLine w="w-40" h="h-5" />
      </div>
      {/* Lista de jugadoras */}
      {Array.from({ length: 7 }).map((_, i) => (
        <SkeletonPlayerRow key={i} />
      ))}
    </div>
  );
}

// ─── Stats — tabla de standings / lista de jugadoras ─────────────────────────
function SkeletonStatsRow({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40">
      <SkeletonLine w="w-5" h="h-4" />
      <SkeletonAvatar size="w-7 h-7" />
      <SkeletonLine w={wide ? "w-36" : "w-24"} h="h-4" />
      <div className="ml-auto flex gap-4">
        <SkeletonLine w="w-8" h="h-4" />
        <SkeletonLine w="w-8" h="h-4" />
        <SkeletonLine w="w-8" h="h-4" />
        <SkeletonLine w="w-10" h="h-4" />
      </div>
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Tabs placeholder */}
      <div className="flex gap-2 px-4 py-3 border-b border-border">
        {["w-16", "w-20", "w-16"].map((w, i) => (
          <div key={i} className={`${w} h-8 rounded-md bg-muted/60 animate-pulse`} />
        ))}
      </div>
      {/* Header columnas */}
      <div className="flex gap-4 px-4 py-2 border-b border-border">
        <SkeletonLine w="w-full" h="h-3" />
      </div>
      {/* Filas */}
      {Array.from({ length: 9 }).map((_, i) => (
        <SkeletonStatsRow key={i} wide={i % 3 === 0} />
      ))}
    </div>
  );
}

// ─── Schedule — semana de sesiones ────────────────────────────────────────────
function SkeletonEventCard() {
  return (
    <div className="mx-4 mb-3 rounded-xl border border-border/50 bg-card p-4 space-y-2">
      <div className="flex justify-between items-center">
        <SkeletonLine w="w-28" h="h-4" />
        <SkeletonLine w="w-16" h="h-4" />
      </div>
      <SkeletonLine w="w-48" h="h-3" />
      <div className="flex gap-2 pt-1">
        <SkeletonLine w="w-14" h="h-6" />
        <SkeletonLine w="w-14" h="h-6" />
      </div>
    </div>
  );
}

export function SkeletonSchedule() {
  return (
    <div className="flex-1 flex flex-col pt-2">
      {/* Day label */}
      <div className="px-4 pb-2">
        <SkeletonLine w="w-24" h="h-4" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonEventCard key={i} />
      ))}
      {/* Second day */}
      <div className="px-4 pb-2 pt-2">
        <SkeletonLine w="w-20" h="h-4" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <SkeletonEventCard key={i + 10} />
      ))}
    </div>
  );
}
