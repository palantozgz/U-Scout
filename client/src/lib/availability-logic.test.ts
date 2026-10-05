import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_NOTE_MAX,
  availabilityOf,
  isRestricted,
  needsRow,
  normalizeNote,
  summarizeAvailability,
  type AvailabilityRow,
} from "./availability-logic";

describe("normalizeNote", () => {
  it("recorta espacios y devuelve null si queda vacía", () => {
    expect(normalizeNote("  sin contacto  ")).toBe("sin contacto");
    expect(normalizeNote("   ")).toBeNull();
    expect(normalizeNote("")).toBeNull();
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
  });
  it(`limita a ${AVAILABILITY_NOTE_MAX} caracteres`, () => {
    expect(normalizeNote("a".repeat(500))).toHaveLength(AVAILABILITY_NOTE_MAX);
  });
  it("conserva caracteres chinos", () => {
    expect(normalizeNote(" 不做对抗训练 ")).toBe("不做对抗训练");
  });
});

const rows: AvailabilityRow[] = [
  { user_id: "u1", status: "modified", note: "sin contacto" },
  { user_id: "u2", status: "unavailable", note: null },
];

describe("availabilityOf", () => {
  it("devuelve la fila si existe", () => {
    expect(availabilityOf(rows, "u1")).toEqual({ status: "modified", note: "sin contacto" });
  });
  it("sin fila = disponibilidad completa", () => {
    expect(availabilityOf(rows, "u3")).toEqual({ status: "full", note: null });
  });
});

describe("summarizeAvailability", () => {
  it("cuenta por estado y trata a las jugadoras sin fila como completas", () => {
    expect(summarizeAvailability(rows, ["u1", "u2", "u3", "u4"])).toEqual({ full: 2, modified: 1, unavailable: 1 });
  });
  it("ignora filas de quien no está en la plantilla", () => {
    expect(summarizeAvailability(rows, ["u3"])).toEqual({ full: 1, modified: 0, unavailable: 0 });
  });
});

describe("isRestricted / needsRow", () => {
  it("solo 'full' no está restringida", () => {
    expect(isRestricted("full")).toBe(false);
    expect(isRestricted("modified")).toBe(true);
    expect(isRestricted("unavailable")).toBe(true);
  });
  it("completa sin nota no necesita fila; el resto sí", () => {
    expect(needsRow("full", null)).toBe(false);
    expect(needsRow("full", "revisar el lunes")).toBe(true);
    expect(needsRow("modified", null)).toBe(true);
  });
});
