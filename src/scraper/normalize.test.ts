import assert from "node:assert/strict";
import test from "node:test";
import { analyzeAbility, analyzeFood } from "./normalize.js";

test("faint buff is fully mapped", () => {
  const result = analyzeAbility("Faint: Give a random friend +1 attack and +1 health.");
  assert.equal(result.trigger, "faint");
  assert.deepEqual(result.effects, ["modifyStats"]);
  assert.deepEqual(result.targets, ["randomFriend"]);
  assert.equal(result.status, "full");
});

test("start of battle damage is fully mapped", () => {
  const result = analyzeAbility("Start of Battle: Deal 2 damage to a random enemy.");
  assert.equal(result.trigger, "startOfBattle");
  assert.deepEqual(result.effects, ["dealDamage"]);
  assert.deepEqual(result.targets, ["randomEnemy"]);
  assert.equal(result.status, "full");
});

test("summon has an optional target and is fully mapped", () => {
  const result = analyzeAbility("Faint: Summon a 1/1 Bee.");
  assert.equal(result.trigger, "faint");
  assert.deepEqual(result.effects, ["summon"]);
  assert.equal(result.status, "full");
});

test("food text is passive and targets any pet", () => {
  const result = analyzeAbility("Give one pet +1 attack and +1 health.");
  assert.equal(result.trigger, "passive");
  assert.deepEqual(result.effects, ["modifyStats"]);
  assert.deepEqual(result.targets, ["anyPet"]);
  assert.equal(result.status, "full");
});

test("unrecognized text becomes custom", () => {
  const result = analyzeAbility("Something completely unique happens.");
  assert.equal(result.status, "custom");
  assert.deepEqual(result.effects, []);
});

test("food text keeps all effects and is passive", () => {
  const result = analyzeFood(
    "Give one pet the Honey Perk. Faint → Summon one 1/1 Bee."
  );
  assert.equal(result.trigger, "passive");
  assert.ok(result.effects.includes("perk"));
  assert.ok(result.effects.includes("summon"));
  assert.deepEqual(result.targets, ["anyPet"]);
  assert.equal(result.status, "full");
});
