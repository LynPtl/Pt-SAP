# pt-sap 交接文档

## 1. 项目是什么

`pt-sap` 是一个**私有、纯文本的自走棋克隆**，方向是 Super Auto Pets（SAP）式，不是云顶式。

目标形态：

- 5 格队伍，顺序即站位
- 每回合 10 金，商店 3 宠物 + 2 食物
- 食物是单件装备，不做合成
- 标签/羁绊只做推荐和技能条件，不做 2/4/6 硬阈值
- 10 胜 / 5 命，异步打幽灵队
- 纯文本、无图片、无动画、可暂停，适合摸鱼
- 私有使用；代码 MIT，原创数据/文本计划 CC0 或 MIT

**当前状态：数据抓取和 Turtle Pack 覆盖率报告已完成。战斗引擎、商店、文本 UI 都还没开始。**

本项目独立运行，**不要接入 ptnook**。

## 2. 仓库状态

- 路径：`d:/pt-sap`
- 分支：`main`
- 工作区：干净
- 最近提交：`git log -1`（交接文档加入前为 `b7d08f2`）
- 环境：Windows，Node `v24.20.0`，npm `11.19.0`
- 运行时依赖：`zod`
- 开发依赖：`typescript`、`tsx`、`@types/node`

常用命令：

```bash
cd d:/pt-sap
npm install
npm run coverage        # 抓取 + 归一化 + 报告
npm run scrape          # 只抓取/更新缓存
npm run report          # 只用缓存重新生成报告
npm run typecheck
npm test
```

强制重新抓取：

```bash
npm run coverage -- --refresh
```

## 3. 目录

```text
pt-sap/
  src/scraper/
    wiki.ts          # MediaWiki API 客户端，Zod 校验
    wikitext.ts      # 模板、链接、标记解析
    parse.ts         # AnimalInfoBox / Foods/row -> 结构化记录
    normalize.ts     # 技能文本 -> 关键词级 DSL
    coverage.ts      # 归一化 + Markdown 覆盖率报告
    cli.ts           # scrape / report / all 命令
    *.test.ts        # 解析和分类测试
  reference/         # gitignored，SAP 衍生研究数据
    raw/             # 原始 wikitext 缓存
    normalized/      # 结构化 JSON（仍含 SAP 名称/英文文本）
  reports/
    turtle-pack-coverage.md   # 已提交
  README.md
  LICENSE            # MIT
```

## 4. 数据管线

```text
wiki.gg MediaWiki API
  -> reference/raw/turtle-pack-pages.json
  -> reference/normalized/turtle-pack.json
  -> reference/normalized/turtle-pack-foods.json
  -> reports/turtle-pack-coverage.md
```

关键点：

- 先取 `Category:Turtle Pack`，再与 `Category:Pets` 求交集，得到 **60 只**宠物
- `Category:Turtle Pack` 本身有 78 个页面，包含食物等，不能直接用
- 宠物页解析 `{{AnimalInfoBox}}`：`tier`、`attack/health`、`ID`、`level_1/2/3`
- 食物解析 `Food` 页里的 `{{:Foods/row}}` 表格
- 图片全部忽略
- 抓取分批 50 页/请求，带限速和缓存；第二次运行显示 `0 pages fetched, 61 cached`

## 5. 当前覆盖率

Turtle Pack：

- 60 只宠物，60 只有技能文本
- 59 只完整命中关键词 DSL（98%）
- 1 只部分命中：Tiger（复制友方技能）
- 0 只完全无法识别
- 21 个 Turtle Pack 食物，21 个命中
- 11 个复杂/条件技能

主要触发：`faint` 16、`startOfBattle` 9、`hurt` 5、`startOfTurn` 5、`endOfTurn` 4、`summon` 4、`afterAttack` 3、`buy` 3、`sell` 3。

主要效果：`modifyStats` 31、`dealDamage` 10、`summon` 8、`perk` 5、`shop` 5、`gold` 4、`food` 3、`copy` 2、`swallow` 1。

**重要：`full` 只是关键词命中，不代表引擎能直接执行。** 复杂列表见 `reports/turtle-pack-coverage.md` 的 “Complex abilities”。

## 6. 归一化数据结构

`reference/normalized/turtle-pack.json` 示例：

```json
{
  "id": "0",
  "title": "Ant",
  "tier": 1,
  "attack": 2,
  "health": 2,
  "parseErrors": [],
  "abilities": [
    {
      "level": 1,
      "text": "Faint: Give a random friend +1 attack and +1 health.",
      "dsl": {
        "trigger": "faint",
        "effects": ["modifyStats"],
        "targets": ["randomFriend"],
        "status": "full",
        "complex": false,
        "reasons": []
      }
    }
  ]
}
```

状态含义：

- `full`：触发 + 效果 + 目标都识别到了（或目标可省略）
- `partial`：缺触发或目标
- `custom`：没有识别到效果
- `complex`：含 `if`、`works N times`、`adjacent` 等条件/次数文本

## 7. 已知问题和坑

### 7.1 分类器是关键词级

`normalize.ts` 用正则识别触发、效果、目标，不是语义解析器。典型偏差：

- `Meat Bone` / `Steak` 会被识别出 `dealDamage`，因为文本是 “Attack with +X damage”；引擎里应视为 perk 修正
- `Cat`、`Squirrel`、`Worm`、`Cow`、`Duck` 没有显式目标，靠 `TARGET_OPTIONAL`（shop/gold/food 等）判为 full；真实语义要人工补
- `Hippogriff` 是多段技能（召唤 + 友方召唤给 buff），但 `complex` 可能为 false
- `Kangaroo`、`Snake` 的 “Friend ahead attacks” 被映射为 `afterAttack`，是特殊规则
- `Milk` 一个食物文本里塞了三个等级，需要特殊处理
- `Tiger` 是唯一 partial：复制技能，必须 custom

### 7.2 食物

- 食物用 `analyzeFood`，强制 `trigger: "passive"`；不要改回 `analyzeAbility`，否则 Honey/Mushroom 的 `Faint →` 会被误判成触发
- 食物的 `tier` 当前是 `null`，因为 tier 在表格的章节标题里，没解析；需要的话再解析 `=== Tier N ===` 标题
- Honey 同时有 `perk` 和 `summon` 效果，这是预期的

### 7.3 数据完整性

- Wiki 是社区维护，可能滞后；页面正文写 450 只，但 `Category:Pets` 有 535 个页面
- 当前只处理 Turtle Pack；其他包需要复用 `parsePet` / `parseFoods`
- `reference/` 和 `reports/` 里都有 SAP 名称/英文文本；`reference/` 已 gitignore，`reports/` 是私有仓库内容。**仓库公开前必须清理报告中的 SAP 文本。**

## 8. 已确定的设计约束

不要在没有明确要求时改这些：

- 5 格队伍，左到右 = 前到后
- 每回合 10 金
- 商店 3 宠物 + 2 食物
- 宠物/食物 3 金，刷新 1 金，卖出 1 金，冻结免费
- 6 个商店档位，第 1/3/5/7/9/11 回合升档
- 10 胜 / 5 命，异步幽灵队
- 每只宠物 1 个食物槽；少数宠物可 2 槽
- 食物是单件装备，**不做合成、散件、转职**
- 标签是技能条件和推荐信号，**不做 2/4/6 数值雪球**
- 纯文本，无图片/动画/音效
- 私有克隆：原创中文名、自己生成技能文本、不要发布 SAP 素材
- 引擎必须确定性：同种子 + 同队伍 = 同战报

## 9. 下一步建议（按优先级）

### P0：战斗引擎骨架

建议新增 `src/engine/`：

```text
src/engine/
  types.ts        # BattleState, Combatant, CombatEvent, Team
  rng.ts          # seeded PRNG（如 mulberry32）
  resolve.ts      # resolveBattle(teamA, teamB, seed)
  targets.ts      # 目标选择
  effects.ts      # 效果执行
```

最低要求：

- 5 格队伍，顺序即站位
- 双方前排同时攻击，死亡后补位
- 触发阶段：startOfBattle、beforeAttack、afterAttack、hurt、faint、summon、endOfTurn
- 事件日志：每一条都可读，文本 UI 直接渲染
- 同种子可复现
- 先支持 Ant、Cricket、Hedgehog、Beaver 这类简单技能，写 golden test

### P1：效果和目标原语

先实现覆盖率最高的：

- 效果：`modifyStats`、`dealDamage`、`summon`、`perk`、`shield`、`destroy`、`revive`
- 目标：`self`、`randomFriend`、`allFriends`、`friendAhead/Behind`、`nearestFriendAhead`、`randomEnemy`、`allEnemies`、`allPets`、`adjacentPets`、`triggeringPet`
- 临时/永久属性要分开：`untilEndOfBattle` vs 永久
- `works N times` 要计数器
- `copy` 单独 custom handler

### P2：原创内容层

当前 `reference/normalized` 不能直接发布。需要：

1. 新建 `data/pets.json`、`data/foods.json`
2. 用原创中文名替换 SAP 名
3. 从 DSL 生成中文技能文本，或人工重写
4. 保持 `reference/` 只做内部对照
5. 数据协议建议 CC0-1.0；代码 MIT

### P3：可玩文本 CLI

先做单机 1 人 + 7 幽灵队：

- 商店、刷新、冻结、买卖
- 5 格上阵、换顺序
- 食物分配
- 升档
- 战斗结算 + 文字战报
- 10 胜/5 命
- 存档/恢复
- 每日种子

### P4：幽灵队

- 每回合存玩家棋盘快照
- 按回合/分数采样
- 第一版可以用规则 bot 生成合法队伍，不着急做 MCTS

### P5：扩展卡包

Turtle Pack 跑通后，再抓其他包。不要一上来实现 535 只。

## 10. 给接手 agent 的操作规则

- 先读：`README.md`、`reports/turtle-pack-coverage.md`、`src/scraper/normalize.ts`、`src/scraper/coverage.ts`
- **不要手改 `reference/`**；需要更新就重新跑 `npm run coverage -- --refresh`
- 改分类器后必须重跑 `npm test` 和 `npm run report`
- 不要把 `reference/` 的内容复制进 `data/` 或公开仓库
- 不要接入 ptnook
- 不要先做 535 只宠物；先 Turtle Pack 60 只
- 不要加入装备合成、海克斯、8 人实时
- 不要改已确定的经济/队伍/胜负规则；要改先问
- 共享工作区时不要 `git add -A`；用项目的选择性提交工具

## 11. 待定决策

- 标签是否要有轻微机制收益？当前建议：只做技能条件 + 顾问推荐，不做数值阈值
- 是否加“4 金提前升档”？当前建议：先不加，保持 SAP 节奏
- 文本 UI：终端 CLI 还是浏览器 `<pre>`？未定
- 中文命名方案：未定
- 数据协议：代码 MIT，数据 CC0-1.0（推荐）还是统一 MIT

## 12. 快速验收

接手后先跑：

```bash
cd d:/pt-sap
npm install
npm run typecheck
npm test
npm run coverage
```

预期：

- 9 个测试通过
- 60 只宠物、21 个 Turtle Pack 食物
- 59 full / 1 partial / 0 custom
- 报告生成到 `reports/turtle-pack-coverage.md`
