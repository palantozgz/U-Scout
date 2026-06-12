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
import { processAllPendingPossessions, processPossessions } from "./possessions";

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
  // ─── Keepalive ping — Railway warm-up ───────────────────────────────────────
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

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

  // ─── GET /api/stats/players — promedios temporada desde pbp_player_game_stats ─
  app.get("/api/stats/players", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;
    let rows;
    try {
      rows = await db.execute(sql`
      SELECT
        pgs.player_external_id AS "externalId",
        sp.name_zh AS "nameZh",
        sp.name_en AS "nameEn",
        sp.position,
        sp.photo_url AS "photoUrl",
        st.name_zh AS "teamName",
        st.name_en AS "teamNameEn",
        st.external_id::text AS "teamExternalId",
        COUNT(DISTINCT pgs.game_id) AS games,
        ROUND(AVG(pgs.seconds_played / 60.0)::numeric, 1) AS mpg,
        ROUND(AVG(pgs.pts)::numeric, 1) AS ppg,
        ROUND(AVG(pgs.reb)::numeric, 1) AS rpg,
        ROUND(AVG(pgs.ast)::numeric, 1) AS apg,
        ROUND(AVG(pgs.stl)::numeric, 1) AS spg,
        ROUND(AVG(pgs.blk)::numeric, 1) AS bpg,
        ROUND(AVG(pgs.tov)::numeric, 1) AS topg,
        ROUND(CASE WHEN SUM(pgs.fga)>0 THEN SUM(pgs.fgm)::numeric/SUM(pgs.fga)*100 END, 1) AS "fgPct",
        ROUND(CASE WHEN SUM(pgs.fg3a)>0 THEN SUM(pgs.fg3m)::numeric/SUM(pgs.fg3a)*100 END, 1) AS "fg3Pct",
        ROUND(CASE WHEN SUM(pgs.fta)>0 THEN SUM(pgs.ftm)::numeric/SUM(pgs.fta)*100 END, 1) AS "ftPct",
        ROUND(CASE WHEN SUM(pgs.fga+0.44*pgs.fta)>0 THEN SUM(pgs.pts)::numeric/(2*(SUM(pgs.fga)+0.44*SUM(pgs.fta)))*100 END, 1) AS "tsPct",
        ROUND(CASE WHEN SUM(pgs.fga)>0 THEN (SUM(pgs.fgm)+0.5*SUM(pgs.fg3m))::numeric/SUM(pgs.fga)*100 END, 1) AS "eFGPct",
        ROUND(CASE WHEN SUM(pgs.tov)>0 THEN SUM(pgs.ast)::numeric/SUM(pgs.tov) END, 2) AS "astTovRatio",
        ROUND(CASE WHEN SUM(pgs.fga)>0 THEN SUM(pgs.fta)::numeric/SUM(pgs.fga) END, 3) AS "ftRate",
        ROUND(AVG(pgs.off_reb)::numeric, 1) AS "orbPerGame",
        ROUND(AVG(pgs.def_reb)::numeric, 1) AS "drbPerGame"
      FROM pbp_player_game_stats pgs
      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
      LEFT JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id
      LEFT JOIN stats_teams st ON st.id = pgs.team_id
      GROUP BY pgs.player_external_id, sp.name_zh, sp.name_en, sp.position, sp.photo_url, st.name_zh, st.name_en, st.external_id
      HAVING COUNT(DISTINCT pgs.game_id) >= 1
      ORDER BY AVG(pgs.pts) DESC NULLS LAST
    `);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to load player stats" });
    }
    const players = ((rows as any).rows ?? []).map((r: any) => ({
      externalId: String(r.externalId ?? ""),
      playerName: String(r.nameZh ?? ""),
      playerNameEn: r.nameEn ?? null,
      position: r.position ?? null,
      photoUrl: r.photoUrl ?? null,
      teamName: r.teamName ?? null,
      teamNameEn: r.teamNameEn ?? null,
      season: "2025-26",
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
      tsPct: r.tsPct != null ? Number(r.tsPct) : null,
      eFGPct: r.eFGPct != null ? Number(r.eFGPct) : null,
      astTovRatio: r.astTovRatio != null ? Number(r.astTovRatio) : null,
      ftRate: r.ftRate != null ? Number(r.ftRate) : null,
      orbPerGame: r.orbPerGame != null ? Number(r.orbPerGame) : null,
      drbPerGame: r.drbPerGame != null ? Number(r.drbPerGame) : null,
      usagePct: null,
      pie: null,
      homeSplit: { pts: 0, reb: 0, ast: 0 },
      awaySplit: { pts: 0, reb: 0, ast: 0 },
    }));
    res.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
    return res.json({ players });
  });

  // ─── GET /api/stats/games — game log por jugadora (pbp_player_game_stats) ─
  app.get("/api/stats/games", requireAuth, async (req, res) => {
    const playerName = String(req.query.playerName ?? "").trim();
    if (!playerName) return res.json({ games: [] });
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;

    const rows = await db.execute(sql`
      SELECT
        pgs.game_id::text                             AS id,
        sp.name_zh                                    AS "playerName",
        st.name_zh                                    AS "teamName",
        '2025-26'                                     AS season,
        sg.scheduled_at::date                         AS "gameDate",
        CASE WHEN own.id = sg.home_team_id THEN at.name_zh ELSE ht.name_zh END AS "rivalName",
        (FLOOR(pgs.seconds_played / 60)::int)::text || ':' ||
          LPAD((pgs.seconds_played % 60)::text, 2, '0') AS minutes,
        pgs.pts                                       AS points,
        pgs.reb                                       AS "reboundsTotal",
        pgs.ast                                       AS assists,
        pgs.stl                                       AS steals,
        pgs.blk                                       AS blocks,
        pgs.tov                                       AS turnovers,
        COALESCE(spb.plus_minus, pgs.plus_minus)      AS "plusMinus"
      FROM pbp_player_game_stats pgs
      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
      JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id
      LEFT JOIN stats_teams st ON st.id = pgs.team_id
      JOIN stats_teams own ON own.id = pgs.team_id
      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id
      LEFT JOIN stats_teams at ON at.id = sg.away_team_id
      LEFT JOIN stats_player_boxscores spb ON spb.game_id = pgs.game_id AND spb.player_external_id::text = pgs.player_external_id
      WHERE (sp.name_zh = ${playerName} OR sp.name_en = ${playerName})
      ORDER BY sg.scheduled_at DESC
      LIMIT 50
    `);
    const games = (rows as any).rows ?? [];
    return res.json({ games });
  });

  // GET /api/stats/standings
  app.get("/api/stats/standings", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;
    const phaseFilterPP = phaseType === "all" ? sql`` : sql`AND pp.phase_type = ${phaseType}`;
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
          (SELECT ROUND(SUM(pp.points)::numeric / NULLIF(COUNT(DISTINCT pp.game_id), 0), 1)
           FROM pbp_possessions pp
           JOIN stats_games sg2 ON sg2.id = pp.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
           WHERE pp.team_id = st.id ${phaseFilterPP}
          ) AS "ppg",
          (SELECT ROUND(SUM(pp.points)::numeric / NULLIF(COUNT(DISTINCT pp.game_id), 0), 1)
           FROM pbp_possessions pp
           JOIN stats_games sg2 ON sg2.id = pp.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
           WHERE pp.team_id != st.id ${phaseFilterPP}
             AND sg2.id IN (
               SELECT sg3.id FROM stats_games sg3
               WHERE (sg3.home_team_id = st.id OR sg3.away_team_id = st.id)
               AND sg3.status = 4 AND sg3.season_id = ${seasonId}
             )
          ) AS "oppg",
          ss.phase_name           AS "phaseName",
          ss.streak,
          ROUND(
            CASE WHEN SUM(pgs.fga) > 0
              THEN (SUM(pgs.fgm) + 0.5 * SUM(pgs.fg3m))::numeric / SUM(pgs.fga) * 100
            END, 1
          ) AS "eFGPct"
        FROM stats_standings ss
        JOIN stats_teams st ON st.external_id = ss.team_external_id
        LEFT JOIN pbp_player_game_stats pgs
          ON pgs.team_id = st.id
        LEFT JOIN stats_games sg
          ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
        WHERE ss.season_id = ${seasonId}
        GROUP BY
          st.id, st.external_id, st.name_zh, st.name_en, st.logo_url,
          ss.rank, ss.wins, ss.losses, ss.win_pct,
          ss.phase_name, ss.streak
        ORDER BY ss.rank ASC
      `);
      res.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
      return res.json({ standings: (rows as any).rows ?? [] });
    } catch (err) {
      console.error("[stats/standings] DB error:", (err as any)?.message ?? err);
      return res.json({ standings: [] });
    }
  });

  // GET /api/stats/leaders — pbp_player_game_stats
  app.get("/api/stats/leaders", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;
    const stat = String(req.query.stat ?? "ppg");
    const allowedStats: Record<string, string> = {
      ppg: "AVG(pgs.pts)",
      rpg: "AVG(pgs.reb)",
      apg: "AVG(pgs.ast)",
      spg: "AVG(pgs.stl)",
      bpg: "AVG(pgs.blk)",
      topg: "AVG(pgs.tov)",
      fgPct:
        "(CASE WHEN SUM(pgs.fga) > 0 THEN SUM(pgs.fgm)::float / SUM(pgs.fga) * 100 ELSE NULL END)",
      tsPct:
        "(CASE WHEN (SUM(pgs.fga) + 0.44 * SUM(pgs.fta)) > 0 THEN SUM(pgs.pts)::float / (2 * (SUM(pgs.fga) + 0.44 * SUM(pgs.fta))) * 100 ELSE NULL END)",
      eFGPct:
        "(CASE WHEN SUM(pgs.fga) > 0 THEN (SUM(pgs.fgm) + 0.5 * SUM(pgs.fg3m))::float / SUM(pgs.fga) * 100 ELSE NULL END)",
      astTovRatio: "(CASE WHEN SUM(pgs.tov) > 0 THEN SUM(pgs.ast)::float / SUM(pgs.tov) ELSE NULL END)",
      orbPerGame: "AVG(pgs.off_reb)",
    };
    const statExpr = allowedStats[stat] ?? allowedStats["ppg"];
    try {
      const rows = await db.execute(sql`
        SELECT
          pgs.player_external_id AS "externalId",
          sp.name_zh             AS "playerName",
          sp.name_en             AS "playerNameEn",
          st.name_zh             AS "teamName",
          ROUND(${sql.raw(statExpr)}::numeric, 1) AS value,
          COUNT(DISTINCT pgs.game_id)::int AS games
        FROM pbp_player_game_stats pgs
        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
        LEFT JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id
        LEFT JOIN stats_teams st ON st.id = pgs.team_id
        GROUP BY pgs.player_external_id, sp.name_zh, sp.name_en, sp.photo_url, st.name_zh, st.name_en, st.external_id
        HAVING COUNT(DISTINCT pgs.game_id) >= 5
        ORDER BY value DESC NULLS LAST
        LIMIT 15
      `);
      res.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
      return res.json({ leaders: (rows as any).rows ?? [], stat });
    } catch (err) {
      console.error("[stats/leaders] DB error:", (err as any)?.message ?? err);
      return res.json({ leaders: [], stat });
    }
  });

  // ─── GET /api/stats/seasons ──────────────────────────────────────────────────
  const SEASON_LABELS: Record<number, string> = {
    2092: "2025-26",
    2093: "2026-27",
    2094: "2027-28",
    2095: "2028-29",
  };
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
        label: SEASON_LABELS[r.seasonId as number] ?? `Temp. ${r.seasonId}`,
      }));
      res.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=300");
      return res.json({ seasons });
    } catch (err) {
      console.error("[stats/seasons] DB error:", (err as any)?.message ?? err);
      return res.json({ seasons: [] });
    }
  });

  // ─── GET /api/stats/player-link — lookup por nombre → externalId + 3 stats ──
  app.get("/api/stats/player-link", requireAuth, async (req, res) => {
    const name = String(req.query.name ?? "").trim();
    if (!name) return res.json({ externalId: null, ppg: 0, rpg: 0, apg: 0 });
    const seasonId = Number(req.query.seasonId ?? 2092);
    try {
      const rows = await db.execute(sql`
        SELECT
          sp.external_id::text AS "externalId",
          ROUND(AVG(pgs.pts)::numeric, 1)  AS ppg,
          ROUND(AVG(pgs.reb)::numeric, 1)  AS rpg,
          ROUND(AVG(pgs.ast)::numeric, 1)  AS apg
        FROM stats_players sp
        JOIN pbp_player_game_stats pgs ON pgs.player_external_id = sp.external_id::text
        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} AND pgs.phase_type = 'regular'
        WHERE sp.name_zh = ${name} OR sp.name_en = ${name}
        GROUP BY sp.external_id
        LIMIT 1
      `);
      const row = (rows as any).rows?.[0];
      if (!row) return res.json({ externalId: null, ppg: 0, rpg: 0, apg: 0 });
      res.set("Cache-Control", "private, max-age=600, stale-while-revalidate=60");
      return res.json({
        externalId: String(row.externalId),
        ppg: Number(row.ppg ?? 0),
        rpg: Number(row.rpg ?? 0),
        apg: Number(row.apg ?? 0),
      });
    } catch (err) {
      console.error("[stats/player-link] error:", (err as any)?.message ?? err);
      return res.json({ externalId: null, ppg: 0, rpg: 0, apg: 0 });
    }
  });

  // ─── GET /api/stats/player/:externalId — pbp_player_game_stats ───────────────
  app.get("/api/stats/player/:externalId", requireAuth, async (req, res) => {
    try {
    const { externalId } = req.params;
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;

    const playerRows = await db.execute(sql`
      SELECT
        pgs.player_external_id AS "externalId",
        sp.name_zh             AS "nameZh",
        sp.name_en             AS "nameEn",
        sp.jersey_number       AS "jerseyNumber",
        sp.photo_url           AS "photoUrl",
        sp.position,
        st.name_zh             AS "teamName",
        st.name_en             AS "teamNameEn",
        st.logo_url            AS "teamLogo",
        st.external_id::text   AS "teamExternalId",
        COUNT(DISTINCT pgs.game_id) AS games,
        ROUND(AVG(pgs.seconds_played / 60.0)::numeric, 1) AS mpg,
        ROUND(AVG(pgs.pts)::numeric, 1) AS ppg,
        ROUND(AVG(pgs.reb)::numeric, 1) AS rpg,
        ROUND(AVG(pgs.ast)::numeric, 1) AS apg,
        ROUND(AVG(pgs.stl)::numeric, 1) AS spg,
        ROUND(AVG(pgs.blk)::numeric, 1) AS bpg,
        ROUND(AVG(pgs.tov)::numeric, 1) AS topg,
        ROUND(CASE WHEN SUM(pgs.fga) > 0 THEN SUM(pgs.fgm)::numeric / SUM(pgs.fga) * 100 END, 1) AS "fgPct",
        ROUND(CASE WHEN SUM(pgs.fg3a) > 0 THEN SUM(pgs.fg3m)::numeric / SUM(pgs.fg3a) * 100 END, 1) AS "fg3Pct",
        ROUND(CASE WHEN SUM(pgs.fta) > 0 THEN SUM(pgs.ftm)::numeric / SUM(pgs.fta) * 100 END, 1) AS "ftPct",
        ROUND(
          CASE WHEN (SUM(pgs.fga) + 0.44 * SUM(pgs.fta)) > 0
            THEN SUM(pgs.pts)::numeric / (2 * (SUM(pgs.fga) + 0.44 * SUM(pgs.fta))) * 100
          END, 1
        ) AS "tsPct",
        ROUND(
          CASE WHEN SUM(pgs.fga) > 0
            THEN (SUM(pgs.fgm) + 0.5 * SUM(pgs.fg3m))::numeric / SUM(pgs.fga) * 100
          END, 1
        ) AS "eFGPct",
        ROUND(CASE WHEN SUM(pgs.tov) > 0 THEN SUM(pgs.ast)::numeric / SUM(pgs.tov) END, 2) AS "astTovRatio",
        ROUND(CASE WHEN SUM(pgs.fga) > 0 THEN SUM(pgs.fta)::numeric / SUM(pgs.fga) END, 3) AS "ftRate",
        ROUND(AVG(pgs.off_reb)::numeric, 1) AS "orbPerGame",
        ROUND(AVG(pgs.def_reb)::numeric, 1) AS "drbPerGame"
      FROM pbp_player_game_stats pgs
      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
      LEFT JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id
      LEFT JOIN stats_teams st ON st.id = pgs.team_id
      WHERE pgs.player_external_id = ${externalId}
      GROUP BY pgs.player_external_id, sp.name_zh, sp.name_en, sp.jersey_number,
               sp.photo_url, sp.position, st.name_zh, st.name_en, st.logo_url, st.external_id
      LIMIT 1
    `);
    const player = (playerRows as any).rows?.[0];
    if (!player) return res.status(404).json({ error: "Player not found" });

    let pieRow: number | null = null;
    try {
      const pieRows = await db.execute(sql`
        WITH pie_games AS (
          SELECT
            pgs.game_id,
            (pgs.pts + pgs.fgm + pgs.ftm - pgs.fga - pgs.fta
             + pgs.def_reb + 0.5 * pgs.off_reb
             + pgs.ast + pgs.stl + 0.5 * pgs.blk - pgs.fouls - pgs.tov
            ) AS player_num,
            gm_totals.game_den
          FROM pbp_player_game_stats pgs
          JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
          JOIN (
            SELECT
              pgs_inner.game_id,
              SUM(
                pgs_inner.pts + pgs_inner.fgm + pgs_inner.ftm - pgs_inner.fga - pgs_inner.fta
                + pgs_inner.def_reb + 0.5 * pgs_inner.off_reb
                + pgs_inner.ast + pgs_inner.stl + 0.5 * pgs_inner.blk - pgs_inner.fouls - pgs_inner.tov
              ) AS game_den
            FROM pbp_player_game_stats pgs_inner
            JOIN stats_games sg_inner ON sg_inner.id = pgs_inner.game_id
              AND sg_inner.status = 4 AND sg_inner.season_id = ${seasonId}
              ${phaseType === "all" ? sql`` : sql`AND pgs_inner.phase_type = ${phaseType}`}
            GROUP BY pgs_inner.game_id
          ) gm_totals ON gm_totals.game_id = pgs.game_id
          WHERE pgs.player_external_id = ${externalId}
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
        WITH player_games AS (
          SELECT
            pgs.game_id,
            pgs.team_id,
            pgs.fga,
            pgs.fta,
            pgs.tov,
            pgs.seconds_played AS min_sec
          FROM pbp_player_game_stats pgs
          JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
          WHERE pgs.player_external_id = ${externalId}
            AND pgs.seconds_played > 0
        ),
        team_games AS (
          SELECT
            pgs2.game_id,
            pgs2.team_id,
            SUM(pgs2.fga) AS tm_fga,
            SUM(pgs2.fta) AS tm_fta,
            SUM(pgs2.tov) AS tm_tov,
            SUM(pgs2.seconds_played) AS tm_min_sec
          FROM pbp_player_game_stats pgs2
          JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
            ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`}
          WHERE pgs2.team_id IN (SELECT DISTINCT team_id FROM player_games)
          GROUP BY pgs2.game_id, pgs2.team_id
        ),
        usg_calc AS (
          SELECT
            ROUND(
              100.0 * SUM((pg.fga + 0.44 * pg.fta + pg.tov) * (tg.tm_min_sec / 5.0))
              / NULLIF(SUM(pg.min_sec * (tg.tm_fga + 0.44 * tg.tm_fta + tg.tm_tov)), 0)
            , 1) AS usg_pct
          FROM player_games pg
          JOIN team_games tg ON tg.game_id = pg.game_id AND tg.team_id = pg.team_id
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
        ROUND(AVG(CASE WHEN own.id = sg.home_team_id THEN pgs.pts END)::numeric, 1) AS "ptsHome",
        ROUND(AVG(CASE WHEN own.id != sg.home_team_id THEN pgs.pts END)::numeric, 1) AS "ptsAway",
        ROUND(AVG(CASE WHEN own.id = sg.home_team_id THEN pgs.reb END)::numeric, 1) AS "rebHome",
        ROUND(AVG(CASE WHEN own.id != sg.home_team_id THEN pgs.reb END)::numeric, 1) AS "rebAway",
        ROUND(AVG(CASE WHEN own.id = sg.home_team_id THEN pgs.ast END)::numeric, 1) AS "astHome",
        ROUND(AVG(CASE WHEN own.id != sg.home_team_id THEN pgs.ast END)::numeric, 1) AS "astAway"
      FROM pbp_player_game_stats pgs
      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
      JOIN stats_teams own ON own.id = pgs.team_id
      WHERE pgs.player_external_id = ${externalId}
    `);
    const splitRow = (splitRows as any).rows?.[0] ?? {};

    const logRows = await db.execute(sql`
      SELECT
        sg.external_game_id  AS "gameId",
        sg.scheduled_at      AS "gameDate",
        CASE WHEN own.id = sg.home_team_id THEN at.name_zh ELSE ht.name_zh END AS "rivalName",
        CASE WHEN own.id = sg.home_team_id THEN at.name_en ELSE ht.name_en END AS "rivalNameEn",
        CASE WHEN own.id = sg.home_team_id
          THEN sg.home_score || '-' || sg.away_score
          ELSE sg.away_score || '-' || sg.home_score
        END AS "score",
        (FLOOR(pgs.seconds_played / 60)::int)::text || ':' ||
          LPAD((pgs.seconds_played % 60)::text, 2, '0') AS minutes,
        pgs.pts, pgs.reb, pgs.ast, pgs.stl, pgs.blk, pgs.tov,
        pgs.fgm, pgs.fga, pgs.fg3m AS tpm, pgs.fg3a AS tpa, pgs.ftm, pgs.fta,
        COALESCE(spb2.plus_minus, pgs.plus_minus) AS "plusMinus",
        pgs.is_starter       AS "isStart",
        (own.id = sg.home_team_id) AS "isHome"
      FROM pbp_player_game_stats pgs
      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
      LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id
      LEFT JOIN stats_teams at ON at.id = sg.away_team_id
      JOIN stats_teams own ON own.id = pgs.team_id
      LEFT JOIN stats_player_boxscores spb2 ON spb2.game_id = pgs.game_id AND spb2.player_external_id::text = pgs.player_external_id
      WHERE pgs.player_external_id = ${externalId}
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
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;
    const phaseFilterPP = phaseType === "all" ? sql`` : sql`AND pp.phase_type = ${phaseType}`;
    const phaseFilterP = phaseType === "all" ? sql`` : sql`AND p.phase_type = ${phaseType}`;

    const teamRow = await db.execute(sql`
      SELECT
        st.external_id   AS "externalId",
        st.name_zh       AS "nameZh",
        st.name_en       AS "nameEn",
        st.logo_url      AS "logoUrl",
        ss.wins,
        ss.losses,
        (SELECT ROUND(SUM(pp.points)::numeric / NULLIF(COUNT(DISTINCT pp.game_id), 0), 1)
         FROM pbp_possessions pp JOIN stats_games sg2 ON sg2.id = pp.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
         WHERE pp.team_id = st.id ${phaseFilterPP}) AS ppg,
        (SELECT ROUND(SUM(pp.points)::numeric / NULLIF(COUNT(DISTINCT pp.game_id), 0), 1)
         FROM pbp_possessions pp JOIN stats_games sg2 ON sg2.id = pp.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
         WHERE pp.team_id != st.id ${phaseFilterPP}
           AND sg2.id IN (SELECT sg3.id FROM stats_games sg3 WHERE (sg3.home_team_id = st.id OR sg3.away_team_id = st.id) AND sg3.status = 4 AND sg3.season_id = ${seasonId})) AS oppg,
        ss.rank,
        ss.win_pct               AS "winPct",
        ss.streak,
        ss.last10_wins           AS "last10W",
        ss.last10_losses         AS "last10L",
        ss.home_wins             AS "homeW",
        ss.home_losses           AS "homeL",
        ss.away_wins             AS "awayW",
        ss.away_losses           AS "awayL",
        (SELECT ROUND(SUM(pgs_fg.fgm)::numeric / NULLIF(SUM(pgs_fg.fga), 0) * 100, 1)
         FROM pbp_player_game_stats pgs_fg
         JOIN stats_games sg ON sg.id = pgs_fg.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
           ${phaseType === "all" ? sql`` : sql`AND pgs_fg.phase_type = ${phaseType}`}
         WHERE pgs_fg.team_id = st.id) AS "teamFgPct",
        adv."eFGPct",
        adv."tovPct",
        adv."ftRate"
      FROM stats_teams st
      LEFT JOIN stats_standings ss
        ON ss.team_external_id = st.external_id AND ss.season_id = ${seasonId}
      LEFT JOIN LATERAL (
        SELECT
          ROUND((SUM(pgs2.fgm) + 0.5 * SUM(pgs2.fg3m))::numeric / NULLIF(SUM(pgs2.fga), 0) * 100, 1) AS "eFGPct",
          ROUND(SUM(pgs2.tov)::numeric / NULLIF(SUM(pgs2.fga) + 0.44 * SUM(pgs2.fta) + SUM(pgs2.tov), 0) * 100, 1) AS "tovPct",
          ROUND(SUM(pgs2.fta)::numeric / NULLIF(SUM(pgs2.fga), 0), 3) AS "ftRate"
        FROM pbp_player_game_stats pgs2
        JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
          ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`}
        WHERE pgs2.team_id = st.id
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
            SUM(pgs.off_reb) AS orb,
            SUM(pgs.def_reb) AS drb
          FROM pbp_player_game_stats pgs
          JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
          WHERE pgs.team_id = (SELECT id FROM team_ref)
        ),
        rival_reb AS (
          SELECT
            SUM(pgs2.off_reb) AS rival_orb,
            SUM(pgs2.def_reb) AS rival_drb
          FROM pbp_player_game_stats pgs2
          JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
            ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`}
          WHERE pgs2.team_id != (SELECT id FROM team_ref)
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

    // internal team id — pbp_possessions.team_id y pbp_player_game_stats.team_id son internos desde v6.2
    const teamIntRes = await db.execute(sql`SELECT id AS int_id FROM stats_teams WHERE external_id = ${Number(externalId)} LIMIT 1`);
    const teamIntId = Number((teamIntRes as any).rows?.[0]?.int_id ?? 0);

    const playersRow = await db.execute(sql`
      SELECT
        pgs.player_external_id AS "externalId",
        sp.name_zh AS "nameZh",
        sp.name_en AS "nameEn",
        sp.jersey_number AS "jerseyNumber",
        sp.position,
        COUNT(DISTINCT pgs.game_id)::int AS games,
        ROUND(AVG(pgs.pts)::numeric, 1) AS ppg,
        ROUND(AVG(pgs.reb)::numeric, 1) AS rpg,
        ROUND(AVG(pgs.ast)::numeric, 1) AS apg
      FROM pbp_player_game_stats pgs
      JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
      LEFT JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id
      LEFT JOIN stats_teams st ON st.id = pgs.team_id
      WHERE pgs.team_id = ${teamIntId}
      GROUP BY pgs.player_external_id, sp.name_zh, sp.name_en, sp.jersey_number, sp.position
      HAVING COUNT(DISTINCT pgs.game_id) >= 1
      ORDER BY AVG(pgs.pts) DESC NULLS LAST
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
      // Own possessions: puntos y conteo directos, sin cross-join
      const ownRow = await db.execute(sql`
        SELECT
          COUNT(*)::int               AS cnt,
          SUM(pp.points)::int         AS pts
        FROM pbp_possessions pp
        JOIN stats_games sg ON sg.id = pp.game_id
          AND sg.status = 4 AND sg.season_id = ${seasonId}
        WHERE pp.team_id = ${teamIntId} ${phaseFilterPP}
      `);
      // Opponent possessions in our games
      const oppRow = await db.execute(sql`
        SELECT
          COUNT(*)::int               AS cnt,
          SUM(pp.points)::int         AS pts
        FROM pbp_possessions pp
        WHERE pp.team_id != ${teamIntId}
          ${phaseFilterPP}
          AND pp.game_id IN (
            SELECT sg2.id FROM stats_games sg2
            WHERE (sg2.home_team_id = ${teamIntId} OR sg2.away_team_id = ${teamIntId})
              AND sg2.status = 4 AND sg2.season_id = ${seasonId}
          )
      `);
      // Games played — contar DISTINCT game_ids desde pbp_possessions con el mismo phaseFilter
      // IMPORTANTE: no usar stats_games sin filtro de fase — inflaria el denominador con partidos de playoff
      const gamesRow = await db.execute(sql`
        SELECT COUNT(DISTINCT pp.game_id)::int AS cnt
        FROM pbp_possessions pp
        JOIN stats_games sg ON sg.id = pp.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        WHERE pp.team_id = ${teamIntId} ${phaseFilterPP}
      `);
      const own  = (ownRow  as any).rows?.[0] ?? {};
      const opp  = (oppRow  as any).rows?.[0] ?? {};
      const gCnt = Number((gamesRow as any).rows?.[0]?.cnt ?? 0);
      const ownCnt = Number(own.cnt ?? 0);
      const oppCnt = Number(opp.cnt ?? 0);
      const ownPts = Number(own.pts ?? 0);
      const oppPts = Number(opp.pts ?? 0);
      ortg    = ownCnt > 0 ? Math.round((100 * ownPts / ownCnt) * 10) / 10 : null;
      drtg    = oppCnt > 0 ? Math.round((100 * oppPts / oppCnt) * 10) / 10 : null;
      netRtg  = ortg != null && drtg != null ? Number((ortg - drtg).toFixed(1)) : null;
      pppOf   = ownCnt > 0 ? Math.round((ownPts / ownCnt) * 1000) / 1000 : null;
      pppDef  = oppCnt > 0 ? Math.round((oppPts / oppCnt) * 1000) / 1000 : null;
      paceEst = (ownCnt + oppCnt) > 0 && gCnt > 0
        ? Math.round(((ownCnt + oppCnt) / 2 / gCnt) * 10) / 10
        : null;
    } catch (rtgErr: any) {
      console.error("[stats/team] ORTG/DRTG query failed:", rtgErr?.message ?? rtgErr);
    }

    // ── TEAM GAME LOG ────────────────────────────────────────────────────────
    const gameLogRow = await db.execute(sql`
      SELECT
        sg.external_game_id::text AS "gameId",
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


  // ─── GET /api/stats/game/:gameId/boxscore ───────────────────────────────────
  app.get("/api/stats/game/:gameId/boxscore", requireAuth, async (req, res) => {
    const { gameId } = req.params;
    try {
      const gameRow = await db.execute(sql`
        SELECT
          sg.id, sg.external_game_id, sg.scheduled_at,
          sg.home_score, sg.away_score,
          sg.home_q1, sg.home_q2, sg.home_q3, sg.home_q4,
          sg.away_q1, sg.away_q2, sg.away_q3, sg.away_q4,
          ht.name_zh AS "homeNameZh", ht.name_en AS "homeNameEn",
          ht.logo_url AS "homeLogo", ht.external_id::text AS "homeExtId",
          at.name_zh AS "awayNameZh", at.name_en AS "awayNameEn",
          at.logo_url AS "awayLogo", at.external_id::text AS "awayExtId"
        FROM stats_games sg
        LEFT JOIN stats_teams ht ON ht.id = sg.home_team_id
        LEFT JOIN stats_teams at ON at.id = sg.away_team_id
        WHERE sg.external_game_id = ${Number(gameId)}
        LIMIT 1
      `);
      const game = (gameRow as any).rows?.[0];
      if (!game) return res.status(404).json({ error: "Game not found" });
      const boxRow = await db.execute(sql`
        SELECT
          pb.player_external_id AS "externalId",
          sp.name_zh AS "nameZh", sp.name_en AS "nameEn",
          sp.jersey_number AS "jerseyNumber", sp.position,
          sp.photo_url AS "photoUrl",
          pb.team_external_id AS "teamExtId",
          pb.is_start_lineup AS "isStart",
          pb.minutes,
          pb.pts, pb.reb, pb.ast, pb.stl, pb.blk, pb.tov,
          pb.fgm, pb.fga, pb.tpm, pb.tpa, pb.ftm, pb.fta,
          pb.off_reb AS "offReb", pb.def_reb AS "defReb",
          pb.plus_minus AS "plusMinus", pb.fouls
        FROM stats_player_boxscores pb
        LEFT JOIN stats_players sp ON sp.external_id = pb.player_external_id
        WHERE pb.game_id = ${Number(game.id)}
        ORDER BY pb.team_external_id, pb.pts DESC NULLS LAST
      `);
      const players = ((boxRow as any).rows ?? []).map((p: any) => ({
        externalId: String(p.externalId ?? ""),
        nameZh: p.nameZh ?? "", nameEn: p.nameEn ?? null,
        jerseyNumber: p.jerseyNumber ?? null, position: p.position ?? null,
        photoUrl: p.photoUrl ?? null, teamExtId: String(p.teamExtId ?? ""),
        isStart: Boolean(p.isStart), minutes: p.minutes ?? "0:00",
        pts: Number(p.pts ?? 0), reb: Number(p.reb ?? 0),
        ast: Number(p.ast ?? 0), stl: Number(p.stl ?? 0),
        blk: Number(p.blk ?? 0), tov: Number(p.tov ?? 0),
        fgm: Number(p.fgm ?? 0), fga: Number(p.fga ?? 0),
        tpm: Number(p.tpm ?? 0), tpa: Number(p.tpa ?? 0),
        ftm: Number(p.ftm ?? 0), fta: Number(p.fta ?? 0),
        offReb: Number(p.offReb ?? 0), defReb: Number(p.defReb ?? 0),
        plusMinus: Number(p.plusMinus ?? 0), fouls: Number(p.fouls ?? 0),
      }));
      res.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=300");
      return res.json({
        game: {
          gameId: String(game.external_game_id),
          date: game.scheduled_at ?? null,
          homeScore: Number(game.home_score ?? 0),
          awayScore: Number(game.away_score ?? 0),
          homeQ1: game.home_q1 != null ? Number(game.home_q1) : null,
          homeQ2: game.home_q2 != null ? Number(game.home_q2) : null,
          homeQ3: game.home_q3 != null ? Number(game.home_q3) : null,
          homeQ4: game.home_q4 != null ? Number(game.home_q4) : null,
          awayQ1: game.away_q1 != null ? Number(game.away_q1) : null,
          awayQ2: game.away_q2 != null ? Number(game.away_q2) : null,
          awayQ3: game.away_q3 != null ? Number(game.away_q3) : null,
          awayQ4: game.away_q4 != null ? Number(game.away_q4) : null,
          home: { nameZh: game.homeNameZh, nameEn: game.homeNameEn ?? null, logo: game.homeLogo ?? null, extId: game.homeExtId },
          away: { nameZh: game.awayNameZh, nameEn: game.awayNameEn ?? null, logo: game.awayLogo ?? null, extId: game.awayExtId },
        },
        players,
      });
    } catch (err: any) {
      console.error("[stats/game/boxscore] Error:", err?.message ?? err);
      return res.status(500).json({ error: "Failed to load game boxscore", detail: err?.message });
    }
  });

  // ─── GET /api/stats/team/:externalId/pace-segments ──────────────────────────
  // Tramos de ritmo desde pbp_possessions (is_transition / is_early_offense / is_halfcourt).
  app.get("/api/stats/team/:externalId/pace-segments", requireAuth, async (req, res) => {
    const { externalId } = req.params;
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilterPP = phaseType === "all" ? sql`` : sql`AND pp.phase_type = ${phaseType}`;
    try {
      const teamRow = await db.execute(sql`
        SELECT st.id, st.external_id::text AS ext_id
        FROM stats_teams st WHERE st.external_id = ${Number(externalId)} LIMIT 1
      `);
      const team = (teamRow as any).rows?.[0];
      if (!team) return res.status(404).json({ error: "Team not found" });

      const rows = await db.execute(sql`
        SELECT
          CASE
            WHEN pp.is_transition    THEN 'transition'
            WHEN pp.is_early_offense THEN 'early'
            ELSE                         'halfcourt'
          END AS seg,
          COUNT(*)::int AS poss,
          SUM(pp.points)::int AS pts,
          ROUND(AVG(pp.duration_sec)::numeric, 1) AS avg_dur
        FROM pbp_possessions pp
        JOIN stats_games sg ON sg.id = pp.game_id
        WHERE pp.team_id = ${Number(team.id)}
          AND sg.status = 4
          AND sg.season_id = ${seasonId}
          ${phaseFilterPP}
        GROUP BY seg
      `);

      const lgRows = await db.execute(sql`
        SELECT
          CASE
            WHEN pp.is_transition    THEN 'transition'
            WHEN pp.is_early_offense THEN 'early'
            ELSE                         'halfcourt'
          END AS seg,
          COUNT(*)::int AS poss,
          SUM(pp.points)::int AS pts,
          ROUND(AVG(pp.duration_sec)::numeric, 1) AS avg_dur
        FROM pbp_possessions pp
        JOIN stats_games sg ON sg.id = pp.game_id
        WHERE sg.status = 4 AND sg.season_id = ${seasonId}
          ${phaseFilterPP}
        GROUP BY seg
      `);

      const teamSegs = (rows as any).rows ?? [];
      const lgSegs = (lgRows as any).rows ?? [];

      const totalPoss = teamSegs.reduce((s: number, r: any) => s + Number(r.poss), 0);
      const lgTotalPoss = lgSegs.reduce((s: number, r: any) => s + Number(r.poss), 0);

      if (totalPoss < 200) {
        res.set("Cache-Control", "private, max-age=300");
        return res.json({
          insufficient_data: true,
          possessions: totalPoss,
          min_required: 200,
        });
      }

      const buildSeg = (segs: any[], total: number, name: string) => {
        const r = segs.find((s: any) => s.seg === name) ?? { poss: 0, pts: 0, avg_dur: null };
        const poss = Number(r.poss);
        const pts = Number(r.pts);
        return {
          poss,
          pts,
          pct: total > 0 ? Math.round((poss / total) * 1000) / 10 : 0,
          ppp: poss > 0 ? Math.round((pts / poss) * 1000) / 1000 : null,
          avgDur: r.avg_dur != null ? Number(r.avg_dur) : null,
        };
      };

      const weightedAvgDur = (segs: any[], total: number) => {
        if (total <= 0) return 0;
        const sum = segs.reduce(
          (s: number, r: any) => s + Number(r.poss) * (r.avg_dur != null ? Number(r.avg_dur) : 0),
          0,
        );
        return Math.round((sum / total) * 10) / 10;
      };

      const transition = buildSeg(teamSegs, totalPoss, "transition");
      const early = buildSeg(teamSegs, totalPoss, "early");
      const halfcourt = buildSeg(teamSegs, totalPoss, "halfcourt");

      const lgTransition = buildSeg(lgSegs, lgTotalPoss, "transition");
      const lgEarly = buildSeg(lgSegs, lgTotalPoss, "early");
      const lgHalfcourt = buildSeg(lgSegs, lgTotalPoss, "halfcourt");

      res.set("Cache-Control", "private, max-age=1800, stale-while-revalidate=120");
      return res.json({
        insufficient_data: false,
        possessions: totalPoss,
        avg_possession_time: weightedAvgDur(teamSegs, totalPoss),
        transition,
        early,
        halfcourt,
        totalPoss,
        lg: {
          transition: lgTransition,
          early: lgEarly,
          halfcourt: lgHalfcourt,
          totalPoss: lgTotalPoss,
          avg_possession_time: weightedAvgDur(lgSegs, lgTotalPoss),
        },
      });
    } catch (err: any) {
      console.error("[stats/pace-segments] Error:", err?.message ?? err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/stats/league-averages", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;
    const phaseFilterPP = phaseType === "all" ? sql`` : sql`AND pp.phase_type = ${phaseType}`;
    const position = typeof req.query.position === "string" && req.query.position.trim()
      ? req.query.position.trim()
      : null;
    try {
      const rows = await db.execute(sql`
        WITH league_reb AS (
          SELECT
            pgs.team_id::text AS team_external_id,
            SUM(pgs.off_reb) AS orb,
            SUM(pgs.def_reb) AS drb,
            pgs.game_id
          FROM pbp_player_game_stats pgs
          JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
          ${position ? sql`JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id AND sp.position = ${position}` : sql``}
          GROUP BY pgs.team_id, pgs.game_id
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
          (SELECT ROUND(AVG(t.v)::numeric, 1) FROM (SELECT SUM(pgs2.pts) AS v FROM pbp_player_game_stats pgs2 JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId} ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`} GROUP BY pgs2.team_id, pgs2.game_id) t) AS "avgPpg",
          (SELECT ROUND(AVG(t.v)::numeric, 1) FROM (SELECT SUM(pgs2.reb) AS v FROM pbp_player_game_stats pgs2 JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId} ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`} GROUP BY pgs2.team_id, pgs2.game_id) t) AS "avgRpg",
          (SELECT ROUND(AVG(t.v)::numeric, 1) FROM (SELECT SUM(pgs2.ast) AS v FROM pbp_player_game_stats pgs2 JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId} ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`} GROUP BY pgs2.team_id, pgs2.game_id) t) AS "avgApg",
          (SELECT ROUND(AVG(t.v)::numeric, 1) FROM (SELECT SUM(pgs2.stl) AS v FROM pbp_player_game_stats pgs2 JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId} ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`} GROUP BY pgs2.team_id, pgs2.game_id) t) AS "avgSpg",
          (SELECT ROUND(AVG(t.v)::numeric, 1) FROM (SELECT SUM(pgs2.blk) AS v FROM pbp_player_game_stats pgs2 JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId} ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`} GROUP BY pgs2.team_id, pgs2.game_id) t) AS "avgBpg",
          ROUND(
            CASE WHEN SUM(pgs.fga) > 0
              THEN SUM(pgs.fgm)::numeric / SUM(pgs.fga) * 100 END, 1
          ) AS "avgFgPct",
          ROUND(
            CASE WHEN SUM(pgs.fg3a) > 0
              THEN SUM(pgs.fg3m)::numeric / SUM(pgs.fg3a) * 100 END, 1
          ) AS "avgFg3Pct",
          ROUND(
            CASE WHEN SUM(pgs.fga) > 0
              THEN (SUM(pgs.fgm) + 0.5 * SUM(pgs.fg3m))::numeric / SUM(pgs.fga) * 100 END, 1
          ) AS "avgEFGPct",
          ROUND(
            CASE WHEN (SUM(pgs.fga) + 0.44 * SUM(pgs.fta)) > 0
              THEN SUM(pgs.pts)::numeric / (2 * (SUM(pgs.fga) + 0.44 * SUM(pgs.fta))) * 100 END, 1
          ) AS "avgTsPct",
          ROUND(
            CASE WHEN (SUM(pgs.fga) + 0.44 * SUM(pgs.fta) + SUM(pgs.tov)) > 0
              THEN SUM(pgs.tov)::numeric / (SUM(pgs.fga) + 0.44 * SUM(pgs.fta) + SUM(pgs.tov)) * 100 END, 1
          ) AS "avgTovPct",
          ROUND(
            CASE WHEN SUM(pgs.fga) > 0
              THEN SUM(pgs.fta)::numeric / SUM(pgs.fga) END, 3
          ) AS "avgFtRate",
          ROUND(
            100.0 * SUM(oc.total_orb) / NULLIF(SUM(oc.total_orb) + SUM(oc.rival_drb), 0), 1
          ) AS "avgOrbPct",
          ROUND(AVG(pgs.off_reb)::numeric, 1) AS "avgOrbPerGame",
          ROUND(AVG(pgs.def_reb)::numeric, 1) AS "avgDrbPerGame"
        FROM pbp_player_game_stats pgs
        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
        ${position ? sql`JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id AND sp.position = ${position}` : sql``}
        LEFT JOIN orb_calc oc ON oc.team_external_id = pgs.team_id::text
      `);
      const row = (rows as any).rows?.[0] ?? {};

      const playerAvgRows = await db.execute(sql`
        SELECT
          ROUND(AVG(sub.ppg)::numeric, 1) AS avg_player_ppg,
          ROUND(AVG(sub.rpg)::numeric, 1) AS avg_player_rpg,
          ROUND(AVG(sub.apg)::numeric, 1) AS avg_player_apg
        FROM (
          SELECT
            pgs2.player_external_id,
            AVG(COALESCE(pgs2.pts, 0)) AS ppg,
            AVG(COALESCE(pgs2.reb, 0)) AS rpg,
            AVG(COALESCE(pgs2.ast, 0)) AS apg
          FROM pbp_player_game_stats pgs2
          JOIN stats_games sg2 ON sg2.id = pgs2.game_id AND sg2.status = 4 AND sg2.season_id = ${seasonId}
            ${phaseType === "all" ? sql`` : sql`AND pgs2.phase_type = ${phaseType}`}
          ${position ? sql`JOIN stats_players sp2 ON sp2.external_id::text = pgs2.player_external_id AND sp2.position = ${position}` : sql``}
          GROUP BY pgs2.player_external_id
          HAVING COUNT(DISTINCT pgs2.game_id) >= 3
        ) sub
      `);
      const pa = (playerAvgRows as any).rows?.[0] ?? {};

      // ── ORTG / DRTG / Pace / PPP — query separada para evitar inflar filas ──
      let lgOrtg: number | null = null;
      let lgDrtg: number | null = null;
      let lgPace: number | null = null;
      let lgPpp:  number | null = null;
      try {
        const rtgLgRows = await db.execute(sql`
          SELECT
            ROUND(100.0 * SUM(pp.points) / NULLIF(COUNT(*), 0), 1) AS ortg,
            ROUND(SUM(pp.points)::numeric / NULLIF(COUNT(*), 0), 3) AS ppp,
            ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT pp.game_id) * 2.0, 0), 1) AS pace
          FROM pbp_possessions pp
          WHERE pp.season_id = ${seasonId}
            ${phaseFilterPP}
        `);
        const r2 = (rtgLgRows as any).rows?.[0] ?? {};
        lgOrtg = r2.ortg != null ? Number(r2.ortg) : null;
        lgDrtg = lgOrtg; // ORTG === DRTG por definición en liga
        lgPace = r2.pace != null ? Number(r2.pace) : null;
        lgPpp  = r2.ppp  != null ? Number(r2.ppp)  : null;
      } catch (rtgErr: any) {
        console.error("[league-averages] ORTG/DRTG query failed:", rtgErr?.message ?? rtgErr);
      }

      // ── DRB% de liga — query separada ──
      let lgDrbPct: number | null = null;
      try {
        const drbRows = await db.execute(sql`
          WITH per_game AS (
            SELECT
              pgs.game_id,
              pgs.team_id::text AS team_external_id,
              SUM(pgs.def_reb) AS drb,
              SUM(pgs.off_reb) AS orb
            FROM pbp_player_game_stats pgs
            JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
            GROUP BY pgs.game_id, pgs.team_id
          )
          SELECT
            ROUND(
              100.0 * SUM(a.drb) / NULLIF(SUM(a.drb) + SUM(b.orb), 0), 1
            ) AS drb_pct
          FROM per_game a
          JOIN per_game b ON b.game_id = a.game_id AND b.team_external_id != a.team_external_id
        `);
        const dr = (drbRows as any).rows?.[0] ?? {};
        lgDrbPct = dr.drb_pct != null ? Number(dr.drb_pct) : null;
      } catch (rtgErr: any) {
        console.error("[league-averages] ORTG/DRTG query failed:", rtgErr?.message ?? rtgErr);
      }

      res.set("Cache-Control", "private, max-age=1800, stale-while-revalidate=120");
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
        avgPlayerPpg: pa.avg_player_ppg != null ? Number(pa.avg_player_ppg) : null,
        avgPlayerRpg: pa.avg_player_rpg != null ? Number(pa.avg_player_rpg) : null,
        avgPlayerApg: pa.avg_player_apg != null ? Number(pa.avg_player_apg) : null,
        ortg: lgOrtg,
        drtg: lgDrtg,
        pace: lgPace,
        ppp:  lgPpp,
        drbPct: lgDrbPct,
      });
    } catch (err: any) {
      console.error("[stats/league-averages] error:", err?.message ?? err);
      return res.status(500).json({ error: "Failed to load league averages" });
    }
  });

  app.get("/api/stats/player-percentiles", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = String(req.query.phaseType ?? "regular");
    const phaseFilter = phaseType === "all" ? sql`` : sql`AND pgs.phase_type = ${phaseType}`;
    const positionPct = typeof req.query.position === "string" && req.query.position.trim()
      ? req.query.position.trim()
      : null;
    try {
      const rows = await db.execute(sql`
        WITH player_avgs AS (
          SELECT
            pgs.player_external_id,
            AVG(pgs.pts)  AS ppg,
            AVG(pgs.reb)  AS rpg,
            AVG(pgs.ast)  AS apg,
            AVG(pgs.stl)  AS spg,
            AVG(pgs.blk)  AS bpg,
            CASE WHEN (SUM(pgs.fga) + 0.44 * SUM(pgs.fta)) > 0
              THEN SUM(pgs.pts)::float / (2 * (SUM(pgs.fga) + 0.44 * SUM(pgs.fta))) * 100
            END AS ts_pct,
            CASE WHEN SUM(pgs.fga) > 0
              THEN (SUM(pgs.fgm) + 0.5 * SUM(pgs.fg3m))::float / SUM(pgs.fga) * 100
            END AS efg_pct,
            SUM(pgs.fg3a)::float / COUNT(DISTINCT pgs.game_id) AS tpa_per_game
          FROM pbp_player_game_stats pgs
          JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId} ${phaseFilter}
          ${positionPct ? sql`JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id AND sp.position = ${positionPct}` : sql``}
          GROUP BY pgs.player_external_id
          HAVING COUNT(DISTINCT pgs.game_id) >= 5
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
      res.set("Cache-Control", "private, max-age=1800, stale-while-revalidate=120");
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

  // POST /api/stats/admin/process-possessions
  // Dispara el procesamiento de todos los partidos pendientes de possessions
  // Útil para re-sync histórico
  app.post("/api/stats/admin/process-possessions", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    // Fire and forget — puede tardar varios minutos
    processAllPendingPossessions(seasonId).catch((err: any) =>
      console.error("[admin] processAllPendingPossessions failed:", err.message)
    );
    return res.json({ ok: true, message: "Processing started in background", seasonId });
  });

  // GET /api/stats/admin/possessions-status
  // Estado del procesamiento: cuántos partidos tienen possessions vs total
  app.get("/api/stats/admin/possessions-status", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    try {
      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total FROM stats_games
        WHERE status = 4 AND season_id = ${seasonId}
      `);
      const processedRes = await db.execute(sql`
        SELECT COUNT(DISTINCT game_id) AS processed FROM pbp_possessions
        WHERE season_id = ${seasonId}
      `);
      const auditRes = await db.execute(sql`
        SELECT status, COUNT(*) AS cnt FROM pbp_audit_log
        WHERE season_id = ${seasonId}
        GROUP BY status
      `);
      const total = Number((totalRes as any).rows?.[0]?.total ?? 0);
      const processed = Number((processedRes as any).rows?.[0]?.processed ?? 0);
      const audit = Object.fromEntries(
        ((auditRes as any).rows ?? []).map((r: any) => [r.status, Number(r.cnt)])
      );
      return res.json({ total, processed, pending: total - processed, audit });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Temporal — sin auth, solo para disparar re-sync de possessions
  app.post("/api/stats/admin/trigger-possessions", async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    processAllPendingPossessions(seasonId).catch((err: any) =>
      console.error("[trigger] failed:", err.message)
    );
    return res.json({ ok: true, started: true, seasonId });
  });

  app.post("/api/stats/admin/process-game/:gameId", async (req, res) => {
    const gameId = Number(req.params.gameId);
    const seasonId = Number(req.query.seasonId ?? 2092);
    if (isNaN(gameId)) return res.status(400).json({ error: "invalid gameId" });
    processPossessions(gameId, seasonId).catch((err: any) =>
      console.error("[process-game] failed:", err.message)
    );
    return res.json({ ok: true, gameId, seasonId });
  });

  // POST /api/stats/admin/process-game-sync/:gameId — síncrono, devuelve error completo
  app.post("/api/stats/admin/process-game-sync/:gameId", async (req, res) => {
    const gameId = Number(req.params.gameId);
    const seasonId = Number(req.query.seasonId ?? 2092);
    if (isNaN(gameId)) return res.status(400).json({ error: "invalid gameId" });
    try {
      await processPossessions(gameId, seasonId);
      return res.json({ ok: true, gameId, seasonId });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message, stack: err.stack?.slice(0, 500) });
    }
  });

  app.get("/api/stats/team/:id/lineups", async (req, res) => {
    try {
      const externalId = Number(req.params.id);
      const seasonId = Number(req.query.seasonId ?? 2092);
      const phaseType = String(req.query.phaseType ?? "regular");
      const phaseFilterLS = phaseType === "all" ? sql`` : sql`AND ls.phase_type = ${phaseType}`;
      // Resolver external_id → internal_id (pbp_lineup_stats usa internal)
      const teamIntRes = await db.execute(sql`SELECT id FROM stats_teams WHERE external_id = ${externalId} LIMIT 1`);
      const teamId = Number((teamIntRes as any).rows?.[0]?.id ?? externalId);
      const minPoss = Number(req.query.minPossessions ?? 10);
      const sortBy = String(req.query.sortBy ?? "seconds");

      const validSort: Record<string, string> = {
        netPpp: "net_ppp",
        offPpp: "off_ppp",
        defPpp: "def_ppp",
        seconds: "total_seconds",
      };
      const orderCol = validSort[sortBy] ?? "total_seconds";

      const result = await db.execute(sql`
        SELECT
          ls.lineup_id,
          SUM(ls.seconds_played)   AS total_seconds,
          SUM(ls.off_possessions)  AS off_possessions,
          SUM(ls.def_possessions)  AS def_possessions,
          SUM(ls.off_pts)          AS off_pts,
          SUM(ls.def_pts)          AS def_pts,
          CASE WHEN SUM(ls.off_possessions) > 0
            THEN ROUND(SUM(ls.off_pts)::numeric / SUM(ls.off_possessions) * 100, 1)
            ELSE NULL END AS ortg,
          CASE WHEN SUM(ls.def_possessions) > 0
            THEN ROUND(SUM(ls.def_pts)::numeric / SUM(ls.def_possessions) * 100, 1)
            ELSE NULL END AS drtg,
          CASE
            WHEN SUM(ls.off_possessions) > 0 AND SUM(ls.def_possessions) > 0
            THEN ROUND(
              (SUM(ls.off_pts)::numeric / SUM(ls.off_possessions) -
               SUM(ls.def_pts)::numeric / SUM(ls.def_possessions)) * 100, 1)
            ELSE NULL END AS net_rtg,
          ROUND(SUM(ls.off_pts)::numeric / NULLIF(SUM(ls.off_possessions), 0), 3) AS off_ppp,
          ROUND(SUM(ls.def_pts)::numeric / NULLIF(SUM(ls.def_possessions), 0), 3) AS def_ppp,
          ROUND(
            (SUM(ls.off_pts)::numeric / NULLIF(SUM(ls.off_possessions), 0)) -
            (SUM(ls.def_pts)::numeric / NULLIF(SUM(ls.def_possessions), 0)), 3
          ) AS net_ppp,
          SUM(ls.off_reb)  AS off_reb,
          SUM(ls.def_reb)  AS def_reb,
          SUM(ls.tov)      AS tov,
          SUM(ls.stl)      AS stl,
          SUM(ls.off_fg3m) AS off_fg3m,
          SUM(ls.off_fga)  AS off_fga,
          SUM(ls.off_fta)  AS off_fta,
          COUNT(DISTINCT ls.game_id) AS games_played
        FROM pbp_lineup_stats ls
        WHERE ls.team_id = ${teamId}
          AND ls.season_id = ${seasonId}
          ${phaseFilterLS}
        GROUP BY ls.lineup_id
        HAVING SUM(off_possessions) >= ${minPoss}
        ORDER BY ${sql.raw(orderCol)} DESC NULLS LAST
        LIMIT 50
      `);

      const rows = (result as any).rows ?? [];

      const allPlayerIds = new Set<string>();
      for (const r of rows) {
        String(r.lineup_id).split("-").forEach((id: string) => allPlayerIds.add(id));
      }

      const playerNamesZh: Record<string, string> = {};
      const playerNamesEn: Record<string, string> = {};
      if (allPlayerIds.size > 0) {
        const ids = Array.from(allPlayerIds).map(Number).filter((n) => !isNaN(n));
        if (ids.length > 0) {
          const namesRes = await db.execute(sql`
            SELECT external_id, name_zh, name_en
            FROM stats_players
            WHERE external_id::text IN (${sql.join(ids.map((id: number) => sql`${String(id)}`), sql`, `)})
          `);
          for (const p of (namesRes as any).rows ?? []) {
            playerNamesZh[String(p.external_id)] = String(p.name_zh?.trim() || p.name_en?.trim() || p.external_id);
            playerNamesEn[String(p.external_id)] = String(p.name_en?.trim() || p.name_zh?.trim() || p.external_id);
          }
        }
      }

      const enrichedRows = rows.map((r: any) => ({
        lineupId: r.lineup_id,
        playerIds: String(r.lineup_id).split("-"),
        playerNamesZh: String(r.lineup_id).split("-").map((id: string) => playerNamesZh[id] ?? id),
        playerNamesEn: String(r.lineup_id).split("-").map((id: string) => playerNamesEn[id] ?? id),
        playerNames: String(r.lineup_id).split("-").map((id: string) => playerNamesEn[id] ?? id),
        totalSeconds: Number(r.total_seconds ?? 0),
        minutesPlayed: Math.round(Number(r.total_seconds ?? 0) / 60 * 10) / 10,
        offPossessions: Number(r.off_possessions ?? 0),
        defPossessions: Number(r.def_possessions ?? 0),
        offPts: Number(r.off_pts ?? 0),
        defPts: Number(r.def_pts ?? 0),
        ortg: r.ortg != null ? Number(r.ortg) : null,
        drtg: r.drtg != null ? Number(r.drtg) : null,
        netRtg: r.net_rtg != null ? Number(r.net_rtg) : null,
        offPpp: r.off_ppp != null ? Number(r.off_ppp) : null,
        defPpp: r.def_ppp != null ? Number(r.def_ppp) : null,
        netPpp: r.net_ppp != null ? Number(r.net_ppp) : null,
        offReb: Number(r.off_reb ?? 0),
        defReb: Number(r.def_reb ?? 0),
        tov: Number(r.tov ?? 0),
        stl: Number(r.stl ?? 0),
        gamesPlayed: Number(r.games_played ?? 0),
        offFg3m: Number(r.off_fg3m ?? 0),
        offFga: Number(r.off_fga ?? 0),
        offFta: Number(r.off_fta ?? 0),
        tovPct:
          (Number(r.off_fga ?? 0) + 0.44 * Number(r.off_fta ?? 0) + Number(r.tov ?? 0)) > 0
            ? Math.round(
                (Number(r.tov ?? 0) /
                  (Number(r.off_fga ?? 0) + 0.44 * Number(r.off_fta ?? 0) + Number(r.tov ?? 0))) *
                  1000,
              ) / 10
            : null,
      }));

      res.json(enrichedRows);
    } catch (err: any) {
      console.error("[lineups]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stats/team/:id/on-off/:playerId", async (req, res) => {
    try {
      const externalId = Number(req.params.id);
      const playerExternalId = String(req.params.playerId);
      const seasonId = Number(req.query.seasonId ?? 2092);
      const teamIntRes2 = await db.execute(sql`SELECT id FROM stats_teams WHERE external_id = ${externalId} LIMIT 1`);
      const teamId = Number((teamIntRes2 as any).rows?.[0]?.id ?? externalId);

      const result = await db.execute(sql`
        WITH lineup_agg AS (
          SELECT
            lineup_id,
            SUM(off_possessions)::int AS off_poss,
            SUM(def_possessions)::int AS def_poss,
            SUM(off_pts)::int         AS off_pts,
            SUM(def_pts)::int         AS def_pts,
            SUM(seconds_played)::int  AS seconds
          FROM pbp_lineup_stats
          WHERE team_id = ${teamId}
            AND season_id = ${seasonId}
          GROUP BY lineup_id
        )
        SELECT
          CASE
            WHEN lineup_id ~ ${`(^|-)${playerExternalId}(-|$)`} THEN 'on'
            ELSE 'off'
          END AS split,
          SUM(off_poss)  AS off_poss,
          SUM(def_poss)  AS def_poss,
          SUM(off_pts)   AS off_pts,
          SUM(def_pts)   AS def_pts,
          SUM(seconds)   AS seconds,
          CASE WHEN SUM(off_poss) > 0
            THEN ROUND(SUM(off_pts)::numeric / SUM(off_poss) * 100, 1)
            ELSE NULL END AS ortg,
          CASE WHEN SUM(def_poss) > 0
            THEN ROUND(SUM(def_pts)::numeric / SUM(def_poss) * 100, 1)
            ELSE NULL END AS drtg
        FROM lineup_agg
        GROUP BY split
      `);

      const rows = (result as any).rows ?? [];
      const onRow = rows.find((r: any) => r.split === "on") ?? {};
      const offRow = rows.find((r: any) => r.split === "off") ?? {};

      const toSplit = (r: any) => ({
        offPossessions: Number(r.off_poss ?? 0),
        defPossessions: Number(r.def_poss ?? 0),
        offPts: Number(r.off_pts ?? 0),
        defPts: Number(r.def_pts ?? 0),
        seconds: Number(r.seconds ?? 0),
        minutesPlayed: Math.round(Number(r.seconds ?? 0) / 60 * 10) / 10,
        ortg: r.ortg != null ? Number(r.ortg) : null,
        drtg: r.drtg != null ? Number(r.drtg) : null,
        netRtg:
          r.ortg != null && r.drtg != null
            ? Math.round((Number(r.ortg) - Number(r.drtg)) * 10) / 10
            : null,
      });

      const onSplit = toSplit(onRow);
      const offSplit = toSplit(offRow);

      res.json({
        playerExternalId,
        teamId,
        seasonId,
        on: onSplit,
        off: offSplit,
        netRtgDiff:
          onSplit.netRtg != null && offSplit.netRtg != null
            ? Math.round((onSplit.netRtg - offSplit.netRtg) * 10) / 10
            : null,
      });
    } catch (err: any) {
      console.error("[on-off]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/stats/players/all-detail — bulk player detail para prefetch desktop ─
  app.get("/api/stats/players/all-detail", requireAuth, async (req, res) => {
    const seasonId = Number(req.query.seasonId ?? 2092);
    const phaseType = "regular";
    const phaseFilter = sql`AND pgs.phase_type = ${phaseType}`;
    try {
      // Query 1: player summaries (misma estructura que /api/stats/player/:externalId)
      const summaryRows = await db.execute(sql`
        SELECT
          pgs.player_external_id              AS "externalId",
          sp.name_zh                          AS "nameZh",
          sp.name_en                          AS "nameEn",
          sp.jersey_number                    AS "jerseyNumber",
          sp.photo_url                        AS "photoUrl",
          sp.position,
          st.name_zh                          AS "teamName",
          st.name_en                          AS "teamNameEn",
          st.logo_url                         AS "teamLogo",
          st.external_id::text                AS "teamExternalId",
          COUNT(DISTINCT pgs.game_id)         AS games,
          ROUND(AVG(pgs.seconds_played / 60.0)::numeric, 1) AS mpg,
          ROUND(AVG(pgs.pts)::numeric, 1)     AS ppg,
          ROUND(AVG(pgs.reb)::numeric, 1)     AS rpg,
          ROUND(AVG(pgs.ast)::numeric, 1)     AS apg,
          ROUND(AVG(pgs.stl)::numeric, 1)     AS spg,
          ROUND(AVG(pgs.blk)::numeric, 1)     AS bpg,
          ROUND(AVG(pgs.tov)::numeric, 1)     AS topg,
          ROUND(CASE WHEN SUM(pgs.fga) > 0 THEN SUM(pgs.fgm)::numeric / SUM(pgs.fga) * 100 END, 1) AS "fgPct",
          ROUND(CASE WHEN SUM(pgs.fg3a) > 0 THEN SUM(pgs.fg3m)::numeric / SUM(pgs.fg3a) * 100 END, 1) AS "fg3Pct",
          ROUND(CASE WHEN SUM(pgs.fta) > 0 THEN SUM(pgs.ftm)::numeric / SUM(pgs.fta) * 100 END, 1) AS "ftPct",
          ROUND(CASE WHEN (SUM(pgs.fga) + 0.44 * SUM(pgs.fta)) > 0 THEN SUM(pgs.pts)::numeric / (2 * (SUM(pgs.fga) + 0.44 * SUM(pgs.fta))) * 100 END, 1) AS "tsPct",
          ROUND(CASE WHEN SUM(pgs.fga) > 0 THEN (SUM(pgs.fgm) + 0.5 * SUM(pgs.fg3m))::numeric / SUM(pgs.fga) * 100 END, 1) AS "eFGPct",
          ROUND(CASE WHEN SUM(pgs.fga) > 0 THEN SUM(pgs.fta)::numeric / SUM(pgs.fga) END, 3) AS "ftRate",
          ROUND(CASE WHEN SUM(pgs.tov) > 0 THEN SUM(pgs.ast)::numeric / SUM(pgs.tov) END, 2) AS "astTovRatio",
          ROUND(AVG(pgs.off_reb)::numeric, 1) AS "orbPerGame",
          ROUND(AVG(pgs.def_reb)::numeric, 1) AS "drbPerGame"
        FROM pbp_player_game_stats pgs
        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        JOIN stats_players sp ON sp.external_id::text = pgs.player_external_id
        JOIN stats_teams st ON st.id = pgs.team_id
        WHERE 1=1 ${phaseFilter}
        GROUP BY pgs.player_external_id, sp.name_zh, sp.name_en, sp.jersey_number, sp.photo_url, sp.position,
                 st.name_zh, st.name_en, st.logo_url, st.external_id
        HAVING COUNT(DISTINCT pgs.game_id) >= 3
      `);

      // Query 2: game logs (últimos 20 partidos por jugadora)
      const logRows = await db.execute(sql`
        SELECT
          pgs.player_external_id              AS "externalId",
          pgs.game_id                         AS "gameId",
          sg.scheduled_at                     AS "gameDate",
          rival.name_zh                       AS "rivalName",
          rival.name_en                       AS "rivalNameEn",
          CASE WHEN sg.home_team_id = pgs.team_id THEN 'home' ELSE 'away' END AS location,
          pgs.pts, pgs.reb, pgs.ast, pgs.stl, pgs.blk, pgs.tov,
          pgs.fgm, pgs.fga, pgs.fg3m, pgs.fg3a, pgs.ftm, pgs.fta,
          pgs.off_reb AS "offReb", pgs.def_reb AS "defReb",
          COALESCE(spb3.plus_minus, pgs.plus_minus) AS "plusMinus",
          pgs.is_starter AS "isStart",
          CASE WHEN pgs.seconds_played > 0 THEN LPAD((pgs.seconds_played / 60)::text, 1, '0') || ':' || LPAD((pgs.seconds_played % 60)::text, 2, '0') ELSE NULL END AS minutes,
          sg.home_score AS "homeScore", sg.away_score AS "awayScore",
          ROW_NUMBER() OVER (PARTITION BY pgs.player_external_id ORDER BY sg.scheduled_at DESC) AS rn
        FROM pbp_player_game_stats pgs
        JOIN stats_games sg ON sg.id = pgs.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
        JOIN stats_teams rival ON (
          CASE WHEN sg.home_team_id = pgs.team_id THEN sg.away_team_id ELSE sg.home_team_id END = rival.id
        )
        LEFT JOIN stats_player_boxscores spb3 ON spb3.game_id = pgs.game_id AND spb3.player_external_id::text = pgs.player_external_id
        WHERE pgs.phase_type = ${phaseType}
      `);

      const summaries = (summaryRows as any).rows ?? [];
      const logs = (logRows as any).rows ?? [];

      // Group logs by player (only last 20)
      const logsByPlayer: Record<string, any[]> = {};
      for (const row of logs) {
        const id = String(row.externalId);
        if (Number(row.rn) > 20) continue;
        if (!logsByPlayer[id]) logsByPlayer[id] = [];
        logsByPlayer[id].push({
          gameId: row.gameId,
          gameDate: row.gameDate ? String(row.gameDate).slice(0, 10) : null,
          rivalName: row.rivalName ?? null,
          rivalNameEn: row.rivalNameEn ?? null,
          score: row.homeScore != null && row.awayScore != null ? `${row.homeScore}-${row.awayScore}` : null,
          minutes: row.minutes ?? null,
          pts: Number(row.pts ?? 0),
          reb: Number(row.reb ?? 0),
          ast: Number(row.ast ?? 0),
          stl: Number(row.stl ?? 0),
          blk: Number(row.blk ?? 0),
          tov: Number(row.tov ?? 0),
          fgm: Number(row.fgm ?? 0), fga: Number(row.fga ?? 0),
          tpm: Number(row.fg3m ?? 0), tpa: Number(row.fg3a ?? 0),
          ftm: Number(row.ftm ?? 0), fta: Number(row.fta ?? 0),
          plusMinus: Number(row.plusMinus ?? 0),
          isStart: Boolean(row.isStart),
          isHome: String(row.location) === "home",
        });
      }

      // Assemble response
      const players: Record<string, any> = {};
      for (const r of summaries) {
        const id = String(r.externalId);
        players[id] = {
          player: {
            externalId: id,
            nameZh: r.nameZh ?? "",
            nameEn: r.nameEn ?? null,
            jerseyNumber: r.jerseyNumber ?? null,
            photoUrl: r.photoUrl ?? null,
            position: r.position ?? null,
            teamName: r.teamName ?? null,
            teamNameEn: r.teamNameEn ?? null,
            teamLogo: r.teamLogo ?? null,
            teamExternalId: r.teamExternalId ?? null,
            games: Number(r.games ?? 0),
            mpg: Number(r.mpg ?? 0), ppg: Number(r.ppg ?? 0),
            rpg: Number(r.rpg ?? 0), apg: Number(r.apg ?? 0),
            spg: Number(r.spg ?? 0), bpg: Number(r.bpg ?? 0), topg: Number(r.topg ?? 0),
            fgPct: r.fgPct != null ? Number(r.fgPct) : null,
            fg3Pct: r.fg3Pct != null ? Number(r.fg3Pct) : null,
            ftPct: r.ftPct != null ? Number(r.ftPct) : null,
            tsPct: r.tsPct != null ? Number(r.tsPct) : null,
            eFGPct: r.eFGPct != null ? Number(r.eFGPct) : null,
            ftRate: r.ftRate != null ? Number(r.ftRate) : null,
            astTovRatio: r.astTovRatio != null ? Number(r.astTovRatio) : null,
            usagePct: null, pie: null,
            orbPerGame: r.orbPerGame != null ? Number(r.orbPerGame) : null,
            drbPerGame: r.drbPerGame != null ? Number(r.drbPerGame) : null,
            homeSplit: { pts: 0, reb: 0, ast: 0 },
            awaySplit: { pts: 0, reb: 0, ast: 0 },
          },
          gameLog: logsByPlayer[id] ?? [],
        };
      }

      res.set("Cache-Control", "private, max-age=600, stale-while-revalidate=60");
      return res.json({ players });
    } catch (err) {
      console.error("[stats/players/all-detail] error:", (err as any)?.message ?? err);
      return res.json({ players: {} });
    }
  });

  app.get("/api/stats/players/combined", async (req, res) => {
    try {
      const teamId = Number(req.query.teamId);
      const seasonId = Number(req.query.seasonId ?? 2092);
      const minPoss = Number(req.query.minPossessions ?? 5);
      const playerIdsParam = String(req.query.playerIds ?? "");

      if (!playerIdsParam || !teamId) {
        return res.status(400).json({ error: "playerIds and teamId required" });
      }

      const playerIds = playerIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (playerIds.length < 2 || playerIds.length > 5) {
        return res.status(400).json({ error: "playerIds must be 2-5 ids" });
      }

      const result = await db.execute(sql`
        SELECT
          lineup_id,
          SUM(seconds_played)   AS seconds,
          SUM(off_possessions)  AS off_poss,
          SUM(def_possessions)  AS def_poss,
          SUM(off_pts)          AS off_pts,
          SUM(def_pts)          AS def_pts,
          SUM(off_reb)          AS off_reb,
          SUM(def_reb)          AS def_reb,
          SUM(tov)              AS tov,
          SUM(stl)              AS stl,
          COUNT(DISTINCT game_id) AS games
        FROM pbp_lineup_stats
        WHERE team_id = ${teamId}
          AND season_id = ${seasonId}
          AND (
            ${sql.raw(
              playerIds.map((pid) => `lineup_id ~ '(^|-)${pid}(-|$)'`).join(" AND "),
            )}
          )
        GROUP BY lineup_id
        HAVING SUM(off_possessions) >= ${minPoss}
      `);

      const rows = (result as any).rows ?? [];

      const totalOff = rows.reduce((s: number, r: any) => s + Number(r.off_poss ?? 0), 0);
      const totalDef = rows.reduce((s: number, r: any) => s + Number(r.def_poss ?? 0), 0);
      const totalOffPts = rows.reduce((s: number, r: any) => s + Number(r.off_pts ?? 0), 0);
      const totalDefPts = rows.reduce((s: number, r: any) => s + Number(r.def_pts ?? 0), 0);
      const totalSec = rows.reduce((s: number, r: any) => s + Number(r.seconds ?? 0), 0);

      const ortg = totalOff > 0 ? Math.round((totalOffPts / totalOff) * 100 * 10) / 10 : null;
      const drtg = totalDef > 0 ? Math.round((totalDefPts / totalDef) * 100 * 10) / 10 : null;

      res.json({
        playerIds,
        teamId,
        seasonId,
        lineupsFound: rows.length,
        totalSeconds: totalSec,
        minutesPlayed: Math.round((totalSec / 60) * 10) / 10,
        offPossessions: totalOff,
        defPossessions: totalDef,
        offPts: totalOffPts,
        defPts: totalDefPts,
        ortg,
        drtg,
        netRtg: ortg != null && drtg != null ? Math.round((ortg - drtg) * 10) / 10 : null,
        offPpp: totalOff > 0 ? Math.round((totalOffPts / totalOff) * 1000) / 1000 : null,
        defPpp: totalDef > 0 ? Math.round((totalDefPts / totalDef) * 1000) / 1000 : null,
        lineups: rows.map((r: any) => ({
          lineupId: r.lineup_id,
          seconds: Number(r.seconds ?? 0),
          offPoss: Number(r.off_poss ?? 0),
          defPoss: Number(r.def_poss ?? 0),
          ortg:
            Number(r.off_poss ?? 0) > 0
              ? Math.round((Number(r.off_pts ?? 0) / Number(r.off_poss)) * 100 * 10) / 10
              : null,
        })),
      });
    } catch (err: any) {
      console.error("[combined]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Playbook plans (Supabase playbook_plans) ───────────────────────────────
  function mapPlaybookPlanRow(row: Record<string, unknown>) {
    return {
      id: String(row.id),
      clubId: String(row.club_id),
      type: String(row.type ?? "defensive"),
      name: String(row.name ?? ""),
      opponentName: (row.opponent_name as string | null) ?? null,
      gameId: row.game_id != null ? Number(row.game_id) : null,
      seasonLabel: (row.season_label as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      answers: (row.answers as Record<string, unknown>) ?? {},
      report: (row.report as Record<string, unknown>) ?? {},
      visibility: row.visibility as "draft" | "staff" | "players",
      createdBy: String(row.created_by),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      publishedAt: (row.published_at as string | null) ?? null,
      publishedBy: (row.published_by as string | null) ?? null,
    };
  }

  async function playbookClubId(req: Request, res: import("express").Response): Promise<string | null> {
    const club = await storage.getClubForUser(req.user!.id);
    if (!club) {
      res.status(400).json({ error: "No club" });
      return null;
    }
    return club.id;
  }

  app.get("/api/playbook/plans", requireAuth, async (req, res) => {
    try {
      const clubId = await playbookClubId(req, res);
      if (!clubId) return;

      const supabase = getSupabaseAdmin()!;
      const uid = req.user!.id;
      const role = req.user!.role;

      let query = supabase
        .from("playbook_plans")
        .select("*")
        .eq("club_id", clubId)
        .order("updated_at", { ascending: false });

      if (role === "player") {
        query = query.eq("visibility", "players");
      } else {
        query = query.or(
          `and(visibility.eq.draft,created_by.eq.${uid}),visibility.in.(staff,players)`,
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error("[playbook/plans GET]", error.message);
        return res.status(500).json({ error: error.message });
      }

      res.json((data ?? []).map((row) => mapPlaybookPlanRow(row as Record<string, unknown>)));
    } catch (err: any) {
      console.error("[playbook/plans GET]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/playbook/plans", requireAuth, async (req, res) => {
    try {
      const clubId = await playbookClubId(req, res);
      if (!clubId) return;

      const body = req.body ?? {};
      const supabase = getSupabaseAdmin()!;
      const insertRow = {
        club_id: clubId,
        type: body.type ?? "defensive",
        name: body.name ?? "Untitled",
        answers: body.answers ?? {},
        report: body.report ?? {},
        opponent_name: body.opponent_name ?? body.opponentName ?? null,
        game_id: body.game_id ?? body.gameId ?? null,
        season_label: body.season_label ?? body.seasonLabel ?? null,
        notes: body.notes ?? null,
        visibility: body.visibility ?? "draft",
        created_by: req.user!.id,
      };

      const { data, error } = await supabase
        .from("playbook_plans")
        .insert(insertRow)
        .select("*")
        .single();

      if (error) {
        console.error("[playbook/plans POST]", error.message);
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json(mapPlaybookPlanRow(data as Record<string, unknown>));
    } catch (err: any) {
      console.error("[playbook/plans POST]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/playbook/plans/:id", requireAuth, async (req, res) => {
    try {
      const clubId = await playbookClubId(req, res);
      if (!clubId) return;

      const planId = req.params.id as string;
      const supabase = getSupabaseAdmin()!;
      const uid = req.user!.id;
      const role = req.user!.role;

      const { data: existing, error: fetchErr } = await supabase
        .from("playbook_plans")
        .select("*")
        .eq("id", planId)
        .eq("club_id", clubId)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: "Plan not found" });
      }

      const canEdit =
        existing.created_by === uid ||
        role === "head_coach" ||
        role === "coach";
      if (!canEdit) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.name !== undefined) patch.name = body.name;
      if (body.answers !== undefined) patch.answers = body.answers;
      if (body.report !== undefined) patch.report = body.report;
      if (body.opponent_name !== undefined) patch.opponent_name = body.opponent_name;
      if (body.opponentName !== undefined) patch.opponent_name = body.opponentName;
      if (body.game_id !== undefined) patch.game_id = body.game_id;
      if (body.gameId !== undefined) patch.game_id = body.gameId;
      if (body.season_label !== undefined) patch.season_label = body.season_label;
      if (body.seasonLabel !== undefined) patch.season_label = body.seasonLabel;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (body.published_at !== undefined) patch.published_at = body.published_at;
      if (body.publishedAt !== undefined) patch.published_at = body.publishedAt;
      if (body.published_by !== undefined) patch.published_by = body.published_by;
      if (body.publishedBy !== undefined) patch.published_by = body.publishedBy;

      if (body.visibility !== undefined) {
        patch.visibility = body.visibility;
        if (
          (body.visibility === "staff" || body.visibility === "players") &&
          !existing.published_at &&
          body.published_at == null &&
          body.publishedAt == null
        ) {
          patch.published_at = new Date().toISOString();
          patch.published_by = uid;
        }
      }

      const { data, error } = await supabase
        .from("playbook_plans")
        .update(patch)
        .eq("id", planId)
        .eq("club_id", clubId)
        .select("*")
        .single();

      if (error) {
        console.error("[playbook/plans PATCH]", error.message);
        return res.status(500).json({ error: error.message });
      }

      res.json(mapPlaybookPlanRow(data as Record<string, unknown>));
    } catch (err: any) {
      console.error("[playbook/plans PATCH]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/playbook/plans/:id", requireAuth, async (req, res) => {
    try {
      const clubId = await playbookClubId(req, res);
      if (!clubId) return;

      const planId = req.params.id as string;
      const supabase = getSupabaseAdmin()!;
      const uid = req.user!.id;

      const { data: existing, error: fetchErr } = await supabase
        .from("playbook_plans")
        .select("id, created_by, club_id")
        .eq("id", planId)
        .eq("club_id", clubId)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: "Plan not found" });
      }

      if (existing.created_by !== uid) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { error } = await supabase
        .from("playbook_plans")
        .delete()
        .eq("id", planId)
        .eq("club_id", clubId);

      if (error) {
        console.error("[playbook/plans DELETE]", error.message);
        return res.status(500).json({ error: error.message });
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[playbook/plans DELETE]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
