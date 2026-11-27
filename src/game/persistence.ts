import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ordinaryFoodShopCapacity,
  petShopCapacity,
  totalFoodShopCapacity
} from "./run.js";
import type { RunState } from "./types.js";

type StoredRunState = Omit<RunState, "version"> & {
  version: 1 | 2;
};

export async function saveRun(
  state: RunState,
  filePath: string
): Promise<void> {
  const resolved = path.resolve(filePath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function loadRun(filePath: string): Promise<RunState> {
  const resolved = path.resolve(filePath);
  const parsed = JSON.parse(await readFile(resolved, "utf8")) as unknown;
  if (!legacyRunState(parsed)) {
    throw new Error(`Invalid pt-sap save: ${resolved}`);
  }
  return migrateRunState(parsed);
}

function legacyRunState(
  value: unknown
): value is StoredRunState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<StoredRunState>;
  return (
    (state.version === 1 || state.version === 2) &&
    typeof state.seed === "string" &&
    typeof state.turn === "number" &&
    typeof state.wins === "number" &&
    typeof state.lives === "number" &&
    typeof state.gold === "number" &&
    (state.phase === "shop" ||
      state.phase === "battle" ||
      state.phase === "gameOver") &&
    Array.isArray(state.team) &&
    Boolean(state.shop) &&
    Boolean(state.shopPetBuff) &&
    typeof state.shopRngState === "number"
  );
}

function migrateRunState(
  state: StoredRunState
): RunState {
  const petCapacity = petShopCapacity(state.shopTier);
  const ordinaryFoodCapacity = ordinaryFoodShopCapacity(state.shopTier);
  const foodCapacity = totalFoodShopCapacity(state.shopTier);

  const pets = [...state.shop.pets];
  while (pets.length < petCapacity) pets.push(null);
  state.shop.pets = pets.slice(0, petCapacity);

  const foods = [...state.shop.foods];
  foods.forEach((offer, index) => {
    if (!offer) return;
    offer.generated =
      offer.generated ?? index >= ordinaryFoodCapacity;
  });
  while (foods.length < foodCapacity) foods.push(null);
  state.shop.foods = foods.slice(0, foodCapacity);

  state.shop.rewardPets ??= [];
  state.shop.rewardPets.forEach((offer) => {
    offer.rewardGroup ??= null;
  });
  state.levelUps ??= [];
  state.lastBattleReplay ??= null;
  if (
    state.lastBattleReplay?.events.some(
      (event) => !("state" in (event as object))
    )
  ) {
    state.lastBattleReplay = null;
  }
  if (state.lastBattleReplay) {
    state.lastBattleReplay.opponentKind ??= "generated";
  }
  state.version = 2;
  return state as RunState;
}
