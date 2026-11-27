import type { FoodRecord, PetRecord, RawPage } from "./types.js";
import {
  findBalancedTemplate,
  findTemplate,
  parseTemplate,
  stripMarkup
} from "./wikitext.js";

const PACK_FLAGS: Array<[string, string]> = [
  ["turtlepack", "Turtle Pack"],
  ["puppypack", "Puppy Pack"],
  ["starpack", "Star Pack"],
  ["goldenpack", "Golden Pack"],
  ["unicornpack", "Unicorn Pack"],
  ["dangerpack", "Danger Pack"],
  ["weeklypack", "Weekly Pack"],
  ["custompack", "Custom Packs"]
];

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function parseStats(value: string | undefined): [number | null, number | null] {
  if (!value) return [null, null];
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return [null, null];
  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePet(page: RawPage): PetRecord {
  const parseErrors: string[] = [];
  const infobox = findTemplate(page.content, "AnimalInfoBox");
  if (!infobox) {
    return {
      id: slug(page.title),
      title: page.title,
      tier: null,
      attack: null,
      health: null,
      rawLevels: ["", "", ""],
      levels: ["", "", ""],
      parseErrors: ["AnimalInfoBox not found"]
    };
  }

  const { params } = parseTemplate(infobox);
  const tier = parseInteger(params.get("tier"));
  const [attack, health] = parseStats(params.get("attack/health"));
  const id = params.get("ID")?.trim() || slug(page.title);
  const rawLevels = ["level_1", "level_2", "level_3"].map(
    (key) => params.get(key)?.trim() ?? ""
  );
  const levels = rawLevels.map(stripMarkup);

  if (tier === null) parseErrors.push("tier missing");
  if (attack === null || health === null) parseErrors.push("stats missing");
  if (levels.every((level) => level.length === 0)) {
    parseErrors.push("no ability text");
  }

  return {
    id,
    title: page.title,
    tier,
    attack,
    health,
    rawLevels,
    levels,
    parseErrors
  };
}

export function parseFoods(page: RawPage): FoodRecord[] {
  const rows: Array<{ text: string; index: number }> = [];
  const rowPattern = /\{\{\s*:?\s*Foods\/row\b/gi;
  let match: RegExpExecArray | null;

  while ((match = rowPattern.exec(page.content)) !== null) {
    const end = findBalancedTemplate(page.content, match.index);
    if (end < 0) break;
    rows.push({
      text: page.content.slice(match.index, end),
      index: match.index
    });
    rowPattern.lastIndex = end;
  }

  return rows.map(({ text: row, index }, foodIndex) => {
    const { params } = parseTemplate(row);
    const name = stripMarkup(params.get("food") ?? `Food ${foodIndex + 1}`);
    const packs = PACK_FLAGS.filter(([flag]) => {
      const value = params.get(flag);
      return Boolean(value && !/^(no|false|0)$/i.test(value));
    }).map(([, label]) => label);
    const prefix = page.content.slice(0, index);
    const sectionMatches = [
      ...prefix.matchAll(/\|\-\|\s*(?:Tier\s+([1-6])|No\s+Tier)\s*=/gi)
    ];
    const lastSection = sectionMatches.at(-1);
    const tier = lastSection?.[1]
      ? Number.parseInt(lastSection[1], 10)
      : null;

    return {
      id: slug(name),
      name,
      tier: Number.isFinite(tier) ? tier : null,
      packs,
      rawAbility: params.get("ability") ?? "",
      ability: stripMarkup(params.get("ability") ?? ""),
      note: stripMarkup(params.get("note") ?? "")
    };
  });
}
