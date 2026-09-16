import React from "react";

interface FooterProps {
  onNavigateLobby?: () => void;
  onOpenCreateModal?: () => void;
  onOpenJoinModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigateLobby,
  onOpenCreateModal,
  onOpenJoinModal,
}) => {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-top">
          {/* Brand Col */}
          <div className="footer-col footer-col-brand">
            <div
              className="footer-brand"
              onClick={onNavigateLobby}
              role={onNavigateLobby ? "button" : undefined}
              tabIndex={onNavigateLobby ? 0 : undefined}
              style={{ cursor: onNavigateLobby ? "pointer" : "default" }}
            >
              <img src="/logo.png" alt="Regional T" className="footer-logo-img" />
              <div>
                <span className="footer-brand-title">
                  REGIONAL <span style={{ color: "var(--gold-bright)" }}>T</span>
                </span>
                <span className="footer-brand-sub">Plataforma de Torneos de Fútbol</span>
              </div>
            </div>
            <p className="footer-about">
              Sistema integral de gestión de torneos, fixtures, estadísticas individuales, prode y llaves eliminatorias para comunidades de videojuegos de fútbol.
            </p>
          </div>

          {/* Quick Navigation Col */}
          <div className="footer-col">
            <h4 className="footer-heading">Navegación</h4>
            <ul className="footer-links">
              {onNavigateLobby && (
                <li>
                  <button type="button" onClick={onNavigateLobby} className="footer-link-btn">
                    Explorar Torneos
                  </button>
                </li>
              )}
              {onOpenCreateModal && (
                <li>
                  <button type="button" onClick={onOpenCreateModal} className="footer-link-btn">
                    Crear Nuevo Torneo
                  </button>
                </li>
              )}
              {onOpenJoinModal && (
                <li>
                  <button type="button" onClick={onOpenJoinModal} className="footer-link-btn">
                    Unirse con Código
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Formats / Features Col */}
          <div className="footer-col">
            <h4 className="footer-heading">Modalidades</h4>
            <ul className="footer-links-static">
              <li>Ligas Todos contra Todos</li>
              <li>Eliminación Directa y Playoffs</li>
              <li>Prode Comunitario de Fechas</li>
              <li>Moderación de Resultados</li>
            </ul>
          </div>

          {/* Community Info Col */}
          <div className="footer-col">
            <h4 className="footer-heading">Comunidad</h4>
            <div className="footer-badge-box">
              <span className="footer-chip">Videojuegos de Fútbol</span>
              <span className="footer-chip">Estadísticas en Tiempo Real</span>
            </div>
            <p className="footer-note">
              Diseñado para jugadores apasionados que buscan revivir la mística competitiva con rigor y datos precisos.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">
            © {new Date().getFullYear()} <strong>REGIONAL T</strong>. Plataforma Comunitaria.
          </p>
          <div className="footer-bottom-meta">
            <span>2006 - 2026</span>
            <span className="footer-sep">•</span>
            <span>Versión 2.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
