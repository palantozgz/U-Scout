/**
 * Tests de `reportTextRendererV1.ts` (spec 23, PR-A) — capa de texto nueva
 * para `ScoutingReportV1`, verificada en aislamiento antes de tocar
 * `ReportSlidesV1.tsx` (PR-B, todavía no hecho — motor-v1 sigue sin llegar a
 * producción real, spec 21.5/23).
 *
 * No repite los tests de cálculo (eso es `motor-v1.test.ts`) — aquí solo se
 * verifica que el texto se genera sin huecos: ningún `switch` cae en un
 * `default`/string vacío, la etiqueta de archetype fusiona el modificador
 * cuando existe, y el semáforo de amenaza produce el copy activo correcto
 * (nunca silencio, spec 21.9 bis).
 */
import { describe, expect, it } from "vitest";
import { UScoutMotor } from "./motor-v2.1";
import { ensamblarReporteParaTexto } from "./motor-v1";
import { renderReportV1, renderThreatV1, type RenderContext } from "./reportTextRendererV1";
import type { EnrichedInputs } from "./motor-v2.1";
import testProfilesRaw from "../../../scripts/test-profiles.json";

interface TestProfile {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  clubContext?: Record<string, unknown>;
}

const profiles = testProfilesRaw as unknown as TestProfile[];
const motor = new UScoutMotor();

const CTX_EN: RenderContext = { locale: "en", gender: "f" };
const CTX_ES: RenderContext = { locale: "es", gender: "f" };
const CTX_ZH: RenderContext = { locale: "zh", gender: "f" };
const LOCALES = [CTX_EN, CTX_ES, CTX_ZH];

function reportesDe(profile: TestProfile) {
  const sencillo = ensamblarReporteParaTexto(profile.inputs as any, profile.clubContext as any, {
    jugadoraId: profile.id,
    modo: "sencillo",
  });
  const completo = ensamblarReporteParaTexto(profile.inputs as any, profile.clubContext as any, {
    jugadoraId: profile.id,
    modo: "completo",
  });
  return { sencillo, completo };
}

describe("reportTextRendererV1 — sin huecos de texto en los 24 perfiles del fixture, en los 3 idiomas", () => {
  for (const profile of profiles) {
    it(`${profile.id} (${profile.name}): modo completo renderiza sin string vacío ni key cruda visible`, () => {
      const { completo } = reportesDe(profile);
      for (const ctx of LOCALES) {
        const rendered = renderReportV1(completo.reporte, completo.enrichedInputs, ctx);
        if (rendered.modo !== "completo") throw new Error("esperaba modo completo");

        // Identidad
        expect(rendered.identity.archetypeLabel.length).toBeGreaterThan(0);
        expect(rendered.identity.tagline.length).toBeGreaterThan(0);
        expect(rendered.identity.threat.length).toBeGreaterThan(0);

        // Situaciones -- ninguna descripción vacía (el switch cubre las 11
        // buckets Synergy, un string vacío señalaría un `default` alcanzado)
        for (const sit of rendered.situations) {
          expect(sit.description.length, `${profile.id}/${ctx.locale}: situación ${sit.situacion} sin descripción`).toBeGreaterThan(0);
          expect(sit.label.length).toBeGreaterThan(0);
        }

        // Defensa -- deny/force/allow presentes solo si el motor los produjo
        // (opcionales de verdad, spec 21.6/21.9), pero cuando existen su
        // instruction nunca debe ser el fallback genérico de "key sin traducir"
        for (const campo of [rendered.defense.deny, rendered.defense.force, rendered.defense.allow]) {
          if (!campo) continue;
          expect(campo.instruction.length).toBeGreaterThan(0);
        }

        // Aware -- máximo 2 (spec 13.3/7), cada uno con texto real
        expect(rendered.alerts.length).toBeLessThanOrEqual(2);
        for (const alert of rendered.alerts) {
          expect(alert.text.length).toBeGreaterThan(0);
          expect(alert.mechanismType.length).toBeGreaterThan(0);
        }
      }
    });

    it(`${profile.id}: modo sencillo -- accionPrincipal ausente ⟺ nivelAmenaza "estandar" con copy activo (nunca silencio)`, () => {
      const { sencillo } = reportesDe(profile);
      const rendered = renderReportV1(sencillo.reporte, sencillo.enrichedInputs, CTX_ES);
      if (rendered.modo !== "sencillo") throw new Error("esperaba modo sencillo");

      if (sencillo.reporte.modo === "sencillo" && !sencillo.reporte.accionPrincipal) {
        expect(rendered.accionPrincipal).toBeUndefined();
        expect(rendered.identity.nivelAmenaza).toBe("estandar");
        // El copy activo vive en `threat`, no en `accionPrincipal` -- nunca un
        // hueco vacío en Capa 0 (spec 21.9 bis).
        expect(rendered.identity.threat).toContain("Defensa estándar");
      } else {
        expect(rendered.accionPrincipal).toBeDefined();
        expect(rendered.identity.nivelAmenaza).toBe("alta");
      }
    });
  }
});

describe("reportTextRendererV1 — fusión de archetypeModificador en la etiqueta (spec 14.3 bis)", () => {
  it("p003 (Curry, de_movimiento esperado): la etiqueta fusiona el modificador, nunca aparece como chip propio", () => {
    const p003 = profiles.find((p) => p.id === "p003")!;
    const { completo } = reportesDe(p003);
    expect(completo.reporte.identidad.archetypeModificador).toBe("de_movimiento");

    const renderedES = renderReportV1(completo.reporte, completo.enrichedInputs, CTX_ES);
    expect(renderedES.identity.archetypeLabel).toContain("de movimiento");

    const renderedEN = renderReportV1(completo.reporte, completo.enrichedInputs, CTX_EN);
    expect(renderedEN.identity.archetypeLabel).toContain("(off movement)");
  });

  it("perfil sin modificador: la etiqueta es solo el archetype base, sin sufijo", () => {
    // p001 (Luka Doncic) no dispara ningún modificador -- verificado en 14.3 bis
    const p001 = profiles.find((p) => p.id === "p001")!;
    const { completo } = reportesDe(p001);
    expect(completo.reporte.identidad.archetypeModificador).toBeUndefined();

    const rendered = renderReportV1(completo.reporte, completo.enrichedInputs, CTX_ES);
    expect(rendered.identity.archetypeLabel).not.toContain("de movimiento");
    expect(rendered.identity.archetypeLabel).not.toContain("a la contra");
  });
});

describe("reportTextRendererV1 — renderThreatV1 aislado (semáforo, sin depender del ensamblado completo)", () => {
  it('nivelAmenaza "estandar": copy activo en los 3 idiomas, nunca string vacío', () => {
    const identidadBase = {
      nombre: "Test",
      posicion: "alero" as const,
      alturaCm: 180,
      pesoKg: 70,
      manoDominante: "D" as const,
      numero: "0",
      archetypeKey: "alero_tiradora" as const,
      archetypeConfianza: "media" as const,
      nivelAmenaza: "estandar" as const,
      statsDestacados: [],
    };
    expect(renderThreatV1(identidadBase, CTX_ES)).toContain("Defensa estándar");
    expect(renderThreatV1(identidadBase, CTX_EN)).toContain("Standard team defense");
    expect(renderThreatV1(identidadBase, CTX_ZH)).toContain("标准防守");
  });
});
