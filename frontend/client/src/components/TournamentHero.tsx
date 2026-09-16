import React, { useState } from "react";
import type { Tournament } from "../domain/types";
import { UserAvatar } from "./UserAvatar";

interface TournamentHeroProps {
  tournament: Tournament;
  canManage: boolean;
  onBackToLobby: () => void;
  onIniciarTorneo?: () => void;
  iniciando?: boolean;
  onOpenJoinModal?: () => void;
  tournaments: Tournament[];
  onSelectTournament: (id: number) => void;
}

export const TournamentHero: React.FC<TournamentHeroProps> = ({
  tournament,
  canManage,
  onBackToLobby,
  onIniciarTorneo,
  iniciando = false,
  onOpenJoinModal,
  tournaments,
  onSelectTournament,
}) => {
  const [copied, setCopied] = useState(false);

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "liga_ida":
        return "Liga (Solo Ida)";
      case "liga_ida_vuelta":
        return "Liga (Ida y Vuelta)";
      case "eliminacion_directa":
        return "Eliminación Directa";
      case "grupos_eliminacion":
        return "Fase de Grupos + Playoff";
      default:
        return format;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "borrador":
        return <span className="hero-status-pill status-draft">📝 En Preparación</span>;
      case "en_curso":
        return <span className="hero-status-pill status-active">⚽ En Curso</span>;
      case "finalizado":
        return <span className="hero-status-pill status-finished">🏆 Finalizado</span>;
      default:
        return null;
    }
  };

  const handleCopyCode = () => {
    if (!tournament.inviteCode) return;
    void navigator.clipboard.writeText(tournament.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="tournament-hero">
      {/* Top action row */}
      <div className="hero-topbar">
        <button
          type="button"
          className="btn-back-lobby"
          onClick={onBackToLobby}
          title="Ver todos los torneos disponibles"
        >
          ← Explorar todos los torneos
        </button>

        <div className="hero-switcher">
          <label htmlFor="hero-tournament-select" className="sr-only">
            Cambiar torneo
          </label>
          <select
            id="hero-tournament-select"
            className="hero-dropdown"
            value={tournament.id}
            onChange={(e) => onSelectTournament(Number(e.target.value))}
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.status === "en_curso" ? "⚽ " : t.status === "finalizado" ? "🏆 " : "📝 "}
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main hero body */}
      <div className="hero-body">
        <div className="hero-visual-col">
          <div className="hero-trophy-circle">
            {tournament.status === "finalizado" ? "🏆" : tournament.status === "en_curso" ? "⚽" : "🎮"}
          </div>
        </div>

        <div className="hero-info-col">
          <div className="hero-tags-row">
            {getStatusBadge(tournament.status)}
            <span className="hero-tag">
              <span style={{ marginRight: "4px" }}>🎮</span> {tournament.game}
            </span>
            <span className="hero-tag">
              <span style={{ marginRight: "4px" }}>📋</span> {getFormatLabel(tournament.format)}
            </span>
          </div>

          <h1 className="hero-title">{tournament.name}</h1>

          {tournament.description && (
            <p className="hero-desc">{tournament.description}</p>
          )}

          <div className="hero-meta-row">
            {tournament.organizerUsername && (
              <div className="hero-organizer">
                <UserAvatar
                  name={tournament.organizerUsername}
                  isRegistered={true}
                  size="xs"
                />
                <span>
                  Organizado por <strong>{tournament.organizerUsername}</strong>
                </span>
              </div>
            )}

            <div className="hero-stats">
              <span className="hero-stat-item">
                👥 <strong>{tournament.participantsCount || 0}</strong> participantes
              </span>
              <span className="hero-stat-sep">•</span>
              <span className="hero-stat-item">
                ⚽ <strong>{tournament.matchesCount || 0}</strong> partidos
              </span>
            </div>
          </div>
        </div>

        {/* Hero actions / widget col */}
        <div className="hero-actions-col">
          {tournament.status === "finalizado" && tournament.championName && (
            <div className="hero-champion-card">
              <div className="champion-crown">🥇</div>
              <div className="champion-label">Campeón Oficial</div>
              <div className="champion-name">{tournament.championName}</div>
            </div>
          )}

          {canManage && tournament.inviteCode && (
            <div className="hero-code-box">
              <span className="hero-code-label">Código de Invitación (Privado)</span>
              <button
                type="button"
                className="hero-code-btn"
                onClick={handleCopyCode}
                title="Hacé click para copiar el código y compartirlo con los participantes"
              >
                <code>{tournament.inviteCode}</code>
                <span className="copy-tag">{copied ? "✓ Copiado" : "📋 Copiar"}</span>
              </button>
            </div>
          )}

          {canManage && tournament.status === "borrador" && onIniciarTorneo && (
            <button
              type="button"
              className="btn btn-gold hero-start-btn"
              onClick={onIniciarTorneo}
              disabled={iniciando}
            >
              {iniciando ? "Iniciando torneo..." : "▶ Iniciar Torneo"}
            </button>
          )}

          {!canManage && tournament.status === "borrador" && onOpenJoinModal && (
            <button
              type="button"
              className="btn btn-gold hero-join-btn"
              onClick={onOpenJoinModal}
            >
              📨 Solicitar Unirme
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
