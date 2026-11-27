# pt-sap Web UI Design

## Context and goals

The Web UI must make a dense auto-battler readable without hiding rules. The
visual direction follows the supplied shadcn references:

- [shadcn SKILL.md](https://github.com/bergside/awesome-design-skills/blob/main/skills/shadcn/SKILL.md)
- [shadcn DESIGN.md](https://github.com/bergside/awesome-design-skills/blob/main/skills/shadcn/DESIGN.md)

The goal is a minimal monochrome interface with explicit hierarchy, compact
information density and strong battle feedback.

## Tokens and foundations

- Background: `#f8fafc`
- Surface: `#ffffff`
- Foreground: `#111827`
- Primary: `#111111`
- Secondary: `#f1f5f9`
- Border: `#e2e8f0`
- Muted text: `#64748b`
- Success: `#16a34a`
- Warning: `#d97706`
- Danger: `#dc2626`
- Radius: `4px`, `8px`
- Spacing: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`
- Type scale: `12px`, `14px`, `16px`, `20px`, `24px`, `32px`
- Body font: Geist/Inter/Noto Sans SC fallback stack
- Labels and numeric metadata: Fira Code fallback stack

## Components

### Header

- Shows turn, wins, lives, gold, shop tier and last result.
- New game and end turn remain visible without scrolling.
- Sticky at the top on desktop; wraps into two rows on narrow screens.

### Team cards

- Show Chinese name, English name, tier, level, XP, attack, health, battle
  bonus, Perk, full ability and sell value.
- `selected`: black border plus 1px ring.
- `merge-target`: warning border plus 1px ring.
- Empty slots use a dashed neutral border and must never compete with real data.

### Shop cards

- Show price, tier, frozen/generated state, ability and target type.
- Disabled purchases use 45% opacity and retain a readable label.
- Generated food slots are systematically separated from ordinary roll slots.
- Show current gold inside the shop heading next to the roll action. Buys,
  sales and rolls display a textual `+N 金` / `-N 金` float plus a short
  directional wallet pulse.
- Shop cards must not collapse into one full-width card per row in narrow
  windows. Use two columns below `640px`, three columns from `640px` through
  the stacked-layout breakpoint, and auto-fit columns in the desktop shop panel.
- Keep complete ability text visible; compact spacing and type size rather than
  truncating game information.

### Perk glossary

- Perk tags and Perk names embedded in pet abilities are interactive terms.
- Food names embedded in abilities, such as Apple in Worm's description, are
  also interactive Food terms. Perks and Foods use distinct link treatments.
- Hover or keyboard focus shows a popover; click/tap pins the definition.
- Mobile uses a bottom-sheet-style popover with an explicit close control.
- Every Perk term includes its name and complete mechanical description.
- Battle-card zoom/hit transforms must not dismiss a hovered Perk explanation;
  non-pinned explanations close only after real pointer movement leaves both
  the term and the popover.

### Battle theater

- Shows both complete lineups, levels, stats, abilities and Perks.
- Every battle card shows its current 1-based battle position. Faints compact
  the surviving cards forward, and summons are inserted at the event-provided
  position rather than filling the first empty card.
- Attack event highlights the actor; damage event shakes the target, floats the
  damage number and updates health.
- Attack narration must not claim raw damage as final damage. Damage-reduction
  Perks display their mitigation result, including attacks reduced to zero.
- Faint, summon, buff and Perk events have distinct visible states.
- Playback provides play/pause, replay, speed and progress controls.
- The result banner identifies win/loss/draw and surviving counts.

### Run end

- A dedicated modal must appear when the tenth win or fifth loss is reached.
- Victory uses a distinct success treatment, WIN mark and red-ribbon notice when
  the final lineup contains a level-three pet.
- It shows the end reason, final turn, wins, lives, seed and final lineup.
- The final lineup reuses a read-only version of the complete team cards:
  five ordered slots, full abilities, stats, XP, Perk glossary terms and sell
  values. Missing pets remain visible as empty slots.
- Primary actions are “再来一局” and “重看最终战斗”.
- The final battle replay is labeled as the final battle before it ends.

## Accessibility

- All controls are keyboard reachable and have a 2px visible focus ring.
- Color is never the sole signal: outcome text, event narration and card state
  labels accompany color changes.
- Motion respects `prefers-reduced-motion`.
- Empty states and disabled states use text in addition to styling.
- Relayout must preserve controls at 320px width without horizontal page
  overflow; team and battle rows scroll inside their own regions when needed.

## Content and tone

- Labels are short, concrete Chinese action phrases.
- Ability, food and Perk names are shown in Chinese; English names remain as a
  secondary source reference.
- Avoid ambiguous labels such as “确定” when “购买并合并” or “喂给已选宠物” is
  more specific.

## Anti-patterns

- Do not hide ability text behind hover-only UI.
- Do not use color alone to indicate injured, buffed, selected or target state.
- Do not add decorative gradients, glass effects or oversized radii; the design
  uses neutral surfaces and 4/8px radii.
- Do not use icons as the only label for destructive or purchase actions.
- Do not remove frozen/generated slot state from the battle or shop view.

## QA checklist

- [ ] Header controls work at desktop and mobile widths.
- [ ] Every team card exposes stats, level/XP, ability, Perks and sell value.
- [ ] Every shop card exposes price, state and complete localized effect.
- [ ] Keyboard focus is visible on all buttons, cards and dialog controls.
- [x] Perk terms expose descriptions on hover, focus and click/tap.
- [x] Gold is shown beside the shop and animates textual gain/loss feedback.
- [ ] Disabled controls recover after a successful network request.
- [ ] Battle replay shows both teams before playback starts.
- [ ] Tenth win and fifth loss both produce an unmistakable run-end modal.
- [ ] Attack, damage, faint, summon and battle-end states are distinguishable.
- [ ] Playback can pause, resume, replay and change speed.
- [ ] Shop capacity matches tier and generated-slot rules.
- [x] Shop remains a compact multi-column grid at 390px, 600px and 760px.
- [x] Battle replay places summons at their actual 1-based battle position.
- [ ] `prefers-reduced-motion` reduces battle and spinner animation.
