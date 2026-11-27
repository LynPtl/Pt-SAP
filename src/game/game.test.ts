import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveBattle } from "./battle.js";
import { loadContent } from "./content.js";
import {
  appendGhost,
  chooseGhost,
  GHOST_CONTENT_VERSION,
  loadGhosts,
  selectGhost,
  withGhostLock
} from "./ghosts.js";
import { loadRun, saveRun } from "./persistence.js";
import { SeededRandom } from "./rng.js";
import {
  buyFood,
  buyPet,
  createRun,
  endTurn,
  generateGhostTeam,
  ghostActionPointsForTurn,
  ghostStatAmountForTurn,
  mergeTeamPets,
  refreshShop,
  sellPet,
  stockWormFood
} from "./run.js";
import type {
  PetInstance,
  PetLevel,
  ShopFoodItem,
  ShopPetItem
} from "./types.js";

const content = loadContent();

function pet(
  title: string,
  uid: string,
  level: PetLevel = 1
): PetInstance {
  const template = content.petsByTitle.get(title);
  assert.ok(template, `missing template ${title}`);
  return {
    uid,
    templateId: template.id,
    name: template.title,
    tier: template.tier,
    level,
    xp: level === 3 ? 5 : level === 2 ? 2 : 0,
    attack: template.baseAttack + (level - 1) * 2,
    health: template.baseHealth + (level - 1) * 2,
    battleStats: { attack: 0, health: 0 },
    perks: [],
    triggerCounters: {},
    copiedAbility: null
  };
}

function customPet(
  title: string,
  uid: string,
  attack: number,
  health: number,
  level: PetLevel = 1
): PetInstance {
  return {
    ...pet(title, uid, level),
    attack,
    health
  };
}

function foodOffer(
  templateId: string,
  milkLevel?: PetLevel
): ShopFoodItem {
  const template = content.foods.get(templateId);
  assert.ok(template, `missing food ${templateId}`);
  return {
    kind: "food",
    itemId: `food-${templateId}`,
    templateId,
    cost: template.cost,
    generated: false,
    frozen: false,
    reward: false,
    ...(milkLevel ? { milkLevel } : {})
  };
}

test("seeded random is reproducible", () => {
  const first = new SeededRandom("seed");
  const second = new SeededRandom("seed");
  assert.deepEqual(
    Array.from({ length: 8 }, () => first.next()),
    Array.from({ length: 8 }, () => second.next())
  );
});

test("Turtle Pack content exposes 60 pets and correctly tiered foods", () => {
  const foods = [...content.foods.values()];
  assert.equal(content.pets.size, 60);
  assert.equal(foods.length, 22);
  assert.equal(foods.filter((food) => food.tier !== null).length, 17);
  assert.equal(foods.filter((food) => food.tokenOnly).length, 5);
  assert.equal(content.foods.get("sleeping-pill")?.cost, 1);
  assert.equal(content.foods.get("apple")?.cost, 3);
});

test("shop capacity follows SAP tier progression and generated food slots", () => {
  const state = createRun("shop-capacity", content);
  assert.equal(state.shop.pets.length, 3);
  assert.equal(state.shop.foods.length, 3);
  assert.equal(
    state.shop.foods.filter((offer) => offer && !offer.generated).length,
    1
  );

  state.shopTier = 3;
  refreshShop(state, content, false);
  assert.equal(state.shop.pets.length, 4);
  assert.equal(state.shop.foods.length, 4);
  assert.equal(
    state.shop.foods.filter((offer) => offer && !offer.generated).length,
    2
  );

  state.shopTier = 5;
  refreshShop(state, content, false);
  assert.equal(state.shop.pets.length, 5);
  assert.equal(state.shop.foods.length, 4);
});

test("normal turn progression expands pet shop capacity from 3 to 4 to 5", () => {
  const state = createRun("shop-turn-growth", content);
  state.team = [pet("Ant", "growth-ant")];
  for (let turn = 1; turn <= 4; turn++) {
    endTurn(state, content, []);
  }
  assert.equal(state.turn, 5);
  assert.equal(state.shopTier, 3);
  assert.equal(state.shop.pets.length, 4);
  assert.equal(state.shop.foods.length, 4);

  for (let turn = 5; turn <= 8; turn++) {
    endTurn(state, content, []);
  }
  assert.equal(state.turn, 9);
  assert.equal(state.shopTier, 5);
  assert.equal(state.shop.pets.length, 5);
  assert.equal(state.shop.foods.length, 4);
});

test("battle event stream is deterministic", () => {
  const input = {
    playerTeam: [pet("Ant", "a"), pet("Cricket", "c")],
    enemyTeam: [pet("Mosquito", "m"), pet("Pig", "p")],
    seed: "same-battle"
  };
  const first = resolveBattle(input, content);
  const second = resolveBattle(input, content);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.events.map((event) => event.seq),
    first.events.map((_event, index) => index + 1)
  );
});

test("start-of-battle damage is logged before the first attack", () => {
  const result = resolveBattle(
    {
      playerTeam: [pet("Mosquito", "mosquito")],
      enemyTeam: [pet("Ant", "ant")],
      seed: "priority"
    },
    content
  );
  const firstDamage = result.events.find((event) => event.type === "damage");
  const firstAttack = result.events.find((event) => event.type === "attack");
  assert.ok(firstDamage);
  assert.ok(firstAttack);
  assert.ok(firstDamage.seq < firstAttack.seq);
});

test("simultaneous attacks emit explicit player and enemy attack events", () => {
  const result = resolveBattle(
    {
      playerTeam: [pet("Ant", "player-attacker")],
      enemyTeam: [pet("Pig", "enemy-attacker")],
      seed: "two-sided-attacks"
    },
    content
  );
  const attackSides = new Set(
    result.events
      .filter((event) => event.type === "attack")
      .map((event) => event.side)
  );
  assert.ok(attackSides.has("player"));
  assert.ok(attackSides.has("enemy"));
  const firstState = result.events[0].state;
  assert.ok(firstState.units.length >= 2);
  assert.ok(
    firstState.units.every(
      (unit) =>
        typeof unit.attack === "number" &&
        typeof unit.health === "number" &&
        typeof unit.level === "number"
    )
  );
});

test("equal-attack trigger ties use seeded order instead of fixed player priority", () => {
  const firstDamageSides = new Set<string | null>();
  for (let seed = 0; seed < 24; seed++) {
    const result = resolveBattle(
      {
        playerTeam: [pet("Mosquito", `p-${seed}`)],
        enemyTeam: [pet("Mosquito", `e-${seed}`)],
        seed: `trigger-tie-${seed}`
      },
      content
    );
    firstDamageSides.add(
      result.events.find((event) => event.type === "damage")?.side ?? null
    );
  }
  assert.ok(firstDamageSides.has("player"));
  assert.ok(firstDamageSides.has("enemy"));
});

test("merging duplicate pets grants experience and stats", () => {
  const state = createRun("merge-test", content);
  const template = content.petsByTitle.get("Ant");
  assert.ok(template);
  state.team = [pet("Ant", "team-ant")];
  state.gold = 10;
  const offer: ShopPetItem = {
    kind: "pet",
    itemId: "manual-offer",
    templateId: template.id,
    cost: 3,
    attackBonus: 0,
    healthBonus: 0,
    rewardGroup: null,
    frozen: false,
    reward: false
  };
  state.shop.pets[0] = offer;
  const result = buyPet(state, content, 0);
  assert.equal(result.ok, true);
  assert.equal(state.gold, 7);
  assert.equal(state.team.length, 1);
  assert.equal(state.team[0].xp, 1);
  assert.equal(state.team[0].attack, 3);
  assert.equal(state.team[0].health, 3);
});

test("a level-up reward pair allows only one purchase", () => {
  const state = createRun("reward-pair", content);
  const ant = pet("Ant", "reward-ant");
  ant.xp = 1;
  state.team = [ant];
  state.gold = 100;
  const template = content.petsByTitle.get("Ant");
  assert.ok(template);
  state.shop.pets[0] = {
    kind: "pet",
    itemId: "reward-merge-offer",
    templateId: template.id,
    cost: 3,
    attackBonus: 0,
    healthBonus: 0,
    rewardGroup: null,
    frozen: false,
    reward: false
  };
  buyPet(state, content, 0);
  assert.equal(state.team[0].level, 2);
  assert.equal(state.shop.rewardPets.length, 2);
  const group = state.shop.rewardPets[0].rewardGroup;
  assert.ok(group);
  assert.equal(state.shop.rewardPets[1].rewardGroup, group);
  assert.notEqual(
    state.shop.rewardPets[0].templateId,
    state.shop.rewardPets[1].templateId
  );
  assert.ok(
    state.shop.rewardPets.every(
      (offer) => content.pets.get(offer.templateId)?.tier === 2
    )
  );
  assert.equal(state.levelUps.length, 1);
  assert.equal(state.levelUps[0].rewardTier, 2);
  assert.equal(state.levelUps[0].rewardGroup, group);
  const result = buyPet(state, content, null, undefined, 0);
  assert.equal(result.ok, true);
  assert.equal(
    state.shop.rewardPets.some((offer) => offer.rewardGroup === group),
    false
  );
});

test("separate level-ups create separate linked reward groups", () => {
  const state = createRun("multiple-reward-groups", content);
  const ant = pet("Ant", "reward-ant-a");
  const beaver = pet("Beaver", "reward-beaver");
  ant.xp = 1;
  beaver.xp = 1;
  state.team = [ant, beaver];
  state.gold = 100;
  state.shop.foods[0] = foodOffer("chocolate");
  assert.equal(buyFood(state, content, 0, ant.uid).ok, true);
  state.shop.foods[0] = foodOffer("chocolate");
  assert.equal(buyFood(state, content, 0, beaver.uid).ok, true);
  assert.equal(state.shop.rewardPets.length, 4);
  assert.equal(
    new Set(state.shop.rewardPets.map((offer) => offer.rewardGroup)).size,
    2
  );
});

test("Chocolate can take a level 2 pet to level 3 and still grants a reward pair", () => {
  const state = createRun("chocolate-level-3", content);
  const ant = pet("Ant", "chocolate-level-ant", 2);
  ant.xp = 4;
  state.team = [ant];
  state.shop.foods[0] = foodOffer("chocolate");

  assert.equal(buyFood(state, content, 0, ant.uid).ok, true);
  assert.equal(ant.level, 3);
  assert.equal(state.shop.rewardPets.length, 2);
  assert.equal(state.levelUps.length, 1);
  assert.equal(state.levelUps[0].fromLevel, 2);
  assert.equal(state.levelUps[0].toLevel, 3);
  assert.equal(state.levelUps[0].cause, "experience");
  assert.equal(state.levelUps[0].rewardSuppressed, null);
  assert.equal(
    state.levelUps[0].rewardGroup,
    state.shop.rewardPets[0].rewardGroup
  );
});

test("merging two level 2 pets to level 3 suppresses the reward pair", () => {
  const state = createRun("max-level-merge", content);
  state.team = [
    pet("Ant", "max-level-target", 2),
    pet("Ant", "max-level-source", 2)
  ];

  assert.equal(
    mergeTeamPets(state, content, "max-level-source", "max-level-target").ok,
    true
  );
  assert.equal(state.team[0].level, 3);
  assert.equal(state.shop.rewardPets.length, 0);
  assert.equal(state.levelUps.length, 1);
  assert.equal(state.levelUps[0].cause, "merge");
  assert.equal(state.levelUps[0].rewardSuppressed, "level-3-merge");
});

test("a complete turn produces a battle result and advances or ends the run", () => {
  const state = createRun("turn-test", content);
  state.team = [pet("Ant", "team-ant"), pet("Cricket", "team-cricket")];
  const result = endTurn(state, content);
  assert.equal(result.ok, true);
  assert.ok(
    state.phase === "shop" ||
      state.phase === "gameOver"
  );
  assert.ok(state.log.some((line) => line.startsWith("[战斗]")));
  assert.equal(state.lastBattleReplay?.opponentKind, "generated");
});

test("battle replay records a selected player ghost snapshot", () => {
  const state = createRun("snapshot-replay", content);
  state.team = [pet("Ant", "player-ant")];
  const enemyTeam = [pet("Pig", "enemy-pig")];

  assert.equal(
    endTurn(state, content, enemyTeam, {
      kind: "snapshot",
      id: "ghost-snapshot-1"
    }).ok,
    true
  );
  assert.equal(state.lastBattleReplay?.opponentKind, "snapshot");
  assert.equal(state.lastBattleReplay?.opponentId, "ghost-snapshot-1");
});

test("the tenth Arena victory ends the run as a win", () => {
  const state = createRun("tenth-win", content);
  state.wins = 9;
  state.team = [pet("Ant", "winning-ant", 3)];
  const result = endTurn(state, content, []);
  assert.equal(result.ok, true);
  assert.equal(state.wins, 10);
  assert.equal(state.phase, "gameOver");
  assert.equal(state.lastBattleOutcome, "win");
  assert.equal(state.lastBattleReplay?.outcome, "win");
});

test("all Turtle Pack pets can enter battle without missing handlers", () => {
  const templates = [...content.pets.values()];
  for (let index = 0; index < templates.length; index += 5) {
    const group = templates.slice(index, index + 5);
    const team = group.map((template, offset) =>
      pet(template.title, `all-${index}-${offset}`, 3)
    );
    const result = resolveBattle(
      {
        playerTeam: team,
        enemyTeam: [pet("Ant", `enemy-${index}`), pet("Hedgehog", `enemy-h-${index}`, 3)],
        seed: `all-${index}`
      },
      content
    );
    assert.ok(result.events.length > 0);
    assert.equal(
      result.events.some(
        (event) =>
          event.type === "warning" &&
          event.message.includes("No battle handler")
      ),
      false
    );
  }
});

test("frozen offers move to the left-most shop slots", () => {
  const state = createRun("freeze-order", content);
  const petOffer = state.shop.pets[2];
  const foodOfferItem = state.shop.foods[0];
  assert.ok(petOffer);
  assert.ok(foodOfferItem);
  petOffer.frozen = true;
  foodOfferItem.frozen = true;
  const result = refreshShop(state, content, true);
  assert.equal(result.ok, true);
  assert.equal(state.shop.pets[0]?.itemId, petOffer.itemId);
  assert.equal(state.shop.foods[0]?.itemId, foodOfferItem.itemId);
});

test("Worm stocks an extra two-gold apple at the next start of turn", () => {
  const state = createRun("worm-extra-food", content);
  state.team = [pet("Worm", "worm")];
  endTurn(state, content);
  assert.equal(state.shop.foods.length, 3);
  assert.ok(
    state.shop.foods.some(
      (offer) => offer?.templateId === "apple" && offer.cost === 2
    )
  );
});

test("Worm fills the right-most empty slot, otherwise replaces right-most unfrozen food", () => {
  const state = createRun("worm-placement", content);
  const worm = pet("Worm", "worm-placement-pet", 2);
  state.shop.foods = [
    foodOffer("apple"),
    null,
    null
  ];
  const emptyStock = stockWormFood(state, content, worm);
  assert.ok(emptyStock);
  assert.equal(state.shop.foods[2]?.itemId, emptyStock.itemId);
  assert.equal(emptyStock.cost, 2);
  assert.equal(emptyStock.milkLevel, 2);

  state.shop.foods = [
    foodOffer("apple"),
    foodOffer("honey"),
    foodOffer("pear")
  ];
  state.shop.foods[0]!.frozen = true;
  state.shop.foods[2]!.frozen = true;
  const replacement = stockWormFood(state, content, worm);
  assert.ok(replacement);
  assert.equal(state.shop.foods[1]?.itemId, replacement.itemId);

  for (const offer of state.shop.foods) {
    if (offer) offer.frozen = true;
  }
  const before = state.shop.foods.map((offer) => offer?.itemId);
  assert.equal(stockWormFood(state, content, worm), null);
  assert.deepEqual(
    state.shop.foods.map((offer) => offer?.itemId),
    before
  );
});

test("multiple Worms each stock one generated Apple", () => {
  const state = createRun("two-worms", content);
  state.team = [pet("Worm", "worm-a"), pet("Worm", "worm-b")];
  endTurn(state, content, []);
  const generatedApples = state.shop.foods.filter(
    (offer) => offer?.generated && offer.templateId === "apple"
  );
  assert.equal(generatedApples.length, 2);
});

test("Cow replaces food capacity with two free level-scaled Milks", () => {
  const state = createRun("cow-milk", content);
  const cow = content.petsByTitle.get("Cow");
  assert.ok(cow);
  state.gold = 100;
  state.shop.pets[0] = {
    kind: "pet",
    itemId: "cow-offer",
    templateId: cow.id,
    cost: 3,
    attackBonus: 0,
    healthBonus: 0,
    rewardGroup: null,
    frozen: false,
    reward: false
  };
  assert.equal(buyPet(state, content, 0).ok, true);
  const milks = state.shop.foods.filter(
    (offer) => offer?.templateId === "milk"
  );
  assert.equal(milks.length, 2);
  assert.ok(milks.every((offer) => offer?.cost === 0));
  assert.ok(milks.every((offer) => offer?.milkLevel === 1));
  assert.ok(milks.every((offer) => offer?.generated));
  assert.equal(state.shop.foods[0], null);
  assert.equal(state.shop.foods[1]?.generated, true);
  assert.equal(state.shop.foods[2]?.generated, true);
});

test("Cow Milk occupies the two right-most food slots at higher tiers", () => {
  const state = createRun("cow-milk-tier-5", content);
  const cow = content.petsByTitle.get("Cow");
  assert.ok(cow);
  state.shopTier = 5;
  state.gold = 100;
  state.shop.foods = [
    foodOffer("apple"),
    foodOffer("honey"),
    foodOffer("pear"),
    null
  ];
  state.shop.pets[0] = {
    kind: "pet",
    itemId: "cow-tier-five-offer",
    templateId: cow.id,
    cost: 3,
    attackBonus: 0,
    healthBonus: 0,
    rewardGroup: null,
    frozen: false,
    reward: false
  };

  assert.equal(buyPet(state, content, 0).ok, true);
  assert.equal(state.shop.foods[0], null);
  assert.equal(state.shop.foods[1], null);
  assert.equal(state.shop.foods[2]?.templateId, "milk");
  assert.equal(state.shop.foods[3]?.templateId, "milk");
  assert.ok(state.shop.foods[2]?.generated);
  assert.ok(state.shop.foods[3]?.generated);
});

test("Buying a Cow that levels up stocks Milk after the reward pair", () => {
  const state = createRun("cow-level-up-order", content);
  const cow = content.petsByTitle.get("Cow");
  assert.ok(cow);
  const target = pet("Cow", "cow-level-target");
  target.xp = 1;
  state.team = [target];
  state.gold = 100;
  state.shop.pets[0] = {
    kind: "pet",
    itemId: "cow-level-up-offer",
    templateId: cow.id,
    cost: 3,
    attackBonus: 0,
    healthBonus: 0,
    rewardGroup: null,
    frozen: false,
    reward: false
  };

  assert.equal(buyPet(state, content, 0).ok, true);
  assert.equal(target.level, 2);
  assert.equal(state.shop.rewardPets.length, 2);
  const milks = state.shop.foods.filter(
    (offer) => offer?.templateId === "milk"
  );
  assert.equal(milks.length, 2);
  assert.ok(milks.every((offer) => offer?.milkLevel === 2));
  const rewardLog = state.log.findIndex((line) =>
    line.includes("level-up reward choice")
  );
  const milkLog = state.log.findIndex((line) =>
    line.includes("Cow 用")
  );
  assert.ok(rewardLog >= 0);
  assert.ok(milkLog > rewardLog);
});

test("Cow eating Chocolate creates two free attack-only Chocolate Milks", () => {
  const state = createRun("cow-chocolate-milk", content);
  const cow = pet("Cow", "cow-chocolate", 2);
  state.team = [cow];
  state.gold = 100;
  state.shop.foods[0] = foodOffer("chocolate");
  const result = buyFood(state, content, 0, cow.uid);
  assert.equal(result.ok, true);
  const chocolateMilk = state.shop.foods.filter(
    (offer) => offer?.templateId === "chocolate-milk"
  );
  assert.equal(chocolateMilk.length, 2);
  assert.ok(chocolateMilk.every((offer) => offer?.cost === 0));
  assert.ok(chocolateMilk.every((offer) => offer?.milkLevel === 2));
  assert.ok(chocolateMilk.every((offer) => offer?.generated));
  assert.equal(state.shop.foods[0], null);
  const beforeAttack = cow.attack;
  const milkSlot = state.shop.foods.findIndex(
    (offer) => offer?.itemId === chocolateMilk[0]?.itemId
  );
  assert.equal(buyFood(state, content, milkSlot, cow.uid).ok, true);
  assert.equal(cow.attack, beforeAttack + 2);
});

test("Chocolate Milk is stocked before a Cow level-up reward", () => {
  const state = createRun("cow-chocolate-level-up", content);
  const cow = pet("Cow", "cow-chocolate-level-up", 2);
  cow.xp = 4;
  state.team = [cow];
  state.shop.foods[0] = foodOffer("chocolate");

  assert.equal(buyFood(state, content, 0, cow.uid).ok, true);
  assert.equal(cow.level, 3);
  assert.equal(state.shop.rewardPets.length, 2);
  const chocolateMilk = state.shop.foods.filter(
    (offer) => offer?.templateId === "chocolate-milk"
  );
  assert.equal(chocolateMilk.length, 2);
  assert.ok(chocolateMilk.every((offer) => offer?.milkLevel === 3));

  const milkLog = state.log.findIndex((line) =>
    line.includes("Chocolate Milk")
  );
  const rewardLog = state.log.findIndex((line) =>
    line.includes("level-up reward choice")
  );
  assert.ok(milkLog >= 0);
  assert.ok(rewardLog > milkLog);
});

test("Duck only buffs pets currently displayed in the shop", () => {
  const state = createRun("duck-shop", content);
  state.team = [pet("Duck", "duck")];
  const before = state.shop.pets[0];
  assert.ok(before);
  state.shop.rewardPets = [
    {
      ...structuredClone(before),
      itemId: "duck-reward",
      reward: true,
      rewardGroup: "duck-reward-group"
    }
  ];
  const result = sellPet(state, content, "duck");
  assert.equal(result.ok, true);
  assert.equal(before.healthBonus, 1);
  assert.equal(state.shop.rewardPets[0].healthBonus, 1);
  refreshShop(state, content, false);
  assert.ok(state.shop.pets.every((offer) => (offer?.healthBonus ?? 0) === 0));
});

test("Rabbit is limited to three food triggers per turn", () => {
  const state = createRun("rabbit-limit", content);
  state.team = [pet("Rabbit", "rabbit"), pet("Ant", "ant")];
  state.gold = 100;
  const target = state.team[1];
  for (let index = 0; index < 4; index++) {
    state.shop.foods[0] = foodOffer("apple");
    const result = buyFood(state, content, 0, target.uid);
    assert.equal(result.ok, true);
  }
  assert.equal(target.health, 9);
});

test("Seal only triggers when Seal itself eats food", () => {
  const state = createRun("seal-food", content);
  state.team = [
    pet("Seal", "seal"),
    pet("Ant", "ant"),
    pet("Cricket", "cricket"),
    pet("Pig", "pig")
  ];
  state.gold = 100;
  const target = state.team[1];
  const seal = state.team[0];
  state.shop.foods[0] = foodOffer("apple");
  buyFood(state, content, 0, target.uid);
  assert.deepEqual(
    state.team.map((entry) => entry.attack),
    [3, 3, 1, 4]
  );
  state.shop.foods[0] = foodOffer("apple");
  buyFood(state, content, 0, seal.uid);
  assert.deepEqual(
    state.team.map((entry) => entry.attack),
    [4, 4, 2, 5]
  );
});

test("higher-attack faints resolve first and full summon boards block summons", () => {
  const result = resolveBattle(
    {
      playerTeam: [
        customPet("Rat", "rat", 10, 1),
        pet("Pig", "p1"),
        pet("Pig", "p2"),
        pet("Pig", "p3"),
        pet("Pig", "p4")
      ],
      enemyTeam: [
        customPet("Deer", "deer", 9, 1),
        pet("Pig", "e1"),
        pet("Pig", "e2"),
        pet("Pig", "e3"),
        pet("Pig", "e4")
      ],
      seed: "summon-priority"
    },
    content
  );
  const dirtyRat = result.events.find(
    (event) => event.type === "summon" && event.message.startsWith("Dirty Rat")
  );
  const blockedBus = result.events.find(
    (event) =>
      event.type === "warning" &&
      event.message.includes("Bus cannot be summoned")
  );
  assert.ok(dirtyRat);
  assert.ok(blockedBus);
  assert.ok(dirtyRat.seq < blockedBus.seq);
});

test("all Turtle Pack food effects execute", () => {
  const foods = [...content.foods.values()];
  for (const template of foods) {
    const state = createRun(`food-${template.id}`, content);
    state.team = [pet("Ant", "food-target")];
    state.gold = 100;
    state.shop.foods = [foodOffer(template.id, template.id === "milk" ? 3 : undefined)];
    const result = buyFood(state, content, 0, "food-target");
    assert.equal(result.ok, true, `${template.name}: ${result.message}`);
  }
});

test("Sleeping Pill triggers shop-phase Spider summon", () => {
  const state = createRun("pill-spider", content);
  state.team = [pet("Spider", "spider")];
  state.shop.foods = [foodOffer("sleeping-pill")];
  const result = buyFood(state, content, 0, "spider");
  assert.equal(result.ok, true);
  assert.equal(state.team.length, 1);
  assert.equal(state.team[0].tier, 3);
  assert.equal(state.team[0].attack, 2);
  assert.equal(state.team[0].health, 2);
});

test("Sleeping Pill summons Sheep rams only when team slots are available", () => {
  const state = createRun("pill-sheep", content);
  state.team = [
    pet("Sheep", "sheep", 2),
    pet("Pig", "p1"),
    pet("Pig", "p2"),
    pet("Pig", "p3")
  ];
  state.shop.foods = [foodOffer("sleeping-pill")];
  const result = buyFood(state, content, 0, "sheep");
  assert.equal(result.ok, true);
  assert.equal(state.team.length, 5);
  assert.equal(
    state.team.filter((entry) => entry.name === "Ram").length,
    2
  );
  const rams = state.team.filter((entry) => entry.name === "Ram");
  const merged = mergeTeamPets(
    state,
    content,
    rams[0].uid,
    rams[1].uid
  );
  assert.equal(merged.ok, true);
  const ram = state.team.find((entry) => entry.name === "Ram");
  assert.ok(ram);
  assert.equal(ram.level, 3);
});

test("Sleeping Pill can resolve every Turtle Pack faint pet without throwing", () => {
  const faintPets = [
    "Ant",
    "Cricket",
    "Flamingo",
    "Hedgehog",
    "Rat",
    "Spider",
    "Badger",
    "Sheep",
    "Deer",
    "Turtle",
    "Hippogriff",
    "Rooster",
    "Mammoth"
  ];
  for (const name of faintPets) {
    const state = createRun(`pill-${name}`, content);
    state.team = [
      pet(name, `pill-${name}`, 3),
      pet("Pig", `p1-${name}`),
      pet("Pig", `p2-${name}`)
    ];
    state.shop.foods = [foodOffer("sleeping-pill")];
    const result = buyFood(state, content, 0, `pill-${name}`);
    assert.equal(result.ok, true, name);
  }
});

test("sell value is based on pet level", () => {
  const state = createRun("sell-level", content);
  state.team = [pet("Pig", "pig", 2)];
  const before = state.gold;
  sellPet(state, content, "pig");
  assert.equal(state.gold, before + 4);
});

test("randomized full battles do not throw", () => {
  const templates = [...content.pets.values()];
  for (let seed = 0; seed < 40; seed++) {
    const rng = new SeededRandom(`fuzz-${seed}`);
    const makeTeam = (side: string): PetInstance[] =>
      Array.from({ length: 5 }, (_value, index) => {
        const template = rng.pick(templates);
        assert.ok(template);
        return pet(
          template.title,
          `${side}-${index}`,
          rng.pick([1, 1, 2, 3] as const) ?? 1
        );
      });
    const result = resolveBattle(
      {
        playerTeam: makeTeam("p"),
        enemyTeam: makeTeam("e"),
        seed: `fuzz-battle-${seed}`
      },
      content
    );
    assert.ok(result.events.length > 0);
  }
});

test("automated runs reach game over without stalling", () => {
  for (let seed = 0; seed < 12; seed++) {
    const state = createRun(`autoplay-${seed}`, content);
    for (let round = 0; round < 40 && state.phase === "shop"; round++) {
      for (let slot = 0; slot < state.shop.pets.length; slot++) {
        if (state.gold < 3) break;
        buyPet(state, content, slot);
      }
      endTurn(state, content);
    }
    assert.equal(
      state.phase,
      "gameOver",
      `autoplay seed ${seed} stalled at turn ${state.turn}`
    );
  }
});

test("ghost selection returns a clone of another run's snapshot", () => {
  const state = createRun("ghost-current", content);
  const ghostTeam = [pet("Ant", "ghost-ant"), pet("Cricket", "ghost-cricket")];
  const selected = chooseGhost(state, [
    {
      id: "ghost-1",
      runSeed: "ghost-source",
      turn: state.turn,
      wins: state.wins,
      lives: state.lives,
      contentVersion: GHOST_CONTENT_VERSION,
      team: ghostTeam
    }
  ]);
  assert.deepEqual(selected, ghostTeam);
  assert.notEqual(selected, ghostTeam);
  if (selected) selected[0].attack = 99;
  assert.equal(ghostTeam[0].attack, 2);
  const selection = selectGhost(state, [
    {
      id: "ghost-with-metadata",
      runSeed: "ghost-source",
      turn: state.turn,
      wins: state.wins,
      lives: state.lives,
      contentVersion: GHOST_CONTENT_VERSION,
      team: ghostTeam
    }
  ]);
  assert.equal(selection?.snapshot.id, "ghost-with-metadata");
});

test("ghost runId distinguishes same-seed runs and excludes the current run", () => {
  const state = createRun("shared-daily-seed", content);
  const team = [pet("Ant", "daily-ghost")];
  const otherRun = chooseGhost(
    state,
    [
      {
        id: "daily-other",
        runSeed: state.seed,
        runId: "other-run",
        turn: state.turn,
        wins: state.wins,
        lives: state.lives,
        contentVersion: GHOST_CONTENT_VERSION,
        team
      }
    ],
    "current-run"
  );
  assert.ok(otherRun);
  const currentRun = chooseGhost(
    state,
    [
      {
        id: "daily-current",
        runSeed: state.seed,
        runId: "current-run",
        turn: state.turn,
        wins: state.wins,
        lives: state.lives,
        contentVersion: GHOST_CONTENT_VERSION,
        team
      }
    ],
    "current-run"
  );
  assert.equal(currentRun, null);
});

test("ghost selection rejects snapshots from another content version", () => {
  const state = createRun("ghost-content-version", content);
  const selected = chooseGhost(state, [
    {
      id: "old-content",
      runSeed: "old-run",
      turn: state.turn,
      wins: state.wins,
      lives: state.lives,
      contentVersion: "old-content-version",
      team: [pet("Ant", "old-ant")]
    }
  ]);
  assert.equal(selected, null);
});

test("Ghost fallback follows SAP turn and action-point design", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 8, 11, 20].map(ghostActionPointsForTurn),
    [0, 1, 2, 4, 6, 12, 18, 36]
  );
  assert.deepEqual(
    [1, 4, 8, 11, 20].map(ghostStatAmountForTurn),
    [2, 3, 4, 4, 7]
  );

  const state = createRun("ghost-rules", content);
  const turnOne = generateGhostTeam(state, content);
  assert.equal(turnOne.length, 3);
  assert.ok(turnOne.every((pet) => pet.tier === 1));
  assert.ok(turnOne.every((pet) => pet.level === 1 && pet.xp === 0));
  assert.ok(turnOne.every((pet) => pet.perks.length === 0));

  state.turn = 2;
  state.shopTier = 1;
  const turnTwo = generateGhostTeam(state, content);
  assert.equal(turnTwo.length, 5);
  assert.ok(turnTwo.every((pet) => pet.tier === 1));

  state.turn = 9;
  state.shopTier = 5;
  const later = generateGhostTeam(state, content);
  assert.equal(later.length, 5);
  assert.ok(later.every((pet) => pet.tier <= 5));
  assert.ok(later.every((pet) => pet.level >= 1 && pet.level <= 3));
  assert.ok(later.every((pet) => pet.perks.length <= 1));
  assert.ok(later.every((pet) => pet.attack <= 50 && pet.health <= 50));
});

test("run saves and ghost snapshots round-trip", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pt-sap-test-"));
  try {
    const state = createRun("persist", content);
    state.team = [pet("Ant", "saved-ant")];
    const savePath = path.join(directory, "run.json");
    const ghostPath = path.join(directory, "ghosts.json");
    await saveRun(state, savePath);
    const loaded = await loadRun(savePath);
    assert.deepEqual(loaded, state);

    await appendGhost(
      state,
      { turn: 1, wins: 0, lives: 5, team: state.team },
      ghostPath
    );
    const ghosts = await loadGhosts(ghostPath);
    assert.equal(ghosts.length, 1);
    assert.equal(ghosts[0].team[0].name, "Ant");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("serialized ghost writes do not lose concurrent snapshots", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pt-sap-ghost-lock-"));
  try {
    const state = createRun("ghost-lock", content);
    state.team = [pet("Ant", "locked-ant")];
    const ghostPath = path.join(directory, "ghosts.json");
    await Promise.all(
      Array.from({ length: 8 }, (_value, index) =>
        withGhostLock(ghostPath, () =>
          appendGhost(
            state,
            {
              turn: 1,
              wins: 0,
              lives: 5,
              runId: `run-${index}`,
              team: state.team
            },
            ghostPath
          )
        )
      )
    );
    assert.equal((await loadGhosts(ghostPath)).length, 8);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ghost snapshots deduplicate the same run and turn", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pt-sap-ghost-dedupe-"));
  try {
    const state = createRun("ghost-dedupe", content);
    const ghostPath = path.join(directory, "ghosts.json");
    await appendGhost(
      state,
      {
        turn: 1,
        wins: 0,
        lives: 5,
        runId: "same-run",
        team: [pet("Ant", "old-ant")]
      },
      ghostPath
    );
    await appendGhost(
      state,
      {
        turn: 1,
        wins: 0,
        lives: 5,
        runId: "same-run",
        team: [pet("Cricket", "new-cricket")]
      },
      ghostPath
    );

    const ghosts = await loadGhosts(ghostPath);
    assert.equal(ghosts.length, 1);
    assert.equal(ghosts[0].team[0].name, "Cricket");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy shop-save shape migrates to tiered capacities", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pt-sap-migrate-"));
  try {
    const state = createRun("legacy-save", content);
    const legacy = structuredClone(state) as unknown as Record<string, unknown>;
    legacy.version = 1;
    delete legacy.lastBattleReplay;
    const shop = legacy.shop as {
      pets: unknown[];
      foods: Array<Record<string, unknown> | null>;
    };
    shop.pets = shop.pets.slice(0, 3);
    const originalFood = shop.foods.find((offer) => Boolean(offer)) ?? null;
    shop.foods = [originalFood, originalFood ? structuredClone(originalFood) : null].map((offer) => {
      if (!offer) return null;
      const copy = { ...offer };
      delete copy.generated;
      return copy;
    });
    const savePath = path.join(directory, "legacy.json");
    await writeFile(savePath, JSON.stringify(legacy), "utf8");
    const loaded = await loadRun(savePath);
    assert.equal(loaded.version, 2);
    assert.equal(loaded.shop.pets.length, 3);
    assert.equal(loaded.shop.foods.length, 3);
    assert.equal(loaded.shop.foods[0]?.generated, false);
    assert.equal(loaded.shop.foods[1]?.generated, true);
    assert.equal(loaded.lastBattleReplay, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("start-of-turn abilities use attack priority", () => {
  const state = createRun("turn-priority", content);
  const worm = pet("Worm", "worm");
  const squirrel = pet("Squirrel", "squirrel");
  worm.attack = 10;
  state.team = [worm, squirrel];
  endTurn(state, content);
  const wormApple = state.shop.foods.find(
    (offer) =>
      offer?.templateId === "apple" &&
      offer.generated &&
      offer.cost === 1
  );
  assert.ok(wormApple);
  assert.equal(wormApple.cost, 1);
});

test("Mushroom revives instead of removing a Sleeping Pill target", () => {
  const state = createRun("pill-mushroom", content);
  const ant = pet("Ant", "mushroom-ant");
  ant.perks = [
    { id: "mushroom", sourceLevel: 1, uses: null }
  ];
  state.team = [ant];
  state.shop.foods = [foodOffer("sleeping-pill")];
  const result = buyFood(state, content, 0, ant.uid);
  assert.equal(result.ok, true);
  assert.equal(state.team.length, 1);
  assert.equal(state.team[0].attack, 1);
  assert.equal(state.team[0].health, 1);
  assert.equal(state.team[0].perks.length, 0);
});

test("after-attack abilities still execute on a simultaneously fainting attacker", () => {
  const result = resolveBattle(
    {
      playerTeam: [
        customPet("Elephant", "elephant", 5, 1),
        customPet("Pig", "behind", 1, 5)
      ],
      enemyTeam: [customPet("Pig", "enemy", 10, 1)],
      seed: "after-attack-dead"
    },
    content
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "damage" &&
        event.message.startsWith("Pig takes 1 ability damage")
    )
  );
});

test("Tiger can make Whale capture multiple friends in FIFO order", () => {
  const result = resolveBattle(
    {
      playerTeam: [
        pet("Ant", "whale-food-ant"),
        pet("Cricket", "whale-food-cricket"),
        pet("Whale", "whale"),
        pet("Tiger", "tiger")
      ],
      enemyTeam: [customPet("Pig", "whale-enemy", 1, 50)],
      seed: "whale-multi-capture"
    },
    content
  );
  const swallowedCounts = result.events.map(
    (event) =>
      event.state.units.filter((unit) => unit.status === "swallowed").length
  );
  assert.ok(Math.max(...swallowedCounts) >= 2);
  const swallowMessages = result.events
    .map((event) => event.message)
    .filter((message) => message.includes("swallows"));
  assert.equal(swallowMessages.length, 2);
});
