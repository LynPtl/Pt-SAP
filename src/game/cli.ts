import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadContent } from "./content.js";
import { appendGhost, chooseGhost, loadGhosts } from "./ghosts.js";
import { loadRun, saveRun } from "./persistence.js";
import {
  buyFood,
  buyPet,
  createRun,
  describePet,
  describeShop,
  endTurn,
  freezeShopItem,
  mergeTeamPets,
  movePet,
  refreshShop,
  sellPet
} from "./run.js";
import type { ActionResult } from "./run.js";
import type { ContentBundle, RunState } from "./types.js";

const DEFAULT_SAVE = "saves/run.json";

function header(state: RunState): string {
  return [
    `第 ${state.turn} 回合 | 胜 ${state.wins}/10 | 生命 ${state.lives}/5 | 金币 ${state.gold} | 商店 ${state.shopTier} 档`,
    `状态：${state.phase}`
  ].join("\n");
}

function printState(state: RunState, content: ContentBundle): void {
  console.log(`\n${header(state)}`);
  console.log("队伍（1 为前排）：");
  if (state.team.length === 0) {
    console.log("  (空)");
  } else {
    state.team.forEach((pet, index) => {
      console.log(`  ${index + 1}. ${describePet(pet, content)}`);
    });
  }
  console.log("商店：");
  for (const line of describeShop(state, content)) {
    console.log(`  ${line}`);
  }
}

function printResult(result: ActionResult): void {
  console.log(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`);
}

function parseSlot(value: string, max: number): number | null {
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) && index >= 1 && index <= max
    ? index - 1
    : null;
}

function targetUid(state: RunState, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const slot = parseSlot(value, state.team.length);
  return slot === null ? undefined : state.team[slot]?.uid;
}

function help(): void {
  console.log(`
命令：
  status                         查看状态
  buy pet <商店格> [队伍格]      购买宠物；可选合并目标
  buy food <食物格> [队伍格]     购买/喂食
  reward <奖励格> [队伍格]       购买升级奖励
  sell <队伍格>                  出售宠物
  merge <来源格> <目标格>        合并两只同名宠物
  move <队伍格> <目标格>         调整前后顺序
  freeze pet|food <格>           冻结/取消冻结
  roll                           花 1 金刷新
  log [行数]                     查看最近日志
  end                            结束商店阶段并战斗
  save [路径]                    存档
  load [路径]                    读档
  new [种子]                     开新局
  help                           显示帮助
  quit                           退出
`);
}

async function main(): Promise<void> {
  const content = loadContent();
  const requestedSeed = process.argv[2];
  const manualRunId = `cli-${process.pid}-${Date.now()}`;
  let state = createRun(
    requestedSeed ?? `run-${new Date().toISOString().slice(0, 10)}`,
    content
  );
  const rl = createInterface({ input, output });

  console.log("pt-sap 私有 SAP Turtle Pack 模式");
  console.log("玩法基线：SAP Normal（10 胜 / 5 命 / 异步风格对手）");
  help();
  printState(state, content);

  for (;;) {
    const raw = (await rl.question("\n> ")).trim();
    if (!raw) continue;
    const parts = raw.split(/\s+/);
    const command = parts[0]?.toLowerCase();

    if (command === "quit" || command === "exit") break;
    if (command === "help" || command === "?") {
      help();
      continue;
    }
    if (command === "status") {
      printState(state, content);
      continue;
    }
    if (command === "new") {
      state = createRun(
        parts[1] ?? `run-${new Date().toISOString().slice(0, 10)}`,
        content
      );
      printState(state, content);
      continue;
    }
    if (command === "save") {
      const file = parts[1] ?? DEFAULT_SAVE;
      await saveRun(state, file);
      console.log(`已存档：${file}`);
      continue;
    }
    if (command === "load") {
      const file = parts[1] ?? DEFAULT_SAVE;
      try {
        state = await loadRun(file);
        printState(state, content);
      } catch (error) {
        console.log(`✗ ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
    if (command === "log") {
      const count = Number.parseInt(parts[1] ?? "20", 10);
      const lines = state.log.slice(-Math.max(1, Math.min(200, count)));
      console.log(lines.join("\n") || "(无日志)");
      continue;
    }
    if (state.phase === "gameOver") {
      console.log("本局已结束。使用 new 或 load 继续。");
      continue;
    }
    if (command === "roll") {
      printResult(refreshShop(state, content, true));
      printState(state, content);
      continue;
    }
    if (command === "buy" && parts[1] === "pet") {
      const slot = parseSlot(parts[2] ?? "", 3);
      if (slot === null) {
        console.log("✗ 宠物格必须是 1..3。");
      } else {
        const target = targetUid(state, parts[3]);
        if (parts[3] && !target) console.log("✗ 合并目标无效。");
        else {
          printResult(buyPet(state, content, slot, target));
          printState(state, content);
        }
      }
      continue;
    }
    if (command === "buy" && parts[1] === "food") {
      const slot = parseSlot(parts[2] ?? "", state.shop.foods.length);
      if (slot === null) {
        console.log(`✗ 食物格必须是 1..${state.shop.foods.length}。`);
      } else {
        const target = targetUid(state, parts[3]);
        if (parts[3] && !target) console.log("✗ 食物目标无效。");
        else {
          printResult(buyFood(state, content, slot, target));
          printState(state, content);
        }
      }
      continue;
    }
    if (command === "reward") {
      const index = parseSlot(parts[1] ?? "", state.shop.rewardPets.length);
      if (index === null) {
        console.log("✗ 奖励格无效。");
      } else {
        const target = targetUid(state, parts[2]);
        printResult(
          buyPet(state, content, null, target, index)
        );
        printState(state, content);
      }
      continue;
    }
    if (command === "sell") {
      const slot = parseSlot(parts[1] ?? "", state.team.length);
      const pet = slot === null ? null : state.team[slot];
      printResult(
        pet
          ? sellPet(state, content, pet.uid)
          : { ok: false, message: "队伍格无效。" }
      );
      printState(state, content);
      continue;
    }
    if (command === "move") {
      const from = parseSlot(parts[1] ?? "", state.team.length);
      const to = parseSlot(parts[2] ?? "", state.team.length);
      const pet = from === null ? null : state.team[from];
      printResult(
        pet && to !== null
          ? movePet(state, pet.uid, to + 1)
          : { ok: false, message: "队伍格无效。" }
      );
      printState(state, content);
      continue;
    }
    if (command === "merge") {
      const from = parseSlot(parts[1] ?? "", state.team.length);
      const to = parseSlot(parts[2] ?? "", state.team.length);
      const source = from === null ? null : state.team[from];
      const target = to === null ? null : state.team[to];
      printResult(
        source && target
          ? mergeTeamPets(state, content, source.uid, target.uid)
          : { ok: false, message: "队伍格无效。" }
      );
      printState(state, content);
      continue;
    }
    if (command === "freeze") {
      const kind = parts[1];
      const max =
        kind === "pet" ? 3 : kind === "food" ? state.shop.foods.length : 0;
      const slot = parseSlot(parts[2] ?? "", max);
      if ((kind !== "pet" && kind !== "food") || slot === null) {
        console.log("✗ 用法：freeze pet|food <格>。");
      } else {
        printResult(freezeShopItem(state, kind, slot));
        printState(state, content);
      }
      continue;
    }
    if (command === "end") {
      const before = state.log.length;
      const battleTurn = state.turn;
      const battleWins = state.wins;
      const battleLives = state.lives;
      const ghosts = await loadGhosts();
      const result = endTurn(
        state,
        content,
        chooseGhost(state, ghosts, manualRunId) ?? undefined
      );
      if (result.playerSnapshot) {
        await appendGhost(state, {
          turn: battleTurn,
          wins: battleWins,
          lives: battleLives,
          runId: manualRunId,
          team: result.playerSnapshot
        });
      }
      printResult(result);
      const battleLines = state.log
        .slice(before)
        .filter((line) => line.startsWith("[战斗]"));
      if (battleLines.length) {
        console.log("\n最近战斗：");
        console.log(battleLines.slice(-30).join("\n"));
      }
      printState(state, content);
      continue;
    }

    console.log("✗ 未知命令。输入 help 查看命令。");
  }

  rl.close();
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === "AbortError") {
    process.exitCode = 0;
    return;
  }
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
