// ─── U Scout i18n system ──────────────────────────────────────────────────────
//
// HOW TO USE:
//   In components:     const { t } = useLocale()  →  {t("my_key")}
//   Outside components (rare): import { t } from "@/lib/i18n"
//
// HOW TO ADD A NEW KEY:
//   1. Add the key to the EN block below (this is the source of truth)
//   2. TypeScript will immediately flag missing keys in ES and ZH blocks
//   3. Add translations in ES and ZH
//   4. Use t("my_key") in the component
//
// HOW TO ADD A NEW LANGUAGE:
//   1. Add the locale to the Locale type: "en" | "es" | "zh" | "fr"
//   2. Create a new const block: const fr: typeof en = { ... }
//   3. Add to translations map: const translations = { en, es, zh, fr }
//   4. Add to Settings selector
//
// CONVENTION:
//   - Snake_case keys
//   - Group keys by section with comments
//   - SelectItem option keys: opt_{section}_{value_slug}
//   - Tooltip keys: hint_{field_name} (already in FieldLabel tooltip= props)
//   - Outputs from the motor stay in English — professional standard
//
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";

export type Locale = "en" | "es" | "zh";
// To add a language: extend this type and add a new translation block below.

// ─── ENGLISH — source of truth ────────────────────────────────────────────────
const en = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  sign_in: "Sign in",
  sign_up: "Create account",
  email: "Email",
  password: "Password",
  full_name: "Full name",
  team_code: "Team code",
  team_code_hint: "Ask your coach for the team code.",
  already_have_account: "Already have an account?",
  no_account: "Don't have an account?",
  role_coach: "Coach",
  role_player: "Player",
  language: "Language",

  // ── Navigation ────────────────────────────────────────────────────────────
  coach_mode: "Coach Mode",
  player_mode: "Player Mode",
  scouting: "Scouting",
  settings: "Settings",
  back: "Back",

  // ── Actions ───────────────────────────────────────────────────────────────
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  create: "Create",
  edit: "Edit",
  confirm: "Confirm",
  not_observed: "Not observed",
  more: "More",
  less: "Less",
  saving: "saving",

  // ── Dashboard ─────────────────────────────────────────────────────────────
  no_players: "No players yet.",
  add_first_player: "Add first player",
  new_team_name: "New Team Name",
  create_team: "Create Team",
  add_team: "+ Team",
  add_player: "+ Player",
  approved: "Approved",
  draft: "Draft",
  conflict: "Conflict",
  delete_team: "Delete team?",

  // ── Player editor tabs ────────────────────────────────────────────────────
  tab_context: "Context",
  tab_post: "Post",
  tab_iso: "ISO",
  tab_pnr: "PnR",
  tab_offball: "Off-Ball",

  // ── Context tab ───────────────────────────────────────────────────────────
  identity: "Identity",
  player_name: "Player Name",
  team: "Team",
  number: "Number",
  position: "Position",
  height: "Height",
  weight: "Weight",
  physical_profile: "Physical Profile",
  athleticism: "Athleticism / Explosiveness",
  physical_strength: "Physical Strength / Contact",
  court_vision: "Court Vision / Playmaking IQ",
  free_throws_fouling: "Free Throws & Fouling",
  ft_shooting: "Free throw shooting (%)",
  foul_drawing: "Foul drawing frequency",

  // ── Post tab ──────────────────────────────────────────────────────────────
  post_frequency: "Post-Up Frequency",
  post_dominant_hand: "Dominant post hand",
  post_profile: "Interior game profile",
  post_moves_quadrant: "Moves by quadrant",
  post_duck_in: "Duck-in frequency",
  post_double_team: "Double team reaction",
  right_hand: "Right hand",
  left_hand: "Left hand",

  // ── ISO tab ───────────────────────────────────────────────────────────────
  iso_frequency: "ISO Frequency",
  iso_interior_style: "Interior ISO style",
  iso_primary_style: "Primary ISO style",
  iso_perimeter_threat: "Perimeter threat",
  iso_dominant_direction: "Dominant ISO direction",
  iso_initiation: "Initiation style",
  iso_decision: "Decision after creating advantage",
  iso_offhand_finish: "Off-hand finish",
  closeout_general: "Closeout Reaction (General)",
  directional_closeout: "Per-wing override",
  left_wing: "⬅️ Left Wing",
  right_wing: "➡️ Right Wing",

  // ── PnR tab ───────────────────────────────────────────────────────────────
  pnr_frequency: "PnR Frequency",
  pnr_role: "PnR Role",
  pnr_primary_role: "Primary role when both",
  pnr_scoring_priority: "Scoring vs passing priority",
  pnr_reaction_under: "Reaction vs under coverage",
  pnr_timing: "PnR timing",
  pnr_screener_action: "Primary screener action",
  pnr_screener_action_secondary: "Secondary action (optional)",
  pnr_direction: "Direction tendency",
  pnr_finish_dominant: "Dominant side finish",
  pnr_finish_opposite: "Opposite side finish",
  as_handler: "As Handler",
  as_screener: "As Screener",
  finish_by_direction: "Finish by direction",
  handler: "Handler",
  screener: "Screener",
  both: "Both",

  // ── Off-ball tab ──────────────────────────────────────────────────────────
  transition_frequency: "Transition frequency",
  transition_role: "Transition role",
  indirects: "Off-ball screens (indirects)",
  slip: "Slip off off-ball screens",
  backdoor: "Backdoor cuts",
  duck_in_offball: "Duck-in (interior players)",
  orb: "Offensive rebounding",

  // ── Intensity levels ──────────────────────────────────────────────────────
  primary: "Primary",
  secondary: "Secondary",
  rare: "Rare",
  never: "Never",
  low: "Low",
  medium: "Medium",
  high: "High",
  left: "Left",
  right: "Right",
  balanced: "Balanced",
  any: "Any",

  // ── SelectItem options — Closeout ─────────────────────────────────────────
  opt_closeout_catch_shoot: "Catch & Shoot",
  opt_closeout_attack_baseline: "Attack Baseline",
  opt_closeout_attack_middle: "Attack Middle",
  opt_closeout_strong_hand: "Attacks Strong Hand",
  opt_closeout_weak_hand: "Attacks Weak Hand",
  opt_closeout_extra_pass: "Extra Pass",

  // ── SelectItem options — Post profile ─────────────────────────────────────
  opt_post_back_to_basket: "Back to Basket",
  opt_post_face_up: "Face-Up",
  opt_post_high_post: "High Post",
  opt_post_stretch: "Stretch Big",
  opt_post_mixed: "Mixed",

  // ── SelectItem options — Post double team ─────────────────────────────────
  opt_dt_forces_through: "Forces Through",
  opt_dt_kicks_out: "Kicks Out",
  opt_dt_resets: "Resets",
  opt_dt_variable: "Variable",

  // ── SelectItem options — Interior ISO ─────────────────────────────────────
  opt_iso_interior_back_down: "Back Down",
  opt_iso_interior_face_up_drive: "Face-Up Drive",
  opt_iso_interior_post_jumper: "Post Jumper",
  opt_iso_interior_turnaround: "Turnaround",
  opt_iso_interior_spin: "Spin Move",

  // ── SelectItem options — ISO decision ─────────────────────────────────────
  opt_iso_decision_finish: "Finish",
  opt_iso_decision_shoot: "Shoot",
  opt_iso_decision_pass: "Pass",

  // ── SelectItem options — ISO initiation ───────────────────────────────────
  opt_iso_init_controlled: "Controlled",
  opt_iso_init_quick: "Quick Attack",

  // ── SelectItem options — ISO direction ────────────────────────────────────
  opt_dir_left: "Left",
  opt_dir_right: "Right",
  opt_dir_balanced: "Balanced",

  // ── SelectItem options — Finish types ─────────────────────────────────────
  opt_finish_drive: "Drive to Rim",
  opt_finish_pullup: "Pull-up",
  opt_finish_pullup3: "Pull-up 3",
  opt_finish_floater: "Floater",
  opt_finish_midrange: "Mid-range",
  opt_finish_pullup3: "Pull-up 3",

  // ── SelectItem options — PnR scoring priority ─────────────────────────────
  opt_pnr_score_first: "Score First",
  opt_pnr_pass_first: "Pass First",
  opt_pnr_balanced: "Balanced",

  // ── SelectItem options — PnR under coverage ───────────────────────────────
  opt_pnr_under_pullup3: "Pull-up 3",
  opt_pnr_under_rescreen: "Re-screen",
  opt_pnr_under_reject: "Reject / Attack",

  // ── SelectItem options — PnR timing ───────────────────────────────────────
  opt_pnr_timing_drag: "Early (Drag / Step-up)",
  opt_pnr_timing_halfcourt: "Deep (Half-court sets)",

  // ── SelectItem options — Screener action ──────────────────────────────────
  opt_screen_roll: "Roll",
  opt_screen_pop: "Pop",
  opt_screen_pop_elbow: "Pop (Elbow / Mid)",
  opt_screen_short_roll: "Short Roll",
  opt_screen_slip: "Slip",
  opt_screen_lob: "Lob Only",
  opt_screen_none: "None — always does primary",

  // ── SelectItem options — Transition role ──────────────────────────────────
  opt_trans_pusher: "Pusher",
  opt_trans_outlet: "Outlet",
  opt_trans_rim_runner: "Rim Runner",
  opt_trans_trailer: "Trailer",

  // ── SelectItem options — Preferred block ──────────────────────────────────
  opt_block_left: "Left Block",
  opt_block_right: "Right Block",
  opt_block_any: "Any",

  // ── Profile viewer ────────────────────────────────────────────────────────
  archetype: "Archetype",
  defensive_plan: "Defensive Plan",
  guard_label: "Guard",
  force_label: "Force",
  give_label: "Give",
  threats: "Threats",
  defend_tab: "Defend",
  force_tab: "Force",
  give_tab: "Safe to Give",
  more_detail: "More detail",
  no_tendencies: "No clear tendencies yet.",
  profile_not_found: "Profile not found",
  how_she_attacks: "How she attacks",
  where_dangerous: "Where she's dangerous",
  screens_actions: "Screens & actions",
  top_threats: "Top threats · ordered by danger",
  spatial_reads: "Spatial reads",
  direction_space: "Direction · space · movement",
  pnr_coverage: "What to expect in PnR situations",
  full_plan: "Your complete game plan",
  no_threats: "No significant offensive threats detected. Play honest team defense.",
  no_post: "No post game scouted.",
  no_iso: "No ISO game scouted.",
  no_pnr: "Not a significant PnR threat. No special coverage needed.",
  no_spatial: "No dominant directional tendency. Play honest.",
  save_to_generate: "Save the player to generate the defensive plan.",
  elite_athlete: "Elite Athlete",
  athletic: "Athletic",
  limited_athlete: "Limited Athlete",
  physically_dominant: "Physically Dominant",
  physical: "Physical",
  elite_vision: "Elite Vision",
  high_iq: "High IQ",

  // ── Settings ──────────────────────────────────────────────────────────────

  // Deep report
  deep_report: "Deep Report",
  deep_report_on: "Full scouting report active",
  deep_report_off: "Quick view — tap book for full report",

  // Intensity levels (for display)
  freq_primary: "Primary",
  freq_secondary: "Secondary",
  freq_rare: "Rare",
  freq_never: "Never",

  // Block diagram
  right_block: "Right Block",
  left_block: "Left Block",
  attacks_middle: "attacks middle",
  hand_dominant: "hand dominant",
  prefers: "prefers",

  // Pass options in quadrant
  pass_to_cutter: "Pass to cutter",
  kick_out: "Kick out to perimeter",
  high_low: "High-low pass",

  // Screener tooltips
  hint_screener_primary: "What does the player do most of the time after setting the screen?",
  hint_screener_secondary: "When the defense takes away the primary action, what do they do instead?",

  // Subarchetype label
  subarchetype: "Also:",


  // Trait labels (keyTraits from motor)
  trait_backdoor: "Backdoor",
  trait_closeout: "Closeout",
  trait_crashing: "Crashing",
  trait_drag_screen: "Drag Screen",
  trait_dual_role: "Dual Role",
  trait_duck_in: "Duck-In",
  trait_force_direction: "Force Direction",
  trait_funnel_direction: "Funnel Direction",
  trait_move_pattern: "Move Pattern",
  trait_off_screens: "Off Screens",
  trait_on_the_double: "On the Double",
  trait_pass_first: "Pass-First",
  trait_perimeter_threat: "Perimeter Threat",
  trait_screen_action: "Screen Action",
  trait_screen_coverage: "Screen Coverage",
  trait_slip_threat: "Slip Threat",
  trait_transition: "Transition",


  // Motor output strings — defender/forzar/concede
    def_deny_block: "Deny the {side} block entry. Front before the catch — dominant there.",
  def_shade_side: "Shade {side} from the start — almost never goes the other way.",
    def_deny_block: "Niega la entrada al bloque {side}. Fronta antes de la recepción — domina allí.",
  def_shade_side: "Sombrea {side} desde el inicio — casi nunca va por el otro lado.",
    def_deny_block: "拒绝{side}侧低位接球。接球前正面防守 — 那里是强侧。",
  def_shade_side: "从一开始就遮蔽{side}侧 — 几乎从不走另一侧。",
  def_high_post_meet: "Meet at the elbow. No free catches at the high post — body up before the catch.",
  def_post_physical: "Use your most physical defender. Soft coverage loses every time in the post.",
  def_post_front: "Front on the block. Do not allow a catch in position.",
  def_post_no_foul: "No body fouls in the post — elite FT shooter who draws contact.",
  def_iso_stay_front: "Stay in front. Gets downhill in one dribble — no reach fouls.",
  def_iso_shade_strong: "Pre-shade dominant hand on every closeout — predictable direction.",
  def_iso_tight: "Tight coverage on the catch. Creates off the bounce — no free catches.",
  def_pnr_go_over: "Go OVER every screen. Under coverage = open shot or open lane.",
  def_pnr_under_safe: "Under screens is safe. Pack the paint and eliminate the drive.",
  def_pnr_drag: "Pick up full court — drag screens before the defense is organized.",
  def_screen_roll: "Tag the roll early. Contact before position at the dunker.",
  def_screen_pop: "Communicate and switch — pops to the arc immediately.",
  def_screen_pop_elbow: "Tag the elbow pop. Two options: shoot or find the cutter.",
  def_screen_short_roll: "Stop at the free throw line. No face-up — contest or switch.",
  def_screen_slip: "Treat every screen as a potential cut — slips early.",
  def_screen_lob: "Deny the lob — no other option.",
  def_backdoor: "Never over-deny. Every over-play is a backdoor layup.",
  def_trans_pusher: "Pick up full court — pushes the moment you give space.",
  def_trans_outlet: "Deny the outlet catch in transition.",
  def_trans_runner: "Sprint back. Beats you to the rim in transition.",
  def_trans_trailer: "Tag the trailer on every made basket.",
  def_ft_dangerous: "Avoid unnecessary contact — elite FT shooter who actively draws fouls.",
  def_hackable: "Physical contact on post catches is safe — poor FT shooter who rarely draws fouls.",
  def_orb: "Box out every possession — crashes every shot.",
  def_vision: "High vision player — no open looks nearby. Tag all shooters before the action.",
  def_no_threat: "No dominant scoring threat. Play honest team defense.",
  for_no_iso: "Dare them to create 1-on-1 — no self-creation game.",
  for_no_post: "Post touches — no interior game. Sag and help.",
  for_no_athlete: "Push the pace. Not an athlete — struggles in transition.",
  for_weak_finisher: "Force contact — weak finisher in traffic.",
  for_no_weakness: "No clear exploitable weakness. Contest all actions.",
  for_direction: "Force {weak} — only a {wl} on that side.",
  for_closeout_wing: "Close out {better} wing more carefully — more dangerous there. {worse} wing is safer.",
  for_post_block: "Force {block} block — no scouted moves there.",
  for_post_middle: "Force {block} block middle — no established move in that quadrant.",
  for_pnr_funnel: "Funnel PnR to weaker side — only a {wl}.",
  con_hackable: "Intentional fouls on post catches are safe — poor FT shooter, rarely draws them.",
  con_ft_dangerous: "Avoid unnecessary contact — elite FT shooter who actively seeks fouls.",
  con_ft_decent: "No intentional fouls — decent FT shooter.",
  con_ft_poor: "Physical defense acceptable — poor FT shooter.",
  con_pnr_under: "Under screens in PnR — will not punish it.",
  con_no_shooter: "Open catch on the wing — not a catch-and-shoot threat.",
  con_no_post: "Post touches — no interior game.",
  con_no_transition: "Transition — not a threat in the open floor.",
  con_no_perimeter: "Sag off at the arc — no perimeter threat.",
  con_iso_weak: "ISO going {weak} — accept it, weaker side.",

  settings_title: "Settings",
  settings_language: "Language",
  settings_about: "About",
  settings_motor: "Motor version",
  settings_archetypes: "Archetypes",
  settings_zh_warning: "Chinese basketball terminology is pending review by a professional. Some terms may be inaccurate.",

} as const;

// ─── SPANISH ──────────────────────────────────────────────────────────────────
// TypeScript enforces that every key in `en` exists here.
// Missing keys will cause a build error — intentional.
const es: typeof en = {

  sign_in: "Iniciar sesión",
  sign_up: "Crear cuenta",
  email: "Correo electrónico",
  password: "Contraseña",
  full_name: "Nombre completo",
  team_code: "Código de equipo",
  team_code_hint: "Pide el código a tu entrenador.",
  already_have_account: "¿Ya tienes cuenta?",
  no_account: "¿No tienes cuenta?",
  role_coach: "Entrenador/a",
  role_player: "Jugador/a",
  language: "Idioma",

  coach_mode: "Modo Entrenador",
  player_mode: "Modo Jugador",
  scouting: "Informes",
  settings: "Ajustes",
  back: "Volver",

  save: "Guardar",
  cancel: "Cancelar",
  delete: "Eliminar",
  create: "Crear",
  edit: "Editar",
  confirm: "Confirmar",
  not_observed: "No observado",
  more: "Más",
  less: "Menos",
  saving: "guardando",

  no_players: "Sin jugadores.",
  add_first_player: "Añadir jugador",
  new_team_name: "Nombre del equipo",
  create_team: "Crear equipo",
  add_team: "+ Equipo",
  add_player: "+ Jugador",
  approved: "Aprobado",
  draft: "Borrador",
  conflict: "Conflicto",
  delete_team: "¿Eliminar equipo?",

  tab_context: "Contexto",
  tab_post: "Poste",
  tab_iso: "ISO",
  tab_pnr: "PnR",
  tab_offball: "Sin Balón",

  identity: "Identidad",
  player_name: "Nombre",
  team: "Equipo",
  number: "Dorsal",
  position: "Posición",
  height: "Altura",
  weight: "Peso",
  physical_profile: "Perfil Físico",
  athleticism: "Atletismo / Explosividad",
  physical_strength: "Fuerza Física / Contacto",
  court_vision: "Visión de Juego / IQ",
  free_throws_fouling: "Tiros Libres y Faltas",
  ft_shooting: "% Tiros libres",
  foul_drawing: "Frecuencia de provocar faltas",

  post_frequency: "Frecuencia en el Poste",
  post_dominant_hand: "Mano dominante en el poste",
  post_profile: "Perfil de juego interior",
  post_moves_quadrant: "Movimientos por cuadrante",
  post_duck_in: "Frecuencia de duck-in",
  post_double_team: "Reacción al doble",
  right_hand: "Mano derecha",
  left_hand: "Mano izquierda",

  iso_frequency: "Frecuencia ISO",
  iso_interior_style: "Estilo ISO interior",
  iso_primary_style: "Estilo ISO principal",
  iso_perimeter_threat: "Amenaza perimetral",
  iso_dominant_direction: "Dirección dominante en ISO",
  iso_initiation: "Estilo de inicio",
  iso_decision: "Decisión al crear ventaja",
  iso_offhand_finish: "Finalización con mano débil",
  closeout_general: "Reacción al closeout (general)",
  directional_closeout: "Por ala (opcional)",
  left_wing: "⬅️ Ala izquierda",
  right_wing: "➡️ Ala derecha",

  pnr_frequency: "Frecuencia PnR",
  pnr_role: "Rol en PnR",
  pnr_primary_role: "Rol principal cuando ambos",
  pnr_scoring_priority: "Prioridad: anotar vs pasar",
  pnr_reaction_under: "Reacción si pasan por debajo",
  pnr_timing: "Timing del PnR",
  pnr_screener_action: "Acción del bloqueador",
  pnr_screener_action_secondary: "Acción secundaria (opcional)",
  pnr_direction: "Tendencia direccional",
  pnr_finish_dominant: "Finalización lado dominante",
  pnr_finish_opposite: "Finalización lado débil",
  as_handler: "Como manejador",
  as_screener: "Como bloqueador",
  finish_by_direction: "Finalización por dirección",
  handler: "Manejador",
  screener: "Bloqueador",
  both: "Ambos",

  transition_frequency: "Frecuencia en transición",
  transition_role: "Rol en transición",
  indirects: "Pantallas sin balón",
  slip: "Slip en pantallas sin balón",
  backdoor: "Cortes a la espalda",
  duck_in_offball: "Duck-in (interiores)",
  orb: "Rebote ofensivo",

  primary: "Primario",
  secondary: "Secundario",
  rare: "Raro",
  never: "Nunca",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  left: "Izquierda",
  right: "Derecha",
  balanced: "Equilibrado",
  any: "Cualquiera",

  opt_closeout_catch_shoot: "Recibe y tira",
  opt_closeout_attack_baseline: "Ataca línea de fondo",
  opt_closeout_attack_middle: "Ataca hacia el centro",
  opt_closeout_strong_hand: "Ataca con mano fuerte",
  opt_closeout_weak_hand: "Ataca con mano débil",
  opt_closeout_extra_pass: "Pase extra",

  opt_post_back_to_basket: "Espalda al aro",
  opt_post_face_up: "De frente",
  opt_post_high_post: "Poste alto",
  opt_post_stretch: "Stretch Big",
  opt_post_mixed: "Mixto",

  opt_dt_forces_through: "Fuerza a través",
  opt_dt_kicks_out: "Pasa al abierto",
  opt_dt_resets: "Resetea",
  opt_dt_variable: "Variable",

  opt_iso_interior_back_down: "Back Down",
  opt_iso_interior_face_up_drive: "De frente con bote",
  opt_iso_interior_post_jumper: "Tiro desde el poste",
  opt_iso_interior_turnaround: "Turnaround",
  opt_iso_interior_spin: "Giro",

  opt_iso_decision_finish: "Finaliza en el aro",
  opt_iso_decision_shoot: "Tira en suspensión",
  opt_iso_decision_pass: "Penetra y pasa",

  opt_iso_init_controlled: "Controlado",
  opt_iso_init_quick: "Ataque inmediato",

  opt_dir_left: "Izquierda",
  opt_dir_right: "Derecha",
  opt_dir_balanced: "Equilibrado",

  opt_finish_drive: "Canasta",
  opt_finish_pullup: "Tiro en carrera",
  opt_finish_floater: "Floater",
  opt_finish_midrange: "Tiro de media distancia",
  opt_finish_pullup3: "Triple en carrera",

  opt_pnr_score_first: "Anotar primero",
  opt_pnr_pass_first: "Pasar primero",
  opt_pnr_balanced: "Equilibrado",

  opt_pnr_under_pullup3: "Triple en carrera",
  opt_pnr_under_rescreen: "Repantalla",
  opt_pnr_under_reject: "Rechaza / Ataca",

  opt_pnr_timing_drag: "Temprano (drag / step-up)",
  opt_pnr_timing_halfcourt: "Media cancha",

  opt_screen_roll: "Roll al aro",
  opt_screen_pop: "Abre al triple",
  opt_screen_pop_elbow: "Abre al codo",
  opt_screen_short_roll: "Short roll",
  opt_screen_slip: "Slip",
  opt_screen_lob: "Solo lob",
  opt_screen_none: "Ninguna — siempre la principal",

  opt_trans_pusher: "Conduce el balón",
  opt_trans_outlet: "Corre al ala",
  opt_trans_rim_runner: "Corre al aro",
  opt_trans_trailer: "Trailer",

  opt_block_left: "Bloque izquierdo",
  opt_block_right: "Bloque derecho",
  opt_block_any: "Cualquiera",

  archetype: "Arquetipo",
  defensive_plan: "Plan Defensivo",
  guard_label: "Defender",
  force_label: "Forzar",
  give_label: "Conceder",
  threats: "Amenazas",
  defend_tab: "Defender",
  force_tab: "Forzar",
  give_tab: "Conceder",
  more_detail: "Más detalle",
  no_tendencies: "Sin tendencias claras.",
  profile_not_found: "Perfil no encontrado",
  how_she_attacks: "Cómo ataca",
  where_dangerous: "Zona de peligro",
  screens_actions: "Pantallas y acciones",
  top_threats: "Principales amenazas · por peligro",
  spatial_reads: "Lecturas espaciales",
  direction_space: "Dirección · espacio · movimiento",
  pnr_coverage: "Qué esperar en bloqueos directos",
  full_plan: "Plan de juego completo",
  no_threats: "Sin amenazas ofensivas significativas. Defensa de equipo honesta.",
  no_post: "Sin juego de poste registrado.",
  no_iso: "Sin juego ISO registrado.",
  no_pnr: "No es una amenaza significativa en PnR.",
  no_spatial: "Sin tendencia direccional dominante.",
  save_to_generate: "Guarda el jugador para generar el plan defensivo.",
  elite_athlete: "Atleta de élite",
  athletic: "Atlético",
  limited_athlete: "Atleta limitado",
  physically_dominant: "Dominio físico",
  physical: "Físico",
  elite_vision: "Visión élite",
  high_iq: "Alto IQ",


  deep_report: "Informe Completo",
  deep_report_on: "Informe completo activo",
  deep_report_off: "Vista rápida — toca el libro para el informe completo",
  freq_primary: "Primario",
  freq_secondary: "Secundario",
  freq_rare: "Raro",
  freq_never: "Nunca",
  right_block: "Bloque derecho",
  left_block: "Bloque izquierdo",
  attacks_middle: "ataca al centro",
  hand_dominant: "mano dominante",
  prefers: "prefiere",
  pass_to_cutter: "Pase al cortador",
  kick_out: "Pase al abierto",
  high_low: "Pase alto-bajo",
  hint_screener_primary: "¿Qué hace el jugador después de poner la pantalla normalmente?",
  hint_screener_secondary: "Cuando la defensa elimina la acción principal, ¿qué hace en su lugar?",
  subarchetype: "También:",


  trait_backdoor: "Corte a la espalda",
  trait_closeout: "Closeout",
  trait_crashing: "Rebote ofensivo",
  trait_drag_screen: "Pantalla en transición",
  trait_dual_role: "Doble rol",
  trait_duck_in: "Duck-In",
  trait_force_direction: "Dirección forzada",
  trait_funnel_direction: "Dirección del embudo",
  trait_move_pattern: "Patrón de movimientos",
  trait_off_screens: "Pantallas sin balón",
  trait_on_the_double: "En el doble",
  trait_pass_first: "Pase primero",
  trait_perimeter_threat: "Amenaza perimetral",
  trait_screen_action: "Acción del bloqueador",
  trait_screen_coverage: "Cobertura en PnR",
  trait_slip_threat: "Slip",
  trait_transition: "Transición",


  // Motor output strings — defender/forzar/concede
    def_deny_block: "Deny the {side} block entry. Front before the catch — dominant there.",
  def_shade_side: "Shade {side} from the start — almost never goes the other way.",
    def_deny_block: "Niega la entrada al bloque {side}. Fronta antes de la recepción — domina allí.",
  def_shade_side: "Sombrea {side} desde el inicio — casi nunca va por el otro lado.",
    def_deny_block: "拒绝{side}侧低位接球。接球前正面防守 — 那里是强侧。",
  def_shade_side: "从一开始就遮蔽{side}侧 — 几乎从不走另一侧。",
  def_high_post_meet: "Salir al codo. Sin recepciones fáciles en el poste alto — cuerpo antes de la recepción.",
  def_post_physical: "Usa tu defensor más físico. La cobertura blanda pierde siempre en el poste.",
  def_post_front: "Fronta en el bloque. No permitir recepción en posición.",
  def_post_no_foul: "Sin faltas corporales en el poste — tiradora élite de tiros libres que busca el contacto.",
  def_iso_stay_front: "Mantente por delante. Se va al aro en un bote — sin faltas por alcanzar.",
  def_iso_shade_strong: "Pre-sombrea la mano dominante en cada closeout — dirección predecible.",
  def_iso_tight: "Cobertura ajustada en la recepción. Crea desde el bote — sin recepciones libres.",
  def_pnr_go_over: "Pasa POR ENCIMA de cada pantalla. Pasar por debajo = tiro o carril abierto.",
  def_pnr_under_safe: "Pasar por debajo es seguro. Cierra la pintura y elimina el drive.",
  def_pnr_drag: "Recoge full court — pantallas drag antes de que la defensa esté organizada.",
  def_screen_roll: "Etiqueta el roll temprano. Contacto antes de posición en el dunker spot.",
  def_screen_pop: "Comunica y cambia — abre al arco inmediatamente.",
  def_screen_pop_elbow: "Etiqueta el pop al codo. Dos opciones: tiro o pase al cortador.",
  def_screen_short_roll: "Para en la línea de tiros libres. Sin face-up — contesta o cambia.",
  def_screen_slip: "Trata cada pantalla como un posible corte — hace slip temprano.",
  def_screen_lob: "Niega el lob — no hay otra opción.",
  def_backdoor: "Nunca sobre-niegues. Cualquier sobre-juego es una bandeja sin oposición.",
  def_trans_pusher: "Recoge full court — empuja en cuanto le das espacio.",
  def_trans_outlet: "Niega la recepción de salida en transición.",
  def_trans_runner: "Corre de vuelta. Llega al aro antes que tú en transición.",
  def_trans_trailer: "Etiqueta al trailer en cada canasta anotada.",
  def_ft_dangerous: "Evita el contacto innecesario — tiradora élite que busca activamente las faltas.",
  def_hackable: "El contacto físico en recepciones de poste es seguro — mala tiradora de libres.",
  def_orb: "Bloqueada en cada posesión — se lanza a por cada rebote.",
  def_vision: "Jugadora con visión élite — sin tiros libres cerca. Etiqueta a todos antes de la acción.",
  def_no_threat: "Sin amenaza ofensiva dominante. Defensa de equipo honesta.",
  for_no_iso: "Rétalos a crear 1 contra 1 — sin juego de creación propio.",
  for_no_post: "Recepciones de poste — sin juego interior. Atrasa y ayuda.",
  for_no_athlete: "Empuja el ritmo. Sin atletismo — sufre en transición.",
  for_weak_finisher: "Fuerza el contacto — mal rematador en tráfico.",
  for_no_weakness: "Sin debilidad explotable clara. Contesta todas las acciones.",
  for_direction: "Fuerza a {weak} — solo un {wl} por ese lado.",
  for_closeout_wing: "Cierra {better} con más cuidado — más peligroso allí. {worse} es más seguro.",
  for_post_block: "Fuerza al bloque {block} — sin movimientos registrados allí.",
  for_post_middle: "Fuerza al medio del bloque {block} — sin movimiento establecido en ese cuadrante.",
  for_pnr_funnel: "Canaliza el PnR hacia el lado débil — solo un {wl}.",
  con_hackable: "Las faltas intencionales en recepciones de poste son seguras — mala tiradora, raramente las provoca.",
  con_ft_dangerous: "Evita el contacto innecesario — tiradora élite que busca activamente las faltas.",
  con_ft_decent: "Sin faltas intencionales — tiradora decente de libres.",
  con_ft_poor: "Defensa física aceptable — mala tiradora de libres.",
  con_pnr_under: "Pasar por debajo en PnR — no lo castiga.",
  con_no_shooter: "Recepción abierta en el ala — no es amenaza de catch-and-shoot.",
  con_no_post: "Recepciones de poste — sin juego interior.",
  con_no_transition: "Transición — no es amenaza en campo abierto.",
  con_no_perimeter: "Retrasate en el arco — sin amenaza perimetral.",
  con_iso_weak: "ISO hacia {weak} — acéptalo, es el lado débil.",
  where_dangerous: "Zona de peligro",

  settings_title: "Ajustes",
  settings_language: "Idioma",
  settings_about: "Acerca de",
  settings_motor: "Versión del motor",
  settings_archetypes: "Arquetipos",
  settings_zh_warning: "La terminología en chino está pendiente de revisión por un profesional. Algunos términos pueden ser imprecisos.",

} as const;

// ─── CHINESE (Simplified) ─────────────────────────────────────────────────────
// ⚠ Pending professional review — basketball terminology may need refinement
const zh: typeof en = {

  sign_in: "登录",
  sign_up: "创建账户",
  email: "电子邮件",
  password: "密码",
  full_name: "全名",
  team_code: "球队代码",
  team_code_hint: "向教练索取球队代码。",
  already_have_account: "已有账户？",
  no_account: "没有账户？",
  role_coach: "教练",
  role_player: "球员",
  language: "语言",

  coach_mode: "教练模式",
  player_mode: "球员模式",
  scouting: "球探报告",
  settings: "设置",
  back: "返回",

  save: "保存",
  cancel: "取消",
  delete: "删除",
  create: "创建",
  edit: "编辑",
  confirm: "确认",
  not_observed: "未观察到",
  more: "更多",
  less: "收起",
  saving: "保存中",

  no_players: "暂无球员。",
  add_first_player: "添加第一个球员",
  new_team_name: "球队名称",
  create_team: "创建球队",
  add_team: "+ 球队",
  add_player: "+ 球员",
  approved: "已批准",
  draft: "草稿",
  conflict: "冲突",
  delete_team: "删除球队？",

  tab_context: "基本信息",
  tab_post: "低位",
  tab_iso: "单打",
  tab_pnr: "掩护配合",
  tab_offball: "无球跑动",

  identity: "身份",
  player_name: "球员姓名",
  team: "球队",
  number: "号码",
  position: "位置",
  height: "身高",
  weight: "体重",
  physical_profile: "身体素质",
  athleticism: "运动能力 / 爆发力",
  physical_strength: "身体对抗 / 力量",
  court_vision: "篮球智商 / 传球视野",
  free_throws_fouling: "罚球与犯规",
  ft_shooting: "罚球命中率",
  foul_drawing: "造犯规频率",

  post_frequency: "低位频率",
  post_dominant_hand: "低位惯用手",
  post_profile: "内线打法",
  post_moves_quadrant: "按区域的低位动作",
  post_duck_in: "鸭入频率",
  post_double_team: "遭遇夹击的反应",
  right_hand: "右手",
  left_hand: "左手",

  iso_frequency: "单打频率",
  iso_interior_style: "内线单打风格",
  iso_primary_style: "主要单打风格",
  iso_perimeter_threat: "外线威胁",
  iso_dominant_direction: "单打主攻方向",
  iso_initiation: "启动方式",
  iso_decision: "突破后的决策",
  iso_offhand_finish: "弱手终结",
  closeout_general: "防守追身反应（通用）",
  directional_closeout: "按侧翼设置（可选）",
  left_wing: "⬅️ 左侧翼",
  right_wing: "➡️ 右侧翼",

  pnr_frequency: "掩护配合频率",
  pnr_role: "掩护配合角色",
  pnr_primary_role: "主要角色（双角色时）",
  pnr_scoring_priority: "进攻优先：得分还是传球",
  pnr_reaction_under: "面对绕底防守的反应",
  pnr_timing: "掩护配合时机",
  pnr_screener_action: "掩护后的主要行动",
  pnr_screener_action_secondary: "次要行动（可选）",
  pnr_direction: "方向倾向",
  pnr_finish_dominant: "主攻侧终结方式",
  pnr_finish_opposite: "弱侧终结方式",
  as_handler: "持球人",
  as_screener: "掩护人",
  finish_by_direction: "按方向的终结方式",
  handler: "持球人",
  screener: "掩护人",
  both: "两者皆可",

  transition_frequency: "快攻频率",
  transition_role: "快攻角色",
  indirects: "无球掩护",
  slip: "提前溜走",
  backdoor: "背切",
  duck_in_offball: "鸭入（内线球员）",
  orb: "前场篮板",

  primary: "主要",
  secondary: "次要",
  rare: "偶尔",
  never: "从不",
  low: "低",
  medium: "中",
  high: "高",
  left: "左",
  right: "右",
  balanced: "均衡",
  any: "任意",

  opt_closeout_catch_shoot: "接球即投",
  opt_closeout_attack_baseline: "攻底线",
  opt_closeout_attack_middle: "攻中路",
  opt_closeout_strong_hand: "强手侧突破",
  opt_closeout_weak_hand: "弱手侧突破",
  opt_closeout_extra_pass: "传出",

  opt_post_back_to_basket: "背身打法",
  opt_post_face_up: "面框",
  opt_post_high_post: "高位",
  opt_post_stretch: "拉开型内线",
  opt_post_mixed: "混合",

  opt_dt_forces_through: "强行进攻",
  opt_dt_kicks_out: "传给空位",
  opt_dt_resets: "重置进攻",
  opt_dt_variable: "随机应变",

  opt_iso_interior_back_down: "后退压制",
  opt_iso_interior_face_up_drive: "面框突破",
  opt_iso_interior_post_jumper: "低位跳投",
  opt_iso_interior_turnaround: "转身跳投",
  opt_iso_interior_spin: "旋转上篮",

  opt_iso_decision_finish: "上篮终结",
  opt_iso_decision_shoot: "急停跳投",
  opt_iso_decision_pass: "突破传球",

  opt_iso_init_controlled: "试探步读防",
  opt_iso_init_quick: "接球即攻",

  opt_dir_left: "左侧",
  opt_dir_right: "右侧",
  opt_dir_balanced: "均衡",

  opt_finish_drive: "上篮",
  opt_finish_pullup: "急停跳投",
  opt_finish_pullup3: "急停三分",
  opt_finish_floater: "挑篮",
  opt_finish_midrange: "中距离",
  opt_finish_pullup3: "急停三分",

  opt_pnr_score_first: "优先得分",
  opt_pnr_pass_first: "优先传球",
  opt_pnr_balanced: "均衡",

  opt_pnr_under_pullup3: "急停三分",
  opt_pnr_under_rescreen: "重新掩护",
  opt_pnr_under_reject: "拒绝掩护/突破",

  opt_pnr_timing_drag: "早期（过渡期掩护）",
  opt_pnr_timing_halfcourt: "半场阵地战",

  opt_screen_roll: "下顺",
  opt_screen_pop: "外弹三分",
  opt_screen_pop_elbow: "弹出至肘区",
  opt_screen_short_roll: "短顺",
  opt_screen_slip: "提前溜走",
  opt_screen_lob: "仅高抛球",
  opt_screen_none: "无——始终执行主要动作",

  opt_trans_pusher: "推进持球",
  opt_trans_outlet: "跑外线接球",
  opt_trans_rim_runner: "冲篮下",
  opt_trans_trailer: "跟进三分",

  opt_block_left: "左侧低位",
  opt_block_right: "右侧低位",
  opt_block_any: "任意",

  archetype: "球员类型",
  defensive_plan: "防守方案",
  guard_label: "防守",
  force_label: "逼迫",
  give_label: "放弃",
  threats: "威胁",
  defend_tab: "防守",
  force_tab: "逼迫",
  give_tab: "可以放弃",
  more_detail: "更多细节",
  no_tendencies: "暂无明确倾向。",
  profile_not_found: "未找到档案",
  how_she_attacks: "进攻方式",
  where_dangerous: "危险区域",
  screens_actions: "掩护与配合",
  top_threats: "主要威胁 · 按危险程度排序",
  spatial_reads: "空间解读",
  direction_space: "方向 · 空间 · 跑动",
  pnr_coverage: "掩护配合预期",
  full_plan: "完整防守方案",
  no_threats: "未发现显著进攻威胁。保持正常团队防守。",
  no_post: "未记录低位进攻。",
  no_iso: "未记录单打进攻。",
  no_pnr: "掩护配合威胁不显著。",
  no_spatial: "无明显方向倾向。",
  save_to_generate: "保存球员以生成防守方案。",
  elite_athlete: "精英运动员",
  athletic: "运动能力强",
  limited_athlete: "运动能力有限",
  physically_dominant: "身体对抗强",
  physical: "身体型",
  elite_vision: "精英视野",
  high_iq: "高篮球智商",


  deep_report: "详细报告",
  deep_report_on: "完整报告已激活",
  deep_report_off: "快速查看 — 点击书本查看完整报告",
  freq_primary: "主要",
  freq_secondary: "次要",
  freq_rare: "偶尔",
  freq_never: "从不",
  right_block: "右侧低位",
  left_block: "左侧低位",
  attacks_middle: "攻中路",
  hand_dominant: "惯用手",
  prefers: "偏好",
  pass_to_cutter: "传给切入者",
  kick_out: "传给外线空位",
  high_low: "高低位传球",
  hint_screener_primary: "掩护后球员通常会做什么？",
  hint_screener_secondary: "当防守封堵主要动作时，球员会改做什么？",
  subarchetype: "兼：",


  trait_backdoor: "背切",
  trait_closeout: "防守追身",
  trait_crashing: "前场篮板",
  trait_drag_screen: "过渡期掩护",
  trait_dual_role: "双重角色",
  trait_duck_in: "鸭入",
  trait_force_direction: "强迫方向",
  trait_funnel_direction: "漏斗方向",
  trait_move_pattern: "动作模式",
  trait_off_screens: "无球掩护",
  trait_on_the_double: "夹击应对",
  trait_pass_first: "传球优先",
  trait_perimeter_threat: "外线威胁",
  trait_screen_action: "掩护后动作",
  trait_screen_coverage: "PnR防守",
  trait_slip_threat: "溜走威胁",
  trait_transition: "快攻",


  // Motor output strings — defender/forzar/concede
    def_deny_block: "Deny the {side} block entry. Front before the catch — dominant there.",
  def_shade_side: "Shade {side} from the start — almost never goes the other way.",
    def_deny_block: "Niega la entrada al bloque {side}. Fronta antes de la recepción — domina allí.",
  def_shade_side: "Sombrea {side} desde el inicio — casi nunca va por el otro lado.",
    def_deny_block: "拒绝{side}侧低位接球。接球前正面防守 — 那里是强侧。",
  def_shade_side: "从一开始就遮蔽{side}侧 — 几乎从不走另一侧。",
  def_high_post_meet: "在肘区迎上。高位不能自由接球 — 接球前就要顶住身体。",
  def_post_physical: "用最强壮的防守球员。低位软防守每次都会输。",
  def_post_front: "在低位正面防守。不允许在位置上接球。",
  def_post_no_foul: "低位不能有身体犯规 — 精英罚球手会主动寻求接触。",
  def_iso_stay_front: "保持在前方。一个运球就能直冲篮下 — 不要出手犯规。",
  def_iso_shade_strong: "每次补防时预先遮蔽强手侧 — 方向可预测。",
  def_iso_tight: "接球时紧密防守。从运球中创造机会 — 不能自由接球。",
  def_pnr_go_over: "每次挡拆都要绕过上方。从下方绕过 = 开放投篮或通道。",
  def_pnr_under_safe: "从下方绕过是安全的。封堵禁区，消除突破。",
  def_pnr_drag: "全场紧逼接球 — 在防守到位前就设置拖拽挡拆。",
  def_screen_roll: "提前标记下顺。在灌篮区站位前接触。",
  def_screen_pop: "沟通换防 — 立即弹出到弧顶。",
  def_screen_pop_elbow: "标记肘区弹出。两个选项：投篮或传给切入者。",
  def_screen_short_roll: "在罚球线停住。不能面框 — 防守或换防。",
  def_screen_slip: "将每次挡拆视为可能的切入 — 提前溜走。",
  def_screen_lob: "拒绝高抛球 — 没有其他选项。",
  def_backdoor: "永远不要过度封堵。任何过度防守都是空篮。",
  def_trans_pusher: "全场接球 — 一给空间就推进。",
  def_trans_outlet: "在快攻中拒绝外线接球。",
  def_trans_runner: "快速回防。快攻中比你先到篮下。",
  def_trans_trailer: "每次得分后标记跟进者。",
  def_ft_dangerous: "避免不必要的犯规 — 精英罚球手会主动寻求犯规。",
  def_hackable: "低位接球时的身体接触是安全的 — 差劲的罚球手，很少造犯规。",
  def_orb: "每次持球都要卡位 — 每次投篮都冲抢篮板。",
  def_vision: "视野精英球员 — 附近不能有空位。行动前标记所有投手。",
  def_no_threat: "没有主导进攻威胁。诚实的团队防守。",
  for_no_iso: "敢于让其单打 — 没有自主创造能力。",
  for_no_post: "低位接球 — 没有内线进攻。后撤协防。",
  for_no_athlete: "加快节奏。运动能力不足 — 在快攻中挣扎。",
  for_weak_finisher: "强迫接触 — 在人群中终结能力差。",
  for_no_weakness: "没有明显可利用的弱点。防守所有进攻。",
  for_direction: "逼向{weak} — 那侧只有{wl}。",
  for_closeout_wing: "更仔细地补防{better}侧 — 那里更危险。{worse}侧更安全。",
  for_post_block: "逼向{block}侧低位 — 那里没有观察到的动作。",
  for_post_middle: "逼向{block}侧低位中路 — 那个区域没有固定动作。",
  for_pnr_funnel: "将挡拆引向弱侧 — 只有{wl}。",
  con_hackable: "低位接球时故意犯规是安全的 — 差劲的罚球手，很少造犯规。",
  con_ft_dangerous: "避免不必要的犯规 — 精英罚球手会主动寻求犯规。",
  con_ft_decent: "不要故意犯规 — 还过得去的罚球手。",
  con_ft_poor: "身体防守可以接受 — 差劲的罚球手。",
  con_pnr_under: "挡拆中从下方绕过 — 不会惩罚这种防守。",
  con_no_shooter: "翼侧空位接球 — 不是接球即投的威胁。",
  con_no_post: "低位接球 — 没有内线进攻。",
  con_no_transition: "快攻 — 在快攻中不是威胁。",
  con_no_perimeter: "在弧顶后撤 — 没有外线威胁。",
  con_iso_weak: "向{weak}侧的单打 — 接受它，那是弱侧。",

  settings_title: "设置",
  settings_language: "语言",
  settings_about: "关于",
  settings_motor: "引擎版本",
  settings_archetypes: "球员类型数量",
  settings_zh_warning: "中文篮球术语正在等待专业人士审核，部分术语可能不准确。",

} as const;

// ─── Runtime ──────────────────────────────────────────────────────────────────
// To add a language: add it to this map and extend Locale type above.
const translations: Record<Locale, typeof en> = { en, es, zh };

let globalLocale: Locale = "en";
const listeners = new Set<() => void>();

function loadSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem("uscout_locale") as Locale | null;
    if (saved && saved in translations) return saved;
  } catch {}
  return "en";
}

export function setLocale(locale: Locale) {
  globalLocale = locale;
  try { localStorage.setItem("uscout_locale", locale); } catch {}
  listeners.forEach(fn => fn());
}

export function getLocale(): Locale { return globalLocale; }

globalLocale = loadSavedLocale();

// Static t() — use only outside React components
export function t(key: keyof typeof en): string {
  return translations[globalLocale]?.[key] ?? translations.en[key] ?? key;
}

// React hook — always use this inside components
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(globalLocale);

  useEffect(() => {
    const update = () => setLocaleState(globalLocale);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const tFn = useCallback((key: keyof typeof en): string => {
    return translations[locale]?.[key] ?? translations.en[key] ?? key;
  }, [locale]);

  return { locale, changeLocale, t: tFn };
}
