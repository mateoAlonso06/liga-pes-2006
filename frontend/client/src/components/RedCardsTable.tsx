import React from "react";
import type { RedCardRow } from "../domain/types";
import { UserAvatar } from "./UserAvatar";

interface RedCardsTableProps {
  redCards: RedCardRow[];
  onSelectPlayer?: (playerId: string) => void;
}

export const RedCardsTable: React.FC<RedCardsTableProps> = ({ redCards, onSelectPlayer }) => {
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
              <td>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <UserAvatar
                    name={row.playerName}
                    avatarUrl={row.avatarUrl}
                    isRegistered={row.isRegistered}
                    size="xs"
                    onClick={onSelectPlayer ? () => onSelectPlayer(row.playerId) : undefined}
                  />
                  <span
                    className={onSelectPlayer ? "player-clickable-name" : ""}
                    onClick={onSelectPlayer ? () => onSelectPlayer(row.playerId) : undefined}
                    title={onSelectPlayer ? `Ver ficha de ${row.playerName}` : undefined}
                  >
                    {row.playerName}
                  </span>
                </div>
              </td>
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
