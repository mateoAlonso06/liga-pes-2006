import { useState, useEffect } from "react";
import { fetchTournamentData, type TournamentData } from "./services/api";
import { useStandings } from "./hooks/useStandings";
import { useStats } from "./hooks/useStats";
import { useFixture } from "./hooks/useFixture";
import { StandingsTable } from "./components/StandingsTable";
import { TopScorersTable } from "./components/TopScorersTable";
import { RedCardsTable } from "./components/RedCardsTable";
import { FixtureView } from "./components/FixtureView";
import { ProposalForm } from "./components/ProposalForm";
import { LoginModal } from "./components/LoginModal";
import { AdminModerationPanel } from "./components/AdminModerationPanel";
import { SorteoView } from "./components/SorteoView";
import { useAuth } from "./context/useAuth";
import "./App.css";

type TabKey = "posiciones" | "goleadores" | "rojas" | "fechas" | "cargar" | "sorteo" | "admin";

export function App() {
  const { isAuthenticated, username, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("posiciones");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [fixtureFormat, setFixtureFormat] = useState<"ida" | "ida_vuelta">("ida");

  useEffect(() => {
    let ignore = false;

    async function execute() {
      try {
        const result = await fetchTournamentData();
        if (!ignore) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : "Error al cargar los datos del torneo";
          setError(message);
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
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTournamentData();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar los datos del torneo";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const standings = useStandings(
    data?.players ?? [],
    data?.teams ?? [],
    data?.matches ?? []
  );

  const { topScorers, redCards } = useStats(
    data?.incidents ?? [],
    data?.players ?? [],
    data?.teams ?? []
  );

  const fixtureRounds = useFixture(
    data?.players ?? [],
    data?.teams ?? [],
    data?.matches ?? [],
    selectedPlayerId || undefined,
    fixtureFormat
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-badge">RT</div>
            <div>
              <h1>
                REGIONAL <span style={{ color: "var(--gold-bright)" }}>T</span>
              </h1>
              <div className="header-subtitle">Liga PES 2006 - 2026</div>
            </div>
          </div>
          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <span className="admin-pill">
                  <span className="dot" />
                  Admin: {username || "activo"}
                </span>
                <button
                  type="button"
                  className="logout-btn"
                  onClick={() => {
                    logout();
                    if (activeTab === "admin" || activeTab === "sorteo") {
                      setActiveTab("posiciones");
                    }
                  }}
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="admin-toggle"
                onClick={() => setIsLoginModalOpen(true)}
              >
                Modo Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <nav className="nav-tabs" aria-label="Navegación de secciones">
          <button
            type="button"
            className={`tab-btn ${activeTab === "posiciones" ? "active" : ""}`}
            onClick={() => setActiveTab("posiciones")}
          >
            <span>
              Posiciones
              <span className="tab-badge">{standings.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "goleadores" ? "active" : ""}`}
            onClick={() => setActiveTab("goleadores")}
          >
            <span>
              Goleadores
              <span className="tab-badge">{topScorers.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "rojas" ? "active" : ""}`}
            onClick={() => setActiveTab("rojas")}
          >
            <span>
              Tarjetas Rojas
              <span className="tab-badge">{redCards.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "fechas" ? "active" : ""}`}
            onClick={() => setActiveTab("fechas")}
          >
            <span>
              Fechas / Fixture
              <span className="tab-badge">{fixtureRounds.length}</span>
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "cargar" ? "active" : ""}`}
            onClick={() => setActiveTab("cargar")}
          >
            <span>
              Cargar Resultado
              <span className="tab-badge">✍️</span>
            </span>
          </button>
          {isAuthenticated && (
            <button
              type="button"
              className={`tab-btn ${activeTab === "sorteo" ? "active" : ""}`}
              onClick={() => setActiveTab("sorteo")}
            >
              <span>
                Sorteo
                <span className="tab-badge">🎲</span>
              </span>
            </button>
          )}
          <button
            type="button"
            className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
            onClick={() => {
              if (!isAuthenticated) {
                setIsLoginModalOpen(true);
              } else {
                setActiveTab("admin");
              }
            }}
          >
            <span>
              Moderación Admin
              <span className="tab-badge">🛡️</span>
            </span>
          </button>
        </nav>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">
              {activeTab === "posiciones" && "Tabla de Posiciones"}
              {activeTab === "goleadores" && "Tabla de Goleadores"}
              {activeTab === "rojas" && "Ranking de Expulsiones"}
              {activeTab === "fechas" && "Calendario y Fixture de Fechas"}
              {activeTab === "cargar" && "Cargar Resultado de Partido"}
              {activeTab === "sorteo" && "Sorteador Oficial de Equipos"}
              {activeTab === "admin" && "Panel de Moderación y Aprobaciones"}
            </h2>
            <button
              type="button"
              className="btn"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {loading && !data ? (
            <div className="state-container">
              <div className="spinner" />
              <p>Cargando datos oficiales...</p>
            </div>
          ) : error ? (
            <div className="state-container">
              <div className="error-box">
                <p><strong>Error de conexión:</strong> {error}</p>
              </div>
              <div>
                <button type="button" className="btn" onClick={handleRefresh}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "posiciones" && <StandingsTable standings={standings} />}
              {activeTab === "goleadores" && <TopScorersTable scorers={topScorers} />}
              {activeTab === "rojas" && <RedCardsTable redCards={redCards} />}
              {activeTab === "fechas" && (
                <FixtureView
                  rounds={fixtureRounds}
                  players={data?.players ?? []}
                  selectedPlayerId={selectedPlayerId}
                  onSelectPlayer={setSelectedPlayerId}
                  format={fixtureFormat}
                  onChangeFormat={setFixtureFormat}
                />
              )}
              {activeTab === "cargar" && (
                <ProposalForm
                  players={data?.players ?? []}
                  teams={data?.teams ?? []}
                  matches={data?.matches ?? []}
                  format={fixtureFormat}
                  onSuccess={() => {
                    void handleRefresh();
                    setActiveTab("posiciones");
                  }}
                />
              )}
              {activeTab === "sorteo" && (
                <SorteoView
                  currentPlayers={data?.players ?? []}
                  currentTeams={data?.teams ?? []}
                  format={fixtureFormat}
                  onChangeFormat={setFixtureFormat}
                  onSorteoComplete={() => {
                    void handleRefresh();
                    setActiveTab("posiciones");
                  }}
                />
              )}
              {activeTab === "admin" && (
                isAuthenticated ? (
                  <AdminModerationPanel
                    players={data?.players ?? []}
                    teams={data?.teams ?? []}
                    onMatchApproved={() => {
                      void handleRefresh();
                    }}
                  />
                ) : (
                  <div className="state-container">
                    <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔒</div>
                    <h3>Acceso Restringido</h3>
                    <p style={{ color: "var(--text-dim)", marginBottom: "20px" }}>
                      Debés iniciar sesión con tus credenciales de administrador para moderar las propuestas.
                    </p>
                    <button
                      type="button"
                      className="btn btn-gold"
                      onClick={() => setIsLoginModalOpen(true)}
                    >
                      Iniciar Sesión
                    </button>
                  </div>
                )
              )}
            </>
          )}
        </section>
      </main>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => setActiveTab("admin")}
      />
    </div>
  );
}

export default App;

