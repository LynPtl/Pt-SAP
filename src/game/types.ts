export type PetLevel = 1 | 2 | 3;
export type BattleSide = "player" | "enemy";
export type RunPhase = "shop" | "battle" | "gameOver";
export type BattleOutcome = "win" | "loss" | "draw";

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
  | "peanut";

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
  lastBattleOutcome: BattleOutcome | null;
  lastBattleReplay: BattleReplayData | null;
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
  swallowed: BattlePet | null;
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
}

export interface BattleReplayData {
  turn: number;
  seed: string;
  outcome: BattleOutcome;
  playerTeam: PetInstance[];
  enemyTeam: PetInstance[];
  events: BattleEvent[];
}

export interface BattleInput {
  playerTeam: PetInstance[];
  enemyTeam: PetInstance[];
  seed: string;
}

export interface ContentBundle {
  pets: Map<string, PetTemplate>;
  petsByTitle: Map<string, PetTemplate>;
  foods: Map<string, FoodTemplate>;
}
