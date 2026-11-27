import type { PetTemplate, ToyId } from "./types.js";

export interface ToyTemplate {
  id: ToyId;
  name: string;
  sourcePet: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
}

export const TOY_TEMPLATES: Readonly<Record<ToyId, ToyTemplate>> = {
  balloon: {
    id: "balloon",
    name: "Balloon",
    sourcePet: "Ferret",
    tier: 1
  },
  stick: {
    id: "stick",
    name: "Stick",
    sourcePet: "Ferret",
    tier: 1
  },
  radio: {
    id: "radio",
    name: "Radio",
    sourcePet: "Lemur",
    tier: 2
  },
  tennisBall: {
    id: "tennisBall",
    name: "Tennis Ball",
    sourcePet: "Lemur",
    tier: 2
  },
  plasticSaw: {
    id: "plasticSaw",
    name: "Plastic Saw",
    sourcePet: "Lemur",
    tier: 2
  },
  melonHelmet: {
    id: "melonHelmet",
    name: "Melon Helmet",
    sourcePet: "Gharial",
    tier: 3
  },
  foamSword: {
    id: "foamSword",
    name: "Foam Sword",
    sourcePet: "Gharial",
    tier: 3
  },
  toyGun: {
    id: "toyGun",
    name: "Toy Gun",
    sourcePet: "Gharial",
    tier: 3
  },
  ovenMitts: {
    id: "ovenMitts",
    name: "Oven Mitts",
    sourcePet: "Puppy",
    tier: 4
  },
  toiletPaper: {
    id: "toiletPaper",
    name: "Toilet Paper",
    sourcePet: "Puppy",
    tier: 4
  },
  cashRegister: {
    id: "cashRegister",
    name: "Cash Register",
    sourcePet: "Puppy",
    tier: 4
  },
  flashlight: {
    id: "flashlight",
    name: "Flashlight",
    sourcePet: "Sting Ray",
    tier: 5
  },
  stinkySock: {
    id: "stinkySock",
    name: "Stinky Sock",
    sourcePet: "Sting Ray",
    tier: 5
  },
  television: {
    id: "television",
    name: "Television",
    sourcePet: "Mongoose",
    tier: 6
  },
  peanutJar: {
    id: "peanutJar",
    name: "Peanut Jar",
    sourcePet: "Mongoose",
    tier: 6
  },
  airPalmTree: {
    id: "airPalmTree",
    name: "Air Palm Tree",
    sourcePet: "Mongoose",
    tier: 6
  }
};

export const TOY_GROUPS: Readonly<Record<string, readonly ToyId[]>> = {
  Ferret: ["balloon", "stick"],
  Lemur: ["radio", "tennisBall", "plasticSaw"],
  Gharial: ["melonHelmet", "foamSword", "toyGun"],
  Puppy: ["ovenMitts", "toiletPaper", "cashRegister"],
  "Sting Ray": ["flashlight", "stinkySock"],
  Mongoose: ["television", "peanutJar", "airPalmTree"]
};

export function toyOptionsForPet(
  template: PetTemplate
): readonly ToyId[] | null {
  return TOY_GROUPS[template.title] ?? null;
}
