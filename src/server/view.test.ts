import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "../game/content.js";
import { buyFood, createRun, mergeTeamPets } from "../game/run.js";
import type {
  PetInstance,
  PetTemplate,
  ShopFoodItem
} from "../game/types.js";
import { buildWebView } from "./view.js";

function ant(
  template: PetTemplate,
  uid: string
): PetInstance {
  return {
    uid,
    templateId: template.id,
    name: template.title,
    tier: template.tier,
    level: 1,
    xp: 0,
    attack: template.baseAttack,
    health: template.baseHealth,
    battleStats: { attack: 0, health: 0 },
    perks: [],
    triggerCounters: {},
    copiedAbility: null
  };
}

test("web view exposes level-up causes and reward-group origins", () => {
  const content = loadContent();
  const state = createRun("view-level-up", content);
  const template = content.petsByTitle.get("Ant");
  assert.ok(template);
  const target = ant(template, "view-ant");
  target.xp = 1;
  state.team = [target];
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

  assert.equal(buyFood(state, content, 0, target.uid).ok, true);
  const view = buildWebView(state, content, "view-session");

  assert.equal(view.state.levelUps.length, 1);
  assert.equal(view.state.perkGlossary.length, 10);
  assert.ok(
    view.state.perkGlossary.every(
      (perk) => perk.nameZh && perk.description
    )
  );
  const apple = view.state.foodGlossary.find((food) => food.id === "apple");
  assert.ok(apple);
  assert.equal(apple.kind, "food");
  assert.equal(apple.nameZh, "苹果");
  assert.match(apple.description, /攻击/);
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
    petUid: target.uid,
    nameZh: "蚂蚁",
    fromLevel: 1,
    toLevel: 2,
    cause: "experience"
  });
  assert.equal(view.state.rewards[0].rewardTier, 2);
});

test("web view attributes both reward groups to a level 1 to level 3 jump", () => {
  const content = loadContent();
  const template = content.petsByTitle.get("Ant");
  assert.ok(template);
  const state = createRun("view-multi-level", content);
  const target = ant(template, "view-jump-target");
  target.xp = 1;
  const source = ant(template, "view-jump-source");
  source.level = 3;
  source.xp = 5;
  state.team = [target, source];

  assert.equal(
    mergeTeamPets(state, content, source.uid, target.uid).ok,
    true
  );
  const view = buildWebView(state, content, "view-multi-session");
  assert.equal(view.state.levelUps[0].levelUps, 2);
  assert.equal(view.state.levelUps[0].rewardGroups.length, 2);
  assert.equal(view.state.rewards.length, 2);
  assert.ok(
    view.state.rewards.every(
      (group) => group.source?.petUid === target.uid
    )
  );
});
