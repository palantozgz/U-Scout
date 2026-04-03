#!/usr/bin/env python3
import sys

filepath = "client/src/lib/i18n.ts"
try:
    with open(filepath) as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: {filepath} not found")
    sys.exit(1)

en_keys = """
  hint_post_quadrant: "For each block/direction combination, select the typical move. Optional — only fill what you have observed.",
  hint_athleticism: "1 = very limited athlete. 5 = elite explosiveness. Affects drive danger, backdoor cut risk, and transition threat level.",
  hint_physical_strength: "1 = weak in contact situations. 5 = physically dominant. Affects post danger, back-down effectiveness, and finishing through contact.",
  hint_court_vision: "1 = limited passer. 5 = elite playmaker. Unlocks Versatile Big, Playmaking Big, and Connector archetypes.",
  hint_ft_shooting: "1 = poor FT shooter (< 55%), very hackable. 5 = elite FT shooter (> 88%), never foul intentionally.",
  hint_foul_drawing: "How often does the player draw fouls? 1 = rarely. 5 = elite at drawing contact — fouling is very costly.",
  hint_post_frequency: "How often does the player score from the post? Primary = major weapon. Secondary = selective. Rare = almost never. Never = no post game.",
  hint_post_dominant_hand: "The hand preferred for finishing in the post. Determines which block is the strong side — shown with star in the diagram.",
  hint_post_profile: "What type of post player? Affects how the defensive plan is generated.",
  hint_duck_in: "A duck-in is when the player seals the defender on their back during live play and calls for the ball — opportunistic, not a set play.",
  hint_iso_frequency: "How often does the player create 1-on-1 from the perimeter? For interior creation use the Post tab.",
  hint_iso_dominant_direction: "Left = attacks to their left. Right = to their right. Balanced = both ways. Feeds the Force recommendation in the defensive plan.",
  hint_iso_initiation: "Controlled = reads defense with jab step. Quick Attack = attacks immediately off the catch.",
  hint_iso_decision: "Once the player beats their defender, what do they typically do?",
  hint_closeout_general: "What does the player do when a defender runs at them on a closeout? Default for both wings.",
  hint_closeout_directional: "Optional — overrides the general closeout reaction per wing.",
  hint_pnr_role: "Handler = uses the screen. Screener = sets the screen. Both = can do either depending on lineup.",
  hint_pnr_scoring: "Score First = attacks the basket. Pass First = looks for open screener. Balanced = reads defense.",
  hint_pnr_under: "When the defender goes under the screen, what does the player do? Determines whether going under is safe.",
  hint_pnr_timing: "Early/Drag = PnR early in shot clock or transition. Half-court = deliberate set plays.",
  hint_transition_role: "Pusher = pushes ball up floor. Outlet = runs wide open for catch-and-shoot. Rim Runner = sprints for lob. Trailer = arrives late for pull-up three.",
  hint_indirects: "How often does the player use off-ball screens? Includes pin-downs, flares, curls, staggers.",
  hint_slip: "How often does the player slip — cut early before the screen is set?",
  hint_backdoor: "How often does the player cut backdoor when over-defended?",
  hint_orb: "How aggressively does the player crash the offensive glass?",
"""

es_keys = """
  hint_post_quadrant: "Para cada combinación de bloque/dirección, selecciona el movimiento típico. Opcional — solo rellena lo observado.",
  hint_athleticism: "1 = atleta muy limitado. 5 = explosividad elite. Afecta al peligro en drive, riesgo de backdoor y amenaza en transición.",
  hint_physical_strength: "1 = débil en contacto. 5 = físicamente dominante. Afecta al peligro en el poste, back-down y finalización con contacto.",
  hint_court_vision: "1 = pasador limitado. 5 = creador elite. Desbloquea arquetipos Versatile Big, Playmaking Big y Connector.",
  hint_ft_shooting: "1 = mala tiradora de libres (< 55%), hackeable. 5 = elite (> 88%), nunca faultar intencionalmente.",
  hint_foul_drawing: "¿Con qué frecuencia provoca faltas? 1 = raramente. 5 = elite provocando contacto.",
  hint_post_frequency: "¿Con qué frecuencia anota desde el poste? Primario = arma principal. Secundario = selectivo. Raro = casi nunca. Nunca = sin juego interior.",
  hint_post_dominant_hand: "La mano preferida para finalizar en el poste. Determina el bloque fuerte — marcado con estrella en el diagrama.",
  hint_post_profile: "¿Qué tipo de jugadora de poste? Afecta cómo se genera el plan defensivo.",
  hint_duck_in: "Un duck-in es cuando sella al defensor en la espalda durante el juego vivo y pide el balón — lectura oportunista.",
  hint_iso_frequency: "¿Con qué frecuencia crea 1 contra 1 desde el perímetro? Para creación interior usa la pestaña Poste.",
  hint_iso_dominant_direction: "Izquierda = ataca a su izquierda. Derecha = a su derecha. Equilibrado = ambas. Alimenta la recomendación de Forzar.",
  hint_iso_initiation: "Controlado = lee la defensa con paso de prueba. Ataque inmediato = ataca nada más recibir.",
  hint_iso_decision: "Una vez que supera al defensor, ¿qué hace normalmente?",
  hint_closeout_general: "¿Qué hace cuando un defensor corre hacia ella en un closeout? Por defecto para ambas alas.",
  hint_closeout_directional: "Opcional — sobreescribe la reacción general por ala.",
  hint_pnr_role: "Manejador = usa la pantalla. Bloqueador = pone la pantalla. Ambos = puede hacer cualquiera.",
  hint_pnr_scoring: "Anotar primero = ataca el aro. Pasar primero = busca al bloqueador. Equilibrado = lee la defensa.",
  hint_pnr_under: "Cuando el defensor pasa por debajo, ¿qué hace? Determina si esa cobertura es segura.",
  hint_pnr_timing: "Temprano/Drag = PnR temprano en el reloj o transición. Media cancha = jugadas diseñadas.",
  hint_transition_role: "Conduce = sube el balón. Outlet = corre al ala abierta. Rim Runner = sprint al aro. Trailer = llega tarde para el triple.",
  hint_indirects: "¿Con qué frecuencia usa pantallas sin balón? Incluye pin-downs, flares, curls, staggers.",
  hint_slip: "¿Con qué frecuencia hace slip — corta antes de que se ponga la pantalla?",
  hint_backdoor: "¿Con qué frecuencia corta a la espalda cuando se le defiende en exceso?",
  hint_orb: "¿Con qué agresividad busca el rebote ofensivo?",
"""

zh_keys = """
  hint_post_quadrant: "对于每个低位区域/方向组合，选择典型动作。可选 — 只填写实际观察到的内容。",
  hint_athleticism: "1 = 运动能力很弱。5 = 精英爆发力。影响突破威胁、背切风险和快攻威胁等级。",
  hint_physical_strength: "1 = 对抗较弱。5 = 身体对抗强。影响低位危险、后退压制效果和带接触终结能力。",
  hint_court_vision: "1 = 传球能力有限。5 = 精英组织者。解锁Versatile Big、Playmaking Big和Connector档案类型。",
  hint_ft_shooting: "1 = 罚球差（< 55%），可故意犯规。5 = 精英罚球（> 88%），绝不故意犯规。",
  hint_foul_drawing: "球员多频繁造犯规？1 = 很少。5 = 造犯规能力精英 — 犯规代价很高。",
  hint_post_frequency: "球员多频繁从低位得分？主要 = 主要武器。次要 = 选择性使用。偶尔 = 几乎从不。从不 = 无内线进攻。",
  hint_post_dominant_hand: "低位终结的惯用手。决定哪个低位是强侧 — 在图表中用星号标注。",
  hint_post_profile: "什么类型的低位球员？影响防守方案的生成方式。",
  hint_duck_in: "鸭入是指球员在实时比赛中将防守者封在背后并要求传球 — 机会性读取，非定位配合。",
  hint_iso_frequency: "球员多频繁从外线创造单打机会？内线创造请使用低位标签。",
  hint_iso_dominant_direction: "左 = 向左侧突破。右 = 向右侧突破。均衡 = 两侧均可。影响防守方案中的强迫方向建议。",
  hint_iso_initiation: "控制型 = 通过试探步读取防守。快速进攻 = 接球后立即进攻。",
  hint_iso_decision: "一旦突破防守者，通常会做什么？",
  hint_closeout_general: "当防守者向其补防时会做什么？默认适用于两侧翼区。",
  hint_closeout_directional: "可选 — 按翼区覆盖通用补防反应。",
  hint_pnr_role: "持球人 = 使用掩护。掩护人 = 设置掩护。两者皆可 = 根据阵容担任任一角色。",
  hint_pnr_scoring: "得分优先 = 攻击篮筐。传球优先 = 寻找空位掩护人。均衡 = 读取防守。",
  hint_pnr_under: "当防守者从掩护下方绕过时，球员会做什么？决定绕底防守是否安全。",
  hint_pnr_timing: "早期/拖拽 = 在进攻时间较早或快攻中设置掩护。半场 = 定位配合。",
  hint_transition_role: "推进者 = 自己推进球。外线接应 = 跑到外线接球投三分。冲篮 = 冲向篮下。跟进者 = 晚到接三分跳投。",
  hint_indirects: "球员多频繁使用无球掩护？包括pin-down、flare、curl、stagger。",
  hint_slip: "球员多频繁做slip — 在掩护设置前提前切入？",
  hint_backdoor: "当防守过度时，球员多频繁背切？",
  hint_orb: "球员抢前场篮板的积极程度如何？",
"""

def insert_before(text, marker, new_keys):
    if marker in text:
        return text.replace(marker, new_keys.strip() + "\n  " + marker)
    print(f"WARNING: marker not found: {marker[:40]}")
    return text

content = insert_before(content, 'settings_title: "Settings",', en_keys)
content = insert_before(content, 'settings_title: "Ajustes",', es_keys)
content = insert_before(content, 'settings_title: "设置",', zh_keys)

with open(filepath, 'w') as f:
    f.write(content)

with open(filepath) as f:
    check = f.read()

count = check.count("hint_athleticism:")
print(f"Done: {check.count(chr(10))} lines")
print(f"hint_athleticism in {count} languages: {'ok' if count == 3 else 'ERROR'}")
print(f"hint_orb present: {'hint_orb:' in check}")
