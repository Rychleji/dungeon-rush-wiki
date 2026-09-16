'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const script = fs.readFileSync(path.join(__dirname, '..', 'common.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'common.css'), 'utf8');

(async function () {
    const browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent('<div id="relic-calculator"></div><div id="dungeon-rush-calculator"></div>' +
            '<div id="unrelated"><button class="tab-btn">Unrelated</button><input type="number"></div>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: script });
        assert.equal(await page.locator('#relic-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await page.locator('#dungeon-rush-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await page.locator('#dungeon-rush-calculator input[type=checkbox]').count(), 18);
        assert.equal(await page.locator('#dungeon-rush-calculator .gear-calc-equipment tbody tr').count(), 8);
        assert.equal(await page.locator('#dr-panel-damage').isVisible(), false);
        assert.equal(await page.locator('#gear-calc-total-health').textContent(), '202');
        assert.equal(await page.locator('#gear-calc-total-damage').textContent(), '53');
        assert.deepEqual(await page.evaluate(() => {
            const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
            return ids.filter((id, index) => ids.indexOf(id) !== index);
        }), []);

        const relicDamage = await page.locator('#gear-calc-total-damage').textContent();
        await page.locator('#dr-pets-none').click();
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '0');
        assert.equal(await page.locator('#dr-total-damage').textContent(), '51');
        await page.locator('#dr-pet-0').check();
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '81');
        assert.equal(await page.locator('#dr-pets-health').textContent(), '243');
        await page.locator('#dr-pets-all').click();
        assert.equal(await page.locator('#dungeon-rush-calculator input[type=checkbox]:checked').count(), 18);
        assert.equal(await page.locator('#gear-calc-total-damage').textContent(), relicDamage);

        await page.locator('#dr-stat-ring-tier').selectOption('9');
        await page.locator('#dr-stat-ring-level').fill('94');
        assert.match(await page.locator('#dr-stat-ring-result').textContent(), /457,265\.35/);
        await page.locator('#dr-stat-wings-level').fill('100');
        const wingsAtCap = await page.locator('#dr-stat-wings-result').textContent();
        await page.locator('#dr-stat-wings-level').fill('200');
        assert.equal(await page.locator('#dr-stat-wings-result').textContent(), wingsAtCap);

        await page.locator('#gear-calc-wings-level').fill('100');
        const relicWingsAtCap = await page.locator('#gear-calc-result-wings').textContent();
        await page.locator('#gear-calc-wings-level').fill('200');
        assert.equal(await page.locator('#gear-calc-result-wings').textContent(), relicWingsAtCap);

        await page.locator('#dr-tab-damage').click();
        assert.equal(await page.locator('#dr-panel-stats').isVisible(), false);
        assert.equal(await page.locator('#dr-normal-hit').textContent(), '1,000');
        assert.equal(await page.locator('#dr-critical-hit').textContent(), '1,000');
        await page.locator('#dr-damage-criticalDefense').fill('0');
        assert.equal(await page.locator('#dr-critical-hit').textContent(), '4,050');
        await page.locator('#dr-damage-rangedDefense').fill('100');
        assert.equal(await page.locator('#dr-normal-hit').textContent(), '500');
        await page.locator('#dr-damage-blockChance').fill('100');
        assert.equal(await page.locator('#dr-expected-damage').textContent(), '0');
        assert.equal(await page.locator('#dr-normal-hit').textContent(), '500');

        const statDamage = Number((await page.locator('#dr-total-damage').textContent()).replace(/,/g, ''));
        await page.locator('#dr-use-stat-damage').click();
        assert.equal(Math.round(Number(await page.locator('#dr-damage-baseDamage').inputValue())), statDamage);

        await page.locator('#dr-tab-damage').focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#dr-tab-stats').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#dr-panel-stats').isVisible(), true);
        assert.equal(await page.locator('#unrelated button').getAttribute('aria-selected'), null);

        const before = await page.locator('#dungeon-rush-calculator').innerHTML();
        await page.addScriptTag({ content: script });
        assert.equal(await page.locator('#dungeon-rush-calculator').innerHTML(), before);
        assert.equal(await page.locator('#dr-stat-ring-level').inputValue(), '94');

        await page.locator('#dr-stat-ring-level').fill('');
        assert.doesNotMatch(await page.locator('#dr-stat-ring-result').textContent(), /NaN|Infinity/);
        await page.locator('#dr-stat-ring-level').fill('-5');
        assert.doesNotMatch(await page.locator('#dr-stat-ring-result').textContent(), /NaN|Infinity/);

        // Both initializers also work when the script runs before article markup exists.
        const early = await browser.newPage();
        early.on('pageerror', error => errors.push(error.message));
        await early.setContent('<script>' + script + '</script>' +
            '<div id="relic-calculator"></div><div id="dungeon-rush-calculator"></div>');
        assert.equal(await early.locator('#dungeon-rush-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await early.locator('#relic-calculator').getAttribute('data-initialized'), 'true');

        // The new calculator is usable without the relic calculator, including at mobile widths.
        const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
        mobile.on('pageerror', error => errors.push(error.message));
        await mobile.setContent('<div id="dungeon-rush-calculator"></div>');
        await mobile.addStyleTag({ content: css });
        await mobile.addScriptTag({ content: script });
        assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await mobile.locator('#dr-tab-damage').click();
        assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await mobile.locator('#dr-expected-damage').isVisible(), true);


        const optimizer = await browser.newPage({ viewport: { width: 1000, height: 850 }, locale: 'en-US' });
        optimizer.on('pageerror', error => errors.push(error.message));
        await optimizer.setContent('<div id="relic-calculator"></div><div id="dungeon-rush-calculator"></div>');
        await optimizer.addStyleTag({ content: css });
        await optimizer.addScriptTag({ content: script });
        const objective = optimizer.locator('#gear-calc-objective');
        const recommend = optimizer.locator('#gear-calc-recommend');
        assert.equal(await objective.inputValue(), 'power');
        assert.deepEqual(await objective.locator('option').allTextContents(), ['Most power', 'Most Damage', 'Most Health']);
        await recommend.click();
        assert.match(await optimizer.locator('#gear-calc-recommend-status').textContent(), /No relics/);

        function gearSnapshot() {
            return optimizer.locator('#relic-calculator input, #relic-calculator select').evaluateAll(inputs =>
                inputs.filter(input => !input.classList.contains('gear-calc-relic') && input.id !== 'gear-calc-objective')
                    .map(input => [input.id, input.className, input.getAttribute('data-slot'), input.value]));
        }
        function relicBudget() {
            return optimizer.locator('#relic-calculator .gear-calc-relic').evaluateAll(inputs =>
                inputs.reduce((sum, input) => sum + (Number(input.value) ? 3 ** (Number(input.value) - 1) : 0), 0));
        }

        async function recommendedBudget() {
            const status = await optimizer.locator("#gear-calc-recommend-status").textContent();
            return Number(status.match(/of (.+) level-1/)[1].replace(/\D/g, ""));
        }

        const originalGear = await gearSnapshot();
        const otherCalculator = await optimizer.locator('#dungeon-rush-calculator').innerHTML();
        await optimizer.locator('.gear-calc-relic[data-slot="helmet"]').selectOption('8');
        await recommend.click();
        assert.deepEqual(await gearSnapshot(), originalGear);
        assert.equal(await relicBudget(), 2106);
        assert.match(await optimizer.locator('#gear-calc-unassigned').textContent(), /81 level-1/);
        assert.equal(await recommendedBudget(), 2187);
        assert.equal(await optimizer.locator('#dungeon-rush-calculator').innerHTML(), otherCalculator);

        const repeatedLevels = await optimizer.locator('#relic-calculator .gear-calc-relic').evaluateAll(inputs =>
            inputs.map(input => input.value));
        await recommend.click();
        assert.deepEqual(await optimizer.locator('#relic-calculator .gear-calc-relic').evaluateAll(inputs =>
            inputs.map(input => input.value)), repeatedLevels);
        assert.equal(await recommendedBudget(), 2187);

        for (const mode of ['damage', 'health']) {
            await objective.selectOption(mode);
            await recommend.click();
            assert.deepEqual(await gearSnapshot(), originalGear);
            assert.ok(await relicBudget() <= 2187);
            assert.equal(await recommendedBudget(), 2187);
        }

        // Gear edits preserve inventory; manually editing relics establishes a new budget.
        await optimizer.locator('.gear-calc-tier[data-slot="weapon"]').selectOption('9');
        await recommend.click();
        assert.equal(await recommendedBudget(), 2187);
        await optimizer.locator('.gear-calc-relic[data-slot="helmet"]').selectOption('0');
        assert.equal(await optimizer.locator('#gear-calc-unassigned').isVisible(), false);
        const revisedBudget = await relicBudget();
        await recommend.click();
        assert.equal(await recommendedBudget(), revisedBudget);

        await optimizer.setViewportSize({ width: 390, height: 844 });
        assert.equal(await recommend.isVisible(), true);
        assert.equal(await objective.isVisible(), true);
        assert.ok(await optimizer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

        if (process.env.CALCULATOR_SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.CALCULATOR_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'calculators-desktop.png'), fullPage: true });
            await mobile.screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'calculator-mobile.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
        console.log('PASS: both calculators, shared styles, inputs, pets, damage transfer, tabs, duplicate loading, DOM readiness, mobile layout, and relic optimization.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
