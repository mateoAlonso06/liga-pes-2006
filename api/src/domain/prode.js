/**
 * Domain module for Prode (Match Predictions)
 */

/**
 * Calculates points obtained for a prediction against the actual match result.
 * Rules:
 * - Exact score (e.g. predicted 2-1, ended 2-1): 3 points
 * - Correct outcome (winner or draw, but not exact score): 1 point
 * - Incorrect: 0 points
 * - If match not played yet (actual goals null or undefined): null
 * 
 * @param {number|string|null} predHome 
 * @param {number|string|null} predAway 
 * @param {number|string|null} actualHome 
 * @param {number|string|null} actualAway 
 * @returns {number|null}
 */
export function calculateProdePoints(predHome, predAway, actualHome, actualAway) {
  if (
    actualHome === null ||
    actualAway === null ||
    actualHome === undefined ||
    actualAway === undefined
  ) {
    return null;
  }

  const pHome = Number(predHome);
  const pAway = Number(predAway);
  const aHome = Number(actualHome);
  const aAway = Number(actualAway);

  if (Number.isNaN(pHome) || Number.isNaN(pAway) || Number.isNaN(aHome) || Number.isNaN(aAway)) {
    return null;
  }

  // Exact score
  if (pHome === aHome && pAway === aAway) {
    return 3;
  }

  // Outcome: Win home, Win away, or Draw
  const predDiff = pHome - pAway;
  const actualDiff = aHome - aAway;

  if (Math.sign(predDiff) === Math.sign(actualDiff)) {
    return 1;
  }

  return 0;
}

/**
 * Settles all user predictions for a given match based on the real score.
 * 
 * @param {import('@libsql/client').Client} db 
 * @param {number|string} partidoId 
 * @param {number|string} actualHome 
 * @param {number|string} actualAway 
 */
export async function settleMatchProde(db, partidoId, actualHome, actualAway) {
  if (actualHome === null || actualAway === null || actualHome === undefined || actualAway === undefined) {
    return;
  }

  const predsResult = await db.execute({
    sql: 'SELECT id_pronostico, goles_local, goles_visitante FROM prode_pronostico WHERE id_partido = ?',
    args: [partidoId],
  });

  for (const pred of predsResult.rows) {
    const points = calculateProdePoints(
      pred.goles_local,
      pred.goles_visitante,
      actualHome,
      actualAway
    );

    await db.execute({
      sql: 'UPDATE prode_pronostico SET puntos_obtenidos = ? WHERE id_pronostico = ?',
      args: [points, pred.id_pronostico],
    });
  }
}
