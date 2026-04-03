import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTeamSchema, insertPlayerSchema } from "@shared/schema";
import { requireAuth } from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      const team = await storage.updateTeam(req.params.id, parsed.data);
      if (!team) return res.status(404).json({ error: "Team not found" });
      res.json(team);
    } catch (err) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTeam(req.params.id);
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
      const player = await storage.getPlayer(req.params.id);
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
      const player = await storage.createPlayer(parsed.data);
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
      const player = await storage.updatePlayer(req.params.id, parsed.data);
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to update player" });
    }
  });

  app.delete("/api/players/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePlayer(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete player" });
    }
  });

  return httpServer;
}
