import { useMemo } from "react";
import type { Player, Team, Match, FixtureRound } from "../domain/types";
import { buildFixture } from "../domain/fixture";

export function useFixture(
  players: Player[],
  teams: Team[],
  matches: Match[],
  filterPlayerId?: string,
  format: "ida" | "ida_vuelta" = "ida"
): FixtureRound[] {
  return useMemo(
    () => buildFixture(players, teams, matches, filterPlayerId, format),
    [players, teams, matches, filterPlayerId, format]
  );
}
