import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Crown,
  Search,
  Star,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { usePlayers, useSettings, apiRequest, ROLE_LABEL } from '@/lib/league';
import { playerPoints, validateSquad } from '@shared/schema';
import type { Player, PublicSettings } from '@shared/schema';

type SortKey = 'price-desc' | 'price-asc' | 'points-desc' | 'name' | 'team';

function MatchUpChip({ value }: { value: string }) {
  const female = value === 'F';
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-semibold nums',
        female
          ? 'bg-chart-5/15 text-chart-5'
          : 'bg-chart-3/15 text-chart-3'
      )}
      title={female ? 'Female-matching player' : 'Male-matching player'}
    >
      {female ? 'F' : 'M'}
    </span>
  );
}

function BudgetMeter({ spend, budget }: { spend: number; budget: number }) {
  const pct = Math.min(100, (spend / budget) * 100);
  const over = spend > budget;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Budget</span>
        <span className="nums font-medium">
          <span className={over ? 'text-destructive' : 'text-foreground'}>{spend}</span>
          <span className="text-muted-foreground"> / {budget}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            over ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="nums text-xs text-muted-foreground">
        {over
          ? `${spend - budget} credits over the cap`
          : `${budget - spend} credits remaining`}
      </p>
    </div>
  );
}

function RuleRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      {ok ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-2" />
      ) : (
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      )}
      <span className={ok ? 'text-muted-foreground' : 'text-foreground'}>{text}</span>
    </li>
  );
}

function SubmitDialog({
  picks,
  captainId,
  settings,
  disabled,
  onDone,
}: {
  picks: Player[];
  captainId: number | null;
  settings: PublicSettings;
  disabled: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [contact, setContact] = useState('');
  const { toast } = useToast();

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/entries', {
        managerName,
        teamName,
        contact: contact || null,
        playerIds: picks.map((p) => p.id),
        captainId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      setOpen(false);
      setManagerName('');
      setTeamName('');
      setContact('');
      toast({
        title: 'Entry locked in',
        description: 'Your squad is on the leaderboard. Good luck.',
      });
      onDone();
    },
    onError: (e: Error) => {
      const msg = e.message.replace(/^\d+:\s*/, '');
      let detail = msg;
      try {
        detail = JSON.parse(msg).error ?? msg;
      } catch {
        /* plain text error */
      }
      toast({ title: 'Entry rejected', description: detail, variant: 'destructive' });
    },
  });

  const valid = managerName.trim().length >= 2 && teamName.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          disabled={disabled || !settings.entriesOpen}
          data-testid="button-open-submit"
        >
          {settings.entriesOpen ? 'Submit entry' : 'Entries closed'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm your entry</DialogTitle>
          <DialogDescription>
            Squads are final once submitted — there are no transfers in this league.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fantasy-team">
              Fantasy team name
            </label>
            <Input
              id="fantasy-team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Hammer Time"
              data-testid="input-team-name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="manager">
              Your name
            </label>
            <Input
              id="manager"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Arjun Saminadan"
              data-testid="input-manager-name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="contact">
              Contact <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or phone, for prize contact"
              data-testid="input-contact"
            />
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your 7
            </p>
            <ul className="space-y-1">
              {picks.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {p.id === captainId && (
                      <Crown className="mr-1 inline h-3.5 w-3.5 text-primary" />
                    )}
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.teamCode} · <span className="nums">{p.price}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
            Back
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={!valid || submit.isPending}
            data-testid="button-confirm-submit"
          >
            {submit.isPending ? 'Submitting…' : 'Lock it in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BuildPage() {
  const { data: players, isLoading } = usePlayers();
  const { data: settings } = useSettings();
  const [selected, setSelected] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [matchUp, setMatchUp] = useState('all');
  const [sort, setSort] = useState<SortKey>('price-desc');
  const [affordableOnly, setAffordableOnly] = useState(false);

  const teams = useMemo(
    () => Array.from(new Set((players ?? []).map((p) => p.team))).sort(),
    [players]
  );

  const picks = useMemo(
    () => selected.map((id) => players?.find((p) => p.id === id)).filter((p): p is Player => !!p),
    [selected, players]
  );
  const spend = picks.reduce((t, p) => t + p.price, 0);
  const remaining = (settings?.budget ?? 0) - spend;

  const teamCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of picks) m.set(p.team, (m.get(p.team) ?? 0) + 1);
    return m;
  }, [picks]);

  const issues = settings ? validateSquad(picks, captainId, settings) : ['Loading rules…'];
  const women = picks.filter((p) => p.matchUp === 'F').length;
  const men = picks.length - women;

  function blockedReason(p: Player): string | null {
    if (!settings) return null;
    if (selected.includes(p.id)) return null;
    if (!p.available) return 'Unavailable';
    if (selected.length >= settings.squadSize) return 'Squad full';
    if (p.price > remaining) return 'Too expensive';
    if ((teamCounts.get(p.team) ?? 0) >= settings.maxPerTeam) return `Max ${p.teamCode}`;
    const slotsLeft = settings.squadSize - selected.length;
    const needF = Math.max(0, settings.minPerMatchUp - women);
    const needM = Math.max(0, settings.minPerMatchUp - men);
    if (p.matchUp === 'F' && needM >= slotsLeft) return 'Need male-matching';
    if (p.matchUp === 'M' && needF >= slotsLeft) return 'Need female-matching';
    return null;
  }

  function toggle(p: Player) {
    setSelected((cur) => {
      if (cur.includes(p.id)) {
        if (captainId === p.id) setCaptainId(null);
        return cur.filter((id) => id !== p.id);
      }
      if (blockedReason(p)) return cur;
      return [...cur, p.id];
    });
  }

  const visible = useMemo(() => {
    let list = (players ?? []).filter((p) => p.available);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.team.toLowerCase().includes(needle) ||
          (p.city ?? '').toLowerCase().includes(needle)
      );
    }
    if (team !== 'all') list = list.filter((p) => p.team === team);
    if (matchUp !== 'all') list = list.filter((p) => p.matchUp === matchUp);
    if (affordableOnly && settings)
      list = list.filter((p) => selected.includes(p.id) || !blockedReason(p));
    const pts = (p: Player) => (settings ? playerPoints(p, settings) : 0);
    const sorters: Record<SortKey, (a: Player, b: Player) => number> = {
      'price-desc': (a, b) => b.price - a.price || a.name.localeCompare(b.name),
      'price-asc': (a, b) => a.price - b.price || a.name.localeCompare(b.name),
      'points-desc': (a, b) => pts(b) - pts(a) || b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name),
      team: (a, b) => a.team.localeCompare(b.team) || (a.jersey ?? 99) - (b.jersey ?? 99),
    };
    return [...list].sort(sorters[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, q, team, matchUp, sort, affordableOnly, settings, selected, remaining, teamCounts]);

  const anyPoints = (players ?? []).some((p) => p.gamesPlayed > 0);

  if (isLoading || !settings) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="turf rounded-xl border border-card-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              Bharat Trophy 2026 · Fantasy Ultimate
            </p>
            <h1 className="mt-1.5 font-display text-xl font-semibold tracking-tight">
              Pick {settings.squadSize}. Beat the budget.
            </h1>
            <p className="mt-2 max-w-[52ch] text-sm text-muted-foreground">
              {players?.length} registered players across 11 state squads. Spend up to{' '}
              <span className="nums font-medium text-foreground">{settings.budget}</span> credits,
              keep the mixed match-up balance, and nominate one captain on{' '}
              <span className="nums">{settings.captainMultiplier}×</span> points.
            </p>
          </div>
          <dl className="flex gap-6">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Squad</dt>
              <dd className="nums font-display text-lg font-semibold">
                {picks.length}
                <span className="text-muted-foreground">/{settings.squadSize}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Left</dt>
              <dd
                className={cn(
                  'nums font-display text-lg font-semibold',
                  remaining < 0 && 'text-destructive'
                )}
              >
                {remaining}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* Player pool */}
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search player, team or city"
                className="pl-8"
                data-testid="input-search"
              />
            </div>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger className="w-[150px]" data-testid="select-team">
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
            <Select value={matchUp} onValueChange={setMatchUp}>
              <SelectTrigger className="w-[140px]" data-testid="select-matchup">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any match-up</SelectItem>
                <SelectItem value="F">Female-matching</SelectItem>
                <SelectItem value="M">Male-matching</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[150px]" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price-desc">Price high → low</SelectItem>
                <SelectItem value="price-asc">Price low → high</SelectItem>
                <SelectItem value="points-desc">Points scored</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="team">By team</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={affordableOnly ? 'default' : 'outline'}
              onClick={() => setAffordableOnly((v) => !v)}
              data-testid="button-affordable"
            >
              Pickable only
            </Button>
          </div>

          <p className="text-xs text-muted-foreground" data-testid="text-pool-count">
            Showing {visible.length} of {players?.length} players
          </p>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Users className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No players match those filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Clear the search or widen the team filter to see more of the pool.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-card-border bg-card">
              {visible.map((p) => {
                const isPicked = selected.includes(p.id);
                const blocked = blockedReason(p);
                const pts = playerPoints(p, settings);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => toggle(p)}
                      disabled={!isPicked && !!blocked}
                      data-testid={`button-player-${p.id}`}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors sm:gap-3',
                        isPicked
                          ? 'bg-primary/10 hover:bg-primary/15'
                          : blocked
                            ? 'cursor-not-allowed opacity-45'
                            : 'hover:bg-secondary/60'
                      )}
                    >
                      <span className="nums w-6 shrink-0 text-center text-xs text-muted-foreground sm:w-8">
                        {p.jersey ?? '–'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          <MatchUpChip value={p.matchUp} />
                          {p.role !== 'DFLT' && (
                            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                              {ROLE_LABEL[p.role] ?? p.role}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {p.team}
                          {p.city ? ` · ${p.city}` : ''}
                        </span>
                      </span>
                      {anyPoints && (
                        <span className="nums hidden w-14 shrink-0 text-right text-sm text-muted-foreground sm:block">
                          {pts} pts
                        </span>
                      )}
                      <span className="nums w-9 shrink-0 text-right text-sm font-semibold sm:w-14">
                        {p.price}
                      </span>
                      <span
                        className={cn(
                          'w-[68px] shrink-0 text-right text-[11px] leading-tight sm:w-24 sm:text-xs',
                          isPicked ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {isPicked ? 'Picked ✓' : (blocked ?? 'Add')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Squad panel */}
        <aside className="space-y-4 lg:sticky lg:top-[4.5rem]">
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Your squad</h2>
              {picks.length > 0 && (
                <button
                  onClick={() => {
                    setSelected([]);
                    setCaptainId(null);
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                  data-testid="button-clear"
                >
                  Clear all
                </button>
              )}
            </div>
            <BudgetMeter spend={spend} budget={settings.budget} />

            <ul className="mt-4 space-y-1.5">
              {Array.from({ length: settings.squadSize }).map((_, i) => {
                const p = picks[i];
                if (!p)
                  return (
                    <li
                      key={`empty-${i}`}
                      className="flex h-10 items-center rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground"
                    >
                      Slot {i + 1} — empty
                    </li>
                  );
                const isCap = captainId === p.id;
                return (
                  <li
                    key={p.id}
                    className="flex h-10 items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5"
                  >
                    <button
                      onClick={() => setCaptainId(isCap ? null : p.id)}
                      title={isCap ? 'Remove captaincy' : 'Make captain'}
                      data-testid={`button-captain-${p.id}`}
                      className={cn(
                        'rounded p-1',
                        isCap ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Star className={cn('h-3.5 w-3.5', isCap && 'fill-current')} />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-tight">{p.name}</span>
                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                        {p.teamCode} · {p.matchUp === 'F' ? 'F' : 'M'}
                        {isCap ? ` · captain ${settings.captainMultiplier}×` : ''}
                      </span>
                    </span>
                    <span className="nums shrink-0 text-sm font-medium">{p.price}</span>
                    <button
                      onClick={() => toggle(p)}
                      aria-label={`Remove ${p.name}`}
                      data-testid={`button-remove-${p.id}`}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-card-border bg-card p-4">
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
              {issues.length === 0 ? (
                <Check className="h-4 w-4 text-chart-2" />
              ) : (
                <TriangleAlert className="h-4 w-4 text-primary" />
              )}
              {issues.length === 0 ? 'Squad is legal' : 'Rule check'}
            </h2>
            <ul className="space-y-1.5">
              <RuleRow
                ok={picks.length === settings.squadSize}
                text={`${settings.squadSize} players selected (${picks.length})`}
              />
              <RuleRow ok={spend <= settings.budget} text={`Within ${settings.budget} credits`} />
              <RuleRow
                ok={picks.length !== settings.squadSize || women >= settings.minPerMatchUp}
                text={`≥ ${settings.minPerMatchUp} female-matching (${women})`}
              />
              <RuleRow
                ok={picks.length !== settings.squadSize || men >= settings.minPerMatchUp}
                text={`≥ ${settings.minPerMatchUp} male-matching (${men})`}
              />
              <RuleRow
                ok={Array.from(teamCounts.values()).every((n) => n <= settings.maxPerTeam)}
                text={`Max ${settings.maxPerTeam} per state team`}
              />
              <RuleRow
                ok={!!captainId && picks.some((p) => p.id === captainId)}
                text="Captain nominated"
              />
            </ul>
            <div className="mt-4">
              <SubmitDialog
                picks={picks}
                captainId={captainId}
                settings={settings}
                disabled={issues.length > 0}
                onDone={() => {
                  setSelected([]);
                  setCaptainId(null);
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
