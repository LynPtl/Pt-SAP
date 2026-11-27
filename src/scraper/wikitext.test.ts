import assert from "node:assert/strict";
import test from "node:test";
import {
  findTemplate,
  findTemplates,
  parseTemplate,
  stripMarkup
} from "./wikitext.js";

test("findTemplate and parseTemplate read AnimalInfoBox fields", () => {
  const wikitext = `{{AnimalInfoBox
|tier= 1
|attack/health= 2/2
|ID= 0
|level_1='''[[Faint (Trigger)|Faint]]''': Give a random friend +1 {{IconSAP|attack|nolink=yes}} and +1 {{IconSAP|health|nolink=yes}}.
|level_2='''[[Faint (Trigger)|Faint]]''': Give a random friend +2 attack and +2 health.
}}`;
  const infobox = findTemplate(wikitext, "AnimalInfoBox");
  assert.ok(infobox);
  const parsed = parseTemplate(infobox);
  assert.equal(parsed.params.get("tier"), "1");
  assert.equal(parsed.params.get("attack/health"), "2/2");
  assert.equal(parsed.params.get("ID"), "0");
});

test("stripMarkup turns icon templates and links into plain text", () => {
  const text =
    "'''[[Faint (Trigger)|Faint]]''': Give a random friend +1 {{IconSAP|attack|nolink=yes}} and +1 {{IconSAP|health|nolink=yes}}.";
  assert.equal(stripMarkup(text), "Faint: Give a random friend +1 attack and +1 health.");
});

test("findTemplates collects food rows", () => {
  const wikitext = `
{{:Foods/row
| food = {{IconSAP|Apple}}
| turtlepack = yes
| ability = Give one pet +1 {{IconSAP|attack|nolink=yes}} and +1 {{IconSAP|health|nolink=yes}}.
}}
{{:Foods/row
| food = {{IconSAP|Honey}}
| turtlepack = yes
| ability = Give one pet the {{IconSAP|Honey}} [[Food Perks|Perk]].
}}
`;
  const rows = findTemplates(wikitext, "Foods/row");
  assert.equal(rows.length, 2);
  const first = parseTemplate(rows[0]);
  assert.equal(stripMarkup(first.params.get("food") ?? ""), "Apple");
});
