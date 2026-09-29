# Pet stat formula

The pet snapshot fits this shared model:

- Damage = damage per level × (level + 20)
- Health = health per level × (level + 20)

This is inferred from observations, not an extracted game formula. All **43 observations / 86 displayed stats** in [pets snapshot.txt](pets%20snapshot.txt) match the model with the display rules below.

## Coefficients

| Rarity | Pet | Damage per level | Health per level |
| --- | --- | ---: | ---: |
| Common | Ember Fist | 0.5 | 1.5 |
| Common | Magic Wool | 0.25 | 2.5 |
| Common | Spark Mouse | 0.75 | 1 |
| Uncommon | Flame Wing | 2.25 | 3 |
| Uncommon | Life Horn | 0.75 | 7.5 |
| Uncommon | Snow Fang | 1.5 | 4.5 |
| Rare | Blaze Tail | 22.5 | 30 |
| Rare | Frost Claw | 7.5 | 75 |
| Rare | Storm Eye | 15 | 45 |
| Epic | Arcane Paw | 225 | 300 |
| Epic | Glacier Fist | 150 | 450 |
| Epic | Vital Root | 75 | 750 |
| Legendary | Echo Wing | 2,250 | 3,000 |
| Legendary | Phantom Gaze | 1,500 | 4,500 |
| Legendary | Star Feather | 750 | 7,500 |
| Mythic | Celestial Mind | 6,750 | 9,000 |
| Mythic | Halo Hare | 4,500 | 13,500 |
| Mythic | Radiant Talon | 2,250 | 22,500 |

## Derivation and cross-checks

Arcane Paw rises from 26,100 damage at level 96 to 26,325 at level 97: +225 per level. Its intercept is 26,100 / 225 − 96 = 20. Its health rises by 300, with the same offset. The level 216 and 217 observations independently fit both rates.

The additional level-ups also fit:

| Pet | Level | Calculated damage | Calculated health | Observed display |
| --- | ---: | ---: | ---: | --- |
| Frost Claw | 225 | 1,837.5 | 18,375 | 1.84k / 18.38k |
| Glacier Fist | 219 | 35,850 | 107,550 | 35.85k / 107.55k |
| Star Feather | 175 | 146,250 | 1,462,500 | 146.25k / 1.46M |
| Celestial Mind | 96 | 783,000 | 1,044,000 | 783.00k / 1.04M |

Celestial Mind's level 95 to 96 damage increase is exactly 6,750, confirming the inferred Mythic damage progression for that pet. Its two health displays have coarse million-unit rounding. Halo Hare and Radiant Talon each have one observed level; their coefficients assume the shared +20 offset and match those observations. These two pets still lack direct before/after checks.

The coefficients can also be grouped into three damage/health pairs: (0.75, 1), (0.5, 1.5), and (0.25, 2.5), with rarity factors 1, 3, 30, 300, 3,000, and 9,000. This pattern supports the single-level Mythic estimates.

## Display and calculation

The observations are consistent with truncating values below 1,000 to whole numbers, and rounding k/M values to two decimal places. For example, Ember Fist at level 91 calculates to 55.5 damage and 166.5 health, displayed in the snapshot as 55 and 166.

The calculator retains fractional values for totals and shows full calculated numbers in the pet table. Whether the game itself retains all fractions internally cannot be determined solely from these displayed observations. No pet level cap was supplied; the wings level cap does not apply to pets.

## Spreadsheet comparison

- **Dungeon Rush Stat Calc.xlsx**, `Sheet3!B19:G36`: pet levels and stats are manually entered, without a growth formula. Several levels disagree with the new observations' model. For example, Ember Fist's 81 damage / 243 health corresponds to level 142 under this model, but its listed level is 125.
- **Dungeon Rush.xlsx**, `Damage!M1:X5` and `'Health Calulator '!M1:X5` (the latter sheet name includes a trailing space): pet stats are entered as constants without matching pet levels.

The source workbooks are unchanged. The calculator retains its original default levels but replaces the inconsistent fixed stat values with the model above. The snapshot's name **Blaze Tail** replaces the old imported **Blaze Trail** spelling.
