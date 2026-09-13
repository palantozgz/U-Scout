/**
 * Regresión de `computeCloseoutThreatV1` (spec 23.2/23.4, PR-B) contra
 * `computeCloseoutThreat` (legacy, motor-v4) -- mismo espíritu que
 * `scripts/compare-motors.ts`: correr los mismos perfiles por las dos rutas y
 * verificar que el resultado (semáforo, aviso de "ataca tras el cierre", nota
 * de manejadora) coincide, ya que la lógica es idéntica y solo cambian los
 * nombres de bucket de situación.
 */
import { describe, expect, it } from "vitest";
import { generateMotorV4 } from "./motor-v4";
import { ensamblarReporteParaTexto } from "./motor-v1";
import { computeCloseoutThreat, computeCloseoutThreatV1 } from "./closeoutThreat";
import testProfilesRaw from "../../../scripts/test-profiles.json";

interface TestProfile {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  clubContext?: Record<string, unknown>;
}

const profiles = testProfilesRaw as unknown as TestProfile[];

describe("computeCloseoutThreatV1 vs. computeCloseoutThreat (legacy) -- mismo resultado en los 24 perfiles", () => {
  for (const profile of profiles) {
    it(`${profile.id} (${profile.name})`, () => {
      const legacy = generateMotorV4(profile.inputs as any, profile.clubContext as any);
      const legacyThreat = computeCloseoutThreat(legacy.inputs, legacy.situations);

      const { completo } = (() => {
        const completo = ensamblarReporteParaTexto(profile.inputs as any, profile.clubContext as any, {
          jugadoraId: profile.id,
          modo: "completo",
        });
        return { completo };
      })();
      if (completo.reporte.modo !== "completo") throw new Error("esperaba modo completo");
      const v1Threat = computeCloseoutThreatV1(completo.enrichedInputs, completo.reporte.capa1.situaciones);

      expect(v1Threat.light).toBe(legacyThreat.light);
      expect(v1Threat.watchDrive).toBe(legacyThreat.watchDrive);
      expect(v1Threat.handlerNote).toEqual(legacyThreat.handlerNote);
      // El índice numérico puede variar por decimales de ponderación entre
      // buckets que no son 1:1 (ver spec 23.1) -- se compara el semáforo
      // (light), que es lo que la UI muestra, no el float interno.
    });
  }
});
