import { readFileSync } from "node:fs";
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

const PET_FILE = new URL("../../reference/normalized/turtle-pack.json", import.meta.url);
const FOOD_FILE = new URL(
  "../../reference/normalized/turtle-pack-foods.json",
  import.meta.url
);

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

export function loadContent(): ContentBundle {
  const petData = JSON.parse(
    readFileSync(PET_FILE, "utf8")
  ) as NormalizedPetFile;
  const foodData = JSON.parse(
    readFileSync(FOOD_FILE, "utf8")
  ) as NormalizedFoodFile;

  const pets = new Map<string, PetTemplate>();
  const petsByTitle = new Map<string, PetTemplate>();
  for (const pet of petData.pets) {
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

  return { pets, petsByTitle, foods };
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
