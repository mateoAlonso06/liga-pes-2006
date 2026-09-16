import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  determineMatchWinner,
  getRequiredStages,
  buildKnockoutBracket,
} from "./knockout.ts";
import type { TournamentParticipant, Match } from "./types.ts";

describe("domain/knockout - determineMatchWinner", () => {
  it("determines winner when Player A has more goals", () => {
    const winner = determineMatchWinner(3, 1, null, null, "p1", "p2");
    assert.equal(winner, "p1");
  });

  it("determines winner when Player B has more goals", () => {
    const winner = determineMatchWinner(0, 2, null, null, "p1", "p2");
    assert.equal(winner, "p2");
  });

  it("breaks a tie using penalty shootout", () => {
    const winnerA = determineMatchWinner(2, 2, 4, 3, "p1", "p2");
    assert.equal(winnerA, "p1");

    const winnerB = determineMatchWinner(1, 1, 2, 4, "p1", "p2");
    assert.equal(winnerB, "p2");
  });

  it("returns null if match is tied without penalties or unplayed", () => {
    assert.equal(determineMatchWinner(2, 2, null, null, "p1", "p2"), null);
    assert.equal(determineMatchWinner(null, null, null, null, "p1", "p2"), null);
  });
});

describe("domain/knockout - getRequiredStages", () => {
  it("computes required stages based on participant count", () => {
    assert.deepEqual(getRequiredStages(2), ["final"]);
    assert.deepEqual(getRequiredStages(4), ["semifinal", "final"]);
    assert.deepEqual(getRequiredStages(8), ["cuartos", "semifinal", "final"]);
    assert.deepEqual(getRequiredStages(16), ["octavos", "cuartos", "semifinal", "final"]);
  });
});

describe("domain/knockout - buildKnockoutBracket", () => {
  const participants: TournamentParticipant[] = [
    { playerId: "1", playerName: "Beto", teamId: "10", teamName: "Inter", seed: 1 },
    { playerId: "2", playerName: "Daco", teamId: "11", teamName: "Milan", seed: 2 },
    { playerId: "3", playerName: "Dani", teamId: "12", teamName: "Juventus", seed: 3 },
    { playerId: "4", playerName: "Esteban", teamId: "13", teamName: "Roma", seed: 4 },
  ];

  it("builds empty stages if fewer than 2 participants", () => {
    assert.deepEqual(buildKnockoutBracket([], []), []);
    assert.deepEqual(buildKnockoutBracket([participants[0]], []), []);
  });

  it("initializes bracket with initial matchups and advances winners to final", () => {
    const matches: Match[] = [
      // Semifinal 1: Beto (1) vs Daco (2) -> Beto wins 3-1
      {
        id: "m1",
        playerAId: "1",
        playerBId: "2",
        goalsA: 3,
        goalsB: 1,
        played: true,
        stage: "semifinal",
        scorers: [],
        redCards: [],
      },
      // Semifinal 2: Dani (3) vs Esteban (4) -> Esteban wins on penalties 1-1 (4-2)
      {
        id: "m2",
        playerAId: "3",
        playerBId: "4",
        goalsA: 1,
        goalsB: 1,
        penaltiesA: 2,
        penaltiesB: 4,
        played: true,
        stage: "semifinal",
        scorers: [],
        redCards: [],
      },
    ];

    const bracket = buildKnockoutBracket(participants, matches);
    assert.equal(bracket.length, 2); // semifinal + final

    const semis = bracket[0];
    assert.equal(semis.stageKey, "semifinal");
    assert.equal(semis.matches.length, 2);

    assert.equal(semis.matches[0].winnerId, "1");
    assert.equal(semis.matches[1].winnerId, "4");

    const finalStage = bracket[1];
    assert.equal(finalStage.stageKey, "final");
    assert.equal(finalStage.matches.length, 1);

    const finalMatch = finalStage.matches[0];
    assert.equal(finalMatch.playerAId, "1");
    assert.equal(finalMatch.playerAName, "Beto");
    assert.equal(finalMatch.playerBId, "4");
    assert.equal(finalMatch.playerBName, "Esteban");
    assert.equal(finalMatch.played, false);
  });
});
