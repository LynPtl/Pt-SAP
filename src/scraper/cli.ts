import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  STATIC_PACKS,
  packById,
  type PackDefinition,
  type StaticPackId
} from "../game/packs.js";
import {
  buildCoverageReport,
  normalizeFoods,
  normalizePets
} from "./coverage.js";
import type {
  NormalizedFood,
  NormalizedPet,
  RawCache,
  RawPage
} from "./types.js";
import { getCategoryMembers, getPages } from "./wiki.js";

const ROOT = process.cwd();
const REFERENCE_DIR = path.join(ROOT, "reference");
const RAW_DIR = path.join(REFERENCE_DIR, "raw");
const NORMALIZED_DIR = path.join(REFERENCE_DIR, "normalized");
const REPORTS_DIR = path.join(ROOT, "reports");
const SOURCE = "https://superautopets.wiki.gg";

interface PackPaths {
  cache: string;
  pets: string;
  normalizedPets: string;
  normalizedFoods: string;
  report: string;
}

function packPaths(pack: PackDefinition): PackPaths {
  return {
    cache: path.join(RAW_DIR, `${pack.slug}-pages.json`),
    pets: path.join(RAW_DIR, `${pack.slug}-pets.txt`),
    normalizedPets: path.join(NORMALIZED_DIR, `${pack.slug}.json`),
    normalizedFoods: path.join(
      NORMALIZED_DIR,
      `${pack.slug}-foods.json`
    ),
    report: path.join(REPORTS_DIR, `${pack.slug}-coverage.md`)
  };
}

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

async function loadCache(
  pack: PackDefinition
): Promise<RawCache | null> {
  const cachePath = packPaths(pack).cache;
  if (!existsSync(cachePath)) return null;
  const text = await readFile(cachePath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!isRawCache(parsed)) {
    throw new Error(`Invalid cache format: ${cachePath}`);
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

async function scrape(
  pack: PackDefinition,
  refresh: boolean
): Promise<void> {
  const paths = packPaths(pack);
  const packCategory = await getCategoryMembers(pack.category);
  const petsCategory = await getCategoryMembers("Category:Pets");
  const petsSet = new Set(petsCategory);
  const packPets = [...new Set(packCategory)]
    .filter((title) => petsSet.has(title))
    .sort((a, b) => a.localeCompare(b));

  if (packPets.length === 0) {
    throw new Error(`No ${pack.name} pets found in the wiki categories`);
  }

  await writeFile(paths.pets, `${packPets.join("\n")}\n`, "utf8");

  const requestedTitles = [...packPets, "Food"];
  const cached = refresh ? null : await loadCache(pack);
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
    source: `${SOURCE} (${pack.category})`,
    pages
  };
  await writeJson(paths.cache, cache);

  console.log(
    `${pack.name}: scraped ${packPets.length} pets + Food ` +
      `(${fetched.length} pages fetched, ${pages.length - fetched.length} cached)`
  );
}

async function report(pack: PackDefinition): Promise<void> {
  const paths = packPaths(pack);
  const cache = await loadCache(pack);
  if (!cache) {
    throw new Error(
      `No raw cache found at ${paths.cache}. Run "npm run scrape" first.`
    );
  }

  const foodPage = cache.pages.find((page) => page.title === "Food");
  if (!foodPage) throw new Error(`${pack.name}: Food page missing from cache`);

  const petPages = cache.pages.filter((page) => page.title !== "Food");
  const pets: NormalizedPet[] = normalizePets(petPages);
  const allFoods: NormalizedFood[] = normalizeFoods(foodPage);
  const packFoods = allFoods.filter((food) =>
    food.packs.includes(pack.name)
  );

  await writeJson(paths.normalizedPets, {
    pack: pack.name,
    packId: pack.id,
    generatedAt: cache.generatedAt,
    source: cache.source,
    pets
  });
  await writeJson(paths.normalizedFoods, {
    pack: pack.name,
    packId: pack.id,
    generatedAt: cache.generatedAt,
    source: cache.source,
    foods: packFoods
  });

  const markdown = buildCoverageReport({
    generatedAt: new Date().toISOString(),
    source: cache.source,
    packName: pack.name,
    pets,
    foods: allFoods
  });
  await writeFile(paths.report, markdown, "utf8");

  const primary = pets
    .map((pet) => pet.abilities.find((ability) => ability.text.length > 0)?.dsl)
    .filter((dsl) => Boolean(dsl));
  const full = primary.filter((dsl) => dsl?.status === "full").length;
  const partial = primary.filter((dsl) => dsl?.status === "partial").length;
  const custom = primary.filter((dsl) => dsl?.status === "custom").length;

  console.log(
    `${pack.name}: report ${paths.report} ` +
      `(${pets.length} pets, ${full} full, ${partial} partial, ${custom} custom, ` +
      `${packFoods.length} foods)`
  );
}

function parsePack(value: string): PackDefinition {
  return packById(value as StaticPackId);
}

function selectedPacks(args: string[]): PackDefinition[] {
  const packArg = args.find((arg) => arg.startsWith("--pack="));
  if (!packArg) return [...STATIC_PACKS];
  const id = packArg.slice("--pack=".length);
  if (id === "all") return [...STATIC_PACKS];
  return [parsePack(id)];
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "all";
  const args = process.argv.slice(3);
  const refresh = args.includes("--refresh");
  const packs = selectedPacks(args);
  await ensureDirectories();

  if (command !== "scrape" && command !== "report" && command !== "all") {
    throw new Error(
      `Unknown command "${command}". Use scrape, report, or all.`
    );
  }

  for (const pack of packs) {
    if (command === "scrape" || command === "all") {
      await scrape(pack, refresh);
    }
    if (command === "report" || command === "all") {
      await report(pack);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
