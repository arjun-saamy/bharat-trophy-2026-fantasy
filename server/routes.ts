import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import { storage } from './storage';
import {
  submitEntrySchema,
  updatePlayersSchema,
  updateSettingsSchema,
  validateSquad,
} from '@shared/schema';

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Minimal in-memory brute-force guard for the admin PIN. Not distributed-safe,
  // but enough to stop naive guessing against a single-instance deployment.
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX_ATTEMPTS = 20;
  const attempts = new Map<string, { count: number; resetAt: number }>();
  function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const rec = attempts.get(key);
    if (!rec || now > rec.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }
    if (rec.count >= MAX_ATTEMPTS) return false;
    rec.count += 1;
    return true;
  }

  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? 'unknown';
    if (!checkRateLimit(key)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    const s = await storage.getSettings();
    const pin = req.header('x-admin-pin');
    if (!pin || pin !== s.adminPin) return res.status(401).json({ error: 'Invalid admin PIN' });
    next();
  }

  app.get('/api/players', async (_req, res) => {
    res.json(await storage.listPlayers());
  });

  app.get('/api/settings', async (_req, res) => {
    const { adminPin: _pin, ...rest } = await storage.getSettings();
    res.json(rest);
  });

  app.get('/api/entries', async (_req, res) => {
    // Public endpoint: never expose entrant contact details (email/phone).
    const rows = await storage.listEntries();
    res.json(rows.map(({ contact: _contact, ...rest }) => rest));
  });

  app.post('/api/entries', async (req, res) => {
    const parsed = submitEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid entry' });
    const s = await storage.getSettings();
    if (!s.entriesOpen) return res.status(403).json({ error: 'Entries are closed' });
    const all = await storage.listPlayers();
    const picks = parsed.data.playerIds
      .map((id) => all.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (picks.length !== parsed.data.playerIds.length)
      return res.status(400).json({ error: 'Unknown player in squad' });
    if (picks.some((p) => !p.available))
      return res.status(400).json({ error: 'A picked player is unavailable' });
    const { adminPin: _pin, ...pub } = s;
    const issues = validateSquad(picks, parsed.data.captainId, pub);
    if (issues.length) return res.status(400).json({ error: issues.join('; ') });
    const existing = await storage.listEntries();
    if (
      existing.some(
        (e) => e.teamName.trim().toLowerCase() === parsed.data.teamName.trim().toLowerCase()
      )
    )
      return res.status(409).json({ error: 'That fantasy team name is already taken' });
    const spend = picks.reduce((t, p) => t + p.price, 0);
    res.status(201).json(await storage.createEntry(parsed.data, spend));
  });

  app.post('/api/admin/login', async (req, res) => {
    const key = req.ip ?? 'unknown';
    if (!checkRateLimit(key)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    const s = await storage.getSettings();
    if (req.body?.pin !== s.adminPin) return res.status(401).json({ error: 'Invalid admin PIN' });
    res.json({ ok: true });
  });

  app.patch('/api/admin/players', requireAdmin, async (req, res) => {
    const parsed = updatePlayersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid player updates' });
    await storage.updatePlayers(parsed.data.players);
    res.json(await storage.listPlayers());
  });

  app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid settings' });
    const s = await storage.updateSettings(parsed.data);
    const { adminPin: _pin, ...rest } = s;
    res.json(rest);
  });

  app.get('/api/admin/entries', requireAdmin, async (_req, res) => {
    // Authenticated route: organiser needs full entry details including contact info.
    res.json(await storage.listEntries());
  });

  app.delete('/api/admin/entries/:id', requireAdmin, async (req, res) => {
    await storage.deleteEntry(Number(req.params.id));
    res.json({ ok: true });
  });

  return httpServer;
}
