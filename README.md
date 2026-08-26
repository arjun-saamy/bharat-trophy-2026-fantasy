# Bharat Trophy 2026 — Fantasy Ultimate

A fantasy league web app for the [Bharat Trophy 2026](https://hub.indiaultimate.org/tournament/bharat-trophy-2026/register) ultimate frisbee tournament. Entrants build a 7-player squad from the 11 registered state squads under a credit budget, nominate a captain for double points, and are ranked on a live leaderboard as the organiser enters match statistics.

## League rules

- **Squad size:** 7 players
- **Budget:** 100 credits (organiser-configurable)
- **Match-up balance:** minimum 3 female-matching and 3 male-matching players
- **Club limit:** maximum 2 players from any one state team
- **Captain:** one nominated player scores double

Default scoring: goal +3, assist +3, block +4, Callahan +8, turnover −2, game appearance +1, team win +2, spirit MVP +5. Every rule and scoring value is editable by the organiser at runtime.

## Player pool

256 selectable players across 11 state squads (Delhi, Gujarat, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Odisha, Telangana, Tamil Nadu, Uttarakhand, West Bengal), sourced from the public India Ultimate hub registration data. Coaches, assistant coaches and managers are excluded from selection. The pool ships in `server/seed-players.json` and contains no contact details.

## Stack

Vite + React + TypeScript, wouter (hash routing), Tailwind CSS v3, TanStack Query, Express, better-sqlite3 with Drizzle ORM.

## Running locally

```bash
npm install
ADMIN_PIN=your-pin npm run dev      # http://localhost:5000
```

```bash
npm run check                        # typecheck
npm run build                        # production bundle -> dist/
ADMIN_PIN=your-pin NODE_ENV=production node dist/index.cjs
```

The SQLite database (`data.db`) is created and seeded on first boot and is gitignored.

## Configuration

| Variable    | Purpose                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `ADMIN_PIN` | Organiser panel PIN. Applied on every boot, overriding the stored value.      |
| `PORT`      | HTTP port (default `5000`).                                                   |

`ADMIN_PIN` is deliberately authoritative at startup so a forgotten or tampered PIN can never lock the organiser out of their own league. If it is unset, the PIN falls back to the stored value (initially `change-me` — change it before going live).

## Organiser panel

At `/#/admin`, PIN-gated:

- **Prices** — set each player's credit cost. Do this *before* opening entries; submitted squads retain the price they were bought at.
- **Match stats** — enter goals, assists, blocks, Callahans, turnovers, appearances, team wins and spirit MVPs. The leaderboard recalculates immediately.
- **League settings** — budget, squad size, limits, scoring values, open/close entries, and change the PIN.
- **Entries** — view all entries with contact details and export CSV.

## Security notes

- Entrant contact details are never exposed on the public API; they are served only over the PIN-gated organiser route.
- The admin login is rate limited to 20 failed attempts per 10 minutes per IP.
- All database access is parameterized via Drizzle.
- The PIN is a single shared secret with no user accounts or audit trail — appropriate for one organiser running one tournament, not for multi-organiser use.
- `data.db` is a local SQLite file. It is not durable production storage: export the entries CSV regularly, and migrate to a managed database for anything you cannot afford to lose.

## Data

Squad data comes from the public India Ultimate hub registration for Bharat Trophy 2026. Fantasy scoring is unofficial and run by the league organiser.
