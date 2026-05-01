import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
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
  type ReportApproval,
  type ReportOverride,
  users,
  teams,
  players,
  invitations,
  teamMembers,
  scoutingReportAssignments,
  clubs,
  clubMembers,
  clubInvitations,
  reportApprovals,
  reportOverrides,
  reportPublications,
  playerReportViews,
} from "@shared/schema";

// ── Scout version types (player_scout_versions table — raw SQL, not in schema.ts) ──
export interface ScoutVersion {
  id: string;
  playerId: string;
  coachId: string;
  inputs: Record<string, unknown>;
  submittedAt: Date | null;
  status: "draft" | "submitted" | "merged";
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueMatch {
  id: string;
  clubId: string;
  rivalName: string;
  matchDate: Date;
  location: string | null;
  matchType: string;
  createdAt: Date;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getTeams(clubId?: string): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<void>;

  getPlayers(teamId?: string, clubId?: string, viewerUserId?: string): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, updates: Partial<InsertPlayer>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<void>;

  createInvitation(row: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  markInvitationUsed(id: string, userId: string): Promise<void>;
  markInvitationUsedIfUnused(id: string, userId: string): Promise<boolean>;

  upsertTeamMember(row: InsertTeamMember): Promise<TeamMember>;
  getTeamMember(userId: string, teamId: string): Promise<TeamMember | undefined>;
  getPrimaryTeamMemberForUser(userId: string): Promise<(TeamMember & { team: Team }) | undefined>;

  createScoutingReportAssignment(row: InsertScoutingReportAssignment): Promise<ScoutingReportAssignment>;
  createScoutingReportAssignmentIfNotExists(row: InsertScoutingReportAssignment): Promise<void>;
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
  /** Club for approval staff tally: membership club first, else owned club. */
  findClubForApprovalStaff(userId: string): Promise<Club | undefined>;
  createClub(row: InsertClub): Promise<Club>;
  updateClub(
    id: string,
    updates: Partial<Pick<Club, "name" | "logo" | "leagueType" | "gender" | "level" | "ageCategory">>,
  ): Promise<Club | undefined>;

  createClubMember(row: InsertClubMember): Promise<ClubMember>;
  listClubMembers(clubId: string): Promise<ClubMember[]>;
  getClubMemberById(id: string): Promise<ClubMember | undefined>;
  getClubMemberByClubAndUser(clubId: string, userId: string): Promise<ClubMember | undefined>;
  /** Most-recent club member row for this user (any status). */
  getLatestClubMemberByUser(userId: string): Promise<ClubMember | undefined>;
  deleteClubMember(id: string): Promise<void>;
  updateClubMemberStatus(id: string, status: "active" | "banned"): Promise<ClubMember | undefined>;
  updateClubMemberOperationsAccess(id: string, operationsAccess: boolean): Promise<ClubMember | undefined>;

  createClubInvitation(row: InsertClubInvitation): Promise<ClubInvitation>;
  getClubInvitationByToken(token: string): Promise<ClubInvitation | undefined>;
  getClubInvitationById(id: string): Promise<ClubInvitation | undefined>;
  listActiveClubInvitations(clubId: string): Promise<ClubInvitation[]>;
  markClubInvitationUsed(id: string, userId: string): Promise<void>;
  markClubInvitationUsedIfUnused(id: string, userId: string): Promise<boolean>;
  deleteClubInvitation(id: string): Promise<void>;

  getAssignmentStatsForUsers(userIds: string[]): Promise<Map<string, { count: number; lastAt: Date | null }>>;
  getPlayerCountsByCreator(userIds: string[]): Promise<Map<string, number>>;

  countClubStaffCoaches(clubId: string): Promise<number>;
  listReportApprovalsForPlayer(playerId: string): Promise<ReportApproval[]>;
  upsertReportApproval(playerId: string, coachId: string): Promise<void>;
  deleteReportApproval(playerId: string, coachId: string): Promise<void>;
  listReportOverridesForPlayer(playerId: string): Promise<ReportOverride[]>;
  upsertReportOverride(row: {
    playerId: string;
    coachId: string;
    slide: string;
    itemKey: string;
    action: "hide" | "keep";
  }): Promise<void>;
  deleteReportOverride(playerId: string, coachId: string, itemKey: string): Promise<void>;
  publishPlayerReport(playerId: string, publishedBy: string): Promise<Player | undefined>;
  unpublishPlayerReport(playerId: string): Promise<Player | undefined>;

  // is_canonical management
  setPlayerCanonical(playerId: string, isCanonical: boolean): Promise<void>;

  // player_scout_versions management
  upsertScoutVersion(playerId: string, coachId: string, inputs: Record<string, unknown>): Promise<ScoutVersion>;
  getScoutVersion(playerId: string, coachId: string): Promise<ScoutVersion | undefined>;
  listScoutVersionsForPlayer(playerId: string): Promise<ScoutVersion[]>;
  submitScoutVersion(playerId: string, coachId: string): Promise<void>;
  mergeAndClearScoutVersions(playerId: string): Promise<void>;

  // league_matches
  listLeagueMatches(clubId: string): Promise<LeagueMatch[]>;
  createLeagueMatch(data: { clubId: string; rivalName: string; matchDate: Date; location?: string; matchType?: string }): Promise<LeagueMatch>;
  deleteLeagueMatch(id: string): Promise<void>;

  userHasScoutingReportAssignment(userId: string, playerId: string): Promise<boolean>;
  recordPlayerReportSlideView(userId: string, playerId: string, slideIndex: number): Promise<void>;
  listPlayerTeamsReportSummary(
    userId: string,
  ): Promise<Array<{ team: Team; totalReports: number; unseenCount: number }>>;
  listAssignedPlayersInTeamForUser(
    userId: string,
    teamId: string,
  ): Promise<Array<{ player: Player; viewStatus: "none" | "partial" | "complete" }>>;
}

function rowToScoutVersion(row: Record<string, unknown>): ScoutVersion {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    coachId: row.coach_id as string,
    inputs: row.inputs as Record<string, unknown>,
    submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : null,
    status: row.status as "draft" | "submitted" | "merged",
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToMatch(row: Record<string, unknown>): LeagueMatch {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    rivalName: row.rival_name as string,
    matchDate: new Date(row.match_date as string),
    location: row.location as string | null,
    matchType: row.match_type as string,
    createdAt: new Date(row.created_at as string),
  };
}

export class DatabaseStorage implements IStorage {
  private async getActiveClubUserIds(clubId: string): Promise<string[]> {
    const rows = await db
      .select({ uid: clubMembers.userId })
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, "active")));
    return rows.map((r) => r.uid);
  }

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

  async getTeams(clubId?: string): Promise<Team[]> {
    if (clubId) {
      const rows = await db.execute(
        sql`SELECT *,
          primary_color as "primaryColor",
          is_system as "isSystem",
          club_id as "clubId",
          created_at as "createdAt"
        FROM teams WHERE club_id = ${clubId} ORDER BY is_system ASC, created_at ASC`,
      );
      const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
      return arr as Team[];
    }
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

  async getPlayers(teamId?: string, clubId?: string, viewerUserId?: string): Promise<Player[]> {
    if (!clubId) {
      const rows = teamId
        ? await db.execute(sql`SELECT *,
            is_canonical as "isCanonical",
            team_id as "teamId",
            created_by_user_id as "createdByUserId",
            created_by_user_id as "createdByCoachId"
          FROM players WHERE team_id = ${teamId}`)
        : await db.execute(sql`SELECT *,
            is_canonical as "isCanonical",
            team_id as "teamId",
            created_by_user_id as "createdByUserId",
            created_by_user_id as "createdByCoachId"
          FROM players`);
      const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
      return arr as Player[];
    }

    const userIds = await this.getActiveClubUserIds(clubId);
    const rows = teamId
      ? await db.execute(
          userIds.length > 0
            ? sql`SELECT *,
                is_canonical as "isCanonical",
                team_id as "teamId",
                created_by_user_id as "createdByUserId",
                created_by_user_id as "createdByCoachId"
              FROM players
              WHERE (is_canonical = true OR created_by_user_id ${viewerUserId ? sql`= ${viewerUserId}` : sql`IN (${sql.join(userIds.map((id) => sql`${id}`), sql`,`)})`})
                AND team_id = ${teamId}`
            : sql`SELECT *,
                is_canonical as "isCanonical",
                team_id as "teamId",
                created_by_user_id as "createdByUserId",
                created_by_user_id as "createdByCoachId"
              FROM players
              WHERE is_canonical = true AND team_id = ${teamId}`,
        )
      : await db.execute(
          userIds.length > 0
            ? sql`SELECT *,
                is_canonical as "isCanonical",
                team_id as "teamId",
                created_by_user_id as "createdByUserId",
                created_by_user_id as "createdByCoachId"
              FROM players
              WHERE (is_canonical = true OR created_by_user_id ${viewerUserId ? sql`= ${viewerUserId}` : sql`IN (${sql.join(userIds.map((id) => sql`${id}`), sql`,`)})`})`
            : sql`SELECT *,
                is_canonical as "isCanonical",
                team_id as "teamId",
                created_by_user_id as "createdByUserId",
                created_by_user_id as "createdByCoachId"
              FROM players
              WHERE is_canonical = true`,
        );
    const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
    return arr as Player[];
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const rows = await db.execute(sql`SELECT *,
      is_canonical as "isCanonical",
      team_id as "teamId",
      created_by_user_id as "createdByUserId",
      created_by_user_id as "createdByCoachId"
    FROM players WHERE id = ${id}`);
    const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
    return arr[0] as Player | undefined;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [created] = await db.insert(players).values(player).returning();
    // Fetch again with is_canonical included (not in Drizzle schema)
    const rows = await db.execute(sql`SELECT *,
      is_canonical as "isCanonical",
      team_id as "teamId",
      created_by_user_id as "createdByUserId",
      created_by_user_id as "createdByCoachId"
    FROM players WHERE id = ${created.id}`);
    const arr = (rows as any).rows ?? (rows as unknown as any[]);
    return (arr[0] ?? created) as Player;
  }

  async updatePlayer(id: string, updates: Partial<InsertPlayer>): Promise<Player | undefined> {
    const [updated] = await db.update(players).set(updates).where(eq(players.id, id)).returning();
    if (!updated) return undefined;
    // Fetch again with is_canonical included
    const rows = await db.execute(sql`SELECT *,
      is_canonical as "isCanonical",
      team_id as "teamId",
      created_by_user_id as "createdByUserId",
      created_by_user_id as "createdByCoachId"
    FROM players WHERE id = ${id}`);
    const arr = (rows as any).rows ?? (rows as unknown as any[]);
    return (arr[0] ?? updated) as Player;
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

  async markInvitationUsedIfUnused(id: string, userId: string): Promise<boolean> {
    const rows = await db.execute(sql`
      UPDATE invitations
      SET used_by = ${userId}
      WHERE id = ${id} AND used_by IS NULL
      RETURNING id
    `);
    const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
    return Array.isArray(arr) && arr.length > 0;
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

  async createScoutingReportAssignmentIfNotExists(row: InsertScoutingReportAssignment): Promise<void> {
    await db.execute(sql`
      INSERT INTO scouting_report_assignments (user_id, player_id, created_by)
      VALUES (${row.userId}, ${row.playerId}, ${row.createdBy ?? null})
      ON CONFLICT (user_id, player_id) DO NOTHING
    `);
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
      .where(and(eq(clubMembers.userId, userId), eq(clubMembers.status, "active")))
      .limit(1);
    return row?.c;
  }

  async findClubForApprovalStaff(userId: string): Promise<Club | undefined> {
    const [viaMember] = await db
      .select({ c: clubs })
      .from(clubMembers)
      .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
      .where(and(eq(clubMembers.userId, userId), eq(clubMembers.status, "active")))
      .orderBy(desc(clubMembers.createdAt))
      .limit(1);
    if (viaMember?.c) return viaMember.c;
    return this.getClubByOwnerId(userId);
  }

  async createClub(row: InsertClub): Promise<Club> {
    const [created] = await db.insert(clubs).values(row).returning();
    return created;
  }

  async updateClub(
    id: string,
    updates: Partial<Pick<Club, "name" | "logo" | "leagueType" | "gender" | "level" | "ageCategory">>,
  ): Promise<Club | undefined> {
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

  async getLatestClubMemberByUser(userId: string): Promise<ClubMember | undefined> {
    const [m] = await db
      .select()
      .from(clubMembers)
      .where(eq(clubMembers.userId, userId))
      .orderBy(desc(clubMembers.createdAt))
      .limit(1);
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

  async updateClubMemberOperationsAccess(
    id: string,
    operationsAccess: boolean,
  ): Promise<ClubMember | undefined> {
    const [updated] = await db
      .update(clubMembers)
      .set({ operationsAccess })
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

  async markClubInvitationUsedIfUnused(id: string, userId: string): Promise<boolean> {
    const rows = await db.execute(sql`
      UPDATE club_invitations
      SET used_by = ${userId}
      WHERE id = ${id} AND used_by IS NULL
      RETURNING id
    `);
    const arr = (rows as any).rows ?? ((rows as unknown) as any[]);
    return Array.isArray(arr) && arr.length > 0;
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

  async countClubStaffCoaches(clubId: string): Promise<number> {
    const rows = await db
      .select({ id: clubMembers.id })
      .from(clubMembers)
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.status, "active"),
          or(eq(clubMembers.role, "coach"), eq(clubMembers.role, "head_coach")),
        ),
      );
    return rows.length;
  }

  async listReportApprovalsForPlayer(playerId: string): Promise<ReportApproval[]> {
    return db.select().from(reportApprovals).where(eq(reportApprovals.playerId, playerId));
  }

  async upsertReportApproval(playerId: string, coachId: string): Promise<void> {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(reportApprovals)
      .where(and(eq(reportApprovals.playerId, playerId), eq(reportApprovals.coachId, coachId)));
    if (existing) {
      await db
        .update(reportApprovals)
        .set({ approvedAt: now })
        .where(eq(reportApprovals.id, existing.id));
    } else {
      await db.insert(reportApprovals).values({ playerId, coachId, approvedAt: now });
    }
  }

  async deleteReportApproval(playerId: string, coachId: string): Promise<void> {
    await db
      .delete(reportApprovals)
      .where(and(eq(reportApprovals.playerId, playerId), eq(reportApprovals.coachId, coachId)));
  }

  async listReportOverridesForPlayer(playerId: string): Promise<ReportOverride[]> {
    return db.select().from(reportOverrides).where(eq(reportOverrides.playerId, playerId));
  }

  async upsertReportOverride(row: {
    playerId: string;
    coachId: string;
    slide: string;
    itemKey: string;
    action: "hide" | "keep";
  }): Promise<void> {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(reportOverrides)
      .where(
        and(
          eq(reportOverrides.playerId, row.playerId),
          eq(reportOverrides.coachId, row.coachId),
          eq(reportOverrides.slide, row.slide),
          eq(reportOverrides.itemKey, row.itemKey),
        ),
      );
    if (existing) {
      await db
        .update(reportOverrides)
        .set({ action: row.action, createdAt: now })
        .where(eq(reportOverrides.id, existing.id));
    } else {
      await db.insert(reportOverrides).values({
        playerId: row.playerId,
        coachId: row.coachId,
        slide: row.slide,
        itemKey: row.itemKey,
        action: row.action,
      });
    }
  }

  async deleteReportOverride(playerId: string, coachId: string, itemKey: string): Promise<void> {
    await db
      .delete(reportOverrides)
      .where(
        and(
          eq(reportOverrides.playerId, playerId),
          eq(reportOverrides.coachId, coachId),
          eq(reportOverrides.itemKey, itemKey),
        ),
      );
  }

  async publishPlayerReport(playerId: string, publishedBy: string): Promise<Player | undefined> {
    const now = new Date();
    return await db.transaction(async (tx) => {
      await tx
        .update(reportPublications)
        .set({ isActive: false })
        .where(eq(reportPublications.playerId, playerId));
      await tx.insert(reportPublications).values({
        playerId,
        publishedBy,
        publishedAt: now,
        isActive: true,
      });
      const [updated] = await tx
        .update(players)
        .set({ published: true, publishedBy, publishedAt: now })
        .where(eq(players.id, playerId))
        .returning();
      return updated;
    });
  }

  async unpublishPlayerReport(playerId: string): Promise<Player | undefined> {
    return await db.transaction(async (tx) => {
      await tx
        .update(reportPublications)
        .set({ isActive: false })
        .where(eq(reportPublications.playerId, playerId));
      const [updated] = await tx
        .update(players)
        .set({
          published: false,
          publishedBy: null,
          publishedAt: null,
        })
        .where(eq(players.id, playerId))
        .returning();
      return updated;
    });
  }

  async setPlayerCanonical(playerId: string, isCanonical: boolean): Promise<void> {
    await db.execute(
      sql`UPDATE players SET is_canonical = ${isCanonical} WHERE id = ${playerId}`
    );
  }

  async upsertScoutVersion(
    playerId: string,
    coachId: string,
    inputs: Record<string, unknown>,
  ): Promise<ScoutVersion> {
    const res = await db.execute(sql`
      INSERT INTO player_scout_versions (player_id, coach_id, inputs, status)
      VALUES (${playerId}, ${coachId}, ${JSON.stringify(inputs)}::jsonb, 'draft')
      ON CONFLICT (player_id, coach_id)
      DO UPDATE SET inputs = ${JSON.stringify(inputs)}::jsonb, updated_at = now()
      RETURNING *
    `);
    const rows = ((res as any).rows ?? res) as Record<string, unknown>[];
    return rowToScoutVersion(rows[0] as Record<string, unknown>);
  }

  async getScoutVersion(playerId: string, coachId: string): Promise<ScoutVersion | undefined> {
    const res = await db.execute(sql`
      SELECT * FROM player_scout_versions
      WHERE player_id = ${playerId} AND coach_id = ${coachId}
    `);
    const rows = ((res as any).rows ?? res) as Record<string, unknown>[];
    return rows[0] ? rowToScoutVersion(rows[0] as Record<string, unknown>) : undefined;
  }

  async listScoutVersionsForPlayer(playerId: string): Promise<ScoutVersion[]> {
    const res = await db.execute(sql`
      SELECT * FROM player_scout_versions
      WHERE player_id = ${playerId}
      ORDER BY created_at ASC
    `);
    const rows = ((res as any).rows ?? res) as Record<string, unknown>[];
    return rows.map(rowToScoutVersion);
  }

  async submitScoutVersion(playerId: string, coachId: string): Promise<void> {
    await db.execute(sql`
      UPDATE player_scout_versions
      SET status = 'submitted', submitted_at = now()
      WHERE player_id = ${playerId} AND coach_id = ${coachId}
    `);
  }

  async mergeAndClearScoutVersions(playerId: string): Promise<void> {
    // Called when head_coach publishes to Game Plan.
    // Deletes all per-coach versions — the canonical inputs are already
    // in players.inputs (set by head_coach during the merge/publish step).
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM player_scout_versions WHERE player_id = ${playerId}`);
      await tx.execute(sql`DELETE FROM report_overrides WHERE player_id = ${playerId}`);
    });
  }

  async listLeagueMatches(clubId: string): Promise<LeagueMatch[]> {
    const rows = await db.execute(sql`
      SELECT * FROM league_matches WHERE club_id = ${clubId} ORDER BY match_date ASC
    `);
    return (rows as any).rows
      ? ((rows as any).rows as Record<string, unknown>[]).map(rowToMatch)
      : ((rows as unknown) as Record<string, unknown>[]).map(rowToMatch);
  }

  async createLeagueMatch(data: { clubId: string; rivalName: string; matchDate: Date; location?: string; matchType?: string }): Promise<LeagueMatch> {
    const rows = await db.execute(sql`
      INSERT INTO league_matches (club_id, rival_name, match_date, location, match_type)
      VALUES (${data.clubId}, ${data.rivalName}, ${data.matchDate.toISOString()}, ${data.location ?? null}, ${data.matchType ?? 'league'})
      RETURNING *
    `);
    const arr = ((rows as any).rows ?? ((rows as unknown) as Record<string, unknown>[])) as Record<string, unknown>[];
    return rowToMatch(arr[0]);
  }

  async deleteLeagueMatch(id: string): Promise<void> {
    await db.execute(sql`DELETE FROM league_matches WHERE id = ${id}`);
  }

  async userHasScoutingReportAssignment(userId: string, playerId: string): Promise<boolean> {
    const [r] = await db
      .select({ id: scoutingReportAssignments.id })
      .from(scoutingReportAssignments)
      .where(
        and(eq(scoutingReportAssignments.userId, userId), eq(scoutingReportAssignments.playerId, playerId)),
      )
      .limit(1);
    return Boolean(r);
  }

  async recordPlayerReportSlideView(userId: string, playerId: string, slideIndex: number): Promise<void> {
    const now = new Date();
    await db
      .insert(playerReportViews)
      .values({ userId, playerId, slideIndex, viewedAt: now })
      .onConflictDoUpdate({
        target: [playerReportViews.userId, playerReportViews.playerId, playerReportViews.slideIndex],
        set: { viewedAt: now },
      });
  }

  async listPlayerTeamsReportSummary(
    userId: string,
  ): Promise<Array<{ team: Team; totalReports: number; unseenCount: number }>> {
    const reports = await this.listScoutingReportsForUser(userId);
    if (!reports.length) return [];
    const viewRows = await db
      .select({ playerId: playerReportViews.playerId })
      .from(playerReportViews)
      .where(eq(playerReportViews.userId, userId));
    const playersWithAnyView = new Set(viewRows.map((r) => r.playerId));
    const byTeam = new Map<string, { team: Team; playerIds: Set<string> }>();
    for (const r of reports) {
      const tid = r.team.id;
      if (!byTeam.has(tid)) {
        byTeam.set(tid, { team: r.team, playerIds: new Set() });
      }
      byTeam.get(tid)!.playerIds.add(r.player.id);
    }
    const out = Array.from(byTeam.values()).map(({ team, playerIds }) => {
      const totalReports = playerIds.size;
      let unseenCount = 0;
      for (const pid of Array.from(playerIds)) {
        if (!playersWithAnyView.has(pid)) unseenCount++;
      }
      return { team, totalReports, unseenCount };
    });
    out.sort((a, b) => a.team.name.localeCompare(b.team.name));
    return out;
  }

  async listAssignedPlayersInTeamForUser(
    userId: string,
    teamId: string,
  ): Promise<Array<{ player: Player; viewStatus: "none" | "partial" | "complete" }>> {
    const reports = await this.listScoutingReportsForUser(userId);
    const inTeam = reports.filter((r) => r.team.id === teamId);
    const uniquePlayers = new Map<string, Player>();
    for (const r of inTeam) {
      uniquePlayers.set(r.player.id, r.player);
    }
    const playerIds = Array.from(uniquePlayers.keys());
    if (!playerIds.length) return [];
    const viewRows = await db
      .select({
        playerId: playerReportViews.playerId,
        slideIndex: playerReportViews.slideIndex,
      })
      .from(playerReportViews)
      .where(and(eq(playerReportViews.userId, userId), inArray(playerReportViews.playerId, playerIds)));
    const slidesByPlayer = new Map<string, Set<number>>();
    for (const row of viewRows) {
      if (!slidesByPlayer.has(row.playerId)) slidesByPlayer.set(row.playerId, new Set());
      slidesByPlayer.get(row.playerId)!.add(row.slideIndex);
    }
    const statusFor = (pid: string): "none" | "partial" | "complete" => {
      const s = slidesByPlayer.get(pid) ?? new Set<number>();
      if (s.size === 0) return "none";
      if (s.has(2)) return "complete";
      return "partial";
    };
    return playerIds.map((id) => ({
      player: uniquePlayers.get(id)!,
      viewStatus: statusFor(id),
    }));
  }
}

export const storage = new DatabaseStorage();
