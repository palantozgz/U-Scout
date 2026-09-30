// AÑADIDO 2026-09-30 -- lógica única para aceptar una invitación de club.
//
// Por qué existe: el flujo real de una jugadora es "recibo el enlace por WeChat,
// me registro en la web, me descargo la app, inicio sesión y funciona". Antes,
// la invitación pendiente solo se guardaba en localStorage del navegador donde
// se registró y solo se aceptaba desde la página de invitación; al iniciar
// sesión en la app quedaba con cuenta pero sin club. Ahora el token viaja en
// user_metadata.pending_club_invite (vive en la cuenta, no en el dispositivo) y
// el servidor lo reclama en el primer GET /api/club sin club.
//
// También corrige que el enlace se gastara antes de crear la membresía: si la
// creación falla, se libera el enlace; y un reintento de la misma cuenta cuenta
// como éxito (o repara una membresía que faltó).
import { storage } from "./storage";
import { grantRole } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type AcceptClubInvitationResult =
  | { ok: true; clubId: string; role: string }
  | { ok: false; status: 404 | 409 | 410 | 500; error: string };

function metaOf(user: { user_metadata?: unknown } | null | undefined): Record<string, unknown> {
  const m = user?.user_metadata;
  return m && typeof m === "object" ? (m as Record<string, unknown>) : {};
}

async function getAuthUserSafe(userId: string): Promise<{ user_metadata?: unknown } | null> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function acceptClubInvitationForUser(
  token: string,
  userId: string,
  email: string,
): Promise<AcceptClubInvitationResult> {
  try {
    const inv = await storage.getClubInvitationByToken(token);
    if (!inv) return { ok: false, status: 404, error: "Invalid invitation" };
    const usedByThisUser = inv.usedBy === userId;
    if (!usedByThisUser && inv.expiresAt < new Date()) {
      return { ok: false, status: 410, error: "Invitation expired" };
    }

    const claimedNow = await storage.markClubInvitationUsedIfUnused(inv.id, userId);
    if (!claimedNow && !usedByThisUser) {
      return { ok: false, status: 409, error: "Invitation already used" };
    }

    try {
      const authUser = await getAuthUserSafe(userId);
      const meta = metaOf(authUser);
      const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
      const displayName = fullName || email.split("@")[0] || "";

      const existing = await storage.getClubMemberByClubAndUser(inv.clubId, userId);
      let role = inv.role;
      if (!existing) {
        await storage.createClubMember({
          clubId: inv.clubId,
          userId,
          role: inv.role,
          displayName,
          jerseyNumber: "",
          position: "",
          status: "active",
          invitedEmail: inv.invitedEmail,
          joinedAt: new Date(),
        });
      } else if (existing.role !== inv.role) {
        // Ya era miembro (re-invitada con ascenso/descenso): mantener club_members.role
        // alineado con lo que concede esta invitación.
        await storage.updateClubMemberRole(existing.id, inv.role);
      } else {
        role = existing.role;
      }

      // Mantener el rol de auth alineado con el rol de club de la invitación (las
      // capacidades del cliente y los checks privilegiados del servidor lo leen), y
      // retirar la marca de invitación pendiente de esta misma invitación.
      try {
        if (inv.role === "head_coach" || inv.role === "master") {
          await grantRole(userId, inv.role, inv.createdBy);
        }
        const admin = getSupabaseAdmin();
        if (admin) {
          const next: Record<string, unknown> = { ...meta, role: inv.role };
          if (meta.pending_club_invite === token) delete next.pending_club_invite;
          await admin.auth.admin.updateUserById(userId, { user_metadata: next });
        }
      } catch (syncErr) {
        console.log(`[club-invite] role sync failed for userId=${userId}, role=${inv.role}:`, syncErr);
      }

      return { ok: true, clubId: inv.clubId, role };
    } catch (err) {
      // La membresía no se pudo crear: liberar el enlace para que pueda reintentar.
      if (claimedNow) {
        try {
          await storage.releaseClubInvitation(inv.id);
        } catch (releaseErr) {
          console.error("[club-invite] release failed:", releaseErr);
        }
      }
      console.error("[club-invite] accept failed:", err);
      return { ok: false, status: 500, error: "Failed to accept club invitation" };
    }
  } catch (err) {
    console.error("[club-invite] accept failed:", err);
    return { ok: false, status: 500, error: "Failed to accept club invitation" };
  }
}

const inflightClaims = new Map<string, Promise<boolean>>();

async function doClaim(userId: string, email: string): Promise<boolean> {
  const authUser = await getAuthUserSafe(userId);
  const meta = metaOf(authUser);
  const token = typeof meta.pending_club_invite === "string" ? meta.pending_club_invite.trim() : "";
  if (!token) return false;

  const result = await acceptClubInvitationForUser(token, userId, email);
  if (result.ok) return true;

  // Fallo definitivo (inválida, caducada, usada por otra cuenta): limpiar la marca para no
  // reintentar en cada petición. Ante un error transitorio (500) se conserva.
  if (result.status !== 500) {
    try {
      const admin = getSupabaseAdmin();
      const fresh = metaOf(await getAuthUserSafe(userId));
      if (admin && fresh.pending_club_invite === token) {
        const next = { ...fresh };
        delete next.pending_club_invite;
        await admin.auth.admin.updateUserById(userId, { user_metadata: next });
      }
    } catch (err) {
      console.log(`[club-invite] could not clear pending marker for userId=${userId}:`, err);
    }
  }
  return false;
}

/**
 * Reclama la invitación pendiente guardada en la cuenta (user_metadata.pending_club_invite).
 * Devuelve true si la jugadora/staff ha quedado unida a un club. Las llamadas simultáneas
 * del mismo usuario se serializan (el cliente lanza varias peticiones a la vez al abrir).
 */
export function claimPendingClubInvitation(userId: string, email: string): Promise<boolean> {
  const running = inflightClaims.get(userId);
  if (running) return running;
  const p = doClaim(userId, email).finally(() => {
    inflightClaims.delete(userId);
  });
  inflightClaims.set(userId, p);
  return p;
}
