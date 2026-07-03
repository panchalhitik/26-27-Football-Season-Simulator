import playersJson from './players.json';
import type { Player } from '@/types';

export const PLAYERS = playersJson as Player[];

export const PLAYERS_BY_ID = Object.fromEntries(
  PLAYERS.map((p) => [p.id, p]),
) as Record<string, Player>;

export const PLAYERS_BY_CLUB: Record<string, Player[]> = PLAYERS.reduce(
  (acc, p) => {
    (acc[p.clubId] ??= []).push(p);
    return acc;
  },
  {} as Record<string, Player[]>,
);

export const MARKET_PLAYERS: Player[] = PLAYERS_BY_CLUB['market'] ?? [];
