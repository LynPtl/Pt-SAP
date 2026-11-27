# Turtle Pack Coverage

- Generated: 2026-11-27T08:10:10.213Z
- Source: https://superautopets.wiki.gg (Category:Turtle Pack)
- Pets scraped: 60
- Pets with ability text: 60
- Fully mapped at keyword level: 59 (98% of pets with abilities)
- Partial keyword match: 1 (2%)
- No recognized effect: 0 (0%)
- No ability text: 0
- At least partially mapped: 60 (100%)
- Complex/conditional text: 11

## Coverage by tier

| Tier | Pets | Full | Partial | Custom | No ability | At least partial |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 9 | 9 | 0 | 0 | 0 | 100% |
| 2 | 10 | 10 | 0 | 0 | 0 | 100% |
| 3 | 10 | 10 | 0 | 0 | 0 | 100% |
| 4 | 10 | 10 | 0 | 0 | 0 | 100% |
| 5 | 11 | 11 | 0 | 0 | 0 | 100% |
| 6 | 10 | 9 | 1 | 0 | 0 | 100% |

## Trigger distribution (level 1)

| Trigger | Count |
| --- | --- |
| faint | 16 |
| startOfBattle | 9 |
| hurt | 5 |
| startOfTurn | 5 |
| endOfTurn | 4 |
| summon | 4 |
| afterAttack | 3 |
| buy | 3 |
| sell | 3 |
| eat | 2 |
| knockOut | 2 |
| beforeAttack | 1 |
| levelUp | 1 |
| passive | 1 |
| unknown | 1 |

## Effect distribution (level 1)

| Effect | Count |
| --- | --- |
| modifyStats | 31 |
| dealDamage | 10 |
| summon | 8 |
| perk | 5 |
| shop | 5 |
| gold | 4 |
| food | 3 |
| copy | 2 |
| swallow | 1 |

## Target distribution (level 1)

| Target | Count |
| --- | --- |
| self | 13 |
| randomEnemy | 4 |
| randomFriend | 4 |
| triggeringPet | 4 |
| friend | 3 |
| friendBehind | 3 |
| nearestFriendAhead | 3 |
| allPets | 2 |
| adjacentPets | 1 |
| allEnemies | 1 |
| allFriends | 1 |
| firstEnemy | 1 |
| friendAhead | 1 |
| frontFriend | 1 |
| highestHealthEnemy | 1 |
| lastEnemy | 1 |
| lowestHealthEnemy | 1 |
| nearestFriendsAhead | 1 |
| nearestFriendsBehind | 1 |
| nearestPetAhead | 1 |

## No recognized effect

None.

## Partial mappings

| Pet | Tier | Ability text | Reason |
| --- | --- | --- | --- |
| Tiger | 6 | The friend ahead repeats their ability in battle as if they were level 1. | unknown trigger; conditional or multi-step text |

## Complex abilities

| Pet | Tier | Ability text | Status | Reason |
| --- | --- | --- | --- | --- |
| Snail | 2 | End turn: If you lost last battle, give the three nearest friends ahead +1 attack. | full | conditional or multi-step text |
| Badger | 3 | Faint: Deal 50% attack damage to adjacent pets. | full | conditional or multi-step text |
| Rabbit | 3 | Friendly ate food: Give them +1 health. Works 3 times per turn. | full | conditional or multi-step text |
| Bison | 4 | End turn: If this has a level 3 friend, gain +2 attack and +2 health. Works for 1 Bison. | full | conditional or multi-step text |
| Hippo | 4 | Knock out: Gain +3 attack and +3 health. Works 3 times per battle. | full | conditional or multi-step text |
| Cat | 6 | Shop food gives two times attack and health. Works 2 times per turn. | full | conditional or multi-step text |
| Dragon | 6 | Tier 1 friend bought: Give friends +1 attack and +1 health. Works 4 times per turn. | full | conditional or multi-step text |
| Fly | 6 | Friend faints: Summon one 4/4 Zombie Fly in its place. Works 3 times per turn. | full | conditional or multi-step text |
| Gorilla | 6 | Hurt: Gain Coconut. Works 1 times per turn. | full | conditional or multi-step text |
| Snake | 6 | Friend ahead attacks: Deal 5 damage to one random enemy. Works 5 times per turn. | full | conditional or multi-step text |
| Tiger | 6 | The friend ahead repeats their ability in battle as if they were level 1. | partial | unknown trigger; conditional or multi-step text |

## Suggested first engine primitives

- Triggers: faint, startOfBattle, hurt, startOfTurn, endOfTurn, summon, afterAttack, buy, sell, eat, knockOut, beforeAttack, levelUp, passive, unknown
- Effects: modifyStats, dealDamage, summon, perk, shop, gold, food, copy, swallow
- Targets: self, randomEnemy, randomFriend, triggeringPet, friend, friendBehind, nearestFriendAhead, allPets, adjacentPets, allEnemies, allFriends, firstEnemy, friendAhead, frontFriend, highestHealthEnemy, lastEnemy, lowestHealthEnemy, nearestFriendsAhead, nearestFriendsBehind, nearestPetAhead
- Custom watchlist: Snail, Badger, Rabbit, Bison, Hippo, Cat, Dragon, Fly, Gorilla, Snake, Tiger

## Food coverage (Turtle Pack)

- Foods found: 21 (full 21, partial 0, custom 0, none 0)

| Food | Text | Status | Effects |
| --- | --- | --- | --- |
| Apple | Give one pet +1 attack and +1 health. | full | modifyStats |
| Honey | Give one pet the Honey Perk. Faint → Summon one 1/1 Bee. | full | summon, perk |
| Cupcake | Give one pet +3 attack and +3 health until end of battle. | full | modifyStats |
| Meat Bone | Give one pet the Meat Bone Perk. Attack with +3 damage. | full | dealDamage, perk |
| Sleeping Pill | Make one pet faint. Always on sale! | full | destroy |
| Cake | Give one pet the Cake Perk. End turn → Increase sell value by 1 gold. | full | perk, gold |
| Garlic | Give one pet the Garlic Perk. Take 2 less damage. | full | shield, perk |
| Salad Bowl | Give two random pets +1 attack and +1 health. | full | modifyStats |
| Canned Food | Give all current and future shop pets +1 attack and +1 health. | full | modifyStats, shop |
| Pear | Give one pet +2 attack and +2 health. | full | modifyStats |
| Chili | Give one pet the Chili Perk. Attack second enemy for 5 damage. | full | dealDamage, perk |
| Chocolate | Give one pet Experience. | full | experience |
| Sushi | Give three random pets +1 attack and +1 health. | full | modifyStats |
| Melon | Give one pet the Melon Perk. Take 20 less damage, once. | full | shield, perk |
| Mushroom | Give one pet the Mushroom Perk. Faint → Come back as a 1/1. | full | perk, revive |
| Pizza | Give two random pets +2 attack and +2 health. | full | modifyStats |
| Steak | Give one pet the Steak Perk. Attack with +20 damage, once. | full | dealDamage, perk |
| Bread Crumbs | Give one pet +1 attack. | full | modifyStats |
| Milk | Milk (Level 1 Cow): Give one pet +1 attack and +2 health. Better Milk (Level 2 Cow): Give one pet +2 attack and +4 health. Best Milk (Level 3 Cow): Give one pet +3 attack and +6 health. | full | modifyStats |
| Coconut | Ignore damage once. | full | shield |
| Peanut | Knockout any pet attacked and hurt by this. | full | destroy |

## Parse issues

None.

## Notes

- Coverage is a keyword-level estimate, not proof that the engine can execute the ability.
- Level 1 text is used for the main coverage count; levels 2 and 3 are stored in the JSON.
- `reference/` contains SAP-derived research data and must stay out of any published build.
