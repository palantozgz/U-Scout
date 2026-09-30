import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const storage = {
    getClubInvitationByToken: vi.fn(),
    markClubInvitationUsedIfUnused: vi.fn(),
    releaseClubInvitation: vi.fn(),
    getClubMemberByClubAndUser: vi.fn(),
    createClubMember: vi.fn(),
    updateClubMemberRole: vi.fn(),
  };
  const admin = {
    auth: { admin: { getUserById: vi.fn(), updateUserById: vi.fn() } },
  };
  return { storage, admin, grantRole: vi.fn() };
});

vi.mock("./storage", () => ({ storage: h.storage }));
vi.mock("./auth", () => ({ grantRole: h.grantRole }));
vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => h.admin }));

import { acceptClubInvitationForUser, claimPendingClubInvitation } from "./clubInvitations";

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

function inv(over: Record<string, unknown> = {}) {
  return {
    id: "inv1",
    clubId: "club1",
    role: "player",
    token: "tok",
    invitedEmail: null,
    createdBy: "hc1",
    usedBy: null,
    expiresAt: FUTURE,
    ...over,
  };
}

function authUser(meta: Record<string, unknown>) {
  h.admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { user_metadata: meta } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.storage.markClubInvitationUsedIfUnused.mockResolvedValue(true);
  h.storage.getClubMemberByClubAndUser.mockResolvedValue(undefined);
  h.storage.createClubMember.mockResolvedValue({ id: "m1" });
  h.storage.releaseClubInvitation.mockResolvedValue(undefined);
  h.admin.auth.admin.updateUserById.mockResolvedValue({});
  authUser({ full_name: "王芳", pending_club_invite: "tok" });
});

describe("acceptClubInvitationForUser", () => {
  it("crea la membresía con el nombre completo y retira la marca pendiente", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    const r = await acceptClubInvitationForUser("tok", "u1", "wang123@qq.com");
    expect(r).toEqual({ ok: true, clubId: "club1", role: "player" });
    expect(h.storage.createClubMember).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: "club1", userId: "u1", role: "player", displayName: "王芳" }),
    );
    const meta = h.admin.auth.admin.updateUserById.mock.calls[0][1].user_metadata;
    expect(meta.role).toBe("player");
    expect("pending_club_invite" in meta).toBe(false);
  });

  it("usa el prefijo del correo si no hay nombre completo", async () => {
    authUser({});
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    await acceptClubInvitationForUser("tok", "u1", "wang123@qq.com");
    expect(h.storage.createClubMember).toHaveBeenCalledWith(expect.objectContaining({ displayName: "wang123" }));
  });

  it("404 si el token no existe y 410 si caducó", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValueOnce(undefined);
    expect(await acceptClubInvitationForUser("x", "u1", "a@b.c")).toMatchObject({ ok: false, status: 404 });
    h.storage.getClubInvitationByToken.mockResolvedValueOnce(inv({ expiresAt: PAST }));
    expect(await acceptClubInvitationForUser("tok", "u1", "a@b.c")).toMatchObject({ ok: false, status: 410 });
    expect(h.storage.createClubMember).not.toHaveBeenCalled();
  });

  it("409 si la invitación ya la usó otra cuenta, sin crear membresía", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv({ usedBy: "other" }));
    h.storage.markClubInvitationUsedIfUnused.mockResolvedValue(false);
    expect(await acceptClubInvitationForUser("tok", "u1", "a@b.c")).toMatchObject({ ok: false, status: 409 });
    expect(h.storage.createClubMember).not.toHaveBeenCalled();
  });

  it("reintento de la misma cuenta: éxito si ya es miembro, sin duplicar", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv({ usedBy: "u1", expiresAt: PAST }));
    h.storage.markClubInvitationUsedIfUnused.mockResolvedValue(false);
    h.storage.getClubMemberByClubAndUser.mockResolvedValue({ id: "m1", role: "player" });
    const r = await acceptClubInvitationForUser("tok", "u1", "a@b.c");
    expect(r).toEqual({ ok: true, clubId: "club1", role: "player" });
    expect(h.storage.createClubMember).not.toHaveBeenCalled();
  });

  it("repara: enlace gastado por la misma cuenta pero sin membresía", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv({ usedBy: "u1" }));
    h.storage.markClubInvitationUsedIfUnused.mockResolvedValue(false);
    const r = await acceptClubInvitationForUser("tok", "u1", "a@b.c");
    expect(r.ok).toBe(true);
    expect(h.storage.createClubMember).toHaveBeenCalledTimes(1);
  });

  it("si falla crear la membresía, libera el enlace y devuelve 500", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    h.storage.createClubMember.mockRejectedValue(new Error("db down"));
    const r = await acceptClubInvitationForUser("tok", "u1", "a@b.c");
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(h.storage.releaseClubInvitation).toHaveBeenCalledWith("inv1");
  });

  it("no libera el enlace si el fallo es de una reparación (no lo reclamó ahora)", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv({ usedBy: "u1" }));
    h.storage.markClubInvitationUsedIfUnused.mockResolvedValue(false);
    h.storage.createClubMember.mockRejectedValue(new Error("db down"));
    await acceptClubInvitationForUser("tok", "u1", "a@b.c");
    expect(h.storage.releaseClubInvitation).not.toHaveBeenCalled();
  });

  it("head_coach: concede el rol en user_roles", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv({ role: "head_coach" }));
    await acceptClubInvitationForUser("tok", "u1", "a@b.c");
    expect(h.grantRole).toHaveBeenCalledWith("u1", "head_coach", "hc1");
  });

  it("un fallo al sincronizar el rol de auth no rompe la aceptación", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    h.admin.auth.admin.updateUserById.mockRejectedValue(new Error("auth down"));
    const r = await acceptClubInvitationForUser("tok", "u1", "a@b.c");
    expect(r.ok).toBe(true);
  });
});

describe("claimPendingClubInvitation", () => {
  it("sin marca pendiente no toca la base de datos", async () => {
    authUser({ full_name: "x" });
    expect(await claimPendingClubInvitation("u1", "a@b.c")).toBe(false);
    expect(h.storage.getClubInvitationByToken).not.toHaveBeenCalled();
  });

  it("con marca pendiente acepta la invitación", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    expect(await claimPendingClubInvitation("u1", "a@b.c")).toBe(true);
    expect(h.storage.createClubMember).toHaveBeenCalledTimes(1);
  });

  it("fallo definitivo (usada por otra): limpia la marca y devuelve false", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv({ usedBy: "other" }));
    h.storage.markClubInvitationUsedIfUnused.mockResolvedValue(false);
    expect(await claimPendingClubInvitation("u1", "a@b.c")).toBe(false);
    const meta = h.admin.auth.admin.updateUserById.mock.calls.at(-1)?.[1].user_metadata;
    expect(meta && "pending_club_invite" in meta).toBe(false);
  });

  it("error transitorio (500): conserva la marca", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    h.storage.createClubMember.mockRejectedValue(new Error("db down"));
    expect(await claimPendingClubInvitation("u1", "a@b.c")).toBe(false);
    expect(h.admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("peticiones simultáneas del mismo usuario crean una sola membresía", async () => {
    h.storage.getClubInvitationByToken.mockResolvedValue(inv());
    const [a, b, c] = await Promise.all([
      claimPendingClubInvitation("u1", "a@b.c"),
      claimPendingClubInvitation("u1", "a@b.c"),
      claimPendingClubInvitation("u1", "a@b.c"),
    ]);
    expect([a, b, c]).toEqual([true, true, true]);
    expect(h.storage.createClubMember).toHaveBeenCalledTimes(1);
  });
});
