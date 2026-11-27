export interface RawPage {
  title: string;
  pageid: number;
  content: string;
  fetchedAt: string;
}

export interface RawCache {
  generatedAt: string;
  source: string;
  pages: RawPage[];
}

export interface PetRecord {
  id: string;
  title: string;
  tier: number | null;
  attack: number | null;
  health: number | null;
  rawLevels: string[];
  levels: string[];
  parseErrors: string[];
}

export interface FoodRecord {
  id: string;
  name: string;
  tier: number | null;
  packs: string[];
  rawAbility: string;
  ability: string;
  note: string;
}

export type Trigger =
  | "startOfBattle"
  | "beforeAttack"
  | "afterAttack"
  | "hurt"
  | "faint"
  | "summon"
  | "sell"
  | "startOfTurn"
  | "endOfTurn"
  | "buy"
  | "eat"
  | "levelUp"
  | "knockOut"
  | "passive"
  | "unknown";

export type EffectKind =
  | "modifyStats"
  | "dealDamage"
  | "summon"
  | "heal"
  | "shield"
  | "perk"
  | "stealStats"
  | "transform"
  | "destroy"
  | "revive"
  | "copy"
  | "shop"
  | "swallow"
  | "mana"
  | "experience"
  | "gold"
  | "food";

export type TargetKind =
  | "self"
  | "randomFriend"
  | "friend"
  | "allFriends"
  | "friendAhead"
  | "friendBehind"
  | "frontFriend"
  | "backFriend"
  | "randomEnemy"
  | "nearestEnemy"
  | "allEnemies"
  | "allPets"
  | "strongestEnemy"
  | "weakestEnemy"
  | "lowestHealthEnemy"
  | "highestHealthEnemy"
  | "firstEnemy"
  | "lastEnemy"
  | "nearestFriendAhead"
  | "nearestFriendsAhead"
  | "nearestFriendsBehind"
  | "nearestPetAhead"
  | "adjacentPets"
  | "triggeringPet"
  | "randomPet"
  | "anyPet";

export type CoverageStatus = "full" | "partial" | "custom" | "none";

export interface AbilityAnalysis {
  text: string;
  trigger: Trigger;
  effects: EffectKind[];
  targets: TargetKind[];
  status: CoverageStatus;
  complex: boolean;
  reasons: string[];
}

export interface NormalizedPet {
  id: string;
  title: string;
  tier: number | null;
  attack: number | null;
  health: number | null;
  parseErrors: string[];
  abilities: Array<{
    level: number;
    text: string;
    dsl: AbilityAnalysis;
  }>;
}

export interface NormalizedFood {
  id: string;
  name: string;
  tier: number | null;
  packs: string[];
  text: string;
  dsl: AbilityAnalysis;
}
