import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadContent } from "../game/content.js";
import {
  appendGhost,
  chooseGhost,
  loadGhosts,
  withGhostLock
} from "../game/ghosts.js";
import { battleLogLineZh } from "../game/localization.js";
import {
  buyFood,
  buyPet,
  createRun,
  endTurn,
  freezeShopItem,
  mergeTeamPets,
  movePet,
  refreshShop,
  sellPet
} from "../game/run.js";
import type {
  ActionResult,
  EndTurnResult
} from "../game/run.js";
import type { ContentBundle, RunState } from "../game/types.js";
import { SessionStore } from "./sessionStore.js";
import { buildWebView } from "./view.js";

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_SESSION_DIR = "saves/web-sessions";
const DEFAULT_GHOST_PATH = "saves/ghosts.json";
const COOKIE_NAME = "pt_sap_session";

interface WebServerOptions {
  sessionDir?: string;
  ghostPath?: string;
  webDir?: string;
  secureCookie?: boolean;
  basicAuth?: {
    user: string;
    password: string;
  } | null;
}

interface StaticAsset {
  body: Buffer;
  contentType: string;
}

type ActionBody =
  | { type: "buyPet"; slot?: number; targetUid?: string; rewardIndex?: number }
  | { type: "buyFood"; slot: number; targetUid?: string }
  | { type: "sell"; uid: string }
  | { type: "move"; uid: string; targetSlot: number }
  | { type: "merge"; sourceUid: string; targetUid: string }
  | { type: "freeze"; kind: "pet" | "food"; slot: number }
  | { type: "roll" }
  | { type: "end" };

export async function createWebServer(
  content: ContentBundle = loadContent(),
  options: WebServerOptions = {}
): Promise<Server> {
  const webDir = path.resolve(options.webDir ?? "web");
  const sessionStore = new SessionStore(
    options.sessionDir ?? DEFAULT_SESSION_DIR
  );
  const ghostPath = path.resolve(options.ghostPath ?? DEFAULT_GHOST_PATH);
  const assets = await loadStaticAssets(webDir);

  return createHttpServer(async (request, response) => {
    setSecurityHeaders(response);
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/healthz") {
        sendText(response, 200, "ok\n", "text/plain; charset=utf-8");
        return;
      }
      if (
        options.basicAuth &&
        !hasBasicAuth(request, options.basicAuth)
      ) {
        response.setHeader(
          "WWW-Authenticate",
          'Basic realm="pt-sap", charset="UTF-8"'
        );
        sendText(response, 401, "Authentication required\n", "text/plain; charset=utf-8");
        return;
      }
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "GET" && assets.has(url.pathname)) {
        const asset = assets.get(url.pathname) as StaticAsset;
        response.writeHead(200, {
          "Content-Type": asset.contentType,
          "Cache-Control": "no-cache"
        });
        response.end(asset.body);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        const resolved = await resolveSession(
          request,
          response,
          sessionStore,
          content,
          options.secureCookie ?? false
        );
        sendJson(response, 200, {
          ok: true,
          view: buildWebView(resolved.state, content, resolved.sessionId)
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/new") {
        const body = await readJson<{ seed?: unknown }>(request);
        const seed =
          typeof body.seed === "string" && body.seed.trim()
            ? body.seed.trim().slice(0, 64)
            : `web-${new Date().toISOString()}`;
        const sessionId = randomUUID();
        const state = createRun(seed, content);
        await sessionStore.save(sessionId, state);
        setSessionCookie(response, sessionId, options.secureCookie ?? false);
        sendJson(response, 200, {
          ok: true,
          view: buildWebView(state, content, sessionId)
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/action") {
        const body = await readJson<ActionBody>(request);
        const resolved = await resolveSession(
          request,
          response,
          sessionStore,
          content,
          options.secureCookie ?? false
        );
        const responseData = await sessionStore.withSession(
          resolved.sessionId,
          async () => {
            const state =
              (await sessionStore.load(resolved.sessionId)) ?? resolved.state;
            const beforeLog = state.log.length;
            const result = await applyAction(
              state,
              content,
              body,
              ghostPath,
              resolved.sessionId
            );
            if (result.ok) {
              await sessionStore.save(resolved.sessionId, state);
            }
            return {
              ok: result.ok,
              message: battleLogLineZh(result.message),
              addedLog: state.log
                .slice(beforeLog)
                .map(battleLogLineZh),
              view: buildWebView(state, content, resolved.sessionId)
            };
          }
        );
        sendJson(response, responseData.ok ? 200 : 409, responseData);
        return;
      }
      if (
        request.method !== "GET" &&
        request.method !== "POST"
      ) {
        sendJson(response, 405, { ok: false, error: "Method not allowed" });
        return;
      }
      sendJson(response, 404, { ok: false, error: "Not found" });
    } catch (error) {
      console.error(error);
      if (response.headersSent) {
        response.end();
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const status = message === "Request body too large" ? 413 : 400;
      sendJson(response, status, { ok: false, error: message });
    }
  });
}

function applyAction(
  state: RunState,
  content: ContentBundle,
  body: ActionBody,
  ghostPath: string,
  sessionId: string
): Promise<ActionResult | EndTurnResult> {
  switch (body.type) {
    case "buyPet":
      return Promise.resolve(
        buyPet(
          state,
          content,
          typeof body.slot === "number" ? body.slot : null,
          typeof body.targetUid === "string" ? body.targetUid : undefined,
          typeof body.rewardIndex === "number"
            ? body.rewardIndex
            : undefined
        )
      );
    case "buyFood":
      requireInteger(body.slot, "slot");
      return Promise.resolve(
        buyFood(
          state,
          content,
          body.slot,
          typeof body.targetUid === "string" ? body.targetUid : undefined
        )
      );
    case "sell":
      requireString(body.uid, "uid");
      return Promise.resolve(sellPet(state, content, body.uid));
    case "move":
      requireString(body.uid, "uid");
      requireInteger(body.targetSlot, "targetSlot");
      return Promise.resolve(
        movePet(state, body.uid, body.targetSlot)
      );
    case "merge":
      requireString(body.sourceUid, "sourceUid");
      requireString(body.targetUid, "targetUid");
      return Promise.resolve(
        mergeTeamPets(state, content, body.sourceUid, body.targetUid)
      );
    case "freeze":
      requireInteger(body.slot, "slot");
      if (body.kind !== "pet" && body.kind !== "food") {
        throw new Error("kind must be pet or food");
      }
      return Promise.resolve(
        freezeShopItem(state, body.kind, body.slot)
      );
    case "roll":
      return Promise.resolve(refreshShop(state, content, true));
    case "end":
      return endTurnWithGhost(state, content, ghostPath, sessionId);
    default:
      throw new Error("Unknown action");
  }
}

async function endTurnWithGhost(
  state: RunState,
  content: ContentBundle,
  ghostPath: string,
  sessionId: string
): Promise<EndTurnResult> {
  return withGhostLock(ghostPath, async () => {
    const battleTurn = state.turn;
    const battleWins = state.wins;
    const battleLives = state.lives;
    let ghosts: Awaited<ReturnType<typeof loadGhosts>> = [];
    try {
      ghosts = await loadGhosts(ghostPath);
    } catch (error) {
      console.warn("Could not load ghosts; using bot opponent.", error);
    }
    const ghostTeam =
      chooseGhost(state, ghosts, sessionId) ?? undefined;
    const result = endTurn(state, content, ghostTeam);
    if (result.playerSnapshot) {
      try {
        await appendGhost(
          state,
          {
            turn: battleTurn,
            wins: battleWins,
            lives: battleLives,
            runId: sessionId,
            team: result.playerSnapshot
          },
          ghostPath
        );
      } catch (error) {
        console.warn("Could not save ghost snapshot.", error);
      }
    }
    return result;
  });
}

async function resolveSession(
  request: IncomingMessage,
  response: ServerResponse,
  sessionStore: SessionStore,
  content: ContentBundle,
  secureCookie: boolean
): Promise<{ sessionId: string; state: RunState }> {
  const cookieId = readCookie(request, COOKIE_NAME);
  if (cookieId && sessionStore.isSessionId(cookieId)) {
    const loaded = await sessionStore.load(cookieId);
    if (loaded) return { sessionId: cookieId, state: loaded };
  }
  const sessionId = randomUUID();
  const state = createRun(`web-${new Date().toISOString()}`, content);
  await sessionStore.save(sessionId, state);
  setSessionCookie(response, sessionId, secureCookie);
  return { sessionId, state };
}

function readCookie(request: IncomingMessage, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

function hasBasicAuth(
  request: IncomingMessage,
  expected: { user: string; password: string }
): boolean {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const expectedValue = `${expected.user}:${expected.password}`;
  const supplied = Buffer.from(decoded);
  const target = Buffer.from(expectedValue);
  return supplied.length === target.length && timingSafeEqual(supplied, target);
}

function parseBasicAuth(value: string | undefined): {
  user: string;
  password: string;
} | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error("PT_SAP_BASIC_AUTH must be user:password");
  }
  return {
    user: value.slice(0, separator),
    password: value.slice(separator + 1)
  };
}

function setSessionCookie(
  response: ServerResponse,
  sessionId: string,
  secure: boolean
): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000"
  ];
  if (secure) parts.push("Secure");
  response.setHeader("Set-Cookie", parts.join("; "));
}

function requireString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function requireInteger(value: unknown, name: string): asserts value is number {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {} as T;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown
): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendText(
  response: ServerResponse,
  status: number,
  body: string,
  contentType: string
): void {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function loadStaticAssets(
  webDir: string
): Promise<Map<string, StaticAsset>> {
  const files: Array<[string, string, string]> = [
    ["/", "index.html", "text/html; charset=utf-8"],
    ["/index.html", "index.html", "text/html; charset=utf-8"],
    ["/app.js", "app.js", "text/javascript; charset=utf-8"],
    ["/styles.css", "styles.css", "text/css; charset=utf-8"]
  ];
  const assets = new Map<string, StaticAsset>();
  for (const [route, file, contentType] of files) {
    assets.set(route, {
      body: await readFile(path.join(webDir, file)),
      contentType
    });
  }
  return assets;
}

function parsePort(value: string | undefined): number {
  const port = Number.parseInt(value ?? "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

async function start(): Promise<void> {
  const host = process.env.HOST ?? "0.0.0.0";
  const port = parsePort(process.env.PORT);
  const server = await createWebServer(loadContent(), {
    sessionDir: process.env.PT_SAP_SESSION_DIR,
    ghostPath: process.env.PT_SAP_GHOST_PATH,
    webDir: process.env.PT_SAP_WEB_DIR,
    secureCookie: process.env.PT_SAP_SECURE_COOKIE === "1",
    basicAuth: parseBasicAuth(process.env.PT_SAP_BASIC_AUTH)
  });
  server.listen(port, host, () => {
    console.log(`pt-sap web UI listening on http://${host}:${port}`);
  });
  const shutdown = (): void => {
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entry = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entry) {
  start().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
