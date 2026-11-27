import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadContent } from "../game/content.js";
import { createWebServer } from "./server.js";

test("web server serves UI and supports a session action", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "pt-sap-web-"));
  const content = loadContent();
  const server = await createWebServer(content, {
    sessionDir: path.join(directory, "sessions"),
    ghostPath: path.join(directory, "ghosts.json"),
    webDir: path.resolve("web")
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.equal(await health.text(), "ok\n");

  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /pt-sap/);

  const stateResponse = await fetch(`${base}/api/state`);
  assert.equal(stateResponse.status, 200);
  const cookie = stateResponse.headers.get("set-cookie");
  assert.ok(cookie);
  const stateData = (await stateResponse.json()) as {
    view: {
      state: {
        turn: number;
        pets: Array<{ ability: string }>;
      };
    };
  };
  assert.equal(stateData.view.state.turn, 1);
  assert.equal(stateData.view.state.pets.length, 3);
  assert.ok(stateData.view.state.pets[0].ability);

  const action = await fetch(`${base}/api/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie.split(";")[0]
    },
    body: JSON.stringify({ type: "buyPet", slot: 0 })
  });
  assert.equal(action.status, 200);
  const actionData = (await action.json()) as {
    ok: boolean;
    message: string;
    view: {
      state: {
        teamSize: number;
        team: Array<{ name: string; nameZh: string; ability: string }>;
      };
    };
  };
  assert.equal(actionData.ok, true);
  assert.match(actionData.message, /已购买/);
  assert.equal(
    actionData.message.includes(actionData.view.state.team[0].name),
    false
  );
  assert.equal(actionData.view.state.teamSize, 1);
  assert.ok(actionData.view.state.team[0].nameZh);
  assert.match(actionData.view.state.team[0].ability, /[\u4e00-\u9fff]/);

  const endTurn = await fetch(`${base}/api/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie.split(";")[0]
    },
    body: JSON.stringify({ type: "end" })
  });
  const endTurnData = (await endTurn.json()) as {
    ok: boolean;
    view: {
      state: {
        lastBattleReplay: {
          playerTeam: Array<{ nameZh: string; ability: string }>;
          enemyTeam: Array<{ nameZh: string; ability: string }>;
          events: Array<{
            message: string;
            type: string;
            side: string | null;
            state: {
              units: Array<{
                name: string;
                attack: number;
                health: number;
                status: string;
              }>;
            };
          }>;
        };
      };
    };
  };
  assert.equal(endTurnData.ok, true);
  assert.ok(endTurnData.view.state.lastBattleReplay);
  assert.ok(endTurnData.view.state.lastBattleReplay.enemyTeam.length > 0);
  assert.match(
    endTurnData.view.state.lastBattleReplay.events[0].message,
    /[\u4e00-\u9fff]/
  );
  assert.ok(
    endTurnData.view.state.lastBattleReplay.events[0].state.units.length > 0
  );
});

test("optional basic authentication protects the UI but not health checks", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "pt-sap-auth-"));
  const server = await createWebServer(loadContent(), {
    sessionDir: path.join(directory, "sessions"),
    ghostPath: path.join(directory, "ghosts.json"),
    webDir: path.resolve("web"),
    basicAuth: { user: "player", password: "secret" }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  const authorized = await fetch(`${base}/api/state`, {
    headers: {
      Authorization: `Basic ${Buffer.from("player:secret").toString("base64")}`
    }
  });
  assert.equal(authorized.status, 200);
});
