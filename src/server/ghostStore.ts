import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  appendGhost,
  GHOST_BUCKET_LIMIT,
  GHOST_LIMIT,
  loadGhosts,
  selectGhost,
  withGhostLock,
  type GhostSelection,
  type GhostSnapshot
} from "../game/ghosts.js";
import type { PetInstance, RunState } from "../game/types.js";

export interface GhostSnapshotInput {
  turn: number;
  wins: number;
  lives: number;
  runId?: string;
  team: PetInstance[];
}

export interface GhostPool {
  select(
    state: RunState,
    currentRunId?: string
  ): Promise<GhostSelection | null>;
  append(state: RunState, snapshot: GhostSnapshotInput): Promise<void>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}

export class FileGhostPool implements GhostPool {
  constructor(private readonly filePath: string) {}

  select(
    state: RunState,
    currentRunId?: string
  ): Promise<GhostSelection | null> {
    return withGhostLock(this.filePath, async () => {
      const snapshots = await loadGhosts(this.filePath);
      return selectGhost(state, snapshots, currentRunId);
    });
  }

  append(state: RunState, snapshot: GhostSnapshotInput): Promise<void> {
    return withGhostLock(this.filePath, () =>
      appendGhost(state, snapshot, this.filePath)
    );
  }

  async healthCheck(): Promise<void> {}

  async close(): Promise<void> {}
}

interface GhostRow {
  id: string;
  run_seed: string;
  run_id: string | null;
  pack_id: string;
  turn: number;
  wins: number;
  lives: number;
  content_version: string;
  team: PetInstance[];
}

export class PostgresGhostPool implements GhostPool {
  constructor(private readonly pool: Pool) {}

  async select(
    state: RunState,
    currentRunId?: string
  ): Promise<GhostSelection | null> {
    const result = await this.pool.query<GhostRow>(
      `
        SELECT id, run_seed, run_id, pack_id, turn, wins, lives,
               content_version, team
        FROM ghost_snapshots
        WHERE pack_id = $1
          AND turn = $2
          AND wins = $3
          AND content_version = $4
          AND (
            ($5::text IS NOT NULL AND run_id <> $5)
            OR ($5::text IS NULL AND (run_id IS NULL OR run_id <> '') AND run_seed <> $6)
          )
        ORDER BY created_at ASC, id ASC
      `,
      [
        state.packId,
        state.turn,
        state.wins,
        state.contentVersion,
        currentRunId ?? null,
        state.seed
      ]
    );
    const snapshots: GhostSnapshot[] = result.rows.map((row) => ({
      id: row.id,
      runSeed: row.run_seed,
      ...(row.run_id ? { runId: row.run_id } : {}),
      packId: row.pack_id as RunState["packId"],
      turn: row.turn,
      wins: row.wins,
      lives: row.lives,
      contentVersion: row.content_version,
      team: row.team
    }));
    return selectGhost(state, snapshots, currentRunId);
  }

  async append(state: RunState, snapshot: GhostSnapshotInput): Promise<void> {
    if (snapshot.team.length === 0) return;
    const id =
      snapshot.runId
        ? `${snapshot.runId}:${snapshot.turn}`
        : `${state.seed}:${snapshot.turn}:${snapshot.wins}:${randomUUID()}`;
    await this.pool.query(
      `
        INSERT INTO ghost_snapshots
          (id, run_seed, run_id, pack_id, turn, wins, lives, content_version, team)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          run_seed = EXCLUDED.run_seed,
          run_id = EXCLUDED.run_id,
          pack_id = EXCLUDED.pack_id,
          turn = EXCLUDED.turn,
          wins = EXCLUDED.wins,
          lives = EXCLUDED.lives,
          content_version = EXCLUDED.content_version,
          team = EXCLUDED.team,
          created_at = now()
      `,
      [
        id,
        state.seed,
        snapshot.runId ?? null,
        state.packId,
        snapshot.turn,
        snapshot.wins,
        snapshot.lives,
        state.contentVersion,
        JSON.stringify(snapshot.team)
      ]
    );
    await this.prune();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  private async prune(): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM ghost_snapshots
        WHERE id IN (
          SELECT id
          FROM (
            SELECT id,
                   row_number() OVER (
                     PARTITION BY pack_id, turn, wins, lives
                     ORDER BY created_at DESC, id DESC
                   ) AS bucket_rank
            FROM ghost_snapshots
          ) ranked
          WHERE bucket_rank > $1
        )
      `,
      [GHOST_BUCKET_LIMIT]
    );
    await this.pool.query(
      `
        DELETE FROM ghost_snapshots
        WHERE id IN (
          SELECT id
          FROM ghost_snapshots
          ORDER BY created_at DESC, id DESC
          OFFSET $1
        )
      `,
      [GHOST_LIMIT]
    );
  }
}

export async function createPostgresGhostPool(
  connectionString: string
): Promise<PostgresGhostPool> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ghost_snapshots (
      id TEXT PRIMARY KEY,
      run_seed TEXT NOT NULL,
      run_id TEXT,
      pack_id TEXT NOT NULL DEFAULT 'turtle',
      turn INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      lives INTEGER NOT NULL,
      content_version TEXT NOT NULL,
      team JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE ghost_snapshots
      ADD COLUMN IF NOT EXISTS pack_id TEXT NOT NULL DEFAULT 'turtle';
    CREATE INDEX IF NOT EXISTS ghost_snapshots_match_v2_idx
      ON ghost_snapshots (pack_id, turn, wins, content_version, run_id);
  `);
  return new PostgresGhostPool(pool);
}
