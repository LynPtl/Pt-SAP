import type { StaticPackId } from "./packs.js";

export type PetLevel = 1 | 2 | 3;
export type BattleSide = "player" | "enemy";
export type RunPhase = "shop" | "battle" | "gameOver";
export type BattleOutcome = "win" | "loss" | "draw";
export type OpponentKind = "snapshot" | "generated";
export type LevelUpCause = "merge" | "experience";
export type LevelUpSuppressedReason = "level-3-merge";

export type PerkId =
  | "honey"
  | "meatBone"
  | "chili"
  | "cake"
  | "garlic"
  | "melon"
  | "mushroom"
  | "steak"
  | "coconut"
  | "peanut"
  | "egg"
  | "walnut"
  | "lime"
  | "rice"
  | "squash"
  | "blackberry"
  | "croissant"
  | "pie"
  | "salt"
  | "lemon"
  | "pancakes"
  | "skewer"
  | "mildChili"
  | "eucalyptus";

export type AilmentId = "weak";

export type ToyId =
  | "balloon"
  | "stick"
  | "radio"
  | "tennisBall"
  | "plasticSaw"
  | "melonHelmet"
  | "foamSword"
  | "toyGun"
  | "ovenMitts"
  | "toiletPaper"
  | "cashRegister"
  | "flashlight"
  | "stinkySock"
  | "television"
  | "peanutJar"
  | "airPalmTree";

export interface ToyInstance {
  id: ToyId;
  sourceUid: string;
  level: PetLevel;
  remainingTurns: number;
}

export interface ToyChoice {
  kind: "toy";
  sourceUid: string;
  level: PetLevel;
  options: ToyId[];
}

export interface OpponentPetChoice {
  kind: "opponentPet";
  sourceUid: string;
  options: string[];
}

export interface PerkState {
  id: PerkId;
  sourceLevel: PetLevel;
  uses: number | null;
}

export interface PetTemplate {
  id: string;
  title: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  baseAttack: number;
  baseHealth: number;
  abilities: [string, string, string];
}

export interface FoodTemplate {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6 | null;
  cost: number;
  tokenOnly: boolean;
  text: string;
}

export interface PetInstance {
  uid: string;
  templateId: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  level: PetLevel;
  xp: number;
  attack: number;
  health: number;
  battleStats: {
    attack: number;
    health: number;
  };
  perks: PerkState[];
  ailment?: AilmentId | null;
  triggerCounters: Record<string, number>;
  copiedAbility: {
    templateId: string;
    level: PetLevel;
    expiresOnTurn: number;
  } | null;
}

export interface ShopPetItem {
  kind: "pet";
  itemId: string;
  templateId: string;
  cost: number;
  attackBonus: number;
  healthBonus: number;
  rewardGroup: string | null;
  frozen: boolean;
  reward: boolean;
}

export interface LevelUpRecord {
  petUid: string;
  petName: string;
  fromLevel: PetLevel;
  toLevel: PetLevel;
  xpGained: number;
  attackGained: number;
  healthGained: number;
  cause: LevelUpCause;
  levelUps: number;
  rewardGroup: string | null;
  rewardTier: 1 | 2 | 3 | 4 | 5 | 6 | null;
  rewardGroups: Array<{
    groupId: string;
    tier: 1 | 2 | 3 | 4 | 5 | 6;
  }>;
  rewardSuppressed: LevelUpSuppressedReason | null;
}

export interface ShopFoodItem {
  kind: "food";
  itemId: string;
  templateId: string;
  cost: number;
  generated: boolean;
  frozen: boolean;
  reward: boolean;
  milkLevel?: PetLevel;
}

export type ShopPetSlot = ShopPetItem | null;
export type ShopFoodSlot = ShopFoodItem | null;

export interface ShopState {
  pets: ShopPetSlot[];
  foods: ShopFoodSlot[];
  rewardPets: ShopPetItem[];
}

export interface RunState {
  version: 2;
  seed: string;
  packId: StaticPackId;
  contentVersion: string;
  shopRngState: number;
  turn: number;
  wins: number;
  lives: number;
  gold: number;
  shopTier: 1 | 2 | 3 | 4 | 5 | 6;
  phase: RunPhase;
  team: PetInstance[];
  shop: ShopState;
  shopPetBuff: {
    attack: number;
    health: number;
  };
  shopPetTurnBuff?: {
    attack: number;
    health: number;
  };
  activeToy?: ToyInstance | null;
  pendingChoices?: Array<ToyChoice | OpponentPetChoice>;
  rollsThisTurn?: number;
  goldSpentThisTurn?: number;
  nextTurnGold?: number;
  lastOpponentTeam?: PetInstance[];
  lastBattleOutcome: BattleOutcome | null;
  lastBattleReplay: BattleReplayData | null;
  levelUps: LevelUpRecord[];
  nextUid: number;
  log: string[];
}

export interface BattlePet {
  uid: string;
  sourceUid: string;
  templateId: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  level: PetLevel;
  attack: number;
  health: number;
  side: BattleSide;
  perks: PerkState[];
  ailment: AilmentId | null;
  copiedAbility: {
    templateId: string;
    level: PetLevel;
  } | null;
  extraAbilities: Array<{
    templateId: string;
    level: PetLevel;
  }>;
  triggeredThisBattle: Record<string, number>;
  canTriggerSummonAbilities: boolean;
  swallowed: BattlePet[];
  isToken: boolean;
  lastIndex: number;
}

export type BattleUnitStatus = "active" | "fainted" | "swallowed";

export interface BattleUnitSnapshot {
  uid: string;
  side: BattleSide;
  templateId: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  level: PetLevel;
  attack: number;
  health: number;
  position: number;
  status: BattleUnitStatus;
  perks: PerkId[];
  ailment: AilmentId | null;
  swallowedBy: string | null;
}

export interface BattleStateSnapshot {
  units: BattleUnitSnapshot[];
}

export interface BattleEvent {
  seq: number;
  type:
    | "battleStart"
    | "attack"
    | "damage"
    | "heal"
    | "buff"
    | "perk"
    | "summon"
    | "faint"
    | "trigger"
    | "battleEnd"
    | "warning";
  side: BattleSide | null;
  actorUid: string | null;
  targetUids: string[];
  message: string;
  values?: Record<string, number | string | boolean | null>;
  state: BattleStateSnapshot;
}

export interface BattleResult {
  outcome: BattleOutcome;
  events: BattleEvent[];
  playerSurvivors: number;
  enemySurvivors: number;
  playerNextTurnGold?: number;
}

export interface BattleReplayData {
  turn: number;
  seed: string;
  outcome: BattleOutcome;
  opponentKind: OpponentKind;
  opponentId?: string;
  playerTeam: PetInstance[];
  enemyTeam: PetInstance[];
  events: BattleEvent[];
}

export interface BattleInput {
  playerTeam: PetInstance[];
  enemyTeam: PetInstance[];
  seed: string;
  activeToy?: ToyInstance | null;
  rollsThisTurn?: number;
}

export interface ContentBundle {
  packId: StaticPackId;
  packName: string;
  contentVersion: string;
  pets: Map<string, PetTemplate>;
  petsByTitle: Map<string, PetTemplate>;
  foods: Map<string, FoodTemplate>;
}
