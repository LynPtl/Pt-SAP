import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PACK_ID,
  TURTLE_CONTENT_VERSION,
  type StaticPackId
} from "./packs.js";
import { deriveSeed, SeededRandom } from "./rng.js";
import type { PetInstance, RunState } from "./types.js";

export interface GhostSnapshot {
  id: string;
  runSeed: string;
  runId?: string;
  turn: number;
  wins: number;
  lives: number;
  packId: StaticPackId;
  contentVersion: string;
  team: PetInstance[];
}

export interface GhostSelection {
  snapshot: GhostSnapshot;
  team: PetInstance[];
}

interface GhostFile {
  version: 1;
  snapshots: Array<Omit<GhostSnapshot, "lives"> & { lives?: number }>;
}

export const GHOST_LIMIT = 1000;
export const GHOST_BUCKET_LIMIT = 64;
const ghostQueues = new Map<string, Promise<void>>();
export const GHOST_CONTENT_VERSION = TURTLE_CONTENT_VERSION;

export async function withGhostLock<T>(
  filePath: string,
  action: () => Promise<T>
): Promise<T> {
  const resolved = path.resolve(filePath);
  const previous = ghostQueues.get(resolved) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  ghostQueues.set(resolved, queued);
  await previous.catch(() => undefined);
  try {
    return await action();
  } finally {
    release();
    if (ghostQueues.get(resolved) === queued) {
      ghostQueues.delete(resolved);
    }
  }
}

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
          : 0,
      contentVersion: snapshot.contentVersion ?? GHOST_CONTENT_VERSION,
      packId: snapshot.packId ?? DEFAULT_PACK_ID
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
    runId?: string;
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
    ...(snapshot.runId ? { runId: snapshot.runId } : {}),
    turn: snapshot.turn,
    wins: snapshot.wins,
    lives: snapshot.lives,
    packId: state.packId,
    contentVersion: state.contentVersion,
    team: structuredClone(snapshot.team)
  });
  const latest = compactGhosts(existing);
  const file: GhostFile = { version: 1, snapshots: latest };
  await mkdir(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  await rename(temporary, resolved);
}

function compactGhosts(snapshots: GhostSnapshot[]): GhostSnapshot[] {
  const byRunTurn = new Map<string, GhostSnapshot>();
  for (const snapshot of snapshots) {
    const runKey = snapshot.runId ?? snapshot.runSeed;
    byRunTurn.set(`${runKey}:${snapshot.turn}`, snapshot);
  }

  const buckets = new Map<string, GhostSnapshot[]>();
  for (const snapshot of byRunTurn.values()) {
    const bucket = `${snapshot.turn}:${snapshot.wins}:${snapshot.lives}`;
    const entries = buckets.get(bucket) ?? [];
    entries.push(snapshot);
    buckets.set(bucket, entries);
  }

  const retained = new Set<GhostSnapshot>();
  for (const entries of buckets.values()) {
    for (const snapshot of entries.slice(-GHOST_BUCKET_LIMIT)) {
      retained.add(snapshot);
    }
  }
  return [...byRunTurn.values()]
    .filter((snapshot) => retained.has(snapshot))
    .slice(-GHOST_LIMIT);
}

export function selectGhost(
  state: RunState,
  snapshots: GhostSnapshot[],
  currentRunId?: string
): GhostSelection | null {
  const candidates = snapshots.filter(
    (snapshot) =>
      (snapshot.runId
        ? snapshot.runId !== currentRunId
        : snapshot.runSeed !== state.seed) &&
      (snapshot.packId ?? DEFAULT_PACK_ID) === state.packId &&
      (snapshot.contentVersion ?? GHOST_CONTENT_VERSION) ===
        state.contentVersion &&
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
  return selected
    ? {
        snapshot: structuredClone(selected),
        team: structuredClone(selected.team)
      }
    : null;
}

export function chooseGhost(
  state: RunState,
  snapshots: GhostSnapshot[],
  currentRunId?: string
): PetInstance[] | null {
  return selectGhost(state, snapshots, currentRunId)?.team ?? null;
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
