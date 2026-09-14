import { useMemo } from "react";
import type { Incident, Player, Team, ScorerRow, RedCardRow } from "../domain/types";
import { calculateTopScorers, calculateRedCards } from "../domain/stats";

export interface StatsResult {
  topScorers: ScorerRow[];
  redCards: RedCardRow[];
}

export function useStats(
  incidents: Incident[],
  players: Player[],
  teams: Team[]
): StatsResult {
  const topScorers = useMemo(
    () => calculateTopScorers(incidents, players, teams),
    [incidents, players, teams]
  );

  const redCards = useMemo(
    () => calculateRedCards(incidents, players, teams),
    [incidents, players, teams]
  );

  return { topScorers, redCards };
}
