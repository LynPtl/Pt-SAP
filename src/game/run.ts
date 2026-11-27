import { resolveBattle } from "./battle.js";
import { deriveSeed, SeededRandom } from "./rng.js";
import type {
  BattleOutcome,
  ContentBundle,
  FoodTemplate,
  LevelUpCause,
  LevelUpRecord,
  OpponentKind,
  PerkId,
  PerkState,
  PetInstance,
  PetLevel,
  RunState,
  ShopFoodItem,
  ShopFoodSlot,
  ShopPetItem,
  ShopPetSlot
} from "./types.js";

const TEAM_SIZE = 5;
const STARTING_LIVES = 5;
const STARTING_GOLD = 10;
const MAX_STAT = 50;
const GENERATED_FOOD_SLOT_CAPACITY = 2;

export function petShopCapacity(
  shopTier: 1 | 2 | 3 | 4 | 5 | 6
): number {
  return shopTier >= 5 ? 5 : shopTier >= 3 ? 4 : 3;
}

export function ordinaryFoodShopCapacity(
  shopTier: 1 | 2 | 3 | 4 | 5 | 6
): number {
  return shopTier >= 3 ? 2 : 1;
}

export function totalFoodShopCapacity(
  shopTier: 1 | 2 | 3 | 4 | 5 | 6
): number {
  return ordinaryFoodShopCapacity(shopTier) + GENERATED_FOOD_SLOT_CAPACITY;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface EndTurnResult extends ActionResult {
  playerSnapshot?: PetInstance[];
}

function success(message: string): ActionResult {
  return { ok: true, message };
}

function failure(message: string): ActionResult {
  return { ok: false, message };
}

function capStat(value: number): number {
  return Math.min(MAX_STAT, value);
}

function xpToLevel(xp: number): PetLevel {
  return xp >= 5 ? 3 : xp >= 2 ? 2 : 1;
}

function shopTierForTurn(turn: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (turn >= 11) return 6;
  return Math.min(6, Math.ceil(turn / 2)) as 1 | 2 | 3 | 4 | 5 | 6;
}

function nextId(state: RunState, prefix: string): string {
  state.nextUid++;
  return `${prefix}-${state.nextUid}`;
}

function addLog(state: RunState, message: string): void {
  state.log.push(message);
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
}

function orderShopTriggers<T>(
  state: RunState,
  values: T[],
  owner: (value: T) => PetInstance,
  purpose: string
): T[] {
  const sorted = [...values].sort(
    (a, b) => owner(b).attack - owner(a).attack
  );
  const rng = new SeededRandom(
    deriveSeed(state.seed, "shop-trigger-order", state.turn, purpose)
  );
  const result: T[] = [];
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    const attack = owner(sorted[start]).attack;
    while (end < sorted.length && owner(sorted[end]).attack === attack) {
      end++;
    }
    const tied = sorted.slice(start, end);
    for (let index = tied.length - 1; index > 0; index--) {
      const swap = rng.integer(0, index);
      [tied[index], tied[swap]] = [tied[swap], tied[index]];
    }
    result.push(...tied);
    start = end;
  }
  return result;
}

function petById(state: RunState, uid: string): PetInstance | null {
  return state.team.find((pet) => pet.uid === uid) ?? null;
}

function createPetInstance(
  state: RunState,
  content: ContentBundle,
  templateId: string,
  level: PetLevel = 1,
  xp = 0,
  attackBonus = 0,
  healthBonus = 0
): PetInstance {
  const template = content.pets.get(templateId);
  if (!template) throw new Error(`Unknown pet template: ${templateId}`);
  return {
    uid: nextId(state, "pet"),
    templateId,
    name: template.title,
    tier: template.tier,
    level,
    xp,
    attack: capStat(
      template.baseAttack + state.shopPetBuff.attack + attackBonus
    ),
    health: capStat(
      template.baseHealth + state.shopPetBuff.health + healthBonus
    ),
    battleStats: { attack: 0, health: 0 },
    perks: [],
    triggerCounters: {},
    copiedAbility: null
  };
}

function randomPetPool(
  content: ContentBundle,
  shopTier: number
): PetInstance["templateId"][] {
  return [...content.pets.values()]
    .filter((template) => template.tier <= shopTier)
    .map((template) => template.id);
}

function randomFoodPool(
  content: ContentBundle,
  shopTier: number
): FoodTemplate[] {
  return [...content.foods.values()].filter(
    (food) =>
      !food.tokenOnly &&
      food.tier !== null &&
      food.tier <= shopTier
  );
}

function makeShopPet(
  state: RunState,
  content: ContentBundle,
  templateId: string,
  cost = 3,
  reward = false,
  frozen = false,
  rewardGroup: string | null = null
): ShopPetItem {
  const template = content.pets.get(templateId);
  if (!template) throw new Error(`Unknown shop pet: ${templateId}`);
  return {
    kind: "pet",
    itemId: nextId(state, "offer"),
    templateId,
    cost,
    attackBonus: 0,
    healthBonus: 0,
    rewardGroup,
    frozen,
    reward
  };
}

function makeShopFood(
  state: RunState,
  content: ContentBundle,
  templateId: string,
  options: {
    cost?: number;
    reward?: boolean;
    frozen?: boolean;
    generated?: boolean;
    milkLevel?: PetLevel;
  } = {}
): ShopFoodItem {
  const template = content.foods.get(templateId);
  if (!template) throw new Error(`Unknown shop food: ${templateId}`);
  return {
    kind: "food",
    itemId: nextId(state, "offer"),
    templateId,
    cost: options.cost ?? template.cost,
    generated: options.generated ?? false,
    frozen: options.frozen ?? false,
    reward: options.reward ?? false,
    ...(options.milkLevel ? { milkLevel: options.milkLevel } : {})
  };
}

export function refreshShop(
  state: RunState,
  content: ContentBundle,
  chargeGold: boolean
): ActionResult {
  if (chargeGold && state.gold < 1) {
    return failure("刷新需要 1 金。");
  }
  const rng = new SeededRandom(state.shopRngState);
  const petPool = randomPetPool(content, state.shopTier);
  const foodPool = randomFoodPool(content, state.shopTier);
  const petCapacity = petShopCapacity(state.shopTier);
  const ordinaryFoodCapacity = ordinaryFoodShopCapacity(state.shopTier);
  const frozenPets = state.shop.pets.filter(
    (slot): slot is ShopPetItem => Boolean(slot?.frozen)
  );
  const nextPets: ShopPetSlot[] = [...frozenPets];
  while (nextPets.length < petCapacity) {
    const templateId = rng.pick(petPool);
    if (!templateId) break;
    nextPets.push(makeShopPet(state, content, templateId));
  }

  const frozenOrdinaryFoods = state.shop.foods.filter(
    (slot): slot is ShopFoodItem =>
      Boolean(slot?.frozen) && !slot?.generated
  );
  const nextOrdinaryFoods: ShopFoodSlot[] = [...frozenOrdinaryFoods];
  while (nextOrdinaryFoods.length < ordinaryFoodCapacity) {
    const template = rng.pick(foodPool);
    if (!template) break;
    nextOrdinaryFoods.push(makeShopFood(state, content, template.id));
  }
  const frozenGeneratedFoods = state.shop.foods.filter(
    (slot): slot is ShopFoodItem =>
      Boolean(slot?.frozen) && Boolean(slot?.generated)
  );
  const nextGeneratedFoods: ShopFoodSlot[] = [...frozenGeneratedFoods];
  while (nextGeneratedFoods.length < GENERATED_FOOD_SLOT_CAPACITY) {
    nextGeneratedFoods.push(null);
  }

  state.shop.pets = nextPets.slice(0, petCapacity);
  state.shop.foods = [
    ...nextOrdinaryFoods.slice(0, ordinaryFoodCapacity),
    ...nextGeneratedFoods.slice(0, GENERATED_FOOD_SLOT_CAPACITY)
  ];
  state.shopRngState = rng.state;
  if (chargeGold) state.gold--;
  addLog(state, chargeGold ? "刷新商店，消耗 1 金。" : "商店已刷新。");
  return success(chargeGold ? "已刷新，消耗 1 金。" : "商店已刷新。");
}

interface RewardGroupInfo {
  groupId: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
}

function addRewardPets(
  state: RunState,
  content: ContentBundle
): RewardGroupInfo | null {
  const nextTier = Math.min(6, state.shopTier + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  const pool = [...content.pets.values()].filter(
    (template) => template.tier === nextTier
  );
  if (pool.length === 0) return null;
  const rng = new SeededRandom(
    deriveSeed(state.seed, "level-reward", state.turn, state.nextUid)
  );
  const picked = rng.sample(pool, 2);
  const rewardGroup = nextId(state, "reward");
  for (const template of picked) {
    state.shop.rewardPets.push(
      makeShopPet(state, content, template.id, 3, true, false, rewardGroup)
    );
  }
  return { groupId: rewardGroup, tier: nextTier };
}

function completeLevelUp(
  state: RunState,
  content: ContentBundle,
  pet: PetInstance,
  fromLevel: PetLevel,
  xpBefore: number,
  attackBefore: number,
  healthBefore: number,
  cause: LevelUpCause,
  allowReward: boolean,
  suppressedReason: LevelUpRecord["rewardSuppressed"] = null
): void {
  const levelUps = pet.level - fromLevel;
  const rewardGroups: RewardGroupInfo[] = [];
  for (let level = fromLevel + 1; level <= pet.level; level++) {
    if (allowReward) {
      const reward = addRewardPets(state, content);
      if (reward) rewardGroups.push(reward);
    }
    triggerLevelUpAbilities(
      state,
      content,
      pet,
      level as PetLevel
    );
  }
  const firstReward = rewardGroups[0] ?? null;
  const record: LevelUpRecord = {
    petUid: pet.uid,
    petName: pet.name,
    fromLevel,
    toLevel: pet.level,
    xpGained: pet.xp - xpBefore,
    attackGained: pet.attack - attackBefore,
    healthGained: pet.health - healthBefore,
    cause,
    levelUps,
    rewardGroup: firstReward?.groupId ?? null,
    rewardTier: firstReward?.tier ?? null,
    rewardGroups,
    rewardSuppressed: suppressedReason
  };
  state.levelUps.push(record);

  if (rewardGroups.length > 0) {
    const tiers = [...new Set(rewardGroups.map((reward) => reward.tier))].join(
      "/"
    );
    addLog(
      state,
      `${pet.name} gains ${levelUps} level-up${levelUps === 1 ? "" : "s"}; ` +
        `receives ${rewardGroups.length} tier ${tiers} level-up reward choice${rewardGroups.length === 1 ? "" : "s"}.`
    );
  } else if (suppressedReason === "level-3-merge") {
    addLog(
      state,
      `${pet.name} reaches level 3 by merging two level-2 pets; no level-up reward is offered.`
    );
  } else {
    addLog(state, `${pet.name} levels up to ${pet.level}.`);
  }
}

function gainExperience(
  state: RunState,
  content: ContentBundle,
  pet: PetInstance,
  amount: number,
  grantLevelReward: boolean
): boolean {
  if (amount <= 0) return false;
  const previousLevel = pet.level;
  const xpBefore = pet.xp;
  const attackBefore = pet.attack;
  const healthBefore = pet.health;
  pet.xp += amount;
  pet.attack = capStat(pet.attack + amount);
  pet.health = capStat(pet.health + amount);
  pet.level = xpToLevel(pet.xp);
  if (pet.level > previousLevel) {
    completeLevelUp(
      state,
      content,
      pet,
      previousLevel,
      xpBefore,
      attackBefore,
      healthBefore,
      "experience",
      grantLevelReward
    );
    return true;
  }
  return false;
}

function triggerLevelUpAbilities(
  state: RunState,
  _content: ContentBundle,
  leveledPet: PetInstance,
  triggerLevel: PetLevel = leveledPet.level
): void {
  if (leveledPet.name === "Fish" && triggerLevel < 3) {
    const rng = new SeededRandom(
      deriveSeed(state.seed, "fish-level", state.turn, leveledPet.uid)
    );
    const targets = rng.sample(
      state.team.filter((pet) => pet.uid !== leveledPet.uid),
      2
    );
    for (const target of targets) {
      const amount = triggerLevel;
      addPermanentStats(target, amount, amount);
    }
    state.shopRngState = rng.state;
    addLog(state, `${leveledPet.name} 的升级技能强化了 ${targets.length} 名友军。`);
  }
}

function addPermanentStats(
  pet: PetInstance,
  attack: number,
  health: number
): void {
  pet.attack = capStat(pet.attack + attack);
  pet.health = capStat(pet.health + health);
}

function addBattleStats(
  pet: PetInstance,
  attack: number,
  health: number
): void {
  pet.battleStats.attack = capStat(pet.battleStats.attack + attack);
  pet.battleStats.health = capStat(pet.battleStats.health + health);
}

function addPerk(pet: PetInstance, id: PerkId, level: PetLevel): void {
  pet.perks = [
    {
      id,
      sourceLevel: level,
      uses: id === "coconut" ? 1 : null
    } satisfies PerkState
  ];
}

function replaceShopFoodWithTwoMilk(
  state: RunState,
  content: ContentBundle,
  level: PetLevel,
  templateId: "milk" | "chocolate-milk"
): void {
  const capacity = totalFoodShopCapacity(state.shopTier);
  const firstGeneratedSlot = capacity - GENERATED_FOOD_SLOT_CAPACITY;
  state.shop.foods = Array.from(
    { length: capacity },
    (_value, index) => {
      if (index < firstGeneratedSlot) return null;
      return makeShopFood(state, content, templateId, {
        cost: 0,
        milkLevel: level,
        generated: true
      });
    }
  );
}

function triggerBuyAbilities(
  state: RunState,
  content: ContentBundle,
  boughtPet: PetInstance
): void {
  if (boughtPet.name === "Otter") {
    const rng = new SeededRandom(
      deriveSeed(state.seed, "otter", state.turn, boughtPet.uid)
    );
    const targets = rng.sample(
      state.team.filter((pet) => pet.uid !== boughtPet.uid),
      boughtPet.level
    );
    for (const target of targets) addPermanentStats(target, 0, 1);
    state.shopRngState = rng.state;
    addLog(state, `Otter 购买技能强化了 ${targets.length} 名友军。`);
  }

  if (boughtPet.name === "Cow") {
    replaceShopFoodWithTwoMilk(state, content, boughtPet.level, "milk");
    addLog(state, `Cow 用 ${boughtPet.level} 级牛奶替换了商店食物。`);
  }

  if (boughtPet.tier === 1) {
    for (const dragon of state.team.filter((pet) => pet.name === "Dragon")) {
      const key = "dragonBuys";
      const count = (dragon.triggerCounters[key] ?? 0) + 1;
      if (count <= 4) {
        dragon.triggerCounters[key] = count;
        for (const friend of state.team) {
          addPermanentStats(friend, dragon.level, dragon.level);
        }
        addLog(state, "Dragon 触发一级宠物购买奖励。");
      }
    }
  }
}

function duplicates(
  state: RunState,
  templateId: string
): PetInstance[] {
  return state.team.filter((pet) => pet.templateId === templateId);
}

function chooseMergeTarget(
  state: RunState,
  pet: ShopPetItem,
  targetUid?: string
): PetInstance | null {
  const candidates = duplicates(state, pet.templateId);
  if (targetUid) {
    return candidates.find((candidate) => candidate.uid === targetUid) ?? null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function consumeOffer(
  state: RunState,
  kind: "pet" | "food",
  slot: number | null,
  rewardIndex?: number
): ShopPetItem | ShopFoodItem | null {
  if (kind === "pet") {
    if (rewardIndex !== undefined) {
      return state.shop.rewardPets.splice(rewardIndex, 1)[0] ?? null;
    }
    const item = state.shop.pets[slot ?? -1] ?? null;
    if (item) state.shop.pets[slot ?? -1] = null;
    return item;
  }
  const item = state.shop.foods[slot ?? -1] ?? null;
  if (item) state.shop.foods[slot ?? -1] = null;
  return item;
}

export function buyPet(
  state: RunState,
  content: ContentBundle,
  slot: number | null,
  targetUid?: string,
  rewardIndex?: number
): ActionResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  const offer =
    rewardIndex !== undefined
      ? state.shop.rewardPets[rewardIndex]
      : slot !== null
        ? state.shop.pets[slot]
        : null;
  if (!offer) return failure("该宠物商品不存在。");
  if (state.gold < offer.cost) return failure("金币不足。");

  const mergeTarget = chooseMergeTarget(state, offer, targetUid);
  const candidates = duplicates(state, offer.templateId);
  if (targetUid && !mergeTarget) {
    return failure("指定的宠物不是该商品的同名合并目标。");
  }
  if (!mergeTarget && candidates.length > 1 && !targetUid) {
    return failure("有多只同名宠物，请指定合并目标。");
  }
  if (!mergeTarget && state.team.length >= TEAM_SIZE) {
    return failure("队伍已满。");
  }

  state.gold -= offer.cost;
  const rewardGroup = offer.rewardGroup;
  consumeOffer(
    state,
    "pet",
    slot,
    rewardIndex
  );
  if (rewardGroup) {
    state.shop.rewardPets = state.shop.rewardPets.filter(
      (reward) => reward.rewardGroup !== rewardGroup
    );
  }

  if (mergeTarget) {
    const incoming = createPetInstance(
      state,
      content,
      offer.templateId,
      1,
      0,
      offer.attackBonus,
      offer.healthBonus
    );
    const oldLevel = mergeTarget.level;
    const xpBefore = mergeTarget.xp;
    const attackBefore = mergeTarget.attack;
    const healthBefore = mergeTarget.health;
    mergeTarget.attack = capStat(
      Math.max(mergeTarget.attack, incoming.attack) +
        1 +
        Math.max(mergeTarget.xp, incoming.xp)
    );
    mergeTarget.health = capStat(
      Math.max(mergeTarget.health, incoming.health) +
        1 +
        Math.max(mergeTarget.xp, incoming.xp)
    );
    mergeTarget.xp += incoming.xp + 1;
    mergeTarget.level = xpToLevel(mergeTarget.xp);
    mergeTarget.battleStats.attack = Math.max(
      mergeTarget.battleStats.attack,
      incoming.battleStats.attack
    );
    mergeTarget.battleStats.health = Math.max(
      mergeTarget.battleStats.health,
      incoming.battleStats.health
    );
    if (mergeTarget.level > oldLevel) {
      const isMaxLevelMerge = oldLevel === 2 && mergeTarget.level === 3;
      completeLevelUp(
        state,
        content,
        mergeTarget,
        oldLevel,
        xpBefore,
        attackBefore,
        healthBefore,
        "merge",
        !isMaxLevelMerge,
        isMaxLevelMerge ? "level-3-merge" : null
      );
    }
    triggerBuyAbilities(state, content, mergeTarget);
    addLog(
      state,
      `${mergeTarget.name} 合并后达到 ${mergeTarget.level} 级。`
    );
    return success(`${mergeTarget.name} 已合并，等级 ${mergeTarget.level}。`);
  }

  const pet = createPetInstance(
    state,
    content,
    offer.templateId,
    1,
    0,
    offer.attackBonus,
    offer.healthBonus
  );
  state.team.push(pet);
  triggerBuyAbilities(state, content, pet);
  addLog(state, `购买 ${pet.name}。`);
  return success(`已购买 ${pet.name}。`);
}

export function sellPet(
  state: RunState,
  content: ContentBundle,
  uid: string
): ActionResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  const pet = petById(state, uid);
  if (!pet) return failure("找不到该宠物。");
  const index = state.team.findIndex((entry) => entry.uid === uid);
  state.team.splice(index, 1);

  const gold = sellValueForPet(pet);
  state.gold += gold;

  if (pet.name === "Beaver") {
    const rng = new SeededRandom(
      deriveSeed(state.seed, "beaver-sell", state.turn, pet.uid)
    );
    const targets = rng.sample(state.team, 2);
    for (const target of targets) addPermanentStats(target, pet.level, 0);
    state.shopRngState = rng.state;
    addLog(state, `${pet.name} 的出售效果强化了 ${targets.length} 名友军。`);
  } else if (pet.name === "Duck") {
    for (const offer of [...state.shop.pets, ...state.shop.rewardPets]) {
      if (offer) {
        offer.healthBonus += pet.level;
      }
    }
    addLog(state, `${pet.name} 的出售效果强化了商店宠物。`);
  }
  addLog(state, `出售 ${pet.name}，获得 ${gold} 金。`);
  return success(`已出售 ${pet.name}，获得 ${gold} 金。`);
}

export function sellValueForPet(pet: PetInstance): number {
  const cakeBonus = pet.triggerCounters.cakeSellBonus ?? 0;
  return pet.level + cakeBonus + (pet.name === "Pig" ? pet.level : 0);
}

export function movePet(
  state: RunState,
  uid: string,
  targetIndex: number
): ActionResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  const from = state.team.findIndex((pet) => pet.uid === uid);
  if (from < 0) return failure("找不到该宠物。");
  if (targetIndex < 1 || targetIndex > state.team.length) {
    return failure("目标位置无效。");
  }
  const [pet] = state.team.splice(from, 1);
  state.team.splice(Math.min(targetIndex - 1, state.team.length), 0, pet);
  addLog(state, `${pet.name} 移动到第 ${targetIndex} 格。`);
  return success(`${pet.name} 已移动。`);
}

export function mergeTeamPets(
  state: RunState,
  content: ContentBundle,
  sourceUid: string,
  targetUid: string
): ActionResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  if (sourceUid === targetUid) return failure("不能与自身合并。");
  const sourceIndex = state.team.findIndex((pet) => pet.uid === sourceUid);
  const target = petById(state, targetUid);
  const source = sourceIndex >= 0 ? state.team[sourceIndex] : null;
  if (!source || !target) return failure("找不到合并来源或目标。");
  if (source.templateId !== target.templateId) {
    return failure("只有同名宠物可以合并。");
  }

  const oldLevel = target.level;
  const xpBefore = target.xp;
  const attackBefore = target.attack;
  const healthBefore = target.health;
  target.attack = capStat(
    Math.max(target.attack, source.attack) +
      1 +
      Math.max(target.xp, source.xp)
  );
  target.health = capStat(
    Math.max(target.health, source.health) +
      1 +
      Math.max(target.xp, source.xp)
  );
  target.battleStats.attack = Math.max(
    target.battleStats.attack,
    source.battleStats.attack
  );
  target.battleStats.health = Math.max(
    target.battleStats.health,
    source.battleStats.health
  );
  if (target.perks.length === 0 && source.perks.length > 0) {
    target.perks = structuredClone(source.perks);
  }
  target.xp += source.xp + 1;
  target.level = xpToLevel(target.xp);
  state.team.splice(sourceIndex, 1);

  if (target.level > oldLevel) {
    const isMaxLevelMerge = oldLevel === 2 && target.level === 3;
    completeLevelUp(
      state,
      content,
      target,
      oldLevel,
      xpBefore,
      attackBefore,
      healthBefore,
      "merge",
      !isMaxLevelMerge,
      isMaxLevelMerge ? "level-3-merge" : null
    );
  }
  addLog(state, `${target.name} 在队伍内合并，等级 ${target.level}。`);
  return success(`${target.name} 已合并，等级 ${target.level}。`);
}

export function freezeShopItem(
  state: RunState,
  kind: "pet" | "food",
  slot: number
): ActionResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  const item = kind === "pet" ? state.shop.pets[slot] : state.shop.foods[slot];
  if (!item) return failure("该商品不存在。");
  item.frozen = !item.frozen;
  return success(item.frozen ? "已冻结。" : "已解除冻结。");
}

function catMultiplier(state: RunState): number {
  const cat = state.team.find(
    (pet) =>
      pet.name === "Cat" && (pet.triggerCounters.catUses ?? 0) < 2
  );
  if (!cat) return 1;
  cat.triggerCounters.catUses = (cat.triggerCounters.catUses ?? 0) + 1;
  return cat.level + 1;
}

function foodTargets(
  state: RunState,
  food: FoodTemplate,
  targetUid?: string
): { pets: PetInstance[]; error?: string } {
  const byUid = targetUid ? petById(state, targetUid) : null;
  switch (food.id) {
    case "salad-bowl": {
      const rng = new SeededRandom(
        deriveSeed(state.seed, "food", state.turn, food.id, targetUid ?? "")
      );
      const pets = rng.sample(state.team, 2);
      state.shopRngState = rng.state;
      return { pets };
    }
    case "sushi": {
      const rng = new SeededRandom(
        deriveSeed(state.seed, "food", state.turn, food.id, targetUid ?? "")
      );
      const pets = rng.sample(state.team, 3);
      state.shopRngState = rng.state;
      return { pets };
    }
    case "pizza": {
      const rng = new SeededRandom(
        deriveSeed(state.seed, "food", state.turn, food.id, targetUid ?? "")
      );
      const pets = rng.sample(state.team, 2);
      state.shopRngState = rng.state;
      return { pets };
    }
    case "canned-food":
      return { pets: [] };
    default:
      return byUid ? { pets: [byUid] } : { pets: [], error: "请指定食物目标。" };
  }
}

function triggerFoodEaten(
  state: RunState,
  target: PetInstance
): void {
  const ordered = orderShopTriggers(
    state,
    [...state.team],
    (pet) => pet,
    "food-eaten"
  );
  for (const rabbit of ordered.filter((pet) => pet.name === "Rabbit")) {
    const uses = rabbit.triggerCounters.rabbitUses ?? 0;
    if (uses < 3) {
      rabbit.triggerCounters.rabbitUses = uses + 1;
      addPermanentStats(target, 0, rabbit.level);
    }
  }
  for (const seal of ordered.filter(
    (pet) => pet.name === "Seal" && pet.uid === target.uid
  )) {
    const rng = new SeededRandom(
      deriveSeed(state.seed, "seal-food", state.turn, seal.uid, target.uid)
    );
    const friends = rng.sample(
      state.team.filter((pet) => pet.uid !== seal.uid),
      3
    );
    for (const friend of friends) addPermanentStats(friend, seal.level, 0);
    state.shopRngState = rng.state;
  }
}

function stockCowChocolateMilk(
  state: RunState,
  content: ContentBundle,
  cow: PetInstance
): void {
  const milkLevel = xpToLevel(cow.xp + 1);
  replaceShopFoodWithTwoMilk(
    state,
    content,
    milkLevel,
    "chocolate-milk"
  );
  addLog(state, "Cow 因食用 Chocolate 生成了两瓶 Chocolate Milk。");
}

function applyFoodEffect(
  state: RunState,
  content: ContentBundle,
  food: ShopFoodItem,
  target: PetInstance | null
): void {
  const multiplier = catMultiplier(state);
  if (food.templateId === "canned-food") {
    state.shopPetBuff.attack = capStat(
      state.shopPetBuff.attack + multiplier
    );
    state.shopPetBuff.health = capStat(
      state.shopPetBuff.health + multiplier
    );
    return;
  }
  if (!target) throw new Error(`Food ${food.templateId} requires a target`);
  switch (food.templateId) {
    case "apple": {
      const level = food.milkLevel ?? 1;
      addPermanentStats(target, level * multiplier, level * multiplier);
      break;
    }
    case "pear":
      addPermanentStats(target, 2 * multiplier, 2 * multiplier);
      break;
    case "bread-crumbs":
      addPermanentStats(target, multiplier, 0);
      break;
    case "milk": {
      const level = food.milkLevel ?? 1;
      addPermanentStats(target, level * multiplier, 2 * level * multiplier);
      break;
    }
    case "chocolate-milk": {
      const level = food.milkLevel ?? 1;
      addPermanentStats(target, level * multiplier, 0);
      break;
    }
    case "cupcake":
      addBattleStats(target, 3 * multiplier, 3 * multiplier);
      break;
    case "salad-bowl":
      addPermanentStats(target, multiplier, multiplier);
      break;
    case "sushi":
      addPermanentStats(target, multiplier, multiplier);
      break;
    case "pizza":
      addPermanentStats(target, 2 * multiplier, 2 * multiplier);
      break;
    case "chocolate":
      gainExperience(state, content, target, 1, true);
      break;
    case "honey":
      addPerk(target, "honey", 1);
      break;
    case "meat-bone":
      addPerk(target, "meatBone", 1);
      break;
    case "chili":
      addPerk(target, "chili", 1);
      break;
    case "cake":
      addPerk(target, "cake", 1);
      break;
    case "garlic":
      addPerk(target, "garlic", 1);
      break;
    case "melon":
      addPerk(target, "melon", 1);
      break;
    case "mushroom":
      addPerk(target, "mushroom", 1);
      break;
    case "steak":
      addPerk(target, "steak", 1);
      break;
    case "coconut":
      addPerk(target, "coconut", 1);
      break;
    case "peanut":
      addPerk(target, "peanut", 1);
      break;
    case "sleeping-pill":
      break;
    default:
      throw new Error(`No food handler for ${food.templateId}`);
  }
}

function triggerShopFaint(
  state: RunState,
  content: ContentBundle,
  fainted: PetInstance,
  index: number
): void {
  const pending: Array<{ pet: PetInstance; index: number }> = [];
  const processed = new Set<string>();

  const addToken = (
    name: string,
    attack: number,
    health: number,
    tier: PetInstance["tier"],
    level: PetLevel,
    insertIndex: number,
    templateId = `token-${name.toLowerCase().replace(/\W+/g, "-")}`
  ): PetInstance | null => {
    if (state.team.length >= TEAM_SIZE) {
      addLog(state, `${name} 因队伍已满而无法召唤。`);
      return null;
    }
    const token: PetInstance = {
      uid: nextId(state, "pet"),
      templateId,
      name,
      tier,
      level,
      xp: level === 3 ? 5 : level === 2 ? 2 : 0,
      attack: capStat(attack),
      health: capStat(health),
      battleStats: { attack: 0, health: 0 },
      perks: [],
      triggerCounters: {},
      copiedAbility: null
    };
    state.team.splice(
      Math.max(0, Math.min(insertIndex, state.team.length)),
      0,
      token
    );
    addLog(state, `${name} 在商店阶段被召唤。`);
    if (name === "Scorpion") addPerk(token, "peanut", token.level);
    const friends = [...state.team].sort(
      (a, b) =>
        b.attack - a.attack ||
        state.team.indexOf(a) - state.team.indexOf(b)
    );
    for (const friend of friends) {
      if (friend.uid === token.uid) continue;
      if (friend.name === "Horse") {
        addBattleStats(token, friend.level, 0);
      }
      if (friend.name === "Dog") {
        addBattleStats(friend, friend.level * 2, friend.level);
      }
      if (friend.name === "Hippogriff") {
        addBattleStats(token, friend.level, 0);
      }
      if (friend.name === "Turkey") {
        addPermanentStats(token, friend.level * 3, friend.level);
      }
    }
    return token;
  };

  const dealDamage = (target: PetInstance, amount: number): void => {
    if (
      amount <= 0 ||
      processed.has(target.uid) ||
      !state.team.some((pet) => pet.uid === target.uid)
    ) {
      return;
    }
    target.health = Math.max(0, target.health - amount);
    addLog(
      state,
      `${target.name} 受到 ${amount} 点商店阶段伤害，剩余 ${target.health} 生命。`
    );
    if (target.health > 0) return;
    const targetIndex = state.team.findIndex((pet) => pet.uid === target.uid);
    if (targetIndex < 0) return;
    state.team.splice(targetIndex, 1);
    pending.push({ pet: target, index: targetIndex });
  };

  const processFaint = (event: { pet: PetInstance; index: number }): void => {
    if (processed.has(event.pet.uid)) return;
    processed.add(event.pet.uid);
    const currentIndex = Math.max(
      0,
      Math.min(event.index, state.team.length)
    );
    const current = event.pet;

    if (current.perks.some((perk) => perk.id === "honey")) {
      addToken("Bee", 1, 1, current.tier, current.level, currentIndex);
    }

    switch (current.name) {
      case "Ant": {
        const rng = new SeededRandom(
          deriveSeed(state.seed, "shop-faint", state.turn, current.uid)
        );
        const target = rng.pick(state.team);
        if (target) addPermanentStats(target, current.level, current.level);
        state.shopRngState = rng.state;
        break;
      }
      case "Flamingo":
        for (const target of state.team.slice(currentIndex, currentIndex + 2)) {
          addPermanentStats(target, current.level, current.level);
        }
        break;
      case "Hedgehog":
        for (const target of [...state.team]) {
          dealDamage(target, 2 * current.level);
        }
        break;
      case "Badger": {
        const adjacent = [state.team[currentIndex - 1], state.team[currentIndex]]
          .filter((target): target is PetInstance => Boolean(target));
        for (const target of adjacent) {
          dealDamage(target, Math.floor(current.attack * 0.5));
        }
        break;
      }
      case "Rat":
        addLog(state, "Dirty Rat 的对手侧召唤在商店阶段没有目标。");
        break;
      case "Cricket":
        addToken(
          "Zombie Cricket",
          current.level,
          current.level,
          1,
          current.level,
          currentIndex
        );
        break;
      case "Spider": {
        const rng = new SeededRandom(
          deriveSeed(state.seed, "shop-spider", state.turn, current.uid)
        );
        const chosen = rng.pick(
          [...content.pets.values()].filter((template) => template.tier === 3)
        );
        if (chosen) {
          addToken(
            chosen.title,
            2 * current.level,
            2 * current.level,
            chosen.tier,
            current.level,
            currentIndex,
            chosen.id
          );
        }
        break;
      }
      case "Sheep":
        for (let count = 0; count < 2; count++) {
          addToken(
            "Ram",
            2 * current.level,
            2 * current.level,
            3,
            current.level,
            currentIndex + count
          );
        }
        break;
      case "Deer": {
        const bus = addToken(
          "Bus",
          5 * current.level,
          3 * current.level,
          4,
          current.level,
          currentIndex
        );
        if (bus) addPerk(bus, "chili", current.level);
        break;
      }
      case "Hippogriff": {
        const nextTier = Math.min(6, current.tier + 1) as PetInstance["tier"];
        const rng = new SeededRandom(
          deriveSeed(state.seed, "shop-hippogriff", state.turn, current.uid)
        );
        const chosen = rng.pick(
          [...content.pets.values()].filter(
            (template) => template.tier === nextTier
          )
        );
        if (chosen) {
          addToken(
            chosen.title,
            5 * current.level,
            5 * current.level,
            chosen.tier,
            current.level,
            currentIndex,
            chosen.id
          );
        }
        break;
      }
      case "Rooster":
        for (let count = 0; count < current.level; count++) {
          addToken(
            "Chick",
            Math.floor(current.attack * 0.5),
            1,
            5,
            current.level,
            currentIndex + count
          );
        }
        break;
      case "Mammoth":
        for (const friend of state.team) {
          addPermanentStats(friend, 2 * current.level, 2 * current.level);
        }
        break;
      case "Turtle":
        for (const target of state.team.slice(
          currentIndex + 1,
          currentIndex + 1 + current.level
        )) {
          addPerk(target, "melon", current.level);
        }
        break;
      default:
        break;
    }

    for (const friend of [...state.team]) {
      const friendIndex = state.team.findIndex(
        (pet) => pet.uid === friend.uid
      );
      if (
        friend.name === "Ox" &&
        friendIndex === currentIndex &&
        (friend.triggerCounters.oxUses ?? 0) < 1
      ) {
        friend.triggerCounters.oxUses = 1;
        addPermanentStats(friend, 1, 0);
        addPerk(friend, "melon", friend.level);
      }
      if (friend.name === "Shark") {
        addPermanentStats(friend, 2 * friend.level, 2 * friend.level);
      }
      if (
        friend.name === "Fly" &&
        (friend.triggerCounters.flyUses ?? 0) < 3
      ) {
        friend.triggerCounters.flyUses =
          (friend.triggerCounters.flyUses ?? 0) + 1;
        addToken(
          "Zombie Fly",
          4,
          4,
          6,
          friend.level,
          currentIndex
        );
      }
    }
  };

  pending.push({ pet: fainted, index });
  while (pending.length > 0) {
    const next = pending.shift();
    if (next) processFaint(next);
  }
}

export function buyFood(
  state: RunState,
  content: ContentBundle,
  slot: number,
  targetUid?: string
): ActionResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  const offer = state.shop.foods[slot];
  if (!offer) return failure("该食物商品不存在。");
  if (state.gold < offer.cost) return failure("金币不足。");
  const food = content.foods.get(offer.templateId);
  if (!food) return failure("未知食物。");
  const targets = foodTargets(state, food, targetUid);
  if (targets.error) return failure(targets.error);
  if (food.id !== "canned-food" && targets.pets.length === 0) {
    return failure("当前没有合法目标。");
  }

  state.gold -= offer.cost;
  consumeOffer(state, "food", slot);

  if (food.id === "canned-food") {
    applyFoodEffect(state, content, offer, null);
    addLog(state, "Canned Food 强化了当前和未来的商店宠物。");
    return success("Canned Food 已生效。");
  }

  for (const target of targets.pets) {
    if (food.id === "sleeping-pill") {
      if (target.perks.some((perk) => perk.id === "mushroom")) {
        target.perks = target.perks.filter((perk) => perk.id !== "mushroom");
        target.attack = 1;
        target.health = 1;
        addLog(state, `Mushroom 令 ${target.name} 以 1/1 复活。`);
        continue;
      }
      const index = state.team.findIndex((pet) => pet.uid === target.uid);
      state.team.splice(index, 1);
      triggerShopFaint(state, content, target, index);
      addLog(state, `Sleeping Pill 令 ${target.name} 退场。`);
    } else {
      if (food.id === "chocolate" && target.name === "Cow") {
        stockCowChocolateMilk(state, content, target);
      }
      applyFoodEffect(state, content, offer, target);
      triggerFoodEaten(state, target);
    }
  }
  addLog(state, `${food.name} 已使用。`);
  return success(`${food.name} 已生效。`);
}

function runEndTurnAbilities(state: RunState): void {
  let bisonTriggered = false;
  const ordered = orderShopTriggers(
    state,
    [...state.team],
    (pet) => pet,
    "end-turn"
  );
  for (const pet of ordered) {
    const index = state.team.findIndex((entry) => entry.uid === pet.uid);
    if (pet.name === "Snail" && state.lastBattleOutcome === "loss") {
      const targets = state.team
        .slice(0, index)
        .reverse()
        .slice(0, 3);
      for (const target of targets) addPermanentStats(target, pet.level, 0);
      if (targets.length > 0) {
        addLog(state, `${pet.name} 强化了前方 ${targets.length} 名友军。`);
      }
    }
    if (pet.name === "Bison" && !bisonTriggered) {
      const hasLevelThreeFriend = state.team.some(
        (friend) => friend.uid !== pet.uid && friend.level === 3
      );
      if (hasLevelThreeFriend) {
        addPermanentStats(pet, 2 * pet.level, 2 * pet.level);
        bisonTriggered = true;
        addLog(
          state,
          `${pet.name} 因满级友军获得 +${2 * pet.level}/+${2 * pet.level}。`
        );
      }
    }
    if (pet.name === "Monkey" && state.team[0]) {
      addPermanentStats(
        state.team[0],
        2 * pet.level,
        2 * pet.level
      );
      addLog(state, `${pet.name} 强化了最前方友军。`);
    }
    if (pet.name === "Parrot" && index > 0) {
      const ahead = state.team[index - 1];
      pet.copiedAbility = {
        templateId: ahead.copiedAbility?.templateId ?? ahead.templateId,
        level: pet.level,
        expiresOnTurn: state.turn + 1
      };
      addLog(state, `${pet.name} 复制了前方友军的技能。`);
    }
    if (pet.perks.some((perk) => perk.id === "cake")) {
      pet.triggerCounters.cakeSellBonus =
        (pet.triggerCounters.cakeSellBonus ?? 0) + 1;
    }
  }
}

function runStartTurnAbilities(
  state: RunState,
  content: ContentBundle
): void {
  const ordered = orderShopTriggers(
    state,
    [...state.team],
    (pet) => pet,
    "start-turn"
  );
  for (const pet of ordered) {
    const index = state.team.findIndex((entry) => entry.uid === pet.uid);
    switch (pet.name) {
      case "Swan":
        state.gold += pet.level;
        addLog(state, `${pet.name} 在回合开始获得 ${pet.level} 金。`);
        break;
      case "Worm": {
        const apple = stockWormFood(state, content, pet);
        if (apple) {
          addLog(state, `${pet.name} 在商店右侧上架了 2 金苹果。`);
        }
        break;
      }
      case "Giraffe": {
        const targets = state.team
          .slice(Math.max(0, index - pet.level), index)
          .reverse();
        for (const target of targets.slice(0, pet.level)) {
          addPermanentStats(target, 1, 1);
        }
        if (targets.length > 0) {
          addLog(
            state,
            `${pet.name} 强化了前方 ${Math.min(targets.length, pet.level)} 名友军。`
          );
        }
        break;
      }
      case "Penguin": {
        const rng = new SeededRandom(
          deriveSeed(state.seed, "penguin", state.turn, pet.uid)
        );
        const targets = rng.sample(
          state.team.filter(
            (friend) => friend.uid !== pet.uid && friend.level >= 2
          ),
          2
        );
        for (const target of targets) {
          addPermanentStats(target, pet.level, pet.level);
        }
        state.shopRngState = rng.state;
        if (targets.length > 0) {
          addLog(state, `${pet.name} 强化了 ${targets.length} 名友军。`);
        }
        break;
      }
      case "Squirrel":
        for (const food of state.shop.foods) {
          if (food) food.cost = Math.max(0, food.cost - pet.level);
        }
        addLog(state, `${pet.name} 将所有商店食物降价 ${pet.level} 金。`);
        break;
      default:
        break;
    }
  }
}

export function stockWormFood(
  state: RunState,
  content: ContentBundle,
  worm: PetInstance
): ShopFoodItem | null {
  const capacity = state.shop.foods.length;
  const generatedStart = Math.max(
    0,
    capacity - GENERATED_FOOD_SLOT_CAPACITY
  );
  let slot = -1;
  for (let index = capacity - 1; index >= generatedStart; index--) {
    if (!state.shop.foods[index]) {
      slot = index;
      break;
    }
  }
  if (slot < 0) {
    for (let index = capacity - 1; index >= generatedStart; index--) {
      const offer = state.shop.foods[index];
      if (offer && !offer.frozen) {
        slot = index;
        break;
      }
    }
  }
  if (slot < 0) {
    for (let index = generatedStart - 1; index >= 0; index--) {
      const offer = state.shop.foods[index];
      if (offer && !offer.frozen) {
        slot = index;
        break;
      }
    }
  }
  if (slot < 0) return null;
  const apple = makeShopFood(state, content, "apple", {
    cost: 2,
    milkLevel: worm.level,
    generated: true
  });
  state.shop.foods[slot] = apple;
  return apple;
}

function startNextTurn(state: RunState, content: ContentBundle): void {
  state.turn++;
  state.phase = "shop";
  state.gold = STARTING_GOLD;
  state.shopTier = shopTierForTurn(state.turn);
  state.shop.rewardPets = [];
  state.levelUps = [];
  if (state.turn === 3 && state.lives < STARTING_LIVES) {
    state.lives = Math.min(STARTING_LIVES, state.lives + 1);
    addLog(state, "第 3 回合补偿：恢复 1 点生命。");
  }
  for (const pet of state.team) {
    if (pet.copiedAbility && pet.copiedAbility.expiresOnTurn <= state.turn) {
      pet.copiedAbility = null;
    }
    pet.triggerCounters = Object.fromEntries(
      Object.entries(pet.triggerCounters).filter(
        ([key]) => key === "cakeSellBonus"
      )
    );
    pet.battleStats = { attack: 0, health: 0 };
  }
  refreshShop(state, content, false);
  runStartTurnAbilities(state, content);
  addLog(state, `第 ${state.turn} 回合开始，商店 ${state.shopTier} 档。`);
}

const GHOST_PERK_FOODS: Array<[string, PerkId]> = [
  ["honey", "honey"],
  ["meat-bone", "meatBone"],
  ["garlic", "garlic"],
  ["chili", "chili"],
  ["melon", "melon"],
  ["mushroom", "mushroom"],
  ["steak", "steak"]
];

export function ghostActionPointsForTurn(turn: number): number {
  if (turn <= 1) return 0;
  if (turn === 2) return 1;
  if (turn === 3) return 2;
  return turn * 2 - 4;
}

export function ghostStatAmountForTurn(turn: number): number {
  return Math.floor(turn / 4) + 2;
}

export function generateGhostTeam(
  state: RunState,
  content: ContentBundle
): PetInstance[] {
  const rng = new SeededRandom(
    deriveSeed(state.seed, "opponent", state.turn, state.wins)
  );
  const count = state.turn === 1 ? 3 : 5;
  const pool = [...content.pets.values()].filter(
    (template) =>
      state.turn === 1
        ? template.tier === 1
        : template.tier <= state.shopTier
  );
  const team: PetInstance[] = [];
  for (let index = 0; index < count; index++) {
    const template = rng.pick(pool);
    if (!template) continue;
    team.push({
      uid: `enemy-${state.turn}-${index + 1}`,
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
    });
  }

  const actions = ghostActionPointsForTurn(state.turn);
  const statAmount = ghostStatAmountForTurn(state.turn);
  const availablePerks = GHOST_PERK_FOODS.filter(([foodId]) => {
    const food = content.foods.get(foodId);
    return Boolean(
      food &&
        food.tier !== null &&
        food.tier <= state.shopTier
    );
  });
  for (let action = 0; action < actions; action++) {
    const actionTypes: Array<"perk" | "xp" | "stats"> = [
      "perk",
      "xp",
      "stats"
    ];
    let type = rng.pick(actionTypes) ?? "stats";
    const perkTargets = team.filter((pet) => pet.perks.length === 0);
    if (
      type === "perk" &&
      (availablePerks.length === 0 || perkTargets.length === 0)
    ) {
      type = rng.chance(0.5) ? "xp" : "stats";
    }
    if (type === "perk") {
      const target = rng.pick(perkTargets);
      const perk = rng.pick(availablePerks);
      if (target && perk) {
        target.perks = [
          { id: perk[1], sourceLevel: 1, uses: perk[1] === "coconut" ? 1 : null }
        ];
      }
      continue;
    }
    const pet = rng.pick(team);
    if (!pet) continue;
    if (type === "xp") {
      pet.xp++;
      pet.attack = capStat(pet.attack + 1);
      pet.health = capStat(pet.health + 1);
      pet.level = xpToLevel(pet.xp);
    } else if (rng.chance(0.5)) {
      pet.attack = capStat(pet.attack + statAmount);
    } else {
      pet.health = capStat(pet.health + statAmount);
    }
  }
  return team;
}

export function endTurn(
  state: RunState,
  content: ContentBundle,
  opponentTeam?: PetInstance[],
  opponent?: {
    kind: OpponentKind;
    id?: string;
  }
): EndTurnResult {
  if (state.phase !== "shop") return failure("当前不在商店阶段。");
  state.phase = "battle";
  runEndTurnAbilities(state);
  const playerSnapshot = structuredClone(state.team);
  const enemy = opponentTeam
    ? structuredClone(opponentTeam)
    : generateGhostTeam(state, content);
  const battleSeed = deriveSeed(state.seed, "turn", state.turn);
  const result = resolveBattle(
    {
      playerTeam: state.team,
      enemyTeam: enemy,
      seed: battleSeed
    },
    content
  );
  state.lastBattleReplay = {
    turn: state.turn,
    seed: battleSeed,
    outcome: result.outcome,
    opponentKind:
      opponent?.kind ??
      (opponentTeam === undefined ? "generated" : "snapshot"),
    ...(opponent?.id ? { opponentId: opponent.id } : {}),
    playerTeam: structuredClone(playerSnapshot).map((pet) => ({
      ...pet,
      uid: `player:${pet.uid}`
    })),
    enemyTeam: structuredClone(enemy).map((pet) => ({
      ...pet,
      uid: `enemy:${pet.uid}`
    })),
    events: structuredClone(result.events)
  };
  addLog(
    state,
    state.lastBattleReplay.opponentKind === "snapshot"
      ? `对手来源：玩家幽灵 ${state.lastBattleReplay.opponentId ?? ""}`.trim()
      : "对手来源：系统生成 Ghost。"
  );
  for (const event of result.events) {
    addLog(state, `[战斗] ${event.message}`);
  }
  state.lastBattleOutcome = result.outcome;

  if (result.outcome === "win") {
    state.wins++;
    addLog(state, "本场胜利，获得 1 胜。");
  } else if (result.outcome === "loss") {
    state.lives--;
    addLog(state, "本场失败，失去 1 点生命。");
  } else {
    addLog(state, "本场平局，不改变胜场或生命。");
  }

  for (const pet of state.team) {
    pet.battleStats = { attack: 0, health: 0 };
  }

  if (state.wins >= 10) {
    state.phase = "gameOver";
    addLog(state, "达到 10 胜，游戏结束。");
    return { ...success("达到 10 胜，胜利！"), playerSnapshot };
  }
  if (state.lives <= 0) {
    state.phase = "gameOver";
    addLog(state, "生命耗尽，游戏结束。");
    return { ...success("生命耗尽，游戏结束。"), playerSnapshot };
  }
  startNextTurn(state, content);
  return {
    ...success(
      `战斗结果：${outcomeText(result.outcome)}。进入第 ${state.turn} 回合。`
    ),
    playerSnapshot
  };
}

function outcomeText(outcome: BattleOutcome): string {
  return outcome === "win"
    ? "胜利"
    : outcome === "loss"
      ? "失败"
      : "平局";
}

export function createRun(seed: string, content: ContentBundle): RunState {
  const shopRngState = new SeededRandom(deriveSeed(seed, "shop")).state;
  const state: RunState = {
    version: 2,
    seed,
    shopRngState,
    turn: 1,
    wins: 0,
    lives: STARTING_LIVES,
    gold: STARTING_GOLD,
    shopTier: 1,
    phase: "shop",
    team: [],
    shop: {
      pets: Array.from({ length: petShopCapacity(1) }, () => null),
      foods: Array.from({ length: totalFoodShopCapacity(1) }, () => null),
      rewardPets: []
    },
    shopPetBuff: { attack: 0, health: 0 },
    lastBattleOutcome: null,
    lastBattleReplay: null,
    levelUps: [],
    nextUid: 0,
    log: []
  };
  refreshShop(state, content, false);
  runStartTurnAbilities(state, content);
  addLog(state, `新游戏开始，种子 ${seed}。`);
  return state;
}

export function describePet(
  pet: PetInstance,
  content: ContentBundle
): string {
  const template = content.pets.get(pet.templateId);
  const ability =
    pet.copiedAbility
      ? content.pets.get(pet.copiedAbility.templateId)?.abilities[
          pet.copiedAbility.level - 1
        ]
      : template?.abilities[pet.level - 1];
  const battleStats =
    pet.battleStats.attack || pet.battleStats.health
      ? ` [本场 +${pet.battleStats.attack}/+${pet.battleStats.health}]`
      : "";
  const perks = pet.perks.length
    ? ` (${pet.perks.map((perk) => foodName(content, perk.id)).join(", ")})`
    : "";
  return `${pet.name} L${pet.level} XP${pet.xp} ${pet.attack}/${pet.health}${battleStats}${perks}${
    ability ? ` — ${ability}` : ""
  }`;
}

function foodName(content: ContentBundle, id: string): string {
  const normalized = id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return (
    content.foods.get(normalized)?.name ??
    content.foods.get(id.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())
      ?.name ??
    id
  );
}

export function describeShop(
  state: RunState,
  content: ContentBundle
): string[] {
  const petOffers = state.shop.pets.map((offer, index) => {
    if (!offer) return `${index + 1}. [空]`;
    const template = content.pets.get(offer.templateId);
    const bonuses =
      offer.attackBonus || offer.healthBonus
        ? ` [+${offer.attackBonus}/+${offer.healthBonus}]`
        : "";
    return `${index + 1}. ${template?.title ?? offer.templateId}${bonuses} ${offer.cost}金${offer.frozen ? " [冻结]" : ""}`;
  });
  const foodOffers = state.shop.foods.map((offer, index) => {
    if (!offer) return `${index + 1}. [空]`;
    const template = content.foods.get(offer.templateId);
    const levelLabel =
      offer.milkLevel && offer.milkLevel > 1 ? ` L${offer.milkLevel}` : "";
    return `${index + 1}. ${template?.name ?? offer.templateId}${levelLabel} ${offer.cost}金${offer.frozen ? " [冻结]" : ""}`;
  });
  const rewards = state.shop.rewardPets.map(
    (offer, index) =>
      `R${index + 1}. ${content.pets.get(offer.templateId)?.title ?? offer.templateId} ${offer.cost}金`
  );
  return [
    `宠物：${petOffers.join(" | ")}`,
    `食物：${foodOffers.join(" | ")}`,
    ...(rewards.length ? [`升级奖励：${rewards.join(" | ")}`] : [])
  ];
}
