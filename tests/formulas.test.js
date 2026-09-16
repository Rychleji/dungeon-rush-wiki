'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'common.js'), 'utf8');

function loadGame(readyState = 'complete', namespace = {}) {
    const listeners = {};
    const window = { DungeonRush: namespace };
    const document = {
        readyState,
        getElementById() { return null; },
        addEventListener(event, listener) { listeners[event] = listener; }
    };

    vm.runInNewContext(source, { window, document });
    return { game: window.DungeonRush, listeners };
}

function near(actual, expected) {
    assert.ok(
        Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)),
        actual + ' should be close to ' + expected
    );
}

test('shared formulas are available without a relic calculator on the page', () => {
    const { game } = loadGame();
    assert.equal(typeof game.formulas.itemStat, 'function');
    assert.equal(typeof game.formulas.wingsStats, 'function');
    assert.equal(typeof game.formulas.capeStats, 'function');
    assert.equal(game.data.gear.length, 6);
});

test('shared formulas are available before DOM ready and preserve other wiki features', () => {
    const namespace = { anotherCalculator: {} };
    const { game, listeners } = loadGame('loading', namespace);
    assert.equal(game, namespace);
    assert.ok(game.anotherCalculator);
    near(game.formulas.itemStat(45, 0, 1), 45.675);
    assert.equal(typeof listeners.DOMContentLoaded, 'function');
    assert.doesNotThrow(() => listeners.DOMContentLoaded());
});

test('shared data retains gear bases, weapon types, and confirmed rarities', () => {
    const { data } = loadGame().game;
    assert.deepEqual(Array.from(data.tiers, tier => tier.value), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(Array.from(data.capeTiers, tier => tier.multiplier), [1, 2, 3, 4, 6, 10]);
    assert.deepEqual(Array.from(data.weaponTypes, type => type.value), [9, 7]);
    assert.deepEqual(
        Array.from(data.gear, item => [item.id, item.stat, item.base]),
        [
            ['weapon', 'damage', undefined],
            ['helmet', 'health', 45],
            ['gloves', 'damage', 6],
            ['backpack', 'health', 30],
            ['necklace', 'health', 20],
            ['ring', 'damage', 6]
        ]
    );
});

test('item stats retain tier scaling, level scaling, and optional tier offsets', () => {
    const { itemStat } = loadGame().game.formulas;
    near(itemStat(45, 0, 1), 45.675);
    near(itemStat(45, 2, 50), 787.5);
    near(itemStat(6, 4, 100), 1500);
    near(itemStat(7, 0, 100), 17.5);
    near(itemStat(30, 1, 1, 1), 304.5);
});

test('relic bonuses and merge values cover empty, low, and highest UI levels', () => {
    const formulas = loadGame().game.formulas;
    for (const [level, percent, multiplier, value] of [
        [0, 0, 1, 0],
        [1, 1, 1.01, 1],
        [2, 4, 1.04, 3],
        [11, 121, 2.21, 59049]
    ]) {
        assert.equal(formulas.relicBonusPercent(level), percent);
        near(formulas.relicMultiplier(level), multiplier);
        assert.equal(formulas.relicValue(level), value);
    }
    assert.equal(formulas.relicValue(-1), 0);
});

test('gear helpers apply relics without rounding and default to an empty relic', () => {
    const { gearStat } = loadGame().game.formulas;
    near(gearStat(45, 2, 50), 787.5);
    near(gearStat(45, 2, 50, 0), 787.5);
    near(gearStat(45, 2, 50, 11), 1740.375);
    near(gearStat(7, 0, 100, 2), 18.2);
});

test('wings return both stats with the extra tier and one relic multiplier', () => {
    const { wingsStats } = loadGame().game.formulas;
    const empty = wingsStats(1, 1);
    near(empty.health, 304.5);
    near(empty.damage, 91.35);

    const boosted = wingsStats(1, 50, 10);
    near(boosted.health, 1050);
    near(boosted.damage, 315);
});

test('cape progression retains percentage units and unknown-rarity fallback', () => {
    const { capeBonus } = loadGame().game.formulas;
    near(capeBonus('common', 1), 5);
    near(capeBonus('common', 50), 9.9);
    near(capeBonus('common', 100), 14.9);
    near(capeBonus('legendary', 100), 89.4);
    near(capeBonus('mythic', 100), 149);
    near(capeBonus('unknown', 1), 5);
});

test('cape relic boosts the bonus itself before it becomes a total multiplier', () => {
    const { capeStats } = loadGame().game.formulas;
    const empty = capeStats('common', 1);
    near(empty.baseBonus, 5);
    near(empty.effectiveBonus, 5);
    near(empty.multiplier, 1.05);

    const boosted = capeStats('mythic', 100, 11);
    near(boosted.baseBonus, 149);
    near(boosted.effectiveBonus, 329.29);
    near(boosted.multiplier, 4.2929);
});


test('wings stop scaling at level 100 for every calculator', () => {
    const { wingsStats } = loadGame().game.formulas;
    for (const tier of [0, 4, 9]) {
        const atCap = wingsStats(tier, 100, 11);
        const aboveCap = wingsStats(tier, 150, 11);
        assert.equal(aboveCap.health, atCap.health);
        assert.equal(aboveCap.damage, atCap.damage);
        assert.ok(wingsStats(tier, 99, 11).health < atCap.health);
    }
});

test('observed Divine equipment stats agree with the shared ring and necklace bases', () => {
    const { data, formulas } = loadGame().game;
    const ring = data.gear.find(item => item.id === 'ring');
    const necklace = data.gear.find(item => item.id === 'necklace');
    assert.equal((formulas.itemStat(ring.base, 9, 94) / 1000).toFixed(2), '457.27');
    assert.equal((formulas.itemStat(necklace.base, 9, 69) / 1000000).toFixed(2), '1.29');
});

test('character totals add gear and selected pets before additive percentage bonuses', () => {
    const { characterStats } = loadGame().game.formulas;
    const loadout = {
        weaponType: 'ranged',
        gear: Object.fromEntries(['weapon', 'helmet', 'gloves', 'backpack', 'necklace', 'ring', 'wings']
            .map(slot => [slot, { tier: slot === 'wings' ? 1 : 2, level: 100, relicLevel: 0 }])),
        petsActive: [],
        cape: { rarity: 'common', level: 1, relicLevel: 0 },
        bonuses: { damage: 10, ranged: 20, melee: 99, health: 30, crit: 100 }
    };
    const withoutPets = characterStats(loadout);
    near(withoutPets.gearDamage, 700);
    near(withoutPets.gearHealth, 3125);
    near(withoutPets.damageMultiplier, 1.35);
    near(withoutPets.healthMultiplier, 1.35);
    near(withoutPets.damage, 945);
    near(withoutPets.criticalDamage, 1937.25);

    loadout.petsActive = [true];
    const withMonkey = characterStats(loadout);
    assert.equal(withMonkey.petDamage, 81);
    assert.equal(withMonkey.petHealth, 243);
    near(withMonkey.damage - withoutPets.damage, 109.35);
    near(withMonkey.health - withoutPets.health, 328.05);
});

test('character calculator uses the same gear, wings, cape, and enchantment rules', () => {
    const formulas = loadGame().game.formulas;
    const result = formulas.characterStats({
        weaponType: 'melee',
        gear: {
            ring: { tier: 9, level: 94, relicLevel: 11 },
            wings: { tier: 3, level: 200, relicLevel: 7 }
        },
        cape: { rarity: 'mythic', level: 100, relicLevel: 11 },
        petsActive: []
    });
    near(result.gear.ring.total, formulas.gearStat(6, 9, 94, 11));
    near(result.wings.total.health, formulas.wingsStats(3, 100, 7).health);
    near(result.wings.total.damage, formulas.wingsStats(3, 100, 7).damage);
    near(result.cape.effectiveBonus, 329.29);
    near(result.cape.bonus, 180.29);
    near(result.damage, result.gearDamage * 4.2929);
});

test('damage applies critical defense to the bonus before weapon-specific defense', () => {
    const { damageStats } = loadGame().game.formulas;
    const input = {
        baseDamage: 1000, criticalDamage: 300, criticalDefense: 50,
        meleeDefense: 300, rangedDefense: 100, weaponType: 'ranged'
    };
    let result = damageStats(input);
    near(result.criticalMultiplier, 4.05);
    near(result.effectiveCriticalMultiplier, 2.525);
    near(result.normalHit, 500);
    near(result.criticalHit, 1262.5);
    near(result.megaHit, 2525);
    result = damageStats({ ...input, weaponType: 'melee', criticalDefense: 150 });
    near(result.criticalDefense, 100);
    near(result.effectiveCriticalMultiplier, 1);
    near(result.normalHit, 250);
    near(result.criticalHit, 250);
    near(result.megaHit, 500);
});

test('mega and triple rolls take priority; block only scales expected attack damage', () => {
    const { damageStats } = loadGame().game.formulas;
    const result = damageStats({
        baseDamage: 1000, criticalDamage: 95,
        criticalChance: 50, megaChance: 20,
        tripleChance: 25, doubleChance: 50, blockChance: 10
    });
    near(result.normalChance, 0.4);
    near(result.criticalChance, 0.4);
    near(result.megaChance, 0.2);
    near(result.singleChance, 0.375);
    near(result.doubleChance, 0.375);
    near(result.tripleChance, 0.25);
    near(result.expectedHitMultiplier, 2);
    near(result.expectedHits, 1.875);
    near(result.expectedDamagePerAttack, 3375);
    near(result.normalHit, 1000);
});

test('lethal clamp suppresses thorns while lifesteal includes overkill', () => {
    const { damageStats } = loadGame().game.formulas;
    const input = { baseDamage: 1000, targetHealth: 500, lifesteal: 25, thorns: 50 };
    const lethal = damageStats(input);
    assert.equal(lethal.lethal, true);
    near(lethal.appliedDamage, 500);
    near(lethal.lifestealHeal, 250);
    near(lethal.thornsReflect, 0);

    const surviving = damageStats({ ...input, targetHealth: 2000 });
    assert.equal(surviving.lethal, false);
    near(surviving.appliedDamage, 1000);
    near(surviving.thornsReflect, 500);

    const unspecified = damageStats({ ...input, targetHealth: 0 });
    assert.equal(unspecified.lethal, false);
    near(unspecified.appliedDamage, 1000);
});

test('damage chances clamp to 0..100 and invalid inputs cannot divide by zero', () => {
    const { damageStats } = loadGame().game.formulas;
    const result = damageStats({
        baseDamage: 1000, megaChance: 200, criticalChance: 200,
        tripleChance: 200, doubleChance: 200, blockChance: 200,
        rangedDefense: -100, lifesteal: -5, criticalDamage: NaN
    });
    near(result.megaChance, 1);
    near(result.criticalChance, 0);
    near(result.tripleChance, 1);
    near(result.doubleChance, 0);
    near(result.expectedDamagePerAttack, 0);
    near(result.normalHit, 1000);
    near(result.lifestealHeal, 0);
});


function relicLoadout(budget, seed = 0) {
    const ids = ['weapon', 'helmet', 'gloves', 'backpack', 'necklace', 'ring', 'wings', 'cape'];
    const owned = [];
    for (let level = 1, rest = budget; rest > 0; level++, rest = Math.floor(rest / 3)) {
        for (let count = 0; count < rest % 3; count++) owned.push(level);
    }
    assert.ok(owned.length <= ids.length);
    const loadout = {
        weaponType: seed % 2 ? 'ranged' : 'melee',
        gear: {},
        cape: { rarity: seed % 2 ? 'mythic' : 'common', level: seed % 2 ? 100 : 1, relicLevel: owned[7] || 0 }
    };
    ids.slice(0, 7).forEach((id, index) => {
        loadout.gear[id] = {
            tier: (index * 3 + seed) % 10,
            level: [1, 94, 100, 150][(index + seed) % 4],
            relicLevel: owned[index] || 0
        };
    });
    return loadout;
}

// Independent exhaustive oracle: try every affordable level in every slot.
// This deliberately does not sort gear or prune states by stat gain.
function bruteRelics(game, loadout, budget) {
    const f = game.formulas;
    const costs = [0];
    for (let level = 1; level <= 11 && f.relicValue(level) <= budget; level++) {
        costs.push(f.relicValue(level));
    }
    const items = game.data.gear.map(item => {
        const input = loadout.gear[item.id];
        const base = f.itemStat(item.weapon ? (loadout.weaponType === 'ranged' ? 7 : 9) : item.base,
            input.tier, input.level);
        return { health: item.stat === 'health' ? base : 0, damage: item.stat === 'damage' ? base : 0 };
    });
    items.push(f.wingsStats(loadout.gear.wings.tier, loadout.gear.wings.level));
    const cape = f.capeBonus(loadout.cape.rarity, loadout.cape.level);
    const best = { power: 0, damage: 0, health: 0 };
    function visit(index, remaining, health, damage) {
        for (let level = 0; level < costs.length && costs[level] <= remaining; level++) {
            const multiplier = 1 + level * level / 100;
            if (index === items.length) {
                const capeMultiplier = 1 + cape * multiplier / 100;
                const finalHealth = health * capeMultiplier;
                const finalDamage = damage * capeMultiplier;
                best.health = Math.max(best.health, finalHealth);
                best.damage = Math.max(best.damage, finalDamage);
                best.power = Math.max(best.power, finalHealth / 30 + finalDamage / 9);
            } else {
                visit(index + 1, remaining - costs[level],
                    health + items[index].health * multiplier, damage + items[index].damage * multiplier);
            }
        }
    }
    visit(0, budget, 0, 0);
    return best;
}

function applyRelicLevels(loadout, levels) {
    const next = structuredClone(loadout);
    for (const [id, level] of Object.entries(levels)) {
        if (id === 'cape') next.cape.relicLevel = level;
        else next.gear[id].relicLevel = level;
    }
    return next;
}

test('all three relic objectives match exhaustive searches over small inventories', () => {
    const game = loadGame().game;
    for (const budget of [0, 1, 2, 3, 6, 9, 12, 27, 40]) {
        for (const seed of [0, 1]) {
            const loadout = relicLoadout(budget, seed);
            const unchanged = structuredClone(loadout);
            const expected = bruteRelics(game, loadout, budget);
            for (const objective of ['power', 'damage', 'health']) {
                const result = game.formulas.recommendRelics(loadout, objective);
                near(result.score, expected[objective]);
                assert.ok(result.usedValue <= budget);
                assert.equal(result.usedValue + result.remainingValue, budget);
                assert.equal(Object.values(result.levels).reduce((sum, level) =>
                    sum + game.formulas.relicValue(level), 0), result.usedValue);
                const stats = game.formulas.characterStats({
                    ...applyRelicLevels(loadout, result.levels), petsActive: []
                });
                near(result.health, stats.health);
                near(result.damage, stats.damage);
            }
            assert.deepEqual(loadout, unchanged);
        }
    }
});

test('a level-8 relic can split into a stronger distribution without increasing value', () => {
    const f = loadGame().game.formulas;
    const input = { weaponType: 'melee', gear: { helmet: { tier: 0, level: 1, relicLevel: 8 } } };
    const result = f.recommendRelics(input);
    assert.equal(result.budget, 2187);
    assert.ok(Object.values(result.levels).filter(level => level > 0).length > 1);
    assert.ok(Math.max(...Object.values(result.levels)) < 8);
    assert.ok(result.usedValue <= 2187);
    assert.ok(result.score > result.before.score);
});

test('three level-1 relics merge when a level-2 weapon relic gives the most damage', () => {
    const f = loadGame().game.formulas;
    const result = f.recommendRelics({
        weaponType: 'melee',
        gear: {
            weapon: { tier: 9, level: 100, relicLevel: 0 },
            helmet: { tier: 0, level: 1, relicLevel: 1 },
            gloves: { tier: 0, level: 1, relicLevel: 1 },
            backpack: { tier: 0, level: 1, relicLevel: 1 }
        }
    }, 'damage');
    assert.equal(result.levels.weapon, 2);
    assert.equal(result.budget, 3);
    assert.equal(result.usedValue, 3);
    assert.equal(Object.values(result.levels).filter(level => level > 0).length, 1);
});

test('unused relic value remains available when switching objectives', () => {
    const f = loadGame().game.formulas;
    const loadout = relicLoadout(2187);
    const power = f.recommendRelics(loadout, 'power');
    const next = applyRelicLevels(loadout, power.levels);
    const damage = f.recommendRelics(next, 'damage', power.remainingValue);
    assert.equal(damage.budget, 2187);
    assert.ok(damage.usedValue <= 2187);
    assert.ok(damage.damage >= power.damage * (1 - 1e-12));
});

test('maximum inventory and repeated recommendations stay within level and value limits', () => {
    const game = loadGame().game;
    const loadout = relicLoadout(0);
    Object.values(loadout.gear).forEach(input => { input.relicLevel = 11; });
    loadout.cape.relicLevel = 11;
    for (const objective of ['power', 'damage', 'health']) {
        const result = game.formulas.recommendRelics(loadout, objective);
        assert.equal(result.budget, 472392);
        assert.equal(result.usedValue, 472392);
        assert.ok(Object.values(result.levels).every(level => level === 11));
    }
    const mixed = relicLoadout(2187, 1);
    const first = game.formulas.recommendRelics(mixed, 'power');
    const again = game.formulas.recommendRelics(applyRelicLevels(mixed, first.levels), 'power', first.remainingValue);
    assert.deepEqual(again.levels, first.levels);
    assert.equal(again.usedValue, first.usedValue);
});

test('relic optimization uses the wings level cap and rejects invalid inventory', () => {
    const f = loadGame().game.formulas;
    const loadout = relicLoadout(27);
    loadout.gear.wings.level = 100;
    const atCap = f.recommendRelics(loadout);
    loadout.gear.wings.level = 1000;
    const overCap = f.recommendRelics(loadout);
    near(atCap.score, overCap.score);
    assert.deepEqual(atCap.levels, overCap.levels);
    assert.throws(() => f.recommendRelics(loadout, 'unknown'));
    assert.throws(() => f.recommendRelics(loadout, 'power', -1));
    loadout.gear.weapon.relicLevel = 12;
    assert.throws(() => f.recommendRelics(loadout));
});


test('power values 30 health and 9 damage equally, following the wings ratio', () => {
    const { powerScore } = loadGame().game.formulas;
    near(powerScore(30, 0), 1);
    near(powerScore(0, 9), 1);
    near(powerScore(30, 9), 2);
    near(powerScore(300, 90), 20);
});

test('Most power uses weighted stat gains even when existing health and damage are unbalanced', () => {
    const { recommendRelics } = loadGame().game.formulas;
    const result = recommendRelics({
        weaponType: 'melee',
        gear: {
            helmet: { tier: 9, level: 100, relicLevel: 0 },
            backpack: { tier: 9, level: 100, relicLevel: 0 },
            necklace: { tier: 9, level: 100, relicLevel: 0 },
            ring: { tier: 0, level: 1, relicLevel: 1 }
        }
    }, 'power');
    assert.equal(result.levels.helmet, 1);
    assert.equal(result.levels.wings, 0);
    assert.equal(result.usedValue, 1);
    near(result.score, result.health / 30 + result.damage / 9);
    near(result.before.score, result.before.health / 30 + result.before.damage / 9);
});
