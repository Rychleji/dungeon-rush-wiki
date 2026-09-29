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
        await page.setContent('<!doctype html><div id="relic-calculator"></div><div id="dungeon-rush-calculator"></div><div id="defense-calculator"></div>' +
            '<div id="unrelated"><button class="tab-btn">Unrelated</button><input type="number"></div>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: script });
        assert.equal(await page.locator('#relic-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await page.locator('#dungeon-rush-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await page.locator('#dungeon-rush-calculator input[type=checkbox]').count(), 18);
        assert.equal(await page.locator('#dungeon-rush-calculator .gear-calc-equipment tbody tr').count(), 8);
        assert.equal(await page.locator('#dr-panel-damage').isVisible(), false);
        assert.equal(await page.locator('#gear-calc-total-health').textContent(), '202');
        assert.equal(await page.locator('#gear-calc-total-damage').textContent(), '51');
        const weaponChoices = page.locator('.gear-calc-weapon-type input');
        assert.deepEqual(await weaponChoices.evaluateAll(inputs => inputs.map(input => input.value)), ['ranged', 'melee']);
        assert.equal(await weaponChoices.nth(0).isChecked(), true);
        await weaponChoices.nth(1).check();
        assert.equal(await weaponChoices.nth(0).isChecked(), false);
        assert.equal(await page.locator('#gear-calc-total-damage').textContent(), '53');
        await weaponChoices.nth(0).check();
        assert.equal(await page.locator('#gear-calc-total-damage').textContent(), '51');

        assert.equal(await page.locator('#defense-calculator').getAttribute('data-initialized'), 'true');
        for (const [value, expected] of [['0', '100.00%'], ['100', '50.00%'], ['-100', '50.00%'], ['300', '25.00%'], ['12.5', '88.89%'], ['', '100.00%']]) {
            await page.locator('#defense-calc-value').fill(value);
            assert.equal(await page.locator('#defense-calc-multiplier').textContent(), expected);
        }
        await page.locator('#defense-calc-value').fill('100');
        assert.deepEqual(await page.evaluate(() => {
            const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
            return ids.filter((id, index) => ids.indexOf(id) !== index);
        }), []);

        const relicDamage = await page.locator('#gear-calc-total-damage').textContent();
        await page.locator('#dr-pets-none').click();
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '0');
        assert.equal(await page.locator('#dr-total-damage').textContent(), '51');
        await page.locator('#dr-pet-0').check();
        assert.equal(await page.locator('.gear-calc-pets input[type=number]').count(), 18);
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '72.50');
        assert.equal(await page.locator('#dr-pets-health').textContent(), '217.50');
        await page.locator('#dr-pet-level-0').fill('91');
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '55.50');
        assert.equal(await page.locator('#dr-pets-health').textContent(), '166.50');
        await page.locator('#dr-pet-0').uncheck();
        await page.locator('#dr-pet-level-0').fill('92');
        assert.equal(await page.locator('#dr-pet-damage-0').textContent(), '56');
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '0');
        await page.locator('#dr-pet-0').check();
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '56');
        for (const invalid of ['', '-5', '0']) {
            await page.locator('#dr-pet-level-0').fill(invalid);
            assert.equal(await page.locator('#dr-pets-damage').textContent(), '10.50');
        }
        await page.locator('#dr-pet-level-0').fill('91.9');
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '55.50');
        await page.locator('#dr-pet-level-0').fill('125');
        await page.locator('#dr-pets-none').click();
        for (const [index, level, damage, health] of [
            [7, '225', '1,837.50', '18,375'], [10, '219', '35,850', '107,550'],
            [14, '175', '146,250', '1,462,500'], [15, '96', '783,000', '1,044,000']
        ]) {
            await page.locator('#dr-pet-level-' + index).fill(level);
            await page.locator('#dr-pet-' + index).check();
            assert.equal(await page.locator('#dr-pet-damage-' + index).textContent(), damage);
            assert.equal(await page.locator('#dr-pet-health-' + index).textContent(), health);
        }
        assert.equal(await page.locator('#dr-pets-damage').textContent(), '966,937.50');
        assert.equal(await page.locator('#dr-pets-health').textContent(), '2,632,425');
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
        const defenseBefore = await page.locator('#defense-calculator').innerHTML();
        await page.addScriptTag({ content: script });
        assert.equal(await page.locator('#dungeon-rush-calculator').innerHTML(), before);
        assert.equal(await page.locator('#dr-stat-ring-level').inputValue(), '94');
        assert.equal(await page.locator('#defense-calculator').innerHTML(), defenseBefore);
        assert.equal(await page.locator('#defense-calc-value').inputValue(), '100');
        assert.equal(await page.locator('#dr-pet-level-15').inputValue(), '96');

        await page.locator('#dr-stat-ring-level').fill('');
        assert.doesNotMatch(await page.locator('#dr-stat-ring-result').textContent(), /NaN|Infinity/);
        await page.locator('#dr-stat-ring-level').fill('-5');
        assert.doesNotMatch(await page.locator('#dr-stat-ring-result').textContent(), /NaN|Infinity/);

        // All initializers also work when the script runs before article markup exists.
        const early = await browser.newPage();
        early.on('pageerror', error => errors.push(error.message));
        await early.setContent('<!doctype html><script>' + script + '</script>' +
            '<div id="relic-calculator"></div><div id="dungeon-rush-calculator"></div><div id="defense-calculator"></div>');
        assert.equal(await early.locator('#dungeon-rush-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await early.locator('#relic-calculator').getAttribute('data-initialized'), 'true');
        assert.equal(await early.locator('#defense-calculator').getAttribute('data-initialized'), 'true');

        // The new calculator is usable without the relic calculator, including at mobile widths.
        const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
        mobile.on('pageerror', error => errors.push(error.message));
        await mobile.setContent('<!doctype html><div id="dungeon-rush-calculator"></div>');
        await mobile.addStyleTag({ content: css });
        await mobile.addScriptTag({ content: script });
        assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await mobile.locator('#dr-tab-damage').click();
        assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await mobile.locator('#dr-expected-damage').isVisible(), true);


        const optimizer = await browser.newPage({ viewport: { width: 1000, height: 850 }, locale: 'en-US' });
        optimizer.on('pageerror', error => errors.push(error.message));
        await optimizer.setContent('<!doctype html><div id="relic-calculator"></div><div id="dungeon-rush-calculator"></div><div id="defense-calculator"></div>');
        await optimizer.addStyleTag({ content: css });
        await optimizer.addScriptTag({ content: script });
        await optimizer.clock.install();
        const objective = optimizer.locator('#gear-calc-objective');
        const recommend = optimizer.locator('#gear-calc-recommend');
        assert.equal(await objective.inputValue(), 'power');
        assert.deepEqual(await objective.locator('option').allTextContents(), ['Most power', 'Most Damage', 'Most Health']);
        await recommend.click();
        assert.match(await optimizer.locator('#gear-calc-recommend-status').textContent(), /No relics/);

        function gearSnapshot() {
            return optimizer.locator('#relic-calculator input, #relic-calculator select').evaluateAll(inputs =>
                inputs.filter(input => !input.classList.contains('gear-calc-relic') && input.id !== 'gear-calc-objective')
                    .map(input => [input.id, input.className, input.getAttribute('data-slot'), input.value, input.checked]));
        }
        function relicBudget() {
            return optimizer.locator('#relic-calculator .gear-calc-relic').evaluateAll(inputs =>
                inputs.reduce((sum, input) => sum + (Number(input.value) ? 3 ** (Number(input.value) - 1) : 0), 0));
        }

        async function recommendedBudget() {
            const status = await optimizer.locator("#gear-calc-recommend-status").textContent();
            return Number(status.match(/of (.+) level-1/)[1].replace(/\D/g, ""));
        }

        const allTiers = optimizer.locator('#gear-calc-all-tiers');
        assert.equal(await allTiers.locator('option:not([disabled])').count(), 10);
        const relicTiers = optimizer.locator('.gear-calc-tier, #gear-calc-wings-tier');
        const initialColumnWidth = await optimizer.locator('.gear-calc-tier-heading').evaluate(el => el.parentElement.getBoundingClientRect().width);
        await optimizer.locator('#gear-calc-cape-tier').selectOption('mythic');
        const beforeTiers = await optimizer.locator('#relic-calculator input, #relic-calculator .gear-calc-relic').evaluateAll(els => els.map(el => [el.value, el.checked]));
        await allTiers.selectOption('9');
        assert.deepEqual(await relicTiers.evaluateAll(els => els.map(el => el.value)), Array(7).fill('9'));
        assert.equal(await optimizer.locator('#gear-calc-cape-tier').inputValue(), 'mythic');
        assert.deepEqual(await optimizer.locator('#relic-calculator input, #relic-calculator .gear-calc-relic').evaluateAll(els => els.map(el => [el.value, el.checked])), beforeTiers);
        assert.equal(await optimizer.locator('.gear-calc-tier-heading').evaluate(el => el.parentElement.getBoundingClientRect().width), initialColumnWidth);
        await optimizer.locator('.gear-calc-tier[data-slot="weapon"]').selectOption('8');
        assert.equal(await allTiers.inputValue(), '');
        await allTiers.selectOption('0');
        await optimizer.locator('#gear-calc-cape-tier').selectOption('common');
        assert.deepEqual(await relicTiers.evaluateAll(els => els.map(el => el.value)), Array(7).fill('0'));
        assert.equal(await optimizer.locator('.gear-calc-distribution').evaluate(el => el.firstElementChild.tagName), 'LABEL');
        assert.equal(await recommend.evaluate(el => el.classList.contains('wds-button')), true);

        // The unchanged column widths still fit the two compact controls.
        function compactControlsFit() {
            const group = document.querySelector('.gear-calc-weapon-type');
            const labels = Array.from(group.querySelectorAll('label'), el => el.getBoundingClientRect());
            const cell = group.closest('th').getBoundingClientRect();
            const heading = document.querySelector('.gear-calc-tier-heading');
            const select = heading.querySelector('select').getBoundingClientRect();
            return labels[0].top === labels[1].top && labels[0].right < labels[1].left &&
                labels[1].right <= cell.right && select.right <= heading.parentElement.getBoundingClientRect().right;
        }
        assert.ok(await optimizer.evaluate(compactControlsFit));
        const originalGear = await gearSnapshot();
        const otherCalculator = await optimizer.locator('#dungeon-rush-calculator').innerHTML();
        await optimizer.locator('.gear-calc-relic[data-slot="helmet"]').selectOption('8');
        await recommend.click();
        assert.deepEqual(await gearSnapshot(), originalGear);
        assert.equal(await relicBudget(), 2106);
        assert.match(await optimizer.locator('#gear-calc-unassigned').textContent(), /81 level-1/);
        assert.equal(await recommendedBudget(), 2187);
        assert.equal(await optimizer.locator('#dungeon-rush-calculator').innerHTML(), otherCalculator);

        // Check theme colors and the three-second feedback, including repeated clicks.
        for (const theme of [
            { bg: '#ffffff', text: '#222222', accent: '#6b32a8', hover: '#522681', label: '#ffffff' },
            { bg: '#202124', text: '#eeeeee', accent: '#e0b455', hover: '#efc76c', label: '#111111' }
        ]) {
            await optimizer.evaluate(theme => {
                const style = document.documentElement.style;
                for (const [name, value] of Object.entries({
                    '--theme-page-background-color': theme.bg, '--theme-page-text-color': theme.text,
                    '--theme-accent-color': theme.accent, '--theme-accent-color--hover': theme.hover,
                    '--theme-accent-label-color': theme.label
                })) style.setProperty(name, value);
                document.body.style.backgroundColor = theme.bg;
                document.body.style.color = theme.text;
                document.body.style.fontFamily = 'Arial, sans-serif';
            }, theme);
            await recommend.click();
            await optimizer.mouse.move(1, 1);
            const themeMatches = await optimizer.evaluate(theme => {
                const rgb = color => {
                    const el = document.createElement('span');
                    el.style.color = color;
                    document.body.appendChild(el);
                    const value = getComputedStyle(el).color;
                    el.remove();
                    return value;
                };
                const button = getComputedStyle(document.querySelector('#gear-calc-recommend'));
                const relics = Array.from(document.querySelectorAll('#relic-calculator .gear-calc-relic'));
                return button.backgroundColor === rgb(theme.accent) && button.color === rgb(theme.label) &&
                    relics.length === 8 && relics.every(el => {
                        const style = getComputedStyle(el);
                        return style.backgroundColor === rgb(theme.bg) && style.color === rgb(theme.text) &&
                            style.backgroundImage.includes('255, 196, 0');
                    });
            }, theme);
            assert.ok(themeMatches, 'Controls should use the active theme colors');
            await optimizer.clock.runFor(2000);
            assert.equal(await optimizer.locator('#relic-calculator').evaluate(el => el.classList.contains('gear-calc-relics-updated')), true);
            await recommend.click();
            await optimizer.clock.runFor(2000);
            assert.equal(await optimizer.locator('#relic-calculator').evaluate(el => el.classList.contains('gear-calc-relics-updated')), true);
            await optimizer.clock.runFor(1000);
            assert.equal(await optimizer.locator('#relic-calculator').evaluate(el => el.classList.contains('gear-calc-relics-updated')), false);
            assert.ok(await optimizer.locator('.gear-calc-relic').evaluateAll(els => els.every(el => getComputedStyle(el).backgroundImage === 'none')));
            if (process.env.CALCULATOR_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.CALCULATOR_SCREENSHOT_DIR, { recursive: true });
                await recommend.click();
                await optimizer.locator('#relic-calculator').screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'relic-' + (theme.bg === '#ffffff' ? 'light' : 'dark') + '.png') });
            }
        }

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
        const relicsBeforeBulkTierChange = await relicBudget();
        await allTiers.selectOption('6');
        assert.equal(await relicBudget(), relicsBeforeBulkTierChange);
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

        assert.ok(await optimizer.evaluate(compactControlsFit));

        const defenseOnly = await browser.newPage({ viewport: { width: 390, height: 844 } });
        defenseOnly.on('pageerror', error => errors.push(error.message));
        await defenseOnly.setContent('<!doctype html><div id="defense-calculator"></div>');
        await defenseOnly.addStyleTag({ content: css });
        await defenseOnly.addScriptTag({ content: script });
        await defenseOnly.locator('#defense-calc-value').fill('-300');
        assert.equal(await defenseOnly.locator('#defense-calc-multiplier').textContent(), '25.00%');
        assert.ok(await defenseOnly.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

        if (process.env.CALCULATOR_SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.CALCULATOR_SCREENSHOT_DIR, { recursive: true });
            await page.locator('.gear-calc-pets').screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'pet-levels.png') });
            await page.screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'calculators-desktop.png'), fullPage: true });
            await defenseOnly.screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'defense-mobile.png'), fullPage: true });
            await mobile.screenshot({ path: path.join(process.env.CALCULATOR_SCREENSHOT_DIR, 'calculator-mobile.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
        console.log('PASS: all three calculators, weapon radios, bulk tiers, themed button and timed relic highlights, defense formula, editable pet levels and totals, damage transfer, tabs, duplicate loading, DOM readiness, mobile layout, and relic optimization.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
