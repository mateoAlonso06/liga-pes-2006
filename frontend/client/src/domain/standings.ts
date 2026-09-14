import type { Player, Match, Team, StandingRow } from './types';

/**
 * Pure function to calculate standings from matches and players.
 * Zero side effects, fully testable without React.
 */
export function calculateStandings(
  players: Player[],
  teams: Team[],
  matches: Match[]
): StandingRow[] {
  const teamMap = new Map<string, string>(teams.map(t => [t.id, t.name]));

  const statsMap = new Map<string, StandingRow>();

  for (const player of players) {
    statsMap.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      teamName: teamMap.get(player.teamId) || 'Sin Equipo',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (!match.played || match.goalsA === null || match.goalsB === null) {
      continue;
    }

    const statsA = statsMap.get(match.playerAId);
    const statsB = statsMap.get(match.playerBId);

    if (!statsA || !statsB) continue;

    statsA.played += 1;
    statsB.played += 1;

    statsA.goalsFor += match.goalsA;
    statsA.goalsAgainst += match.goalsB;
    statsB.goalsFor += match.goalsB;
    statsB.goalsAgainst += match.goalsA;

    if (match.goalsA > match.goalsB) {
      statsA.won += 1;
      statsA.points += 3;
      statsB.lost += 1;
    } else if (match.goalsA < match.goalsB) {
      statsB.won += 1;
      statsB.points += 3;
      statsA.lost += 1;
    } else {
      statsA.drawn += 1;
      statsA.points += 1;
      statsB.drawn += 1;
      statsB.points += 1;
    }

    statsA.goalDifference = statsA.goalsFor - statsA.goalsAgainst;
    statsB.goalDifference = statsB.goalsFor - statsB.goalsAgainst;
  }

  return Array.from(statsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.playerName.localeCompare(b.playerName);
  });
}
