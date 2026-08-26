import { players, entries, settings } from '@shared/schema';
import type { Player, Entry, Settings, SubmitEntry } from '@shared/schema';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import seedPlayers from './seed-players.json';

const sqlite = new Database('data.db');
sqlite.pragma('journal_mode = WAL');
export const db = drizzle(sqlite);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, team TEXT NOT NULL, team_code TEXT NOT NULL,
  jersey INTEGER, match_up TEXT NOT NULL, city TEXT, role TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 14, available INTEGER NOT NULL DEFAULT 1,
  goals INTEGER NOT NULL DEFAULT 0, assists INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0, callahans INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0, games_played INTEGER NOT NULL DEFAULT 0,
  team_wins INTEGER NOT NULL DEFAULT 0, spirit_mvps INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, manager_name TEXT NOT NULL, team_name TEXT NOT NULL,
  contact TEXT, player_ids TEXT NOT NULL, captain_id INTEGER NOT NULL, spend INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY, budget INTEGER NOT NULL DEFAULT 100, squad_size INTEGER NOT NULL DEFAULT 7,
  max_per_team INTEGER NOT NULL DEFAULT 2, min_per_match_up INTEGER NOT NULL DEFAULT 3,
  captain_multiplier INTEGER NOT NULL DEFAULT 2, entries_open INTEGER NOT NULL DEFAULT 1,
  pts_goal INTEGER NOT NULL DEFAULT 3, pts_assist INTEGER NOT NULL DEFAULT 3,
  pts_block INTEGER NOT NULL DEFAULT 4, pts_callahan INTEGER NOT NULL DEFAULT 8,
  pts_turnover INTEGER NOT NULL DEFAULT -2, pts_game INTEGER NOT NULL DEFAULT 1,
  pts_team_win INTEGER NOT NULL DEFAULT 2, pts_spirit INTEGER NOT NULL DEFAULT 5,
  admin_pin TEXT NOT NULL DEFAULT 'bharat26'
);
`);

type Seed = {
  id: number;
  name: string;
  team: string;
  teamCode: string;
  jersey: number | null;
  matchUp: string;
  city: string | null;
  role: string;
};

function seed() {
  const row = db.select({ n: sql<number>`count(*)` }).from(players).get();
  if (!row || row.n === 0) {
    const list = seedPlayers as Seed[];
    // Default: everyone at 14 credits, so 7 x 14 = 98 of the 100 budget. Set real prices in the organiser panel.
    const insert = db.insert(players);
    for (const p of list) {
      db.insert(players)
        .values({ ...p, matchUp: p.matchUp, price: 14 })
        .onConflictDoNothing()
        .run();
    }
    void insert;
  }
  const s = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!s) db.insert(settings).values({ id: 1 }).run();
}
seed();

export interface IStorage {
  listPlayers(): Promise<Player[]>;
  updatePlayers(updates: Array<Partial<Player> & { id: number }>): Promise<void>;
  listEntries(): Promise<Entry[]>;
  createEntry(e: SubmitEntry, spend: number): Promise<Entry>;
  deleteEntry(id: number): Promise<void>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async listPlayers(): Promise<Player[]> {
    return db.select().from(players).all();
  }
  async updatePlayers(updates: Array<Partial<Player> & { id: number }>): Promise<void> {
    for (const u of updates) {
      const { id, ...rest } = u;
      if (Object.keys(rest).length === 0) continue;
      db.update(players).set(rest).where(eq(players.id, id)).run();
    }
  }
  async listEntries(): Promise<Entry[]> {
    return db.select().from(entries).all();
  }
  async createEntry(e: SubmitEntry, spend: number): Promise<Entry> {
    return db
      .insert(entries)
      .values({
        managerName: e.managerName,
        teamName: e.teamName,
        contact: e.contact ?? null,
        playerIds: JSON.stringify(e.playerIds),
        captainId: e.captainId,
        spend,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }
  async deleteEntry(id: number): Promise<void> {
    db.delete(entries).where(eq(entries.id, id)).run();
  }
  async getSettings(): Promise<Settings> {
    return db.select().from(settings).where(eq(settings.id, 1)).get()!;
  }
  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    if (Object.keys(patch).length)
      db.update(settings).set(patch).where(eq(settings.id, 1)).run();
    return this.getSettings();
  }
}

export const storage = new DatabaseStorage();
