# Dungeon Rush wiki calculators

Paste `common.js` into `MediaWiki:Common.js` and `common.css` into `MediaWiki:Common.css`. There is no build step or separate runtime dependency.

## Article markup

For the original relic calculator:

```html
<div id="relic-calculator"></div>
```

For the stat and damage calculator:

```html
<div id="dungeon-rush-calculator"></div>
```

For the defense calculator:

```html
<div id="defense-calculator"></div>
```

All three may appear on the same page, once each. JavaScript creates every input, dropdown, button, tab, and result. Only these containers belong in article source; do not paste the standalone HTML document into an article.

The stat tab includes gear, wings, cape, enchantments, additional percentage bonuses, and pet selection. The damage tab handles critical/mega hits, defense, block, multi-hit chances, lifesteal, thorns, and optional target HP. Its copy button takes the current stat total damage; other damage inputs remain separately editable.

## Recommended relic distribution

The relic calculator defaults to Ranged; the adjacent radio buttons switch weapon type. The compact dropdown beside **Tier** sets all six gear tiers and wings together, leaving the cape unchanged. It shows **Mixed** when those tiers differ.

The optimization selector appears before the primary action button. A successful recommendation highlights all eight relic dropdowns with a gold tint for three seconds; another click restarts that interval. The button uses the Fandom `wds-button` class with the wiki's [theme accent and accessible label colors](https://community.fandom.com/wiki/Help:Color#Theming_variables). The highlight blends with the current page background.

In the relic calculator, enter gear and owned relics, choose **Most power**, **Most Damage**, or **Most Health**, then click **Recommended distribution**. Only relic dropdowns change; gear tiers, levels, and weapon type stay unchanged.

- **Most power** (default) maximizes final Health / 30 + Damage / 9, using the shared wings ratio. This values 30 health and 9 damage equally (equivalent to maximizing Damage + 0.3 × Health).
- **Most Damage** maximizes final damage, using health to break equal-damage ties.
- **Most Health** maximizes final health, using damage to break equal-health ties.

The available budget is the entered **Relic Value**, measured in level-1 equivalents: a level-L relic costs `3^(L-1)`, and an empty slot costs zero. Splitting and merging both use 3:1, so any allocation within that value can be formed. Recommendations consider all eight slots, including wings and cape, and stay within the supported relic levels 0–11.

Unassigned value is shown and retained for subsequent recommendations or gear changes. Manually changing a relic dropdown starts a new inventory from the currently selected relics and resets the reserve. The “Relic Value” result continues to show only assigned value.

The shared `recommendRelics(loadout, objective, spareValue)` function accepts the same gear/cape structure as `characterStats`, but ignores pets and percentage bonuses. Objective is `power`, `damage`, or `health`; the optional non-negative integer reserve defaults to zero. It returns `levels` keyed by gear ID plus `wings`/`cape`, `budget`, `usedValue`, `remainingValue`, final `health`/`damage`/`score`, and `before` totals. Input objects are not mutated.

The search orders pure-health and pure-damage slots by base stat, retains the best affordable combinations, and checks every wings/cape pairing. This finds the optimal objective within the budget, allowing for floating-point ties. Equal objective values prefer less relic value used, then fewer changed slots (after the other stat for damage/health modes).

## Shared game rules

Equipment data and pure formulas are available as `window.DungeonRush.data` and `window.DungeonRush.formulas` as soon as the script executes, including on pages without a calculator.

`DungeonRush.data` contains `tiers`, `capeTiers`, `gear`, `weaponTypes`, `wings`, `pets`, and `relics`. Calculators should read this data rather than copy it or modify it during a calculation.

| Formula | Result |
| --- | --- |
| `itemStat(baseStat, tier, level, tierOffset)` | Raw item stat; tier offset defaults to 0. |
| `gearStat(baseStat, tier, level, relicLevel)` | Gear stat with its relic/enchantment applied. |
| `wingsStats(tier, level, relicLevel)` | `health` and `damage`, including the extra tier, level-100 cap, and relic. |
| `capeBonus(rarity, level)` | Base cape bonus in percentage points (5 means +5%). |
| `capeStats(rarity, level, relicLevel)` | `baseBonus`, `effectiveBonus` (with relic), and `multiplier`. |
| `relicBonusPercent(level)` | Relic bonus in percentage points. |
| `relicMultiplier(level)` | Relic stat multiplier. |
| `powerScore(health, damage)` | Combined power, normalized by the shared wings health/damage bases. |
| `relicValue(level)` | Level-1 relic equivalents; 0 for an empty slot. |
| `enchantmentBonus(baseValue, level)` | Additional stat from the same square-level bonus used by relics. |
| `petStats(pet, level)` | Pet level, damage, and health from shared growth coefficients. |
| `characterStats(loadout)` | Equipment breakdowns, selected pet sums, multipliers, and damage/health/critical totals. |
| `defenseMultiplier(defense)` | Fraction of damage received: 100 / (100 + absolute defense). Invalid values use 0 defense. |
| `damageStats(input)` | Individual hit values, roll probabilities, expected damage, and lifesteal/thorns estimates. |

Normal gear tiers are numbered 0 (Common) through 9 (Divine). Cape rarities use lowercase string values from `capeTiers`. The equipment helpers `gearStat`, `wingsStats`, and `capeStats` default an omitted relic level to 0.

```js
var formulas = window.DungeonRush.formulas;
var helmetHealth = formulas.gearStat(45, 2, 50, 11);
var wings = formulas.wingsStats(1, 50, 10);
var cape = formulas.capeStats('common', 1);
var healthFromTheseItems = (helmetHealth + wings.health) * cape.multiplier;
```

Formulas return unrounded numbers. UI code validates levels and rounds only for display.

## Character and damage inputs

`characterStats(loadout)` accepts:

- `weaponType`: `melee` or `ranged` (default ranged).
- `gear`: an object keyed by shared equipment IDs, plus `wings`. Each supplied slot needs `{ tier, level, relicLevel }`; omitted slots use Common level 1 without enchantments.
- `cape`: `{ rarity, level, relicLevel }`, defaulting to Common level 1 without enchantments.
- `bonuses`: numeric percentage values for `damage`, `health`, `ranged`, `melee`, and `crit`.
- `petsActive`: booleans indexed like `DungeonRush.data.pets`. Omit to include all pets; pass `[]` to include none.
- `petLevels`: levels indexed like `DungeonRush.data.pets`; omitted entries use the original default levels.

It returns per-pet stats (`pets`, including unselected pets), equipment breakdowns (`gear`, `wings`, `cape`), `gearDamage`, `gearHealth`, `petDamage`, `petHealth`, `damageMultiplier`, `healthMultiplier`, `damage`, `health`, and `criticalDamage`.

`damageStats(input)` accepts `weaponType`, `baseDamage`, `criticalChance`, `megaChance`, `criticalDamage`, `tripleChance`, `doubleChance`, `knockbackChance`, `lifesteal`, `meleeDefense`, `rangedDefense`, `criticalDefense`, `blockChance`, `thorns`, and `targetHealth`. Numeric values default to zero; invalid/negative values become zero. Chances clamp to 0–100%, critical defense caps at 100, omitted weapon type uses ranged defense, and zero target HP ignores overkill.

Damage calculations retain the supplied roll order and hit-resolution math. Applied damage, lethal status, lifesteal, and thorns use expected damage per hit, so they are estimates when hit outcomes vary. Block affects expected attack damage, not individual hit values.

## Pet levels

Pet levels are editable in the stat calculator. Each pet uses `damagePerLevel × (level + 20)` and `healthPerLevel × (level + 20)`; the shared `petStats(pet, level)` returns unrounded `damage` and `health`, plus the effective `level`. Pass a definition from `DungeonRush.data.pets`. An omitted level uses that pet's existing default; supplied levels are whole numbers with a minimum of 1, and invalid values use 1. No pet level cap is assumed.

All 43 observed pet/level combinations match after display rounding. See [pet formulas and evidence](sources/pet-formulas.md) for the coefficients, rounding details, and the remaining limits of the observations. Calculations retain fractional stats; the pet table shows full calculated values rather than the game's shortened k/M labels.

## Defense calculator

Enter either melee or ranged **Defense**. The result is the percentage of incoming damage received: defense 0 gives **100%**, defense 100 gives **50%**, and defense 300 gives **25%**. Negative inputs use their absolute value, matching the supplied formula. A blank or invalid input uses zero defense.

## Integration decisions

- Ring base damage is **6** and necklace base health is **20**, shared by both calculators. These give **457.27k** damage for a Divine level-94 ring and **1.29M** health for a Divine level-69 necklace before enchantments, replacing the supplied calculator's swapped coefficients.
- Wings cap their effective level at **100** in both calculators.
- The imported “cloak” uses the shared cape formula.
- Pet stats use the level formula inferred from the supplied game snapshots. The spreadsheets contain fixed pet values that disagree with their listed levels; those values are superseded by calculated stats.
- All calculators use the existing neutral table, input, and result-card styles. The standalone theme, fonts, colors, and icons are not imported.

## Shared styling and additional calculators

Initializers add `dr-calculator` to their roots automatically. All CSS is scoped to that class. Existing `gear-calc` components are shared; `gear-calc-equipment` applies the five-column gear widths, while the pet table uses a separate layout.

Keep each calculator's DOM setup, input reading, and rendering in a separate initializer. Reuse the shared data and formulas, scope queries to its root, use distinct IDs, and register it in `initCalculators`. A separate wiki script using the shared API must run after `common.js`.

## Checks

Dependency-free formula tests:

```sh
node --test tests/formulas.test.js
```

Browser integration checks require Playwright and a browser (Edge on Windows):

```sh
node tests/browser-check.js
```

These cover all three calculators, generated controls, weapon radios, bulk gear tiers, relic recommendations and highlight timing, light/dark theme colors, defense percentages, input changes, pet selection, damage transfer, keyboard tabs, repeated loading, DOM readiness, and mobile overflow.
