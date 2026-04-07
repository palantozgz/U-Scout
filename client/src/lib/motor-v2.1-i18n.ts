/**
 * U Scout Motor v2.1 - Output i18n Keys
 * 
 * v2.1 Changes:
 * - 5 new DENY outputs: trans_rim, trans_trail, duck_in, post_seal, ball_advance
 * - 2 new FORCE outputs: full_court, no_ball
 * - 1 new ALLOW output: ball_handling
 * - 6 new AWARE outputs: trans_leak, post_efficient, post_fade, post_turnaround, post_hook, pressure_vuln
 * 
 * Add these to your main i18n.ts file in the appropriate locale blocks.
 */

export const MOTOR_V2_1_I18N = {
  en: {
    // ============= DENY OUTPUTS =============
    'output.deny.iso_space': 'DENY ISO space - force help',
    'output.deny.pnr_downhill': 'DENY PnR downhill - hedge/trap',
    'output.deny.pnr_roll': 'DENY roll - stay attached to screener',
    'output.deny.pnr_pop': 'DENY pop - contest the three',
    'output.deny.pnr_slip': 'DENY slip - stay alert to early cut',
    'output.deny.post_entry': 'DENY post entry - front the post',
    'output.deny.post_shoulder': 'DENY {shoulder} shoulder - force opposite',
    'output.deny.trans_run': 'DENY transition - sprint back',
    'output.deny.spot_deep': 'DENY deep threes - extend defense',
    'output.deny.spot_corner': 'DENY corner three - tight closeout',
    'output.deny.dho': 'DENY DHO action - jump the handoff',
    'output.deny.cut_basket': 'DENY basket cut - stay ball side',
    'output.deny.cut_backdoor': 'DENY backdoor cut - stay ball side',
    'output.deny.cut_flash': 'DENY flash cut - prevent high post entry',
    'output.deny.cut_curl': 'DENY curl - chase over screen',
    'output.deny.oreb': 'DENY offensive boards - box out first',
    'output.deny.floater': 'DENY floater zone - contest high',
    // v2.1 - NEW DENY outputs
    'output.deny.trans_rim': 'DENY rim run - sprint back, no basket',
    'output.deny.trans_trail': 'DENY trail three - find shooter early',
    'output.deny.duck_in': 'DENY duck-in - prevent deep seal',
    'output.deny.post_seal': 'DENY post seal - fight for position',
    'output.deny.ball_advance': 'DENY ball advance - pressure full court',
    'output.deny.trans_seal': 'DENY transition seal catch — front the roller early',
    'output.deny.trans_runner_corner': 'DENY runner corner three — locate shooter in transition',
    'output.deny.high_post_catch': 'DENY high post/elbow catches — crowd the elbow',
    'output.deny.screen_pop': 'DENY off-ball screen pop — contest jumper',
    'output.deny.screen_slip': 'DENY slip off off-ball screen — stay with cutter',
    'output.deny.off_ball_curl': 'DENY curl off screen — chase or switch tight',
    
    // ============= FORCE OUTPUTS =============
    'output.force.direction': 'FORCE {direction} - away from comfort',
    'output.force.weak_hand': 'FORCE to weak hand ({hand})',
    'output.force.perimeter': 'FORCE to perimeter - no paint touches',
    'output.force.contact': 'FORCE into contact - be physical',
    'output.force.early': 'FORCE early shot clock looks',
    'output.force.trap': 'FORCE into traps - hedge hard on PnR',
    // v2.1 - NEW FORCE outputs
    'output.force.full_court': 'FORCE full court pressure - attack the ball',
    'output.force.no_ball': 'FORCE off ball - deny advance',
    'output.force.no_push': 'FORCE no dribble push — contain the advance',
    
    // ============= ALLOW OUTPUTS =============
    'output.allow.post': 'Allow post attempts - no threat',
    'output.allow.spot_three': 'Allow spot-up threes - help off',
    'output.allow.iso': 'Allow isolation - low efficiency',
    // v2.1 - NEW ALLOW output
    'output.allow.ball_handling': 'Allow ball handling - limited threat with ball',
    
    // ============= AWARE OUTPUTS =============
    'output.aware.passer': 'Elite passer - don\'t gamble',
    'output.aware.trap': 'Handles traps well - rotate quickly',
    'output.aware.physical': 'Physical finisher - expect contact',
    'output.aware.deep': 'Deep range threat - guard to half court',
    'output.aware.hands': 'Finishes with both hands',
    'output.aware.oreb': 'Elite rebounder - box out every shot',
    'output.aware.connector': 'Connector role - reads defense',
    // v2.1 - NEW AWARE outputs
    'output.aware.trans_leak': 'Leaks early in transition - watch for escape',
    'output.aware.post_efficient': 'Lethal when posting - rarely but deadly',
    'output.aware.post_fade': 'Dangerous fadeaway - contest without fouling',
    'output.aware.post_turnaround': 'Effective turnaround - stay disciplined',
    'output.aware.post_hook': 'Hook shot threat - contest but expect arc',
    'output.aware.pressure_vuln': 'Vulnerable under pressure - attack aggressively',
    'output.aware.pnr_direction': 'PnR finish differs by ball-hand side — left: {left}; right: {right}',
    'output.aware.trans_trail_shoot': 'Trail shooter off drag — find her late',
    'output.aware.trans_early_drag': 'Early drag in transition — expect quick PnR',
    'output.aware.screen_short_roll': 'Short roll threat off screens — help early',
    'output.aware.off_ball_flare': 'Flare shooter off screens — go under or switch',
    'output.aware.high_post_face_up': 'Face-up drive from elbow — gap stance',
    'output.aware.high_post_passer': 'High post passer — deny cutters',
    'output.aware.high_post_stepback': 'Step-back range from elbow — contest length',
    'output.aware.high_post_versatile': 'Versatile: low post + high post game — scout both',
    'output.aware.iso_strong_hand_finish': 'With dominant hand: prefers {finish}.',
    'output.aware.iso_weak_hand_finish': 'When forced to weak hand: prefers {finish}.',
    'output.aware.trans_rim_run_graded': 'Rim run is {freq} in transition.',
    'output.aware.trans_trail_graded': 'Trail is {freq} in transition.',
    'output.aware.off_ball_screen_graded': '{action} after screen is {freq}.',
    'output.aware.off_ball_role': 'Off-ball role tendency: {role}.',
    
    // ============= IDENTITY LABELS =============
    'output.identity.primary': 'Primary offensive option',
    'output.identity.secondary': 'Secondary offensive option',
    'output.identity.role': 'Role player',
    'output.identity.high_creation': 'High self-creation threat',
    'output.identity.medium_creation': 'Moderate self-creation',
    'output.identity.low_creation': 'Limited self-creation',
    // v2.1 - NEW identity labels
    'output.identity.ball_liability': 'Ball handling liability - pressure opportunity',
    'output.identity.ball_limited': 'Limited ball handling',
    
    // ============= PLAY TYPE LABELS =============
    'output.playtype.iso': 'ISO',
    'output.playtype.pnr': 'PnR Handler',
    'output.playtype.post': 'Post-up',
    'output.playtype.trans': 'Transition',
    'output.playtype.spot': 'Spot-up',
    'output.playtype.dho': 'DHO',
    'output.playtype.cut': 'Cuts',
    'output.playtype.indirect': 'Off-screen',
    
    // ============= FREQUENCY LABELS =============
    'output.freq.primary': '(P)',
    'output.freq.secondary': '(S)',
    'output.freq.rare': '(R)',
    
    // ============= ZONE LABELS =============
    'output.zone.paint': 'Paint',
    'output.zone.perimeter': 'Perimeter',
    'output.zone.deep': 'Deep (30+ ft)',
    'output.zone.corner': 'Corner',
    'output.zone.wing': 'Wing',
    'output.zone.top': 'Top of key',
    'output.zone.floater': 'Floater zone',
    'output.zone.elbow': 'Elbow',
    // v2.1 - NEW zone label
    'output.zone.rim_trans': 'Rim (transition)',
    
    // ============= v2.1 - TRANSITION ROLE LABELS =============
    'output.trans_role.rim_run': 'Rim runner',
    'output.trans_role.trail': 'Trailer (3PT)',
    'output.trans_role.leak': 'Early leak',
    'output.trans_role.fill': 'Space filler',
    
    // ============= v2.1 - BALL HANDLING LABELS =============
    'output.ball_handling.elite': 'Elite ball handler',
    'output.ball_handling.capable': 'Capable ball handler',
    'output.ball_handling.limited': 'Limited ball handling',
    'output.ball_handling.liability': 'Ball handling liability',
    
    // ============= v2.1 - PRESSURE RESPONSE LABELS =============
    'output.pressure.breaks': 'Breaks pressure consistently',
    'output.pressure.escapes': 'Can escape pressure',
    'output.pressure.struggles': 'Struggles under pressure',
    
    // ============= v2.1 - POST MOVE LABELS =============
    'output.post_move.fade': 'Fadeaway',
    'output.post_move.turnaround': 'Turnaround jumper',
    'output.post_move.hook': 'Hook shot',
    'output.post_move.drop_step': 'Drop step',
    'output.post_move.up_and_under': 'Up-and-under',
    
    // ============= v2.1 - POST ENTRY LABELS =============
    'output.post_entry.pass': 'Post entry via pass',
    'output.post_entry.duck_in': 'Duck-in entry',
    'output.post_entry.seal': 'Seals for entry',
    'output.post_entry.flash': 'Flashes to post'
  },
  
  es: {
    // ============= DENY OUTPUTS =============
    'output.deny.iso_space': 'NEGAR espacio ISO - forzar ayuda',
    'output.deny.pnr_downhill': 'NEGAR penetración PnR - hedge/trap',
    'output.deny.pnr_roll': 'NEGAR roll - pegarse al bloqueador',
    'output.deny.pnr_pop': 'NEGAR pop - contestar el triple',
    'output.deny.pnr_slip': 'NEGAR slip - atención al corte temprano',
    'output.deny.post_entry': 'NEGAR entrada al poste - frontearlo',
    'output.deny.post_shoulder': 'NEGAR hombro {shoulder} - forzar opuesto',
    'output.deny.trans_run': 'NEGAR transición - sprint atrás',
    'output.deny.spot_deep': 'NEGAR triples lejanos - extender defensa',
    'output.deny.spot_corner': 'NEGAR esquina - closeout agresivo',
    'output.deny.dho': 'NEGAR DHO - saltar el handoff',
    'output.deny.cut_basket': 'NEGAR corte al aro - quedarse lado balón',
    'output.deny.cut_backdoor': 'NEGAR backdoor - quedarse lado balón',
    'output.deny.cut_flash': 'NEGAR flash - prevenir entrada poste alto',
    'output.deny.cut_curl': 'NEGAR curl - perseguir sobre bloqueo',
    'output.deny.oreb': 'NEGAR rebote ofensivo - bloquear primero',
    'output.deny.floater': 'NEGAR zona floater - contestar alto',
    // v2.1 - NEW DENY outputs
    'output.deny.trans_rim': 'NEGAR carrera al aro - sprint atrás, nada fácil',
    'output.deny.trans_trail': 'NEGAR triple en trail - encontrar tirador temprano',
    'output.deny.duck_in': 'NEGAR duck-in - prevenir sellado profundo',
    'output.deny.post_seal': 'NEGAR sellado en poste - pelear la posición',
    'output.deny.ball_advance': 'NEGAR avance del balón - presión toda cancha',
    'output.deny.trans_seal': 'NEGAR seal en transición — anticipar al roller',
    'output.deny.trans_runner_corner': 'NEGAR triple de esquina en carrera — localizar tiradora',
    'output.deny.high_post_catch': 'NEGAR recepciones en poste alto/codo — apiñar el codo',
    'output.deny.screen_pop': 'NEGAR pop en pantalla sin balón — contestar tiro',
    'output.deny.screen_slip': 'NEGAR slip en pantalla sin balón — seguir al corte',
    'output.deny.off_ball_curl': 'NEGAR curl en pantalla — perseguir o cambiar apretado',
    
    // ============= FORCE OUTPUTS =============
    'output.force.direction': 'FORZAR {direction} - fuera de comodidad',
    'output.force.weak_hand': 'FORZAR mano débil ({hand})',
    'output.force.perimeter': 'FORZAR al perímetro - sin toques en pintura',
    'output.force.contact': 'FORZAR contacto - ser físico',
    'output.force.early': 'FORZAR tiros temprano en posesión',
    'output.force.trap': 'FORZAR trampas - hedge duro en PnR',
    // v2.1 - NEW FORCE outputs
    'output.force.full_court': 'FORZAR presión toda cancha - atacar el balón',
    'output.force.no_ball': 'FORZAR sin balón - negar avance',
    'output.force.no_push': 'FORZAR sin empuje con bote — contener el avance',
    
    // ============= ALLOW OUTPUTS =============
    'output.allow.post': 'Permitir poste - sin amenaza',
    'output.allow.spot_three': 'Permitir triples spot-up - ayudar',
    'output.allow.iso': 'Permitir aislamiento - baja eficiencia',
    // v2.1 - NEW ALLOW output
    'output.allow.ball_handling': 'Permitir bote - amenaza limitada con balón',
    
    // ============= AWARE OUTPUTS =============
    'output.aware.passer': 'Pasador élite - no apostar',
    'output.aware.trap': 'Maneja bien trampas - rotar rápido',
    'output.aware.physical': 'Finalizador físico - esperar contacto',
    'output.aware.deep': 'Amenaza profunda - defender hasta medio campo',
    'output.aware.hands': 'Finaliza con ambas manos',
    'output.aware.oreb': 'Reboteador élite - bloquear cada tiro',
    'output.aware.connector': 'Rol conector - lee la defensa',
    // v2.1 - NEW AWARE outputs
    'output.aware.trans_leak': 'Escapa temprano en transición - vigilar fuga',
    'output.aware.post_efficient': 'Letal cuando postea - poco frecuente pero mortal',
    'output.aware.post_fade': 'Fadeaway peligroso - contestar sin foulear',
    'output.aware.post_turnaround': 'Turnaround efectivo - mantener disciplina',
    'output.aware.post_hook': 'Amenaza de gancho - contestar pero esperar arco',
    'output.aware.pressure_vuln': 'Vulnerable bajo presión - atacar agresivamente',
    'output.aware.pnr_direction': 'La finalización en PnR varía según la mano con balón — izquierda: {left}; derecha: {right}',
    'output.aware.trans_trail_shoot': 'Tiradora en trail tras drag — localizar tarde',
    'output.aware.trans_early_drag': 'Drag temprano en transición — esperar PnR rápido',
    'output.aware.screen_short_roll': 'Amenaza de short roll en pantallas — ayudar pronto',
    'output.aware.off_ball_flare': 'Tiradora en flare en pantallas — pasar por debajo o cambiar',
    'output.aware.high_post_face_up': 'Ataque de frente desde el codo — stance en gap',
    'output.aware.high_post_passer': 'Pasadora desde poste alto — negar cortes',
    'output.aware.high_post_stepback': 'Step-back desde el codo — contestar con longitud',
    'output.aware.high_post_versatile': 'Versátil: juego bajo y alto — scoutear ambos',
    'output.aware.iso_strong_hand_finish': 'Con mano dominante: prefiere {finish}.',
    'output.aware.iso_weak_hand_finish': 'Forzada a mano débil: prefiere {finish}.',
    'output.aware.trans_rim_run_graded': 'El rim run en transición es {freq}.',
    'output.aware.trans_trail_graded': 'El trail en transición es {freq}.',
    'output.aware.off_ball_screen_graded': 'Tras pantalla, {action} es {freq}.',
    'output.aware.off_ball_role': 'Tendencia de rol sin balón: {role}.',
    
    // ============= IDENTITY LABELS =============
    'output.identity.primary': 'Opción ofensiva principal',
    'output.identity.secondary': 'Opción ofensiva secundaria',
    'output.identity.role': 'Jugadora de rol',
    'output.identity.high_creation': 'Alta auto-creación',
    'output.identity.medium_creation': 'Auto-creación moderada',
    'output.identity.low_creation': 'Auto-creación limitada',
    // v2.1 - NEW identity labels
    'output.identity.ball_liability': 'Debilidad en manejo - oportunidad de presión',
    'output.identity.ball_limited': 'Manejo de balón limitado',
    
    // ============= PLAY TYPE LABELS =============
    'output.playtype.iso': 'ISO',
    'output.playtype.pnr': 'PnR Manejador',
    'output.playtype.post': 'Poste',
    'output.playtype.trans': 'Transición',
    'output.playtype.spot': 'Spot-up',
    'output.playtype.dho': 'DHO',
    'output.playtype.cut': 'Cortes',
    'output.playtype.indirect': 'Off-screen',
    
    // ============= FREQUENCY LABELS =============
    'output.freq.primary': '(P)',
    'output.freq.secondary': '(S)',
    'output.freq.rare': '(R)',
    
    // ============= ZONE LABELS =============
    'output.zone.paint': 'Pintura',
    'output.zone.perimeter': 'Perímetro',
    'output.zone.deep': 'Profundo (30+ ft)',
    'output.zone.corner': 'Esquina',
    'output.zone.wing': 'Alero',
    'output.zone.top': 'Cabeza del área',
    'output.zone.floater': 'Zona floater',
    'output.zone.elbow': 'Codo',
    // v2.1 - NEW zone label
    'output.zone.rim_trans': 'Aro (transición)',
    
    // ============= v2.1 - TRANSITION ROLE LABELS =============
    'output.trans_role.rim_run': 'Corredor al aro',
    'output.trans_role.trail': 'Trailer (3PT)',
    'output.trans_role.leak': 'Escape temprano',
    'output.trans_role.fill': 'Rellena espacios',
    
    // ============= v2.1 - BALL HANDLING LABELS =============
    'output.ball_handling.elite': 'Manejo de balón élite',
    'output.ball_handling.capable': 'Manejo de balón capaz',
    'output.ball_handling.limited': 'Manejo de balón limitado',
    'output.ball_handling.liability': 'Debilidad en manejo',
    
    // ============= v2.1 - PRESSURE RESPONSE LABELS =============
    'output.pressure.breaks': 'Rompe presión consistentemente',
    'output.pressure.escapes': 'Puede escapar presión',
    'output.pressure.struggles': 'Sufre bajo presión',
    
    // ============= v2.1 - POST MOVE LABELS =============
    'output.post_move.fade': 'Fadeaway',
    'output.post_move.turnaround': 'Turnaround',
    'output.post_move.hook': 'Gancho',
    'output.post_move.drop_step': 'Drop step',
    'output.post_move.up_and_under': 'Up-and-under',
    
    // ============= v2.1 - POST ENTRY LABELS =============
    'output.post_entry.pass': 'Entrada por pase',
    'output.post_entry.duck_in': 'Entrada duck-in',
    'output.post_entry.seal': 'Sella para recibir',
    'output.post_entry.flash': 'Flash al poste'
  },
  
  zh: {
    // ============= DENY OUTPUTS =============
    'output.deny.iso_space': '限制单打空间 - 迫使寻求帮助',
    'output.deny.pnr_downhill': '限制挡拆突破 - 延误/包夹',
    'output.deny.pnr_roll': '限制顺下 - 紧跟掩护者',
    'output.deny.pnr_pop': '限制外拆 - 干扰三分',
    'output.deny.pnr_slip': '限制提前切入 - 注意早切',
    'output.deny.post_entry': '限制低位进攻 - 绕前防守',
    'output.deny.post_shoulder': '限制{shoulder}肩 - 迫使反向',
    'output.deny.trans_run': '限制转换进攻 - 快速回防',
    'output.deny.spot_deep': '限制远距离三分 - 延伸防守',
    'output.deny.spot_corner': '限制底角三分 - 紧逼封堵',
    'output.deny.dho': '限制DHO - 阻断传球',
    'output.deny.cut_basket': '限制篮下空切 - 保持球侧',
    'output.deny.cut_backdoor': '限制反跑 - 保持球侧',
    'output.deny.cut_flash': '限制闪切 - 防止高位接球',
    'output.deny.cut_curl': '限制绕切 - 追过掩护',
    'output.deny.oreb': '限制前场篮板 - 优先卡位',
    'output.deny.floater': '限制抛投区域 - 高位干扰',
    // v2.1 - NEW DENY outputs
    'output.deny.trans_rim': '限制篮下冲刺 - 快速回防，不给轻松得分',
    'output.deny.trans_trail': '限制拖后三分 - 早找射手',
    'output.deny.duck_in': '限制内切卡位 - 防止深位封堵',
    'output.deny.post_seal': '限制低位封堵 - 争夺位置',
    'output.deny.ball_advance': '限制推进 - 全场施压',
    'output.deny.trans_seal': '限制转换中的挡人接球 — 提前顶防顺下',
    'output.deny.trans_runner_corner': '限制跑动中的底角三分 — 早找射手',
    'output.deny.high_post_catch': '限制高位/肘区接球 — 挤压肘区',
    'output.deny.screen_pop': '限制无球掩护外弹 — 干扰投篮',
    'output.deny.screen_slip': '限制无球掩护溜底线 — 跟紧切入',
    'output.deny.off_ball_curl': '限制掩护后卷切 — 追防或紧逼换防',
    
    // ============= FORCE OUTPUTS =============
    'output.force.direction': '迫使向{direction} - 离开舒适区',
    'output.force.weak_hand': '迫使用弱侧手({hand})',
    'output.force.perimeter': '迫使外线 - 不给禁区触球',
    'output.force.contact': '迫使接触 - 增加身体对抗',
    'output.force.early': '迫使早出手',
    'output.force.trap': '迫使陷入包夹 - 挡拆强延误',
    // v2.1 - NEW FORCE outputs
    'output.force.full_court': '迫使全场压迫 - 攻击持球',
    'output.force.no_ball': '迫使无球 - 限制推进',
    'output.force.no_push': '迫使不能运球推进 — 控制突破',
    
    // ============= ALLOW OUTPUTS =============
    'output.allow.post': '允许低位 - 无威胁',
    'output.allow.spot_three': '允许定点三分 - 可协防',
    'output.allow.iso': '允许单打 - 效率低',
    // v2.1 - NEW ALLOW output
    'output.allow.ball_handling': '允许运球 - 持球威胁有限',
    
    // ============= AWARE OUTPUTS =============
    'output.aware.passer': '精英传球手 - 不要赌博',
    'output.aware.trap': '善于应对包夹 - 快速轮转',
    'output.aware.physical': '身体型终结者 - 预期对抗',
    'output.aware.deep': '远距离威胁 - 半场开始防守',
    'output.aware.hands': '双手都能终结',
    'output.aware.oreb': '精英篮板手 - 每球卡位',
    'output.aware.connector': '串联者角色 - 阅读防守',
    // v2.1 - NEW AWARE outputs
    'output.aware.trans_leak': '转换早逃 - 注意提前跑位',
    'output.aware.post_efficient': '低位杀手 - 频率低但致命',
    'output.aware.post_fade': '危险后仰 - 干扰不犯规',
    'output.aware.post_turnaround': '有效转身跳投 - 保持纪律',
    'output.aware.post_hook': '勾手威胁 - 干扰但预期弧度',
    'output.aware.pressure_vuln': '压力下脆弱 - 积极进攻',
    'output.aware.pnr_direction': '挡拆终结随持球手侧变化 — 左手：{left}；右手：{right}',
    'output.aware.trans_trail_shoot': '拖后掩护后投篮 — 晚到也要找到她',
    'output.aware.trans_early_drag': '转换中早拖掩护 — 提防快速挡拆',
    'output.aware.screen_short_roll': '无球掩护短顺下威胁 — 提前协防',
    'output.aware.off_ball_flare': '无球掩护外弹投篮 — 绕下或换防',
    'output.aware.high_post_face_up': '肘区面框突破 — 留一步防突',
    'output.aware.high_post_passer': '高位传球手 — 盯无球切入',
    'output.aware.high_post_stepback': '肘区后撤步射程 — 干扰出手高度',
    'output.aware.high_post_versatile': '低位+高位兼备 — 两种打法都要盯',
    'output.aware.iso_strong_hand_finish': '强手单打时偏好：{finish}。',
    'output.aware.iso_weak_hand_finish': '被迫用弱手时偏好：{finish}。',
    'output.aware.trans_rim_run_graded': '转换冲筐频率：{freq}。',
    'output.aware.trans_trail_graded': '转换拖后频率：{freq}。',
    'output.aware.off_ball_screen_graded': '掩护后{action}频率：{freq}。',
    'output.aware.off_ball_role': '无球角色倾向：{role}。',
    
    // ============= IDENTITY LABELS =============
    'output.identity.primary': '主要进攻选择',
    'output.identity.secondary': '次要进攻选择',
    'output.identity.role': '角色球员',
    'output.identity.high_creation': '高自主进攻能力',
    'output.identity.medium_creation': '中等自主进攻能力',
    'output.identity.low_creation': '有限自主进攻能力',
    // v2.1 - NEW identity labels
    'output.identity.ball_liability': '控球弱点 - 施压机会',
    'output.identity.ball_limited': '控球能力有限',
    
    // ============= PLAY TYPE LABELS =============
    'output.playtype.iso': '单打',
    'output.playtype.pnr': '挡拆持球',
    'output.playtype.post': '低位背身',
    'output.playtype.trans': '转换进攻',
    'output.playtype.spot': '定点投篮',
    'output.playtype.dho': '手递手',
    'output.playtype.cut': '空切',
    'output.playtype.indirect': '无球掩护',
    
    // ============= FREQUENCY LABELS =============
    'output.freq.primary': '(主)',
    'output.freq.secondary': '(次)',
    'output.freq.rare': '(少)',
    
    // ============= ZONE LABELS =============
    'output.zone.paint': '禁区',
    'output.zone.perimeter': '外线',
    'output.zone.deep': '超远(30+英尺)',
    'output.zone.corner': '底角',
    'output.zone.wing': '侧翼',
    'output.zone.top': '弧顶',
    'output.zone.floater': '抛投区',
    'output.zone.elbow': '肘区',
    // v2.1 - NEW zone label
    'output.zone.rim_trans': '篮下(转换)',
    
    // ============= v2.1 - TRANSITION ROLE LABELS =============
    'output.trans_role.rim_run': '篮下冲刺者',
    'output.trans_role.trail': '拖后三分',
    'output.trans_role.leak': '早跑者',
    'output.trans_role.fill': '填充空间',
    
    // ============= v2.1 - BALL HANDLING LABELS =============
    'output.ball_handling.elite': '精英控球',
    'output.ball_handling.capable': '能够控球',
    'output.ball_handling.limited': '控球有限',
    'output.ball_handling.liability': '控球弱点',
    
    // ============= v2.1 - PRESSURE RESPONSE LABELS =============
    'output.pressure.breaks': '稳定破压',
    'output.pressure.escapes': '能够摆脱',
    'output.pressure.struggles': '压力下挣扎',
    
    // ============= v2.1 - POST MOVE LABELS =============
    'output.post_move.fade': '后仰跳投',
    'output.post_move.turnaround': '转身跳投',
    'output.post_move.hook': '勾手',
    'output.post_move.drop_step': '顺步',
    'output.post_move.up_and_under': '虚晃上篮',
    
    // ============= v2.1 - POST ENTRY LABELS =============
    'output.post_entry.pass': '传球进低位',
    'output.post_entry.duck_in': '内切进低位',
    'output.post_entry.seal': '封堵接球',
    'output.post_entry.flash': '闪切进低位'
  }
};

/**
 * Usage example - merge with your existing i18n:
 * 
 * import { MOTOR_V2_1_I18N } from './motor-v2.1-i18n';
 * 
 * const translations = {
 *   en: { ...existingEn, ...MOTOR_V2_1_I18N.en },
 *   es: { ...existingEs, ...MOTOR_V2_1_I18N.es },
 *   zh: { ...existingZh, ...MOTOR_V2_1_I18N.zh }
 * };
 */
