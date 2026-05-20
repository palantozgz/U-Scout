import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { insertTeamSchema, insertPlayerSchema, type Club } from "@shared/schema";
import { patchClubBodySchema } from "@shared/club-context";
import { requireAuth } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { lookupAuthBasicsByUserIds, mergeAuthWithSession } from "./authUserLookup";
import { registerStatsIngest } from "./stats-ingest";

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

  app.get("/api/teams", requireAuth, async (req, res) => {
    try {
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const rows = await db.execute(sql`
        SELECT
          id,
          name,
          name_en,
          logo,
          primary_color,
          is_system,
          club_id,
          primary_color AS "primaryColor",
          is_system AS "isSystem",
          club_id AS "clubId",
          name_en AS "nameEn"
        FROM teams
        WHERE club_id = ${club.id}
        ORDER BY name ASC
      `);
      return res.json((rows as any).rows ?? []);
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
      // Attach club_id so the team is scoped to this club
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });

      // Use raw SQL to include club_id (not in Drizzle schema)
      const rows = await db.execute(
        sql`INSERT INTO teams (id, name, logo, primary_color, club_id, is_system)
            VALUES (gen_random_uuid()::text, ${parsed.data.name}, ${parsed.data.logo ?? "🏀"}, ${parsed.data.primaryColor ?? "bg-orange-500"}, ${club.id}, false)
            RETURNING *`,
      );
      const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
      res.status(201).json(arr[0]);
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

  app.get("/api/teams/:id/delete-info", requireAuth, async (req, res) => {
    try {
      const teamId = req.params.id as string;
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const teamPlayers = await storage.getPlayers(teamId, club.id);
      const publishedCount = teamPlayers.filter((p: any) => p.published).length;
      res.json({
        playerCount: teamPlayers.length,
        publishedCount,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load team info" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      if (!isHeadCoachOrMaster(req)) {
        return res.status(403).json({ error: "Only head_coach or master can delete teams" });
      }
      const teamId = req.params.id as string;
      const action = (req.query.action as string) ?? "move"; // "move" | "delete"

      // Find all players in this team
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const teamPlayers = await storage.getPlayers(teamId, club.id);

      if (action === "delete") {
        // Unpublish and delete all players in the team
        for (const p of teamPlayers) {
          if ((p as any).published) {
            await storage.unpublishPlayerReport(p.id);
          }
          await storage.deletePlayer(p.id);
        }
      } else {
        // "move": move players to Free Agents team
        const allTeams = await storage.getTeams(club.id);
        const freeAgents = allTeams.find((t: any) => t.isSystem || t.is_system);
        if (freeAgents) {
          for (const p of teamPlayers) {
            await db.execute(
              sql`UPDATE players SET team_id = ${freeAgents.id} WHERE id = ${p.id}`
            );
          }
        }
      }

      await storage.deleteTeam(teamId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  app.get("/api/players", requireAuth, async (req, res) => {
    try {
      const teamId = req.query.teamId as string | undefined;
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const result = await storage.getPlayers(teamId, club.id, req.user!.id);
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

      const role = req.user!.role;
      if (role === "player") {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (role === "coach") {
        const existingPlayer = await storage.getPlayer(req.params.id as string);
        if (!existingPlayer) return res.status(404).json({ error: "Player not found" });
        const isOwner = (existingPlayer as any).createdByUserId === req.user!.id ||
                        (existingPlayer as any).created_by_user_id === req.user!.id;
        if (!isOwner) {
          const club = await storage.getClubForUser(req.user!.id);
          const membership = club
            ? await storage.getClubMemberByClubAndUser(club.id, req.user!.id)
            : null;
          const hasOpsAccess = Boolean(membership?.operationsAccess);
          if (!hasOpsAccess) {
            return res.status(403).json({ error: "Cannot edit another coach's player" });
          }
        }
      }

      const player = await storage.updatePlayer((req.params.id as string), parsed.data);
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to update player" });
    }
  });

  app.get("/api/players/:id/delete-info", requireAuth, async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id as string);
      if (!player) return res.status(404).json({ error: "Not found" });
      res.json({
        published: Boolean((player as any).published),
        isCanonical: Boolean((player as any).is_canonical),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load player info" });
    }
  });

  app.delete("/api/players/:id", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      // Auto-unpublish if published
      const playerToDelete = await storage.getPlayer(playerId);
      if (playerToDelete && (playerToDelete as any).published) {
        await storage.unpublishPlayerReport(playerId);
      }
      await storage.deletePlayer(playerId);
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

  app.get("/api/players/:id/overrides", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const rows = await storage.listReportOverridesForPlayer(playerId);
      const mine = rows
        .filter((o) => o.coachId === req.user!.id)
        .map((o) => ({
          coachId: o.coachId,
          slide: o.slide,
          itemKey: o.itemKey,
          action: o.action,
        }));
      res.json(mine);
    } catch (err) {
      res.status(500).json({ error: "Failed to load overrides" });
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
      const role = req.user!.role;
      if (role !== "head_coach" && role !== "master") {
        return res.status(403).json({ error: "Only head_coach or master can retire reports" });
      }
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      // Unpublish from players table
      await storage.unpublishPlayerReport(playerId);
      // Clear all scout versions and approvals so every coach starts fresh in MyScout
      await storage.mergeAndClearScoutVersions(playerId);
      res.status(204).send();
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
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      // Verify player belongs to this club by checking if the player's team belongs to the club.
      const playerTeam = (player as any).teamId
        ? (await storage.getTeams(club.id)).find((t: any) => t.id === (player as any).teamId)
        : null;
      if (!playerTeam) {
        return res.status(403).json({ error: "Player does not belong to your club" });
      }
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

  app.get("/api/players/:id/scout-version/me", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const coachId = req.user!.id;
      const version = await storage.getScoutVersion(playerId, coachId);
      const submitted = Boolean(version && version.status !== "draft");
      res.json({ submitted });
    } catch (err) {
      res.status(500).json({ error: "Failed to check scout version" });
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
      let version = await storage.getScoutVersion(playerId, coachId);
      if (!version) {
        // Auto-create a scout version from the player's current inputs so the
        // coach can submit even if PlayerEditor autosave hasn't fired yet.
        const inp = (player as any).scoutingInputs ?? (player as any).inputs ?? {};
        version = await storage.upsertScoutVersion(playerId, coachId, inp);
      }
      await storage.submitScoutVersion(playerId, coachId);
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

  // Film Room: list all canonical players with submitted scout versions
  app.get("/api/film-room", requireAuth, async (req, res) => {
    try {
      const coachId = req.user!.id;

      const club = await storage.getClubForUser(coachId);
      if (!club) return res.status(404).json({ error: "Club not found" });

      // Get all canonical players
      const allPlayers = await storage.getPlayers(undefined, club.id);
      const canonicalPlayers = allPlayers.filter((p: any) => p.is_canonical);

      // For each canonical player, get all submitted versions
      const filmRoomData = await Promise.all(
        canonicalPlayers.map(async (player: any) => {
          const versions = await storage.listScoutVersionsForPlayer(player.id);
          const submitted = versions.filter((v) => v.status === "submitted" || v.status === "merged");
          const myVersion = versions.find((v) => v.coachId === coachId);
          const hasSubmittedMine = myVersion && myVersion.status !== "draft";

          // Get approval status for discrepancy/publish info (same logic as /approval-status)
          let approvalStatus: {
            approvals: Array<{ coachId: string; approvedAt: string }>;
            isPublished: boolean;
            hasDiscrepancy: boolean;
          } | null = null;
          try {
            const approvalRows = await storage.listReportApprovalsForPlayer(player.id);
            const overrideRows = await storage.listReportOverridesForPlayer(player.id);
            const overrides = overrideRows.map((o) => ({
              coachId: o.coachId,
              slide: o.slide,
              itemKey: o.itemKey,
              action: o.action,
            }));
            approvalStatus = {
              approvals: approvalRows.map((a) => ({
                coachId: a.coachId,
                approvedAt: a.approvedAt.toISOString(),
              })),
              isPublished: Boolean(player.published),
              hasDiscrepancy: computeHasDiscrepancy(overrides),
            };
          } catch {}

          return {
            player,
            submittedCount: submitted.length,
            totalVersions: versions.length,
            hasSubmittedMine: !!hasSubmittedMine,
            isPublished: approvalStatus?.isPublished ?? false,
            hasDiscrepancy: approvalStatus?.hasDiscrepancy ?? false,
            approvalCount: approvalStatus?.approvals?.length ?? 0,
          };
        })
      );

      // Only return players where at least 1 version has been submitted
      const withSubmissions = filmRoomData.filter((d) => d.submittedCount > 0);
      res.json({ players: withSubmissions });
    } catch (err) {
      console.error("film-room error:", err);
      res.status(500).json({ error: "Failed to load Film Room data" });
    }
  });

  // Film Room: publish player to Game Plan (merge + clear versions)
  app.post("/api/players/:id/game-plan", requireAuth, async (req, res) => {
    try {
      const playerId = req.params.id as string;
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      // Publish via existing flow
      await storage.publishPlayerReport(playerId, req.user!.id);
      // Clear scout versions (merge complete)
      await storage.mergeAndClearScoutVersions(playerId);

      // Auto-assign report to all active club players
      const club = await storage.getClubForUser(req.user!.id);
      if (club) {
        const members = await storage.listClubMembers(club.id);
        const activePlayers = members.filter((m) => m.role === "player" && m.status === "active");
        await Promise.all(
          activePlayers.map(async (m) => {
            try {
              await storage.createScoutingReportAssignmentIfNotExists({
                userId: m.userId,
                playerId,
                createdBy: req.user!.id,
              });
            } catch {
              // ignore per-user failures (e.g., unique constraint)
            }
          }),
        );
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to publish to Game Plan" });
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
      const now = new Date();
      if (inv.expiresAt < now) {
        return res.status(410).json({ error: "Invitation expired" });
      }

      const userId = req.user!.id;
      const claimed = await storage.markInvitationUsedIfUnused(inv.id, userId);
      if (!claimed) return res.status(409).json({ error: "Invitation already used" });
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
      const now = new Date();
      if (inv.expiresAt < now) return res.status(410).json({ error: "Invitation expired" });

      const userId = req.user!.id;
      const email = req.user!.email || "";

      const claimed = await storage.markClubInvitationUsedIfUnused(inv.id, userId);
      if (!claimed) return res.status(409).json({ error: "Invitation already used" });
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

  // ── League matches ────────────────────────────────────────────────────────
  app.get("/api/club/matches", requireAuth, async (req, res) => {
    try {
      const uid = req.user!.id;
      const club = await storage.getClubForUser(uid);
      if (!club) return res.status(404).json({ error: "Club not found" });
      const matches = await storage.listLeagueMatches(club.id);
      res.json(matches.map(m => ({
        id: m.id,
        rivalName: m.rivalName,
        matchDate: m.matchDate.toISOString(),
        location: m.location,
        matchType: m.matchType,
      })));
    } catch (err) {
      res.status(500).json({ error: "Failed to load matches" });
    }
  });

  app.post("/api/club/matches", requireAuth, async (req, res) => {
    try {
      const uid = req.user!.id;
      const club = await storage.getClubForUser(uid);
      if (!club) return res.status(404).json({ error: "Club not found" });
      if (!(await userCanManageClub(req, club.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { rivalName, matchDate, location, matchType } = req.body;
      if (!rivalName || !matchDate) return res.status(400).json({ error: "rivalName and matchDate required" });
      const match = await storage.createLeagueMatch({
        clubId: club.id,
        rivalName,
        matchDate: new Date(matchDate),
        location: location ?? undefined,
        matchType: matchType ?? "league",
      });
      res.status(201).json({
        id: match.id,
        rivalName: match.rivalName,
        matchDate: match.matchDate.toISOString(),
        location: match.location,
        matchType: match.matchType,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to create match" });
    }
  });

  app.delete("/api/club/matches/:id", requireAuth, async (req, res) => {
    try {
      const uid = req.user!.id;
      const club = await storage.getClubForUser(uid);
      if (!club) return res.status(404).json({ error: "Club not found" });
      if (!(await userCanManageClub(req, club.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteLeagueMatch(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete match" });
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

  // Game log for player name (club)

  registerStatsIngest(app);

  app.get("/api/stats/teams", requireAuth, async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT st.external_id as id, st.name_zh as name,
             st.name_en as "nameEn",
             st.updated_at as "updatedAt",
             '2025-26' as season
      FROM stats_teams st
      ORDER BY st.name_zh ASC
    `);
    return res.json({ teams: (rows as any).rows ?? [] });
  });

  // ─── POST /api/stats/import-team ─────────────────────────────────────────
  app.post("/api/stats/import-team", requireAuth, async (req, res) => {
    const { statsTeamExternalId, targetTeamId, coachUserId } = req.body;
    if (!statsTeamExternalId || !targetTeamId || !coachUserId) {
      return res.status(400).json({ error: "statsTeamExternalId, targetTeamId, coachUserId required" });
    }

    // Resolve internal stats_teams id
    const teamRow = await db.execute(
      sql`SELECT id FROM stats_teams WHERE external_id = ${Number(statsTeamExternalId)} LIMIT 1`
    );
    const statsTeamId = (teamRow as any).rows?.[0]?.id;
    if (!statsTeamId) return res.status(404).json({ error: "Stats team not found" });

    // Fetch players from stats_players
    const playersRow = await db.execute(
      sql`SELECT external_id, name_zh, name_en, jersey_number, position, photo_url
          FROM stats_players WHERE team_id = ${statsTeamId}
          ORDER BY jersey_number ASC NULLS LAST`
    );
    const statPlayers: any[] = (playersRow as any).rows ?? [];
    if (statPlayers.length === 0) return res.status(404).json({ error: "No players found for this team" });

    // Check existing canonical players in target team to avoid duplicates
    const existingRow = await db.execute(
      sql`SELECT name FROM players WHERE team_id = ${targetTeamId} AND is_canonical = true`
    );
    const existingNames = new Set((existingRow as any).rows?.map((r: any) => r.name) ?? []);

    const defaultInputs = {};
    const defaultModel = {};
    const defaultPlan = {};

    let created = 0;
    let skipped = 0;
    for (const p of statPlayers) {
      // Prefer name_en (pinyin/romanized) for EN/ES locales; name_zh as fallback
      const name = (p.name_en && p.name_en.trim()) ? p.name_en.trim() : (p.name_zh ?? "Unknown");
      if (existingNames.has(name)) { skipped++; continue; }
      await db.execute(sql`
        INSERT INTO players (
          team_id, name, number, image_url,
          inputs, internal_model, archetype, key_traits, defensive_plan,
          created_by_user_id, published, is_canonical
        ) VALUES (
          ${targetTeamId}, ${name}, ${p.jersey_number ?? ""}, ${p.photo_url ?? ""},
          ${JSON.stringify(defaultInputs)}::jsonb,
          ${JSON.stringify(defaultModel)}::jsonb,
          ${"Role Player"},
          ${"{}"}::text[],
          ${JSON.stringify(defaultPlan)}::jsonb,
          ${coachUserId}, false, true
        )
      `);
      created++;
    }

    return res.json({ ok: true, created, skipped, total: statPlayers.length });
  });

  // ─── POST /api/stats/import-league ─────────────────────────────────────────
  app.post("/api/stats/import-league", requireAuth, async (req, res) => {
    try {
      const { coachUserId } = req.body ?? {};
      if (!coachUserId || typeof coachUserId !== "string") {
        return res.status(400).json({ error: "coachUserId required" });
      }

      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });

      const statsTeamsRes = await db.execute(sql`
        SELECT id, external_id, name_zh, name_en, logo_url FROM stats_teams ORDER BY name_zh ASC
      `);
      const statsTeams: {
        id: number;
        external_id: unknown;
        name_zh: string;
        name_en: string | null;
        logo_url: string | null;
      }[] = (statsTeamsRes as any).rows ?? [];

      let teamsCreated = 0;
      let teamsExisted = 0;
      let playersCreated = 0;
      let playersSkipped = 0;

      const defaultInputs = {};
      const defaultModel = {};
      const defaultPlan = {};

      for (const st of statsTeams) {
        const teamNameZh = st.name_zh ?? "";
        const teamName = (st.name_en ?? "").trim() || teamNameZh;
        const existingTeam = await db.execute(sql`
          SELECT id FROM teams
          WHERE club_id = ${club.id}
            AND (name = ${teamNameZh} OR name = ${teamName})
            AND (is_system IS NULL OR is_system = false)
          LIMIT 1
        `);
        const existingId = (existingTeam as any).rows?.[0]?.id as string | undefined;

        let localTeamId: string;
        if (existingId) {
          localTeamId = existingId;
          teamsExisted++;
          await db.execute(sql`UPDATE teams SET name_en = ${teamName} WHERE id = ${existingId}`);
        } else {
          const ins = await db.execute(sql`
            INSERT INTO teams (name, name_en, logo, primary_color, club_id)
            VALUES (${teamNameZh}, ${teamName}, ${st.logo_url || "🏀"}, ${"bg-orange-500"}, ${club.id})
            RETURNING id
          `);
          const newId = (ins as any).rows?.[0]?.id as string | undefined;
          if (!newId) continue;
          localTeamId = newId;
          teamsCreated++;
        }

        const statsTeamInternalId = st.id;
        const playersRow = await db.execute(
          sql`SELECT name_en, name_zh, jersey_number, photo_url
              FROM stats_players WHERE team_id = ${statsTeamInternalId}`,
        );
        const statPlayers: any[] = (playersRow as any).rows ?? [];

        const existingRow = await db.execute(
          sql`SELECT name, name_en FROM players WHERE team_id = ${localTeamId} AND is_canonical = true`,
        );
        const existingNames = new Set<string>();
        for (const r of (existingRow as any).rows ?? []) {
          const n = r.name != null ? String(r.name).trim() : "";
          const ne = r.name_en != null ? String(r.name_en).trim() : "";
          if (n) existingNames.add(n);
          if (ne) existingNames.add(ne);
        }

        const seen = new Set<string>(existingNames);
        const newPlayers: typeof statPlayers = [];
        for (const p of statPlayers) {
          const nameZh =
            String(p.name_zh ?? "").trim() || String(p.name_en ?? "").trim();
          const nameEn = String(p.name_en ?? "").trim() || nameZh;
          if (seen.has(nameZh) || seen.has(nameEn)) {
            playersSkipped++;
            continue;
          }
          seen.add(nameZh);
          seen.add(nameEn);
          newPlayers.push(p);
        }
        if (newPlayers.length === 0) continue;

        const values = newPlayers.map((p) => {
          const nameZh =
            String(p.name_zh ?? "").trim() || String(p.name_en ?? "").trim();
          const nameEn = String(p.name_en ?? "").trim() || nameZh;
          return sql`(
            ${localTeamId}, ${nameZh}, ${nameEn}, ${String(p.jersey_number ?? "")}, ${p.photo_url ?? ""},
            ${JSON.stringify(defaultInputs)}::jsonb,
            ${JSON.stringify(defaultModel)}::jsonb,
            ${"Role Player"},
            ${"{}"}::text[],
            ${JSON.stringify(defaultPlan)}::jsonb,
            ${coachUserId}, false, true
          )`;
        });

        await db.execute(sql`
          INSERT INTO players (
            team_id, name, name_en, number, image_url,
            inputs, internal_model, archetype, key_traits, defensive_plan,
            created_by_user_id, published, is_canonical
          ) VALUES ${sql.join(values, sql`, `)}
          ON CONFLICT DO NOTHING
        `);
        playersCreated += newPlayers.length;
      }

      return res.json({ teamsCreated, teamsExisted, playersCreated, playersSkipped });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to import league" });
    }
  });

  // ─── DELETE /api/personnel/reset ───────────────────────────────────────────
  app.delete("/api/personnel/reset", requireAuth, async (req, res) => {
    try {
      if (!isHeadCoachOrMaster(req)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const club = await storage.getClubForUser(req.user!.id);
      if (!club) return res.status(404).json({ error: "Club not found" });

      const delPlayers = await db.execute(sql`
        DELETE FROM players WHERE team_id IN (
          SELECT id FROM teams WHERE club_id = ${club.id} AND (is_system IS NULL OR is_system = false)
        )
      `);
      const playersDeleted =
        (delPlayers as any).rowCount ?? (delPlayers as any).rows?.length ?? 0;

      const delTeams = await db.execute(sql`
        DELETE FROM teams WHERE club_id = ${club.id} AND (is_system IS NULL OR is_system = false)
      `);
      const teamsDeleted = (delTeams as any).rowCount ?? (delTeams as any).rows?.length ?? 0;

      return res.json({ ok: true, playersDeleted, teamsDeleted });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to reset personnel" });
    }
  });

  // ─── GET /api/stats/players — promedios temporada desde player_boxscores ────
  app.get("/api/stats/players", requireAuth, async (_req, res) => {
    let rows;
    try {
      rows = await db.execute(sql`
      SELECT
        sp.external_id                                AS "externalId",
        sp.name_zh                                    AS "playerName",
        sp.name_en                                    AS "playerNameEn",
        sp.position                                   AS "position",
        sp.photo_url                                  AS "photoUrl",
        st.name_zh                                    AS "teamName",
        st.name_en                                    AS "teamNameEn",
        '2025-26'                                     AS season,
        COUNT(DISTINCT pb.game_id)::int               AS games,
        ROUND(AVG(
          CASE WHEN pb.minutes ~ '^\d+:\d{2}$'
            THEN (SPLIT_PART(pb.minutes, ':', 1)::numeric * 60 + SPLIT_PART(pb.minutes, ':', 2)::numeric) / 60
            ELSE NULL END
        )::numeric, 1)                                AS mpg,
        ROUND(AVG(pb.pts)::numeric, 1)                AS ppg,
        ROUND(AVG(pb.reb)::numeric, 1)                AS rpg,
        ROUND(AVG(pb.ast)::numeric, 1)                AS apg,
        ROUND(AVG(pb.stl)::numeric, 1)                AS spg,
        ROUND(AVG(pb.blk)::numeric, 1)                AS bpg,
        ROUND(AVG(pb.tov)::numeric, 1)                AS topg,
        CASE WHEN SUM(pb.fga) > 0
          THEN ROUND((SUM(pb.fgm)::float / SUM(pb.fga) * 100)::numeric, 1)
          ELSE NULL END                               AS "fgPct",
        CASE WHEN SUM(pb.tpa) > 0
          THEN ROUND((SUM(pb.tpm)::float / SUM(pb.tpa) * 100)::numeric, 1)
          ELSE NULL END                               AS "fg3Pct",
        CASE WHEN SUM(pb.fta) > 0
          THEN ROUND((SUM(pb.ftm)::float / SUM(pb.fta) * 100)::numeric, 1)
          ELSE NULL END                               AS "ftPct"
      FROM stats_player_boxscores pb
      JOIN stats_games sg ON sg.id = pb.game_id
      JOIN stats_players sp ON sp.external_id = pb.player_external_id
      LEFT JOIN stats_teams st ON st.external_id::text = sp.team_id::text
      WHERE sg.status = 4
      GROUP BY sp.external_id, sp.name_zh, sp.name_en, sp.position, sp.photo_url, st.name_zh, st.name_en
      HAVING COUNT(DISTINCT pb.game_id) > 0
      ORDER BY ppg DESC
    `);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to load player stats" });
    }
    const players = ((rows as any).rows ?? []).map((r: any) => ({
      externalId: String(r.externalId ?? ""),
      playerName: String(r.playerName ?? ""),
      playerNameEn: r.playerNameEn ?? null,
      position: r.position ?? null,
      photoUrl: r.photoUrl ?? null,
      teamName: r.teamName ?? null,
      teamNameEn: r.teamNameEn ?? null,
      season: String(r.season ?? ""),
      games: Number(r.games ?? 0),
      mpg: Number(r.mpg ?? 0),
      ppg: Number(r.ppg ?? 0),
      rpg: Number(r.rpg ?? 0),
      apg: Number(r.apg ?? 0),
      spg: Number(r.spg ?? 0),
      bpg: Number(r.bpg ?? 0),
      topg: Number(r.topg ?? 0),
      fgPct: r.fgPct != null ? Number(r.fgPct) : null,
      fg3Pct: r.fg3Pct != null ? Number(r.fg3Pct) : null,
      ftPct: r.ftPct != null ? Number(r.ftPct) : null,
    }));
    return res.json({ players });
  });

  // ─── GET /api/stats/games — game log por jugadora ─────────────────────────
  app.get("/api/stats/games", requireAuth, async (req, res) => {
    const playerName = String(req.query.playerName ?? "").trim();
    if (!playerName) return res.json({ games: [] });

    const rows = await db.execute(sql`
      SELECT
        pb.id::text                                   AS id,
        sp.name_zh                                    AS "playerName",
        st.name_zh                                    AS "teamName",
        '2025-26'                                     AS season,
        sg.scheduled_at::date                         AS "gameDate",
        rival.name_zh                                 AS "rivalName",
        pb.minutes                                    AS minutes,
        pb.pts                                        AS points,
        pb.reb                                        AS "reboundsTotal",
        pb.ast                                        AS assists,
        pb.stl                                        AS steals,
        pb.blk                                        AS blocks,
        pb.tov                                        AS turnovers,
        pb.plus_minus                                 AS "plusMinus"
      FROM stats_player_boxscores pb
      JOIN stats_games sg ON sg.id = pb.game_id
      JOIN stats_players sp ON sp.external_id = pb.player_external_id
      LEFT JOIN stats_teams st ON st.external_id::text = sp.team_id::text
      LEFT JOIN stats_teams rival ON rival.id = (
        CASE
          WHEN pb.team_type = 'Home' THEN sg.away_team_id
          ELSE sg.home_team_id
        END
      )
      WHERE (sp.name_zh = ${playerName} OR sp.name_en = ${playerName})
        AND sg.status = 4
      ORDER BY sg.scheduled_at DESC
      LIMIT 50
    `);
    const games = (rows as any).rows ?? [];
    return res.json({ games });
  });

  // GET /api/stats/standings
  app.get("/api/stats/standings", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    try {
      const rows = await db.execute(sql`
        SELECT
          st.external_id          AS "teamExternalId",
          st.name_zh              AS "teamName",
          st.name_en              AS "teamNameEn",
          st.logo_url             AS "logoUrl",
          ss.rank,
          ss.wins,
          ss.losses,
          ss.win_pct              AS "winPct",
          ss.pts_per_game         AS "ppg",
          ss.pts_against_per_game AS "oppg",
          ss.phase_name           AS "phaseName",
          ss.streak,
          ROUND(
            CASE WHEN SUM(pb.fga) > 0
              THEN (SUM(pb.fgm) + 0.5 * SUM(pb.tpm))::numeric / SUM(pb.fga) * 100
            END, 1
          ) AS "eFGPct"
        FROM stats_standings ss
        JOIN stats_teams st ON st.external_id = ss.team_external_id
        LEFT JOIN stats_player_boxscores pb
          ON pb.team_external_id = st.external_id::text
        LEFT JOIN stats_games sg
          ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        WHERE ss.season_id = ${seasonId}
        GROUP BY
          st.external_id, st.name_zh, st.name_en, st.logo_url,
          ss.rank, ss.wins, ss.losses, ss.win_pct,
          ss.pts_per_game, ss.pts_against_per_game, ss.phase_name, ss.streak
        ORDER BY ss.rank ASC
      `);
      return res.json({ standings: (rows as any).rows ?? [] });
    } catch (err) {
      console.error("[stats/standings] DB error:", (err as any)?.message ?? err);
      return res.json({ standings: [] });
    }
  });

  // GET /api/stats/leaders
  app.get("/api/stats/leaders", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const stat = String(req.query.stat ?? "ppg");
    const allowedStats: Record<string, string> = {
      ppg: "AVG(pb.pts)",
      rpg: "AVG(pb.reb)",
      apg: "AVG(pb.ast)",
      spg: "AVG(pb.stl)",
      bpg: "AVG(pb.blk)",
      topg: "AVG(pb.tov)",
      fgPct:
        "(CASE WHEN SUM(pb.fga) > 0 THEN (SUM(pb.fgm)::float / SUM(pb.fga) * 100) ELSE NULL END)",
      tsPct:
        "(CASE WHEN (SUM(pb.fga) + 0.44 * SUM(pb.fta)) > 0 THEN SUM(pb.pts)::float / (2 * (SUM(pb.fga) + 0.44 * SUM(pb.fta))) * 100 ELSE NULL END)",
      eFGPct:
        "(CASE WHEN SUM(pb.fga) > 0 THEN (SUM(pb.fgm) + 0.5 * SUM(pb.tpm))::float / SUM(pb.fga) * 100 ELSE NULL END)",
      astTovRatio: "(CASE WHEN SUM(pb.tov) > 0 THEN SUM(pb.ast)::float / SUM(pb.tov) ELSE NULL END)",
      orbPerGame: "AVG(pb.off_reb)",
    };
    const statExpr = allowedStats[stat] ?? allowedStats["ppg"];
    try {
      const rows = await db.execute(sql`
        SELECT
          sp.external_id     AS "externalId",
          sp.name_zh         AS "playerName",
          sp.name_en         AS "playerNameEn",
          st.name_zh         AS "teamName",
          ROUND(${sql.raw(statExpr)}::numeric, 1) AS value,
          COUNT(DISTINCT pb.game_id)::int AS games
        FROM stats_player_boxscores pb
        JOIN stats_games sg ON sg.id = pb.game_id
        JOIN stats_players sp ON sp.external_id = pb.player_external_id
        LEFT JOIN stats_teams st ON st.external_id::text = sp.team_id::text
        WHERE sg.status = 4 AND sg.season_id = ${seasonId}
        GROUP BY sp.external_id, sp.name_zh, sp.name_en, st.name_zh
        HAVING COUNT(DISTINCT pb.game_id) >= 5
        ORDER BY value DESC NULLS LAST
        LIMIT 15
      `);
      return res.json({ leaders: (rows as any).rows ?? [], stat });
    } catch (err) {
      console.error("[stats/leaders] DB error:", (err as any)?.message ?? err);
      return res.json({ leaders: [], stat });
    }
  });

  // ─── GET /api/stats/player-link ─────────────────────────────────────────────
  app.get("/api/stats/player-link", requireAuth, async (req, res) => {
    const name = String(req.query.name ?? "").trim();
    if (!name) return res.json({ externalId: null });

    const rows = await db.execute(sql`
      SELECT
        sp.external_id AS "externalId",
        ROUND(AVG(pb.pts)::numeric, 1)  AS ppg,
        ROUND(AVG(pb.reb)::numeric, 1)  AS rpg,
        ROUND(AVG(pb.ast)::numeric, 1)  AS apg
      FROM stats_players sp
      LEFT JOIN stats_player_boxscores pb ON pb.player_external_id = sp.external_id
      LEFT JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4
      WHERE sp.name_zh = ${name} OR sp.name_en = ${name}
      GROUP BY sp.external_id
      LIMIT 1
    `);
    const row = (rows as any).rows?.[0];
    if (!row) return res.json({ externalId: null });
    return res.json({
      externalId: row.externalId,
      ppg: Number(row.ppg ?? 0),
      rpg: Number(row.rpg ?? 0),
      apg: Number(row.apg ?? 0),
    });
  });

  // ─── GET /api/stats/seasons ──────────────────────────────────────────────────
  app.get("/api/stats/seasons", requireAuth, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT DISTINCT season_id AS "seasonId"
        FROM stats_games
        WHERE status = 4 AND season_id IS NOT NULL
        ORDER BY season_id DESC
      `);
      const seasons = ((rows as any).rows ?? []).map((r: any) => ({
        seasonId: r.seasonId,
        label: r.seasonId === 2092 ? "2025-26" : String(r.seasonId),
      }));
      return res.json({ seasons });
    } catch (err) {
      console.error("[stats/seasons] DB error:", (err as any)?.message ?? err);
      return res.json({ seasons: [] });
    }
  });

  // ─── GET /api/stats/player/:externalId ──────────────────────────────────────
  app.get("/api/stats/player/:externalId", requireAuth, async (req, res) => {
    try {
    const { externalId } = req.params;
    const seasonId = Number(req.query.seasonId ?? 2092);

    const playerRows = await db.execute(sql`
      SELECT
        sp.external_id       AS "externalId",
        sp.name_zh           AS "nameZh",
        sp.name_en           AS "nameEn",
        sp.jersey_number     AS "jerseyNumber",
        sp.photo_url         AS "photoUrl",
        sp.position,
        st.name_zh           AS "teamName",
        st.name_en           AS "teamNameEn",
        st.logo_url          AS "teamLogo",
        st.external_id::text AS "teamExternalId",
        COUNT(pb.id)         AS games,
        ROUND(AVG(pb.pts)::numeric, 1)                                         AS ppg,
        ROUND(AVG(pb.reb)::numeric, 1)                                         AS rpg,
        ROUND(AVG(pb.ast)::numeric, 1)                                         AS apg,
        ROUND(AVG(pb.stl)::numeric, 1)                                         AS spg,
        ROUND(AVG(pb.blk)::numeric, 1)                                         AS bpg,
        ROUND(AVG(pb.tov)::numeric, 1)                                         AS topg,
        ROUND(AVG(
          CASE WHEN pb.minutes ~ '^\d+:\d{2}$'
            THEN (SPLIT_PART(pb.minutes, ':', 1)::numeric * 60 + SPLIT_PART(pb.minutes, ':', 2)::numeric) / 60
            ELSE NULL END
        )::numeric, 1) AS mpg,
        ROUND(
          CASE WHEN SUM(pb.fga) > 0
            THEN SUM(pb.fgm)::numeric / SUM(pb.fga) * 100 END, 1)             AS "fgPct",
        ROUND(
          CASE WHEN SUM(pb.tpa) > 0
            THEN SUM(pb.tpm)::numeric / SUM(pb.tpa) * 100 END, 1)             AS "fg3Pct",
        ROUND(
          CASE WHEN SUM(pb.fta) > 0
            THEN SUM(pb.ftm)::numeric / SUM(pb.fta) * 100 END, 1)             AS "ftPct",
        ROUND(
          CASE WHEN (SUM(pb.fga) + 0.44 * SUM(pb.fta)) > 0
            THEN SUM(pb.pts)::numeric / (2 * (SUM(pb.fga) + 0.44 * SUM(pb.fta))) * 100
          END, 1
        ) AS "tsPct",
        ROUND(
          CASE WHEN SUM(pb.fga) > 0
            THEN (SUM(pb.fgm) + 0.5 * SUM(pb.tpm))::numeric / SUM(pb.fga) * 100
          END, 1
        ) AS "eFGPct",
        ROUND(
          CASE WHEN SUM(pb.tov) > 0
            THEN SUM(pb.ast)::numeric / SUM(pb.tov)
          END, 2
        ) AS "astTovRatio",
        ROUND(
          CASE WHEN SUM(pb.fga) > 0
            THEN SUM(pb.fta)::numeric / SUM(pb.fga)
          END, 3
        ) AS "ftRate",
        ROUND(AVG(pb.off_reb)::numeric, 1) AS "orbPerGame",
        ROUND(AVG(pb.def_reb)::numeric, 1) AS "drbPerGame"
      FROM stats_players sp
      LEFT JOIN stats_teams st ON st.id = sp.team_id
      LEFT JOIN stats_player_boxscores pb ON pb.player_external_id = sp.external_id
      LEFT JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4
      WHERE sp.external_id::text = ${externalId}
      GROUP BY sp.external_id, sp.name_zh, sp.name_en,
               sp.jersey_number, sp.photo_url, sp.position, st.name_zh, st.name_en, st.logo_url, st.external_id
      LIMIT 1
    `);
    const player = (playerRows as any).rows?.[0];
    if (!player) return res.status(404).json({ error: "Player not found" });

    let pieRow: number | null = null;
    try {
      const pieRows = await db.execute(sql`
        WITH pie_games AS (
          SELECT
            pb.game_id,
            (pb.pts + pb.fgm + pb.ftm - pb.fga - pb.fta
             + pb.def_reb + 0.5 * pb.off_reb
             + pb.ast + pb.stl + 0.5 * pb.blk - pb.fouls - pb.tov
            ) AS player_num,
            gm_totals.game_den
          FROM stats_player_boxscores pb
          JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
          JOIN (
            SELECT
              game_id,
              SUM(pts + fgm + ftm - fga - fta
                  + def_reb + 0.5 * off_reb
                  + ast + stl + 0.5 * blk - fouls - tov
              ) AS game_den
            FROM stats_player_boxscores
            GROUP BY game_id
          ) gm_totals ON gm_totals.game_id = pb.game_id
          WHERE pb.player_external_id::text = ${externalId}
          AND gm_totals.game_den > 0
        )
        SELECT ROUND(AVG(100.0 * player_num / game_den)::numeric, 1) AS pie
        FROM pie_games
      `);
      pieRow = (pieRows as any).rows?.[0]?.pie != null ? Number((pieRows as any).rows[0].pie) : null;
    } catch (pieErr: any) {
      console.error("[player-detail] PIE query failed:", pieErr?.message ?? pieErr);
    }

    let usgPct: number | null = null;
    try {
      const usgRows = await db.execute(sql`
        WITH player_ref AS (
          SELECT sp.external_id, sp.team_id
          FROM stats_players sp
          WHERE sp.external_id::text = ${externalId}
          LIMIT 1
        ),
        player_games AS (
          SELECT
            pb.game_id,
            pb.fga, pb.fta, pb.tov,
            (SPLIT_PART(pb.minutes,':',1)::int * 60 + SPLIT_PART(pb.minutes,':',2)::int) AS min_sec
          FROM stats_player_boxscores pb
          JOIN player_ref pr ON pb.player_external_id = pr.external_id::text
          JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
          WHERE SPLIT_PART(pb.minutes,':',1) ~ '^[0-9]+$'
        ),
        team_games AS (
          SELECT
            pb2.game_id,
            SUM(pb2.fga) AS tm_fga,
            SUM(pb2.fta) AS tm_fta,
            SUM(pb2.tov) AS tm_tov,
            SUM(SPLIT_PART(pb2.minutes,':',1)::int * 60 + SPLIT_PART(pb2.minutes,':',2)::int) AS tm_min_sec
          FROM stats_player_boxscores pb2
          JOIN player_ref pr ON pb2.team_external_id = (
            SELECT st.external_id::text FROM stats_teams st WHERE st.id = pr.team_id LIMIT 1
          )
          JOIN stats_games sg2 ON sg2.id = pb2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
          WHERE SPLIT_PART(pb2.minutes,':',1) ~ '^[0-9]+$'
          GROUP BY pb2.game_id
        ),
        usg_calc AS (
          SELECT
            ROUND(
              100.0 * SUM((pg.fga + 0.44 * pg.fta + pg.tov) * (tg.tm_min_sec / 5.0))
              / NULLIF(SUM(pg.min_sec * (tg.tm_fga + 0.44 * tg.tm_fta + tg.tm_tov)), 0)
            , 1) AS usg_pct
          FROM player_games pg
          JOIN team_games tg ON tg.game_id = pg.game_id
          WHERE pg.min_sec > 0
        )
        SELECT usg_pct FROM usg_calc
      `);
      const usgRow = (usgRows as any).rows?.[0];
      usgPct = usgRow?.usg_pct != null ? Number(usgRow.usg_pct) : null;
    } catch (usgErr: any) {
      console.error("[player-detail] USG% query failed:", usgErr?.message ?? usgErr);
    }

    const splitRows = await db.execute(sql`
      SELECT
        ROUND(AVG(CASE WHEN pb.team_external_id = sg.home_team_id::text THEN pb.pts END)::numeric, 1) AS "ptsHome",
        ROUND(AVG(CASE WHEN pb.team_external_id != sg.home_team_id::text THEN pb.pts END)::numeric, 1) AS "ptsAway",
        ROUND(AVG(CASE WHEN pb.team_external_id = sg.home_team_id::text THEN pb.reb END)::numeric, 1) AS "rebHome",
        ROUND(AVG(CASE WHEN pb.team_external_id != sg.home_team_id::text THEN pb.reb END)::numeric, 1) AS "rebAway",
        ROUND(AVG(CASE WHEN pb.team_external_id = sg.home_team_id::text THEN pb.ast END)::numeric, 1) AS "astHome",
        ROUND(AVG(CASE WHEN pb.team_external_id != sg.home_team_id::text THEN pb.ast END)::numeric, 1) AS "astAway"
      FROM stats_player_boxscores pb
      JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4
      WHERE pb.player_external_id::text = ${externalId}
    `);
    const splitRow = (splitRows as any).rows?.[0] ?? {};

    const logRows = await db.execute(sql`
      SELECT
        sg.external_game_id  AS "gameId",
        sg.scheduled_at      AS "gameDate",
        CASE WHEN sg.home_team_id = sp2.team_id THEN at.name_zh ELSE ht.name_zh END AS "rivalName",
        CASE WHEN sg.home_team_id = sp2.team_id THEN at.name_en ELSE ht.name_en END AS "rivalNameEn",
        CASE WHEN sg.home_team_id = sp2.team_id THEN sg.home_score || '-' || sg.away_score ELSE sg.away_score || '-' || sg.home_score END AS "score",
        pb.minutes,
        pb.pts, pb.reb, pb.ast, pb.stl, pb.blk, pb.tov,
        pb.fgm, pb.fga, pb.tpm, pb.tpa, pb.ftm, pb.fta,
        pb.plus_minus        AS "plusMinus",
        pb.is_start_lineup   AS "isStart",
        (sg.home_team_id = sp2.team_id) AS "isHome"
      FROM stats_player_boxscores pb
      JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4
      JOIN stats_players sp2 ON sp2.external_id = pb.player_external_id
      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id
      LEFT JOIN stats_teams at ON at.id = sg.away_team_id
      WHERE pb.player_external_id::text = ${externalId}
      ORDER BY sg.scheduled_at DESC
      LIMIT 30
    `);
    const gameLog = ((logRows as any).rows ?? []).map((r: any) => ({
      gameId: r.gameId,
      gameDate: r.gameDate,
      rivalName: r.rivalName,
      rivalNameEn: r.rivalNameEn ?? null,
      score: r.score,
      minutes: r.minutes,
      pts: Number(r.pts ?? 0),
      reb: Number(r.reb ?? 0),
      ast: Number(r.ast ?? 0),
      stl: Number(r.stl ?? 0),
      blk: Number(r.blk ?? 0),
      tov: Number(r.tov ?? 0),
      fgm: Number(r.fgm ?? 0),
      fga: Number(r.fga ?? 0),
      tpm: Number(r.tpm ?? 0),
      tpa: Number(r.tpa ?? 0),
      ftm: Number(r.ftm ?? 0),
      fta: Number(r.fta ?? 0),
      plusMinus: Number(r.plusMinus ?? 0),
      isStart: Boolean(r.isStart),
      isHome: Boolean(r.isHome),
    }));

    return res.json({
      player: {
        externalId: player.externalId,
        nameZh: player.nameZh,
        nameEn: player.nameEn,
        jerseyNumber: player.jerseyNumber,
        photoUrl: player.photoUrl ?? null,
        position: player.position,
        teamName: player.teamName,
        teamNameEn: player.teamNameEn ?? null,
        teamLogo: player.teamLogo,
        teamExternalId: player.teamExternalId != null ? String(player.teamExternalId) : null,
        games: Number(player.games ?? 0),
        ppg: Number(player.ppg ?? 0),
        rpg: Number(player.rpg ?? 0),
        apg: Number(player.apg ?? 0),
        spg: Number(player.spg ?? 0),
        bpg: Number(player.bpg ?? 0),
        topg: Number(player.topg ?? 0),
        mpg: Number(player.mpg ?? 0),
        fgPct: player.fgPct != null ? Number(player.fgPct) : null,
        fg3Pct: player.fg3Pct != null ? Number(player.fg3Pct) : null,
        ftPct: player.ftPct != null ? Number(player.ftPct) : null,
        tsPct: player.tsPct != null ? Number(player.tsPct) : null,
        eFGPct: player.eFGPct != null ? Number(player.eFGPct) : null,
        astTovRatio: player.astTovRatio != null ? Number(player.astTovRatio) : null,
        ftRate: player.ftRate != null ? Number(player.ftRate) : null,
        usagePct: usgPct,
        orbPerGame: player.orbPerGame != null ? Number(player.orbPerGame) : null,
        drbPerGame: player.drbPerGame != null ? Number(player.drbPerGame) : null,
        pie: pieRow != null ? Number(pieRow) : null,
        homeSplit: {
          pts: Number(splitRow.ptsHome ?? 0),
          reb: Number(splitRow.rebHome ?? 0),
          ast: Number(splitRow.astHome ?? 0),
        },
        awaySplit: {
          pts: Number(splitRow.ptsAway ?? 0),
          reb: Number(splitRow.rebAway ?? 0),
          ast: Number(splitRow.astAway ?? 0),
        },
      },
      gameLog,
    });
    } catch (err: any) {
      console.error("[player-detail] Error:", err?.message ?? err);
      return res.status(500).json({ error: "Failed to load player", detail: err?.message });
    }
  });

  // ─── GET /api/stats/sync-status ─────────────────────────────────────────────
  app.get("/api/stats/sync-status", async (req, res) => {
    // Auth: STATS_INGEST_KEY (same as ingest endpoint, called by collector)
    const key = process.env.STATS_INGEST_KEY;
    if (key) {
      const auth = req.headers.authorization ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (token !== key) return res.status(401).json({ error: "Unauthorized" });
    }

    const pbpRows = await db.execute(sql`
      SELECT DISTINCT sg.external_game_id
      FROM stats_pbp p
      JOIN stats_games sg ON sg.id = p.game_id
    `);
    const boxRows = await db.execute(sql`
      SELECT DISTINCT sg.external_game_id
      FROM stats_player_boxscores pb
      JOIN stats_games sg ON sg.id = pb.game_id
    `);

    const pbpDone = ((pbpRows as any).rows ?? []).map((r: any) => Number(r.external_game_id));
    const boxDone = ((boxRows as any).rows ?? []).map((r: any) => Number(r.external_game_id));

    return res.json({ pbpDone, boxDone });
  });

  // ─── GET /api/stats/team/:externalId ─────────────────────────────────────────
  app.get("/api/stats/team/:externalId", requireAuth, async (req, res) => {
    const { externalId } = req.params;
    const seasonId = Number(req.query.seasonId ?? 2092);

    const teamRow = await db.execute(sql`
      SELECT
        st.external_id   AS "externalId",
        st.name_zh       AS "nameZh",
        st.name_en       AS "nameEn",
        st.logo_url      AS "logoUrl",
        ss.wins,
        ss.losses,
        ss.pts_per_game          AS ppg,
        ss.pts_against_per_game  AS oppg,
        ss.rank,
        ss.win_pct               AS "winPct",
        ss.streak,
        ss.last10_wins           AS "last10W",
        ss.last10_losses         AS "last10L",
        ss.home_wins             AS "homeW",
        ss.home_losses           AS "homeL",
        ss.away_wins             AS "awayW",
        ss.away_losses           AS "awayL",
        (SELECT ROUND(SUM(pb_fg.fgm)::numeric / NULLIF(SUM(pb_fg.fga), 0) * 100, 1)
         FROM stats_player_boxscores pb_fg
         JOIN stats_games sg ON sg.id = pb_fg.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
         WHERE pb_fg.team_external_id = st.external_id::text) AS "teamFgPct",
        adv."eFGPct",
        adv."tovPct",
        adv."ftRate"
      FROM stats_teams st
      LEFT JOIN stats_standings ss
        ON ss.team_external_id = st.external_id AND ss.season_id = ${seasonId}
      LEFT JOIN LATERAL (
        SELECT
          ROUND((SUM(pb2.fgm) + 0.5 * SUM(pb2.tpm))::numeric / NULLIF(SUM(pb2.fga), 0) * 100, 1) AS "eFGPct",
          ROUND(SUM(pb2.tov)::numeric / NULLIF(SUM(pb2.fga) + 0.44 * SUM(pb2.fta) + SUM(pb2.tov), 0) * 100, 1) AS "tovPct",
          ROUND(SUM(pb2.fta)::numeric / NULLIF(SUM(pb2.fga), 0), 3) AS "ftRate"
        FROM stats_player_boxscores pb2
        JOIN stats_games sg2 ON sg2.id = pb2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
        WHERE pb2.team_external_id = st.external_id::text
      ) adv ON true
      WHERE st.external_id = ${Number(externalId)}
      LIMIT 1
    `);
    const team = (teamRow as any).rows?.[0];
    if (!team) return res.status(404).json({ error: "Team not found" });

    let orbPct: number | null = team.orbPct != null ? Number(team.orbPct) : null;
    let drbPct: number | null = team.drbPct != null ? Number(team.drbPct) : null;
    try {
      const rebRows = await db.execute(sql`
        WITH team_ref AS (
          SELECT id, external_id::text AS ext_id
          FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1
        ),
        own_reb AS (
          SELECT
            SUM(pb.off_reb) AS orb,
            SUM(pb.def_reb) AS drb
          FROM stats_player_boxscores pb
          JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
          WHERE pb.team_external_id = (SELECT ext_id FROM team_ref)
        ),
        rival_reb AS (
          SELECT
            SUM(pb2.off_reb) AS rival_orb,
            SUM(pb2.def_reb) AS rival_drb
          FROM stats_player_boxscores pb2
          JOIN stats_games sg2 ON sg2.id = pb2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
          WHERE pb2.team_external_id != (SELECT ext_id FROM team_ref)
          AND sg2.id IN (
            SELECT sg3.id FROM stats_games sg3
            WHERE (sg3.home_team_id = (SELECT id FROM team_ref)
                OR sg3.away_team_id = (SELECT id FROM team_ref))
            AND sg3.status = 4 AND sg3.season_id = ${seasonId}
          )
        )
        SELECT
          ROUND(100.0 * own_reb.orb / NULLIF(own_reb.orb + rival_reb.rival_drb, 0), 1) AS orb_pct,
          ROUND(100.0 * own_reb.drb / NULLIF(own_reb.drb + rival_reb.rival_orb, 0), 1) AS drb_pct
        FROM own_reb, rival_reb
      `);
      const reb = (rebRows as any).rows?.[0] ?? {};
      orbPct = reb.orb_pct != null ? Number(reb.orb_pct) : null;
      drbPct = reb.drb_pct != null ? Number(reb.drb_pct) : null;
    } catch (rebErr: any) {
      console.error("[stats/team] ORB%/DRB% query failed:", rebErr?.message ?? rebErr);
    }

    const playersRow = await db.execute(sql`
      SELECT
        sp.external_id                                AS "externalId",
        sp.name_zh                                    AS "nameZh",
        sp.name_en                                    AS "nameEn",
        sp.jersey_number                              AS "jerseyNumber",
        sp.position,
        COUNT(DISTINCT pb.game_id)::int               AS games,
        ROUND(AVG(pb.pts)::numeric, 1)                AS ppg,
        ROUND(AVG(pb.reb)::numeric, 1)                AS rpg,
        ROUND(AVG(pb.ast)::numeric, 1)                AS apg
      FROM stats_players sp
      LEFT JOIN stats_player_boxscores pb ON pb.player_external_id = sp.external_id
      LEFT JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
      WHERE sp.team_id = (SELECT id FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1)
      GROUP BY sp.external_id, sp.name_zh, sp.name_en, sp.jersey_number, sp.position
      ORDER BY ppg DESC NULLS LAST
    `);
    const players = ((playersRow as any).rows ?? []).map((p: any) => ({
      externalId: p.externalId,
      nameZh: p.nameZh,
      nameEn: p.nameEn,
      jerseyNumber: p.jerseyNumber,
      position: p.position,
      games: Number(p.games ?? 0),
      ppg: Number(p.ppg ?? 0),
      rpg: Number(p.rpg ?? 0),
      apg: Number(p.apg ?? 0),
    }));

    // ── ORTG / DRTG / PPP / pointsByZone ────────────────────────────────────
    let ortg: number | null = null;
    let drtg: number | null = null;
    let netRtg: number | null = null;
    let pppOf: number | null = null;
    let pppDef: number | null = null;
    let paceEst: number | null = team.paceEst != null ? Number(team.paceEst) : null;
    let pointsByZone: { paint: number; mid: number; fg3: number; ft: number } | null = null;
    try {
      const rtgRow = await db.execute(sql`
      WITH team_ref AS (
        SELECT id FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1
      ),
      team_games AS (
        SELECT
          sg.id AS game_id,
          CASE WHEN sg.home_team_id = tr.id THEN sg.home_score
               ELSE sg.away_score END AS team_pts,
          CASE WHEN sg.home_team_id = tr.id THEN sg.away_score
               ELSE sg.home_score END AS opp_pts
        FROM stats_games sg
        CROSS JOIN team_ref tr
        WHERE (sg.home_team_id = tr.id OR sg.away_team_id = tr.id)
          AND sg.status = 4 AND sg.season_id = ${seasonId}
      ),
      team_box AS (
        SELECT
          pb.game_id,
          SUM(pb.fga) AS fga, SUM(pb.fta) AS fta, SUM(pb.tov) AS tov,
          SUM(pb.off_reb) AS orb, SUM(pb.pts) AS pts,
          SUM(pb.fgm) AS fgm, SUM(pb.tpm) AS tpm, SUM(pb.ftm) AS ftm
        FROM stats_player_boxscores pb
        JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        WHERE pb.team_external_id = (SELECT external_id::text FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1)
        GROUP BY pb.game_id
      ),
      rival_box AS (
        SELECT
          pb.game_id,
          SUM(pb.fga) AS r_fga, SUM(pb.fta) AS r_fta,
          SUM(pb.tov) AS r_tov, SUM(pb.off_reb) AS r_orb
        FROM stats_player_boxscores pb
        JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        WHERE pb.team_external_id != (SELECT external_id::text FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1)
        AND pb.game_id IN (SELECT game_id FROM team_box)
        GROUP BY pb.game_id
      )
      SELECT
        ROUND(100.0 * SUM(tg.team_pts) / NULLIF(SUM(tb.fga + 0.44 * tb.fta + tb.tov - tb.orb), 0), 1) AS "ortg",
        ROUND(100.0 * SUM(tg.opp_pts) / NULLIF(SUM(rb.r_fga + 0.44 * rb.r_fta + rb.r_tov - rb.r_orb), 0), 1) AS "drtg",
        ROUND(SUM(tg.team_pts)::numeric / NULLIF(SUM(tb.fga + 0.44 * tb.fta + tb.tov - tb.orb), 0), 3) AS "pppOf",
        ROUND(SUM(tg.opp_pts)::numeric / NULLIF(SUM(rb.r_fga + 0.44 * rb.r_fta + rb.r_tov - rb.r_orb), 0), 3) AS "pppDef",
        ROUND(
          ((SUM(tb.fga + 0.44 * tb.fta + tb.tov - tb.orb) +
            SUM(rb.r_fga + 0.44 * rb.r_fta + rb.r_tov - rb.r_orb)) / 2.0)
          / NULLIF(COUNT(DISTINCT tb.game_id), 0)
        , 1) AS "paceEst",
        SUM(tb.fgm - tb.tpm) AS "paint2Fgm",
        SUM(tb.tpm)          AS "fg3m",
        SUM(tb.ftm)          AS "ftm",
        SUM(tb.pts)          AS "totalPts"
      FROM team_games tg
      JOIN team_box tb ON tb.game_id = tg.game_id
      JOIN rival_box rb ON rb.game_id = tb.game_id
    `);
      const rtg = (rtgRow as any).rows?.[0] ?? {};
      ortg   = rtg.ortg   != null ? Number(rtg.ortg)   : null;
      drtg   = rtg.drtg   != null ? Number(rtg.drtg)   : null;
      netRtg = ortg != null && drtg != null ? Number((ortg - drtg).toFixed(1)) : null;
      pppOf  = rtg.pppOf  != null ? Number(rtg.pppOf)  : null;
      pppDef = rtg.pppDef != null ? Number(rtg.pppDef) : null;
      paceEst = rtg.paceEst != null ? Number(rtg.paceEst) : null;
      const paint2Pts = rtg.paint2Fgm != null ? Number(rtg.paint2Fgm) * 2 : 0;
      const fg3Pts    = rtg.fg3m != null ? Number(rtg.fg3m) * 3 : 0;
      const ftPts     = rtg.ftm  != null ? Number(rtg.ftm)      : 0;
      const zTot      = paint2Pts + fg3Pts + ftPts || 1;
      if (rtg.totalPts != null) {
        pointsByZone = {
          paint: Math.round(paint2Pts * 0.70 / zTot * 100) / 100,
          mid:   Math.round(paint2Pts * 0.30 / zTot * 100) / 100,
          fg3:   Math.round(fg3Pts / zTot * 100) / 100,
          ft:    Math.round(ftPts   / zTot * 100) / 100,
        };
      }
    } catch (rtgErr: any) {
      console.error("[stats/team] ORTG/DRTG query failed:", rtgErr?.message ?? rtgErr);
    }

    // ── TEAM GAME LOG ────────────────────────────────────────────────────────
    const gameLogRow = await db.execute(sql`
      SELECT
        sg.id::text AS "gameId",
        sg.scheduled_at::text AS "date",
        (sg.home_team_id = tr.id) AS "isHome",
        CASE WHEN sg.home_team_id = tr.id THEN opp.external_id::text ELSE hm.external_id::text END AS "opponentId",
        CASE WHEN sg.home_team_id = tr.id
          THEN COALESCE(opp.name_zh, opp.name_en, 'Unknown')
          ELSE COALESCE(hm.name_zh, hm.name_en, 'Unknown') END AS "opponentName",
        CASE WHEN sg.home_team_id = tr.id
          THEN opp.name_en
          ELSE hm.name_en END AS "opponentNameEn",
        CASE WHEN sg.home_team_id = tr.id THEN sg.home_score ELSE sg.away_score END AS "teamScore",
        CASE WHEN sg.home_team_id = tr.id THEN sg.away_score ELSE sg.home_score END AS "oppScore"
      FROM stats_games sg
      CROSS JOIN (SELECT id FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1) tr
      LEFT JOIN stats_teams hm  ON hm.id  = sg.home_team_id
      LEFT JOIN stats_teams opp ON opp.id = sg.away_team_id
      WHERE (sg.home_team_id = tr.id OR sg.away_team_id = tr.id)
        AND sg.status = 4 AND sg.season_id = ${seasonId}
      ORDER BY sg.scheduled_at DESC NULLS LAST
      LIMIT 22
    `);
    const gameLog = ((gameLogRow as any).rows ?? []).map((g: any) => {
      const ts = Number(g.teamScore ?? 0), os = Number(g.oppScore ?? 0);
      return {
        gameId: String(g.gameId),
        date: String(g.date ?? ""),
        isHome: Boolean(g.isHome),
        opponentId: String(g.opponentId ?? ""),
        opponentName: String(g.opponentName ?? ""),
        opponentNameEn: g.opponentNameEn ? String(g.opponentNameEn) : null,
        teamScore: ts, oppScore: os,
        result: ts > os ? "W" : "L",
        margin: ts - os,
      };
    });

    const net =
      team.ppg != null && team.oppg != null
        ? Number((Number(team.ppg) - Number(team.oppg)).toFixed(1))
        : null;

    return res.json({
      team: {
        externalId: String(team.externalId),
        nameZh: team.nameZh,
        nameEn: team.nameEn ?? null,
        logoUrl: team.logoUrl,
        wins: Number(team.wins ?? 0),
        losses: Number(team.losses ?? 0),
        ppg: team.ppg != null ? Number(team.ppg) : null,
        oppg: team.oppg != null ? Number(team.oppg) : null,
        net,
        rank: Number(team.rank ?? 0),
        winPct: team.winPct != null ? Number(team.winPct) : null,
        streak: team.streak != null ? Number(team.streak) : null,
        last10W: team.last10W != null ? Number(team.last10W) : null,
        last10L: team.last10L != null ? Number(team.last10L) : null,
        homeW: team.homeW != null ? Number(team.homeW) : null,
        homeL: team.homeL != null ? Number(team.homeL) : null,
        awayW: team.awayW != null ? Number(team.awayW) : null,
        awayL: team.awayL != null ? Number(team.awayL) : null,
        teamFgPct: team.teamFgPct != null ? Number(team.teamFgPct) : null,
        eFGPct: team.eFGPct != null ? Number(team.eFGPct) : null,
        tovPct: team.tovPct != null ? Number(team.tovPct) : null,
        ftRate: team.ftRate != null ? Number(team.ftRate) : null,
        orbPct,
        drbPct,
        paceEst,
        ortg, drtg, netRtg, pppOf, pppDef, pointsByZone, gameLog,
      },
      players,
    });
  });

  app.get("/api/stats/league-averages", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const position = typeof req.query.position === "string" && req.query.position.trim()
      ? req.query.position.trim()
      : null;
    try {
      const rows = await db.execute(sql`
        WITH league_reb AS (
          SELECT
            pb.team_external_id,
            SUM(pb.off_reb) AS orb,
            SUM(pb.def_reb) AS drb,
            pb.game_id
          FROM stats_player_boxscores pb
          JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
          ${position ? sql`JOIN stats_players sp ON sp.external_id = pb.player_external_id AND sp.position = ${position}` : sql``}
          GROUP BY pb.team_external_id, pb.game_id
        ),
        orb_calc AS (
          SELECT
            a.team_external_id,
            SUM(a.orb) AS total_orb,
            SUM(b.drb) AS rival_drb,
            SUM(a.drb) AS total_drb,
            SUM(b.orb) AS rival_orb
          FROM league_reb a
          JOIN league_reb b ON b.game_id = a.game_id AND b.team_external_id != a.team_external_id
          GROUP BY a.team_external_id
        )
        SELECT
          ROUND(AVG(pb.pts)::numeric, 1)  AS "avgPpg",
          ROUND(AVG(pb.reb)::numeric, 1)  AS "avgRpg",
          ROUND(AVG(pb.ast)::numeric, 1)  AS "avgApg",
          ROUND(AVG(pb.stl)::numeric, 1)  AS "avgSpg",
          ROUND(AVG(pb.blk)::numeric, 1)  AS "avgBpg",
          ROUND(
            CASE WHEN SUM(pb.fga) > 0
              THEN SUM(pb.fgm)::numeric / SUM(pb.fga) * 100 END, 1
          ) AS "avgFgPct",
          ROUND(
            CASE WHEN SUM(pb.tpa) > 0
              THEN SUM(pb.tpm)::numeric / SUM(pb.tpa) * 100 END, 1
          ) AS "avgFg3Pct",
          ROUND(
            CASE WHEN SUM(pb.fga) > 0
              THEN (SUM(pb.fgm) + 0.5 * SUM(pb.tpm))::numeric / SUM(pb.fga) * 100 END, 1
          ) AS "avgEFGPct",
          ROUND(
            CASE WHEN (SUM(pb.fga) + 0.44 * SUM(pb.fta)) > 0
              THEN SUM(pb.pts)::numeric / (2 * (SUM(pb.fga) + 0.44 * SUM(pb.fta))) * 100 END, 1
          ) AS "avgTsPct",
          ROUND(
            CASE WHEN (SUM(pb.fga) + 0.44 * SUM(pb.fta) + SUM(pb.tov)) > 0
              THEN SUM(pb.tov)::numeric / (SUM(pb.fga) + 0.44 * SUM(pb.fta) + SUM(pb.tov)) * 100 END, 1
          ) AS "avgTovPct",
          ROUND(
            CASE WHEN SUM(pb.fga) > 0
              THEN SUM(pb.fta)::numeric / SUM(pb.fga) END, 3
          ) AS "avgFtRate",
          ROUND(
            100.0 * SUM(oc.total_orb) / NULLIF(SUM(oc.total_orb) + SUM(oc.rival_drb), 0), 1
          ) AS "avgOrbPct",
          ROUND(AVG(pb.off_reb)::numeric, 1) AS "avgOrbPerGame",
          ROUND(AVG(pb.def_reb)::numeric, 1) AS "avgDrbPerGame"
        FROM stats_player_boxscores pb
        JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        ${position ? sql`JOIN stats_players sp ON sp.external_id = pb.player_external_id AND sp.position = ${position}` : sql``}
        LEFT JOIN orb_calc oc ON oc.team_external_id = pb.team_external_id
      `);
      const row = (rows as any).rows?.[0] ?? {};
      return res.json({
        ppg: Number(row.avgPpg ?? 0),
        rpg: Number(row.avgRpg ?? 0),
        apg: Number(row.avgApg ?? 0),
        spg: Number(row.avgSpg ?? 0),
        bpg: Number(row.avgBpg ?? 0),
        fgPct: row.avgFgPct != null ? Number(row.avgFgPct) : null,
        fg3Pct: row.avgFg3Pct != null ? Number(row.avgFg3Pct) : null,
        eFGPct: row.avgEFGPct != null ? Number(row.avgEFGPct) : null,
        tsPct: row.avgTsPct != null ? Number(row.avgTsPct) : null,
        tovPct: row.avgTovPct != null ? Number(row.avgTovPct) : null,
        ftRate: row.avgFtRate != null ? Number(row.avgFtRate) : null,
        orbPct: row.avgOrbPct != null ? Number(row.avgOrbPct) : null,
        orbPerGame: row.avgOrbPerGame != null ? Number(row.avgOrbPerGame) : null,
        drbPerGame: row.avgDrbPerGame != null ? Number(row.avgDrbPerGame) : null,
      });
    } catch (err: any) {
      console.error("[stats/league-averages] error:", err?.message ?? err);
      return res.status(500).json({ error: "Failed to load league averages" });
    }
  });

  app.get("/api/stats/player-percentiles", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const positionPct = typeof req.query.position === "string" && req.query.position.trim()
      ? req.query.position.trim()
      : null;
    try {
      const rows = await db.execute(sql`
        WITH player_avgs AS (
          SELECT
            pb.player_external_id,
            AVG(pb.pts)  AS ppg,
            AVG(pb.reb)  AS rpg,
            AVG(pb.ast)  AS apg,
            AVG(pb.stl)  AS spg,
            AVG(pb.blk)  AS bpg,
            CASE WHEN (SUM(pb.fga) + 0.44 * SUM(pb.fta)) > 0
              THEN SUM(pb.pts)::float / (2 * (SUM(pb.fga) + 0.44 * SUM(pb.fta))) * 100
            END AS ts_pct,
            CASE WHEN SUM(pb.fga) > 0
              THEN (SUM(pb.fgm) + 0.5 * SUM(pb.tpm))::float / SUM(pb.fga) * 100
            END AS efg_pct,
          SUM(pb.tpa)::float / COUNT(DISTINCT pb.game_id) AS tpa_per_game
          FROM stats_player_boxscores pb
          JOIN stats_games sg ON sg.id = pb.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
          ${positionPct ? sql`JOIN stats_players sp ON sp.external_id = pb.player_external_id AND sp.position = ${positionPct}` : sql``}
          GROUP BY pb.player_external_id
          HAVING COUNT(DISTINCT pb.game_id) >= 5
        )
        SELECT
          percentile_cont(0.95) WITHIN GROUP (ORDER BY ppg)    AS "p95Ppg",
          percentile_cont(0.95) WITHIN GROUP (ORDER BY rpg)    AS "p95Rpg",
          percentile_cont(0.95) WITHIN GROUP (ORDER BY apg)    AS "p95Apg",
          percentile_cont(0.95) WITHIN GROUP (ORDER BY spg)    AS "p95Spg",
          percentile_cont(0.95) WITHIN GROUP (ORDER BY bpg)    AS "p95Bpg",
          percentile_cont(0.95) WITHIN GROUP (ORDER BY ts_pct) AS "p95TsPct",
          percentile_cont(0.95) WITHIN GROUP (ORDER BY efg_pct) AS "p95EFGPct",
          percentile_cont(0.20) WITHIN GROUP (ORDER BY tpa_per_game) FILTER (WHERE tpa_per_game > 0) AS "p20Tpa",
          percentile_cont(0.40) WITHIN GROUP (ORDER BY tpa_per_game) FILTER (WHERE tpa_per_game > 0) AS "p40Tpa",
          percentile_cont(0.50) WITHIN GROUP (ORDER BY tpa_per_game) FILTER (WHERE tpa_per_game > 0) AS "p50Tpa",
          percentile_cont(0.75) WITHIN GROUP (ORDER BY tpa_per_game) FILTER (WHERE tpa_per_game > 0) AS "p75Tpa",
          percentile_cont(0.90) WITHIN GROUP (ORDER BY tpa_per_game) FILTER (WHERE tpa_per_game > 0) AS "p90Tpa"
        FROM player_avgs
      `);
      const row = (rows as any).rows?.[0] ?? {};
      return res.json({
        p95Ppg: row.p95Ppg != null ? Number(row.p95Ppg) : 25,
        p95Rpg: row.p95Rpg != null ? Number(row.p95Rpg) : 12,
        p95Apg: row.p95Apg != null ? Number(row.p95Apg) : 7,
        p95Spg: row.p95Spg != null ? Number(row.p95Spg) : 3,
        p95Bpg: row.p95Bpg != null ? Number(row.p95Bpg) : 2.5,
        p95TsPct: row.p95TsPct != null ? Number(row.p95TsPct) : 65,
        p95EFGPct: row.p95EFGPct != null ? Number(row.p95EFGPct) : 60,
        p20Tpa: row.p20Tpa != null ? Number(row.p20Tpa) : 0.8,
        p40Tpa: row.p40Tpa != null ? Number(row.p40Tpa) : 1.5,
        p50Tpa: row.p50Tpa != null ? Number(row.p50Tpa) : 2.0,
        p75Tpa: row.p75Tpa != null ? Number(row.p75Tpa) : 3.5,
        p90Tpa: row.p90Tpa != null ? Number(row.p90Tpa) : 5.5,
      });
    } catch (err: any) {
      console.error("[stats/player-percentiles] error:", err?.message ?? err);
      return res.status(500).json({ error: "Failed to load percentiles" });
    }
  });

  return httpServer;
}
