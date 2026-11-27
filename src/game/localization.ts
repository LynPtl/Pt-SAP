import type { PetLevel } from "./types.js";

export const PET_NAME_ZH: Record<string, string> = {
  Ant: "蚂蚁",
  Beaver: "海狸",
  Cricket: "蟋蟀",
  Duck: "鸭子",
  Fish: "鱼",
  Horse: "马",
  Mosquito: "蚊子",
  Otter: "水獭",
  Pig: "猪",
  Crab: "螃蟹",
  Flamingo: "火烈鸟",
  Hedgehog: "刺猬",
  Kangaroo: "袋鼠",
  Peacock: "孔雀",
  Rat: "老鼠",
  Snail: "蜗牛",
  Spider: "蜘蛛",
  Swan: "天鹅",
  Worm: "蠕虫",
  Badger: "獾",
  Camel: "骆驼",
  Dodo: "渡渡鸟",
  Dog: "狗",
  Dolphin: "海豚",
  Elephant: "大象",
  Giraffe: "长颈鹿",
  Ox: "牛",
  Rabbit: "兔子",
  Sheep: "羊",
  Bison: "野牛",
  Blowfish: "河豚",
  Deer: "鹿",
  Hippo: "河马",
  Parrot: "鹦鹉",
  Penguin: "企鹅",
  Skunk: "臭鼬",
  Squirrel: "松鼠",
  Turtle: "乌龟",
  Whale: "鲸鱼",
  Armadillo: "犰狳",
  Cow: "奶牛",
  Crocodile: "鳄鱼",
  Hippogriff: "鹰马",
  Monkey: "猴子",
  Rhino: "犀牛",
  Rooster: "公鸡",
  Scorpion: "蝎子",
  Seal: "海豹",
  Shark: "鲨鱼",
  Turkey: "火鸡",
  Boar: "野猪",
  Cat: "猫",
  Dragon: "龙",
  Fly: "苍蝇",
  Gorilla: "大猩猩",
  Leopard: "豹",
  Mammoth: "猛犸象",
  Snake: "蛇",
  Tiger: "老虎",
  Wolverine: "狼獾"
};

export const PET_ABILITY_ZH: Record<
  string,
  readonly [string, string, string]
> = {
  Ant: [
    "倒下时：随机一名友方获得 +1 攻击和 +1 生命。",
    "倒下时：随机一名友方获得 +2 攻击和 +2 生命。",
    "倒下时：随机一名友方获得 +3 攻击和 +3 生命。"
  ],
  Beaver: [
    "出售时：随机两名友方获得 +1 攻击。",
    "出售时：随机两名友方获得 +2 攻击。",
    "出售时：随机两名友方获得 +3 攻击。"
  ],
  Cricket: [
    "倒下时：召唤一只 1/1 的僵尸蟋蟀。",
    "倒下时：召唤一只 2/2 的僵尸蟋蟀。",
    "倒下时：召唤一只 3/3 的僵尸蟋蟀。"
  ],
  Duck: [
    "出售时：商店中的宠物获得 +1 生命。",
    "出售时：商店中的宠物获得 +2 生命。",
    "出售时：商店中的宠物获得 +3 生命。"
  ],
  Fish: [
    "升级时：两名友方获得 +1 攻击和 +1 生命。",
    "升级时：两名友方获得 +2 攻击和 +2 生命。",
    "无技能。"
  ],
  Horse: [
    "友方被召唤时：使其获得 +1 攻击，直到下回合。",
    "友方被召唤时：使其获得 +2 攻击，直到下回合。",
    "友方被召唤时：使其获得 +3 攻击，直到下回合。"
  ],
  Mosquito: [
    "战斗开始时：对一名随机敌人造成 1 点伤害。",
    "战斗开始时：对两名随机敌人各造成 1 点伤害。",
    "战斗开始时：对三名随机敌人各造成 1 点伤害。"
  ],
  Otter: [
    "购买时：随机一名友方获得 +1 生命。",
    "购买时：随机两名友方各获得 +1 生命。",
    "购买时：随机三名友方各获得 +1 生命。"
  ],
  Pig: [
    "出售时：获得 +1 金币。",
    "出售时：获得 +2 金币。",
    "出售时：获得 +3 金币。"
  ],
  Crab: [
    "战斗开始时：获得等同于生命最高友方 25% 的生命。",
    "战斗开始时：获得等同于生命最高友方 50% 的生命。",
    "战斗开始时：获得等同于生命最高友方 75% 的生命。"
  ],
  Flamingo: [
    "倒下时：后方最近的两名友方各获得 +1 攻击和 +1 生命。",
    "倒下时：后方最近的两名友方各获得 +2 攻击和 +2 生命。",
    "倒下时：后方最近的两名友方各获得 +3 攻击和 +3 生命。"
  ],
  Hedgehog: [
    "倒下时：对所有宠物造成 2 点伤害。",
    "倒下时：对所有宠物造成 4 点伤害。",
    "倒下时：对所有宠物造成 6 点伤害。"
  ],
  Kangaroo: [
    "前方友方攻击时：获得 +1 攻击和 +1 生命。",
    "前方友方攻击时：获得 +2 攻击和 +2 生命。",
    "前方友方攻击时：获得 +3 攻击和 +3 生命。"
  ],
  Peacock: [
    "受伤时：获得 +3 攻击。",
    "受伤时：获得 +6 攻击。",
    "受伤时：获得 +9 攻击。"
  ],
  Rat: [
    "倒下时：为对手前排召唤一只 1/1 的脏老鼠。不会触发召唤技能。",
    "倒下时：为对手前排召唤两只 1/1 的脏老鼠。不会触发召唤技能。",
    "倒下时：为对手前排召唤三只 1/1 的脏老鼠。不会触发召唤技能。"
  ],
  Snail: [
    "回合结束时：如果上一场战斗失败，前方最近的三名友方各获得 +1 攻击。",
    "回合结束时：如果上一场战斗失败，前方最近的三名友方各获得 +2 攻击。",
    "回合结束时：如果上一场战斗失败，前方最近的三名友方各获得 +3 攻击。"
  ],
  Spider: [
    "倒下时：随机召唤一只 3 阶宠物，并使其成为 2/2 的 1 级宠物。",
    "倒下时：随机召唤一只 3 阶宠物，并使其成为 4/4 的 2 级宠物。",
    "倒下时：随机召唤一只 3 阶宠物，并使其成为 6/6 的 3 级宠物。"
  ],
  Swan: [
    "回合开始时：获得 +1 金币。",
    "回合开始时：获得 +2 金币。",
    "回合开始时：获得 +3 金币。"
  ],
  Worm: [
    "回合开始时：上架一个价值 2 金的 1 级苹果。",
    "回合开始时：上架一个价值 2 金的 2 级苹果。",
    "回合开始时：上架一个价值 2 金的 3 级苹果。"
  ],
  Badger: [
    "倒下时：对相邻宠物造成本宠物攻击力 50% 的伤害。",
    "倒下时：对相邻宠物造成本宠物攻击力 100% 的伤害。",
    "倒下时：对相邻宠物造成本宠物攻击力 150% 的伤害。"
  ],
  Camel: [
    "受伤时：后方最近的友方获得 +1 攻击和 +2 生命。",
    "受伤时：后方最近的友方获得 +2 攻击和 +4 生命。",
    "受伤时：后方最近的友方获得 +3 攻击和 +6 生命。"
  ],
  Dodo: [
    "战斗开始时：将自身 50% 的攻击力给予前方最近的友方。",
    "战斗开始时：将自身 100% 的攻击力给予前方最近的友方。",
    "战斗开始时：将自身 150% 的攻击力给予前方最近的友方。"
  ],
  Dog: [
    "友方被召唤时：获得 +2 攻击和 +1 生命，直到战斗结束。",
    "友方被召唤时：获得 +4 攻击和 +2 生命，直到战斗结束。",
    "友方被召唤时：获得 +6 攻击和 +3 生命，直到战斗结束。"
  ],
  Dolphin: [
    "战斗开始时：对生命最低的敌人造成 4 点伤害。",
    "战斗开始时：对生命最低的敌人造成 4 点伤害，触发 2 次。",
    "战斗开始时：对生命最低的敌人造成 4 点伤害，触发 3 次。"
  ],
  Elephant: [
    "攻击后：对后方最近的友方造成 1 点伤害。",
    "攻击后：对后方最近的友方造成 1 点伤害，触发 2 次。",
    "攻击后：对后方最近的友方造成 1 点伤害，触发 3 次。"
  ],
  Giraffe: [
    "回合开始时：前方最近的一名友方获得 +1 攻击和 +1 生命。",
    "回合开始时：前方最近的两名友方获得 +1 攻击和 +1 生命。",
    "回合开始时：前方最近的三名友方获得 +1 攻击和 +1 生命。"
  ],
  Ox: [
    "前方友方倒下时：获得西瓜 Perk 和 +1 攻击。每回合生效 1 次。",
    "前方友方倒下时：获得西瓜 Perk 和 +1 攻击。每回合生效 2 次。",
    "前方友方倒下时：获得西瓜 Perk 和 +1 攻击。每回合生效 3 次。"
  ],
  Rabbit: [
    "友方吃食物时：使其获得 +1 生命。每回合生效 3 次。",
    "友方吃食物时：使其获得 +2 生命。每回合生效 3 次。",
    "友方吃食物时：使其获得 +3 生命。每回合生效 3 次。"
  ],
  Sheep: [
    "倒下时：召唤两只 2/2 的公羊。",
    "倒下时：召唤两只 4/4 的公羊。",
    "倒下时：召唤两只 6/6 的公羊。"
  ],
  Bison: [
    "回合结束时：若有一名 3 级友方，获得 +2 攻击和 +2 生命。仅对一只野牛生效。",
    "回合结束时：若有一名 3 级友方，获得 +4 攻击和 +4 生命。仅对一只野牛生效。",
    "回合结束时：若有一名 3 级友方，获得 +6 攻击和 +6 生命。仅对一只野牛生效。"
  ],
  Blowfish: [
    "受伤时：对一名随机敌人造成 3 点伤害。",
    "受伤时：对一名随机敌人造成 6 点伤害。",
    "受伤时：对一名随机敌人造成 9 点伤害。"
  ],
  Deer: [
    "倒下时：召唤一辆携带辣椒 Perk 的 5/3 巴士。",
    "倒下时：召唤一辆携带辣椒 Perk 的 10/6 巴士。",
    "倒下时：召唤一辆携带辣椒 Perk 的 15/9 巴士。"
  ],
  Hippo: [
    "击倒时：获得 +3 攻击和 +3 生命。每场战斗生效 3 次。",
    "击倒时：获得 +6 攻击和 +6 生命。每场战斗生效 3 次。",
    "击倒时：获得 +9 攻击和 +9 生命。每场战斗生效 3 次。"
  ],
  Parrot: [
    "回合结束时：复制前方最近宠物的技能作为 1 级技能，直到下回合。",
    "回合结束时：复制前方最近宠物的技能作为 2 级技能，直到下回合。",
    "回合结束时：复制前方最近宠物的技能作为 3 级技能，直到下回合。"
  ],
  Penguin: [
    "回合开始时：随机两名 2 级或 3 级友方获得 +1 攻击和 +1 生命。",
    "回合开始时：随机两名 2 级或 3 级友方获得 +2 攻击和 +2 生命。",
    "回合开始时：随机两名 2 级或 3 级友方获得 +3 攻击和 +3 生命。"
  ],
  Skunk: [
    "战斗开始时：使生命最高的敌人失去 33% 的生命。",
    "战斗开始时：使生命最高的敌人失去 66% 的生命。",
    "战斗开始时：使生命最高的敌人失去 99% 的生命。"
  ],
  Squirrel: [
    "回合开始时：商店中所有食物价格降低 1 金。",
    "回合开始时：商店中所有食物价格降低 2 金。",
    "回合开始时：商店中所有食物价格降低 3 金。"
  ],
  Turtle: [
    "倒下时：后方最近的一名友方获得西瓜 Perk。",
    "倒下时：后方最近的两名友方获得西瓜 Perk。",
    "倒下时：后方最近的三名友方获得西瓜 Perk。"
  ],
  Whale: [
    "战斗开始时：吞下前方最近的友方；自己倒下时，将其以 1 级释放。",
    "战斗开始时：吞下前方最近的友方；自己倒下时，将其以 2 级释放。",
    "战斗开始时：吞下前方最近的友方；自己倒下时，将其以 3 级释放。"
  ],
  Armadillo: [
    "战斗开始时：所有宠物获得 +8 生命。",
    "战斗开始时：所有宠物获得 +16 生命。",
    "战斗开始时：所有宠物获得 +24 生命。"
  ],
  Cow: [
    "购买时：用两瓶免费的 1 级牛奶替换商店食物。",
    "购买时：用两瓶免费的 2 级牛奶替换商店食物。",
    "购买时：用两瓶免费的 3 级牛奶替换商店食物。"
  ],
  Crocodile: [
    "战斗开始时：对最后一名敌人造成 8 点伤害。",
    "战斗开始时：对最后一名敌人造成 8 点伤害，触发 2 次。",
    "战斗开始时：对最后一名敌人造成 8 点伤害，触发 3 次。"
  ],
  Hippogriff: [
    "倒下时：召唤一只下一阶宠物，属性为 5/5、等级为 1。友方被召唤时：使其获得 +1 攻击，直到下回合。",
    "倒下时：召唤一只下一阶宠物，属性为 10/10、等级为 2。友方被召唤时：使其获得 +2 攻击，直到下回合。",
    "倒下时：召唤一只下一阶宠物，属性为 15/15、等级为 3。友方被召唤时：使其获得 +3 攻击，直到下回合。"
  ],
  Monkey: [
    "回合结束时：最前方的友方获得 +2 攻击和 +2 生命。",
    "回合结束时：最前方的友方获得 +4 攻击和 +4 生命。",
    "回合结束时：最前方的友方获得 +6 攻击和 +6 生命。"
  ],
  Rhino: [
    "击倒时：对第一名敌人造成 4 点伤害；若目标为 1 阶宠物，伤害翻倍。",
    "击倒时：对第一名敌人造成 8 点伤害；若目标为 1 阶宠物，伤害翻倍。",
    "击倒时：对第一名敌人造成 12 点伤害；若目标为 1 阶宠物，伤害翻倍。"
  ],
  Rooster: [
    "倒下时：召唤一只小鸡，攻击力为本宠物的 50%，生命为 1。",
    "倒下时：召唤两只小鸡，攻击力为本宠物的 50%，生命为 1。",
    "倒下时：召唤三只小鸡，攻击力为本宠物的 50%，生命为 1。"
  ],
  Scorpion: [
    "被召唤时：获得花生 Perk。",
    "被召唤时：获得花生 Perk。",
    "被召唤时：获得花生 Perk。"
  ],
  Seal: [
    "吃食物时：随机三名友方获得 +1 攻击。",
    "吃食物时：随机三名友方获得 +2 攻击。",
    "吃食物时：随机三名友方获得 +3 攻击。"
  ],
  Shark: [
    "友方倒下时：获得 +2 攻击和 +2 生命。",
    "友方倒下时：获得 +4 攻击和 +4 生命。",
    "友方倒下时：获得 +6 攻击和 +6 生命。"
  ],
  Turkey: [
    "友方被召唤时：使其获得 +3 攻击和 +1 生命。",
    "友方被召唤时：使其获得 +6 攻击和 +2 生命。",
    "友方被召唤时：使其获得 +9 攻击和 +3 生命。"
  ],
  Boar: [
    "攻击前：获得 +4 攻击和 +2 生命。",
    "攻击前：获得 +8 攻击和 +4 生命。",
    "攻击前：获得 +12 攻击和 +6 生命。"
  ],
  Cat: [
    "商店食物提供的攻击和生命变为 2 倍。每回合生效 2 次。",
    "商店食物提供的攻击和生命变为 3 倍。每回合生效 2 次。",
    "商店食物提供的攻击和生命变为 4 倍。每回合生效 2 次。"
  ],
  Dragon: [
    "购买 1 阶友方时：所有友方获得 +1 攻击和 +1 生命。每回合生效 4 次。",
    "购买 1 阶友方时：所有友方获得 +2 攻击和 +2 生命。每回合生效 4 次。",
    "购买 1 阶友方时：所有友方获得 +3 攻击和 +3 生命。每回合生效 4 次。"
  ],
  Fly: [
    "友方倒下时：在其位置召唤一只 4/4 的僵尸苍蝇。每回合生效 3 次。",
    "友方倒下时：在其位置召唤一只 8/8 的僵尸苍蝇。每回合生效 3 次。",
    "友方倒下时：在其位置召唤一只 12/12 的僵尸苍蝇。每回合生效 3 次。"
  ],
  Gorilla: [
    "受伤时：获得椰子 Perk。每回合生效 1 次。",
    "受伤时：获得椰子 Perk。每回合生效 2 次。",
    "受伤时：获得椰子 Perk。每回合生效 3 次。"
  ],
  Leopard: [
    "战斗开始时：对一名随机敌人造成本宠物攻击力 50% 的伤害。",
    "战斗开始时：对两名随机敌人各造成本宠物攻击力 50% 的伤害。",
    "战斗开始时：对三名随机敌人各造成本宠物攻击力 50% 的伤害。"
  ],
  Mammoth: [
    "倒下时：所有友方获得 +2 攻击和 +2 生命。",
    "倒下时：所有友方获得 +4 攻击和 +4 生命。",
    "倒下时：所有友方获得 +6 攻击和 +6 生命。"
  ],
  Snake: [
    "前方友方攻击时：对一名随机敌人造成 5 点伤害。每回合生效 5 次。",
    "前方友方攻击时：对一名随机敌人造成 10 点伤害。每回合生效 5 次。",
    "前方友方攻击时：对一名随机敌人造成 15 点伤害。每回合生效 5 次。"
  ],
  Tiger: [
    "战斗中的前方友方会以 1 级再次触发其技能。",
    "战斗中的前方友方会以 2 级再次触发其技能。",
    "战斗中的前方友方会以 3 级再次触发其技能。"
  ],
  Wolverine: [
    "4 名友方受伤时：使所有敌人失去 3 点生命。",
    "4 名友方受伤时：使所有敌人失去 6 点生命。",
    "4 名友方受伤时：使所有敌人失去 9 点生命。"
  ]
};

export const FOOD_NAME_ZH: Record<string, string> = {
  apple: "苹果",
  honey: "蜂蜜",
  cupcake: "纸杯蛋糕",
  "meat-bone": "肉骨头",
  "sleeping-pill": "安眠药",
  cake: "蛋糕",
  garlic: "大蒜",
  "salad-bowl": "沙拉碗",
  "canned-food": "罐头食品",
  pear: "梨",
  chili: "辣椒",
  chocolate: "巧克力",
  sushi: "寿司",
  melon: "西瓜",
  mushroom: "蘑菇",
  pizza: "披萨",
  steak: "牛排",
  "bread-crumbs": "面包屑",
  milk: "牛奶",
  "chocolate-milk": "巧克力奶",
  coconut: "椰子",
  peanut: "花生"
};

export const FOOD_TEXT_ZH: Record<string, string> = {
  apple: "使一只宠物获得 +1 攻击和 +1 生命。",
  honey: "使一只宠物获得蜂蜜 Perk。倒下时：召唤一只 1/1 蜜蜂。",
  cupcake: "使一只宠物获得 +3 攻击和 +3 生命，直到战斗结束。",
  "meat-bone": "使一只宠物获得肉骨头 Perk。攻击时额外造成 +3 伤害。",
  "sleeping-pill": "使一只宠物倒下。始终在售！",
  cake: "使一只宠物获得蛋糕 Perk。回合结束时：出售价值增加 1 金。",
  garlic: "使一只宠物获得大蒜 Perk。受到的伤害减少 2 点。",
  "salad-bowl": "随机两只宠物获得 +1 攻击和 +1 生命。",
  "canned-food": "商店中当前和未来的所有宠物获得 +1 攻击和 +1 生命。",
  pear: "使一只宠物获得 +2 攻击和 +2 生命。",
  chili: "使一只宠物获得辣椒 Perk。攻击第二只敌人并造成 5 点伤害。",
  chocolate: "使一只宠物获得 1 点经验。",
  sushi: "随机三只宠物获得 +1 攻击和 +1 生命。",
  melon: "使一只宠物获得西瓜 Perk。一次性减少 20 点伤害。",
  mushroom: "使一只宠物获得蘑菇 Perk。倒下时：以 1/1 复活。",
  pizza: "随机两只宠物获得 +2 攻击和 +2 生命。",
  steak: "使一只宠物获得牛排 Perk。一次攻击额外造成 +20 伤害。",
  "bread-crumbs": "使一只宠物获得 +1 攻击。",
  milk: "使一只宠物获得 1 级牛奶效果：+1 攻击和 +2 生命。",
  "chocolate-milk":
    "使一只宠物获得 1 级巧克力奶效果：+1 攻击。",
  coconut: "一次性免疫一次伤害。",
  peanut: "被本宠物攻击并受到伤害的宠物会被击倒。"
};

export const PERK_NAME_ZH: Record<string, string> = {
  honey: "蜂蜜",
  meatBone: "肉骨头",
  chili: "辣椒",
  cake: "蛋糕",
  garlic: "大蒜",
  melon: "西瓜",
  mushroom: "蘑菇",
  steak: "牛排",
  coconut: "椰子",
  peanut: "花生"
};

export function petNameZh(name: string): string {
  return PET_NAME_ZH[name] ?? name;
}

export function petAbilityZh(
  petName: string,
  level: PetLevel,
  fallback: string
): string {
  return PET_ABILITY_ZH[petName]?.[level - 1] ?? fallback;
}

export function foodNameZh(id: string, fallback: string): string {
  return FOOD_NAME_ZH[id] ?? fallback;
}

export function foodTextZh(id: string, fallback: string): string {
  return FOOD_TEXT_ZH[id] ?? fallback;
}

export function perkNameZh(id: string): string {
  return PERK_NAME_ZH[id] ?? id;
}

export function battleLogLineZh(line: string): string {
  return localizePetNames(localizeBattleBody(line));
}

function localizeBattleBody(line: string): string {
  const body = line.startsWith("[战斗] ")
    ? line.slice("[战斗] ".length)
    : line;
  const fixed: Record<string, string> = {
    "Battle started.": "战斗开始。",
    "Player wins.": "你赢得了战斗。",
    "Player loses.": "你输掉了战斗。",
    "Battle is a draw.": "双方战平。"
  };
  if (fixed[body]) return fixed[body];

  let match = body.match(
    /^(.+) levels up to (\d) and receives a tier (\d) level-up reward choice\.$/
  );
  if (match) {
    return `${match[1]} 升至 Lv.${match[2]}，获得 ${match[3]} 阶升级候选（二选一）。`;
  }
  match = body.match(
    /^(.+) reaches level 3 by merging two level-2 pets; no level-up reward is offered\.$/
  );
  if (match) {
    return `${match[1]} 由两只 2 级宠物合并升至 Lv.3，本次不提供升级候选。`;
  }
  match = body.match(/^(.+) levels up to (\d)\.$/);
  if (match) return `${match[1]} 升至 Lv.${match[2]}。`;

  match = body.match(/^(.+) attacks (.+) for (\d+)\.$/);
  if (match) return `${match[1]} 攻击 ${match[2]}，造成 ${match[3]} 点伤害。`;
  match = body.match(
    /^(.+) takes (\d+) (attack|ability) damage and is at (\d+) health\.$/
  );
  if (match) {
    return `${match[1]} 受到 ${match[2]} 点${match[3] === "attack" ? "攻击" : "技能"}伤害，剩余 ${match[4]} 生命。`;
  }
  match = body.match(/^(.+) faints\.$/);
  if (match) return `${match[1]} 倒下。`;
  match = body.match(/^(.+) gains \+(-?\d+)\/\+(-?\d+) from (.+)\.$/);
  if (match) {
    return `${match[1]} 因 ${match[4]} 获得 +${match[2]} 攻击和 +${match[3]} 生命。`;
  }
  match = body.match(/^(.+) is summoned at position (\d+)\.$/);
  if (match) return `${match[1]} 被召唤到第 ${match[2]} 位。`;
  match = body.match(/^(.+) cannot be summoned because the board is full\.$/);
  if (match) return `${match[1]} 无法被召唤，因为场上已满。`;
  match = body.match(/^(.+) lets (.+) repeat its ability at level (\d)\.$/);
  if (match) return `${match[1]} 让 ${match[2]} 以 ${match[3]} 级再次触发技能。`;
  match = body.match(/^(.+) swallows (.+)\.$/);
  if (match) return `${match[1]} 吞下了 ${match[2]}。`;
  match = body.match(/^(.+)'s Melon is consumed\.$/);
  if (match) return `${match[1]} 消耗了西瓜 Perk。`;
  match = body.match(/^(.+)'s Coconut blocks the damage\.$/);
  if (match) return `${match[1]} 使用椰子 Perk 挡住了伤害。`;
  match = body.match(/^(.+)'s Peanut knocks out (.+)\.$/);
  if (match) return `${match[1]} 的花生效果击倒了 ${match[2]}。`;
  match = body.match(/^(.+) gains ([a-zA-Z]+)\.$/);
  if (match) return `${match[1]} 获得了 ${match[2]} Perk。`;

  return body
    .replace(/^(.+)'s Mushroom revives it as a 1\/1\.$/, "$1 被蘑菇以 1/1 复活。")
    .replace(/^(.+)'s Chili burns (.+) for 5\.$/, "$1 的辣椒对 $2 造成 5 点伤害。");
}

function localizePetNames(text: string): string {
  let result = text;
  for (const [english, chinese] of Object.entries(PET_NAME_ZH).sort(
    (a, b) => b[0].length - a[0].length
  )) {
    result = result.replace(
      new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
      chinese
    );
  }
  return result;
}
