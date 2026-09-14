import { useState, useEffect, useMemo, useCallback } from "react";
import type { Player, Team } from "../domain/types";
import {
  fetchPropuestas,
  aprobarPropuesta,
  rechazarPropuesta,
  type ProposalDto,
} from "../services/api";
import { useAuth } from "../context/useAuth";

interface AdminModerationPanelProps {
  players: Player[];
  teams: Team[];
  onMatchApproved?: () => void;
}

export function AdminModerationPanel({
  players,
  teams,
  onMatchApproved,
}: AdminModerationPanelProps) {
  const { token, logout } = useAuth();
  const [propuestas, setPropuestas] = useState<ProposalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"aprobar" | "rechazar" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const loadPropuestas = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const list = await fetchPropuestas(token, "pendiente");
      setPropuestas(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar solicitudes";
      if (message.includes("401") || message.toLowerCase().includes("expirada")) {
        logout();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    let ignore = false;

    async function execute() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const list = await fetchPropuestas(token, "pendiente");
        if (!ignore) {
          setPropuestas(list);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : "Error al cargar solicitudes";
          if (message.includes("401") || message.toLowerCase().includes("expirada")) {
            logout();
          } else {
            setError(message);
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void execute();

    return () => {
      ignore = true;
    };
  }, [token, logout]);

  const handleManualRefresh = async () => {
    setLoading(true);
    await loadPropuestas();
  };

  const handleAprobar = async (propuesta: ProposalDto) => {
    if (!token) return;
    setActionId(propuesta.id_propuesta);
    setActionType("aprobar");
    setFeedback(null);

    try {
      await aprobarPropuesta(token, propuesta.id_propuesta);
      setPropuestas((prev) => prev.filter((p) => p.id_propuesta !== propuesta.id_propuesta));
      setFeedback({
        type: "success",
        text: `¡Propuesta #${propuesta.id_propuesta} aprobada! El partido y sus incidencias se consolidaron en las tablas.`,
      });
      onMatchApproved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al aprobar la propuesta";
      setFeedback({ type: "error", text: message });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleRechazar = async (propuesta: ProposalDto) => {
    if (!token) return;
    const confirmMsg = `¿Estás seguro de rechazar la propuesta #${propuesta.id_propuesta}? No se sumará a las tablas.`;
    if (!window.confirm(confirmMsg)) return;

    setActionId(propuesta.id_propuesta);
    setActionType("rechazar");
    setFeedback(null);

    try {
      await rechazarPropuesta(token, propuesta.id_propuesta);
      setPropuestas((prev) => prev.filter((p) => p.id_propuesta !== propuesta.id_propuesta));
      setFeedback({
        type: "success",
        text: `Propuesta #${propuesta.id_propuesta} rechazada.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al rechazar la propuesta";
      setFeedback({ type: "error", text: message });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  return (
    <div className="moderation-panel">
      <div className="panel-toolbar">
        <div className="toolbar-info">
          <h3>Bandeja de Propuestas Comunitarias</h3>
          <span className="count-badge">{propuestas.length} pendientes</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void handleManualRefresh()}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "🔄 Refrescar"}
        </button>
      </div>

      {feedback && (
        <div
          className={feedback.type === "success" ? "success-feedback-box" : "error-box"}
          role="alert"
          style={{ width: "100%", marginBottom: "16px" }}
        >
          {feedback.text}
        </div>
      )}

      {error && (
        <div className="error-box" role="alert" style={{ width: "100%", marginBottom: "16px" }}>
          <strong>Error de conexión:</strong> {error}
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void handleManualRefresh()}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {loading && propuestas.length === 0 ? (
        <div className="state-container">
          <div className="spinner" />
          <p>Cargando propuestas pendientes...</p>
        </div>
      ) : propuestas.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>✅</div>
          <h3>No hay propuestas pendientes</h3>
          <p>Todas las solicitudes de partidos fueron revisadas y moderadas.</p>
        </div>
      ) : (
        <div className="proposals-list">
          {propuestas.map((p) => {
            const playerA = playerMap.get(String(p.id_local));
            const playerB = playerMap.get(String(p.id_visitante));
            const nameA = playerA?.name || `Participante #${p.id_local}`;
            const nameB = playerB?.name || `Participante #${p.id_visitante}`;
            const teamA = playerA ? teamMap.get(playerA.teamId) || "Sin Equipo" : "";
            const teamB = playerB ? teamMap.get(playerB.teamId) || "Sin Equipo" : "";

            const isProcessingThis = actionId === p.id_propuesta;

            return (
              <div key={p.id_propuesta} className="proposal-card">
                <div className="proposal-card-header">
                  <div className="proposal-matchup">
                    <span className="player-title">
                      {nameA} <span className="team-pill">({teamA})</span>
                    </span>
                    <span className="vs-tag">vs</span>
                    <span className="player-title">
                      {nameB} <span className="team-pill">({teamB})</span>
                    </span>
                  </div>

                  <div className="proposal-score-box">
                    <span>{p.goles_local}</span>
                    <span className="score-sep">-</span>
                    <span>{p.goles_visitante}</span>
                  </div>
                </div>

                <div className="proposal-meta-row">
                  <span className="meta-item">
                    📅 {p.numero_fecha ? `Fecha ${p.numero_fecha}` : "Fecha libre"}
                  </span>
                  <span className="meta-item">
                    👤 Enviado por: <strong>{p.nombre_solicitante || "Anónimo"}</strong>
                  </span>
                  {p.creado_en && (
                    <span className="meta-item meta-dim">
                      🕒 {p.creado_en.replace("T", " ").slice(0, 16)}
                    </span>
                  )}
                </div>

                {/* Incidencias cargadas */}
                {(p.goleadores.length > 0 || p.rojas.length > 0) && (
                  <div className="proposal-incidents-box">
                    {p.goleadores.length > 0 && (
                      <div className="incident-line">
                        <span className="incident-label">Goles:</span>
                        <span className="incident-tags">
                          {p.goleadores.map((g, i) => {
                            const scorerPlayer = playerMap.get(String(g.personaId))?.name || "";
                            return (
                              <span key={i} className="incident-pill">
                                ⚽ {g.jugador} ({scorerPlayer}) x{g.cantidad}
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    )}

                    {p.rojas.length > 0 && (
                      <div className="incident-line">
                        <span className="incident-label">Rojas:</span>
                        <span className="incident-tags">
                          {p.rojas.map((r, i) => {
                            const cardPlayer = playerMap.get(String(r.personaId))?.name || "";
                            return (
                              <span key={i} className="incident-pill pill-red">
                                🟥 {r.jugador} ({cardPlayer})
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones de Moderador */}
                <div className="proposal-actions-row">
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={() => void handleAprobar(p)}
                    disabled={isProcessingThis}
                  >
                    {isProcessingThis && actionType === "aprobar"
                      ? "Aprobando..."
                      : "✓ Aprobar y Sumar"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => void handleRechazar(p)}
                    disabled={isProcessingThis}
                  >
                    {isProcessingThis && actionType === "rechazar"
                      ? "Rechazando..."
                      : "✕ Rechazar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
