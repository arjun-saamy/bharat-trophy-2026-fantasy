import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, Lock, Save, Trash2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { adminRequest, usePlayers, useSettings, useAdminEntries } from '@/lib/league';
import { playerPoints } from '@shared/schema';
import type { Player, PublicSettings } from '@shared/schema';

type Draft = Record<number, Partial<Player>>;

const STAT_COLS: Array<[keyof Player, string]> = [
  ['goals', 'G'],
  ['assists', 'A'],
  ['blocks', 'D'],
  ['callahans', 'Cal'],
  ['turnovers', 'TO'],
  ['gamesPlayed', 'GP'],
  ['teamWins', 'W'],
  ['spiritMvps', 'SMVP'],
];

function PinGate({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const login = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        ('__PORT_5000__'.startsWith('__') ? '' : '__PORT_5000__') + '/api/admin/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        }
      );
      if (!res.ok) throw new Error('Invalid PIN');
      return res.json();
    },
    onSuccess: () => onUnlock(pin),
    onError: () => setError('That PIN does not match.'),
  });

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-card-border bg-card p-6">
      <Lock className="mb-3 h-5 w-5 text-primary" />
      <h1 className="font-display text-lg font-semibold">Organiser access</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Prices, stats and settings are behind a PIN so participants cannot edit the league.
        Ask your event organiser for the PIN if you don't have it.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          login.mutate();
        }}
      >
        <Input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Admin PIN"
          data-testid="input-pin"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-unlock">
          {login.isPending ? 'Checking…' : 'Unlock'}
        </Button>
      </form>
    </div>
  );
}

function PriceTab({ pin, players }: { pin: string; players: Player[] }) {
  const [draft, setDraft] = useState<Draft>({});
  const [team, setTeam] = useState('all');
  const [q, setQ] = useState('');
  const [bulk, setBulk] = useState('');
  const { toast } = useToast();

  const teams = useMemo(() => Array.from(new Set(players.map((p) => p.team))).sort(), [players]);
  const visible = players
    .filter((p) => (team === 'all' ? true : p.team === team))
    .filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => a.team.localeCompare(b.team) || (a.jersey ?? 99) - (b.jersey ?? 99));

  const dirty = Object.keys(draft).length;

  const save = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(draft).map(([id, patch]) => ({ id: Number(id), ...patch }));
      const res = await adminRequest('PATCH', '/api/admin/players', pin, { players: updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      setDraft({});
      toast({ title: 'Saved', description: `${dirty} players updated.` });
    },
    onError: (e: Error) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  function exportCsv() {
    const rows = [
      ['id', 'name', 'team', 'jersey', 'matchUp', 'price', 'available'],
      ...players.map((p) => [p.id, p.name, p.team, p.jersey ?? '', p.matchUp, p.price, p.available]),
    ];
    const csv = rows
      .map((r) => r.map((c) => (String(c).includes(',') ? `"${c}"` : c)).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bharat-trophy-fantasy-prices.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyBulk() {
    const next: Draft = { ...draft };
    let hits = 0;
    const misses: string[] = [];
    for (const line of bulk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || /^(id|name)\s*,/i.test(trimmed)) continue;
      const parts = trimmed.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      const price = Number(parts[parts.length - 1]);
      const key = parts[0];
      if (!Number.isFinite(price)) {
        misses.push(trimmed);
        continue;
      }
      const match = /^\d+$/.test(key)
        ? players.find((p) => p.id === Number(key))
        : players.find((p) => p.name.toLowerCase() === key.toLowerCase());
      if (!match) {
        misses.push(key);
        continue;
      }
      next[match.id] = { ...next[match.id], price: Math.max(0, Math.round(price)) };
      hits++;
    }
    setDraft(next);
    toast({
      title: `${hits} prices staged`,
      description: misses.length
        ? `Not matched: ${misses.slice(0, 4).join(', ')}${misses.length > 4 ? '…' : ''}`
        : 'Review the table, then Save changes.',
      variant: misses.length ? 'destructive' : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-card-border bg-card p-4">
        <h3 className="text-sm font-semibold">Bulk pricing</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Export the pool as CSV, set prices in your spreadsheet, then paste rows back as{' '}
          <code className="rounded bg-secondary px-1">id,price</code> or{' '}
          <code className="rounded bg-secondary px-1">Player Name,price</code> — one per line.
        </p>
        <p className="mt-2 text-xs text-primary">
          Set every price before you open entries. Squads that are already locked in keep their
          players and the cost they paid, so later price changes only affect new entries.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} data-testid="button-export-csv">
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <Textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder={'5169,14\nAmanpreet Kaur,14'}
          className="mt-3 h-24 font-mono text-xs"
          data-testid="input-bulk"
        />
        <Button
          variant="outline"
          className="mt-2"
          onClick={applyBulk}
          disabled={!bulk.trim()}
          data-testid="button-apply-bulk"
        >
          <Upload className="mr-1.5 h-4 w-4" />
          Stage pasted prices
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player"
          className="max-w-[220px]"
          data-testid="input-admin-search"
        />
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-[170px]" data-testid="select-admin-team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          data-testid="button-save-prices"
        >
          <Save className="mr-1.5 h-4 w-4" />
          {save.isPending ? 'Saving…' : dirty ? `Save ${dirty} change${dirty > 1 ? 's' : ''}` : 'Saved'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-card-border bg-card">
        <ul className="divide-y divide-border">
          {visible.map((p) => {
            const price = draft[p.id]?.price ?? p.price;
            const available = draft[p.id]?.available ?? p.available;
            const changed = draft[p.id] !== undefined;
            return (
              <li
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2',
                  changed && 'bg-primary/5'
                )}
              >
                <span className="nums w-8 text-center text-xs text-muted-foreground">
                  {p.jersey ?? '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.team} · {p.matchUp}
                  </span>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={price}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [p.id]: { ...d[p.id], price: Number(e.target.value) },
                    }))
                  }
                  className="nums h-8 w-20 text-right"
                  data-testid={`input-price-${p.id}`}
                />
                <Button
                  variant={available ? 'outline' : 'destructive'}
                  size="sm"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      [p.id]: { ...d[p.id], available: available ? 0 : 1 },
                    }))
                  }
                  data-testid={`button-available-${p.id}`}
                >
                  {available ? 'In pool' : 'Withdrawn'}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function StatsTab({
  pin,
  players,
  settings,
}: {
  pin: string;
  players: Player[];
  settings: PublicSettings;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [team, setTeam] = useState(players[0]?.team ?? 'all');
  const { toast } = useToast();
  const teams = useMemo(() => Array.from(new Set(players.map((p) => p.team))).sort(), [players]);
  const visible = players
    .filter((p) => p.team === team)
    .sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  const dirty = Object.keys(draft).length;

  const save = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(draft).map(([id, patch]) => ({ id: Number(id), ...patch }));
      const res = await adminRequest('PATCH', '/api/admin/players', pin, { players: updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      setDraft({});
      toast({ title: 'Stats saved', description: 'Leaderboard totals have been recalculated.' });
    },
    onError: (e: Error) =>
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        Enter running tournament totals per player, straight off the score sheets. Numbers are
        cumulative — update them after each round and the leaderboard follows immediately.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-[200px]" data-testid="select-stats-team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          data-testid="button-save-stats"
        >
          <Save className="mr-1.5 h-4 w-4" />
          {save.isPending ? 'Saving…' : dirty ? `Save ${dirty} player${dirty > 1 ? 's' : ''}` : 'Saved'}
        </Button>
      </div>

      <div className="scroll-shell overflow-x-auto rounded-lg border border-card-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Player</th>
              {STAT_COLS.map(([key, label]) => (
                <th key={String(key)} className="px-1.5 py-2 text-center font-medium" title={String(key)}>
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const merged = { ...p, ...draft[p.id] } as Player;
              return (
                <tr
                  key={p.id}
                  className={cn('border-b border-border/60 last:border-0', draft[p.id] && 'bg-primary/5')}
                >
                  <td className="px-3 py-1.5">
                    <span className="block truncate text-sm">
                      <span className="nums mr-2 text-xs text-muted-foreground">
                        {p.jersey ?? '–'}
                      </span>
                      {p.name}
                    </span>
                  </td>
                  {STAT_COLS.map(([key]) => (
                    <td key={String(key)} className="px-1 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={String(merged[key] ?? 0)}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [p.id]: { ...d[p.id], [key]: Math.max(0, Number(e.target.value)) },
                          }))
                        }
                        className="nums h-8 w-14 px-1.5 text-center"
                        data-testid={`input-${String(key)}-${p.id}`}
                      />
                    </td>
                  ))}
                  <td className="nums px-3 py-1.5 text-right font-semibold">
                    {playerPoints(merged, settings)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({
  pin,
  settings,
  onPinChanged,
}: {
  pin: string;
  settings: PublicSettings;
  onPinChanged: (pin: string) => void;
}) {
  const [form, setForm] = useState<Record<string, number>>({});
  const [newPin, setNewPin] = useState('');
  const { toast } = useToast();
  const value = (k: keyof PublicSettings) => form[k] ?? (settings[k] as number);

  const save = useMutation({
    mutationFn: async () => {
      const res = await adminRequest('PATCH', '/api/admin/settings', pin, form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      setForm({});
      toast({ title: 'League settings updated' });
    },
    onError: (e: Error) =>
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const savePin = useMutation({
    mutationFn: async () => {
      const res = await adminRequest('PATCH', '/api/admin/settings', pin, { adminPin: newPin });
      return res.json();
    },
    onSuccess: () => {
      onPinChanged(newPin);
      setNewPin('');
      toast({ title: 'Admin PIN changed', description: 'Use the new PIN next time you unlock this panel.' });
    },
    onError: (e: Error) =>
      toast({ title: 'Could not change PIN', description: e.message, variant: 'destructive' }),
  });

  const groups: Array<[string, Array<[keyof PublicSettings, string]>]> = [
    [
      'Squad rules',
      [
        ['budget', 'Budget (credits)'],
        ['squadSize', 'Squad size'],
        ['maxPerTeam', 'Max per state team'],
        ['minPerMatchUp', 'Min per match-up'],
        ['captainMultiplier', 'Captain multiplier'],
        ['entriesOpen', 'Entries open (1 or 0)'],
      ],
    ],
    [
      'Scoring values',
      [
        ['ptsGoal', 'Goal'],
        ['ptsAssist', 'Assist'],
        ['ptsBlock', 'Block'],
        ['ptsCallahan', 'Callahan'],
        ['ptsTurnover', 'Turnover'],
        ['ptsGame', 'Game appearance'],
        ['ptsTeamWin', 'Team win'],
        ['ptsSpirit', 'Spirit MVP'],
      ],
    ],
  ];

  return (
    <div className="space-y-4">
      {groups.map(([title, fields]) => (
        <div key={title} className="rounded-lg border border-card-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">{title}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([key, label]) => (
              <label key={String(key)} className="space-y-1.5">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  value={value(key)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                  }
                  className="nums h-9"
                  data-testid={`input-setting-${String(key)}`}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button
        onClick={() => save.mutate()}
        disabled={!Object.keys(form).length || save.isPending}
        data-testid="button-save-settings"
      >
        <Save className="mr-1.5 h-4 w-4" />
        {save.isPending ? 'Saving…' : 'Save settings'}
      </Button>

      <div className="rounded-lg border border-card-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold">Security</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Change the organiser PIN away from the shared default before the tournament goes live.
          Anyone with the PIN can edit prices, stats, settings and delete entries.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5">
            <span className="block text-xs text-muted-foreground">New admin PIN</span>
            <Input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="At least 4 characters"
              className="h-9 w-56"
              data-testid="input-new-pin"
            />
          </label>
          <Button
            variant="outline"
            onClick={() => savePin.mutate()}
            disabled={newPin.trim().length < 4 || savePin.isPending}
            data-testid="button-save-pin"
          >
            {savePin.isPending ? 'Changing…' : 'Change PIN'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntriesTab({ pin, players }: { pin: string; players: Player[] }) {
  const { data: entries } = useAdminEntries(pin);
  const { toast } = useToast();
  const del = useMutation({
    mutationFn: async (id: number) => adminRequest('DELETE', `/api/admin/entries/${id}`, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/entries'] });
      toast({ title: 'Entry removed' });
    },
  });

  function exportEntries() {
    const rows = [['entry', 'fantasy team', 'manager', 'contact', 'captain', 'squad']];
    for (const e of entries ?? []) {
      const ids: number[] = JSON.parse(e.playerIds);
      const names = ids.map((id) => players.find((p) => p.id === id)?.name ?? String(id));
      const cap = players.find((p) => p.id === e.captainId)?.name ?? '';
      rows.push([
        String(e.id),
        e.teamName,
        e.managerName,
        e.contact ?? '',
        cap,
        names.join(' | '),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bharat-trophy-fantasy-entries.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!entries?.length)
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No entries submitted yet.
      </div>
    );

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={exportEntries} data-testid="button-export-entries">
        <Download className="mr-1.5 h-4 w-4" />
        Export entries CSV
      </Button>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-card-border bg-card">
        {entries.map((e) => {
          const ids: number[] = JSON.parse(e.playerIds);
          return (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{e.teamName}</span>
                <span className="block text-xs text-muted-foreground">
                  {e.managerName}
                  {e.contact ? ` · ${e.contact}` : ''}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {ids
                    .map((id) => {
                      const p = players.find((x) => x.id === id);
                      return (p?.name ?? id) + (id === e.captainId ? ' (C)' : '');
                    })
                    .join(', ')}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => del.mutate(e.id)}
                data-testid={`button-delete-entry-${e.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AdminPage() {
  const [pin, setPin] = useState<string | null>(null);
  const { data: players } = usePlayers();
  const { data: settings } = useSettings();

  if (!pin) return <PinGate onUnlock={setPin} />;
  if (!players || !settings) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight">Organiser panel</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {players.length} players in the pool · entries{' '}
          {settings.entriesOpen ? 'open' : 'closed'}
        </p>
      </header>
      <Tabs defaultValue="prices">
        <TabsList>
          <TabsTrigger value="prices" data-testid="tab-prices">
            Prices
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">
            Match stats
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            League settings
          </TabsTrigger>
          <TabsTrigger value="entries" data-testid="tab-entries">
            Entries
          </TabsTrigger>
        </TabsList>
        <TabsContent value="prices" className="mt-4">
          <PriceTab pin={pin} players={players} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsTab pin={pin} players={players} settings={settings} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab pin={pin} settings={settings} onPinChanged={setPin} />
        </TabsContent>
        <TabsContent value="entries" className="mt-4">
          <EntriesTab pin={pin} players={players} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
