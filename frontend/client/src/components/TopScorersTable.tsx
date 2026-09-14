import React from "react";
import type { ScorerRow } from "../domain/types";

interface TopScorersTableProps {
  scorers: ScorerRow[];
}

export const TopScorersTable: React.FC<TopScorersTableProps> = ({ scorers }) => {
  if (scorers.length === 0) {
    return <div className="empty-state">No hay goles registrados todavía en el torneo.</div>;
  }

  return (
    <div className="table-responsive">
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-number">#</th>
            <th>Goleador (PES)</th>
            <th>Persona</th>
            <th>Equipo</th>
            <th className="col-pts">Goles</th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((row, index) => (
            <tr key={`${row.virtualPlayer}-${row.playerId}`}>
              <td className="col-number badge-position">{index + 1}</td>
              <td className="player-name">{row.virtualPlayer}</td>
              <td>{row.playerName}</td>
              <td className="team-name">{row.teamName}</td>
              <td className="col-pts"><strong>{row.goals}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
