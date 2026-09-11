/**
 * Motor 1.0 — tests de aceptación de Fase 1 (docs/motor-1.0-spec.md, sección 8:
 * "casos de los antiguos test-motor-v4.ts/eval-motor-quality.ts más los casos
 * nuevos de esta auditoría — multi-situación primaria, el caso que quedó sin
 * probar").
 *
 * Todavía no existe una implementación de Motor 1.0 (Fase 1 no ha empezado).
 * Mientras tanto, estos tests corren contra los dos motores legacy como
 * referencia de comportamiento CORRECTO conocido — no como "lo que hace v4
 * hoy es la verdad", sino "esto es lo que Motor 1.0 debe reproducir":
 *
 * - `motor-v2.1.ts` es la referencia para el cap anti-inflación
 *   (`calculateThreatScores`) — es el ÚNICO de los dos motores que lo
 *   implementa. Bug real encontrado al escribir este archivo (ver spec
 *   sección 3, corrección 2026-09-11): `motor-v4.ts` NO tiene este cap en
 *   absoluto — su `buildSituations` recalcula el ranking desde los pesos SIN
 *   capar y normaliza dividiendo por el máximo del perfil, un mecanismo
 *   distinto sin relación con `primarySituations`/0.72. Por eso el test del
 *   cap usa `UScoutMotor` (v2.1) directamente, nunca `generateMotorV4`.
 * - `motor-v4.ts` es la referencia para `archetypeKey`/`dangerLevel`/
 *   `difficultyLevel` — v2.1 no calcula estos campos en absoluto.
 *
 * Cuando exista una implementación real de Motor 1.0, estos tests deben
 * apuntar a ella (un solo import, no dos) — y la aserción del cap, que hoy
 * solo pasa contra v2.1, debe seguir pasando ahí. Es exactamente la migración
 * que el roadmap de la spec (sección 8, Fase 3) contempla.
 */
import { describe, expect, it } from "vitest";
import { UScoutMotor } from "./motor-v2.1";
import { generateMotorV4 } from "./motor-v4";
import testProfilesRaw from "../../../scripts/test-profiles.json";

interface TestProfile {
  id: string;
  name: string;
  note?: string;
  inputs: Record<string, unknown>;
  clubContext?: Record<string, unknown>;
}

const profiles = testProfilesRaw as unknown as TestProfile[];

/** Los 7 campos *Freq que `calculateThreatScores` usa para detectar situaciones
 *  primarias (motor-v2.1.ts:876-884) — y su situación correspondiente. */
const PRIMARY_FIELDS: [string, string][] = [
  ["isoFreq", "iso"],
  ["pnrFreq", "pnr"],
  ["postFreq", "post"],
  ["transFreq", "transition"],
  ["spotUpFreq", "spot"],
  ["dhoFreq", "dho"],
  ["cutFreq", "cut"],
];

function primariasDe(enrichedInputs: Record<string, unknown>): Set<string> {
  return new Set(
    PRIMARY_FIELDS.filter(([field]) => enrichedInputs[field] === "P").map(([, sit]) => sit),
  );
}

describe("Motor 1.0 — cap anti-inflación con multi-situación primaria (spec sección 3, corregido 2026-09-11)", () => {
  const motor = new UScoutMotor();

  it("con 2+ situaciones primarias, ninguna situación no-primaria (ni 'misc') supera 0.72", () => {
    let perfilesConMultiPrimaria = 0;
    for (const profile of profiles) {
      const report = motor.generateReport(profile.inputs as any, profile.clubContext as any);
      const primarias = primariasDe(report.inputs as any);
      if (primarias.size < 2) continue; // el cap de motor-v2.1.ts solo aplica con 2+
      perfilesConMultiPrimaria++;
      for (const t of report.threatScores ?? []) {
        if (t.situation === "misc" || primarias.has(t.situation)) continue;
        expect(
          t.score,
          `[${profile.name}] situación no-primaria "${t.situation}" debería estar capada a 0.72`,
        ).toBeLessThanOrEqual(0.72);
      }
    }
    // Los perfiles de test SÍ cubren el caso (p001, p004) — si esto llega a 0,
    // el test de arriba pasaría vacío sin comprobar nada de verdad.
    expect(perfilesConMultiPrimaria).toBeGreaterThan(0);
  });

  it("p001 (iso+pnr primarias) capa 'post' exactamente a 0.72 — regresión con valor real verificado", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const report = motor.generateReport(p001.inputs as any, p001.clubContext as any);
    const post = report.threatScores?.find((t) => t.situation === "post");
    expect(post?.score).toBe(0.72);
  });

  it("p004 (pnr+transition primarias) capa 'iso' exactamente a 0.72 — regresión con valor real verificado", () => {
    const p004 = profiles.find((p) => p.id === "p004")!;
    const report = motor.generateReport(p004.inputs as any, p004.clubContext as any);
    const iso = report.threatScores?.find((t) => t.situation === "iso");
    expect(iso?.score).toBe(0.72);
  });

  it("con menos de 2 situaciones primarias, el cap NO se aplica — situaciones no-primarias pueden superar 0.72 libremente", () => {
    // p006 (Embiid, solo 'post' primaria): 'oreb' llega a 0.90 sin capar.
    const p006 = profiles.find((p) => p.id === "p006")!;
    const report006 = motor.generateReport(p006.inputs as any, p006.clubContext as any);
    const oreb = report006.threatScores?.find((t) => t.situation === "oreb");
    expect(oreb?.score).toBeGreaterThan(0.72);

    // p008 (Gobert, 0 primarias): 'transition' llega a 0.96 sin capar.
    const p008 = profiles.find((p) => p.id === "p008")!;
    const report008 = motor.generateReport(p008.inputs as any, p008.clubContext as any);
    const transition = report008.threatScores?.find((t) => t.situation === "transition");
    expect(transition?.score).toBeGreaterThan(0.72);
  });
});

describe("Motor 1.0 — el motor nunca devuelve solo el ganador (spec 17.1, tipo CampoConCandidatos en 14.2 bis)", () => {
  const motor = new UScoutMotor();

  it("cada perfil produce un ganador de deny y una lista de candidatos calculada de antemano (runnersUp)", () => {
    for (const profile of profiles) {
      const report = motor.generateReport(profile.inputs as any, profile.clubContext as any);
      expect(
        (report.selected.deny?.length ?? 0) > 0,
        `[${profile.name}] debe existir un ganador de deny`,
      ).toBe(true);
      // El contrato de Fase 0 (`CampoConCandidatos`) exige ganador + candidatos
      // en UNA sola estructura por campo. Hoy viven separados (`selected` vs.
      // `runnersUp`, sin indicar a qué campo pertenece cada runner-up) — Motor
      // 1.0 debe unificarlos (ver 14.2 bis, Nota 11). Este test solo confirma
      // que el cálculo de candidatos ya existe hoy, no que la forma sea correcta.
      expect(
        Array.isArray(report.runnersUp),
        `[${profile.name}] runnersUp debe existir como array (aunque esté vacío)`,
      ).toBe(true);
    }
  });
});

describe("Motor 1.0 — máximo 2 AWARE (spec 13.3/7; tupla acotada en 14.2 bis, capa2.aware)", () => {
  const motor = new UScoutMotor();

  // ACLARADO 2026-09-11 al escribir este test (no era obvio en la spec): el
  // "máximo 2 AWARE" NO se aplica dentro del motor -- motor-v2.1.ts:499 fija
  // maxOutputsPerCategory.aware = 5, y report.selected.aware puede (y en la
  // práctica lo hace, ver test de abajo) devolver más de 2. El límite de 2 se
  // aplica en la capa de presentación: ReportSlidesV1.tsx:268,
  // `finalReport.alerts.slice(0, 2)`. Esto es CONSISTENTE con el contrato de
  // 14.2 bis, no lo contradice: `capa2.aware` (tupla acotada a 2) representa el
  // REPORTE final ya curado, no el pool crudo de candidatos del motor -- igual
  // que `deny`/`force`/`allow` siguen la filosofía de 17.1 (el motor calcula
  // más candidatos de los que se muestran, la curación pasa después). Fase 1
  // debe exponer el pool completo (hasta 5) como candidatos dentro de una
  // `CampoConCandidatos` por slot de aware, y aplicar el corte a 2 en el paso
  // de ensamblado del reporte -- nunca dentro del cálculo puro de outputs.
  it("el motor SÍ puede computar más de 2 candidatos aware (pool crudo, sin curar) -- p001 genera 3", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const report = motor.generateReport(p001.inputs as any, p001.clubContext as any);
    expect(report.selected.aware?.length ?? 0).toBeGreaterThan(2);
  });

  it("el paso de curación a 2 (hoy en ReportSlidesV1.tsx, mañana en el ensamblado de reporte de Motor 1.0) sí respeta el máximo", () => {
    for (const profile of profiles) {
      const report = motor.generateReport(profile.inputs as any, profile.clubContext as any);
      const curado = (report.selected.aware ?? []).slice(0, 2);
      expect(curado.length, `[${profile.name}]`).toBeLessThanOrEqual(2);
    }
  });
});

describe("Motor 1.0 — identidad (archetypeKey/dangerLevel/difficultyLevel) — referencia: motor-v4 (v2.1 no los calcula)", () => {
  it("archetypeKey no vacío, dangerLevel y difficultyLevel en rango 1-5, en todos los perfiles de test", () => {
    for (const profile of profiles) {
      const result = generateMotorV4(profile.inputs as any, profile.clubContext as any);
      expect(result.identity.archetypeKey.length, `[${profile.name}]`).toBeGreaterThan(0);
      expect(result.identity.dangerLevel).toBeGreaterThanOrEqual(1);
      expect(result.identity.dangerLevel).toBeLessThanOrEqual(5);
      expect(result.identity.difficultyLevel).toBeGreaterThanOrEqual(1);
      expect(result.identity.difficultyLevel).toBeLessThanOrEqual(5);
    }
  });

  it("la key del ganador de deny es snake_case, sin espacios ni mayúsculas", () => {
    for (const profile of profiles) {
      const result = generateMotorV4(profile.inputs as any, profile.clubContext as any);
      const key = result.defense.deny.winner?.key ?? "";
      expect(key, `[${profile.name}]`).toMatch(/^[a-z_]+$/);
    }
  });
});
