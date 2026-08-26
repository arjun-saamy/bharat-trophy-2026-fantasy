import { Skeleton } from '@/components/ui/skeleton';
import { usePlayers, useSettings } from '@/lib/league';

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function RulesPage() {
  const { data: settings } = useSettings();
  const { data: players } = usePlayers();

  if (!settings) return <Skeleton className="h-96 w-full" />;

  const scoring: Array<[string, number, string]> = [
    ['Goal caught', settings.ptsGoal, 'Player catches the disc in the end zone'],
    ['Assist', settings.ptsAssist, 'Throw that leads directly to a goal'],
    ['Defensive block', settings.ptsBlock, 'Any D on a throw or a forced turn'],
    ['Callahan', settings.ptsCallahan, 'Interception caught in the opponent end zone'],
    ['Turnover conceded', settings.ptsTurnover, 'Throwaway or drop charged to the player'],
    ['Game appearance', settings.ptsGame, 'Named on the roster and takes the field'],
    ['Team win', settings.ptsTeamWin, "Awarded to every player in the winning squad"],
    ['Spirit MVP', settings.ptsSpirit, "Named their team's spirit player of the game"],
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight">League rules</h1>
        <p className="mt-1.5 max-w-[62ch] text-sm text-muted-foreground">
          One entry, one squad, no transfers. Everything below is set by the organiser and applies
          to every entry equally.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Building a squad">
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Squad size</span>
              <span className="nums font-medium">{settings.squadSize} players</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Budget</span>
              <span className="nums font-medium">{settings.budget} credits</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Minimum per match-up</span>
              <span className="nums font-medium">
                {settings.minPerMatchUp} female · {settings.minPerMatchUp} male
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Max from one state team</span>
              <span className="nums font-medium">{settings.maxPerTeam}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Captain bonus</span>
              <span className="nums font-medium">{settings.captainMultiplier}× all points</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted-foreground">Player pool</span>
              <span className="nums font-medium">{players?.length ?? '—'} players</span>
            </li>
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            The pool is every rostered athlete across the 11 state squads. Coaches, assistant
            coaches and team managers are excluded. Match-up follows what each player registered on
            the India Ultimate hub, which is how the mixed-gender ratio is enforced on the field.
          </p>
        </Panel>

        <Panel title="Scoring">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">Action</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Points</th>
              </tr>
            </thead>
            <tbody>
              {scoring.map(([label, pts, note]) => (
                <tr key={label} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 align-top">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{note}</span>
                  </td>
                  <td className="nums py-2 text-right align-top font-semibold">
                    {pts > 0 ? `+${pts}` : pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="How the week runs">
          <ol className="space-y-3 text-sm">
            {[
              'Entries open before round one. Build your squad, nominate a captain, submit.',
              'The organiser records goals, assists, blocks, turnovers and spirit awards after each round from the official score sheets.',
              'Points recalculate instantly on the leaderboard — captain points are doubled at the total, not per action.',
              'Squads are locked for the whole tournament. Injuries and withdrawals are not replaced, so spread your risk.',
              'Highest total after the final wins. Ties break in favour of the squad that spent fewer credits.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="nums mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Fair play">
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              Players may enter a squad, but not one containing themselves — spirit of the game
              applies off the field too.
            </li>
            <li>
              Stat lines come from the official score sheets. If a sheet is unclear, the organiser's
              reading is final.
            </li>
            <li>
              A player who never takes the field scores nothing. There is no compensation and no
              refund of credits.
            </li>
            <li>
              One entry per person. Duplicate fantasy team names are rejected automatically.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
