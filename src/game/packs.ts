export type StaticPackId =
  | "turtle"
  | "puppy"
  | "star"
  | "golden"
  | "unicorn"
  | "danger";

export interface PackDefinition {
  id: StaticPackId;
  name: string;
  slug: string;
  category: string;
  implemented: boolean;
}

export const DEFAULT_PACK_ID: StaticPackId = "turtle";
export const TURTLE_CONTENT_VERSION =
  "turtle-pack-2026-11-27-0a0e4423";

export const STATIC_PACKS: readonly PackDefinition[] = [
  {
    id: "turtle",
    name: "Turtle Pack",
    slug: "turtle-pack",
    category: "Category:Turtle Pack",
    implemented: true
  },
  {
    id: "puppy",
    name: "Puppy Pack",
    slug: "puppy-pack",
    category: "Category:Puppy Pack",
    implemented: false
  },
  {
    id: "star",
    name: "Star Pack",
    slug: "star-pack",
    category: "Category:Star Pack",
    implemented: false
  },
  {
    id: "golden",
    name: "Golden Pack",
    slug: "golden-pack",
    category: "Category:Golden Pack",
    implemented: false
  },
  {
    id: "unicorn",
    name: "Unicorn Pack",
    slug: "unicorn-pack",
    category: "Category:Unicorn Pack",
    implemented: false
  },
  {
    id: "danger",
    name: "Danger Pack",
    slug: "danger-pack",
    category: "Category:Danger Pack",
    implemented: false
  }
];

export function packById(id: StaticPackId): PackDefinition {
  const pack = STATIC_PACKS.find((entry) => entry.id === id);
  if (!pack) throw new Error(`Unknown pack: ${id}`);
  return pack;
}
