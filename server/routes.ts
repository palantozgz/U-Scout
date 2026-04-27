import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertTeamSchema, insertPlayerSchema, type Club } from "@shared/schema";
import { patchClubBodySchema } from "@shared/club-context";
import { requireAuth } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { lookupAuthBasicsByUserIds, mergeAuthWithSession } from "./authUserLookup";

function publicAppOrigin(req: Request): string {
  const env = process.env.APP_PUBLIC_URL ?? process.env.VITE_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const xfProto = req.headers["x-forwarded-proto"];
  const proto = typeof xfProto === "string" ? xfProto.split(",")[0].trim() : req.protocol;
  const xfHost = req.headers["x-forwarded-host"];
  const host =
    typeof xfHost === "string"
      ? xfHost.split(",")[0].trim()
      : req.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

const createInvitationBodySchema = z.object({
  teamId: z.string().min(1),
  role: z.enum(["coach", "player"]),
});

const reportAssignmentBodySchema = z.object({
  userId: z.string().min(1),
  playerId: z.string().min(1),
});

const playerSlideViewBodySchema = z.object({
  playerId: z.string().min(1),
  slideIndex: z.number().int().min(0).max(4),
});

const clubInviteBodySchema = z.object({
  role: z.enum(["head_coach", "coach", "player"]),
  email: z.string().email().optional().or(z.literal("")),
});

const reportOverrideBodySchema = z.object({
  slide: z.enum([
    "identity",
    "attack",
    "danger",
    "screens",
    "plan",
    "situations",
    "defense",
    "alerts",
  ]),
  itemKey: z.string().min(1),
  action: z.enum(["hide", "keep"]),
});

function computeHasDiscrepancy(
  overrides: Array<{ coachId: string; slide: string; itemKey: string; action: string }>,
): boolean {
  const byKey = new Map<string, Map<string, string>>();
  for (const o of overrides) {
    const k = `${o.slide}\0${o.itemKey}`;
    if (!byKey.has(k)) byKey.set(k, new Map());
    byKey.get(k)!.set(o.coachId, o.action);
  }
  for (const m of Array.from(byKey.values())) {
    if (m.size < 2) continue;
    if (new Set(Array.from(m.values())).size > 1) return true;
  }
  return false;
}

async function userCanManageClub(req: Request, clubId: string): Promise<boolean> {
  const uid = req.user!.id;
  const appRole = req.user!.role;
  if (appRole === "master") return true;
  const club = await storage.getClubById(clubId);
  if (!club) return false;
  if (club.ownerId === uid) return true;
  const m = await storage.getClubMemberByClubAndUser(clubId, uid);
  if (!m || m.status !== "active") return false;
  return m.role === "head_coach";
}

function isHeadCoachOrMaster(req: Request): boolean {
  const r = req.user?.role;
  return r === "master" || r === "head_coach";
}

async function canManageTeam(req: Request, teamId: string): Promise<boolean> {
  const role = req.user!.role;
  if (role === "master") return true;
  if (role === "head_coach") {
    const m = await storage.getTeamMember(req.user!.id, teamId);
    if (m?.role === "coach") return true;
    const members = await storage.listTeamMembersByTeam(teamId);
    const hasCoach = members.some((x) => x.role === "coach");
    if (!hasCoach) return true;
  }
  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Public: club invitation preview ──────────────────────────────────────
  app.get("/api/club/invitations/:token", async (req, res) => {
    try {
      const token = req.params.token as string;
      const inv = await storage.getClubInvitationByToken(token);
      if (!inv) return res.status(404).json({ error: "Invalid invitation" });
      const club = await storage.getClubById(inv.clubId);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const now = new Date();
      const expired = inv.expiresAt < now;
      const used = Boolean(inv.usedBy);
      res.json({
        club: { id: club.id, name: club.name, logo: club.logo },
        role: inv.role,
        expiresAt: inv.expiresAt.toISOString(),
        expired,
        used,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load invitation" });
    }
  });

  app.get("/api/teams", requireAuth, async (_req, res) => {
    try {
      const result = await storage.getTeams();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", requireAuth, async (req, res) => {
    try {
      const parsed = insertTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const team = await storage.createTeam(parsed.data);
      res.status(201).json(team);
    } catch (err) {
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      const parsed = insertTeamSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const team = await storage.updateTeam((req.params.id as string), parsed.data);
      if (!team) return res.status(404).json({ error: "Team not found" });
      res.json(team);
    } catch (err) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTeam((req.params.id as string));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  app.get("/api/players", requireAuth, async (req, res) => {
    try {
      const teamId = req.query.teamId as string | undefined;
      const result = await storage.getPlayers(teamId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  app.get("/api/players/:id", requireAuth, async (req, res) => {
    try {
      const player = await storage.getPlayer((req.params.id as string));
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch player" });
    }
  });

  app.post("/api/players", requireAuth, async (req, res) => {
    try {
      const parsed = insertPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const player = await storage.createPlayer({
        ...parsed.data,
        createdByUserId: req.user!.id,
      });
      res.status(201).json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to create player" });
    }
  });

  app.patch("/api/players/:id", requireAuth, async (req, res) => {
    try {
      const parsed = insertPlayerSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const player = await storage.updatePlayer((req.params.id as string), parsed.data);
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to update player" });
    }
  });

  app.delete("/api/players/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePlayer((req.params.id as string));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete player" });
    }
  });

  // ── Report approval / publication (coach review) ─────────────────────────
  app.get("/api/players/:id/approval-status", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      const club = await storage.findClubForApprovalStaff(req.user!.id);
      const totalStaff = club ? await storage.countClubStaffCoaches(club.id) : 1;

      const approvalRows = await storage.listReportApprovalsForPlayer(playerId);
      const overrideRows = await storage.listReportOverridesForPlayer(playerId);
      const overrides = overrideRows.map((o) => ({
        coachId: o.coachId,
        slide: o.slide,
        itemKey: o.itemKey,
        action: o.action,
      }));

      res.json({
        approvals: approvalRows.map((a) => ({
          coachId: a.coachId,
          approvedAt: a.approvedAt.toISOString(),
        })),
        totalStaff,
        overrides,
        isPublished: Boolean(player.published),
        hasDiscrepancy: computeHasDiscrepancy(overrides),
      });
    } catch (_err) {
      res.status(500).json({ error: "Failed to load approval status" });
    }
  });

  app.post("/api/players/:id/approve", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      await storage.upsertReportApproval(playerId, req.user!.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to save approval" });
    }
  });

  app.delete("/api/players/:id/approve", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      await storage.deleteReportApproval(playerId, req.user!.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to remove approval" });
    }
  });

  app.post("/api/players/:id/overrides", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const parsed = reportOverrideBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      await storage.upsertReportOverride({
        playerId,
        coachId: req.user!.id,
        slide: parsed.data.slide,
        itemKey: parsed.data.itemKey,
        action: parsed.data.action,
      });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to save override" });
    }
  });

  app.delete("/api/players/:id/overrides/:itemKey", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const itemKey = decodeURIComponent(req.params.itemKey as string);
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      await storage.deleteReportOverride(playerId, req.user!.id, itemKey);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to remove override" });
    }
  });

  app.post("/api/players/:id/publish", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const approvals = await storage.listReportApprovalsForPlayer(playerId);
      if (approvals.length < 1) {
        return res.status(400).json({ error: "At least one coach approval is required" });
      }
      const updated = await storage.publishPlayerReport(playerId, req.user!.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to publish report" });
    }
  });

  app.post("/api/players/:id/unpublish", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const updated = await storage.unpublishPlayerReport(playerId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to unpublish report" });
    }
  });

  // ── Scout versions (Film Room backend) ───────────────────────────────────
  // Mark player as canonical (head_coach / master only)
  app.post("/api/players/:id/canonical", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const role = req.user!.role;
      if (role !== "head_coach" && role !== "master") {
        return res.status(403).json({ error: "Only head_coach or master can mark canonical" });
      }
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      await storage.setPlayerCanonical(playerId, true);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to set canonical" });
    }
  });

  // Upsert this coach's scout version (auto-save from PlayerEditor)
  app.put("/api/players/:id/scout-version", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const coachId = req.user!.id;
      const { inputs } = req.body;
      if (!inputs || typeof inputs !== "object") {
        return res.status(400).json({ error: "inputs required" });
      }
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const version = await storage.upsertScoutVersion(playerId, coachId, inputs);
      res.json(version);
    } catch (err) {
      res.status(500).json({ error: "Failed to save scout version" });
    }
  });

  // Submit this coach's version to Film Room
  app.post("/api/players/:id/scout-version/submit", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const coachId = req.user!.id;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      if (!(player as any).is_canonical) {
        return res.status(400).json({ error: "Player is not canonical — cannot submit to Film Room" });
      }
      const version = await storage.getScoutVersion(playerId, coachId);
      if (!version) return res.status(404).json({ error: "No scout version found for this coach" });
      await storage.submitScoutVersion(playerId, coachId);
      // Also upsert the report approval (existing flow)
      await storage.upsertReportApproval(playerId, coachId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to submit scout version" });
    }
  });

  // List all scout versions for a player (Film Room view)
  app.get("/api/players/:id/scout-versions", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const coachId = req.user!.id;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      // Anti-bias: coach can only see all versions if they have submitted their own
      const myVersion = await storage.getScoutVersion(playerId, coachId);
      if (!myVersion || myVersion.status === "draft") {
        return res.status(403).json({ error: "Submit your own version first" });
      }
      const versions = await storage.listScoutVersionsForPlayer(playerId);
      res.json({ versions, isCanonical: !!(player as any).is_canonical });
    } catch (err) {
      res.status(500).json({ error: "Failed to load scout versions" });
    }
  });

  // ── Player home (membership + assigned scouting reports) ─────────────────
  app.get("/api/player/home", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const membership = await storage.getPrimaryTeamMemberForUser(userId);
      const rawReports = await storage.listScoutingReportsForUser(userId);
      res.json({
        membership: membership
          ? {
              jerseyNumber: membership.jerseyNumber,
              position: membership.position,
              displayName: membership.displayName,
              role: membership.role,
              team: {
                id: membership.team.id,
                name: membership.team.name,
                logo: membership.team.logo,
              },
            }
          : null,
        reports: rawReports.map((r) => ({
          assignmentId: r.assignmentId,
          assignedAt: r.assignedAt.toISOString(),
          opponentPlayerId: r.player.id,
          opponentName: r.player.name || "—",
          opponentTeamId: r.team.id,
          opponentTeamName: r.team.name,
          opponentImageUrl: r.player.imageUrl ?? "",
          opponentNumber: r.player.number ?? "",
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load player home" });
    }
  });

  app.get("/api/player/teams", requireAuth, async (req, res) => {
    try {
      const rows = await storage.listPlayerTeamsReportSummary(req.user!.id);
      res.json({
        teams: rows.map((r) => ({
          team: { id: r.team.id, name: r.team.name, logo: r.team.logo },
          totalReports: r.totalReports,
          unseenCount: r.unseenCount,
          reportsPending: r.unseenCount,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load player teams" });
    }
  });

  app.get("/api/player/team/:teamId", requireAuth, async (req, res) => {
    try {
      const teamId = req.params.teamId as string;
      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ error: "Team not found" });
      const rows = await storage.listAssignedPlayersInTeamForUser(req.user!.id, teamId);
      if (!rows.length) {
        return res.status(404).json({ error: "No assigned reports for this team" });
      }
      res.json({
        team: { id: team.id, name: team.name, logo: team.logo },
        players: rows.map(({ player, viewStatus }) => {
          const inp = player.inputs as Record<string, unknown> | undefined;
          const position = typeof inp?.position === "string" ? inp.position : "—";
          return {
            playerId: player.id,
            name: player.name || "—",
            number: player.number || "",
            imageUrl: player.imageUrl || "",
            position,
            viewStatus,
          };
        }),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load team reports" });
    }
  });

  app.post("/api/player/views", requireAuth, async (req, res) => {
    try {
      const parsed = playerSlideViewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { playerId, slideIndex } = parsed.data;
      const allowed = await storage.userHasScoutingReportAssignment(req.user!.id, playerId);
      if (!allowed) {
        return res.status(403).json({ error: "Not assigned to this report" });
      }
      await storage.recordPlayerReportSlideView(req.user!.id, playerId, slideIndex);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to record view" });
    }
  });

  // ── Share scouting report with a player (coach) ──────────────────────────
  app.post("/api/report-assignments", requireAuth, async (req, res) => {
    try {
      const parsed = reportAssignmentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { userId, playerId } = parsed.data;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const created = await storage.createScoutingReportAssignment({
        userId,
        playerId,
        createdBy: req.user!.id,
      });
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  // ── Invitations (link-based join) ────────────────────────────────────────
  app.post("/api/invitations", requireAuth, async (req, res) => {
    try {
      const parsed = createInvitationBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { teamId, role } = parsed.data;
      const team = await storage.getTeam(teamId);
      if (!team) return res.status(404).json({ error: "Team not found" });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await storage.createInvitation({
        teamId,
        role,
        createdBy: req.user!.id,
        expiresAt,
      });

      const base = publicAppOrigin(req);
      const link = `${base}/join/${invitation.token}`;
      res.status(201).json({ invitation, link });
    } catch (err) {
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const token = req.params.token as string;
      const inv = await storage.getInvitationByToken(token);
      if (!inv) return res.status(404).json({ error: "Invalid invitation" });
      const team = await storage.getTeam(inv.teamId);
      if (!team) return res.status(404).json({ error: "Team not found" });
      const now = new Date();
      const expired = inv.expiresAt < now;
      const used = Boolean(inv.usedBy);
      res.json({
        team: { id: team.id, name: team.name, logo: team.logo },
        role: inv.role,
        expiresAt: inv.expiresAt.toISOString(),
        expired,
        used,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load invitation" });
    }
  });

  app.post("/api/invitations/:token/accept", requireAuth, async (req, res) => {
    try {
      const token = req.params.token as string;
      const inv = await storage.getInvitationByToken(token);
      if (!inv) return res.status(404).json({ error: "Invalid invitation" });
      if (inv.usedBy) {
        return res.status(409).json({ error: "Invitation already used" });
      }
      const now = new Date();
      if (inv.expiresAt < now) {
        return res.status(410).json({ error: "Invitation expired" });
      }

      const userId = req.user!.id;
      const existing = await storage.getTeamMember(userId, inv.teamId);
      if (!existing) {
        await storage.upsertTeamMember({
          userId,
          teamId: inv.teamId,
          role: inv.role,
          jerseyNumber: "",
          position: "",
          displayName: "",
        });
      }
      await storage.markInvitationUsed(inv.id, userId);

      res.json({ ok: true, teamId: inv.teamId, role: inv.role });
    } catch (err) {
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // ── My Club ──────────────────────────────────────────────────────────────
  app.get("/api/club", requireAuth, async (req, res) => {
    try {
      const uid = req.user!.id;
      const appRole = req.user!.role;
      let club = await storage.getClubForUser(uid);
      if (!club && (appRole === "head_coach" || appRole === "master")) {
        club = await storage.createClub({
          name: "My Club",
          logo: "🏀",
          ownerId: uid,
        });
        const u = req.user!;
        const initialDisplay =
          u.fullName?.trim() ||
          (u.email?.includes("@") ? u.email.split("@")[0] : u.email?.trim()) ||
          "";
        await storage.createClubMember({
          clubId: club.id,
          userId: uid,
          role: "head_coach",
          displayName: initialDisplay,
          jerseyNumber: "",
          position: "",
          status: "active",
          joinedAt: new Date(),
        });
      }
      if (!club) {
        const latest = await storage.getLatestClubMemberByUser(uid);
        if (latest?.status === "banned") {
          return res.status(403).json({ error: "banned" });
        }
        return res.status(404).json({ error: "No club found. Ask your head coach for an invite." });
      }

      const members = await storage.listClubMembers(club.id);
      const invs = await storage.listActiveClubInvitations(club.id);
      const base = publicAppOrigin(req);
      const authByUserId = await lookupAuthBasicsByUserIds(members.map((m) => m.userId));

      res.json({
        club: {
          id: club.id,
          name: club.name,
          logo: club.logo,
          ownerId: club.ownerId,
          createdAt: club.createdAt.toISOString(),
          leagueType: club.leagueType ?? null,
          gender: club.gender ?? null,
          level: club.level ?? null,
          ageCategory: club.ageCategory ?? null,
        },
        members: members.map((m) => {
          const fromAdmin = authByUserId.get(m.userId) ?? { fullName: null, email: null };
          const auth = mergeAuthWithSession(m.userId, req.user!, fromAdmin);
          return {
            id: m.id,
            clubId: m.clubId,
            userId: m.userId,
            role: m.role,
            displayName: m.displayName,
            jerseyNumber: m.jerseyNumber,
            position: m.position,
            operationsAccess: Boolean(m.operationsAccess),
            status: m.status,
            invitedEmail: m.invitedEmail,
            joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
            createdAt: m.createdAt.toISOString(),
            authFullName: auth.fullName,
            authEmail: auth.email,
          };
        }),
        pendingInvitations: invs.map((i) => ({
          id: i.id,
          clubId: i.clubId,
          role: i.role,
          token: i.token,
          invitedEmail: i.invitedEmail,
          createdBy: i.createdBy,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
          link: `${base}/join-club/${i.token}`,
        })),
      });
    } catch (err) {
      console.error("GET /api/club failed", err);
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Failed to load club", detail: msg });
    }
  });

  app.patch("/api/club/members/:id/operations-access", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const parsed = z
        .object({ operationsAccess: z.boolean() })
        .safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
      }
      const member = await storage.getClubMemberById(id);
      if (!member) return res.status(404).json({ error: "Member not found" });
      if (!(await userCanManageClub(req, member.clubId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (member.role !== "coach") {
        return res.status(400).json({ error: "Operations access can only be set for coaches" });
      }
      const updated = await storage.updateClubMemberOperationsAccess(id, parsed.data.operationsAccess);
      if (!updated) return res.status(500).json({ error: "Update failed" });
      return res.status(200).json({ ok: true, member: updated });
    } catch (err) {
      // include a tiny debug hint in dev; still safe for prod
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "Failed to update operations access", detail: msg });
    }
  });

  app.patch("/api/club", requireAuth, async (req, res) => {
    try {
      const parsed = patchClubBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const uid = req.user!.id;
      const appRole = req.user!.role;
      const club = await storage.getClubForUser(uid);
      if (!club) return res.status(404).json({ error: "Club not found" });
      if (club.ownerId !== uid && appRole !== "master") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const updates = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined),
      ) as Record<string, unknown>;
      if (Object.keys(updates).length === 0) {
        return res.json({
          id: club.id,
          name: club.name,
          logo: club.logo,
          ownerId: club.ownerId,
          createdAt: club.createdAt.toISOString(),
          leagueType: club.leagueType ?? null,
          gender: club.gender ?? null,
          level: club.level ?? null,
          ageCategory: club.ageCategory ?? null,
        });
      }
      const updated = await storage.updateClub(
        club.id,
        updates as Partial<Pick<Club, "name" | "logo" | "leagueType" | "gender" | "level" | "ageCategory">>,
      );
      if (!updated) return res.status(404).json({ error: "Club not found" });
      res.json({
        id: updated.id,
        name: updated.name,
        logo: updated.logo,
        ownerId: updated.ownerId,
        createdAt: updated.createdAt.toISOString(),
        leagueType: updated.leagueType ?? null,
        gender: updated.gender ?? null,
        level: updated.level ?? null,
        ageCategory: updated.ageCategory ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to update club" });
    }
  });

  app.post("/api/club/invite", requireAuth, async (req, res) => {
    try {
      const parsed = clubInviteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { role, email } = parsed.data;
      const uid = req.user!.id;
      const club = await storage.getClubForUser(uid);
      if (!club) return res.status(404).json({ error: "Club not found" });
      if (!(await userCanManageClub(req, club.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await storage.createClubInvitation({
        clubId: club.id,
        role,
        createdBy: uid,
        expiresAt,
        invitedEmail: email && email.length > 0 ? email : null,
      });

      const base = publicAppOrigin(req);
      const link = `${base}/join-club/${invitation.token}`;

      const admin = getSupabaseAdmin();
      if (email && email.length > 0 && admin) {
        try {
          await admin.auth.admin.inviteUserByEmail(email, {
            data: {
              role,
              club_invitation_token: invitation.token,
            },
            redirectTo: link,
          });
        } catch (e) {
          console.error("inviteUserByEmail failed:", e);
        }
      }

      res.status(201).json({ token: invitation.token, link });
    } catch (err) {
      res.status(500).json({ error: "Failed to create club invitation" });
    }
  });

  app.post("/api/club/invitations/:token/accept", requireAuth, async (req, res) => {
    try {
      const token = req.params.token as string;
      const inv = await storage.getClubInvitationByToken(token);
      if (!inv) return res.status(404).json({ error: "Invalid invitation" });
      if (inv.usedBy) return res.status(409).json({ error: "Invitation already used" });
      const now = new Date();
      if (inv.expiresAt < now) return res.status(410).json({ error: "Invitation expired" });

      const userId = req.user!.id;
      const email = req.user!.email || "";

      const existing = await storage.getClubMemberByClubAndUser(inv.clubId, userId);
      if (!existing) {
        await storage.createClubMember({
          clubId: inv.clubId,
          userId,
          role: inv.role,
          displayName: email.split("@")[0] || "",
          jerseyNumber: "",
          position: "",
          status: "active",
          invitedEmail: inv.invitedEmail,
          joinedAt: new Date(),
        });
      }
      await storage.markClubInvitationUsed(inv.id, userId);

      res.json({ ok: true, clubId: inv.clubId, role: inv.role });
    } catch (err) {
      res.status(500).json({ error: "Failed to accept club invitation" });
    }
  });

  app.delete("/api/club/members/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const member = await storage.getClubMemberById(id);
      if (!member) return res.status(404).json({ error: "Member not found" });
      if (!(await userCanManageClub(req, member.clubId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const club = await storage.getClubById(member.clubId);
      if (club && club.ownerId === member.userId && member.role === "head_coach") {
        return res.status(400).json({ error: "Cannot remove club owner" });
      }
      await storage.deleteClubMember(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.patch("/api/club/members/:id/ban", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const member = await storage.getClubMemberById(id);
      if (!member) return res.status(404).json({ error: "Member not found" });
      if (!(await userCanManageClub(req, member.clubId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const club = await storage.getClubById(member.clubId);
      if (club && club.ownerId === member.userId) {
        return res.status(400).json({ error: "Cannot ban club owner" });
      }
      const updated = await storage.updateClubMemberStatus(id, "banned");
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to ban member" });
    }
  });

  app.patch("/api/club/members/:id/unban", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const member = await storage.getClubMemberById(id);
      if (!member) return res.status(404).json({ error: "Member not found" });
      if (!(await userCanManageClub(req, member.clubId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const updated = await storage.updateClubMemberStatus(id, "active");
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to unban member" });
    }
  });

  app.get("/api/club/stats", requireAuth, async (req, res) => {
    try {
      const uid = req.user!.id;
      const club = await storage.getClubForUser(uid);
      if (!club) return res.status(404).json({ error: "Club not found" });
      if (!(await userCanManageClub(req, club.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const members = await storage.listClubMembers(club.id);
      const players = members.filter((m) => m.role === "player");
      const coaches = members.filter((m) => m.role === "coach" || m.role === "head_coach");

      const assignMap = await storage.getAssignmentStatsForUsers(players.map((p) => p.userId));
      const createMap = await storage.getPlayerCountsByCreator(coaches.map((c) => c.userId));
      const statsUserIds = Array.from(
        new Set([...players.map((p) => p.userId), ...coaches.map((c) => c.userId)]),
      );
      const authByUserId = await lookupAuthBasicsByUserIds(statsUserIds);

      res.json({
        players: players.map((m) => {
          const s = assignMap.get(m.userId) ?? { count: 0, lastAt: null };
          const fromAdmin = authByUserId.get(m.userId) ?? { fullName: null, email: null };
          const auth = mergeAuthWithSession(m.userId, req.user!, fromAdmin);
          return {
            memberId: m.id,
            userId: m.userId,
            displayName: m.displayName,
            authFullName: auth.fullName,
            authEmail: auth.email,
            invitedEmail: m.invitedEmail,
            reportsAssigned: s.count,
            lastSeen: s.lastAt ? s.lastAt.toISOString() : null,
          };
        }),
        coaches: coaches.map((m) => {
          const fromAdmin = authByUserId.get(m.userId) ?? { fullName: null, email: null };
          const auth = mergeAuthWithSession(m.userId, req.user!, fromAdmin);
          return {
            memberId: m.id,
            userId: m.userId,
            displayName: m.displayName,
            authFullName: auth.fullName,
            authEmail: auth.email,
            invitedEmail: m.invitedEmail,
            role: m.role,
            playersScouted: createMap.get(m.userId) ?? 0,
          };
        }),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load stats" });
    }
  });

  app.delete("/api/club/invitations/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const inv = await storage.getClubInvitationById(id);
      if (!inv) return res.status(404).json({ error: "Invitation not found" });
      if (!(await userCanManageClub(req, inv.clubId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteClubInvitation(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  });

  app.delete("/api/invitations/:id", requireAuth, async (req, res) => {
    try {
      if (!isHeadCoachOrMaster(req)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const id = req.params.id as string;
      const inv = await storage.getInvitationById(id);
      if (!inv) return res.status(404).json({ error: "Invitation not found" });
      if (!(await canManageTeam(req, inv.teamId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteInvitation(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  });

  return httpServer;
}
