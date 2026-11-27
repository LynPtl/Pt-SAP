import type {
  AbilityAnalysis,
  EffectKind,
  TargetKind,
  Trigger
} from "./types.js";

const TRIGGER_PATTERNS: Array<[Trigger, RegExp]> = [
  ["startOfBattle", /\bstart of battle\b/i],
  ["beforeAttack", /\bbefore attack\b/i],
  ["afterAttack", /\bafter attack\b|\bfriend ahead attacks?\b/i],
  ["knockOut", /\bknock ?out\b/i],
  ["hurt", /\b(hurt|hurts|damaged|takes damage)\b/i],
  ["faint", /\b(faint|fainted|faints|dies|knocked out)\b/i],
  ["summon", /\b(summon|summoned)\b/i],
  ["sell", /\b(sell|sold)\b/i],
  ["startOfTurn", /\bstart (?:of )?turn\b/i],
  ["endOfTurn", /\bend (?:of )?turn\b/i],
  ["buy", /\b(buy|bought)\b/i],
  ["eat", /\b(eat|eats|ate)\b/i],
  ["levelUp", /\blevel[- ]?up\b/i]
];

const EFFECT_PATTERNS: Array<[EffectKind, RegExp]> = [
  [
    "modifyStats",
    /(?:\+\s*\d+\s*(?:attack|health)|\+\s*\d+\s*\/\s*\+?\s*\d+|\b(?:gain|give|reduce|remove|increase|decrease)\b[^.]*\b(?:attack|health)\b)/i
  ],
  [
    "dealDamage",
    /\bdeal\b[^.]*\bdamage\b|\bdamage\b[^.]*\b(?:to|equal)\b|\battack\b[^.]*\bdamage\b/i
  ],
  ["summon", /\bsummon\b/i],
  ["heal", /\bheal\b|\brestore\b[^.]*\bhealth\b/i],
  [
    "shield",
    /\bshield\b|\bignore\b[^.]*\bdamage\b|\btake\b[^.]*\bless damage\b/i
  ],
  [
    "perk",
    /\bperk\b|\bhoney\b|\bgarlic\b|\bcoconut\b|\bpeanut\b|\bmelon\b|\bmushroom\b|\bcake\b|\bchili\b|\bsteak\b|\bmeat bone\b/i
  ],
  ["stealStats", /\bsteal\b/i],
  ["transform", /\btransform\b|\bbecome\b/i],
  [
    "destroy",
    /\bdestroy\b|\bknock ?out\b|\bknockout\b|\bmake\b[^.]*\bfaint\b/i
  ],
  ["revive", /\brevive\b|\bresurrect\b|\bcome back\b/i],
  ["copy", /\bcopy\b|\bcopies\b|\brepeats?\b[^.]*\bability\b/i],
  ["shop", /\bshop\b|\bdiscount\b|\bfree\b/i],
  ["swallow", /\bswallow\b/i],
  ["mana", /\bmana\b/i],
  ["experience", /\bexperience\b|\bxp\b/i],
  ["gold", /\bgold\b/i],
  ["food", /\bfood\b|\bfeed\b/i]
];

const TARGET_PATTERNS: Array<[TargetKind, RegExp]> = [
  ["allFriends", /\ball (?:friends|allies)\b|\bevery (?:friend|ally)\b/i],
  ["allEnemies", /\ball enemies\b|\bevery enemy\b/i],
  ["allPets", /\ball pets\b|\bevery pet\b/i],
  ["randomFriend", /\brandom (?:friends?|allies|ally)\b/i],
  ["randomEnemy", /\brandom enem(?:y|ies)\b/i],
  ["nearestFriendAhead", /\bnearest friend (?:ahead|in front)\b/i],
  [
    "nearestFriendsAhead",
    /\bnearest friends (?:ahead|in front)\b|\bthree nearest friends ahead\b/i
  ],
  [
    "nearestFriendsBehind",
    /\bnearest friends behind\b|\btwo nearest friends behind\b/i
  ],
  ["nearestPetAhead", /\bnearest pet (?:ahead|in front)\b/i],
  ["friendAhead", /\bfriend (?:ahead|in front)\b/i],
  ["friendBehind", /\bfriend behind\b/i],
  [
    "frontFriend",
    /\bfront-?most friend\b|\bfront friend\b|\bfront-?most friendly pet\b/i
  ],
  ["backFriend", /\bback-?most friend\b|\bback friend\b/i],
  ["adjacentPets", /\badjacent pets?\b/i],
  [
    "lowestHealthEnemy",
    /\blowest health enemy\b|\bweakest health enemy\b/i
  ],
  [
    "highestHealthEnemy",
    /\bhighest health enemy\b|\bmost healthy enemy\b/i
  ],
  ["firstEnemy", /\bfirst enemy\b/i],
  ["lastEnemy", /\blast enemy\b/i],
  ["randomPet", /\brandom pets?\b/i],
  ["anyPet", /\b(?:one|a|any) pets?\b/i],
  [
    "triggeringPet",
    /\bgive it\b|\bgive them\b|\bthe summoned pet\b|\bthe summoning pet\b/i
  ],
  ["friend", /\b(?:one|two|three|a|the) friends?\b|\bfriends\b/i],
  ["self", /\bthis pet\b|\bitself\b|\bthis minion\b/i]
];

const TARGET_OPTIONAL: Partial<Record<EffectKind, true>> = {
  summon: true,
  shop: true,
  gold: true,
  experience: true,
  food: true,
  mana: true,
  revive: true
};

function splitTriggerAndBody(text: string): {
  prefix: string | null;
  body: string;
} {
  const match = text.match(/^(.{2,48}?)\s*(?::|→)\s*([\s\S]*)$/);
  if (!match) return { prefix: null, body: text };
  return { prefix: match[1].trim(), body: match[2].trim() };
}

function classifyTrigger(text: string): Trigger {
  const { prefix } = splitTriggerAndBody(text);
  if (prefix) {
    for (const [trigger, pattern] of TRIGGER_PATTERNS) {
      if (pattern.test(prefix)) return trigger;
    }
  }
  if (/^\b(when|whenever)\b/i.test(text)) {
    for (const [trigger, pattern] of TRIGGER_PATTERNS) {
      if (pattern.test(text)) return trigger;
    }
  }
  if (
    /^(give|all|friends?|this|your|shop|food|make|ignore|knockout|knock out|gain|take|summon)\b/i.test(
      text
    )
  ) {
    return "passive";
  }
  return "unknown";
}

function classifyEffects(text: string): EffectKind[] {
  const effects: EffectKind[] = [];
  for (const [effect, pattern] of EFFECT_PATTERNS) {
    if (pattern.test(text)) effects.push(effect);
  }
  return effects;
}

const SELF_TARGET_EFFECTS: Partial<Record<EffectKind, true>> = {
  modifyStats: true,
  perk: true,
  experience: true,
  gold: true,
  mana: true,
  shield: true
};

function classifyTargets(text: string, effects: EffectKind[]): TargetKind[] {
  let targets: TargetKind[] = [];
  for (const [target, pattern] of TARGET_PATTERNS) {
    if (pattern.test(text)) targets.push(target);
  }

  if (
    /\b(?:gain|ignore|take)\b/i.test(text) &&
    effects.some((effect) => SELF_TARGET_EFFECTS[effect])
  ) {
    targets.push("self");
  }

  if (
    targets.some((target) =>
      [
        "randomFriend",
        "allFriends",
        "friendAhead",
        "friendBehind",
        "frontFriend",
        "backFriend",
        "nearestFriendAhead",
        "nearestFriendsAhead",
        "nearestFriendsBehind"
      ].includes(target)
    )
  ) {
    targets = targets.filter((target) => target !== "friend");
  }
  if (targets.includes("nearestFriendAhead")) {
    targets = targets.filter((target) => target !== "friendAhead");
  }
  if (targets.includes("nearestFriendsAhead")) {
    targets = targets.filter((target) => target !== "friendAhead");
  }
  if (targets.includes("nearestFriendsBehind")) {
    targets = targets.filter((target) => target !== "friendBehind");
  }

  return [...new Set(targets)];
}

function assessAbility(
  text: string,
  trigger: Trigger,
  effects: EffectKind[],
  targets: TargetKind[]
): AbilityAnalysis {
  const complex =
    /\b(if|otherwise|for each|twice|repeat|instead|adjacent)\b|works \d+ times/i.test(
      text
    );
  const reasons: string[] = [];

  let status: AbilityAnalysis["status"];
  if (effects.length === 0) {
    status = "custom";
    reasons.push("no recognized effect");
  } else if (trigger === "unknown") {
    status = "partial";
    reasons.push("unknown trigger");
  } else if (
    targets.length === 0 &&
    !effects.some((effect) => TARGET_OPTIONAL[effect])
  ) {
    status = "partial";
    reasons.push("no recognized target");
  } else {
    status = "full";
  }
  if (complex) reasons.push("conditional or multi-step text");

  return {
    text,
    trigger,
    effects,
    targets,
    status,
    complex,
    reasons
  };
}

export function analyzeAbility(text: string): AbilityAnalysis {
  const clean = text.trim();
  if (!clean) {
    return {
      text: clean,
      trigger: "unknown",
      effects: [],
      targets: [],
      status: "none",
      complex: false,
      reasons: ["empty ability"]
    };
  }

  const trigger = classifyTrigger(clean);
  const { body } = splitTriggerAndBody(clean);
  const effectText =
    trigger === "unknown" || trigger === "passive" ? clean : body;
  const effects = classifyEffects(effectText);
  const targets = classifyTargets(effectText, effects);
  return assessAbility(clean, trigger, effects, targets);
}

export function analyzeFood(text: string): AbilityAnalysis {
  const clean = text.trim();
  if (!clean) {
    return {
      text: clean,
      trigger: "passive",
      effects: [],
      targets: [],
      status: "none",
      complex: false,
      reasons: ["empty food text"]
    };
  }
  const effects = classifyEffects(clean);
  const targets = classifyTargets(clean, effects);
  return assessAbility(clean, "passive", effects, targets);
}
