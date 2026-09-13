import { describe, expect, it } from "vitest";
import { computeCapabilities } from "./capabilities";

describe("computeCapabilities", () => {
  it("master can manage/edit/invite without membership; UI uses effectiveRole", () => {
    const c = computeCapabilities({
      realRole: "master",
      effectiveRole: "player",
      membership: null,
    });
    expect(c.canManageClub).toBe(true);
    expect(c.canEditClub).toBe(true);
    expect(c.canInviteMembers).toBe(true);
    expect(c.canSeeAdminActions).toBe(true);
    expect(c.canUsePlayerUX).toBe(true);
    expect(c.canViewCoachUI).toBe(false);
    expect(c.canCreateEvent).toBe(false);
  });

  it("head_coach with active membership can manage/invite/edit (non-owner edit allowed by default)", () => {
    const c = computeCapabilities({
      realRole: "head_coach",
      effectiveRole: "head_coach",
      membership: { clubId: "c1", userId: "u1", role: "head_coach", status: "active", isOwner: false },
    });
    expect(c.canManageClub).toBe(true);
    expect(c.canInviteMembers).toBe(true);
    expect(c.canEditClub).toBe(true);
    expect(c.canUsePlayerUX).toBe(false);
    expect(c.canCreateEvent).toBe(true);
  });

  it("coach with active membership CANNOT manage/invite/edit club — only head_coach can", () => {
    const c = computeCapabilities({
      realRole: "coach",
      effectiveRole: "coach",
      membership: { clubId: "c1", userId: "u1", role: "coach", status: "active", isOwner: false },
    });
    expect(c.canManageClub).toBe(false);
    expect(c.canInviteMembers).toBe(false);
    expect(c.canSeeAdminActions).toBe(false);
    expect(c.canEditClub).toBe(false);
    // CORREGIDO 2026-09-14 (hueco de test-infra, spec 31): esta aserción
    // decía `true` con el comentario "coaches can still create sessions" --
    // contradecía tanto el propio código (`canCreateEvent` exige
    // `hasOperationsAccess` para un coach raso, capabilities.ts) como el
    // siguiente test de este mismo archivo (que sí distingue explícitamente
    // "coach CON operationsAccess" -> true) y el consumidor real
    // (Schedule.tsx gatea crear/editar/arrastrar sesiones con este mismo
    // campo). Nunca se detectó porque todo el archivo crasheaba al cargar
    // (`window is not defined`) antes de que ninguna prueba llegara a
    // ejecutarse -- 0 cobertura real de computeCapabilities hasta hoy.
    expect(c.canCreateEvent).toBe(false);
  });

  it("coach with operationsAccess CANNOT manage/invite/edit club either", () => {
    const c = computeCapabilities({
      realRole: "coach",
      effectiveRole: "coach",
      membership: { clubId: "c1", userId: "u1", role: "coach", status: "active", isOwner: false, operationsAccess: true },
    });
    expect(c.canManageClub).toBe(false);
    expect(c.canInviteMembers).toBe(false);
    expect(c.canSeeAdminActions).toBe(false);
    expect(c.canEditClub).toBe(false);
    expect(c.canAccessPersonnel).toBe(true); // operationsAccess does grant Personnel
    expect(c.canCreateEvent).toBe(true);
  });

  it("player cannot manage club even if membership present", () => {
    const c = computeCapabilities({
      realRole: "player",
      effectiveRole: "player",
      membership: { clubId: "c1", userId: "u1", role: "player", status: "active", isOwner: false },
    });
    expect(c.canManageClub).toBe(false);
    expect(c.canInviteMembers).toBe(false);
    expect(c.canEditClub).toBe(false);
    expect(c.canUsePlayerUX).toBe(true);
  });

  it("null membership prevents manage/edit for non-master roles", () => {
    const c = computeCapabilities({
      realRole: "head_coach",
      effectiveRole: "head_coach",
      membership: null,
    });
    expect(c.canManageClub).toBe(false);
    expect(c.canEditClub).toBe(false);
    expect(c.canInviteMembers).toBe(false);
  });

  it("unknown effectiveRole still yields safe booleans (null)", () => {
    const c = computeCapabilities({
      realRole: null,
      effectiveRole: null,
      membership: null,
    });
    expect(c.canUsePlayerUX).toBe(false);
    expect(c.canViewCoachUI).toBe(true);
    expect(c.canManageClub).toBe(false);
  });
});

