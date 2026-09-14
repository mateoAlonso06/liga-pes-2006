import type { Team, Player, Match, Incident } from "../domain/types";

export interface EquipoDto {
  id_equipo: number;
  nombre: string;
}

export interface PersonaDto {
  id_persona: number;
  nombre: string;
  id_equipo: number | null;
}

export interface PartidoDto {
  id_partido: number;
  goles_local: number;
  goles_visitante: number;
  numero_fecha: number | null;
  estado: string | null;
  id_local: number;
  id_visitante: number;
}

export interface IncidenciaDto {
  id_incidencia: number;
  jugador_virtual: string;
  tipo: "G" | "R";
  id_persona: number;
  id_partido: number;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function mapEquipoToTeam(dto: EquipoDto): Team {
  return {
    id: String(dto.id_equipo),
    name: dto.nombre,
  };
}

export function mapPersonaToPlayer(dto: PersonaDto): Player {
  return {
    id: String(dto.id_persona),
    name: dto.nombre,
    teamId: dto.id_equipo ? String(dto.id_equipo) : "",
  };
}

export function mapPartidoToMatch(dto: PartidoDto): Match {
  return {
    id: String(dto.id_partido),
    playerAId: String(dto.id_local),
    playerBId: String(dto.id_visitante),
    goalsA: dto.goles_local,
    goalsB: dto.goles_visitante,
    played: true,
    round: dto.numero_fecha ?? undefined,
    scorers: [],
    redCards: [],
  };
}

export function mapIncidenciaToIncident(dto: IncidenciaDto): Incident {
  return {
    id: String(dto.id_incidencia),
    virtualPlayer: dto.jugador_virtual,
    type: dto.tipo,
    playerId: String(dto.id_persona),
    matchId: String(dto.id_partido),
  };
}

export async function fetchEquipos(): Promise<Team[]> {
  const response = await fetch(`${API_BASE}/equipos`);
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.statusText}`);
  }
  const data: EquipoDto[] = await response.json();
  return data.map(mapEquipoToTeam);
}

export async function fetchPersonas(): Promise<Player[]> {
  const response = await fetch(`${API_BASE}/personas`);
  if (!response.ok) {
    throw new Error(`Failed to fetch personas: ${response.statusText}`);
  }
  const data: PersonaDto[] = await response.json();
  return data.map(mapPersonaToPlayer);
}

export async function fetchPartidos(): Promise<Match[]> {
  const response = await fetch(`${API_BASE}/partidos`);
  if (!response.ok) {
    throw new Error(`Failed to fetch partidos: ${response.statusText}`);
  }
  const data: PartidoDto[] = await response.json();
  return data.map(mapPartidoToMatch);
}

export async function fetchIncidencias(): Promise<Incident[]> {
  const response = await fetch(`${API_BASE}/incidencias`);
  if (!response.ok) {
    throw new Error(`Failed to fetch incidencias: ${response.statusText}`);
  }
  const data: IncidenciaDto[] = await response.json();
  return data.map(mapIncidenciaToIncident);
}

export interface TournamentData {
  teams: Team[];
  players: Player[];
  matches: Match[];
  incidents: Incident[];
}

export async function fetchTournamentData(): Promise<TournamentData> {
  const [teams, players, matches, incidents] = await Promise.all([
    fetchEquipos(),
    fetchPersonas(),
    fetchPartidos(),
    fetchIncidencias(),
  ]);

  return { teams, players, matches, incidents };
}

export interface ProposalDto {
  id_propuesta: number;
  id_local: number;
  id_visitante: number;
  goles_local: number;
  goles_visitante: number;
  numero_fecha: number | null;
  goleadores: Array<{
    jugador: string;
    personaId: number;
    cantidad: number;
  }>;
  rojas: Array<{
    jugador: string;
    personaId: number;
  }>;
  nombre_solicitante: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  creado_en?: string;
}

export async function submitProposal(
  payload: import("../domain/proposals").CreateProposalPayload
): Promise<ProposalDto> {
  const response = await fetch(`${API_BASE}/propuestas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export async function loginAdmin(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function fetchPropuestas(
  token: string,
  estado = "pendiente"
): Promise<ProposalDto[]> {
  const url = estado
    ? `${API_BASE}/propuestas?estado=${encodeURIComponent(estado)}`
    : `${API_BASE}/propuestas`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json();
}

export async function aprobarPropuesta(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/propuestas/${id}/aprobar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
}

export async function rechazarPropuesta(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/propuestas/${id}/rechazar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
}

export async function executeResetAndSorteo(
  token: string,
  assignments: Array<{ person: string; team: string }>
): Promise<void> {
  const [incidenciasRes, partidosRes, personasRes, equiposRes] = await Promise.all([
    fetch(`${API_BASE}/incidencias`),
    fetch(`${API_BASE}/partidos`),
    fetch(`${API_BASE}/personas`),
    fetch(`${API_BASE}/equipos`),
  ]);

  const incidencias: IncidenciaDto[] = await incidenciasRes.json();
  const partidos: PartidoDto[] = await partidosRes.json();
  const personas: PersonaDto[] = await personasRes.json();
  const equipos: EquipoDto[] = await equiposRes.json();

  for (const i of incidencias) {
    await fetch(`${API_BASE}/incidencias/${i.id_incidencia}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  for (const p of partidos) {
    await fetch(`${API_BASE}/partidos/${p.id_partido}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  for (const p of personas) {
    await fetch(`${API_BASE}/personas/${p.id_persona}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  for (const assignment of assignments) {
    let equipo = equipos.find(
      (e) => e.nombre.trim().toLowerCase() === assignment.team.trim().toLowerCase()
    );

    if (!equipo) {
      const createTeamRes = await fetch(`${API_BASE}/equipos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: assignment.team.trim() }),
      });
      if (createTeamRes.ok) {
        equipo = await createTeamRes.json();
        equipos.push(equipo!);
      }
    }

    await fetch(`${API_BASE}/personas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nombre: assignment.person.trim(),
        id_equipo: equipo ? equipo.id_equipo : null,
      }),
    });
  }
}

