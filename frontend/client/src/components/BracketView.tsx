import { useMemo } from "react";
import type { Match, TournamentParticipant } from "../domain/types";
import { buildKnockoutBracket } from "../domain/knockout";
import { UserAvatar } from "./UserAvatar";

interface BracketViewProps {
  participants: TournamentParticipant[];
  matches: Match[];
  onSelectPlayer?: (playerId: string) => void;
}

export function BracketView({ participants, matches, onSelectPlayer }: BracketViewProps) {
  const stages = useMemo(
    () => buildKnockoutBracket(participants, matches),
    [participants, matches]
  );

  if (stages.length === 0) {
    return (
      <div className="state-container">
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🏆</div>
        <h3>Cuadro de Eliminación Directa</h3>
        <p style={{ color: "var(--text-dim)", maxWidth: "480px" }}>
          Se necesitan al menos 2 participantes para generar el cuadro de llaves eliminatorias.
        </p>
      </div>
    );
  }

  return (
    <div className="bracket-wrapper">
      <div className="bracket-scroll-container">
        <div className="bracket-stages-row">
          {stages.map((stage) => (
            <div key={stage.stageKey} className="bracket-stage-column">
              <div className="bracket-stage-header">
                <h3>{stage.title}</h3>
                <span className="bracket-stage-count">
                  {stage.matches.length} {stage.matches.length === 1 ? "partido" : "partidos"}
                </span>
              </div>

              <div className="bracket-stage-matches">
                {stage.matches.map((slot, matchIdx) => {
                  const isWinnerA = slot.winnerId === slot.playerAId && Boolean(slot.playerAId);
                  const isWinnerB = slot.winnerId === slot.playerBId && Boolean(slot.playerBId);

                  return (
                    <div
                      key={slot.slotId}
                      className={`bracket-match-card ${slot.played ? "match-played" : "match-pending"}`}
                    >
                      <div className="match-card-meta">
                        <span className="match-slot-number">#{matchIdx + 1}</span>
                        {slot.played ? (
                          <span className="match-badge-finished">Finalizado</span>
                        ) : slot.playerAId && slot.playerBId ? (
                          <span className="match-badge-scheduled">Programado</span>
                        ) : (
                          <span className="match-badge-awaiting">A definir</span>
                        )}
                      </div>

                      {/* Contendiente A */}
                      <div className={`match-team-row ${isWinnerA ? "winner-row" : ""}`}>
                        <div className="team-info" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {slot.playerAId && (
                            <UserAvatar
                              name={slot.playerAName}
                              avatarUrl={slot.playerAAvatarUrl}
                              isRegistered={slot.playerAIsRegistered}
                              size="xs"
                              onClick={onSelectPlayer ? () => onSelectPlayer(slot.playerAId!) : undefined}
                            />
                          )}
                          <div>
                            <span
                              className={`participant-name ${onSelectPlayer && slot.playerAId ? "player-clickable-name" : ""}`}
                              onClick={onSelectPlayer && slot.playerAId ? () => onSelectPlayer(slot.playerAId!) : undefined}
                              title={onSelectPlayer && slot.playerAId ? `Ver ficha de ${slot.playerAName}` : undefined}
                            >
                              {slot.playerAName}
                              {isWinnerA && <span className="winner-crown"> 👑</span>}
                            </span>
                            {slot.teamAName && (
                              <span className="participant-team" style={{ display: "block" }}>{slot.teamAName}</span>
                            )}
                          </div>
                        </div>
                        <div className="score-group">
                          {slot.played ? (
                            <>
                              <span className="main-score">{slot.goalsA}</span>
                              {slot.penaltiesA !== null && (
                                <span className="penalties-score">({slot.penaltiesA})</span>
                              )}
                            </>
                          ) : (
                            <span className="score-placeholder">-</span>
                          )}
                        </div>
                      </div>

                      {/* Contendiente B */}
                      <div className={`match-team-row ${isWinnerB ? "winner-row" : ""}`}>
                        <div className="team-info" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {slot.playerBId && (
                            <UserAvatar
                              name={slot.playerBName}
                              avatarUrl={slot.playerBAvatarUrl}
                              isRegistered={slot.playerBIsRegistered}
                              size="xs"
                              onClick={onSelectPlayer ? () => onSelectPlayer(slot.playerBId!) : undefined}
                            />
                          )}
                          <div>
                            <span
                              className={`participant-name ${onSelectPlayer && slot.playerBId ? "player-clickable-name" : ""}`}
                              onClick={onSelectPlayer && slot.playerBId ? () => onSelectPlayer(slot.playerBId!) : undefined}
                              title={onSelectPlayer && slot.playerBId ? `Ver ficha de ${slot.playerBName}` : undefined}
                            >
                              {slot.playerBName}
                              {isWinnerB && <span className="winner-crown"> 👑</span>}
                            </span>
                            {slot.teamBName && (
                              <span className="participant-team" style={{ display: "block" }}>{slot.teamBName}</span>
                            )}
                          </div>
                        </div>
                        <div className="score-group">
                          {slot.played ? (
                            <>
                              <span className="main-score">{slot.goalsB}</span>
                              {slot.penaltiesB !== null && (
                                <span className="penalties-score">({slot.penaltiesB})</span>
                              )}
                            </>
                          ) : (
                            <span className="score-placeholder">-</span>
                          )}
                        </div>
                      </div>

                      {slot.played && slot.penaltiesA !== null && slot.penaltiesB !== null && (
                        <div className="penalties-notice">
                          Definido por penales ({slot.penaltiesA} - {slot.penaltiesB})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
