import { useMemo } from 'react';
import type { Player, Match, Team, StandingRow } from '../domain/types';
import { calculateStandings } from '../domain/standings';

/**
 * Hook connecting the pure domain logic to React lifecycle.
 */
export function useStandings(
  players: Player[],
  teams: Team[],
  matches: Match[]
): StandingRow[] {
  return useMemo(
    () => calculateStandings(players, teams, matches),
    [players, teams, matches]
  );
}
