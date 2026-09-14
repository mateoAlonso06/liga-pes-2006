import React from 'react';
import type { StandingRow } from '../domain/types';

interface StandingsTableProps {
  standings: StandingRow[];
}

export const StandingsTable: React.FC<StandingsTableProps> = ({ standings }) => {
  if (standings.length === 0) {
    return <div className="empty-state">No hay participantes ni partidos registrados todavía.</div>;
  }

  return (
    <div className="table-responsive">
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-number">#</th>
            <th>Jugador</th>
            <th>Equipo</th>
            <th className="col-stat">PJ</th>
            <th className="col-stat">PG</th>
            <th className="col-stat">PE</th>
            <th className="col-stat">PP</th>
            <th className="col-stat">GF</th>
            <th className="col-stat">GC</th>
            <th className="col-stat">DG</th>
            <th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr key={row.playerId}>
              <td className="col-number badge-position">{index + 1}</td>
              <td className="player-name">{row.playerName}</td>
              <td className="team-name">{row.teamName}</td>
              <td className="col-stat">{row.played}</td>
              <td className="col-stat">{row.won}</td>
              <td className="col-stat">{row.drawn}</td>
              <td className="col-stat">{row.lost}</td>
              <td className="col-stat">{row.goalsFor}</td>
              <td className="col-stat">{row.goalsAgainst}</td>
              <td className="col-stat">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td className="col-pts"><strong>{row.points}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
