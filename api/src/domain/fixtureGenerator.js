/**
 * Fixture generation domain module for tournaments.
 */

/**
 * Generates round-robin pairings for a list of participant IDs using the Berger/Polygon algorithm.
 * 
 * @param {Array<number|string>} participantIds 
 * @param {'ida'|'ida_vuelta'} format 
 * @returns {Array<Array<[number|string|null, number|string|null]>>}
 */
export function generatePairings(participantIds, format = 'ida') {
  if (participantIds.length < 2) return [];

  const ids = [...participantIds];
  if (ids.length % 2 !== 0) {
    ids.push(null);
  }

  const n = ids.length;
  let current = [...ids];
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      round.push([current[i], current[n - 1 - i]]);
    }
    rounds.push(round);

    const fixed = current[0];
    const rest = current.slice(1);
    const last = rest.pop();
    if (last !== undefined) {
      rest.unshift(last);
    }
    current = [fixed, ...rest];
  }

  if (format === 'ida_vuelta') {
    const returnRounds = rounds.map((round) =>
      round.map(([a, b]) => [b, a])
    );
    rounds.push(...returnRounds);
  }

  return rounds;
}

/**
 * Creates scheduled matches in the database for a tournament upon initiation if none exist yet.
 * 
 * @param {import('@libsql/client').Client} db 
 * @param {number|string} idTorneo 
 * @param {string} formato 
 */
export async function initializeTournamentMatches(db, idTorneo, formato) {
  const participantsRes = await db.execute({
    sql: 'SELECT id_persona, sembrado FROM torneo_participante WHERE id_torneo = ? ORDER BY sembrado ASC, id_persona ASC',
    args: [idTorneo],
  });
  const participants = participantsRes.rows.map((p) => Number(p.id_persona));

  if (participants.length < 2) return 0;

  const existingMatchesRes = await db.execute({
    sql: 'SELECT id_partido, numero_fecha, id_local, id_visitante, estado FROM partido WHERE id_torneo = ?',
    args: [idTorneo],
  });
  const existingMatches = existingMatchesRes.rows;

  let createdCount = 0;

  if (formato === 'eliminacion_directa') {
    // If knockout matches already exist, do not regenerate the tree
    if (existingMatches.length > 0) {
      return 0;
    }

    // Determine stage name
    let etapa = 'final';
    if (participants.length > 8) {
      etapa = 'octavos';
    } else if (participants.length > 4) {
      etapa = 'cuartos';
    } else if (participants.length > 2) {
      etapa = 'semifinal';
    }

    // Pair up participants for the initial knockout round
    for (let i = 0; i < participants.length; i += 2) {
      const p1 = participants[i];
      const p2 = participants[i + 1];
      if (p1 && p2) {
        await db.execute({
          sql: `INSERT INTO partido (id_torneo, etapa, numero_fecha, estado, id_local, id_visitante, goles_local, goles_visitante)
                VALUES (?, ?, 1, 'pendiente', ?, ?, 0, 0)`,
          args: [idTorneo, etapa, p1, p2],
        });
        createdCount++;
      }
    }
  } else {
    // League format (ida or ida_vuelta)
    const isIdaVuelta = formato === 'liga_ida_vuelta';
    const pairings = generatePairings(participants, isIdaVuelta ? 'ida_vuelta' : 'ida');

    for (let roundIndex = 0; roundIndex < pairings.length; roundIndex++) {
      const roundMatches = pairings[roundIndex];
      const numeroFecha = roundIndex + 1;

      for (const [idLocal, idVisitante] of roundMatches) {
        if (idLocal !== null && idVisitante !== null) {
          const alreadyExists = existingMatches.some((m) =>
            m.numero_fecha === numeroFecha &&
            ((m.id_local === idLocal && m.id_visitante === idVisitante) ||
             (m.id_local === idVisitante && m.id_visitante === idLocal))
          );

          if (!alreadyExists) {
            await db.execute({
              sql: `INSERT INTO partido (id_torneo, etapa, numero_fecha, estado, id_local, id_visitante, goles_local, goles_visitante)
                    VALUES (?, 'fecha', ?, 'pendiente', ?, ?, 0, 0)`,
              args: [idTorneo, numeroFecha, idLocal, idVisitante],
            });
            createdCount++;
          }
        }
      }
    }
  }

  return createdCount;
}
