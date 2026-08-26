import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DiscLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-label="Bharat Trophy Fantasy"
      role="img"
    >
      <ellipse cx="17" cy="17.5" rx="12" ry="7" transform="rotate(-18 17 17.5)" />
      <ellipse cx="17" cy="17.5" rx="5.5" ry="3" transform="rotate(-18 17 17.5)" />
      <path d="M2 9.5h7M4.5 5h9" />
    </svg>
  );
}

const NAV = [
  { href: '/', label: 'Build squad', short: 'Build' },
  { href: '/leaderboard', label: 'Leaderboard', short: 'Table' },
  { href: '/rules', label: 'Rules', short: 'Rules' },
  { href: '/admin', label: 'Organiser', short: 'Admin' },
];

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(prefers || true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0"
            data-testid="link-home"
          >
            <DiscLogo className="h-7 w-7 text-primary" />
            <span className="font-display text-base font-semibold leading-none tracking-tight">
              <span className="hidden sm:inline">Bharat Trophy</span>
              <span className="text-primary sm:ml-1.5">Fantasy</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {NAV.map((n) => {
              const active = location === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`link-nav-${n.href.replace('/', '') || 'build'}`}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs transition-colors sm:px-2.5 sm:text-sm',
                    active
                      ? 'bg-secondary font-medium text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  )}
                >
                  <span className="hidden sm:inline">{n.label}</span>
                  <span className="sm:hidden">{n.short}</span>
                </Link>
              );
            })}
            <button
              onClick={toggle}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="button-theme"
              className="ml-0.5 rounded-md p-2 sm:ml-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 text-xs text-muted-foreground sm:px-6">
        Squad data from the India Ultimate hub registration for Bharat Trophy 2026. Fantasy scoring
        is unofficial and run by the league organiser.
      </footer>
    </div>
  );
}
