import type {
  AbilityAnalysis,
  EffectKind,
  FoodRecord,
  NormalizedFood,
  NormalizedPet,
  PetRecord,
  RawPage,
  TargetKind,
  Trigger
} from "./types.js";
import { parseFoods, parsePet } from "./parse.js";
import { analyzeAbility, analyzeFood } from "./normalize.js";

export function normalizePets(pages: RawPage[]): NormalizedPet[] {
  const seenTitles = new Set<string>();
  return pages
    .map((page) => {
      const pet: PetRecord = parsePet(page);
      return {
        id: pet.id,
        title: pet.title,
        tier: pet.tier,
        attack: pet.attack,
        health: pet.health,
        parseErrors: pet.parseErrors,
        abilities: pet.levels.map((text, index) => ({
          level: index + 1,
          text,
          dsl: analyzeAbility(text)
        }))
      } satisfies NormalizedPet;
    })
    .filter((pet) => {
      const title = pet.title.trim().toLocaleLowerCase("en");
      if (seenTitles.has(title)) return false;
      seenTitles.add(title);
      return true;
    })
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.title.localeCompare(b.title));
}

export function normalizeFoods(page: RawPage): NormalizedFood[] {
  return parseFoods(page).map((food: FoodRecord) => ({
    id: food.id,
    name: food.name,
    tier: food.tier,
    packs: food.packs,
    text: food.ability,
    dsl: analyzeFood(food.ability)
  }));
}

function primaryAbility(pet: NormalizedPet): AbilityAnalysis | null {
  return pet.abilities.find((ability) => ability.text.length > 0)?.dsl ?? null;
}

function percentage(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function markdownTable(headers: string[], rows: string[][]): string {
  const header = `| ${headers.map(markdownCell).join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${row.map((cell) => markdownCell(cell)).join(" | ")} |`
  );
  return [header, separator, ...body].join("\n");
}

function countValues<T extends string>(values: T[]): Array<[T, number]> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export interface CoverageInput {
  generatedAt: string;
  source: string;
  packName: string;
  pets: NormalizedPet[];
  foods: NormalizedFood[];
}

export function buildCoverageReport(input: CoverageInput): string {
  const { packName, pets, foods } = input;
  const withAbility = pets.filter((pet) => primaryAbility(pet) !== null);
  const primary = withAbility.map((pet) => ({
    pet,
    dsl: primaryAbility(pet) as AbilityAnalysis
  }));

  const statusCounts = countValues(primary.map(({ dsl }) => dsl.status));
  const statusMap = new Map(statusCounts);
  const full = statusMap.get("full") ?? 0;
  const partial = statusMap.get("partial") ?? 0;
  const custom = statusMap.get("custom") ?? 0;
  const none = pets.length - withAbility.length;

  const triggerCounts = countValues(primary.map(({ dsl }) => dsl.trigger));
  const effectCounts = countValues(
    primary.flatMap(({ dsl }) => [...new Set(dsl.effects)])
  );
  const targetCounts = countValues(
    primary.flatMap(({ dsl }) => [...new Set(dsl.targets)])
  );
  const complexCount = primary.filter(({ dsl }) => dsl.complex).length;

  const tierRows = [1, 2, 3, 4, 5, 6].map((tier) => {
    const tierPets = pets.filter((pet) => pet.tier === tier);
    const tierPrimary = tierPets
      .map((pet) => primaryAbility(pet))
      .filter((dsl): dsl is AbilityAnalysis => dsl !== null);
    const tierStatuses = new Map(
      countValues(tierPrimary.map((dsl) => dsl.status))
    );
    const tierFull = tierStatuses.get("full") ?? 0;
    const tierPartial = tierStatuses.get("partial") ?? 0;
    const tierCustom = tierStatuses.get("custom") ?? 0;
    const tierNone = tierPets.length - tierPrimary.length;
    return [
      String(tier),
      String(tierPets.length),
      String(tierFull),
      String(tierPartial),
      String(tierCustom),
      String(tierNone),
      percentage(tierFull + tierPartial, tierPets.length)
    ];
  });

  const customRows = primary
    .filter(({ dsl }) => dsl.status === "custom")
    .map(({ pet, dsl }) => [
      pet.title,
      String(pet.tier ?? "?"),
      dsl.text,
      dsl.reasons.join("; ")
    ]);

  const partialRows = primary
    .filter(({ dsl }) => dsl.status === "partial")
    .map(({ pet, dsl }) => [
      pet.title,
      String(pet.tier ?? "?"),
      dsl.text,
      dsl.reasons.join("; ")
    ]);

  const complexRows = primary
    .filter(({ dsl }) => dsl.complex)
    .map(({ pet, dsl }) => [
      pet.title,
      String(pet.tier ?? "?"),
      dsl.text,
      dsl.status,
      dsl.reasons.join("; ") || "-"
    ]);

  const parseIssueRows = pets
    .filter((pet) => pet.parseErrors.length > 0)
    .map((pet) => [pet.title, pet.parseErrors.join("; ")]);

  const packFoods = foods.filter((food) => food.packs.includes(packName));
  const foodStatusCounts = countValues(packFoods.map((food) => food.dsl.status));
  const foodStatusMap = new Map(foodStatusCounts);
  const foodFull = foodStatusMap.get("full") ?? 0;
  const foodPartial = foodStatusMap.get("partial") ?? 0;
  const foodCustom = foodStatusMap.get("custom") ?? 0;
  const foodNone = packFoods.length - foodFull - foodPartial - foodCustom;
  const foodRows = packFoods.map((food) => [
    food.name,
    food.dsl.text || "(no text)",
    food.dsl.status,
    food.dsl.effects.join(", ") || "-"
  ]);

  const lines: string[] = [];
  lines.push(`# ${packName} Coverage`);
  lines.push("");
  lines.push(`- Generated: ${input.generatedAt}`);
  lines.push(`- Source: ${input.source}`);
  lines.push(`- Pets scraped: ${pets.length}`);
  lines.push(`- Pets with ability text: ${withAbility.length}`);
  lines.push(
    `- Fully mapped at keyword level: ${full} (${percentage(full, withAbility.length)} of pets with abilities)`
  );
  lines.push(
    `- Partial keyword match: ${partial} (${percentage(partial, withAbility.length)})`
  );
  lines.push(
    `- No recognized effect: ${custom} (${percentage(custom, withAbility.length)})`
  );
  lines.push(`- No ability text: ${none}`);
  lines.push(
    `- At least partially mapped: ${full + partial} (${percentage(full + partial, withAbility.length)})`
  );
  lines.push(`- Complex/conditional text: ${complexCount}`);
  lines.push("");
  lines.push("## Coverage by tier");
  lines.push("");
  lines.push(
    markdownTable(
      ["Tier", "Pets", "Full", "Partial", "Custom", "No ability", "At least partial"],
      tierRows
    )
  );
  lines.push("");
  lines.push("## Trigger distribution (level 1)");
  lines.push("");
  lines.push(
    markdownTable(
      ["Trigger", "Count"],
      triggerCounts.map(([trigger, count]) => [trigger, String(count)])
    )
  );
  lines.push("");
  lines.push("## Effect distribution (level 1)");
  lines.push("");
  lines.push(
    markdownTable(
      ["Effect", "Count"],
      effectCounts.map(([effect, count]) => [effect, String(count)])
    )
  );
  lines.push("");
  lines.push("## Target distribution (level 1)");
  lines.push("");
  lines.push(
    markdownTable(
      ["Target", "Count"],
      targetCounts.map(([target, count]) => [target, String(count)])
    )
  );
  lines.push("");
  lines.push("## No recognized effect");
  lines.push("");
  if (customRows.length === 0) {
    lines.push("None.");
  } else {
    lines.push(
      markdownTable(["Pet", "Tier", "Ability text", "Reason"], customRows)
    );
  }
  lines.push("");
  lines.push("## Partial mappings");
  lines.push("");
  if (partialRows.length === 0) {
    lines.push("None.");
  } else {
    lines.push(
      markdownTable(["Pet", "Tier", "Ability text", "Reason"], partialRows)
    );
  }
  lines.push("");
  lines.push("## Complex abilities");
  lines.push("");
  if (complexRows.length === 0) {
    lines.push("None.");
  } else {
    lines.push(
      markdownTable(
        ["Pet", "Tier", "Ability text", "Status", "Reason"],
        complexRows
      )
    );
  }
  lines.push("");
  lines.push("## Suggested first engine primitives");
  lines.push("");
  lines.push(
    `- Triggers: ${triggerCounts.map(([trigger]) => trigger).join(", ") || "none"}`
  );
  lines.push(
    `- Effects: ${effectCounts.map(([effect]) => effect).join(", ") || "none"}`
  );
  lines.push(
    `- Targets: ${targetCounts.map(([target]) => target).join(", ") || "none"}`
  );
  lines.push(
    `- Custom watchlist: ${complexRows.map((row) => row[0]).join(", ") || "none"}`
  );
  lines.push("");
  lines.push(`## Food coverage (${packName})`);
  lines.push("");
  lines.push(
    `- Foods found: ${packFoods.length} (full ${foodFull}, partial ${foodPartial}, custom ${foodCustom}, none ${foodNone})`
  );
  lines.push("");
  if (foodRows.length > 0) {
    lines.push(markdownTable(["Food", "Text", "Status", "Effects"], foodRows));
  } else {
    lines.push(`No ${packName} foods parsed.`);
  }
  lines.push("");
  lines.push("## Parse issues");
  lines.push("");
  if (parseIssueRows.length === 0) {
    lines.push("None.");
  } else {
    lines.push(markdownTable(["Pet", "Issue"], parseIssueRows));
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Coverage is a keyword-level estimate, not proof that the engine can execute the ability."
  );
  lines.push(
    "- Level 1 text is used for the main coverage count; levels 2 and 3 are stored in the JSON."
  );
  lines.push(
    "- `reference/` contains SAP-derived research data and must stay out of any published build."
  );
  lines.push("");

  return lines.join("\n");
}

export type { EffectKind, TargetKind, Trigger };
