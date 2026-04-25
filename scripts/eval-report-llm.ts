/**
 * U Scout — LLM Report Quality Evaluator
 *
 * Evalúa la calidad profesional de los informes defensivos usando Claude como juez experto.
 * Complementa calibrate-motor.ts (lógica) y eval-motor-quality.ts (checks hardcodeados).
 *
 * Este script evalúa el PRODUCTO FINAL — el informe completo como lo vería un entrenador.
 * Detecta problemas que los checks deterministas no pueden detectar:
 *   - Contradicciones lógicas entre DENY/FORCE/ALLOW
 *   - Instrucciones no ejecutables individualmente (requieren ayuda del equipo)
 *   - Texto genérico que no aporta info específica del jugador
 *   - Desproporción entre el perfil y el nivel de alerta del informe
 *
 * Uso:
 *   npx tsx scripts/eval-report-llm.ts
 *   npx tsx scripts/eval-report-llm.ts --profile q001   (solo un perfil)
 *   npx tsx scripts/eval-report-llm.ts --fast           (5 perfiles base, sin variaciones)
 *
 * Output:
 *   scripts/eval-report-llm-results.json   (datos completos)
 *   scripts/eval-report-llm-results.txt    (informe legible)
 *
 * Requiere: ANTHROPIC_API_KEY en .env
 */

import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

// Cargar .env manualmente (no usamos dotenv para no añadir dependencias)
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY no encontrada en .env");
  console.error("   Añade: ANTHROPIC_API_KEY=sk-ant-... en el archivo .env del repo");
  process.exit(1);
}

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const FAST_MODE = process.argv.includes("--fast");
const SINGLE_PROFILE = (() => {
  const idx = process.argv.indexOf("--profile");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LLMScore {
  coherencia_interna: number;      // 0-10: ¿DENY/FORCE/ALLOW se contradicen?
  accionabilidad: number;          // 0-10: ¿ejecutable por UN jugador sin ayuda?
  proporcion: number;              // 0-10: ¿nivel de alerta proporcional al perfil?
  especificidad: number;           // 0-10: ¿específico del jugador o genérico?
  narrativa: number;               // 0-10: ¿los 3 slides cuentan historia coherente?
}

interface LLMFallo {
  dimension: keyof LLMScore;
  origen: "input" | "motor" | "renderer" | "concepto";
  descripcion: string;
  sugerencia: string;
}

interface LLMVeredicto {
  scores: LLMScore;
  score_global: number;
  fallos: LLMFallo[];
  resumen: string;
}

interface EvalProfile {
  id: string;
  descripcion: string;
  plan_esperado: string;
  inputs: any;
  clubContext?: any;
}

interface ProfileResult {
  profile_id: string;
  descripcion: string;
  plan_esperado: string;
  report_generado: {
    archetype: string;
    tagline: string;
    danger: string;
    situaciones: string[];
    deny_texto: string;
    force_texto: string;
    allow_texto: string;
    alerts: string[];
  };
  veredicto: LLMVeredicto;
  score_global: number;
  passed: boolean;
  error?: string;
}

// ─── Perfiles de evaluación ───────────────────────────────────────────────────
// Estos perfiles son distintos a los de calibrate-motor.ts y eval-motor-quality.ts
// Su propósito es cubrir arquetipos y situaciones edge que estresan la calidad del report

const BASE_PROFILES: EvalProfile[] = [
  {
    id: "llm001",
    descripcion: "Escolta anotadora ISO primaria, zurda, penetradora, sin tiro exterior",
    plan_esperado: "DENY: espacio ISO lado derecho. FORCE: mano débil (derecha), hacia la derecha. ALLOW: spot-up threes o poste. Sin contradicciones de dirección.",
    inputs: {
      pos: "SG", hand: "L", ath: 5, phys: 3, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "high", isoDir: "L",
      isoFinishLeft: "rim", isoFinishRight: "pull_up",
      contactFinish: "seeks",
      pnrFreq: "S", pnrFinish: "Drive",
      spotUpFreq: "R", deepRange: false,
      postFreq: "N", transFreq: "S",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      floater: "S", orebThreat: "low",
      vision: 3, ballHandling: "elite",
      pressureResponse: "escapes",
      screenerAction: null,
    },
  },
  {
    id: "llm002",
    descripcion: "Pivot postero dominante ambidextro, físico alto, sin exterior",
    plan_esperado: "DENY: entrada al poste. Sin FORCE de dirección claro (ambidiestro). ALLOW: spot-up threes. AWARE: rebote ofensivo.",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 5, usage: "primary",
      selfCreation: "low",
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "drop_step", "up_and_under"],
      postEntry: "seal",
      isoFinishLeft: "rim", isoFinishRight: "rim",
      isoFreq: "N", pnrFreq: "N", transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
  },
  {
    id: "llm003",
    descripcion: "Base PnR handler con tiro de tres, passer de élite, rol primario",
    plan_esperado: "DENY: espacio PnR. FORCE: contener, no dejar ir downhill. ALLOW: poste. AWARE: passer de élite — no doblar.",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrFinish: "Drive", pnrSnake: false,
      isoFreq: "S", isoDir: "R", isoEff: "medium",
      isoFinishLeft: "pull_up", isoFinishRight: "rim",
      spotUpFreq: "S", deepRange: true,
      postFreq: "N", transFreq: "S",
      floater: "S", orebThreat: "low",
      vision: 5, ballHandling: "elite",
      pressureResponse: "escapes",
      screenerAction: "pop",
      contactFinish: "capable", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
    },
  },
  {
    id: "llm004",
    descripcion: "Alero rol: spot-up shooter especialista, sin creación propia",
    plan_esperado: "DENY: recepciones en sus zonas de triple. FORCE: ninguno relevante. ALLOW: ISO o bote. El informe no debe sobrealarmar — es un jugador de rol.",
    inputs: {
      pos: "SF", hand: "R", ath: 3, phys: 3, usage: "role",
      selfCreation: "low",
      spotUpFreq: "P", spotUpEff: "high", deepRange: false,
      spotZones: { cornerLeft: true, cornerRight: true, wing45Left: false, wing45Right: false, top: false },
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "R", cutFreq: "S", dhoFreq: "N",
      indirectFreq: "S",
      floater: "N", orebThreat: "low",
      vision: 2, ballHandling: "limited",
      pressureResponse: "struggles",
      screenerAction: null,
      contactFinish: "avoids", offHandFinish: "weak",
    },
  },
  {
    id: "llm005",
    descripcion: "Ala-pivot transición primaria, cortes frecuentes, sin tiro exterior",
    plan_esperado: "DENY: sprint en transición y cortes. FORCE: fuera de canasta, hacia perímetro. ALLOW: spot-up threes. Informe con foco en movimiento sin balón.",
    inputs: {
      pos: "PF", hand: "R", ath: 5, phys: 4, usage: "secondary",
      selfCreation: "medium",
      transFreq: "P", transRole: "rim_run",
      cutFreq: "P", cutTypes: ["basket", "backdoor"],
      isoFreq: "R", pnrFreq: "S",
      pnrFinish: "Drive",
      spotUpFreq: "N", deepRange: false,
      postFreq: "S", postShoulder: "R", postMoves: ["drop_step"],
      postEntry: "flash",
      floater: "N", orebThreat: "medium",
      vision: 3, ballHandling: "limited",
      pressureResponse: "struggles",
      screenerAction: "roll",
      contactFinish: "seeks", offHandFinish: "capable",
      dhoFreq: "N", indirectFreq: "N",
    },
  },
  {
    id: "llm006",
    descripcion: "Jugador ambiguo: inputs mínimos, perfil incompleto — test de robustez del motor",
    plan_esperado: "El informe debe ser conservador, sin instrucciones contradictorias. Mejor menos información que información errónea.",
    inputs: {
      pos: "SF", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "medium",
      isoFreq: "S", isoEff: "medium",
      isoFinishLeft: "pull_up", isoFinishRight: "pull_up",
      pnrFreq: "R", spotUpFreq: "R",
      postFreq: "N", transFreq: "R",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      floater: "N", orebThreat: "low",
      vision: 3, ballHandling: "capable",
      pressureResponse: null, screenerAction: null,
      contactFinish: "capable", offHandFinish: "capable",
      deepRange: false,
    },
  },
  {
    id: "llm007",
    descripcion: "Base presionadora full court, baja eficiencia ISO, presión la desactiva",
    plan_esperado: "FORCE: presión individual. DENY: avance sin contacto. El informe debe mencionar que la presión es la herramienta clave. Sin instrucciones colectivas.",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "secondary",
      selfCreation: "medium",
      isoFreq: "S", isoEff: "low", isoDir: "R",
      isoFinishLeft: "pull_up", isoFinishRight: "pull_up",
      pnrFreq: "S", pnrFinish: "Pull-up",
      spotUpFreq: "R", deepRange: false,
      postFreq: "N", transFreq: "S",
      floater: "S", orebThreat: "low",
      vision: 2, ballHandling: "capable",
      pressureResponse: "struggles",
      screenerAction: null,
      contactFinish: "avoids", offHandFinish: "weak",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
    },
  },
  {
    id: "llm008",
    descripcion: "Tiradora de spot-up de élite, deepRange, sin creación propia",
    plan_esperado: "DENY: recepciones profundas. El cierre debe ser largo y anticipado. ALLOW: ISO. Sin instrucciones de FORCE de dirección (no tiene ISO relevante).",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "secondary",
      selfCreation: "low",
      spotUpFreq: "P", spotUpEff: "high", deepRange: true,
      spotZones: { cornerLeft: false, cornerRight: false, wing45Left: true, wing45Right: true, top: true },
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "R", cutFreq: "R",
      indirectFreq: "P",
      floater: "N", orebThreat: "low",
      vision: 2, ballHandling: "limited",
      pressureResponse: "struggles",
      screenerAction: null,
      contactFinish: "avoids", offHandFinish: "weak",
      dhoFreq: "N",
    },
  },
  {
    id: "llm009",
    descripcion: "Pivot screener, sin amenaza ofensiva propia — test de ALLOW / bajo peligro",
    plan_esperado: "Informe que reconoce bajo peligro ofensivo. ALLOW puede ser amplio. No debe sobrealarmar. El informe no debe parecer diseñado para Giannis si el jugador es un screener puro.",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 4, usage: "role",
      selfCreation: "low",
      isoFreq: "N", pnrFreq: "N", postFreq: "R",
      spotUpFreq: "N", deepRange: false,
      transFreq: "R", cutFreq: "R",
      indirectFreq: "N", dhoFreq: "N",
      floater: "N", orebThreat: "medium",
      vision: 2, ballHandling: null,
      pressureResponse: null, screenerAction: "roll",
      contactFinish: "capable", offHandFinish: "weak",
    },
  },
  {
    id: "llm010",
    descripcion: "Jugadora WNBA completa: ISO + PnR + spot-up + transición, ath 5, passer élite",
    plan_esperado: "Informe completo y proporcionado. DENY principal. FORCE con dirección clara. AWARE: passer. El mayor reto es priorizar bien — no todo puede ser igual de urgente.",
    inputs: {
      pos: "SG", hand: "R", ath: 5, phys: 4, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "high", isoDir: "R",
      isoFinishLeft: "eurostep", isoFinishRight: "rim",
      pnrFreq: "S", pnrFinish: "Drive", pnrSnake: true,
      spotUpFreq: "S", deepRange: true,
      transFreq: "S", transRole: "leak",
      postFreq: "N",
      cutFreq: "R", dhoFreq: "N", indirectFreq: "R",
      floater: "S", orebThreat: "low",
      vision: 5, ballHandling: "elite",
      pressureResponse: "escapes",
      screenerAction: null,
      contactFinish: "seeks", offHandFinish: "capable",
    },
  },
];

// ─── Llamada a Claude API ──────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

// ─── Prompt del evaluador experto ─────────────────────────────────────────────

function buildEvalPrompt(profile: EvalProfile, reportRendered: any): string {
  const reportText = `
PERFIL DEL JUGADOR:
- Posición: ${profile.inputs.pos}, Mano dominante: ${profile.inputs.hand}
- Atletismo: ${profile.inputs.ath}/5, Físico: ${profile.inputs.phys}/5
- Rol ofensivo: ${profile.inputs.usage}, Auto-creación: ${profile.inputs.selfCreation}
- Situación primaria: ${profile.inputs.isoFreq === "P" ? "ISO" : profile.inputs.pnrFreq === "P" ? "PnR" : profile.inputs.postFreq === "P" ? "Post" : profile.inputs.spotUpFreq === "P" ? "Spot-up" : profile.inputs.transFreq === "P" ? "Transición" : "múltiple/rol"}
- Descripción: ${profile.descripcion}

INFORME DEFENSIVO GENERADO:
- Arquetipo: ${reportRendered.archetype}
- Tagline: ${reportRendered.tagline}
- Nivel de amenaza: ${reportRendered.danger}
- Top situaciones ofensivas: ${reportRendered.situaciones.join(" | ")}
- DENY (instrucción principal): ${reportRendered.deny_texto}
- FORCE (cómo forzarlo): ${reportRendered.force_texto}
- ALLOW (qué conceder): ${reportRendered.allow_texto}
- AWARE (alertas): ${reportRendered.alerts.join(" | ") || "ninguna"}

PLAN ESPERADO POR EL DISEÑADOR:
${profile.plan_esperado}
`.trim();

  return `Eres un scout de baloncesto profesional con 15 años de experiencia en la NBA, WNBA y ACB. 
Tu trabajo es evaluar si este informe defensivo individual es profesional, lógico y útil para el jugador que lo va a leer en su móvil antes del partido.

${reportText}

Evalúa el informe en estas 5 dimensiones (0-10 cada una):

1. coherencia_interna: ¿DENY/FORCE/ALLOW se contradicen entre sí? (10 = sin contradicciones, 0 = se contradicen directamente)
2. accionabilidad: ¿puede UN jugador ejecutar estas instrucciones solo, sin ayuda del equipo? (10 = todo ejecutable 1-on-1, 0 = requiere sistema colectivo)
3. proporcion: ¿el nivel de alerta es proporcional al perfil real del jugador? (10 = perfectamente calibrado, 0 = overalarma un jugador de rol o infraalarma un primario)
4. especificidad: ¿el informe es específico de ESTE jugador o podría valer para cualquiera con esta posición? (10 = muy específico, 0 = completamente genérico)
5. narrativa: ¿los 3 slides (quién es / qué hará / qué hago) cuentan una historia coherente y progresiva? (10 = flujo perfecto, 0 = no hay hilo conductor)

Para cada dimensión con score MENOR que 7, indica:
- origen del problema: "input" (los datos del perfil son inconsistentes), "motor" (la lógica de outputs es incorrecta), "renderer" (el texto es genérico o confuso), o "concepto" (el diseño del informe no funciona para este caso)
- descripcion: qué está mal exactamente, en una frase concisa
- sugerencia: cómo debería verse el informe correcto

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON:

{
  "scores": {
    "coherencia_interna": <número>,
    "accionabilidad": <número>,
    "proporcion": <número>,
    "especificidad": <número>,
    "narrativa": <número>
  },
  "score_global": <promedio de los 5, redondeado a 1 decimal>,
  "fallos": [
    {
      "dimension": "<nombre_dimension>",
      "origen": "<input|motor|renderer|concepto>",
      "descripcion": "<qué está mal>",
      "sugerencia": "<cómo debería verse>"
    }
  ],
  "resumen": "<1-2 frases sobre la calidad global del informe>"
}`;
}

// ─── Renderizar un perfil a texto ─────────────────────────────────────────────

function renderProfileToText(profile: EvalProfile): any {
  const clubContext = profile.clubContext ?? {
    clubId: "eval", gender: "f", locale: "en",
  };

  const motorOutput = generateMotorV4(profile.inputs, clubContext);
  const rendered = renderReport(motorOutput, { locale: "en", clubGender: clubContext.gender });

  return {
    archetype: rendered.identity?.archetype ?? "Unknown",
    tagline: rendered.identity?.tagline ?? "",
    danger: rendered.identity?.dangerLevel ?? "",
    situaciones: (rendered.situations ?? []).slice(0, 3).map((s: any) => s.label ?? s.key ?? ""),
    deny_texto: rendered.defense?.deny?.text ?? "",
    force_texto: rendered.defense?.force?.text ?? "",
    allow_texto: rendered.defense?.allow?.text ?? "",
    alerts: (rendered.alerts ?? []).map((a: any) => a.text ?? a.key ?? ""),
  };
}

// ─── Parsear respuesta del LLM ────────────────────────────────────────────────

function parseLLMResponse(raw: string): LLMVeredicto | null {
  try {
    // Limpiar posibles ```json ... ``` wrappers
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validar estructura mínima
    if (!parsed.scores || typeof parsed.score_global !== "number") return null;

    return {
      scores: parsed.scores,
      score_global: parsed.score_global,
      fallos: parsed.fallos ?? [],
      resumen: parsed.resumen ?? "",
    };
  } catch {
    return null;
  }
}

// ─── Ejecución principal ──────────────────────────────────────────────────────

async function runEval() {
  const profilesToRun = SINGLE_PROFILE
    ? BASE_PROFILES.filter(p => p.id === SINGLE_PROFILE)
    : FAST_MODE
    ? BASE_PROFILES.slice(0, 5)
    : BASE_PROFILES;

  if (profilesToRun.length === 0) {
    console.error(`❌ Perfil "${SINGLE_PROFILE}" no encontrado.`);
    console.error(`   IDs disponibles: ${BASE_PROFILES.map(p => p.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🏀 U Scout — LLM Report Evaluator`);
  console.log(`   Modelo: ${CLAUDE_MODEL}`);
  console.log(`   Perfiles: ${profilesToRun.length}${FAST_MODE ? " (modo rápido)" : ""}`);
  console.log(`   Iniciando...\n`);

  const results: ProfileResult[] = [];
  let totalScore = 0;
  let failuresByOrigin: Record<string, number> = { input: 0, motor: 0, renderer: 0, concepto: 0 };

  for (let i = 0; i < profilesToRun.length; i++) {
    const profile = profilesToRun[i];
    process.stdout.write(`  [${i + 1}/${profilesToRun.length}] ${profile.id} — ${profile.descripcion.slice(0, 50)}...`);

    let result: ProfileResult;

    try {
      // 1. Generar informe
      const reportRendered = renderProfileToText(profile);

      // 2. Evaluar con LLM
      const prompt = buildEvalPrompt(profile, reportRendered);
      const rawResponse = await callClaude(prompt);
      const veredicto = parseLLMResponse(rawResponse);

      if (!veredicto) {
        throw new Error(`Respuesta LLM no parseable: ${rawResponse.slice(0, 200)}`);
      }

      // 3. Contabilizar fallos por origen
      for (const fallo of veredicto.fallos) {
        failuresByOrigin[fallo.origen] = (failuresByOrigin[fallo.origen] ?? 0) + 1;
      }

      totalScore += veredicto.score_global;
      const passed = veredicto.score_global >= 7.0;

      result = {
        profile_id: profile.id,
        descripcion: profile.descripcion,
        plan_esperado: profile.plan_esperado,
        report_generado: reportRendered,
        veredicto,
        score_global: veredicto.score_global,
        passed,
      };

      const icon = passed ? "✅" : "⚠️ ";
      console.log(` ${icon} ${veredicto.score_global.toFixed(1)}/10`);

    } catch (err: any) {
      console.log(` ❌ ERROR`);
      result = {
        profile_id: profile.id,
        descripcion: profile.descripcion,
        plan_esperado: profile.plan_esperado,
        report_generado: {} as any,
        veredicto: { scores: {} as any, score_global: 0, fallos: [], resumen: "" },
        score_global: 0,
        passed: false,
        error: err.message,
      };
    }

    results.push(result);

    // Pequeña pausa para no saturar la API
    if (i < profilesToRun.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ─── Generar informe ──────────────────────────────────────────────────────

  const avgScore = totalScore / profilesToRun.length;
  const passedCount = results.filter(r => r.passed).length;
  const totalFailures = Object.values(failuresByOrigin).reduce((a, b) => a + b, 0);

  // JSON completo
  const jsonOutput = {
    meta: {
      fecha: new Date().toISOString(),
      modelo: CLAUDE_MODEL,
      perfiles_evaluados: profilesToRun.length,
      score_medio: Math.round(avgScore * 10) / 10,
      aprobados: passedCount,
      fallos_por_origen: failuresByOrigin,
    },
    resultados: results,
  };
  fs.writeFileSync(
    "scripts/eval-report-llm-results.json",
    JSON.stringify(jsonOutput, null, 2),
  );

  // TXT legible
  const lines: string[] = [];
  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║        U Scout — LLM Report Quality Evaluator               ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push(`  Fecha: ${new Date().toLocaleString("es-ES")}`);
  lines.push(`  Modelo evaluador: ${CLAUDE_MODEL}`);
  lines.push(`  Perfiles: ${profilesToRun.length} | ✓ ${passedCount} aprobados (≥7.0) | Score medio: ${avgScore.toFixed(1)}/10`);
  lines.push("");

  if (totalFailures > 0) {
    lines.push("  Fallos por origen:");
    if (failuresByOrigin.input > 0) lines.push(`    📋 input    — ${failuresByOrigin.input} (datos del perfil inconsistentes)`);
    if (failuresByOrigin.motor > 0) lines.push(`    ⚙️  motor    — ${failuresByOrigin.motor} (lógica de outputs incorrecta)`);
    if (failuresByOrigin.renderer > 0) lines.push(`    📝 renderer — ${failuresByOrigin.renderer} (texto genérico o confuso)`);
    if (failuresByOrigin.concepto > 0) lines.push(`    💡 concepto — ${failuresByOrigin.concepto} (diseño del informe no funciona)`);
  } else {
    lines.push("  Sin fallos detectados ✅");
  }

  lines.push("");
  lines.push("══════════════════════════════════════════════════════════════");
  lines.push("  RESULTADOS POR PERFIL");
  lines.push("══════════════════════════════════════════════════════════════");

  for (const r of results) {
    const icon = r.error ? "❌" : r.passed ? "✅" : "⚠️ ";
    const scoreBar = r.score_global > 0
      ? `[${"█".repeat(Math.round(r.score_global))}${"░".repeat(10 - Math.round(r.score_global))}]`
      : "[░░░░░░░░░░]";

    lines.push(`\n${icon} ${scoreBar} ${r.score_global.toFixed(1)}/10 — [${r.profile_id}]`);
    lines.push(`   ${r.descripcion}`);

    if (r.error) {
      lines.push(`   ERROR: ${r.error}`);
      continue;
    }

    lines.push(`   Arquetipo: ${r.report_generado.archetype} | Amenaza: ${r.report_generado.danger}`);
    lines.push(`   Situaciones: ${r.report_generado.situaciones.join(" → ")}`);
    lines.push(`   DENY:  ${r.report_generado.deny_texto}`);
    lines.push(`   FORCE: ${r.report_generado.force_texto}`);
    lines.push(`   ALLOW: ${r.report_generado.allow_texto}`);
    if (r.report_generado.alerts.length > 0) {
      lines.push(`   AWARE: ${r.report_generado.alerts.join(" | ")}`);
    }
    lines.push("");
    lines.push(`   Scores LLM:`);
    const s = r.veredicto.scores;
    lines.push(`     Coherencia: ${s.coherencia_interna}/10 | Accionabilidad: ${s.accionabilidad}/10 | Proporción: ${s.proporcion}/10`);
    lines.push(`     Especificidad: ${s.especificidad}/10 | Narrativa: ${s.narrativa}/10`);
    lines.push(`   Resumen: ${r.veredicto.resumen}`);

    if (r.veredicto.fallos.length > 0) {
      lines.push(`   Fallos detectados:`);
      for (const f of r.veredicto.fallos) {
        lines.push(`     [${f.origen.toUpperCase()}] ${f.dimension}: ${f.descripcion}`);
        lines.push(`       → ${f.sugerencia}`);
      }
    }
  }

  lines.push("\n══════════════════════════════════════════════════════════════");
  lines.push(`  RESUMEN FINAL: ${avgScore.toFixed(1)}/10 | ${passedCount}/${profilesToRun.length} aprobados`);

  const worstDimension = (() => {
    const dimTotals: Record<string, number[]> = {};
    for (const r of results) {
      if (!r.veredicto.scores) continue;
      for (const [k, v] of Object.entries(r.veredicto.scores)) {
        if (!dimTotals[k]) dimTotals[k] = [];
        dimTotals[k].push(v as number);
      }
    }
    let worst = { dim: "", avg: 10 };
    for (const [dim, vals] of Object.entries(dimTotals)) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg < worst.avg) worst = { dim, avg };
    }
    return worst;
  })();

  if (worstDimension.dim) {
    lines.push(`  Dimensión más débil: ${worstDimension.dim} (${worstDimension.avg.toFixed(1)}/10)`);
  }

  lines.push("══════════════════════════════════════════════════════════════");

  const txtOutput = lines.join("\n");
  console.log("\n" + txtOutput);
  fs.writeFileSync("scripts/eval-report-llm-results.txt", txtOutput);
  console.log("\n✅ Resultados guardados en:");
  console.log("   scripts/eval-report-llm-results.json");
  console.log("   scripts/eval-report-llm-results.txt");
}

runEval().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
