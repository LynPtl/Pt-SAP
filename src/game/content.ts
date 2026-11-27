import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DEFAULT_PACK_ID,
  TURTLE_CONTENT_VERSION,
  packById,
  type StaticPackId
} from "./packs.js";
import type {
  ContentBundle,
  FoodTemplate,
  PetTemplate,
  PetLevel
} from "./types.js";

interface NormalizedPetFile {
  pets: Array<{
    id: string;
    title: string;
    tier: number | null;
    attack: number | null;
    health: number | null;
    abilities: Array<{
      level: number;
      text: string;
    }>;
  }>;
}

interface NormalizedFoodFile {
  foods: Array<{
    id: string;
    name: string;
    tier: number | null;
    packs: string[];
    text: string;
  }>;
}

function assertPetTier(value: number | null): value is PetTemplate["tier"] {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 6;
}

function assertFoodTier(value: number | null): value is FoodTemplate["tier"] {
  return (
    value === null || (Number.isInteger(value) && value >= 1 && value <= 6)
  );
}

function foodCost(id: string): number {
  return id === "sleeping-pill" ? 1 : 3;
}

export function loadContent(
  packId: StaticPackId = DEFAULT_PACK_ID
): ContentBundle {
  const pack = packById(packId);
  const petFile = new URL(
    `../../reference/normalized/${pack.slug}.json`,
    import.meta.url
  );
  const foodFile = new URL(
    `../../reference/normalized/${pack.slug}-foods.json`,
    import.meta.url
  );
  const petText = readFileSync(petFile, "utf8");
  const foodText = readFileSync(foodFile, "utf8");
  const petData = JSON.parse(petText) as NormalizedPetFile;
  const foodData = JSON.parse(foodText) as NormalizedFoodFile;
  const contentHash = createHash("sha256")
    .update(petText)
    .update(foodText)
    .digest("hex")
    .slice(0, 8);
  const contentVersion =
    packId === "turtle"
      ? TURTLE_CONTENT_VERSION
      : `${pack.slug}-${contentHash}`;

  const pets = new Map<string, PetTemplate>();
  const petsByTitle = new Map<string, PetTemplate>();
  const normalizedTitles = new Set<string>();
  for (const pet of petData.pets) {
    const normalizedTitle = pet.title.trim().toLocaleLowerCase("en");
    if (normalizedTitles.has(normalizedTitle)) {
      continue;
    }
    if (!assertPetTier(pet.tier)) {
      throw new Error(`Pet ${pet.title} has no valid tier`);
    }
    if (pet.attack === null || pet.health === null) {
      throw new Error(`Pet ${pet.title} has invalid base stats`);
    }
    const abilities = ([1, 2, 3] as PetLevel[]).map((level) => {
      const ability = pet.abilities.find((entry) => entry.level === level);
      if (!ability) throw new Error(`Pet ${pet.title} is missing level ${level}`);
      return ability.text;
    }) as [string, string, string];
    const template: PetTemplate = {
      id: pet.id,
      title: pet.title,
      tier: pet.tier,
      baseAttack: pet.attack,
      baseHealth: pet.health,
      abilities
    };
    if (pets.has(template.id)) {
      throw new Error(`Duplicate pet id ${template.id}`);
    }
    normalizedTitles.add(normalizedTitle);
    pets.set(template.id, template);
    petsByTitle.set(template.title, template);
  }

  const foods = new Map<string, FoodTemplate>();
  for (const food of foodData.foods) {
    if (!assertFoodTier(food.tier)) {
      throw new Error(`Food ${food.name} has an invalid tier`);
    }
    const template: FoodTemplate = {
      id: food.id,
      name: food.name,
      tier: food.tier,
      cost: foodCost(food.id),
      tokenOnly: food.tier === null,
      text: food.text
    };
    if (foods.has(template.id)) {
      throw new Error(`Duplicate food id ${template.id}`);
    }
    foods.set(template.id, template);
  }

  foods.set("chocolate-milk", {
    id: "chocolate-milk",
    name: "Chocolate Milk",
    tier: null,
    cost: 3,
    tokenOnly: true,
    text: "Give one pet attack only."
  });

  return {
    packId,
    packName: pack.name,
    contentVersion,
    pets,
    petsByTitle,
    foods
  };
}

export function petByTitle(
  content: ContentBundle,
  title: string
): PetTemplate {
  const pet = content.petsByTitle.get(title);
  if (!pet) throw new Error(`Unknown pet template: ${title}`);
  return pet;
}

export function foodById(content: ContentBundle, id: string): FoodTemplate {
  const food = content.foods.get(id);
  if (!food) throw new Error(`Unknown food template: ${id}`);
  return food;
}
