import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, unique, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logo: text("logo").notNull().default("🏀"),
  primaryColor: text("primary_color").notNull().default("bg-orange-500"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  number: text("number").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  inputs: jsonb("inputs").notNull(),
  internalModel: jsonb("internal_model").notNull(),
  archetype: text("archetype").notNull().default("Role Player"),
  keyTraits: text("key_traits").array().notNull().default(sql`'{}'::text[]`),
  defensivePlan: jsonb("defensive_plan").notNull(),
  /** Supabase user id of coach who created this scouting profile (optional). */
  createdByUserId: varchar("created_by_user_id"),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: varchar("published_by"),
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

/** Supabase auth user id + team membership (from invitations / roster). */
export const teamMembers = pgTable(
  "team_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    teamId: varchar("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(),
    jerseyNumber: text("jersey_number").notNull().default(""),
    position: text("position").notNull().default(""),
    displayName: text("display_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("team_members_user_team_unique").on(table.userId, table.teamId)],
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull(),
  token: varchar("token").notNull().unique().default(sql`gen_random_uuid()::text`),
  createdBy: varchar("created_by").notNull(),
  usedBy: varchar("used_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

/** Scouting report (player row) shared with an app user (player role). */
export const scoutingReportAssignments = pgTable("scouting_report_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  playerId: varchar("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ScoutingReportAssignment = typeof scoutingReportAssignments.$inferSelect;
export type InsertScoutingReportAssignment = typeof scoutingReportAssignments.$inferInsert;

/** Slide-level view log for player-mode report reading (5 slides, indices 0–4). */
export const playerReportViews = pgTable(
  "player_report_views",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    playerId: varchar("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    slideIndex: integer("slide_index").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("player_report_views_user_player_slide").on(table.userId, table.playerId, table.slideIndex),
  ],
);

export type PlayerReportView = typeof playerReportViews.$inferSelect;
export type InsertPlayerReportView = typeof playerReportViews.$inferInsert;

/** User's home club (not rival scout teams). */
export const clubs = pgTable("clubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logo: text("logo").notNull().default("🏀"),
  ownerId: varchar("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** League context for motor v3 (nullable = unset). */
  leagueType: varchar("league_type", { length: 32 }),
  gender: varchar("gender", { length: 16 }),
  level: varchar("level", { length: 32 }),
  ageCategory: varchar("age_category", { length: 16 }),
});

export type Club = typeof clubs.$inferSelect;
export type InsertClub = typeof clubs.$inferInsert;

export const clubMembers = pgTable(
  "club_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull(),
    role: varchar("role", { length: 32 }).notNull(),
    displayName: text("display_name").notNull().default(""),
    jerseyNumber: text("jersey_number").notNull().default(""),
    position: text("position").notNull().default(""),
    /** Operations badge: grants additional staff capabilities (e.g., wellness ops). */
    operationsAccess: boolean("operations_access").notNull().default(false),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    invitedEmail: text("invited_email"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("club_members_club_user_unique").on(table.clubId, table.userId)],
);

export type ClubMember = typeof clubMembers.$inferSelect;
export type InsertClubMember = typeof clubMembers.$inferInsert;

export const clubInvitations = pgTable("club_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull(),
  token: varchar("token").notNull().unique().default(sql`gen_random_uuid()::text`),
  invitedEmail: text("invited_email"),
  createdBy: varchar("created_by").notNull(),
  usedBy: varchar("used_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClubInvitation = typeof clubInvitations.$inferSelect;
export type InsertClubInvitation = typeof clubInvitations.$inferInsert;

/** Coach sign-off on a scouting report before publication. */
export const reportApprovals = pgTable(
  "report_approvals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    playerId: varchar("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    coachId: varchar("coach_id").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("report_approvals_player_coach").on(table.playerId, table.coachId)],
);

export type ReportApproval = typeof reportApprovals.$inferSelect;
export type InsertReportApproval = typeof reportApprovals.$inferInsert;

/** Per-coach hide/keep on a specific rendered profile line. */
export const reportOverrides = pgTable(
  "report_overrides",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    playerId: varchar("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    coachId: varchar("coach_id").notNull(),
    slide: varchar("slide", { length: 32 }).notNull(),
    itemKey: text("item_key").notNull(),
    action: varchar("action", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("report_overrides_player_coach_slide_item").on(
      table.playerId,
      table.coachId,
      table.slide,
      table.itemKey,
    ),
  ],
);

export type ReportOverride = typeof reportOverrides.$inferSelect;
export type InsertReportOverride = typeof reportOverrides.$inferInsert;

export const reportPublications = pgTable("report_publications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  publishedBy: varchar("published_by").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export type ReportPublication = typeof reportPublications.$inferSelect;
export type InsertReportPublication = typeof reportPublications.$inferInsert;
