import type { Incident, Player, Team, ScorerRow, RedCardRow } from "./types";

/**
 * Pure function to calculate top scorers from incidents, players, and teams.
 * Independent of React or browser APIs.
 */
export function calculateTopScorers(
  incidents: Incident[],
  players: Player[],
  teams: Team[]
): ScorerRow[] {
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const teamMap = new Map<string, string>(teams.map((t) => [t.id, t.name]));

  const map = new Map<string, ScorerRow>();

  for (const incident of incidents) {
    if (incident.type !== "G") continue;

    const trimmedVirtual = incident.virtualPlayer.trim();
    const key = `${trimmedVirtual.toLowerCase()}|${incident.playerId}`;

    const existing = map.get(key);
    if (existing) {
      existing.goals += 1;
    } else {
      const player = playerMap.get(incident.playerId);
      const teamName = player ? teamMap.get(player.teamId) || "Sin Equipo" : "Desconocido";

      map.set(key, {
        virtualPlayer: trimmedVirtual,
        playerId: incident.playerId,
        playerName: player ? player.name : "Desconocido",
        teamName,
        goals: 1,
        avatarUrl: player?.avatarUrl ?? null,
        isRegistered: player?.isRegistered ?? false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.virtualPlayer.localeCompare(b.virtualPlayer);
  });
}

/**
 * Pure function to calculate red cards from incidents, players, and teams.
 * Independent of React or browser APIs.
 */
export function calculateRedCards(
  incidents: Incident[],
  players: Player[],
  teams: Team[]
): RedCardRow[] {
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const teamMap = new Map<string, string>(teams.map((t) => [t.id, t.name]));

  const map = new Map<string, RedCardRow>();

  for (const incident of incidents) {
    if (incident.type !== "R") continue;

    const trimmedVirtual = incident.virtualPlayer.trim();
    const key = `${trimmedVirtual.toLowerCase()}|${incident.playerId}`;

    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const player = playerMap.get(incident.playerId);
      const teamName = player ? teamMap.get(player.teamId) || "Sin Equipo" : "Desconocido";

      map.set(key, {
        virtualPlayer: trimmedVirtual,
        playerId: incident.playerId,
        playerName: player ? player.name : "Desconocido",
        teamName,
        count: 1,
        avatarUrl: player?.avatarUrl ?? null,
        isRegistered: player?.isRegistered ?? false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.virtualPlayer.localeCompare(b.virtualPlayer);
  });
}
