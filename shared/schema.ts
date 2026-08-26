import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const players = sqliteTable('players', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  team: text('team').notNull(),
  teamCode: text('team_code').notNull(),
  jersey: integer('jersey'),
  matchUp: text('match_up').notNull(), // 'M' | 'F'
  city: text('city'),
  role: text('role').notNull(), // DFLT | CAP | SCAP
  price: integer('price').notNull().default(14),
  available: integer('available').notNull().default(1),
  // cumulative tournament stats, entered by the organiser
  goals: integer('goals').notNull().default(0),
  assists: integer('assists').notNull().default(0),
  blocks: integer('blocks').notNull().default(0),
  callahans: integer('callahans').notNull().default(0),
  turnovers: integer('turnovers').notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),
  teamWins: integer('team_wins').notNull().default(0),
  spiritMvps: integer('spirit_mvps').notNull().default(0),
});

export const entries = sqliteTable('entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  managerName: text('manager_name').notNull(),
  teamName: text('team_name').notNull(),
  contact: text('contact'),
  playerIds: text('player_ids').notNull(), // JSON array of player ids
  captainId: integer('captain_id').notNull(),
  spend: integer('spend').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  budget: integer('budget').notNull().default(100),
  squadSize: integer('squad_size').notNull().default(7),
  maxPerTeam: integer('max_per_team').notNull().default(2),
  minPerMatchUp: integer('min_per_match_up').notNull().default(3),
  captainMultiplier: integer('captain_multiplier').notNull().default(2),
  entriesOpen: integer('entries_open').notNull().default(1),
  ptsGoal: integer('pts_goal').notNull().default(3),
  ptsAssist: integer('pts_assist').notNull().default(3),
  ptsBlock: integer('pts_block').notNull().default(4),
  ptsCallahan: integer('pts_callahan').notNull().default(8),
  ptsTurnover: integer('pts_turnover').notNull().default(-2),
  ptsGame: integer('pts_game').notNull().default(1),
  ptsTeamWin: integer('pts_team_win').notNull().default(2),
  ptsSpirit: integer('pts_spirit').notNull().default(5),
  adminPin: text('admin_pin').notNull().default('change-me'),
});

export const insertEntrySchema = createInsertSchema(entries).omit({
  id: true,
  createdAt: true,
});
export const submitEntrySchema = z.object({
  managerName: z.string().min(2).max(60),
  teamName: z.string().min(2).max(60),
  contact: z.string().max(120).optional().nullable(),
  playerIds: z.array(z.number()),
  captainId: z.number(),
});

export const updatePlayerSchema = z.object({
  id: z.number(),
  price: z.number().min(0).max(100).optional(),
  available: z.number().min(0).max(1).optional(),
  goals: z.number().min(0).optional(),
  assists: z.number().min(0).optional(),
  blocks: z.number().min(0).optional(),
  callahans: z.number().min(0).optional(),
  turnovers: z.number().min(0).optional(),
  gamesPlayed: z.number().min(0).optional(),
  teamWins: z.number().min(0).optional(),
  spiritMvps: z.number().min(0).optional(),
});
export const updatePlayersSchema = z.object({ players: z.array(updatePlayerSchema) });

export const updateSettingsSchema = z.object({
  budget: z.number().min(10).max(1000).optional(),
  squadSize: z.number().min(3).max(12).optional(),
  maxPerTeam: z.number().min(1).max(7).optional(),
  minPerMatchUp: z.number().min(0).max(6).optional(),
  captainMultiplier: z.number().min(1).max(4).optional(),
  entriesOpen: z.number().min(0).max(1).optional(),
  ptsGoal: z.number().optional(),
  ptsAssist: z.number().optional(),
  ptsBlock: z.number().optional(),
  ptsCallahan: z.number().optional(),
  ptsTurnover: z.number().optional(),
  ptsGame: z.number().optional(),
  ptsTeamWin: z.number().optional(),
  ptsSpirit: z.number().optional(),
  adminPin: z.string().min(4).max(40).optional(),
});

export type Player = typeof players.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type SubmitEntry = z.infer<typeof submitEntrySchema>;
export type PublicSettings = Omit<Settings, 'adminPin'>;

/** Fantasy points for one player, from cumulative stats. */
export function playerPoints(p: Player, s: PublicSettings): number {
  return (
    p.goals * s.ptsGoal +
    p.assists * s.ptsAssist +
    p.blocks * s.ptsBlock +
    p.callahans * s.ptsCallahan +
    p.turnovers * s.ptsTurnover +
    p.gamesPlayed * s.ptsGame +
    p.teamWins * s.ptsTeamWin +
    p.spiritMvps * s.ptsSpirit
  );
}

export type SquadIssue = string;

/** Validate a squad against the league rules. Returns a list of rule breaches. */
export function validateSquad(
  picks: Player[],
  captainId: number | null,
  s: PublicSettings
): SquadIssue[] {
  const issues: SquadIssue[] = [];
  if (picks.length !== s.squadSize) {
    issues.push(`Pick exactly ${s.squadSize} players (you have ${picks.length})`);
  }
  const spend = picks.reduce((t, p) => t + p.price, 0);
  if (spend > s.budget) issues.push(`Over budget by ${spend - s.budget} credits`);

  const women = picks.filter((p) => p.matchUp === 'F').length;
  const men = picks.length - women;
  if (picks.length === s.squadSize) {
    if (women < s.minPerMatchUp)
      issues.push(`Need at least ${s.minPerMatchUp} female-matching players (you have ${women})`);
    if (men < s.minPerMatchUp)
      issues.push(`Need at least ${s.minPerMatchUp} male-matching players (you have ${men})`);
  }

  const counts = new Map<string, number>();
  for (const p of picks) counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
  for (const [team, n] of Array.from(counts.entries())) {
    if (n > s.maxPerTeam) issues.push(`Max ${s.maxPerTeam} from one state team — ${team} has ${n}`);
  }

  if (!captainId || !picks.some((p) => p.id === captainId)) {
    issues.push('Nominate a captain from your picks');
  }
  return issues;
}
