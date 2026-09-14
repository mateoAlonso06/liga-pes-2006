import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSorteoList,
  validateSorteoInput,
  shuffleArray,
  assignTeams,
} from "./sorteo.ts";

describe("domain/sorteo", () => {
  it("parseSorteoList splits lines and trims whitespace", () => {
    const input = "  Franco \n\n Male\n Tobi \n";
    const result = parseSorteoList(input);
    assert.deepEqual(result, ["Franco", "Male", "Tobi"]);
  });

  it("validateSorteoInput rejects empty inputs", () => {
    assert.equal(validateSorteoInput([], ["Arsenal"]).isValid, false);
    assert.equal(validateSorteoInput(["Franco"], []).isValid, false);
  });

  it("validateSorteoInput rejects when there are fewer teams than people", () => {
    const res = validateSorteoInput(["A", "B", "C"], ["Team 1", "Team 2"]);
    assert.equal(res.isValid, false);
    assert.match(res.error!, /tantos equipos.*personas/i);
  });

  it("validateSorteoInput passes when teams >= people", () => {
    const res = validateSorteoInput(["A", "B"], ["Team 1", "Team 2", "Team 3"]);
    assert.equal(res.isValid, true);
  });

  it("assignTeams assigns a unique team to each person", () => {
    const people = ["Franco", "Nico", "Male"];
    const teams = ["Inter", "Milan", "Juventus"];
    const result = assignTeams(people, teams);

    assert.equal(result.length, 3);
    const assignedTeams = result.map((r) => r.team);
    const uniqueTeams = new Set(assignedTeams);
    assert.equal(uniqueTeams.size, 3);

    result.forEach((item) => {
      assert.ok(people.includes(item.person));
      assert.ok(teams.includes(item.team));
    });
  });

  it("shuffleArray is deterministic with pseudo-random seed function", () => {
    const arr = [1, 2, 3, 4];
    const pseudoRandom = () => 0.5;
    const shuffled1 = shuffleArray(arr, pseudoRandom);
    const shuffled2 = shuffleArray(arr, pseudoRandom);
    assert.deepEqual(shuffled1, shuffled2);
  });
});
