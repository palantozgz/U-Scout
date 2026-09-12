#!/usr/bin/env npx tsx
/**
 * Compara motor-v1 (Motor 1.0) contra el motor legacy (motor-v4/motor-v2.1)
 * corriendo ambos caminos sobre los mismos perfiles reales — el patrón que
 * `auditoria-u-scout-completa.md:228` ya proponía como el paso barato antes
 * de dar una consolidación por definitiva (docs/motor-1.0-spec.md, sección
 * 21.5).
 *
 * Solo hay unos pocos perfiles disponibles hoy (scripts/test-profiles.json) — la
 * única jugadora real en la base de producción tiene `inputs: {}` (vacío,
 * verificado por SQL contra Supabase el 2026-09-12), así que no hay datos de
 * producción reales con los que comparar todavía. Este script queda listo
 * para correr contra datos reales en cuanto existan.
 *
 * Qué se compara y por qué:
 * - deny/force/allow: la KEY del ganador debe coincidir entre los dos
 *   motores — motor-v1 reusa la misma lógica de ranking por peso que
 *   motor-v4 (sorted[0] sobre rawOutputs), así que una divergencia aquí es
 *   una regresión real, no una diferencia de diseño esperada.
 *   EXCEPCIÓN CONOCIDA (spec 21.9, 2026-09-12): motor-v4.ts NUNCA aplica el
 *   peso mínimo 0.35 que motor-v2.1.ts sí exige para que un deny "merezca"
 *   mostrarse (mismo patrón que el bug del cap anti-inflación de sección 3
 *   — motor-v4 vuelve a ignorar una regla de curación real de v2.1). Cuando
 *   el ganador de deny de v4 tiene `score < 0.35`, motor-v1 correctamente no
 *   produce ningún deny y v4 sí (con un valor que ni v2.1 consideraría
 *   válido) — se excluye de "divergencias reales" y se reporta aparte.
 * - situaciones (scores): NO deben coincidir, y eso es correcto, no un bug.
 *   motor-v4 normaliza dividiendo por el máximo del perfil (sin cap
 *   anti-inflación, el bug documentado en spec sección 3); motor-v1 usa el
 *   cap real de motor-v2.1.ts. Se reportan aparte, marcadas "esperado".
 * - archetypeKey: tampoco debe coincidir — son dos taxonomías distintas por
 *   diseño (Synergy nueva vs. ad-hoc vieja). Se muestra solo como referencia.
 *
 * Uso: npx tsx scripts/compare-motors.ts
 */
import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { ensamblarReporte } from "../client/src/lib/motor-v1";
import profiles from "./test-profiles.json";

interface Divergencia {
  perfil: string;
  campo: string;
  legacy: string;
  motorV1: string;
}

const divergenciasReales: Divergencia[] = [];
let perfilesOk = 0;
let perfilesConError = 0;

for (const p of profiles as any[]) {
  try {
    const legacy = generateMotorV4(p.inputs, p.clubContext);
    const reporte = ensamblarReporte(p.inputs, p.clubContext, {
      jugadoraId: p.id,
      modo: "completo",
    });
    if (reporte.modo !== "completo") throw new Error("esperaba modo completo");

    // "none" (sentinel de motor-v4) y undefined (motor-v1, campo opcional)
    // representan el MISMO hecho -- ningún winner real -- solo con notación
    // distinta. Se normalizan aquí para que la comparación mida sustancia,
    // no la forma de representar la ausencia.
    const SIN_GANADOR = "(sin ganador)";
    const norm = (k: string | undefined | null) => (!k || k === "none" ? SIN_GANADOR : k);

    const denyLegacy = norm(legacy.defense.deny.winner?.key);
    const denyV1 = norm(reporte.capa2.deny?.ganador.key);
    // Excepción conocida (ver cabecera): motor-v4 nunca aplica el suelo 0.35
    // de motor-v2.1.ts. Si el propio ganador de v4 no llegaría a ese suelo,
    // la divergencia es esperada (motor-v1 correcto, v4 no), no se cuenta.
    const denyLegacyScore = legacy.defense.deny.winner?.score ?? 0;
    const denyBajoElSueloDeV21 = denyLegacyScore > 0 && denyLegacyScore < 0.35;
    if (denyLegacy !== denyV1 && !denyBajoElSueloDeV21) {
      divergenciasReales.push({ perfil: p.name, campo: "deny.winner", legacy: denyLegacy, motorV1: denyV1 });
    } else if (denyLegacy !== denyV1 && denyBajoElSueloDeV21) {
      console.log(
        `  (excepción conocida, spec 21.9) [${p.name}] deny.winner: v4="${denyLegacy}" (score ${denyLegacyScore.toFixed(3)}, bajo el suelo 0.35 de v2.1) vs motor-v1="${denyV1}"`,
      );
    }

    const forceLegacy = norm(legacy.defense.force.winner?.key);
    const forceV1 = norm(reporte.capa2.force?.ganador.key);
    if (forceLegacy !== forceV1) {
      divergenciasReales.push({ perfil: p.name, campo: "force.winner", legacy: forceLegacy, motorV1: forceV1 });
    }

    const allowLegacy = norm(legacy.defense.allow.winner?.key);
    const allowV1 = norm(reporte.capa2.allow?.ganador.key);
    if (allowLegacy !== allowV1) {
      divergenciasReales.push({ perfil: p.name, campo: "allow.winner", legacy: allowLegacy, motorV1: allowV1 });
    }

    perfilesOk++;
    console.log(
      `· [${p.id}] ${p.name} — deny:${denyV1 === denyLegacy ? "OK" : "DIFIERE"} ` +
        `force:${forceV1 === forceLegacy ? "OK" : "DIFIERE"} allow:${allowV1 === allowLegacy ? "OK" : "DIFIERE"} ` +
        `| archetype legacy=${legacy.identity.archetypeKey} v1=${reporte.identidad.archetypeKey} (esperado: distintos)`,
    );
  } catch (e: any) {
    perfilesConError++;
    console.log(`💥 [${p.id}] ${p.name}: ERROR — ${e.message}`);
  }
}

console.log(`\n${perfilesOk} perfiles procesados sin error, ${perfilesConError} con error.\n`);

if (divergenciasReales.length === 0) {
  console.log(`✓ Sin divergencias reales: deny/force/allow.winner coinciden 100% entre motor-v1 y el legacy en los ${perfilesOk} perfiles.`);
} else {
  console.log(`✗ ${divergenciasReales.length} divergencia(s) real(es) (deny/force/allow.winner) — revisar antes de migrar un consumidor:`);
  for (const d of divergenciasReales) {
    console.log(`  [${d.perfil}] ${d.campo}: legacy="${d.legacy}" vs motor-v1="${d.motorV1}"`);
  }
}
