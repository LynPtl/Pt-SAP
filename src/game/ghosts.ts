import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveSeed, SeededRandom } from "./rng.js";
import type { PetInstance, RunState } from "./types.js";

export interface GhostSnapshot {
  id: string;
  runSeed: string;
  turn: number;
  wins: number;
  lives: number;
  team: PetInstance[];
}

interface GhostFile {
  version: 1;
  snapshots: Array<Omit<GhostSnapshot, "lives"> & { lives?: number }>;
}

const GHOST_LIMIT = 1000;

export async function loadGhosts(
  filePath = "saves/ghosts.json"
): Promise<GhostSnapshot[]> {
  try {
    const parsed = JSON.parse(
      await readFile(path.resolve(filePath), "utf8")
    ) as unknown;
    if (!isGhostFile(parsed)) return [];
    return parsed.snapshots.map((snapshot) => ({
      ...snapshot,
      lives:
        typeof snapshot.lives === "number"
          ? snapshot.lives
          : 0
    }));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code === "ENOENT") return [];
    throw error;
  }
}

export async function appendGhost(
  state: RunState,
  snapshot: {
    turn: number;
    wins: number;
    lives: number;
    team: PetInstance[];
  },
  filePath = "saves/ghosts.json"
): Promise<void> {
  if (snapshot.team.length === 0) return;
  const resolved = path.resolve(filePath);
  const existing = await loadGhosts(resolved);
  existing.push({
    id: `${state.seed}:${snapshot.turn}:${snapshot.wins}:${existing.length}`,
    runSeed: state.seed,
    turn: snapshot.turn,
    wins: snapshot.wins,
    lives: snapshot.lives,
    team: structuredClone(snapshot.team)
  });
  const latest = existing.slice(-GHOST_LIMIT);
  const file: GhostFile = { version: 1, snapshots: latest };
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function chooseGhost(
  state: RunState,
  snapshots: GhostSnapshot[]
): PetInstance[] | null {
  const candidates = snapshots.filter(
    (snapshot) =>
      snapshot.runSeed !== state.seed &&
      snapshot.turn === state.turn &&
      snapshot.wins === state.wins &&
      snapshot.team.length > 0
  );
  if (candidates.length === 0) return null;
  const closeLives = candidates.filter(
    (snapshot) => Math.abs(snapshot.lives - state.lives) <= 1
  );
  const rng = new SeededRandom(
    deriveSeed(state.seed, "ghost", state.turn, state.wins)
  );
  const selected = rng.pick(closeLives.length ? closeLives : candidates);
  return selected ? structuredClone(selected.team) : null;
}

function isGhostFile(value: unknown): value is GhostFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<GhostFile>;
  return (
    file.version === 1 &&
    Array.isArray(file.snapshots) &&
    file.snapshots.every(
      (snapshot) =>
        snapshot &&
        typeof snapshot.id === "string" &&
        typeof snapshot.runSeed === "string" &&
        typeof snapshot.turn === "number" &&
        typeof snapshot.wins === "number" &&
        Array.isArray(snapshot.team)
    )
  );
}
