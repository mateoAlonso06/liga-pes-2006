import { useState } from "react";
import type { Player, Team } from "../domain/types";
import {
  parseSorteoList,
  validateSorteoInput,
  assignTeams,
  type SorteoAssignment,
} from "../domain/sorteo";
import { executeResetAndSorteo } from "../services/api";
import { useAuth } from "../context/useAuth";

interface SorteoViewProps {
  currentPlayers: Player[];
  currentTeams: Team[];
  format: "ida" | "ida_vuelta";
  onChangeFormat: (format: "ida" | "ida_vuelta") => void;
  onSorteoComplete?: () => void;
}

export function SorteoView({
  currentPlayers,
  currentTeams,
  format,
  onChangeFormat,
  onSorteoComplete,
}: SorteoViewProps) {
  const { token } = useAuth();

  const initialPersonas =
    localStorage.getItem("pes_pool_personas") ||
    currentPlayers.map((p) => p.name).join("\n");

  const initialEquipos =
    localStorage.getItem("pes_pool_equipos") ||
    currentTeams.map((t) => t.name).join("\n");

  const [personasText, setPersonasText] = useState(initialPersonas);
  const [equiposText, setEquiposText] = useState(initialEquipos);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sorteoResult, setSorteoResult] = useState<SorteoAssignment[] | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleOpenConfirm = () => {
    setError(null);
    const people = parseSorteoList(personasText);
    const teams = parseSorteoList(equiposText);
    const validation = validateSorteoInput(people, teams);

    if (!validation.isValid) {
      setError(validation.error || "Datos inválidos para el sorteo.");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleExecuteSorteo = async () => {
    if (!token) return;
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setError(null);

    const people = parseSorteoList(personasText);
    const teams = parseSorteoList(equiposText);

    try {
      const assignments = assignTeams(people, teams);

      await executeResetAndSorteo(token, assignments);

      localStorage.setItem("pes_pool_personas", personasText);
      localStorage.setItem("pes_pool_equipos", equiposText);
      localStorage.setItem("pes_torneo_inicio", new Date().toISOString());

      setSorteoResult(assignments);
      onSorteoComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al ejecutar el sorteo";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sorteo-container">
      <div className="sorteo-header">
        <p className="subtitle-block">
          Cargá una persona por línea y un equipo por línea. Al sortear, se asigna un equipo al azar a cada participante y se inicializa el nuevo torneo en la base de datos oficial.
        </p>
      </div>

      {error && (
        <div className="error-box" role="alert" style={{ width: "100%", marginBottom: "16px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="form-grid-2">
        <div className="form-field">
          <label htmlFor="sorteoPersonas">Personas participantes (una por línea)</label>
          <textarea
            id="sorteoPersonas"
            className="form-textarea"
            rows={8}
            placeholder={"Franco\nNico\nMale\nTobi"}
            value={personasText}
            onChange={(e) => setPersonasText(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="sorteoEquipos">Equipos disponibles (uno por línea)</label>
          <textarea
            id="sorteoEquipos"
            className="form-textarea"
            rows={8}
            placeholder={"Brasil\nArgentina\nReal Madrid\nAC Milan\nArsenal\nInter"}
            value={equiposText}
            onChange={(e) => setEquiposText(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-field" style={{ marginTop: "16px", maxWidth: "300px" }}>
        <label htmlFor="fixtureFormatSorteo">Formato de fixture</label>
        <select
          id="fixtureFormatSorteo"
          className="form-select"
          value={format}
          onChange={(e) => onChangeFormat(e.target.value as "ida" | "ida_vuelta")}
          disabled={isSubmitting}
        >
          <option value="ida">Solo ida (cada rival una vez)</option>
          <option value="ida_vuelta">Ida y vuelta (cada rival dos veces)</option>
        </select>
      </div>

      <div className="sorteo-actions" style={{ marginTop: "20px" }}>
        <button
          type="button"
          className="btn btn-gold btn-lg"
          onClick={handleOpenConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sorteando..." : "🎲 Realizar Sorteo"}
        </button>
      </div>

      {/* Resultados del sorteo */}
      {sorteoResult && sorteoResult.length > 0 && (
        <div className="sorteo-results-section" style={{ marginTop: "32px" }}>
          <h3 className="section-title-retro">Plantel y Asignaciones Oficiales</h3>
          <div className="sorteo-grid">
            {sorteoResult.map((item, idx) => (
              <div key={idx} className="sorteo-card">
                <div className="p-name">{item.person}</div>
                <div className="p-team">→ {item.team}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowConfirmModal(false)}
            >
              ✕
            </button>
            <h2>Confirmar Sorteo</h2>
            <p className="modal-sub" style={{ lineHeight: "1.5" }}>
              Al realizar el sorteo se configurará el nuevo plantel y se <strong>REINICIARÁN</strong> todas las estadísticas: Posiciones, Goleadores y Tarjetas Rojas quedarán en 0, iniciando la Semana 1. ¿Deseas continuar?
            </p>

            <div className="modal-actions" style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => void handleExecuteSorteo()}
              >
                Sí, iniciar torneo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
