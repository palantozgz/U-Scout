import { describe, expect, it } from "vitest";
import { groupIndexFromLabel, summarizeGroupSignups } from "./schedule-groups";

describe("groupIndexFromLabel", () => {
  it("A..F -> 0..5", () => {
    expect(groupIndexFromLabel("A", 6)).toBe(0);
    expect(groupIndexFromLabel("C", 6)).toBe(2);
    expect(groupIndexFromLabel("F", 6)).toBe(5);
  });
  it("fuera de los grupos de la sesión o inválida -> null", () => {
    expect(groupIndexFromLabel("C", 2)).toBeNull();
    expect(groupIndexFromLabel("a", 6)).toBeNull();
    expect(groupIndexFromLabel("AB", 6)).toBeNull();
    expect(groupIndexFromLabel("", 6)).toBeNull();
    expect(groupIndexFromLabel(null, 6)).toBeNull();
    expect(groupIndexFromLabel(undefined, 6)).toBeNull();
  });
});

describe("summarizeGroupSignups", () => {
  const rows = [
    { user_id: "u1", status: "confirmed", group_label: "A" },
    { user_id: "u2", status: "confirmed", group_label: "B" },
    { user_id: "u3", status: "confirmed", group_label: "A" },
    { user_id: "u4", status: "declined", group_label: "A" },
    { user_id: "u5", status: "confirmed", group_label: null },
    { user_id: "u6", status: "maybe", group_label: "B" },
    { user_id: "u7", status: "confirmed", group_label: "E" },
  ];

  it("reparte las confirmadas por grupo", () => {
    const s = summarizeGroupSignups(rows, 2);
    expect(s.groups).toEqual([["u1", "u3"], ["u2"]]);
  });

  it("sin grupo: confirmadas sin letra o con una letra que no existe en esta sesión", () => {
    expect(summarizeGroupSignups(rows, 2).noGroup).toEqual(["u5", "u7"]);
  });

  it("ignora a quien declinó o dijo quizá", () => {
    const s = summarizeGroupSignups(rows, 2);
    const all = [...s.groups.flat(), ...s.noGroup];
    expect(all).not.toContain("u4");
    expect(all).not.toContain("u6");
  });

  it("limita el número de grupos entre 1 y 6", () => {
    expect(summarizeGroupSignups([], 99).groups).toHaveLength(6);
    expect(summarizeGroupSignups([], 0).groups).toHaveLength(1);
  });

  it("sin filas devuelve grupos vacíos", () => {
    expect(summarizeGroupSignups([], 3)).toEqual({ groups: [[], [], []], noGroup: [] });
  });
});
