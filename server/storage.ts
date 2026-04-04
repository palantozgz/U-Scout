import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  type User,
  type InsertUser,
  type Team,
  type InsertTeam,
  type Player,
  type InsertPlayer,
  type Invitation,
  type InsertInvitation,
  type TeamMember,
  type InsertTeamMember,
  type ScoutingReportAssignment,
  type InsertScoutingReportAssignment,
  type Club,
  type InsertClub,
  type ClubMember,
  type InsertClubMember,
  type ClubInvitation,
  type InsertClubInvitation,
  users,
  teams,
  players,
  invitations,
  teamMembers,
  scoutingReportAssignments,
  clubs,
  clubMembers,
  clubInvitations,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<void>;

  getPlayers(teamId?: string): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, updates: Partial<InsertPlayer>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<void>;

  createInvitation(row: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  markInvitationUsed(id: string, userId: string): Promise<void>;

  upsertTeamMember(row: InsertTeamMember): Promise<TeamMember>;
  getTeamMember(userId: string, teamId: string): Promise<TeamMember | undefined>;
  getPrimaryTeamMemberForUser(userId: string): Promise<(TeamMember & { team: Team }) | undefined>;

  createScoutingReportAssignment(row: InsertScoutingReportAssignment): Promise<ScoutingReportAssignment>;
  listScoutingReportsForUser(userId: string): Promise<
    Array<{
      assignmentId: string;
      assignedAt: Date;
      player: Player;
      team: Team;
    }>
  >;

  listTeamMembersByTeam(teamId: string): Promise<TeamMember[]>;
  getTeamMemberById(id: string): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<void>;

  getInvitationById(id: string): Promise<Invitation | undefined>;
  deleteInvitation(id: string): Promise<void>;
  listActiveInvitationsByTeam(teamId: string): Promise<Invitation[]>;

  listScoutingAssignmentsForTeam(teamId: string): Promise<
    Array<{
      id: string;
      userId: string;
      playerId: string;
      playerName: string;
      createdAt: Date;
    }>
  >;

  getClubByOwnerId(ownerId: string): Promise<Club | undefined>;
  getClubById(id: string): Promise<Club | undefined>;
  getClubForUser(userId: string): Promise<Club | undefined>;
  createClub(row: InsertClub): Promise<Club>;
  updateClub(id: string, updates: Partial<{ name: string; logo: string }>): Promise<Club | undefined>;

  createClubMember(row: InsertClubMember): Promise<ClubMember>;
  listClubMembers(clubId: string): Promise<ClubMember[]>;
  getClubMemberById(id: string): Promise<ClubMember | undefined>;
  getClubMemberByClubAndUser(clubId: string, userId: string): Promise<ClubMember | undefined>;
  deleteClubMember(id: string): Promise<void>;
  updateClubMemberStatus(id: string, status: "active" | "banned"): Promise<ClubMember | undefined>;

  createClubInvitation(row: InsertClubInvitation): Promise<ClubInvitation>;
  getClubInvitationByToken(token: string): Promise<ClubInvitation | undefined>;
  getClubInvitationById(id: string): Promise<ClubInvitation | undefined>;
  listActiveClubInvitations(clubId: string): Promise<ClubInvitation[]>;
  markClubInvitationUsed(id: string, userId: string): Promise<void>;
  deleteClubInvitation(id: string): Promise<void>;

  getAssignmentStatsForUsers(userIds: string[]): Promise<Map<string, { count: number; lastAt: Date | null }>>;
  getPlayerCountsByCreator(userIds: string[]): Promise<Map<string, number>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTeams(): Promise<Team[]> {
    return db.select().from(teams);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getPlayers(teamId?: string): Promise<Player[]> {
    if (teamId) {
      return db.select().from(players).where(eq(players.teamId, teamId));
    }
    return db.select().from(players);
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [created] = await db.insert(players).values(player).returning();
    return created;
  }

  async updatePlayer(id: string, updates: Partial<InsertPlayer>): Promise<Player | undefined> {
    const [updated] = await db.update(players).set(updates).where(eq(players.id, id)).returning();
    return updated;
  }

  async deletePlayer(id: string): Promise<void> {
    await db.delete(players).where(eq(players.id, id));
  }

  async createInvitation(row: InsertInvitation): Promise<Invitation> {
    const [created] = await db.insert(invitations).values(row).returning();
    return created;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
    return inv;
  }

  async markInvitationUsed(id: string, userId: string): Promise<void> {
    await db.update(invitations).set({ usedBy: userId }).where(eq(invitations.id, id));
  }

  async upsertTeamMember(row: InsertTeamMember): Promise<TeamMember> {
    const [existing] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, row.userId), eq(teamMembers.teamId, row.teamId)));
    if (existing) {
      const [updated] = await db
        .update(teamMembers)
        .set({
          role: row.role,
          jerseyNumber: row.jerseyNumber ?? existing.jerseyNumber,
          position: row.position ?? existing.position,
          displayName: row.displayName ?? existing.displayName,
        })
        .where(eq(teamMembers.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(teamMembers).values(row).returning();
    return created;
  }

  async getTeamMember(userId: string, teamId: string): Promise<TeamMember | undefined> {
    const [m] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)));
    return m;
  }

  async getPrimaryTeamMemberForUser(userId: string): Promise<(TeamMember & { team: Team }) | undefined> {
    const rows = await db
      .select({ member: teamMembers, team: teams })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    const r = rows[0];
    if (!r) return undefined;
    return { ...r.member, team: r.team };
  }

  async createScoutingReportAssignment(
    row: InsertScoutingReportAssignment,
  ): Promise<ScoutingReportAssignment> {
    const [created] = await db.insert(scoutingReportAssignments).values(row).returning();
    return created;
  }

  async listScoutingReportsForUser(userId: string): Promise<
    Array<{
      assignmentId: string;
      assignedAt: Date;
      player: Player;
      team: Team;
    }>
  > {
    const rows = await db
      .select({
        assignment: scoutingReportAssignments,
        player: players,
        team: teams,
      })
      .from(scoutingReportAssignments)
      .innerJoin(players, eq(scoutingReportAssignments.playerId, players.id))
      .innerJoin(teams, eq(players.teamId, teams.id))
      .where(eq(scoutingReportAssignments.userId, userId))
      .orderBy(desc(scoutingReportAssignments.createdAt));

    return rows.map((r) => ({
      assignmentId: r.assignment.id,
      assignedAt: r.assignment.createdAt,
      player: r.player,
      team: r.team,
    }));
  }

  async listTeamMembersByTeam(teamId: string): Promise<TeamMember[]> {
    return db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(desc(teamMembers.createdAt));
  }

  async getTeamMemberById(id: string): Promise<TeamMember | undefined> {
    const [m] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return m;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  async getInvitationById(id: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, id));
    return inv;
  }

  async deleteInvitation(id: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, id));
  }

  async listActiveInvitationsByTeam(teamId: string): Promise<Invitation[]> {
    const now = new Date();
    return db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.teamId, teamId),
          isNull(invitations.usedBy),
          gt(invitations.expiresAt, now),
        ),
      )
      .orderBy(desc(invitations.createdAt));
  }

  async listScoutingAssignmentsForTeam(teamId: string): Promise<
    Array<{
      id: string;
      userId: string;
      playerId: string;
      playerName: string;
      createdAt: Date;
    }>
  > {
    const rows = await db
      .select({
        a: scoutingReportAssignments,
        p: players,
      })
      .from(scoutingReportAssignments)
      .innerJoin(players, eq(scoutingReportAssignments.playerId, players.id))
      .where(eq(players.teamId, teamId))
      .orderBy(desc(scoutingReportAssignments.createdAt));

    return rows.map((r) => ({
      id: r.a.id,
      userId: r.a.userId,
      playerId: r.a.playerId,
      playerName: r.p.name || "—",
      createdAt: r.a.createdAt,
    }));
  }

  async getClubByOwnerId(ownerId: string): Promise<Club | undefined> {
    const [c] = await db.select().from(clubs).where(eq(clubs.ownerId, ownerId));
    return c;
  }

  async getClubById(id: string): Promise<Club | undefined> {
    const [c] = await db.select().from(clubs).where(eq(clubs.id, id));
    return c;
  }

  async getClubForUser(userId: string): Promise<Club | undefined> {
    const owned = await this.getClubByOwnerId(userId);
    if (owned) return owned;
    const [row] = await db
      .select({ c: clubs })
      .from(clubMembers)
      .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
      .where(eq(clubMembers.userId, userId))
      .limit(1);
    return row?.c;
  }

  async createClub(row: InsertClub): Promise<Club> {
    const [created] = await db.insert(clubs).values(row).returning();
    return created;
  }

  async updateClub(id: string, updates: Partial<{ name: string; logo: string }>): Promise<Club | undefined> {
    const [updated] = await db.update(clubs).set(updates).where(eq(clubs.id, id)).returning();
    return updated;
  }

  async createClubMember(row: InsertClubMember): Promise<ClubMember> {
    const [created] = await db.insert(clubMembers).values(row).returning();
    return created;
  }

  async listClubMembers(clubId: string): Promise<ClubMember[]> {
    return db
      .select()
      .from(clubMembers)
      .where(eq(clubMembers.clubId, clubId))
      .orderBy(desc(clubMembers.createdAt));
  }

  async getClubMemberById(id: string): Promise<ClubMember | undefined> {
    const [m] = await db.select().from(clubMembers).where(eq(clubMembers.id, id));
    return m;
  }

  async getClubMemberByClubAndUser(clubId: string, userId: string): Promise<ClubMember | undefined> {
    const [m] = await db
      .select()
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
    return m;
  }

  async deleteClubMember(id: string): Promise<void> {
    await db.delete(clubMembers).where(eq(clubMembers.id, id));
  }

  async updateClubMemberStatus(id: string, status: "active" | "banned"): Promise<ClubMember | undefined> {
    const [updated] = await db
      .update(clubMembers)
      .set({ status })
      .where(eq(clubMembers.id, id))
      .returning();
    return updated;
  }

  async createClubInvitation(row: InsertClubInvitation): Promise<ClubInvitation> {
    const [created] = await db.insert(clubInvitations).values(row).returning();
    return created;
  }

  async getClubInvitationByToken(token: string): Promise<ClubInvitation | undefined> {
    const [inv] = await db.select().from(clubInvitations).where(eq(clubInvitations.token, token));
    return inv;
  }

  async getClubInvitationById(id: string): Promise<ClubInvitation | undefined> {
    const [inv] = await db.select().from(clubInvitations).where(eq(clubInvitations.id, id));
    return inv;
  }

  async listActiveClubInvitations(clubId: string): Promise<ClubInvitation[]> {
    const now = new Date();
    return db
      .select()
      .from(clubInvitations)
      .where(
        and(
          eq(clubInvitations.clubId, clubId),
          isNull(clubInvitations.usedBy),
          gt(clubInvitations.expiresAt, now),
        ),
      )
      .orderBy(desc(clubInvitations.createdAt));
  }

  async markClubInvitationUsed(id: string, userId: string): Promise<void> {
    await db.update(clubInvitations).set({ usedBy: userId }).where(eq(clubInvitations.id, id));
  }

  async deleteClubInvitation(id: string): Promise<void> {
    await db.delete(clubInvitations).where(eq(clubInvitations.id, id));
  }

  async getAssignmentStatsForUsers(userIds: string[]): Promise<
    Map<string, { count: number; lastAt: Date | null }>
  > {
    const map = new Map<string, { count: number; lastAt: Date | null }>();
    if (!userIds.length) return map;
    const rows = await db
      .select({
        uid: scoutingReportAssignments.userId,
        cnt: sql<number>`count(*)::int`,
        lastAt: sql<Date | null>`max(${scoutingReportAssignments.createdAt})`,
      })
      .from(scoutingReportAssignments)
      .where(inArray(scoutingReportAssignments.userId, userIds))
      .groupBy(scoutingReportAssignments.userId);
    for (const uid of userIds) {
      map.set(uid, { count: 0, lastAt: null });
    }
    for (const r of rows) {
      map.set(r.uid, { count: Number(r.cnt), lastAt: r.lastAt });
    }
    return map;
  }

  async getPlayerCountsByCreator(userIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!userIds.length) return map;
    for (const uid of userIds) map.set(uid, 0);
    const rows = await db
      .select({
        uid: players.createdByUserId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(players)
      .where(inArray(players.createdByUserId, userIds))
      .groupBy(players.createdByUserId);
    for (const r of rows) {
      if (r.uid) map.set(r.uid, Number(r.cnt));
    }
    return map;
  }
}

export const storage = new DatabaseStorage();
