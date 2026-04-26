/**
 * U Scout — LLM Report Quality Evaluator v2 (Multi-Judge Panel)
 *
 * Panel de 4 jueces LLM para eliminar sesgo de juez único:
 *   - Claude Sonnet   (Anthropic)
 *   - GPT-4o mini     (OpenAI)
 *   - Gemini Flash    (Google — tier gratuito)
 *   - DeepSeek V3     (DeepSeek — coste mínimo)
 *
 * Ground truth: fragmentos reales de Synergy/Basketball Immersion + Coach's Clipboard
 * Detecta discrepancias entre jueces → Pablo revisa solo esos casos
 *
 * Uso:
 *   npx tsx scripts/eval-report-llm.ts                    (todos los perfiles, todos los jueces)
 *   npx tsx scripts/eval-report-llm.ts --fast             (5 perfiles, todos los jueces)
 *   npx tsx scripts/eval-report-llm.ts --profile llm001   (un perfil)
 *   npx tsx scripts/eval-report-llm.ts --judge claude     (solo un juez, para debug)
 *
 * Requiere en .env:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   OPENAI_API_KEY=sk-...
 *   GOOGLE_API_KEY=AI...
 *   DEEPSEEK_API_KEY=sk-...
 *   (Los jueces sin key se saltan automáticamente — mínimo 1 requerido)
 */

import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import * as fs from "fs";
import * as path from "path";

// ─── Cargar .env ──────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai:    process.env.OPENAI_API_KEY,
  google:    process.env.GOOGLE_API_KEY,
  deepseek:  process.env.DEEPSEEK_API_KEY,
};

const FAST_MODE     = process.argv.includes("--fast");
const SINGLE_PROFILE = (() => { const i = process.argv.indexOf("--profile"); return i !== -1 ? process.argv[i + 1] : null; })();
const SINGLE_JUDGE   = (() => { const i = process.argv.indexOf("--judge");   return i !== -1 ? process.argv[i + 1] : null; })();

const ACTIVE_JUDGES = (["claude", "gpt", "gemini", "deepseek"] as const).filter(j => {
  if (SINGLE_JUDGE && j !== SINGLE_JUDGE) return false;
  if (j === "claude"   && !KEYS.anthropic) return false;
  if (j === "gpt"      && !KEYS.openai)    return false;
  if (j === "gemini"   && !KEYS.google)    return false;
  if (j === "deepseek" && !KEYS.deepseek)  return false;
  return true;
});

if (ACTIVE_JUDGES.length === 0) {
  console.error("❌ Ninguna API key encontrada en .env. Necesitas al menos una de:");
  console.error("   ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, DEEPSEEK_API_KEY");
  process.exit(1);
}

// Umbral de discrepancia: diferencia de score global entre jueces que merece revisión manual
const DISCREPANCY_THRESHOLD = 2.0;

// ─── Ground truth — fragmentos reales de scouting profesional ────────────────
// Fuente: Basketball Immersion / Synergy Sports + Coach's Clipboard
// Estos fragmentos se incluyen en el prompt del juez como referencia de calidad

const GROUND_TRUTH_EXAMPLES = `
EJEMPLOS REALES DE SCOUTING PROFESIONAL (fuente: Synergy Sports / Basketball Immersion):

EJEMPLO 1 — Tiradora de perímetro (Wade/Korver):
"Decent perimeter shooter; need to play him like a Korver and have a tight closeout.
In doing so, need to force him to drive LEFT (0.4 PPP, 20% TOr); make sure though to
not leave him open at all on the perimeter as he can knock down open looks."
→ Calidad: ALTA. Específico (dirección + PPP), ejecutable 1-on-1, proporcional al perfil.

EJEMPLO 2 — Jugador con baja eficiencia en una dirección:
"In forcing him right, we want to make sure that he takes a pull up jumper — that would
be a win on defense as opposed to giving up a drive to the basket (0.625 vs 1.429 PPP).
He is also more turnover prone driving right (22.7%)."
→ Calidad: ALTA. Justifica la instrucción con datos, sin ambigüedad.

EJEMPLO 3 — Screener / PnR:
"Play tight against him at all times to force him to get to the basket where he is not
a good finisher (0.571 PPP) and he does not get fouled often."
→ Calidad: ALTA. La instrucción explica el porqué (baja eficiencia en finish).

EJEMPLO 4 — Instrucción de baja calidad (NO hacer esto):
"He is a good player. Be aware of his scoring ability. Play good defense."
→ Calidad: BAJA. Genérica, no ejecutable, no específica del jugador.

CLASIFICACIÓN RONDO / WADE / KORVER (estándar profesional):
- RONDO: no es tirador. Puedes sagged, tapa el drive, no el spot-up.
- WADE:  tirador medio. Closeout normal, no dejarle abierto.
- KORVER: tirador élite. Closeout siempre tight, forzar el bote.
→ El informe debe implícitamente clasificar al jugador en una de estas categorías.

PRINCIPIOS DEFENSIVOS 1-on-1 (fuente: Coach's Clipboard):
- DENY = negar la recepción del balón (jugador a 1 pase del balón)
- FORCE = dirección de penetración (hacia mano débil, hacia baseline, etc.)
- ALLOW = qué conceder (el tiro menos eficiente del jugador)
- Las instrucciones DEBEN ser ejecutables por UN solo jugador SIN ayuda del equipo.
- Rotaciones, trampas y ayudas colectivas están FUERA del scope 1-on-1.

PPP DE REFERENCIA (Synergy / Frontiers en Psicología):
- Cortes: 1.58 PPP (máx eficiencia) → DENY si frecuente
- Spot-up alta: ~1.15 PPP → DENY si es Korver
- Transición: ~1.10 PPP → DENY si es velocista
- PnR handler: ~0.90 PPP → contener, no ALLOW
- ISO: ~0.85 PPP → FORCE dirección, ALLOW si bajo porcentaje
- Post-up: ~0.78 PPP → ALLOW si es screener puro
→ Proporcionalidad: si una situación tiene PPP alto → instrucción fuerte. Si PPP bajo → ALLOW.
`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type JudgeName = "claude" | "gpt" | "gemini" | "deepseek";

interface LLMScore {
  coherencia_interna: number;   // 0-10
  accionabilidad:     number;   // 0-10
  proporcion:         number;   // 0-10
  especificidad:      number;   // 0-10
  narrativa:          number;   // 0-10
}

interface LLMFallo {
  dimension:   keyof LLMScore;
  origen:      "input" | "motor" | "renderer" | "concepto";
  descripcion: string;
  sugerencia:  string;
}

interface JudgeVeredicto {
  judge:        JudgeName;
  scores:       LLMScore;
  score_global: number;
  fallos:       LLMFallo[];
  resumen:      string;
  error?:       string;
}

interface PanelVeredicto {
  judge_scores:     Record<JudgeName, number>;
  consensus_score:  number;
  score_by_dim:     Record<keyof LLMScore, number>;
  discrepancy:      number;          // max - min entre jueces
  needs_review:     boolean;         // discrepancy > DISCREPANCY_THRESHOLD
  merged_fallos:    LLMFallo[];      // fallos detectados por ≥2 jueces
  judge_verdicts:   JudgeVeredicto[];
}

interface EvalProfile {
  id:            string;
  descripcion:   string;
  plan_esperado: string;
  inputs:        any;
  clubContext?:  any;
}

interface ProfileResult {
  profile_id:     string;
  descripcion:    string;
  plan_esperado:  string;
  report_generado: {
    archetype:   string;
    tagline:     string;
    danger:      string;
    situaciones: string[];
    deny_texto:  string;
    force_texto: string;
    allow_texto: string;
    alerts:      string[];
  };
  panel:          PanelVeredicto;
  passed:         boolean;
  error?:         string;
}

// ─── Llamadas a APIs ──────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": KEYS.anthropic!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.content?.[0]?.text ?? "";
}

async function callGPT(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KEYS.openai}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEYS.google}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1200 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callDeepSeek(prompt: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KEYS.deepseek}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

const JUDGE_CALLERS: Record<JudgeName, (p: string) => Promise<string>> = {
  claude:   callClaude,
  gpt:      callGPT,
  gemini:   callGemini,
  deepseek: callDeepSeek,
};

// ─── Prompt del evaluador ─────────────────────────────────────────────────────

function buildEvalPrompt(profile: EvalProfile, report: any): string {
  return `Eres un scout de baloncesto profesional con 15 años de experiencia (NBA/WNBA/ACB/WCBA).
Tu trabajo es evaluar si este informe defensivo individual es profesional, específico y útil.

${GROUND_TRUTH_EXAMPLES}

---

PERFIL DEL JUGADOR A DEFENDER:
- Posición: ${profile.inputs.pos} | Mano: ${profile.inputs.hand} | Ath: ${profile.inputs.ath}/5 | Físico: ${profile.inputs.phys}/5
- Rol: ${profile.inputs.usage} | Auto-creación: ${profile.inputs.selfCreation}
- Situación primaria: ${
    profile.inputs.isoFreq === "P" ? "ISO" :
    profile.inputs.pnrFreq === "P" ? "PnR" :
    profile.inputs.postFreq === "P" ? "Post" :
    profile.inputs.spotUpFreq === "P" ? "Spot-up" :
    profile.inputs.transFreq === "P" ? "Transición" : "múltiple/rol"
  }
- Descripción: ${profile.descripcion}

INFORME DEFENSIVO GENERADO:
- Arquetipo: ${report.archetype}
- Tagline: ${report.tagline}
- Nivel de amenaza: ${report.danger}
- Situaciones top: ${report.situaciones.join(" | ")}
- DENY: ${report.deny_texto}
- FORCE: ${report.force_texto}
- ALLOW: ${report.allow_texto}
- AWARE: ${report.alerts.join(" | ") || "ninguna"}

PLAN ESPERADO:
${profile.plan_esperado}

---

Evalúa en 5 dimensiones (0-10). Sé crítico — un 8 significa "casi perfecto", un 10 es rarísimo.
Compara siempre con los ejemplos reales de Synergy que tienes arriba como referencia.

1. coherencia_interna (0-10): ¿DENY/FORCE/ALLOW se contradicen? ¿Las instrucciones son consistentes entre sí?
2. accionabilidad (0-10): ¿Puede UN jugador ejecutar esto SOLO sin ayuda del equipo? Penaliza rotaciones, trampas o ayudas colectivas.
3. proporcion (0-10): ¿El nivel de alerta es proporcional al perfil? Un screener puro no debe tener DENY urgente. Un primary ISO con ath 5 no debe tener ALLOW amplio.
4. especificidad (0-10): ¿El informe describe a ESTE jugador o podría valer para cualquier SG diestro? Penaliza instrucciones genéricas.
5. narrativa (0-10): ¿Slide 1 (quién es) → Slide 2 (qué hará) → Slide 3 (qué hago) cuenta una historia coherente y progresiva?

Para CADA dimensión con score < 7, indica:
- origen: "input" | "motor" | "renderer" | "concepto"
- descripcion: qué está mal en una frase concisa
- sugerencia: cómo debería verse

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto extra:

{
  "scores": {
    "coherencia_interna": <0-10>,
    "accionabilidad": <0-10>,
    "proporcion": <0-10>,
    "especificidad": <0-10>,
    "narrativa": <0-10>
  },
  "score_global": <promedio redondeado a 1 decimal>,
  "fallos": [
    { "dimension": "<dim>", "origen": "<origen>", "descripcion": "<qué>", "sugerencia": "<cómo>" }
  ],
  "resumen": "<1-2 frases sobre calidad global>"
}`;
}

// ─── Parseo respuesta LLM ─────────────────────────────────────────────────────

function parseLLMResponse(raw: string): Omit<JudgeVeredicto, "judge"> | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const p = JSON.parse(cleaned);
    if (!p.scores || typeof p.score_global !== "number") return null;
    return {
      scores:       p.scores,
      score_global: p.score_global,
      fallos:       p.fallos ?? [],
      resumen:      p.resumen ?? "",
    };
  } catch {
    return null;
  }
}

// ─── Llamada a un juez ────────────────────────────────────────────────────────

async function callJudge(judge: JudgeName, prompt: string): Promise<JudgeVeredicto> {
  try {
    const raw = await JUDGE_CALLERS[judge](prompt);
    const parsed = parseLLMResponse(raw);
    if (!parsed) throw new Error(`Respuesta no parseable: ${raw.slice(0, 150)}`);
    return { judge, ...parsed };
  } catch (err: any) {
    return {
      judge,
      scores: { coherencia_interna: 0, accionabilidad: 0, proporcion: 0, especificidad: 0, narrativa: 0 },
      score_global: 0,
      fallos: [],
      resumen: "",
      error: err.message,
    };
  }
}

// ─── Agregar panel ────────────────────────────────────────────────────────────

function aggregatePanel(verdicts: JudgeVeredicto[]): PanelVeredicto {
  const valid = verdicts.filter(v => !v.error && v.score_global > 0);

  const judge_scores = Object.fromEntries(
    verdicts.map(v => [v.judge, v.score_global])
  ) as Record<JudgeName, number>;

  const consensus_score = valid.length > 0
    ? Math.round((valid.reduce((a, v) => a + v.score_global, 0) / valid.length) * 10) / 10
    : 0;

  const dims: (keyof LLMScore)[] = ["coherencia_interna", "accionabilidad", "proporcion", "especificidad", "narrativa"];
  const score_by_dim = Object.fromEntries(
    dims.map(dim => {
      const avg = valid.length > 0
        ? valid.reduce((a, v) => a + (v.scores[dim] ?? 0), 0) / valid.length
        : 0;
      return [dim, Math.round(avg * 10) / 10];
    })
  ) as Record<keyof LLMScore, number>;

  const scores = valid.map(v => v.score_global);
  const discrepancy = scores.length >= 2
    ? Math.max(...scores) - Math.min(...scores)
    : 0;

  // Fallos detectados por ≥2 jueces (por dimensión + origen coincidentes)
  const falloCount: Record<string, { fallo: LLMFallo; count: number }> = {};
  for (const v of valid) {
    for (const f of v.fallos) {
      const key = `${f.dimension}::${f.origen}`;
      if (!falloCount[key]) falloCount[key] = { fallo: f, count: 0 };
      falloCount[key].count++;
    }
  }
  const merged_fallos = Object.values(falloCount)
    .filter(({ count }) => count >= Math.max(2, Math.floor(valid.length / 2)))
    .map(({ fallo }) => fallo);

  return {
    judge_scores,
    consensus_score,
    score_by_dim,
    discrepancy: Math.round(discrepancy * 10) / 10,
    needs_review: discrepancy >= DISCREPANCY_THRESHOLD,
    merged_fallos,
    judge_verdicts: verdicts,
  };
}

// ─── Renderizar perfil ────────────────────────────────────────────────────────

function renderProfile(profile: EvalProfile): any {
  const ctx = profile.clubContext ?? { clubId: "eval", gender: "f", locale: "en" };
  const motorOutput = generateMotorV4(profile.inputs, ctx);
  const rendered = renderReport(motorOutput, { locale: "en", clubGender: ctx.gender });
  return {
    archetype:   rendered.identity?.archetype ?? "Unknown",
    tagline:     rendered.identity?.tagline ?? "",
    danger:      rendered.identity?.dangerLevel ?? "",
    situaciones: (rendered.situations ?? []).slice(0, 3).map((s: any) => s.label ?? s.key ?? ""),
    deny_texto:  rendered.defense?.deny?.text ?? "",
    force_texto: rendered.defense?.force?.text ?? "",
    allow_texto: rendered.defense?.allow?.text ?? "",
    alerts:      (rendered.alerts ?? []).map((a: any) => a.text ?? a.key ?? ""),
  };
}

// ─── Perfiles de evaluación ───────────────────────────────────────────────────

const BASE_PROFILES: EvalProfile[] = [
  {
    id: "llm001",
    descripcion: "Escolta anotadora ISO primaria, zurda, penetradora, sin tiro exterior",
    plan_esperado: "DENY: espacio ISO lado derecho. FORCE: mano débil (derecha). ALLOW: spot-up threes o poste. Sin contradicciones de dirección.",
    inputs: { pos:"SG", hand:"L", ath:5, phys:3, usage:"primary", selfCreation:"high", isoFreq:"P", isoEff:"high", isoDir:"L", isoFinishLeft:"rim", isoFinishRight:"pull_up", contactFinish:"seeks", pnrFreq:"S", pnrFinish:"Drive", spotUpFreq:"R", deepRange:false, postFreq:"N", transFreq:"S", cutFreq:"N", dhoFreq:"N", indirectFreq:"N", floater:"S", orebThreat:"low", vision:3, ballHandling:"elite", pressureResponse:"escapes", screenerAction:null },
  },
  {
    id: "llm002",
    descripcion: "Pivot postero dominante ambidextro, físico alto, sin exterior",
    plan_esperado: "DENY: entrada al poste. Sin FORCE de dirección claro (ambidiestro). ALLOW: spot-up threes. AWARE: rebote ofensivo.",
    inputs: { pos:"C", hand:"R", ath:3, phys:5, usage:"primary", selfCreation:"low", postFreq:"P", postEff:"high", postProfile:"B2B", postShoulder:"R", postMoves:["hook","drop_step","up_and_under"], postEntry:"seal", isoFinishLeft:"rim", isoFinishRight:"rim", isoFreq:"N", pnrFreq:"N", transFreq:"N", spotUpFreq:"N", deepRange:false, orebThreat:"high", putbackQuality:"primary", contactFinish:"seeks", offHandFinish:"capable", vision:2, floater:"N", cutFreq:"N", dhoFreq:"N", indirectFreq:"N", screenerAction:null, ballHandling:null, pressureResponse:null },
  },
  {
    id: "llm003",
    descripcion: "Base PnR handler con tiro de tres, passer de élite, rol primario",
    plan_esperado: "DENY: espacio PnR. FORCE: contener, no dejar ir downhill. ALLOW: poste. AWARE: passer de élite — no doblar.",
    inputs: { pos:"PG", hand:"R", ath:4, phys:3, usage:"primary", selfCreation:"high", pnrFreq:"P", pnrFinish:"Drive", pnrSnake:false, isoFreq:"S", isoDir:"R", isoEff:"medium", isoFinishLeft:"pull_up", isoFinishRight:"rim", spotUpFreq:"S", deepRange:true, postFreq:"N", transFreq:"S", floater:"S", orebThreat:"low", vision:5, ballHandling:"elite", pressureResponse:"escapes", screenerAction:"pop", contactFinish:"capable", offHandFinish:"capable", cutFreq:"N", dhoFreq:"N", indirectFreq:"N" },
  },
  {
    id: "llm004",
    descripcion: "Alero rol: spot-up shooter especialista, sin creación propia",
    plan_esperado: "DENY: recepciones en sus zonas de triple. FORCE: ninguno relevante. ALLOW: ISO o bote. No sobrealarmar — es jugador de rol.",
    inputs: { pos:"SF", hand:"R", ath:3, phys:3, usage:"role", selfCreation:"low", spotUpFreq:"P", spotUpEff:"high", deepRange:false, spotZones:{ cornerLeft:true, cornerRight:true, wing45Left:false, wing45Right:false, top:false }, isoFreq:"N", pnrFreq:"N", postFreq:"N", transFreq:"R", cutFreq:"S", dhoFreq:"N", indirectFreq:"S", floater:"N", orebThreat:"low", vision:2, ballHandling:"limited", pressureResponse:"struggles", screenerAction:null, contactFinish:"avoids", offHandFinish:"weak" },
  },
  {
    id: "llm005",
    descripcion: "Ala-pivot transición primaria, cortes frecuentes, sin tiro exterior",
    plan_esperado: "DENY: sprint en transición y cortes. FORCE: fuera de canasta, hacia perímetro. ALLOW: spot-up threes. Foco en movimiento sin balón.",
    inputs: { pos:"PF", hand:"R", ath:5, phys:4, usage:"secondary", selfCreation:"medium", transFreq:"P", transRole:"rim_run", cutFreq:"P", cutTypes:["basket","backdoor"], isoFreq:"R", pnrFreq:"S", pnrFinish:"Drive", spotUpFreq:"N", deepRange:false, postFreq:"S", postShoulder:"R", postMoves:["drop_step"], postEntry:"flash", floater:"N", orebThreat:"medium", vision:3, ballHandling:"limited", pressureResponse:"struggles", screenerAction:"roll", contactFinish:"seeks", offHandFinish:"capable", dhoFreq:"N", indirectFreq:"N" },
  },
  {
    id: "llm006",
    descripcion: "Jugador ambiguo: inputs mínimos — test de robustez del motor",
    plan_esperado: "El informe debe ser conservador, sin instrucciones contradictorias. Mejor menos que información errónea.",
    inputs: { pos:"SF", hand:"R", ath:3, phys:3, usage:"secondary", selfCreation:"medium", isoFreq:"S", isoEff:"medium", isoFinishLeft:"pull_up", isoFinishRight:"pull_up", pnrFreq:"R", spotUpFreq:"R", postFreq:"N", transFreq:"R", cutFreq:"N", dhoFreq:"N", indirectFreq:"N", floater:"N", orebThreat:"low", vision:3, ballHandling:"capable", pressureResponse:null, screenerAction:null, contactFinish:"capable", offHandFinish:"capable", deepRange:false },
  },
  {
    id: "llm007",
    descripcion: "Base que se desactiva con presión individual, baja eficiencia ISO",
    plan_esperado: "FORCE: presión individual. DENY: avance libre. Mención a que la presión es la herramienta clave. Sin instrucciones colectivas.",
    inputs: { pos:"PG", hand:"R", ath:4, phys:2, usage:"secondary", selfCreation:"medium", isoFreq:"S", isoEff:"low", isoDir:"R", isoFinishLeft:"pull_up", isoFinishRight:"pull_up", pnrFreq:"S", pnrFinish:"Pull-up", spotUpFreq:"R", deepRange:false, postFreq:"N", transFreq:"S", floater:"S", orebThreat:"low", vision:2, ballHandling:"capable", pressureResponse:"struggles", screenerAction:null, contactFinish:"avoids", offHandFinish:"weak", cutFreq:"N", dhoFreq:"N", indirectFreq:"N" },
  },
  {
    id: "llm008",
    descripcion: "Tiradora élite de spot-up con deepRange, sin creación propia",
    plan_esperado: "DENY: recepciones profundas. Cierre largo y anticipado. ALLOW: ISO. Sin FORCE de dirección (no tiene ISO relevante).",
    inputs: { pos:"SG", hand:"R", ath:3, phys:2, usage:"secondary", selfCreation:"low", spotUpFreq:"P", spotUpEff:"high", deepRange:true, spotZones:{ cornerLeft:false, cornerRight:false, wing45Left:true, wing45Right:true, top:true }, isoFreq:"N", pnrFreq:"N", postFreq:"N", transFreq:"R", cutFreq:"R", indirectFreq:"P", floater:"N", orebThreat:"low", vision:2, ballHandling:"limited", pressureResponse:"struggles", screenerAction:null, contactFinish:"avoids", offHandFinish:"weak", dhoFreq:"N" },
  },
  {
    id: "llm009",
    descripcion: "Pivot screener puro, sin amenaza ofensiva real — test de ALLOW / bajo peligro",
    plan_esperado: "Informe que reconoce bajo peligro. ALLOW amplio. No sobrealarmar. No debe parecer diseñado para una anotadora.",
    inputs: { pos:"C", hand:"R", ath:3, phys:4, usage:"role", selfCreation:"low", isoFreq:"N", pnrFreq:"N", postFreq:"R", spotUpFreq:"N", deepRange:false, transFreq:"R", cutFreq:"R", indirectFreq:"N", dhoFreq:"N", floater:"N", orebThreat:"medium", vision:2, ballHandling:null, pressureResponse:null, screenerAction:"roll", contactFinish:"capable", offHandFinish:"weak" },
  },
  {
    id: "llm010",
    descripcion: "Jugadora WNBA completa: ISO + PnR + spot-up + transición, ath 5, passer élite",
    plan_esperado: "Informe completo y proporcionado. DENY principal claro. FORCE con dirección. AWARE: passer. El reto es priorizar — no todo igual de urgente.",
    inputs: { pos:"SG", hand:"R", ath:5, phys:4, usage:"primary", selfCreation:"high", isoFreq:"P", isoEff:"high", isoDir:"R", isoFinishLeft:"eurostep", isoFinishRight:"rim", pnrFreq:"S", pnrFinish:"Drive", pnrSnake:true, spotUpFreq:"S", deepRange:true, transFreq:"S", transRole:"leak", postFreq:"N", cutFreq:"R", dhoFreq:"N", indirectFreq:"R", floater:"S", orebThreat:"low", vision:5, ballHandling:"elite", pressureResponse:"escapes", screenerAction:null, contactFinish:"seeks", offHandFinish:"capable" },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runEval() {
  const profilesToRun = SINGLE_PROFILE
    ? BASE_PROFILES.filter(p => p.id === SINGLE_PROFILE)
    : FAST_MODE ? BASE_PROFILES.slice(0, 5)
    : BASE_PROFILES;

  if (profilesToRun.length === 0) {
    console.error(`❌ Perfil "${SINGLE_PROFILE}" no encontrado.`);
    console.error(`   IDs: ${BASE_PROFILES.map(p => p.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🏀 U Scout — LLM Report Evaluator v2 (Multi-Judge)`);
  console.log(`   Jueces activos: ${ACTIVE_JUDGES.join(", ")}`);
  console.log(`   Umbral discrepancia: ≥${DISCREPANCY_THRESHOLD} → revisión manual`);
  console.log(`   Perfiles: ${profilesToRun.length}${FAST_MODE ? " (fast)" : ""}\n`);

  const results: ProfileResult[] = [];
  let totalConsensus = 0;
  let reviewCount = 0;
  const failuresByOrigin: Record<string, number> = { input:0, motor:0, renderer:0, concepto:0 };

  for (let i = 0; i < profilesToRun.length; i++) {
    const profile = profilesToRun[i];
    process.stdout.write(`  [${i+1}/${profilesToRun.length}] ${profile.id} — ${profile.descripcion.slice(0,45)}...`);

    let result: ProfileResult;

    try {
      const report = renderProfile(profile);
      const prompt  = buildEvalPrompt(profile, report);

      // Llamar a todos los jueces activos en paralelo
      const verdicts = await Promise.all(
        ACTIVE_JUDGES.map(j => callJudge(j, prompt))
      );

      const panel = aggregatePanel(verdicts);

      totalConsensus += panel.consensus_score;
      if (panel.needs_review) reviewCount++;
      for (const f of panel.merged_fallos) {
        failuresByOrigin[f.origen] = (failuresByOrigin[f.origen] ?? 0) + 1;
      }

      const reviewFlag = panel.needs_review ? " ⚠️ REVISAR" : "";
      const discStr = panel.discrepancy > 0 ? ` (Δ${panel.discrepancy})` : "";
      console.log(` ✓ ${panel.consensus_score.toFixed(1)}/10${discStr}${reviewFlag}`);

      result = {
        profile_id:     profile.id,
        descripcion:    profile.descripcion,
        plan_esperado:  profile.plan_esperado,
        report_generado: report,
        panel,
        passed:         panel.consensus_score >= 7.0,
      };

    } catch (err: any) {
      console.log(` ❌ ERROR`);
      result = {
        profile_id:     profile.id,
        descripcion:    profile.descripcion,
        plan_esperado:  profile.plan_esperado,
        report_generado: {} as any,
        panel: {
          judge_scores: {} as any,
          consensus_score: 0,
          score_by_dim: {} as any,
          discrepancy: 0,
          needs_review: false,
          merged_fallos: [],
          judge_verdicts: [],
        },
        passed: false,
        error: err.message,
      };
    }

    results.push(result);

    // Pausa entre perfiles para no saturar APIs
    if (i < profilesToRun.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  // ─── Output ──────────────────────────────────────────────────────────────────

  const avgConsensus = totalConsensus / profilesToRun.length;
  const passedCount  = results.filter(r => r.passed).length;

  const jsonOut = {
    meta: {
      fecha: new Date().toISOString(),
      jueces: ACTIVE_JUDGES,
      perfiles_evaluados: profilesToRun.length,
      score_consenso_medio: Math.round(avgConsensus * 10) / 10,
      aprobados: passedCount,
      casos_para_revision: reviewCount,
      fallos_por_origen: failuresByOrigin,
    },
    resultados: results,
  };
  fs.writeFileSync("scripts/eval-report-llm-results.json", JSON.stringify(jsonOut, null, 2));

  // TXT legible
  const L: string[] = [];
  L.push("╔══════════════════════════════════════════════════════════════╗");
  L.push("║     U Scout — LLM Report Evaluator v2 (Multi-Judge)         ║");
  L.push("╚══════════════════════════════════════════════════════════════╝");
  L.push(`  Fecha:   ${new Date().toLocaleString("es-ES")}`);
  L.push(`  Jueces:  ${ACTIVE_JUDGES.join(", ")}`);
  L.push(`  Perfiles: ${profilesToRun.length} | ✓ ${passedCount} aprobados | Score consenso: ${avgConsensus.toFixed(1)}/10`);
  L.push(`  Casos para revisión manual: ${reviewCount} (discrepancia ≥${DISCREPANCY_THRESHOLD})`);
  L.push("");

  if (Object.values(failuresByOrigin).some(v => v > 0)) {
    L.push("  Fallos consensuados por origen (detectados por ≥50% de jueces):");
    if (failuresByOrigin.input    > 0) L.push(`    📋 input    — ${failuresByOrigin.input}`);
    if (failuresByOrigin.motor    > 0) L.push(`    ⚙️  motor    — ${failuresByOrigin.motor}`);
    if (failuresByOrigin.renderer > 0) L.push(`    📝 renderer — ${failuresByOrigin.renderer}`);
    if (failuresByOrigin.concepto > 0) L.push(`    💡 concepto — ${failuresByOrigin.concepto}`);
  }

  L.push("");
  L.push("══════════════════════════════════════════════════════════════");

  // Casos para revisión primero
  const reviewCases = results.filter(r => r.panel.needs_review && !r.error);
  if (reviewCases.length > 0) {
    L.push("  ⚠️  CASOS PARA REVISIÓN MANUAL (alta discrepancia entre jueces)");
    L.push("══════════════════════════════════════════════════════════════");
    for (const r of reviewCases) {
      L.push(`\n  [${r.profile_id}] ${r.descripcion}`);
      L.push(`  Scores por juez: ${Object.entries(r.panel.judge_scores).map(([j,s]) => `${j}=${s}`).join(" | ")}`);
      L.push(`  Discrepancia: ${r.panel.discrepancy} puntos`);
    }
    L.push("");
    L.push("══════════════════════════════════════════════════════════════");
  }

  L.push("  TODOS LOS RESULTADOS");
  L.push("══════════════════════════════════════════════════════════════");

  for (const r of results) {
    const icon = r.error ? "❌" : r.passed ? "✅" : "⚠️ ";
    const bar = `[${"█".repeat(Math.round(r.panel.consensus_score))}${"░".repeat(10 - Math.round(r.panel.consensus_score))}]`;
    L.push(`\n${icon} ${bar} ${r.panel.consensus_score.toFixed(1)}/10 — [${r.profile_id}] ${r.panel.needs_review ? "⚠️ REVISAR" : ""}`);
    L.push(`   ${r.descripcion}`);
    if (r.error) { L.push(`   ERROR: ${r.error}`); continue; }

    L.push(`   Jueces: ${Object.entries(r.panel.judge_scores).map(([j,s]) => `${j}:${s}`).join(" | ")} | Δ${r.panel.discrepancy}`);
    L.push(`   DENY:  ${r.report_generado.deny_texto}`);
    L.push(`   FORCE: ${r.report_generado.force_texto}`);
    L.push(`   ALLOW: ${r.report_generado.allow_texto}`);

    const d = r.panel.score_by_dim;
    L.push(`   Dims: Coh:${d.coherencia_interna} Acc:${d.accionabilidad} Prop:${d.proporcion} Esp:${d.especificidad} Nar:${d.narrativa}`);

    if (r.panel.merged_fallos.length > 0) {
      L.push(`   Fallos consensuados:`);
      for (const f of r.panel.merged_fallos) {
        L.push(`     [${f.origen.toUpperCase()}] ${f.dimension}: ${f.descripcion}`);
        L.push(`       → ${f.sugerencia}`);
      }
    }
  }

  L.push("\n══════════════════════════════════════════════════════════════");
  L.push(`  RESUMEN: ${avgConsensus.toFixed(1)}/10 | ${passedCount}/${profilesToRun.length} aprobados | ${reviewCount} para revisión`);

  // Dimensión más débil (consenso)
  const allDims: (keyof LLMScore)[] = ["coherencia_interna","accionabilidad","proporcion","especificidad","narrativa"];
  const dimAvgs = allDims.map(dim => ({
    dim,
    avg: results.filter(r => !r.error).reduce((a,r) => a + (r.panel.score_by_dim[dim] ?? 0), 0) / Math.max(1, results.filter(r=>!r.error).length)
  }));
  const worst = dimAvgs.sort((a,b) => a.avg - b.avg)[0];
  if (worst) L.push(`  Dimensión más débil: ${worst.dim} (${worst.avg.toFixed(1)}/10)`);
  L.push("══════════════════════════════════════════════════════════════");

  const txt = L.join("\n");
  console.log("\n" + txt);
  fs.writeFileSync("scripts/eval-report-llm-results.txt", txt);
  console.log("\n✅ Resultados en:");
  console.log("   scripts/eval-report-llm-results.json");
  console.log("   scripts/eval-report-llm-results.txt");
}

runEval().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
