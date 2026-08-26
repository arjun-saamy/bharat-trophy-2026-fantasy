import { useMemo, useState } from 'react';
import { ChevronDown, Crown, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useEntries, usePlayers, useSettings } from '@/lib/league';
import { playerPoints } from '@shared/schema';
import type { Player, PublicSettings, Entry } from '@shared/schema';

function entryTotal(
  entry: Entry,
  players: Player[],
  settings: PublicSettings
): { total: number; rows: Array<{ p: Player; pts: number; isCap: boolean }> } {
  const ids: number[] = JSON.parse(entry.playerIds);
  const rows = ids
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)
    .map((p) => {
      const base = playerPoints(p, settings);
      const isCap = p.id === entry.captainId;
      return { p, pts: isCap ? base * settings.captainMultiplier : base, isCap };
    });
  return { total: rows.reduce((t, r) => t + r.pts, 0), rows };
}

export default function LeaderboardPage() {
  const { data: entries, isLoading } = useEntries();
  const { data: players } = usePlayers();
  const { data: settings } = useSettings();
  const [open, setOpen] = useState<number | null>(null);

  const ranked = useMemo(() => {
    if (!entries || !players || !settings) return [];
    return entries
      .map((e) => ({ entry: e, ...entryTotal(e, players, settings) }))
      .sort((a, b) => b.total - a.total || a.entry.id - b.entry.id);
  }, [entries, players, settings]);

  const scoringStarted = (players ?? []).some((p) => p.gamesPlayed > 0);

  if (isLoading || !settings || !players) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
          {ranked.length} {ranked.length === 1 ? 'entry' : 'entries'}.{' '}
          {scoringStarted
            ? 'Totals update as the organiser enters match stats.'
            : 'No match stats have been entered yet — every squad sits on zero until the first round is scored.'}
        </p>
      </header>

      {ranked.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Trophy className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">No entries yet</p>
          <p className="mx-auto mt-1 max-w-[40ch] text-sm text-muted-foreground">
            Build a squad on the Build page and it will show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ranked.map((r, i) => {
            const isOpen = open === r.entry.id;
            const spend = r.entry.spend || r.rows.reduce((t, x) => t + x.p.price, 0);
            return (
              <li
                key={r.entry.id}
                className="overflow-hidden rounded-lg border border-card-border bg-card"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : r.entry.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50"
                  data-testid={`button-entry-${r.entry.id}`}
                >
                  <span
                    className={cn(
                      'nums flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      i === 0
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {r.entry.teamName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.entry.managerName} · <span className="nums">{spend}</span> credits spent
                    </span>
                  </span>
                  <span className="text-right">
                    <span
                      className="nums block font-display text-lg font-semibold"
                      data-testid={`text-total-${r.entry.id}`}
                    >
                      {r.total}
                    </span>
                    <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                      points
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {r.rows.map(({ p, pts, isCap }) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 px-4 py-2 text-sm"
                      >
                        <span className="nums w-8 text-center text-xs text-muted-foreground">
                          {p.jersey ?? '–'}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {isCap && <Crown className="mr-1 inline h-3.5 w-3.5 text-primary" />}
                          {p.name}
                        </span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {p.team}
                        </span>
                        <span className="nums w-12 shrink-0 text-right text-xs text-muted-foreground">
                          {p.price}c
                        </span>
                        <span className="nums w-14 shrink-0 text-right font-medium">{pts}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
