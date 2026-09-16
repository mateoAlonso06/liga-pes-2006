import { useState } from "react";
import { useTournament } from "../context/useTournament";
import { useAuth } from "../context/useAuth";
import { CreateTournamentModal } from "./CreateTournamentModal";
import { JoinTournamentModal } from "./JoinTournamentModal";

export function TournamentSelector() {
  const {
    tournaments,
    activeTournament,
    activeTournamentId,
    setActiveTournamentId,
    loadingTournaments,
    canManageActiveTournament,
  } = useTournament();
  const { isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "liga_ida":
        return "Liga (Ida)";
      case "liga_ida_vuelta":
        return "Liga (Ida y Vuelta)";
      case "eliminacion_directa":
        return "Eliminación Directa";
      case "grupos_eliminacion":
        return "Grupos + Eliminación";
      default:
        return format;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "borrador":
        return <span className="status-tag status-draft">Borrador</span>;
      case "en_curso":
        return <span className="status-tag status-active">En Curso</span>;
      case "finalizado":
        return <span className="status-tag status-finished">Finalizado</span>;
      default:
        return null;
    }
  };

  if (loadingTournaments && tournaments.length === 0) {
    return (
      <div className="tournament-strip">
        <div className="tournament-strip-inner" style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Cargando torneos...
        </div>
      </div>
    );
  }

  return (
    <div className="tournament-strip">
      <div className="tournament-strip-inner">
        {/* Left Side: Tournament Dropdown & Create Button */}
        <div className="tournament-strip-left">
          <span className="tournament-strip-icon" title="Torneo Activo">🏆</span>
          <label htmlFor="tournament-select" className="sr-only">
            Seleccionar Torneo
          </label>
          <div className="select-wrapper">
            <select
              id="tournament-select"
              className="tournament-dropdown"
              value={activeTournamentId ?? ""}
              onChange={(e) => setActiveTournamentId(Number(e.target.value))}
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.status === "en_curso" ? "⚽ " : t.status === "finalizado" ? "🏆 " : "📝 "}
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {isAuthenticated && (
            <>
              {!canManageActiveTournament && (
                <button
                  type="button"
                  className="btn-create-tournament"
                  onClick={() => setIsJoinModalOpen(true)}
                  title="Unirte a un torneo existente usando un código o solicitud"
                  style={{ background: "rgba(234, 179, 8, 0.2)", borderColor: "var(--accent-gold)" }}
                >
                  🔑 Unirme
                </button>
              )}
              <button
                type="button"
                className="btn-create-tournament"
                onClick={() => setIsModalOpen(true)}
                title="Crear un nuevo torneo"
              >
                + Nuevo Torneo
              </button>
            </>
          )}
        </div>

        {/* Right Side: Metadata Badges */}
        {activeTournament && (
          <div className="tournament-strip-right">
            {canManageActiveTournament && activeTournament.inviteCode && (
              <button
                type="button"
                className="format-badge"
                style={{
                  cursor: "pointer",
                  background: copied ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.15)",
                  borderColor: copied ? "var(--success)" : "var(--accent-gold)",
                  color: copied ? "#86efac" : "var(--accent-gold)",
                  fontWeight: 600,
                }}
                onClick={() => {
                  void navigator.clipboard.writeText(activeTournament.inviteCode!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                title="Hacé click para copiar el código de invitación (Visible solo para el organizador)"
              >
                🔑 Código: {activeTournament.inviteCode} {copied ? "✓ Copiado" : "📋"}
              </button>
            )}
            <span className="game-badge">
              <span className="game-icon">🎮</span> {activeTournament.game}
            </span>
            <span className="format-badge">
              📋 {getFormatLabel(activeTournament.format)}
            </span>
            {getStatusBadge(activeTournament.status)}
            {activeTournament.organizerUsername && (
              <span className="organizer-badge">
                👤 Org: <strong>{activeTournament.organizerUsername}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <CreateTournamentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <JoinTournamentModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
}
