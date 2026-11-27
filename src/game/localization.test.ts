import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "./content.js";
import {
  FOOD_NAME_ZH,
  FOOD_TEXT_ZH,
  PERK_DESCRIPTION_ZH,
  PERK_NAME_ZH,
  PET_ABILITY_ZH,
  PET_NAME_ZH,
  battleLogLineZh,
  petAbilityZh,
  petNameZh
} from "./localization.js";
import type { PetLevel } from "./types.js";

const content = loadContent();
const puppyContent = loadContent("puppy");

test("every Turtle Pack pet has a Chinese name and three ability texts", () => {
  assert.ok(Object.keys(PET_NAME_ZH).length >= 60);
  assert.ok(Object.keys(PET_ABILITY_ZH).length >= 60);
  for (const pet of content.pets.values()) {
    assert.ok(PET_NAME_ZH[pet.title], `missing name: ${pet.title}`);
    const abilities = PET_ABILITY_ZH[pet.title];
    assert.ok(abilities, `missing abilities: ${pet.title}`);
    assert.equal(abilities.length, 3);
    for (const level of [1, 2, 3] as PetLevel[]) {
      assert.notEqual(
        petAbilityZh(pet.title, level, "").trim(),
        "",
        `empty ability: ${pet.title} level ${level}`
      );
    }
  }
});

test("every Turtle Pack food has Chinese name and description", () => {
  assert.ok(Object.keys(FOOD_NAME_ZH).length >= 22);
  assert.ok(Object.keys(FOOD_TEXT_ZH).length >= 22);
  for (const food of content.foods.values()) {
    assert.ok(FOOD_NAME_ZH[food.id], `missing food name: ${food.id}`);
    assert.ok(FOOD_TEXT_ZH[food.id], `missing food text: ${food.id}`);
  }
});

test("every food perk has a Chinese name and glossary description", () => {
  assert.deepEqual(
    Object.keys(PERK_NAME_ZH).sort(),
    Object.keys(PERK_DESCRIPTION_ZH).sort()
  );
  for (const [id, description] of Object.entries(PERK_DESCRIPTION_ZH)) {
    assert.ok(PERK_NAME_ZH[id], `missing perk name: ${id}`);
    assert.ok(description.trim(), `missing perk description: ${id}`);
  }
});

test("every Puppy Pack pet and food has Chinese display text", () => {
  for (const pet of puppyContent.pets.values()) {
    assert.ok(PET_NAME_ZH[pet.title], `missing Puppy name: ${pet.title}`);
    const abilities = PET_ABILITY_ZH[pet.title];
    assert.ok(abilities, `missing Puppy abilities: ${pet.title}`);
    for (const level of [1, 2, 3] as PetLevel[]) {
      assert.match(
        petAbilityZh(pet.title, level, ""),
        /[\u4e00-\u9fff]/,
        `missing Chinese ability: ${pet.title} level ${level}`
      );
    }
  }
  for (const food of puppyContent.foods.values()) {
    assert.ok(FOOD_NAME_ZH[food.id], `missing Puppy food name: ${food.id}`);
    assert.ok(FOOD_TEXT_ZH[food.id], `missing Puppy food text: ${food.id}`);
  }
});

test("pet names and common battle log events are localized", () => {
  assert.equal(petNameZh("Ant"), "蚂蚁");
  assert.equal(
    battleLogLineZh("[战斗] Ant attacks Pig for 2."),
    "蚂蚁 攻击 猪，造成 2 点伤害。"
  );
  assert.equal(
    battleLogLineZh("[战斗] Player wins."),
    "你赢得了战斗。"
  );
  assert.equal(
    battleLogLineZh(
      "[战斗] Kangaroo triggers because Zombie Cricket attacks."
    ),
    "袋鼠 因 Zombie 蟋蟀 攻击触发技能。"
  );
});
