import { deriveSeed, SeededRandom } from "./rng.js";
import type {
  BattleEvent,
  BattleInput,
  BattleOutcome,
  BattlePet,
  BattleResult,
  BattleSide,
  BattleStateSnapshot,
  ContentBundle,
  PerkId,
  PerkState,
  PetInstance,
  PetLevel,
  PetTemplate
} from "./types.js";

const MAX_LOG_EVENTS = 5000;
const MAX_TEAM_SIZE = 5;

interface AbilityRef {
  templateId: string;
  level: PetLevel;
}

interface TriggerContext {
  source?: BattlePet;
  fainted?: BattlePet;
  summoned?: BattlePet;
  attacker?: BattlePet;
  sourceIndex?: number;
}

type TriggerKind =
  | "startOfBattle"
  | "beforeAttack"
  | "afterAttack"
  | "hurt"
  | "faint"
  | "knockOut"
  | "friendFaint"
  | "friendSummoned"
  | "friendAheadAttack"
  | "friendHurt";

function levelNumber(level: PetLevel): PetLevel {
  return level;
}

function maxStat(value: number): number {
  return Math.min(50, value);
}

function alive(pet: BattlePet): boolean {
  return pet.health > 0;
}

function clonePet(pet: PetInstance, side: BattleSide): BattlePet {
  return {
    uid: `${side}:${pet.uid}`,
    sourceUid: pet.uid,
    templateId: pet.templateId,
    name: pet.name,
    tier: pet.tier,
    level: pet.level,
    attack: maxStat(pet.attack + pet.battleStats.attack),
    health: maxStat(pet.health + pet.battleStats.health),
    side,
    perks: pet.perks.map((perk) => ({ ...perk })),
    copiedAbility: pet.copiedAbility
      ? {
          templateId: pet.copiedAbility.templateId,
          level: pet.copiedAbility.level
        }
      : null,
    extraAbilities: [],
    triggeredThisBattle: {},
    canTriggerSummonAbilities: true,
    swallowed: [],
    isToken: false,
    lastIndex: -1
  };
}

function tokenPet(options: {
  side: BattleSide;
  name: string;
  attack: number;
  health: number;
  tier?: 1 | 2 | 3 | 4 | 5 | 6;
  level?: PetLevel;
  templateId?: string;
  canTriggerSummonAbilities?: boolean;
}): BattlePet {
  return {
    uid: "pending-token",
    sourceUid: "token",
    templateId: options.templateId ?? options.name.toLowerCase().replace(/\W+/g, "-"),
    name: options.name,
    tier: options.tier ?? 1,
    level: options.level ?? 1,
    attack: maxStat(options.attack),
    health: maxStat(options.health),
    side: options.side,
    perks: [],
    copiedAbility: null,
    extraAbilities: [],
    triggeredThisBattle: {},
    canTriggerSummonAbilities:
      options.canTriggerSummonAbilities ?? false,
    swallowed: [],
    isToken: true,
    lastIndex: -1
  };
}

class BattleSim {
  private readonly content: ContentBundle;
  private readonly rng: SeededRandom;
  private readonly triggerRng: SeededRandom;
  private readonly boards: Record<BattleSide, BattlePet[]>;
  private readonly events: BattleEvent[] = [];
  private readonly dying = new Map<string, BattlePet>();
  private readonly fallen: BattlePet[] = [];
  private readonly pendingHurts: Array<{
    target: BattlePet;
    source: BattlePet | null;
  }> = [];
  private sequence = 0;
  private triggerBudget = 0;
  private tokenCounter = 0;
  private flushingHurts = false;

  constructor(
    input: BattleInput,
    content: ContentBundle
  ) {
    this.content = content;
    this.rng = new SeededRandom(deriveSeed(input.seed, "battle"));
    this.triggerRng = new SeededRandom(
      deriveSeed(input.seed, "trigger-order")
    );
    this.boards = {
      player: input.playerTeam.slice(0, MAX_TEAM_SIZE).map((pet) =>
        clonePet(pet, "player")
      ),
      enemy: input.enemyTeam.slice(0, MAX_TEAM_SIZE).map((pet) =>
        clonePet(pet, "enemy")
      )
    };
    this.syncIndexes();
  }

  run(): BattleResult {
    this.log("battleStart", null, null, [], "Battle started.");
    this.installTigerRepeats();
    this.runStartOfBattle();
    this.resolveDeaths();

    let round = 0;
    while (this.living("player").length > 0 && this.living("enemy").length > 0) {
      round++;
      if (round > 200) {
        this.warn("Battle exceeded 200 attack rounds and was stopped.");
        break;
      }
      this.runAttackRound();
      this.resolveDeaths();
    }

    const playerSurvivors = this.living("player").length;
    const enemySurvivors = this.living("enemy").length;
    const outcome: BattleOutcome =
      playerSurvivors > 0 && enemySurvivors === 0
        ? "win"
        : enemySurvivors > 0 && playerSurvivors === 0
          ? "loss"
          : "draw";
    this.log(
      "battleEnd",
      null,
      null,
      [],
      outcome === "win"
        ? "Player wins."
        : outcome === "loss"
          ? "Player loses."
          : "Battle is a draw.",
      { outcome, playerSurvivors, enemySurvivors }
    );
    return {
      outcome,
      events: this.events,
      playerSurvivors,
      enemySurvivors
    };
  }

  private installTigerRepeats(): void {
    const all = [...this.boards.player, ...this.boards.enemy];
    for (const tiger of all) {
      const effective = this.baseAbility(tiger);
      const template = this.template(effective.templateId);
      if (template.title !== "Tiger") continue;
      const ahead = this.nearestFriendAhead(tiger);
      if (!ahead) continue;
      const copied = this.baseAbility(ahead);
      ahead.extraAbilities.push({
        templateId: copied.templateId,
        level: tiger.level
      });
      this.log(
        "trigger",
        tiger.side,
        tiger,
        [ahead.uid],
        `${tiger.name} lets ${ahead.name} repeat its ability at level ${tiger.level}.`
      );
    }
  }

  private runStartOfBattle(): void {
    const candidates = [
      ...this.living("player"),
      ...this.living("enemy")
    ].filter((pet) =>
      this.abilities(pet).some((ability) =>
        this.template(ability.templateId).abilities[
          levelNumber(ability.level) - 1
        ].toLowerCase().includes("start of battle")
      )
    );
    const orderedCandidates = this.priority(candidates);

    for (const pet of orderedCandidates) {
      for (const ability of this.abilities(pet)) {
        if (this.abilityText(ability).toLowerCase().includes("start of battle")) {
          this.callAbility(pet, ability, "startOfBattle");
        }
      }
    }
  }

  private runAttackRound(): void {
    const playerFront = this.living("player")[0];
    const enemyFront = this.living("enemy")[0];
    if (!playerFront || !enemyFront) return;

    const attackOrder = this.priority([playerFront, enemyFront]);
    for (const pet of attackOrder) this.notifyBeforeAttack(pet);
    if (!alive(playerFront) || !alive(enemyFront)) {
      this.resolveDeaths();
      return;
    }

    const playerAttack = this.attackValue(playerFront);
    const enemyAttack = this.attackValue(enemyFront);
    this.log(
      "attack",
      "player",
      playerFront,
      [enemyFront.uid],
      `${playerFront.name} attacks ${enemyFront.name} for ${playerAttack}.`,
      { attack: playerAttack }
    );
    this.log(
      "attack",
      "enemy",
      enemyFront,
      [playerFront.uid],
      `${enemyFront.name} attacks ${playerFront.name} for ${enemyAttack}.`,
      { attack: enemyAttack }
    );
    const enemyDamage = this.applyDamage(
      enemyFront,
      playerAttack,
      playerFront,
      "attack"
    );
    const playerDamage = this.applyDamage(
      playerFront,
      enemyAttack,
      enemyFront,
      "attack"
    );

    this.flushHurtTriggers();
    if (enemyFront.health <= 0) this.notifyKnockOut(playerFront, enemyFront);
    if (playerFront.health <= 0) this.notifyKnockOut(enemyFront, playerFront);
    this.afterMainAttack(playerFront, enemyFront, enemyDamage > 0);
    this.afterMainAttack(enemyFront, playerFront, playerDamage > 0);
    this.flushHurtTriggers();
    for (const pet of attackOrder) this.notifyAfterAttack(pet);
    for (const pet of attackOrder) this.notifyFriendAheadAttacked(pet);
    this.flushHurtTriggers();

    this.resolveDeaths();
    this.consumeAttackPerks(playerFront);
    this.consumeAttackPerks(enemyFront);
    this.syncIndexes();
  }

  private notifyBeforeAttack(pet: BattlePet): void {
    for (const ability of this.abilities(pet)) {
      if (this.abilityText(ability).toLowerCase().includes("before attack")) {
        this.callAbility(pet, ability, "beforeAttack");
      }
    }
  }

  private afterMainAttack(
    attacker: BattlePet,
    target: BattlePet,
    targetWasHurt: boolean
  ): void {
    const chili = this.perk(attacker, "chili");
    if (chili) {
      const enemies = this.living(this.opponent(attacker.side));
      const second = enemies[1] ?? enemies[0];
      if (second) {
        this.log(
          "trigger",
          attacker.side,
          attacker,
          [second.uid],
          `${attacker.name}'s Chili burns ${second.name} for 5.`
        );
        this.applyDamage(second, 5, attacker, "ability");
      }
    }

    const peanut = this.perk(attacker, "peanut");
    if (peanut && alive(target) && targetWasHurt) {
      this.log(
        "trigger",
        attacker.side,
        attacker,
        [target.uid],
        `${attacker.name}'s Peanut knocks out ${target.name}.`
      );
      this.markDying(target);
    }
  }

  private consumeAttackPerks(pet: BattlePet): void {
    const steak = this.perk(pet, "steak");
    if (steak && steak.uses !== null) {
      steak.uses--;
      if (steak.uses <= 0) this.removePerk(pet, "steak");
    }
  }

  private attackValue(pet: BattlePet): number {
    let attack = pet.attack;
    if (this.perk(pet, "meatBone")) attack += 3;
    if (this.perk(pet, "steak")) attack += 20;
    return Math.max(0, attack);
  }

  private notifyAfterAttack(pet: BattlePet): void {
    for (const ability of this.abilities(pet)) {
      if (this.abilityText(ability).toLowerCase().includes("after attack")) {
        this.callAbility(pet, ability, "afterAttack");
      }
    }
  }

  private notifyFriendAheadAttacked(attacker: BattlePet): void {
    for (const friend of this.priority(this.living(attacker.side))) {
      if (friend.uid === attacker.uid) continue;
      if (!this.isBehind(friend, attacker)) continue;
      for (const ability of this.abilities(friend)) {
        if (
          this.abilityText(ability)
            .toLowerCase()
            .includes("friend ahead attacks")
        ) {
          this.callAbility(friend, ability, "friendAheadAttack", {
            attacker
          });
        }
      }
    }
  }

  private applyDamage(
    target: BattlePet,
    rawDamage: number,
    source: BattlePet | null,
    damageKind: "attack" | "ability"
  ): number {
    if (!alive(target) || rawDamage <= 0) return 0;
    let damage = Math.max(0, Math.floor(rawDamage));

    const garlic = this.perk(target, "garlic");
    if (garlic) damage = Math.max(0, damage - 2);

    const melon = this.perk(target, "melon");
    if (melon && damage > 0) {
      damage = Math.max(0, damage - 20);
      this.removePerk(target, "melon");
      this.log(
        "perk",
        target.side,
        target,
        [],
        `${target.name}'s Melon is consumed.`
      );
    }

    const coconut = this.perk(target, "coconut");
    if (coconut && damage > 0) {
      damage = 0;
      this.removePerk(target, "coconut");
      this.log(
        "perk",
        target.side,
        target,
        [],
        `${target.name}'s Coconut blocks the damage.`
      );
    }

    if (damage <= 0) return 0;
    target.health -= damage;
    this.log(
      "damage",
      target.side,
      source,
      [target.uid],
      `${target.name} takes ${damage} ${damageKind} damage and is at ${Math.max(0, target.health)} health.`,
      { damage, health: Math.max(0, target.health) }
    );

    this.pendingHurts.push({ target, source });

    if (target.health <= 0) {
      const mushroom = this.perk(target, "mushroom");
      if (mushroom) {
        this.removePerk(target, "mushroom");
        target.health = 1;
        target.attack = 1;
        this.log(
          "trigger",
          target.side,
          target,
          [],
          `${target.name}'s Mushroom revives it as a 1/1.`
        );
      } else {
        this.markDying(target);
      }
    }
    return damage;
  }

  private notifyHurt(target: BattlePet, source: BattlePet | null): void {
    for (const ability of this.abilities(target)) {
      if (this.abilityText(ability).toLowerCase().includes("hurt")) {
        this.callAbility(target, ability, "hurt", { source: source ?? undefined });
      }
    }
  }

  private flushHurtTriggers(): void {
    if (this.flushingHurts) return;
    this.flushingHurts = true;
    try {
      while (this.pendingHurts.length > 0) {
        const batch = this.pendingHurts.splice(0);
        const orderedBatch = this.orderByOwnerAttack(
          batch,
          (entry) => entry.target
        );
        for (const { target, source } of orderedBatch) {
          if (!alive(target)) continue;
          this.notifyHurt(target, source);
          this.notifyFriendHurt(target);
        }
      }
    } finally {
      this.flushingHurts = false;
    }
  }

  private notifyFriendHurt(hurt: BattlePet): void {
    for (const friend of this.priority(this.living(hurt.side))) {
      if (friend.uid === hurt.uid) continue;
      for (const ability of this.abilities(friend)) {
        if (
          this.abilityText(ability)
            .toLowerCase()
            .includes("four friends hurt")
        ) {
          this.callAbility(friend, ability, "friendHurt", {
            source: hurt
          });
        }
      }
    }
  }

  private markDying(pet: BattlePet): void {
    if (!alive(pet) && !this.dying.has(pet.uid)) {
      this.dying.set(pet.uid, pet);
    }
  }

  private resolveDeaths(): void {
    let passes = 0;
    while (this.dying.size > 0) {
      passes++;
      if (passes > 200) {
        this.warn("Faint recursion exceeded 200 passes.");
        this.dying.clear();
        return;
      }
      const entries = [...this.dying.values()];
      this.dying.clear();
      const orderedEntries = this.priority(entries);
      const removed: BattlePet[] = [];
      for (const pet of orderedEntries) {
        if (pet.health > 0) continue;
        const board = this.boards[pet.side];
        const index = board.findIndex((entry) => entry.uid === pet.uid);
        if (index < 0) continue;
        pet.lastIndex = index;
        board.splice(index, 1);
        this.fallen.push(pet);
        this.syncIndexes();
        this.log(
          "faint",
          pet.side,
          pet,
          [],
          `${pet.name} faints.`,
          { position: index }
        );
        removed.push(pet);
      }
      for (const pet of removed) {
        this.onFaint(pet);
        this.notifyFriendFainted(pet);
      }
    }
  }

  private onFaint(pet: BattlePet): void {
    const honey = this.perk(pet, "honey");
    if (honey) {
      this.summon(
        pet.side,
        tokenPet({
          side: pet.side,
          name: "Bee",
          attack: 1,
          health: 1,
          tier: pet.tier,
          level: pet.level
        }),
        pet.lastIndex
      );
    }

    while (pet.swallowed.length > 0) {
      const swallowed = pet.swallowed.shift();
      if (!swallowed) break;
      this.summon(pet.side, swallowed, pet.lastIndex);
    }

    for (const ability of this.abilities(pet)) {
      if (this.abilityText(ability).toLowerCase().includes("faint")) {
        this.callAbility(pet, ability, "faint", {
          sourceIndex: pet.lastIndex
        });
      }
    }
  }

  private notifyFriendFainted(fainted: BattlePet): void {
    for (const friend of this.priority(this.living(fainted.side))) {
      for (const ability of this.abilities(friend)) {
        const text = this.abilityText(ability).toLowerCase();
        if (
          text.includes("friend faints") ||
          text.includes("friend ahead faints")
        ) {
          this.callAbility(friend, ability, "friendFaint", {
            fainted
          });
        }
      }
    }
  }

  private notifyKnockOut(attacker: BattlePet, target: BattlePet): void {
    for (const ability of this.abilities(attacker)) {
      const text = this.abilityText(ability).toLowerCase();
      if (text.includes("knock out")) {
        this.callAbility(attacker, ability, "knockOut", { source: target });
      }
    }
  }

  private callAbility(
    pet: BattlePet,
    ability: AbilityRef,
    trigger: TriggerKind,
    context: TriggerContext = {}
  ): void {
    this.triggerBudget++;
    if (this.triggerBudget > MAX_LOG_EVENTS) {
      this.warn("Trigger budget exhausted.");
      return;
    }
    const template = this.template(ability.templateId);
    const level = levelNumber(ability.level);
    switch (template.title) {
      case "Ant":
        if (trigger === "faint") {
          const target = this.randomFriend(pet);
          if (target) this.buff(target, level, level, pet, "Ant");
        }
        break;
      case "Cricket":
        if (trigger === "faint") {
          this.summon(
            pet.side,
            tokenPet({
              side: pet.side,
              name: "Zombie Cricket",
              attack: level,
              health: level,
              tier: 1,
              level
            }),
            pet.lastIndex
          );
        }
        break;
      case "Mosquito":
        if (trigger === "startOfBattle") {
          for (const target of this.randomEnemies(pet, level)) {
            this.applyDamage(target, 1, pet, "ability");
          }
        }
        break;
      case "Crab":
        if (trigger === "startOfBattle") {
          const friend = this.living(pet.side).sort(
            (a, b) => b.health - a.health || a.lastIndex - b.lastIndex
          )[0];
          if (friend) {
            this.buff(
              pet,
              0,
              Math.floor(friend.health * 0.25 * level),
              pet,
              "Crab"
            );
          }
        }
        break;
      case "Flamingo":
        if (trigger === "faint") {
          for (const target of this.friendsBehind(pet, 2)) {
            this.buff(target, level, level, pet, "Flamingo");
          }
        }
        break;
      case "Hedgehog":
        if (trigger === "faint") {
          const targets = [
            ...this.living("player"),
            ...this.living("enemy")
          ].filter((target) => target.uid !== pet.uid);
          for (const target of targets) {
            this.applyDamage(target, 2 * level, pet, "ability");
          }
        }
        break;
      case "Kangaroo":
        if (
          trigger === "friendAheadAttack" &&
          context.attacker &&
          this.isNearestAhead(pet, context.attacker)
        ) {
          this.log(
            "trigger",
            pet.side,
            pet,
            [context.attacker.uid],
            `${pet.name} triggers because ${context.attacker.name} attacks.`
          );
          this.buff(pet, level, level, pet, "Kangaroo");
        }
        break;
      case "Peacock":
        if (trigger === "hurt") {
          this.buff(pet, 3 * level, 0, pet, "Peacock");
        }
        break;
      case "Rat":
        if (trigger === "faint") {
          for (let index = 0; index < level; index++) {
            this.summon(
              this.opponent(pet.side),
              tokenPet({
                side: this.opponent(pet.side),
                name: "Dirty Rat",
                attack: 1,
                health: 1,
                tier: 1,
                level: 1,
                canTriggerSummonAbilities: false
              }),
              0
            );
          }
        }
        break;
      case "Spider":
        if (trigger === "faint") {
          const candidates = [...this.content.pets.values()].filter(
            (template) => template.tier === 3
          );
          const chosen = this.rng.pick(candidates);
          if (chosen) {
            this.summon(
              pet.side,
              tokenPet({
                side: pet.side,
                name: chosen.title,
                attack: 2 * level,
                health: 2 * level,
                tier: chosen.tier,
                level,
                templateId: chosen.id
              }),
              pet.lastIndex
            );
          }
        }
        break;
      case "Badger":
        if (trigger === "faint") {
          const targets = [
            ...this.living("player"),
            ...this.living("enemy")
          ].filter(
            (target) =>
              target.uid !== pet.uid &&
              Math.abs(target.lastIndex - pet.lastIndex) === 1
          );
          for (const target of targets) {
            this.applyDamage(target, pet.attack * 0.5 * level, pet, "ability");
          }
        }
        break;
      case "Camel":
        if (trigger === "hurt") {
          const target = this.nearestFriendBehind(pet);
          if (target) this.buff(target, level, 2 * level, pet, "Camel");
        }
        break;
      case "Dodo":
        if (trigger === "startOfBattle") {
          const target = this.nearestFriendAhead(pet);
          if (target) {
            this.buff(
              target,
              Math.floor(pet.attack * 0.5 * level),
              0,
              pet,
              "Dodo"
            );
          }
        }
        break;
      case "Dog":
        if (trigger === "friendSummoned") {
          this.buff(pet, 2 * level, level, pet, "Dog");
        }
        break;
      case "Dolphin":
        if (trigger === "startOfBattle") {
          for (let index = 0; index < level; index++) {
            const target = this.lowestHealthEnemy(pet);
            if (target) this.applyDamage(target, 4, pet, "ability");
          }
        }
        break;
      case "Elephant":
        if (trigger === "afterAttack") {
          for (let index = 0; index < level; index++) {
            const target = this.nearestFriendBehind(pet);
            if (target) this.applyDamage(target, 1, pet, "ability");
          }
        }
        break;
      case "Ox":
        if (
          trigger === "friendFaint" &&
          context.fainted &&
          this.isNearestAhead(pet, context.fainted)
        ) {
          const count = this.incrementTrigger(pet, "Ox");
          if (count <= level) {
            this.givePerk(pet, "melon", level);
            this.buff(pet, 1, 0, pet, "Ox");
          }
        }
        break;
      case "Sheep":
        if (trigger === "faint") {
          for (let index = 0; index < 2; index++) {
            this.summon(
              pet.side,
              tokenPet({
                side: pet.side,
                name: "Ram",
                attack: 2 * level,
                health: 2 * level,
                tier: 3,
                level
              }),
              pet.lastIndex
            );
          }
        }
        break;
      case "Blowfish":
        if (trigger === "hurt") {
          const target = this.randomEnemy(pet);
          if (target) this.applyDamage(target, 3 * level, pet, "ability");
        }
        break;
      case "Deer":
        if (trigger === "faint") {
          const bus = tokenPet({
            side: pet.side,
            name: "Bus",
            attack: 5 * level,
            health: 3 * level,
            tier: 4,
            level
          });
          bus.perks.push({ id: "chili", sourceLevel: level, uses: null });
          this.summon(pet.side, bus, pet.lastIndex);
        }
        break;
      case "Hippo":
        if (trigger === "knockOut") {
          const count = this.incrementTrigger(pet, "Hippo");
          if (count <= 3) this.buff(pet, 3 * level, 3 * level, pet, "Hippo");
        }
        break;
      case "Skunk":
        if (trigger === "startOfBattle") {
          const target = this.highestHealthEnemy(pet);
          if (target) {
            const reduction = Math.floor(target.health * 0.33 * level);
            this.applyDamage(target, reduction, pet, "ability");
          }
        }
        break;
      case "Turtle":
        if (trigger === "faint") {
          for (const target of this.friendsBehind(pet, level)) {
            this.givePerk(target, "melon", pet.level);
          }
        }
        break;
      case "Whale":
        if (trigger === "startOfBattle") {
          const target = this.nearestFriendAhead(pet);
          if (target) {
            const index = this.indexOf(pet);
            const targetIndex = this.boards[pet.side].findIndex(
              (entry) => entry.uid === target.uid
            );
            if (targetIndex >= 0 && index >= 0) {
              target.level = level;
              this.boards[pet.side].splice(targetIndex, 1);
              pet.swallowed.push(target);
              this.syncIndexes();
              this.log(
                "trigger",
                pet.side,
                pet,
                [target.uid],
                `${pet.name} swallows ${target.name}.`
              );
            }
          }
        }
        break;
      case "Armadillo":
        if (trigger === "startOfBattle") {
          for (const target of [
            ...this.living("player"),
            ...this.living("enemy")
          ]) {
            this.buff(target, 0, 8 * level, pet, "Armadillo");
          }
        }
        break;
      case "Crocodile":
        if (trigger === "startOfBattle") {
          for (let index = 0; index < level; index++) {
            const enemies = this.living(this.opponent(pet.side));
            const target = enemies.at(-1);
            if (target) this.applyDamage(target, 8, pet, "ability");
          }
        }
        break;
      case "Hippogriff":
        if (trigger === "faint") {
          const nextTier = Math.min(6, pet.tier + 1);
          const candidates = [...this.content.pets.values()].filter(
            (template) => template.tier === nextTier
          );
          const chosen = this.rng.pick(candidates);
          if (chosen) {
            this.summon(
              pet.side,
              tokenPet({
                side: pet.side,
                name: chosen.title,
                attack: 5 * level,
                health: 5 * level,
                tier: chosen.tier,
                level,
                templateId: chosen.id
              }),
              pet.lastIndex
            );
          }
        } else if (trigger === "friendSummoned" && context.summoned) {
          this.buff(context.summoned, level, 0, pet, "Hippogriff");
        }
        break;
      case "Monkey":
        break;
      case "Rhino":
        if (trigger === "knockOut") {
          const target = this.living(this.opponent(pet.side))[0];
          if (target) {
            this.applyDamage(
              target,
              4 * level * (target.tier === 1 ? 2 : 1),
              pet,
              "ability"
            );
          }
        }
        break;
      case "Rooster":
        if (trigger === "faint") {
          for (let index = 0; index < level; index++) {
            this.summon(
              pet.side,
              tokenPet({
                side: pet.side,
                name: "Chick",
                attack: Math.floor(pet.attack * 0.5),
                health: 1,
                tier: 5,
                level
              }),
              pet.lastIndex
            );
          }
        }
        break;
      case "Scorpion":
        if (trigger === "friendSummoned") break;
        break;
      case "Shark":
        if (trigger === "friendFaint") {
          this.buff(pet, 2 * level, 2 * level, pet, "Shark");
        }
        break;
      case "Turkey":
        if (trigger === "friendSummoned" && context.summoned) {
          this.buff(
            context.summoned,
            3 * level,
            level,
            pet,
            "Turkey"
          );
        }
        break;
      case "Boar":
        if (trigger === "beforeAttack") {
          this.buff(pet, 4 * level, 2 * level, pet, "Boar");
        }
        break;
      case "Dragon":
        break;
      case "Fly":
        if (trigger === "friendFaint" && context.fainted) {
          const count = this.incrementTrigger(pet, "Fly");
          if (count <= 3) {
            this.summon(
              pet.side,
              tokenPet({
                side: pet.side,
                name: "Zombie Fly",
                attack: 4 * level,
                health: 4 * level,
                tier: 6,
                level
              }),
              context.fainted.lastIndex
            );
          }
        }
        break;
      case "Gorilla":
        if (trigger === "hurt") {
          const count = this.incrementTrigger(pet, "Gorilla");
          if (count <= level) this.givePerk(pet, "coconut", pet.level);
        }
        break;
      case "Leopard":
        if (trigger === "startOfBattle") {
          for (const target of this.randomEnemies(pet, level)) {
            this.applyDamage(
              target,
              Math.floor(pet.attack * 0.5),
              pet,
              "ability"
            );
          }
        }
        break;
      case "Mammoth":
        if (trigger === "faint") {
          for (const target of this.living(pet.side)) {
            this.buff(
              target,
              2 * level,
              2 * level,
              pet,
              "Mammoth"
            );
          }
        }
        break;
      case "Snake":
        if (
          trigger === "friendAheadAttack" &&
          context.attacker &&
          this.isNearestAhead(pet, context.attacker)
        ) {
          const count = this.incrementTrigger(pet, "Snake");
          if (count <= 5) {
            const target = this.randomEnemy(pet);
            if (target) {
              this.applyDamage(target, 5 * level, pet, "ability");
            }
          }
        }
        break;
      case "Wolverine":
        if (trigger === "friendHurt") {
          const count = this.incrementTrigger(pet, "Wolverine");
          if (count % 4 === 0) {
            for (const target of this.living(this.opponent(pet.side))) {
              this.applyDamage(target, 3 * level, pet, "ability");
            }
          }
        }
        break;
      case "Horse":
        if (trigger === "friendSummoned" && context.summoned) {
          this.buff(context.summoned, level, 0, pet, "Horse");
        }
        break;
      case "Tiger":
        break;
      case "Seal":
      case "Rabbit":
      case "Beaver":
      case "Duck":
      case "Fish":
      case "Otter":
      case "Pig":
      case "Snail":
      case "Swan":
      case "Worm":
      case "Giraffe":
      case "Bison":
      case "Parrot":
      case "Penguin":
      case "Squirrel":
      case "Cow":
      case "Cat":
        break;
      default:
        this.warn(`No battle handler for ${template.title}.`);
    }
    this.flushHurtTriggers();
  }

  private randomEnemy(source: BattlePet): BattlePet | null {
    return this.rng.pick(this.living(this.opponent(source.side)));
  }

  private randomEnemies(source: BattlePet, count: number): BattlePet[] {
    return this.rng.sample(this.living(this.opponent(source.side)), count);
  }

  private randomFriend(source: BattlePet): BattlePet | null {
    return this.rng.pick(
      this.living(source.side).filter((pet) => pet.uid !== source.uid)
    );
  }

  private lowestHealthEnemy(source: BattlePet): BattlePet | null {
    return (
      this.living(this.opponent(source.side)).sort(
        (a, b) => a.health - b.health || a.lastIndex - b.lastIndex
      )[0] ?? null
    );
  }

  private highestHealthEnemy(source: BattlePet): BattlePet | null {
    return (
      this.living(this.opponent(source.side)).sort(
        (a, b) => b.health - a.health || a.lastIndex - b.lastIndex
      )[0] ?? null
    );
  }

  private nearestFriendAhead(source: BattlePet): BattlePet | null {
    const sourceIndex = source.lastIndex;
    return (
      this.living(source.side)
        .filter((pet) => pet.uid !== source.uid && pet.lastIndex < sourceIndex)
        .sort((a, b) => b.lastIndex - a.lastIndex)[0] ?? null
    );
  }

  private nearestFriendBehind(source: BattlePet): BattlePet | null {
    const sourceIndex = source.lastIndex;
    return (
      this.living(source.side)
        .filter((pet) => pet.uid !== source.uid && pet.lastIndex > sourceIndex)
        .sort((a, b) => a.lastIndex - b.lastIndex)[0] ?? null
    );
  }

  private friendsBehind(source: BattlePet, count: number): BattlePet[] {
    return this.living(source.side)
      .filter((pet) => pet.uid !== source.uid && pet.lastIndex > source.lastIndex)
      .sort((a, b) => a.lastIndex - b.lastIndex)
      .slice(0, count);
  }

  private isBehind(friend: BattlePet, ahead: BattlePet): boolean {
    return friend.side === ahead.side && friend.lastIndex > ahead.lastIndex;
  }

  private isNearestAhead(source: BattlePet, candidate: BattlePet): boolean {
    if (candidate.side !== source.side || candidate.lastIndex >= source.lastIndex) {
      return false;
    }
    const nearest = this.living(source.side)
      .filter(
        (pet) =>
          pet.uid !== source.uid &&
          pet.uid !== candidate.uid &&
          pet.lastIndex < source.lastIndex &&
          pet.lastIndex > candidate.lastIndex
      )
      .sort((a, b) => a.lastIndex - b.lastIndex);
    return nearest.length === 0;
  }

  private buff(
    target: BattlePet,
    attack: number,
    health: number,
    source: BattlePet,
    label: string
  ): void {
    if (!alive(target) || (attack === 0 && health === 0)) return;
    target.attack = maxStat(target.attack + attack);
    target.health = maxStat(target.health + health);
    this.log(
      "buff",
      target.side,
      source,
      [target.uid],
      `${target.name} gains +${attack}/+${health} from ${label}.`,
      { attack, health }
    );
  }

  private givePerk(target: BattlePet, perkId: PerkId, level: PetLevel): void {
    target.perks = [
      {
        id: perkId,
        sourceLevel: level,
        uses: perkId === "coconut" ? 1 : null
      } satisfies PerkState
    ];
    this.log(
      "perk",
      target.side,
      target,
      [target.uid],
      `${target.name} gains ${perkId}.`
    );
  }

  private perk(target: BattlePet, id: PerkId): PerkState | undefined {
    return target.perks.find((perk) => perk.id === id);
  }

  private removePerk(target: BattlePet, id: PerkId): void {
    target.perks = target.perks.filter((perk) => perk.id !== id);
  }

  private incrementTrigger(pet: BattlePet, key: string): number {
    const next = (pet.triggeredThisBattle[key] ?? 0) + 1;
    pet.triggeredThisBattle[key] = next;
    return next;
  }

  private summon(
    side: BattleSide,
    pet: BattlePet,
    requestedIndex: number
  ): void {
    if (this.boards[side].length >= MAX_TEAM_SIZE) {
      this.log(
        "warning",
        side,
        null,
        [],
        `${pet.name} cannot be summoned because the board is full.`
      );
      return;
    }
    this.tokenCounter++;
    pet.uid = `${side}:token:${this.tokenCounter}`;
    const board = this.boards[side];
    const index = Math.max(0, Math.min(requestedIndex, board.length));
    pet.side = side;
    board.splice(index, 0, pet);
    this.syncIndexes();
    this.log(
      "summon",
      side,
      null,
      [pet.uid],
      `${pet.name} is summoned at position ${index + 1}.`,
      {
        position: index,
        attack: pet.attack,
        health: pet.health,
        level: pet.level,
        tier: pet.tier,
        name: pet.name,
        templateId: pet.templateId
      }
    );
    if (pet.canTriggerSummonAbilities) {
      this.notifySummonedAbility(pet);
      this.notifyFriendSummoned(pet);
    }
  }

  private notifySummonedAbility(summoned: BattlePet): void {
    if (summoned.name === "Scorpion") {
      this.givePerk(summoned, "peanut", summoned.level);
    }
  }

  private notifyFriendSummoned(summoned: BattlePet): void {
    for (const friend of this.priority(this.living(summoned.side))) {
      if (friend.uid === summoned.uid) continue;
      for (const ability of this.abilities(friend)) {
        if (
          this.abilityText(ability)
            .toLowerCase()
            .includes("friend summoned")
        ) {
          this.callAbility(friend, ability, "friendSummoned", {
            summoned
          });
        }
      }
    }
  }

  private abilities(pet: BattlePet): AbilityRef[] {
    const base = this.baseAbility(pet);
    const abilities = this.content.pets.has(base.templateId) ? [base] : [];
    return [...abilities, ...pet.extraAbilities];
  }

  private baseAbility(pet: BattlePet): AbilityRef {
    return (
      pet.copiedAbility ?? {
        templateId: pet.templateId,
        level: pet.level
      }
    );
  }

  private abilityText(ability: AbilityRef): string {
    return this.template(ability.templateId).abilities[
      levelNumber(ability.level) - 1
    ];
  }

  private template(templateId: string): PetTemplate {
    const template = this.content.pets.get(templateId);
    if (!template) throw new Error(`Unknown battle template: ${templateId}`);
    return template;
  }

  private living(side: BattleSide): BattlePet[] {
    return this.boards[side]
      .filter(alive)
      .sort((a, b) => a.lastIndex - b.lastIndex);
  }

  private priority(pets: BattlePet[]): BattlePet[] {
    return this.orderByOwnerAttack(pets, (pet) => pet);
  }

  private orderByOwnerAttack<T>(
    values: T[],
    owner: (value: T) => BattlePet
  ): T[] {
    const sorted = [...values].sort(
      (a, b) => owner(b).attack - owner(a).attack
    );
    const result: T[] = [];
    for (let start = 0; start < sorted.length; ) {
      let end = start + 1;
      const attack = owner(sorted[start]).attack;
      while (end < sorted.length && owner(sorted[end]).attack === attack) {
        end++;
      }
      const tied = sorted.slice(start, end);
      for (let index = tied.length - 1; index > 0; index--) {
        const swap = this.triggerRng.integer(0, index);
        [tied[index], tied[swap]] = [tied[swap], tied[index]];
      }
      result.push(...tied);
      start = end;
    }
    return result;
  }

  private opponent(side: BattleSide): BattleSide {
    return side === "player" ? "enemy" : "player";
  }

  private indexOf(pet: BattlePet): number {
    return this.boards[pet.side].findIndex((entry) => entry.uid === pet.uid);
  }

  private syncIndexes(): void {
    for (const side of ["player", "enemy"] as const) {
      this.boards[side].forEach((pet, index) => {
        pet.lastIndex = index;
      });
    }
  }

  private log(
    type: BattleEvent["type"],
    side: BattleSide | null,
    actor: BattlePet | null,
    targetUids: string[],
    message: string,
    values?: BattleEvent["values"]
  ): void {
    this.sequence++;
    if (this.events.length >= MAX_LOG_EVENTS) {
      if (!this.events.some((event) => event.type === "warning")) {
        this.events.push({
          seq: this.sequence,
          type: "warning",
          side: null,
          actorUid: null,
          targetUids: [],
          message: "Battle log limit reached.",
          state: this.snapshotState()
        });
      }
      return;
    }
    this.events.push({
      seq: this.sequence,
      type,
      side,
      actorUid: actor?.uid ?? null,
      targetUids,
      message,
      ...(values ? { values } : {}),
      state: this.snapshotState()
    });
  }

  private warn(message: string): void {
    this.log("warning", null, null, [], message);
  }

  private snapshotState(): BattleStateSnapshot {
    const units = [
      ...this.boards.player.map((pet) => this.snapshotUnit(pet, "active", null)),
      ...this.boards.enemy.map((pet) => this.snapshotUnit(pet, "active", null)),
      ...this.fallen.map((pet) => this.snapshotUnit(pet, "fainted", null)),
      ...this.boards.player.flatMap((owner) =>
        owner.swallowed.map((pet) =>
          this.snapshotUnit(pet, "swallowed", owner.uid)
        )
      ),
      ...this.boards.enemy.flatMap((owner) =>
        owner.swallowed.map((pet) =>
          this.snapshotUnit(pet, "swallowed", owner.uid)
        )
      )
    ];
    units.sort(
      (a, b) =>
        (a.side === "player" ? -1 : 1) - (b.side === "player" ? -1 : 1) ||
        a.position - b.position ||
        a.uid.localeCompare(b.uid)
    );
    return { units };
  }

  private snapshotUnit(
    pet: BattlePet,
    status: "active" | "fainted" | "swallowed",
    swallowedBy: string | null
  ): BattleStateSnapshot["units"][number] {
    return {
      uid: pet.uid,
      side: pet.side,
      templateId: pet.templateId,
      name: pet.name,
      tier: pet.tier,
      level: pet.level,
      attack: pet.attack,
      health: pet.health,
      position: pet.lastIndex + 1,
      status,
      perks: pet.perks.map((perk) => perk.id),
      swallowedBy
    };
  }
}

export function resolveBattle(
  input: BattleInput,
  content: ContentBundle
): BattleResult {
  return new BattleSim(input, content).run();
}
