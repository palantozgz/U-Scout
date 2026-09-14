import { describe, expect, it } from "vitest";
import { aplicarPatronesPromocionados, type PatronPromocionadoActivo } from "./motor-v1";
import type { MotorOutput } from "./motor-v2.1";

// Nivel B / "el decantador" (spec 38/39). Regresión obligatoria pedida por
// El Arquitecto: sin patrones activos, el resultado debe ser idéntico
// (motor:compare ya lo confirma con datos reales, 0 divergencias -- esto
// cubre el mecanismo en sí, con datos sintéticos controlados).

function mo(over: Partial<MotorOutput> & { key: string; category: MotorOutput["category"]; weight: number }): MotorOutput {
  return { source: "test", ...over };
}

describe("aplicarPatronesPromocionados", () => {
  const rawOutputs: MotorOutput[] = [
    mo({ key: "deny_strong_hand", category: "deny", weight: 0.6 }),
    mo({ key: "deny_weak_hand", category: "deny", weight: 0.4 }),
    mo({ key: "force_left", category: "force", weight: 0.5 }),
    mo({ key: "allow_post", category: "allow", weight: 0.3 }),
  ];

  it("sin patrones (undefined o vacío), devuelve exactamente el mismo array -- comportamiento por defecto intacto", () => {
    expect(aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", undefined)).toBe(rawOutputs);
    expect(aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", [])).toBe(rawOutputs);
  });

  it("patrón de un arquetipo distinto al detectado no se aplica", () => {
    const patrones: PatronPromocionadoActivo[] = [
      { archetypeKey: "interior_poste", fieldKey: "deny.instruction", replacementKey: "deny_weak_hand" },
    ];
    const result = aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", patrones);
    expect(result).toBe(rawOutputs); // ningún patrón coincide, mismo array
  });

  it("patrón activo sube el weight del replacementKey por encima del ganador actual -- el ganador cambia", () => {
    const patrones: PatronPromocionadoActivo[] = [
      { archetypeKey: "armadora_creadora", fieldKey: "deny.instruction", replacementKey: "deny_weak_hand" },
    ];
    const result = aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", patrones);
    const denyOutputs = result.filter((o) => o.category === "deny").sort((a, b) => b.weight - a.weight);
    expect(denyOutputs[0].key).toBe("deny_weak_hand"); // ahora gana, antes era deny_strong_hand
    // force/allow no tocados
    expect(result.find((o) => o.key === "force_left")!.weight).toBe(0.5);
    expect(result.find((o) => o.key === "allow_post")!.weight).toBe(0.3);
  });

  it("revertir el patrón (quitarlo del array) devuelve el resultado original byte a byte", () => {
    const conPatron = aplicarPatronesPromocionados(
      rawOutputs,
      "armadora_creadora",
      [{ archetypeKey: "armadora_creadora", fieldKey: "deny.instruction", replacementKey: "deny_weak_hand" }],
    );
    expect(conPatron).not.toEqual(rawOutputs.map((o) => o)); // sí cambió con el patrón activo

    const sinPatron = aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", []);
    expect(sinPatron).toEqual(rawOutputs); // revertido = idéntico al original
  });

  it("replacementKey que no existe como candidato real de esta jugadora: no se fuerza nada", () => {
    const patrones: PatronPromocionadoActivo[] = [
      { archetypeKey: "armadora_creadora", fieldKey: "deny.instruction", replacementKey: "deny_nunca_generado" },
    ];
    const result = aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", patrones);
    expect(result).toEqual(rawOutputs);
  });

  it("ya es el ganador: no hace nada (idempotente)", () => {
    const patrones: PatronPromocionadoActivo[] = [
      { archetypeKey: "armadora_creadora", fieldKey: "deny.instruction", replacementKey: "deny_strong_hand" },
    ];
    const result = aplicarPatronesPromocionados(rawOutputs, "armadora_creadora", patrones);
    expect(result).toBe(rawOutputs);
  });
});
