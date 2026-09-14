export interface SorteoAssignment {
  person: string;
  team: string;
}

export interface SorteoValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Parses a newline-delimited string into a clean list of trimmed strings.
 */
export function parseSorteoList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Validates whether the pools of people and teams are sufficient for a lottery.
 */
export function validateSorteoInput(
  people: string[],
  teams: string[]
): SorteoValidationResult {
  if (people.length === 0 || teams.length === 0) {
    return {
      isValid: false,
      error: "Cargá al menos una persona y un equipo.",
    };
  }

  if (teams.length < people.length) {
    return {
      isValid: false,
      error: `Necesitás al menos tantos equipos (${teams.length}) como personas (${people.length}).`,
    };
  }

  return { isValid: true };
}

/**
 * Pure Fisher-Yates shuffle implementation.
 */
export function shuffleArray<T>(items: T[], randomFn = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Assigns a random unique team to each person.
 * Deterministic when randomFn is provided.
 */
export function assignTeams(
  people: string[],
  teams: string[],
  randomFn = Math.random
): SorteoAssignment[] {
  const validation = validateSorteoInput(people, teams);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const shuffledTeams = shuffleArray(teams, randomFn);

  return people.map((person, index) => ({
    person,
    team: shuffledTeams[index],
  }));
}
