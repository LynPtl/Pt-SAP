import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRun } from "../game/persistence.js";
import type { RunState } from "../game/types.js";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SessionStore {
  private readonly directory: string;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(directory: string) {
    this.directory = path.resolve(directory);
  }

  isSessionId(value: string): boolean {
    return SESSION_ID_PATTERN.test(value);
  }

  async load(sessionId: string): Promise<RunState | null> {
    if (!this.isSessionId(sessionId)) return null;
    try {
      return await loadRun(this.filePath(sessionId));
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code === "ENOENT") return null;
      throw error;
    }
  }

  async save(sessionId: string, state: RunState): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const target = this.filePath(sessionId);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8"
    );
    await rename(temporary, target);
  }

  async withSession<T>(
    sessionId: string,
    action: () => Promise<T>
  ): Promise<T> {
    const previous = this.queues.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => gate);
    this.queues.set(sessionId, queued);
    await previous.catch(() => undefined);
    try {
      return await action();
    } finally {
      release();
      if (this.queues.get(sessionId) === queued) {
        this.queues.delete(sessionId);
      }
    }
  }

  private filePath(sessionId: string): string {
    return path.join(this.directory, `${sessionId}.json`);
  }
}
