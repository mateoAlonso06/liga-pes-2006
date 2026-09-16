import type { Match, TournamentParticipant } from "./types";

export type StageKey = "octavos" | "cuartos" | "semifinal" | "final";

export interface KnockoutMatchSlot {
  slotId: string;
  stage: StageKey;
  playerAId: string | null;
  playerAName: string;
  teamAName: string;
  playerAAvatarUrl?: string | null;
  playerAIsRegistered?: boolean;
  playerBId: string | null;
  playerBName: string;
  teamBName: string;
  playerBAvatarUrl?: string | null;
  playerBIsRegistered?: boolean;
  goalsA: number | null;
  goalsB: number | null;
  penaltiesA: number | null;
  penaltiesB: number | null;
  played: boolean;
  winnerId: string | null;
  nextSlotId: string | null;
  databaseMatchId?: string;
}

export interface KnockoutStage {
  stageKey: StageKey;
  title: string;
  order: number;
  matches: KnockoutMatchSlot[];
}

export function determineMatchWinner(
  goalsA: number | null,
  goalsB: number | null,
  penaltiesA: number | null = null,
  penaltiesB: number | null = null,
  playerAId: string | null = null,
  playerBId: string | null = null
): string | null {
  if (goalsA === null || goalsB === null || !playerAId || !playerBId) {
    return null;
  }

  if (goalsA > goalsB) return playerAId;
  if (goalsB > goalsA) return playerBId;

  // Empate: definir por penales
  if (penaltiesA !== null && penaltiesB !== null) {
    if (penaltiesA > penaltiesB) return playerAId;
    if (penaltiesB > penaltiesA) return playerBId;
  }

  return null;
}

/**
 * Retorna las etapas requeridas según la cantidad de participantes (potencia de 2).
 */
export function getRequiredStages(participantCount: number): StageKey[] {
  if (participantCount <= 2) return ["final"];
  if (participantCount <= 4) return ["semifinal", "final"];
  if (participantCount <= 8) return ["cuartos", "semifinal", "final"];
  return ["octavos", "cuartos", "semifinal", "final"];
}

export function getStageTitle(stage: StageKey): string {
  switch (stage) {
    case "octavos":
      return "Octavos de Final";
    case "cuartos":
      return "Cuartos de Final";
    case "semifinal":
      return "Semifinales";
    case "final":
      return "Gran Final";
  }
}

/**
 * Construye el árbol completo de llaves (Bracket) combinando los participantes
 * y los partidos registrados en la base de datos.
 */
export function buildKnockoutBracket(
  participants: TournamentParticipant[],
  recordedMatches: Match[]
): KnockoutStage[] {
  if (participants.length < 2) {
    return [];
  }

  const stages = getRequiredStages(participants.length);
  const participantMap = new Map(participants.map((p) => [p.playerId, p]));

  // Ordenar participantes por sembrado si existe
  const sortedParticipants = [...participants].sort(
    (a, b) => (a.seed ?? 99) - (b.seed ?? 99)
  );

  const initialStage = stages[0];

  // Mapa de slots por etapa para encadenar avance de ganadores
  const stageSlotsMap = new Map<StageKey, KnockoutMatchSlot[]>();

  // 1. Inicializar slots para cada etapa
  stages.forEach((stage, stageIndex) => {
    const countInStage = Math.pow(2, stages.length - 1 - stageIndex);
    const slots: KnockoutMatchSlot[] = [];

    for (let i = 0; i < countInStage; i++) {
      const slotId = `${stage}-${i + 1}`;
      const nextStage = stages[stageIndex + 1];
      const nextSlotId = nextStage ? `${nextStage}-${Math.floor(i / 2) + 1}` : null;

      slots.push({
        slotId,
        stage,
        playerAId: null,
        playerAName: "A definir",
        teamAName: "",
        playerAAvatarUrl: null,
        playerAIsRegistered: false,
        playerBId: null,
        playerBName: "A definir",
        teamBName: "",
        playerBAvatarUrl: null,
        playerBIsRegistered: false,
        goalsA: null,
        goalsB: null,
        penaltiesA: null,
        penaltiesB: null,
        played: false,
        winnerId: null,
        nextSlotId,
      });
    }

    stageSlotsMap.set(stage, slots);
  });

  // 2. Colocar participantes iniciales en la primera etapa
  const initialSlots = stageSlotsMap.get(initialStage) ?? [];
  for (let i = 0; i < initialSlots.length; i++) {
    const slot = initialSlots[i];
    const pA = sortedParticipants[i * 2];
    const pB = sortedParticipants[i * 2 + 1];

    if (pA) {
      slot.playerAId = pA.playerId;
      slot.playerAName = pA.playerName;
      slot.teamAName = pA.teamName;
      slot.playerAAvatarUrl = pA.avatarUrl ?? null;
      slot.playerAIsRegistered = pA.isRegistered ?? false;
    }
    if (pB) {
      slot.playerBId = pB.playerId;
      slot.playerBName = pB.playerName;
      slot.teamBName = pB.teamName;
      slot.playerBAvatarUrl = pB.avatarUrl ?? null;
      slot.playerBIsRegistered = pB.isRegistered ?? false;
    }
  }

  // 3. Procesar progresivamente cada etapa vinculando los partidos reales y avanzando ganadores
  stages.forEach((stage, stageIndex) => {
    const slots = stageSlotsMap.get(stage) ?? [];
    const nextStage = stages[stageIndex + 1];
    const nextSlots = nextStage ? stageSlotsMap.get(nextStage) ?? [] : [];

    slots.forEach((slot, slotIndex) => {
      // Buscar si existe un partido real jugado en la BD para este slot o para estos rivales
      if (slot.playerAId && slot.playerBId) {
        const foundMatch = recordedMatches.find(
          (m) =>
            (m.stage === stage || !m.stage) &&
            ((m.playerAId === slot.playerAId && m.playerBId === slot.playerBId) ||
              (m.playerAId === slot.playerBId && m.playerBId === slot.playerAId))
        );

        if (foundMatch) {
          slot.databaseMatchId = foundMatch.id;
          slot.played = foundMatch.played;
          const isAHome = foundMatch.playerAId === slot.playerAId;
          slot.goalsA = isAHome ? foundMatch.goalsA : foundMatch.goalsB;
          slot.goalsB = isAHome ? foundMatch.goalsB : foundMatch.goalsA;
          slot.penaltiesA = isAHome ? (foundMatch.penaltiesA ?? null) : (foundMatch.penaltiesB ?? null);
          slot.penaltiesB = isAHome ? (foundMatch.penaltiesB ?? null) : (foundMatch.penaltiesA ?? null);

          slot.winnerId = determineMatchWinner(
            slot.goalsA,
            slot.goalsB,
            slot.penaltiesA,
            slot.penaltiesB,
            slot.playerAId,
            slot.playerBId
          );
        }
      }

      // Si hay ganador y hay siguiente ronda, avanzar al ganador al slot correspondiente
      if (slot.winnerId && nextSlots.length > 0) {
        const nextSlotIndex = Math.floor(slotIndex / 2);
        const nextSlot = nextSlots[nextSlotIndex];
        const isSlotA = slotIndex % 2 === 0;

        const winnerParticipant = participantMap.get(slot.winnerId);
        if (winnerParticipant && nextSlot) {
          if (isSlotA) {
            nextSlot.playerAId = winnerParticipant.playerId;
            nextSlot.playerAName = winnerParticipant.playerName;
            nextSlot.teamAName = winnerParticipant.teamName;
            nextSlot.playerAAvatarUrl = winnerParticipant.avatarUrl ?? null;
            nextSlot.playerAIsRegistered = winnerParticipant.isRegistered ?? false;
          } else {
            nextSlot.playerBId = winnerParticipant.playerId;
            nextSlot.playerBName = winnerParticipant.playerName;
            nextSlot.teamBName = winnerParticipant.teamName;
            nextSlot.playerBAvatarUrl = winnerParticipant.avatarUrl ?? null;
            nextSlot.playerBIsRegistered = winnerParticipant.isRegistered ?? false;
          }
        }
      }
    });
  });

  // Retornar las etapas estructuradas
  return stages.map((stage, index) => ({
    stageKey: stage,
    title: getStageTitle(stage),
    order: index + 1,
    matches: stageSlotsMap.get(stage) ?? [],
  }));
}
