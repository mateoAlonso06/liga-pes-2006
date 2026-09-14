import React from "react";
import type { RedCardRow } from "../domain/types";

interface RedCardsTableProps {
  redCards: RedCardRow[];
}

export const RedCardsTable: React.FC<RedCardsTableProps> = ({ redCards }) => {
  if (redCards.length === 0) {
    return <div className="empty-state">No hay tarjetas rojas registradas en el torneo. ¡Juego limpio!</div>;
  }

  return (
    <div className="table-responsive">
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-number">#</th>
            <th>Expulsado (PES)</th>
            <th>Persona</th>
            <th>Equipo</th>
            <th className="col-pts">Rojas</th>
          </tr>
        </thead>
        <tbody>
          {redCards.map((row, index) => (
            <tr key={`${row.virtualPlayer}-${row.playerId}`}>
              <td className="col-number badge-position">{index + 1}</td>
              <td className="player-name">{row.virtualPlayer}</td>
              <td>{row.playerName}</td>
              <td className="team-name">{row.teamName}</td>
              <td className="col-pts" style={{ color: "#ff5252" }}>
                <strong>{row.count}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
