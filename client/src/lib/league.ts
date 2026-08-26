import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Player, Entry, PublicSettings } from '@shared/schema';

export function usePlayers() {
  return useQuery<Player[]>({ queryKey: ['/api/players'] });
}
export function useSettings() {
  return useQuery<PublicSettings>({ queryKey: ['/api/settings'] });
}
export function useEntries() {
  return useQuery<Entry[]>({ queryKey: ['/api/entries'] });
}

export async function adminRequest(
  method: string,
  url: string,
  pin: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(
    ('__PORT_5000__'.startsWith('__') ? '' : '__PORT_5000__') + url,
    {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res;
}

export { apiRequest };

export const MATCH_UP_LABEL: Record<string, string> = { M: 'Male-matching', F: 'Female-matching' };
export const ROLE_LABEL: Record<string, string> = {
  DFLT: 'Player',
  CAP: 'Captain',
  SCAP: 'Spirit captain',
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}
