# pt-sap

私有、纯文本、严格遵循 Super Auto Pets Normal 玩法的自走棋副本。

当前版本包含：

- 5 格队伍和顺序站位。
- 每回合 10 金；商店容量随档位增长并包含 2 个生成食物槽。
- 购买、出售、刷新、冻结、合并、经验和食物。
- 10 胜 / 5 命、第 3 回合补命、平局。
- Turtle Pack 60 只宠物和 21 种食物。
- 确定性战斗引擎、可读战斗日志和本机幽灵队快照。
- 双方阵容可视化、攻击目标/方向、伤害、倒下、召唤与胜负时间轴回放。
- 响应式 Web UI、JSON 会话存档、终端 CLI 和 Docker 运行方式。
- 60 只宠物、21 种食物、Perk 和主要战斗日志的中文展示。

玩法与验收规则见 [SPEC.md](SPEC.md)，服务器和数据库规划见
[DEPLOYMENT.md](DEPLOYMENT.md)。

## Requirements

- Node.js 24
- npm 11
- 私有 Wiki 研究缓存位于 `reference/`，不得提交或公开发布

## Web UI

```bash
npm install
npm run serve
```

打开 `http://localhost:3000`。

服务器监听地址通过 `HOST`、`PORT` 配置。Web 对局按浏览器会话自动保存到
`saves/web-sessions/`，幽灵队快照位于 `saves/ghosts.json`。

页面保留完整玩法信息：宠物中文名、英文名、阶位、等级、XP、攻击、生命、
临时战斗加成、Perk、技能、出售价值、商店价格、冻结状态、食物目标类型、
升级二选一奖励和战斗日志。

视觉规范见 [web/DESIGN.md](web/DESIGN.md)，基于用户提供的 shadcn
`SKILL.md` 与 `DESIGN.md` 参考实现。

## CLI

```bash
npm run play
```

使用固定种子：

```bash
npm run play -- my-private-seed
```

游戏内输入 `help` 查看命令。默认存档位置为 `saves/run.json`，幽灵队
快照位于 `saves/ghosts.json`。

## Verify

```bash
npm run typecheck
npm test
```

## Data pipeline

```bash
npm run coverage
npm run report
```

数据流：

```text
wiki.gg MediaWiki API
  -> reference/raw/
  -> reference/normalized/
  -> reports/turtle-pack-coverage.md
  -> src/game content loader
```

引擎不会修改 `reference/`。需要刷新数据时重新运行抓取命令。

## Docker

```bash
docker compose up -d --build
```

打开 `http://<server>:3000`。服务器端口可用 `PT_SAP_PORT` 覆盖。

容器只读挂载 `reference/`，使用只读根文件系统，并通过名为
`pt-sap-saves` 的卷保存 Web 会话和幽灵队。

公网部署建议在 TLS 反向代理后设置
`PT_SAP_BASIC_AUTH='user:password'` 和 `PT_SAP_SECURE_COOKIE=1`。

## Current boundary

当前 Web 服务已支持隔离浏览器会话，但仍然是无数据库的单进程形态。
未来 WebSocket 多人版本会复用同一套纯游戏引擎，由服务器适配层接
PostgreSQL。数据库不会进入战斗结算核心。

代码使用 MIT；私有 SAP 衍生数据、名称和 Wiki 原文仅限本项目私有使用。
