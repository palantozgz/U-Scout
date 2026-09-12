/**
 * Motor 1.0 — contrato de tipos de Fase 0.
 *
 * Transcripción literal del contrato cerrado en `docs/motor-1.0-spec.md`, sección
 * 14.2 bis (con las 3 decisiones de producto y las 2 correcciones de 15.7b ya
 * incorporadas). No hay lógica de cálculo aquí todavía — eso es Fase 1. Este
 * archivo es el punto de partida: los tipos que Fase 1 debe implementar contra,
 * y que sustituirán a los tipos equivalentes de `motor-v2.1.ts`/`motor-v4.ts`/
 * `mock-data.ts` cuando la migración de consumidores (Fase 3) esté lista.
 *
 * Para el porqué de cada decisión de forma (por qué unión discriminada por `modo`,
 * por qué `OutputKey` es un branded string, etc.), ver las "Notas de justificación
 * de El Arquitecto" inmediatamente después del bloque de tipos en 14.2 bis del
 * documento de spec — no se repiten aquí para no duplicar una fuente de verdad.
 *
 * No importar desde `motor-v2.1.ts`/`motor-v4.ts`/`mock-data.ts` — este archivo
 * es intencionalmente independiente de los motores legacy que sustituye.
 */

// ---------------------------------------------------------------------------------
// 0. PRIMITIVAS COMPARTIDAS
// ---------------------------------------------------------------------------------

/**
 * Las 11 situaciones estándar de Synergy (spec 12.1), verificadas 1:1 sin huecos
 * ni sobrantes: iso=Isolation, pnrHandler=PnR Ball Handler, pnrRollMan=PnR Roll Man,
 * post=Post-Up, transition=Transition, spotUp=Spot-Up, handoff=Handoff, cut=Cut,
 * offScreen=Off-Screen, putback=Putback, misc=Miscellaneous.
 */
export type SituacionSynergy =
  | "iso" | "pnrHandler" | "pnrRollMan" | "post" | "transition"
  | "spotUp" | "handoff" | "cut" | "offScreen" | "putback" | "misc";

/**
 * Los 10 archetypeKey de la spec 14.3 (Synergy Offensive Roles adaptado y
 * validado contra terminología real de baloncesto en español). Union literal,
 * no `string` — un typo o un valor fuera de catálogo debe fallar en compilación.
 */
export type ArchetypeKey =
  | "armadora_creadora" | "armadora_anotadora" | "manejadora_secundaria"
  | "alero_penetradora" | "alero_tiradora" | "alero_movimiento"
  | "interior_creadora" | "interior_poste" | "interior_abridora" | "interior_finalizadora";

/**
 * Modificador excepcional de archetype (spec 14.3 bis, 2026-09-12) — segunda
 * dimensión que Pablo pidió ("archetype + adjetivo para jugadores modernos"),
 * diseñada por El Arquitecto. Deliberadamente cerrado a 2 valores, no
 * genérico: cada uno cubre un eje que el `ArchetypeKey`/`SituacionAmenaza[]`
 * no puede decir por sí solos (on-ball vs. off-ball; con el ataque montado
 * vs. antes de que se monte). Dispara en ~21% de perfiles reales (3/14) — es
 * la excepción, no el caso normal; ausente (`undefined`) es lo esperado la
 * mayoría de las veces (límite de carga cognitiva, spec 16.3b).
 *
 * `3_y_D` NO está en este catálogo a propósito: `PlayerInputs`
 * (`motor-v2.1.ts`) no tiene ningún campo de observación defensiva — sería
 * una etiqueta que el motor no puede derivar de ningún dato real hoy.
 */
export type ModificadorArchetype = "de_movimiento" | "a_la_contra";

/**
 * Naming nuevo de outputs individuales (deny/force/allow/aware). Branded string,
 * no `string` plano ni union literal todavía: el catálogo exacto (`OUTPUT_CATALOG`)
 * depende del mapeo campo-por-campo de spec 13.4/15.1, que sigue abierto. El brand
 * evita mezclar por error un `SituacionSynergy` o `ArchetypeKey` donde se espera
 * un `OutputKey` sin fingir que el catálogo ya está cerrado.
 */
export type OutputKey = string & { readonly __brand: "OutputKey" };

/**
 * Posición de la jugadora — 3 grupos (Base/Alero/Interior), no 5 posiciones NBA.
 * Decisión de spec 14.2 bis #2: con 236 jugadoras totales de muestra, 5 grupos
 * dejarían buckets demasiado pequeños para que la contracción bayesiana (12.3)
 * funcione bien. Coincide con el agrupamiento de `ArchetypeKey`.
 */
export type PosicionJugadora = "base" | "alero" | "interior";

export type EscalaCualitativa = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------------
// 1. NIVEL 1 — observación del staff (spec 13.1). Nunca inferido, nunca calculado.
// ---------------------------------------------------------------------------------

/**
 * Campo de Nivel 1 con procedencia explícita: observación pura del staff, o
 * autorrelleno editable desde un proxy real de Nivel 2 (spec 15.4). No todo campo
 * de Nivel 1 acepta `autorrelleno_proxy` — hoy solo `ftShooting`/`foulDrawing`
 * (ver `PerfilFisicoYTiros` abajo); TypeScript no puede restringir `proxyFuente`
 * por campo sin duplicar casi el tipo entero, así que se valida en Fase 1
 * (test/assert), no aquí.
 */
export type CampoNivel1<T> =
  | { origen: "staff"; valor: T }
  | { origen: "autorrelleno_proxy"; valor: T; proxyFuente: "ftPct" | "ftaRate"; editadoPorStaff: boolean };

/**
 * Sección "Perfil físico / Tiros libres" del formulario (spec 15.1) — NO es
 * por-situación, por eso vive separada de `StaffObservation`. `athleticism` y
 * `physicalStrength` nunca tienen proxy (spec 15.4: sin dato de tracking físico
 * real, no forzar un autorrelleno falso); `ftShooting`/`foulDrawing` sí.
 */
export interface PerfilFisicoYTiros {
  athleticism: CampoNivel1<EscalaCualitativa>;
  physicalStrength: CampoNivel1<EscalaCualitativa>;
  ftShooting: CampoNivel1<EscalaCualitativa>;
  foulDrawing: CampoNivel1<EscalaCualitativa>;
}

/**
 * Una entrada por cada una de las 11 situaciones — siempre las 11, incluso las
 * no marcadas en el paso 1 del flujo de captura (spec 15.3); esas quedan con
 * `frecuencia: "N"` y `camposObservados: {}` sin que el staff tenga que
 * confirmarlo campo a campo.
 *
 * `camposObservados` se deja como `Record<string, unknown>` deliberadamente: el
 * mapeo campo-por-campo de los ~72 campos reales del formulario está hecho (spec
 * 15.7, 67 mantener / 4 candidatos a recortar / 1 dudoso) pero tipar cada uno
 * exhaustivamente aquí es trabajo de Fase 1, no de este contrato base. Todo campo
 * aquí es observación pura del staff (`neverInfer`) — a diferencia de
 * `PerfilFisicoYTiros`, ningún campo por-situación tiene proxy de Nivel 2.
 */
export interface StaffObservation {
  situacion: SituacionSynergy;
  /** Principal / Secundaria / Rara / Nunca */
  frecuencia: "P" | "S" | "R" | "N";
  camposObservados: Record<string, unknown>;
}

export interface IdentidadInput {
  nombre: string;
  posicion: PosicionJugadora;
  alturaCm: number;
  pesoKg: number;
  manoDominante: "I" | "D" | "Ambidiestra";
  /** String, no number — los dorsales no son puramente numéricos (verificado
   *  contra `mock-data.ts:316`, hallazgo 15.7.2). */
  numero: string;
  /** Opcional — no toda jugadora tiene foto cargada (hallazgo 15.7.2). */
  fotoUrl?: string;
  /** Afecta score real: multiplicador `starMod = 1.05` en el motor legacy
   *  (`motor-v2.1.ts:973`, hallazgo 15.7.2). */
  esEstrella?: boolean;
  // SIN archetypeKey aquí — el archetype es Nivel 3 (inferido), nunca un input
  // directo que el staff teclee. Ver `IdentidadReporte` más abajo.
}

export interface PlayerProfileV1Inputs {
  version: "1.0";
  jugadoraId: string;
  identidad: IdentidadInput;
  /** Vínculo opcional a U Stats (spec 5.1-5.2, 14.1.1) — ausente si la jugadora
   *  no juega en la WCBA. El motor debe funcionar idéntico sin esto. */
  wcbaExternalId?: string;
  /** Id de jugadora propia — respuesta a la pregunta 4 del framework (14.1.4). */
  emparejamientoDefensivo?: string;
  perfilFisicoYTiros: PerfilFisicoYTiros;
  /** Paso 1 del flujo de captura (spec 15.3) — máximo recomendado 3-4, aviso
   *  no bloqueante, no una restricción de tipo. */
  situacionesSeleccionadas: SituacionSynergy[];
  /** Siempre 11 entradas — una por cada `SituacionSynergy`. */
  observaciones: StaffObservation[];
  formaReciente?: "hot" | "cold" | "stable";
  generadoOffline?: boolean;
  /** ISO datetime — spec 18.2-18.3. */
  sincronizadoEn?: string;
}

// ---------------------------------------------------------------------------------
// 2. NIVEL 2 — dato real de U Stats (spec 13.1, sección 5). Nunca "pelado".
// ---------------------------------------------------------------------------------

export interface StatConVolumen {
  valor: number;
  /** Por posición (spec 10.2 bis: 3 grupos Base/Alero/Interior, calculado contra
   *  datos reales de `pbp_player_game_stats`, 236 jugadoras). */
  percentil: number;
  /** Tras contracción bayesiana (spec 12.3). */
  percentilAjustadoPorMuestra: number;
  volumenIntentos: number;
  ventana: "temporada" | "ultimos_12";
}

export interface PlayerRealStats {
  ppg: StatConVolumen;
  rpg: StatConVolumen;
  apg: StatConVolumen;
  spg: StatConVolumen;
  bpg: StatConVolumen;
  fg3Pct: StatConVolumen;
  efgPct: StatConVolumen;
  tsPct: StatConVolumen;
  usgPct: StatConVolumen;
  tovPct: StatConVolumen;
  /** Proxy de `ftShooting` (spec 15.4). */
  ftPct: StatConVolumen;
  /** Proxy de `foulDrawing` (spec 15.4). */
  ftaRate: StatConVolumen;
  // NOTA: no incluye PIE ni ORTG/DRTG individual todavía. PIE tiene fórmula real
  // verificada (spec 10.3 bis, `server/routes.ts:2244-2338`) pendiente de
  // incorporar aquí en una siguiente revisión del contrato. ORTG/DRTG individual
  // NO existe en el código actual (solo a nivel de equipo, spec 10.3 bis) — no
  // añadir un campo para algo que Motor 1.0 no puede prometer todavía.
}

// ---------------------------------------------------------------------------------
// 3. NIVEL 3 — inferido por el motor (spec 13.1). Nunca observación directa.
// ---------------------------------------------------------------------------------

/**
 * Detección de discrepancia Nivel 1 vs Nivel 2 (spec 13.1) — el motor NUNCA
 * autocorrige, solo avisa. `soloAviso: true` fija esa garantía a nivel de tipo,
 * no solo de comentario.
 */
export interface DiscrepanciaNivel1Nivel2 {
  /** Ref. al campo observado, ej. `"iso.frecuencia"`. */
  campoNivel1: string;
  valorNivel1: unknown;
  campoNivel2: keyof PlayerRealStats;
  valorNivel2: StatConVolumen;
  /** Texto generado, ej. "staff marcó ISO:Nunca pero USG% real está en P90". */
  motivo: string;
  soloAviso: true;
}

// ---------------------------------------------------------------------------------
// 4. OUTPUTS — deny/force/allow/aware, con confianza y candidatos rankeados
//    (spec 13.2, 17.1)
// ---------------------------------------------------------------------------------

export interface DefenseOutput {
  key: OutputKey;
  categoria: "deny" | "force" | "allow" | "aware";
  situacionOrigen: SituacionSynergy;
  /** 0..0.72 — cap anti-inflación (spec sección 3). */
  score: number;
  confianza: "alta" | "media" | "baja";
  /** "Por qué" de una línea citando Nivel 2 si existe (spec 15.5). */
  porque?: string;
}

export interface OutputCandidato {
  output: DefenseOutput;
  score: number;
  /** 0 = ganador. */
  rank: number;
}

/**
 * El motor NUNCA devuelve solo el ganador (spec 17.1). Solo
 * `deny`/`force`/`allow`/`accionPrincipal` se envuelven así (decisión de
 * producto #1 de 14.2 bis) — `quietEdge` y `capa1.situaciones` no, porque no
 * son productos de una competencia con score dentro del sistema deny/force/
 * allow/aware.
 */
export interface CampoConCandidatos {
  ganador: DefenseOutput;
  /** Incluye al ganador en rank 0. */
  candidatos: OutputCandidato[];
}

/**
 * Ranking de amenaza por situación ("¿qué hará?", capa 1) — NO tocable (decisión
 * #1), NO es un `DefenseOutput` (eso es deny/force/allow/aware): confundir ambos
 * conceptos obligaría a rellenar `categoria` sin sentido.
 */
export interface SituacionAmenaza {
  situacion: SituacionSynergy;
  /** 0..0.72 — mismo cap que `DefenseOutput.score`. */
  score: number;
  frecuenciaObservada: "P" | "S" | "R" | "N";
}

/**
 * Selección de "quiet edge" (spec 13.2) — solo ocultable (decisión #1), sin
 * candidatos rankeados. Puede ser un output cualitativo o una métrica de Nivel 2;
 * en ambos casos hay que saber CUÁL, no solo el valor suelto.
 */
export type QuietEdgeSeleccion =
  | { tipo: "cualitativo"; output: DefenseOutput }
  | { tipo: "estadistico"; campo: keyof PlayerRealStats; stat: StatConVolumen };

export interface QuietEdge {
  seleccion: QuietEdgeSeleccion;
  motivo: "inesperado_para_posicion";
}

/**
 * Chip de stat destacado (spec 10.1-10.3 ter) — presente en ambos modos
 * (decisión #3 de 14.2 bis). El copy en UI usa solo métrica + valor
 * (ej. "TS% 61%"); la comparación contra la liga va en texto secundario al
 * expandir, no en el mismo chip (spec 10.3 ter, estándar de sistemas de diseño:
 * chips a 1-3 palabras, máximo 5).
 */
export interface StatDestacado {
  campo: keyof PlayerRealStats;
  stat: StatConVolumen;
  /** P85 / P95 (spec 10.1). */
  nivel: "destacado" | "elite";
}

// ---------------------------------------------------------------------------------
// 5. REPORTE — exclusión modo sencillo / completo (spec 13.3, 14.1.5)
// ---------------------------------------------------------------------------------

export interface IdentidadReporte extends IdentidadInput {
  /** Nivel 3, inferido — nunca input directo. */
  archetypeKey: ArchetypeKey;
  /**
   * Excepcional (spec 14.3 bis) — ausente es el caso normal (~79% de
   * perfiles reales). Se renderiza SIEMPRE fusionado en la etiqueta de
   * archetype ("Alero tiradora de movimiento"), nunca como chip/elemento
   * visual propio — evita el error ya documentado de `motor-v4.ts`
   * (`archetypeCandidates`/"También: X" en `ReportSlidesV1.tsx`, que
   * repetía la situación top sin añadir información, exactamente lo que P2
   * de 21.7 prohíbe).
   */
  archetypeModificador?: ModificadorArchetype;
  /**
   * Obligatorio, no opcional — `detectarArchetype()` ya lo calcula siempre;
   * antes de esta sesión se descartaba (`motor-v1.ts`, solo se usaba `.key`).
   * Alimenta el flujo de revisión del entrenador (17.1/17.3) — NUNCA se
   * muestra a la jugadora ("confianza baja" no es información accionable
   * para quien va a jugar el partido).
   */
  archetypeConfianza: "alta" | "media" | "baja";
  /** Presente en ambos modos (decisión #3): 0-3 en completo, 0-1 en sencillo
   *  (spec 10.3.4). */
  statsDestacados: StatDestacado[];
  /** Presente en ambos modos (decisión #3); ausente si no hay dato suficiente. */
  quietEdge?: QuietEdge;
}

export interface ScoutingReportBaseV1 {
  version: "1.0";
  jugadoraId: string;
  wcbaExternalId?: string;
  /** SIEMPRE primero, SIN acción, en ambos modos. */
  identidad: IdentidadReporte;
  emparejamientoDefensivo?: string;
  generadoOffline?: boolean;
  sincronizadoEn?: string;
}

/**
 * Modo sencillo: identidad + `accionPrincipal` (el winner de deny). Es el ÚNICO
 * campo exclusivo de este modo (decisión #3 de 14.2 bis) — la resolución del
 * conflicto de spec 13.3 no afecta a `statsDestacados`/`quietEdge`, que ya
 * existían en el formato de 3 slides antes de que existiera ese conflicto.
 */
export interface ReporteModoSencilloV1 extends ScoutingReportBaseV1 {
  modo: "sencillo";
  /**
   * El "winner" de deny, con candidatos (spec 17.1). Opcional — CORREGIDO
   * 2026-09-12: puede faltar si ninguna situación supera el peso mínimo que
   * motor-v2.1.ts exige para que un deny "merezca" mostrarse (0.35, ver 21.9).
   * `[PENDIENTE PRODUCTO]`: qué debe verse en Capa 0 en ese caso — no
   * decidido aquí, ver nota en `motor-v1.ts::ensamblarReporte`.
   */
  accionPrincipal?: CampoConCandidatos;
}

/**
 * Modo completo: identidad (sin acción) → capa1 (qué hará) → capa2 (qué hago
 * yo, completo) → capa3 (stats). Orden fijo ya aprobado, SIN acción adelantada
 * — el mecanismo de retención de atención de spec 13.3 se preserva intacto.
 */
export interface ReporteModoCompletoV1 extends ScoutingReportBaseV1 {
  modo: "completo";
  capa1: {
    /** Ordenado por amenaza, no tocable (decisión #1). */
    situaciones: SituacionAmenaza[];
    emparejamientoDefensivo?: string;
  };
  capa2: {
    /**
     * Opcional — CORREGIDO 2026-09-12: verificado con datos reales que
     * motor-v2.1.ts exige `weight >= 0.35` para que un output de deny
     * "merezca" mostrarse (línea 2457) — una jugadora de muy bajo impacto
     * ofensivo puede no tener ninguna situación que lo supere, y el legacy
     * correctamente no recomienda nada en ese caso (spec 21.9).
     */
    deny?: CampoConCandidatos;
    /**
     * `force`/`allow` opcionales — CORREGIDO 2026-09-11 al implementar Fase 1:
     * el boceto original (y el primer cierre de 14.2 bis) los daba por
     * siempre presentes. Verificado contra los 10 perfiles reales de
     * `test-profiles.json`: `force` falta en 4 de 10, `allow` en 2 de 10 —
     * no es un caso raro, es una fracción real de perfiles. Forzar un
     * fallback (ej. reusar `deny`) sería mostrarle al entrenador una
     * recomendación de force/allow que el motor nunca generó. `deny` se deja
     * obligatorio porque en la práctica siempre existe al menos un output de
     * deny con weight > 0 en los 10 perfiles de referencia.
     */
    force?: CampoConCandidatos;
    allow?: CampoConCandidatos;
    /**
     * Tupla acotada, no array — el límite de 2 AWARE no es preferencia de UI,
     * está anclado al límite de memoria de trabajo de Cowan (4±1, spec 16.3b).
     * Un array genérico permitiría violarlo por error de programación.
     */
    aware: [] | [CampoConCandidatos] | [CampoConCandidatos, CampoConCandidatos];
  };
  /** Ausente si no hay vínculo a U Stats (spec 14.1.1). */
  capa3?: PlayerRealStats;
}

/** Unión discriminada por `modo` — imposible acceder a `accionPrincipal` desde
 *  una rama de modo completo, o viceversa, sin que TypeScript lo bloquee. */
export type ScoutingReportV1 = ReporteModoSencilloV1 | ReporteModoCompletoV1;

// ---------------------------------------------------------------------------------
// 6. SOPORTE PARA EL FLUJO DE APROBACIÓN (spec 17.1-17.2) — no bloqueante para
//    el núcleo de cálculo de Fase 1, pero forma parte del contrato de datos.
// ---------------------------------------------------------------------------------

/**
 * Identifica el campo tocable exacto (spec 17.2: "qué campo exacto difiere").
 * Solo cubre los 4 campos tocables de la decisión #1 — `quietEdge`/situaciones
 * no aparecen aquí porque no son sustituibles, solo ocultables en presentación.
 */
export type CampoTocable =
  | { tipo: "deny" | "force" | "allow" | "accionPrincipal" }
  | { tipo: "aware"; indice: 0 | 1 };

/** Nombres ya fijados en spec 17.2, sin traducir. */
export type AccionRevision = "replace" | "hide" | "approve_as_is";

export interface EventoRevisionCampo {
  reportId: string;
  campo: CampoTocable;
  action: AccionRevision;
  original_score: number;
  /** Ausente si `action === "hide"`. */
  replacement_score?: number;
  outputOriginalKey: OutputKey;
  outputElegidoKey?: OutputKey;
  rankElegido?: number;
  /** NUNCA expuesto nominalmente en el panel global — responsabilidad de la capa
   *  de presentación, no de este tipo (spec 17.2). */
  entrenadorId: string;
  /** ISO datetime. */
  timestamp: string;
  // Deliberadamente SIN jugadoraId/nombre de la jugadora rival — no se registra
  // nunca en eventos de calibración (spec 17.2).
}

/**
 * Vista agregada para calibración (Nivel B de aprendizaje, spec 17.3) — por
 * construcción de tipo, no puede llevar identidad de jugadora ni entrenador
 * nominal.
 */
export interface PatronCalibracion {
  archetypeKey: ArchetypeKey;
  campo: CampoTocable;
  action: AccionRevision;
  ocurrencias: number;
  /** `original_score - replacement_score`, promedio (spec 17.2). */
  gapPromedio: number;
}
