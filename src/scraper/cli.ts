import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCoverageReport, normalizeFoods, normalizePets } from "./coverage.js";
import type { NormalizedFood, NormalizedPet, RawCache, RawPage } from "./types.js";
import { getCategoryMembers, getPages } from "./wiki.js";

const ROOT = process.cwd();
const REFERENCE_DIR = path.join(ROOT, "reference");
const RAW_DIR = path.join(REFERENCE_DIR, "raw");
const NORMALIZED_DIR = path.join(REFERENCE_DIR, "normalized");
const REPORTS_DIR = path.join(ROOT, "reports");
const CACHE_PATH = path.join(RAW_DIR, "turtle-pack-pages.json");
const SOURCE = "https://superautopets.wiki.gg";

function isRawPage(value: unknown): value is RawPage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.pageid === "number" &&
    typeof record.content === "string" &&
    typeof record.fetchedAt === "string"
  );
}

function isRawCache(value: unknown): value is RawCache {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.generatedAt === "string" &&
    typeof record.source === "string" &&
    Array.isArray(record.pages) &&
    record.pages.every(isRawPage)
  );
}

async function loadCache(): Promise<RawCache | null> {
  if (!existsSync(CACHE_PATH)) return null;
  const text = await readFile(CACHE_PATH, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!isRawCache(parsed)) {
    throw new Error(`Invalid cache format: ${CACHE_PATH}`);
  }
  return parsed;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureDirectories(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(NORMALIZED_DIR, { recursive: true });
  await mkdir(REPORTS_DIR, { recursive: true });
}

async function scrape(refresh: boolean): Promise<void> {
  await ensureDirectories();

  const turtleCategory = await getCategoryMembers("Category:Turtle Pack");
  const petsCategory = await getCategoryMembers("Category:Pets");
  const petsSet = new Set(petsCategory);
  const turtlePets = [...new Set(turtleCategory)]
    .filter((title) => petsSet.has(title))
    .sort((a, b) => a.localeCompare(b));

  if (turtlePets.length === 0) {
    throw new Error("No Turtle Pack pets found in the wiki categories");
  }

  await writeFile(
    path.join(RAW_DIR, "turtle-pets.txt"),
    `${turtlePets.join("\n")}\n`,
    "utf8"
  );

  const requestedTitles = [...turtlePets, "Food"];
  const cached = refresh ? null : await loadCache();
  const cachedTitles = new Set(cached?.pages.map((page) => page.title) ?? []);
  const missing = requestedTitles.filter((title) => !cachedTitles.has(title));
  const fetched = missing.length > 0 ? await getPages(missing) : [];

  const pagesByTitle = new Map(
    (cached?.pages ?? []).map((page) => [page.title, page])
  );
  for (const page of fetched) pagesByTitle.set(page.title, page);

  const pages = requestedTitles
    .map((title) => pagesByTitle.get(title))
    .filter((page): page is RawPage => Boolean(page));

  if (pages.length !== requestedTitles.length) {
    const found = new Set(pages.map((page) => page.title));
    const absent = requestedTitles.filter((title) => !found.has(title));
    throw new Error(`Missing wiki pages after fetch: ${absent.join(", ")}`);
  }

  const cache: RawCache = {
    generatedAt: new Date().toISOString(),
    source: `${SOURCE} (Category:Turtle Pack)`,
    pages
  };
  await writeJson(CACHE_PATH, cache);

  console.log(
    `scraped ${turtlePets.length} Turtle Pack pets + Food (${fetched.length} pages fetched, ${pages.length - fetched.length} cached)`
  );
}

async function report(): Promise<void> {
  await ensureDirectories();
  const cache = await loadCache();
  if (!cache) {
    throw new Error(
      `No raw cache found at ${CACHE_PATH}. Run "npm run scrape" first.`
    );
  }

  const foodPage = cache.pages.find((page) => page.title === "Food");
  if (!foodPage) throw new Error("Food page missing from cache");

  const petPages = cache.pages.filter((page) => page.title !== "Food");
  const pets: NormalizedPet[] = normalizePets(petPages);
  const allFoods: NormalizedFood[] = normalizeFoods(foodPage);
  const turtleFoods = allFoods.filter((food) =>
    food.packs.includes("Turtle Pack")
  );

  await writeJson(path.join(NORMALIZED_DIR, "turtle-pack.json"), {
    generatedAt: cache.generatedAt,
    source: cache.source,
    pets
  });
  await writeJson(path.join(NORMALIZED_DIR, "turtle-pack-foods.json"), {
    generatedAt: cache.generatedAt,
    source: cache.source,
    foods: turtleFoods
  });

  const markdown = buildCoverageReport({
    generatedAt: new Date().toISOString(),
    source: cache.source,
    pets,
    foods: allFoods
  });
  const reportPath = path.join(REPORTS_DIR, "turtle-pack-coverage.md");
  await writeFile(reportPath, markdown, "utf8");

  const primary = pets
    .map((pet) => pet.abilities.find((ability) => ability.text.length > 0)?.dsl)
    .filter((dsl) => Boolean(dsl));
  const full = primary.filter((dsl) => dsl?.status === "full").length;
  const partial = primary.filter((dsl) => dsl?.status === "partial").length;
  const custom = primary.filter((dsl) => dsl?.status === "custom").length;

  console.log(
    `report written: ${reportPath} (${pets.length} pets, ${full} full, ${partial} partial, ${custom} custom, ${turtleFoods.length} Turtle Pack foods)`
  );
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "all";
  const refresh = process.argv.includes("--refresh");
  if (command === "scrape") {
    await scrape(refresh);
  } else if (command === "report") {
    await report();
  } else if (command === "all") {
    await scrape(refresh);
    await report();
  } else {
    throw new Error(
      `Unknown command "${command}". Use scrape, report, or all.`
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
