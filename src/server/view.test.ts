import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "../game/content.js";
import { buyFood, createRun } from "../game/run.js";
import type { PetInstance, ShopFoodItem } from "../game/types.js";
import { buildWebView } from "./view.js";

test("web view exposes level-up causes and reward-group origins", () => {
  const content = loadContent();
  const state = createRun("view-level-up", content);
  const template = content.petsByTitle.get("Ant");
  assert.ok(template);
  const ant: PetInstance = {
    uid: "view-ant",
    templateId: template.id,
    name: template.title,
    tier: template.tier,
    level: 1,
    xp: 1,
    attack: template.baseAttack,
    health: template.baseHealth,
    battleStats: { attack: 0, health: 0 },
    perks: [],
    triggerCounters: {},
    copiedAbility: null
  };
  state.team = [ant];
  const chocolate = content.foods.get("chocolate");
  assert.ok(chocolate);
  const offer: ShopFoodItem = {
    kind: "food",
    itemId: "view-chocolate",
    templateId: chocolate.id,
    cost: chocolate.cost,
    generated: false,
    frozen: false,
    reward: false
  };
  state.shop.foods[0] = offer;

  assert.equal(buyFood(state, content, 0, ant.uid).ok, true);
  const view = buildWebView(state, content, "view-session");

  assert.equal(view.state.levelUps.length, 1);
  assert.deepEqual(
    {
      name: view.state.levelUps[0].nameZh,
      from: view.state.levelUps[0].fromLevel,
      to: view.state.levelUps[0].toLevel,
      cause: view.state.levelUps[0].cause
    },
    { name: "蚂蚁", from: 1, to: 2, cause: "experience" }
  );
  assert.equal(view.state.rewards.length, 1);
  assert.deepEqual(view.state.rewards[0].source, {
    petUid: ant.uid,
    nameZh: "蚂蚁",
    fromLevel: 1,
    toLevel: 2,
    cause: "experience"
  });
  assert.equal(view.state.rewards[0].rewardTier, 2);
});
