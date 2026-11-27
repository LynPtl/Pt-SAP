import assert from "node:assert/strict";
import test from "node:test";
import { parseFoods } from "./parse.js";

test("parseFoods assigns tabber section tiers and leaves token foods untiered", () => {
  const cosmetics = parseFoods({
    title: "Food",
    pageid: 1,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    content: `
<tabber>
|-|Tier 1 =
{{:Foods/row
| food = {{IconSAP|Apple}}
| turtlepack = yes
| ability = Give one pet +1 attack.
}}
|-|Tier 3 =
{{:Foods/row
| food = {{IconSAP|Cake}}
| turtlepack = yes
| ability = Give one pet the Cake Perk.
}}
|-|No Tier =
{{:Foods/row
| food = {{IconSAP|Coconut}}
| turtlepack = summoned
| ability = Ignore damage once.
}}
</tabber>
`
  });

  assert.deepEqual(
    cosmetics.map((food) => [food.name, food.tier]),
    [
      ["Apple", 1],
      ["Cake", 3],
      ["Coconut", null]
    ]
  );
});
