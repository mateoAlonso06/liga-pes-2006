export interface Team {
  id: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
}

export interface GoalEvent {
  scorerName: string;
  playerId: string;
  amount: number;
}

export interface RedCardEvent {
  playerName: string;
  playerId: string;
}

export interface Match {
  id: string;
  playerAId: string;
  playerBId: string;
  goalsA: number | null;
  goalsB: number | null;
  played: boolean;
  round?: number;
  scorers: GoalEvent[];
  redCards: RedCardEvent[];
}

export interface StandingRow {
  playerId: string;
  playerName: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Incident {
  id: string;
  virtualPlayer: string;
  type: 'G' | 'R';
  playerId: string;
  matchId: string;
}

export interface ScorerRow {
  virtualPlayer: string;
  playerId: string;
  playerName: string;
  teamName: string;
  goals: number;
}

export interface RedCardRow {
  virtualPlayer: string;
  playerId: string;
  playerName: string;
  teamName: string;
  count: number;
}

export interface FixtureMatch {
  playerAId: string | null;
  playerAName: string;
  teamAName: string;
  playerBId: string | null;
  playerBName: string;
  teamBName: string;
  isBye: boolean;
  played: boolean;
  goalsA: number | null;
  goalsB: number | null;
}

export interface FixtureRound {
  roundNumber: number;
  matches: FixtureMatch[];
}


