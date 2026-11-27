# SAP Conformance Matrix

状态：进行中，不可宣称“完全复刻”  
最后核对：2026-11-27  
目标范围：SAP 六个静态 DLC Pack、Arena Normal、私有文字版

## 证据等级

- **A：规则页面明确**：SAP Wiki 当前页面直接说明。
- **B：公开观测交叉验证**：Wiki、社区概率表或多个独立说明一致。
- **C：实现近似**：公开规则只描述结果，隐藏顺序或概率未完全公开。
- **D：待 Oracle**：必须用目标版本实机录制或差分测试确认。

## 目标版本

当前可玩基线是 **2026-11-27 时公开的 Turtle Pack Normal 规则**；Wiki 最后记录的
公开版本为 **0.48（2026-05-21）**。当前私有内容哈希为：

- 宠物：`0A0E44238477151BEB80A998EF45633F160F43266ADB9D8DE0F463ACBE2FC074`
- 食物：`CB34C5BF9AE2C6B30B23327F816ABCDDA10D23D6CF3ACBB71C02A2C69AF8442D`

还没有绑定具体客户端构建哈希，下一步必须补充：

- 平台和游戏版本；
- 内容清单哈希；
- 采集日期；
- 对应 replay/fixture 版本。

## 机制矩阵

| 机制 | 状态 | 证据 | 当前实现 | 剩余风险 |
| --- | --- | --- | --- | --- |
| 10 胜 / 5 命 | 已对齐 | A | `run.ts` | 无 |
| 平局不扣命/不加胜 | 已对齐 | A | `run.ts` | 无 |
| 第 3 回合补命 | 已对齐 | A | `run.ts` | 无 |
| 10 金 | 已对齐 | A | `run.ts` | 无 |
| 商店宠物槽 3/3/4/4/5/5 | 已对齐 | B | `petShopCapacity` | 无 |
| 普通食物槽 1/1/2/2/2/2 | 已对齐 | B | `ordinaryFoodShopCapacity` | 无 |
| 2 个生成食物槽 | 已对齐容量与右侧位置 | A/B | `ShopState.foods` | 冻结、满槽多源冲突仍需 Oracle |
| Worm 生成 Apple | 优先最右生成槽 | A/B | `stockWormFood` | 多 Worm 与全冻结边界待 Oracle |
| Cow Milk / Chocolate Milk | 最右两格并补触发顺序 | A/B | `replaceShopFoodWithTwoMilk` | 跨奖励对象的像素级占位待 Oracle |
| 3 金基础价格 | 已对齐；“Always on sale”按特价解释 | A | `content.ts` / `randomFoodPool` | 特殊价格需逐项维护 |
| 刷新 1 金、冻结免费 | 已对齐 | A | `run.ts` | 冻结排序细节待验证 |
| 出售价值等于等级 | 已对齐 | A/B | `sellValueForPet` | 特殊修正需逐项测试 |
| 满队购买限制 | 已对齐 | A | `buyPet` | 奖励宠物与普通宠物共用该规则 |
| Bison 结束回合成长 | 已对齐“另一只 Lv.3 友方”条件 | A | `runEndTurnAbilities` | 多 Bison 只触发一只 |
| 2/3 XP 升级 | 已补巧克力 Lv.2→3 与 Lv.1→3 双升级 | A | `gainExperience` / `completeLevelUp` | 无 |
| 升级二选一 | 已补来源记录与 UI 归属 | A/B | `levelUps` / `rewardPets` | 满槽和复杂生成物占位待 Oracle |
| 单 Perk | 已对齐 | A | `pet.perks` | 复杂覆盖/合并边界待补 |
| Perk/食物词条说明 | 已实现名称、完整效果、上下文消歧和动画稳定弹层 | A | `perkGlossary` / `foodGlossary` | 无 |
| 金币变化反馈 | 商店内显示余额与正负变化 | A | `shop-gold` / `animateGoldChange` | 无 |
| 商店刷新选中状态 | 非破坏性刷新保留队伍选中 | A | `rollButton` | 无 |
| 伤害日志数值 | 按 Perk 减免后的实际伤害记录 | A | `applyDamage` | 特殊嵌套伤害继续补 fixture |
| 攻击者攻击力优先触发 | 已对齐 | B | `orderByOwnerAttack` | — |
| 同攻击种子平局 | 已对齐战斗部分 | B/C | 独立 `trigger-order` 流 | 商店触发也需更多 fixture |
| Hurt 先于 Faint | 已对齐 | B | hurt batch + death queue | 多死亡嵌套仍待补 |
| 同时攻击都执行 | 已对齐 | A/B | `runAttackRound` | 复杂触发嵌套待补 |
| 召唤上限 5 | 已对齐主路径 | B | `summon` | 特殊占位和顺序待补 |
| 战斗回放召唤站位 | 已按事件位置展示并自动补位 | A | `settleBattleBoard` | 无 |
| Whale 多次吞入 | 已补队列 | B/C | `swallowed[]` | 释放容量和嵌套 Whale 待 Oracle |
| Tiger 重复技能 | 主路径已实现 | B/C | `extraAbilities` | 有限次数、链式 Tiger、复制记忆待补 |
| Parrot 复制技能 | 主路径已实现 | B/C | `copiedAbility` | 复制链、升级与清理边界待补 |
| Badger 相邻目标 | 近似 | C | 位置差 1 目标 | 目标集合需实机 Oracle |
| 商店阶段 Faint | 主路径已补伤害/召唤/朋友倒下 | B | `triggerShopFaint` | Rat 对手侧目标与极端嵌套顺序待 Oracle |
| Ghost 第 1 回合 3 宠 | 已对齐 | A | `generateGhostTeam` | 隐藏选宠顺序待补 |
| Ghost 第 2 回合起 5 宠 | 已对齐 | A | `generateGhostTeam` | — |
| Ghost 行动点 1/2/4/6 | 已对齐数量 | A | `ghostActionPointsForTurn` | 类型选择概率和顺序待 Oracle |
| 幽灵匹配同回合/同胜场 | 已对齐过滤 | A | `selectGhost` | 生命接近的精确阈值待补 |
| 战斗回放对手来源 | 已记录真实快照/系统 Ghost | A | `BattleReplayData` | 无 |
| 共享幽灵文件并发 | 已串行化并去重分桶 | B | `withGhostLock` / `compactGhosts` | 仍是单进程回退 |
| 共享 Ghost 池 | 已实现 JSON + PostgreSQL | A/B | `FileGhostPool` / `PostgresGhostPool` | 需继续做同版本实机压力测试 |
| 真实多人异步池 | 已支持共享快照 | B | `ghost_snapshots` | 需要继续加账户/对局事务 |
| Arena Easy/Hard | 未实现 | — | Normal only | 不在当前范围 |
| Versus/With Friends | 未实现 | — | — | 不在当前范围 |
| 成就/收藏/红丝带持久化 | 展示层部分 | A | 胜利结算 | 没有账户级收藏 |
| 结算最终阵容 | 已展示完整只读队伍卡 | A | `renderFinalPetCard` | 无 |
| 已开放 Pack 的全部技能等级 | Turtle 有执行入口 | — | `battle.ts` / `run.ts` | 未逐条差分验证 |
| 六 Pack 数据加载 | 已接入 | A | `content.ts` / `packs.ts` | 非 Turtle 内容仍需固定版本 |
| Pack 内容版本隔离 | 已接入 | A | `RunState.contentVersion` | 首次开放前生成并冻结 |
| Pack Ghost 隔离 | 已接入 | A | `selectGhost` / PostgreSQL | 按 Pack 和内容版本双过滤 |
| DLC 新状态机 | 未完成 | — | — | Toy、Ailment、Trumpet、Mana、Transform 等 |

## DLC 执行器状态

| Pack | 数据 | 战斗技能 | 商店技能 | 新食物/Perk | 可开放 |
| --- | --- | --- | --- | --- | --- |
| Turtle | 完成 | 完成 | 完成 | 完成 | 是 |
| Puppy | 完成 | 待实现 | 待实现 | 待实现 | 否 |
| Star | 完成 | 待实现 | 待实现 | 待实现 | 否 |
| Golden | 完成 | 待实现 | 待实现 | 待实现 | 否 |
| Unicorn | 完成 | 待实现 | 待实现 | 待实现 | 否 |
| Danger | 完成 | 待实现 | 待实现 | 待实现 | 否 |

## P0：继续实现顺序

1. 锁定一个可运行 SAP 构建和内容哈希。
2. 为触发队列建立 golden fixtures：
   - 多 Hurt；
   - 多 Faint；
   - 同时召唤；
   - Hurt/Faint 交叉；
   - Tiger/Parrot 复制链；
   - Whale 多吞入和释放。
3. 修正 Badger 相邻目标与商店阶段伤害链。
4. 对升级奖励和 Cow/Milk 与奖励的精确占位建立 Oracle fixture。
5. 建立 Ghost 行动点差分测试，确认 Perk/XP/属性选择概率。
6. 已完成 PostgreSQL 共享幽灵池；下一步补账户/对局事务和多实例会话存储。

## 完成门槛

只有同时满足以下条件才可标记“完全复刻”：

- 目标版本固定并记录内容哈希。
- 每个可见机制都有来源和测试 ID。
- 每个开放 Pack 的技能等级至少各有一条 fixture；复杂技能有多条组合 fixture。
- 同种子差分回放逐事件一致。
- 商店、战斗、Ghost 和升级奖励不存在仅靠人工描述的近似。
- 外部实机 Oracle 结果全部通过。
