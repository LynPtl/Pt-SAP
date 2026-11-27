import {
  battleLogLineZh,
  foodNameZh,
  foodTextZh,
  petAbilityZh,
  petNameZh,
  perkNameZh
} from "../game/localization.js";
import { sellValueForPet } from "../game/run.js";
import type {
  ContentBundle,
  BattleEvent,
  BattleStateSnapshot,
  FoodTemplate,
  PetInstance,
  PetLevel,
  RunState,
  ShopFoodItem,
  ShopPetItem
} from "../game/types.js";

const SINGLE_TARGET_FOODS = new Set([
  "apple",
  "honey",
  "cupcake",
  "meat-bone",
  "sleeping-pill",
  "cake",
  "garlic",
  "pear",
  "chili",
  "chocolate",
  "melon",
  "mushroom",
  "steak",
  "bread-crumbs",
  "milk",
  "coconut",
  "peanut"
]);

const RANDOM_TARGET_FOODS = new Set([
  "salad-bowl",
  "sushi",
  "pizza"
]);

export type FoodTargetMode = "single" | "random" | "none";

export interface WebView {
  sessionId: string;
  state: {
    seed: string;
    turn: number;
    wins: number;
    lives: number;
    gold: number;
    shopTier: number;
    phase: RunState["phase"];
    team: PetView[];
    teamSize: number;
    maxTeamSize: number;
    shopPetBuff: {
      attack: number;
      health: number;
    };
    petSlotCount: number;
    foodSlotCount: number;
    ordinaryFoodSlotCount: number;
    pets: ShopPetView[];
    foods: ShopFoodView[];
    rewards: RewardGroupView[];
    levelUps: LevelUpView[];
    recentLog: string[];
    lastBattleOutcome: RunState["lastBattleOutcome"];
    lastBattleReplay: BattleReplayView | null;
  };
}

export interface BattleReplayPetView {
  uid: string;
  name: string;
  nameZh: string;
  tier: number;
  level: PetLevel;
  attack: number;
  health: number;
  ability: string;
  perks: string[];
}

export interface BattleReplayView {
  turn: number;
  seed: string;
  outcome: "win" | "loss" | "draw";
  playerTeam: BattleReplayPetView[];
  enemyTeam: BattleReplayPetView[];
  events: Array<{
    seq: number;
    type: BattleEvent["type"];
    side: BattleEvent["side"];
    actorUid: string | null;
    targetUids: string[];
    message: string;
    values?: BattleEvent["values"];
    summoned?: BattleReplayPetView;
    state: {
      units: Array<
        Omit<BattleStateSnapshot["units"][number], "perks"> & {
          nameZh: string;
          perks: string[];
        }
      >;
    };
  }>;
}

export interface PetView {
  index: number;
  uid: string;
  templateId: string;
  name: string;
  nameZh: string;
  tier: number;
  level: PetLevel;
  xp: number;
  nextLevelXp: number | null;
  levelXp: number;
  levelXpRequired: number | null;
  attack: number;
  health: number;
  battleAttackBonus: number;
  battleHealthBonus: number;
  ability: string;
  perks: string[];
  sellValue: number;
  copiedAbilityName: string | null;
}

export interface ShopPetView {
  slot: number;
  itemId: string;
  templateId: string;
  name: string;
  nameZh: string;
  tier: number;
  attack: number;
  health: number;
  cost: number;
  frozen: boolean;
  ability: string;
  duplicateUids: string[];
}

export interface ShopFoodView {
  slot: number;
  itemId: string;
  templateId: string;
  name: string;
  nameZh: string;
  text: string;
  tier: number | null;
  cost: number;
  frozen: boolean;
  generated: boolean;
  targetMode: FoodTargetMode;
}

export interface LevelUpView {
  petUid: string;
  petName: string;
  nameZh: string;
  fromLevel: PetLevel;
  toLevel: PetLevel;
  xpGained: number;
  attackGained: number;
  healthGained: number;
  cause: RunState["levelUps"][number]["cause"];
  rewardGroup: string | null;
  rewardTier: number | null;
  rewardSuppressed: RunState["levelUps"][number]["rewardSuppressed"];
}

export interface RewardGroupView {
  groupId: string;
  rewardTier: number;
  source: {
    petUid: string;
    nameZh: string;
    fromLevel: PetLevel;
    toLevel: PetLevel;
    cause: RunState["levelUps"][number]["cause"];
  } | null;
  offers: Array<{
    rewardIndex: number;
    templateId: string;
    name: string;
    nameZh: string;
    tier: number;
    attack: number;
    health: number;
    cost: number;
    ability: string;
    duplicateUids: string[];
  }>;
}

function xpThresholdForNextLevel(level: PetLevel): number | null {
  return level === 1 ? 2 : level === 2 ? 5 : null;
}

function petView(
  state: RunState,
  content: ContentBundle,
  pet: PetInstance,
  index: number
): PetView {
  const template = content.pets.get(pet.templateId);
  const copied =
    pet.copiedAbility?.templateId
      ? content.pets.get(pet.copiedAbility.templateId)
      : null;
  const ability = copied
    ? petAbilityZh(
        copied.title,
        pet.copiedAbility?.level ?? pet.level,
        copied.abilities[(pet.copiedAbility?.level ?? pet.level) - 1]
      )
    : petAbilityZh(
        pet.name,
        pet.level,
        template?.abilities[pet.level - 1] ?? ""
      );
  void state;
  return {
    index: index + 1,
    uid: pet.uid,
    templateId: pet.templateId,
    name: pet.name,
    nameZh: petNameZh(pet.name),
    tier: pet.tier,
    level: pet.level,
    xp: pet.xp,
    nextLevelXp: xpThresholdForNextLevel(pet.level),
    levelXp: pet.level === 1 ? pet.xp : pet.level === 2 ? pet.xp - 2 : 0,
    levelXpRequired: pet.level === 1 ? 2 : pet.level === 2 ? 3 : null,
    attack: pet.attack,
    health: pet.health,
    battleAttackBonus: pet.battleStats.attack,
    battleHealthBonus: pet.battleStats.health,
    ability,
    perks: pet.perks.map((perk) => perkNameZh(perk.id)),
    sellValue: sellValueForPet(pet),
    copiedAbilityName: copied ? petNameZh(copied.title) : null
  };
}

function battleReplayPetView(
  content: ContentBundle,
  pet: PetInstance
): BattleReplayPetView {
  const template = content.pets.get(pet.templateId);
  return {
    uid: pet.uid,
    name: pet.name,
    nameZh: petNameZh(pet.name),
    tier: pet.tier,
    level: pet.level,
    attack: pet.attack,
    health: pet.health,
    ability: petAbilityZh(
      pet.name,
      pet.level,
      template?.abilities[pet.level - 1] ?? ""
    ),
    perks: pet.perks.map((perk) => perkNameZh(perk.id))
  };
}

function battleReplayView(
  state: RunState,
  content: ContentBundle
): BattleReplayView | null {
  const replay = state.lastBattleReplay;
  if (!replay) return null;
  return {
    turn: replay.turn,
    seed: replay.seed,
    outcome: replay.outcome,
    playerTeam: replay.playerTeam.map((pet) =>
      battleReplayPetView(content, pet)
    ),
    enemyTeam: replay.enemyTeam.map((pet) =>
      battleReplayPetView(content, pet)
    ),
    events: replay.events.map((event) => {
      const summoned =
        event.type === "summon" && event.targetUids[0]
          ? summonReplayPetView(event, content)
          : undefined;
      return {
        seq: event.seq,
        type: event.type,
        side: event.side,
        actorUid: event.actorUid,
        targetUids: event.targetUids,
        message: battleLogLineZh(event.message),
        ...(event.values ? { values: event.values } : {}),
        ...(summoned ? { summoned } : {}),
        state: {
          units: (event.state?.units ?? []).map((unit) => ({
            ...unit,
            nameZh: petNameZh(unit.name),
            perks: unit.perks.map(perkNameZh)
          }))
        }
      };
    })
  };
}

function summonReplayPetView(
  event: BattleEvent,
  content: ContentBundle
): BattleReplayPetView | undefined {
  const uid = event.targetUids[0];
  const values = event.values;
  if (!uid || !values) return undefined;
  const name = typeof values.name === "string" ? values.name : "召唤物";
  const templateId =
    typeof values.templateId === "string" ? values.templateId : "";
  const tier =
    typeof values.tier === "number" ? values.tier : 1;
  const level =
    typeof values.level === "number" ? values.level : 1;
  const template = content.pets.get(templateId);
  return {
    uid,
    name,
    nameZh: petNameZh(name),
    tier,
    level: level as PetLevel,
    attack: typeof values.attack === "number" ? values.attack : 1,
    health: typeof values.health === "number" ? values.health : 1,
    ability: template
      ? petAbilityZh(
          template.title,
          level as PetLevel,
          template.abilities[(level as PetLevel) - 1]
        )
      : "",
    perks: []
  };
}

function shopPetView(
  state: RunState,
  content: ContentBundle,
  offer: ShopPetItem,
  slot: number
): ShopPetView {
  const template = content.pets.get(offer.templateId);
  if (!template) throw new Error(`Unknown shop pet ${offer.templateId}`);
  return {
    slot,
    itemId: offer.itemId,
    templateId: template.id,
    name: template.title,
    nameZh: petNameZh(template.title),
    tier: template.tier,
    attack:
      template.baseAttack + state.shopPetBuff.attack + offer.attackBonus,
    health:
      template.baseHealth + state.shopPetBuff.health + offer.healthBonus,
    cost: offer.cost,
    frozen: offer.frozen,
    ability: petAbilityZh(
      template.title,
      1,
      template.abilities[0]
    ),
    duplicateUids: state.team
      .filter((pet) => pet.templateId === template.id)
      .map((pet) => pet.uid)
  };
}

function foodDisplayName(
  food: FoodTemplate,
  offer: ShopFoodItem
): string {
  const base = foodNameZh(food.id, food.name);
  return offer.milkLevel && offer.milkLevel > 1
    ? `${base} ${offer.milkLevel} 级`
    : base;
}

function foodView(
  content: ContentBundle,
  offer: ShopFoodItem,
  slot: number
): ShopFoodView {
  const food = content.foods.get(offer.templateId);
  if (!food) throw new Error(`Unknown shop food ${offer.templateId}`);
  const targetMode: FoodTargetMode = SINGLE_TARGET_FOODS.has(food.id)
    ? "single"
    : RANDOM_TARGET_FOODS.has(food.id)
      ? "random"
      : "none";
  const level = offer.milkLevel ?? 1;
  const localizedText =
    food.id === "chocolate-milk"
      ? `使一只宠物获得 ${level} 级巧克力奶效果：+${level} 攻击。`
      : food.id === "milk"
      ? `使一只宠物获得 ${level} 级牛奶效果：+${level} 攻击和 +${level * 2} 生命。`
      : food.id === "apple" && level > 1
        ? `使一只宠物获得 +${level} 攻击和 +${level} 生命。`
        : foodTextZh(food.id, food.text);
  return {
    slot,
    itemId: offer.itemId,
    templateId: food.id,
    name: food.name,
    nameZh: foodDisplayName(food, offer),
    text: localizedText,
    tier: food.tier,
    cost: offer.cost,
    frozen: offer.frozen,
    generated: offer.generated,
    targetMode
  };
}

function levelUpsView(state: RunState): LevelUpView[] {
  return (state.levelUps ?? []).map((record) => ({
    petUid: record.petUid,
    petName: record.petName,
    nameZh: petNameZh(record.petName),
    fromLevel: record.fromLevel,
    toLevel: record.toLevel,
    xpGained: record.xpGained,
    attackGained: record.attackGained,
    healthGained: record.healthGained,
    cause: record.cause,
    rewardGroup: record.rewardGroup,
    rewardTier: record.rewardTier,
    rewardSuppressed: record.rewardSuppressed
  }));
}

function rewardGroupsView(
  state: RunState,
  content: ContentBundle
): RewardGroupView[] {
  const groups = new Map<string, RewardGroupView>();
  const levelUps = state.levelUps ?? [];
  state.shop.rewardPets.forEach((offer, rewardIndex) => {
    const template = content.pets.get(offer.templateId);
    if (!template) return;
    const groupId = offer.rewardGroup ?? `single-${rewardIndex}`;
    const sourceRecord = offer.rewardGroup
      ? levelUps.find((record) => record.rewardGroup === offer.rewardGroup)
      : null;
    const group = groups.get(groupId) ?? {
      groupId,
      rewardTier: template.tier,
      source: sourceRecord
        ? {
            petUid: sourceRecord.petUid,
            nameZh: petNameZh(sourceRecord.petName),
            fromLevel: sourceRecord.fromLevel,
            toLevel: sourceRecord.toLevel,
            cause: sourceRecord.cause
          }
        : null,
      offers: []
    };
    group.offers.push({
      rewardIndex,
      templateId: template.id,
      name: template.title,
      nameZh: petNameZh(template.title),
      tier: template.tier,
      attack:
        template.baseAttack + state.shopPetBuff.attack + offer.attackBonus,
      health:
        template.baseHealth + state.shopPetBuff.health + offer.healthBonus,
      cost: offer.cost,
      ability: petAbilityZh(template.title, 1, template.abilities[0]),
      duplicateUids: state.team
        .filter((pet) => pet.templateId === template.id)
        .map((pet) => pet.uid)
    });
    groups.set(groupId, group);
  });
  return [...groups.values()];
}

export function buildWebView(
  state: RunState,
  content: ContentBundle,
  sessionId: string
): WebView {
  return {
    sessionId,
    state: {
      seed: state.seed,
      turn: state.turn,
      wins: state.wins,
      lives: state.lives,
      gold: state.gold,
      shopTier: state.shopTier,
      phase: state.phase,
      team: state.team.map((pet, index) =>
        petView(state, content, pet, index)
      ),
      teamSize: state.team.length,
      maxTeamSize: 5,
      shopPetBuff: { ...state.shopPetBuff },
      petSlotCount: state.shop.pets.length,
      foodSlotCount: state.shop.foods.length,
      ordinaryFoodSlotCount:
        state.shop.foods.length - 2,
      pets: state.shop.pets.flatMap((offer, slot) =>
        offer ? [shopPetView(state, content, offer, slot)] : []
      ),
      foods: state.shop.foods.flatMap((offer, slot) =>
        offer ? [foodView(content, offer, slot)] : []
      ),
      rewards: rewardGroupsView(state, content),
      levelUps: levelUpsView(state),
      recentLog: state.log.slice(-120).map(battleLogLineZh),
      lastBattleOutcome: state.lastBattleOutcome,
      lastBattleReplay: battleReplayView(state, content)
    }
  };
}
