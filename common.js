(function () {
    'use strict';

    function initRelicCalculator() {
        var root = document.getElementById('relic-calculator');

        if (!root) {
            return;
        }

        if (root.getAttribute('data-initialized') === 'true') {
            return;
        }

        root.setAttribute('data-initialized', 'true');


        /* =========================================================
         * CONSTANTS
         * ========================================================= */

        var TIER_SCALER = Math.sqrt(10);
        var LEVEL_SCALER = 0.015;

        /*
         * Normal gear:
         *
         * Common    = 0
         * Uncommon  = 1
         * ...
         * Divine    = 9
         */
        var tiers = [
            { name: 'Common',    value: 0 },
            { name: 'Uncommon',  value: 1 },
            { name: 'Rare',      value: 2 },
            { name: 'Epic',      value: 3 },
            { name: 'Legendary', value: 4 },
            { name: 'Mythic',    value: 5 },
            { name: 'Artifact',  value: 6 },
            { name: 'Ancient',   value: 7 },
            { name: 'Immortal',  value: 8 },
            { name: 'Divine',    value: 9 }
        ];

        /*
         * Cape rarity multipliers.
         *
         * Only tiers for which we currently have confirmed data
         * are included.
         */
        var capeTiers = [
            { name: 'Common',    value: 'common',    multiplier: 1 },
            { name: 'Uncommon',  value: 'uncommon',  multiplier: 2 },
            { name: 'Rare',      value: 'rare',      multiplier: 3 },
            { name: 'Epic',      value: 'epic',      multiplier: 4 },
            { name: 'Legendary', value: 'legendary', multiplier: 6 },
            { name: 'Mythic',    value: 'mythic',    multiplier: 10 }
        ];

        /*
         * Normal gear.
         *
         * If the game/wiki calls "Backpack" something else,
         * only change the "name" text below.
         */
        var gear = [
            {
                id: 'weapon',
                name: 'Weapon',
                stat: 'damage',
                weapon: true
            },
            {
                id: 'helmet',
                name: 'Helmet',
                stat: 'health',
                base: 45
            },
            {
                id: 'gloves',
                name: 'Gloves',
                stat: 'damage',
                base: 6
            },
            {
                id: 'backpack',
                name: 'Backpack',
                stat: 'health',
                base: 30
            },
            {
                id: 'necklace',
                name: 'Necklace',
                stat: 'health',
                base: 20
            },
            {
                id: 'ring',
                name: 'Ring',
                stat: 'damage',
                base: 6
            }
        ];


        /* =========================================================
         * FORMULAS
         * ========================================================= */

        function itemStat(baseStat, tier, level, tierOffset) {
            tierOffset = tierOffset || 0;

            return baseStat *
                Math.pow(TIER_SCALER, tier + tierOffset) *
                (1 + LEVEL_SCALER * level);
        }

        /*
         * Relic:
         *
         * Lv1  = +1%
         * Lv2  = +4%
         * ...
         * Lv11 = +121%
         */
        function relicBonusPercent(level) {
            return level * level;
        }

        function relicMultiplier(level) {
            return 1 + relicBonusPercent(level) / 100;
        }

        /*
         * Value expressed as number of level-1 relics.
         *
         * Lv1 = 1
         * Lv2 = 3
         * Lv3 = 9
         * ...
         */
        function relicValue(level) {
            if (level <= 0) {
                return 0;
            }

            return Math.pow(3, level - 1);
        }

        /*
         * Cape:
         *
         * Common:
         * Lv1   = 5.0%
         * Lv50  = 9.9%
         * Lv100 = 14.9%
         *
         * Other rarities multiply that base progression.
         */
        function capeBonus(rarity, level) {
            var multiplier = 1;

            capeTiers.forEach(function (tier) {
                if (tier.value === rarity) {
                    multiplier = tier.multiplier;
                }
            });

            return ((49 + level) / 10) * multiplier;
        }


        /* =========================================================
         * HTML HELPERS
         * ========================================================= */

        function makeTierOptions() {
            var html = '';

            tiers.forEach(function (tier) {
                html +=
                    '<option value="' + tier.value + '">' +
                    tier.name +
                    '</option>';
            });

            return html;
        }

        function makeCapeTierOptions() {
            var html = '';

            capeTiers.forEach(function (tier) {
                html +=
                    '<option value="' + tier.value + '">' +
                    tier.name +
                    '</option>';
            });

            return html;
        }

        function makeRelicOptions() {
            var html =
                '<option value="0">Empty (+0%)</option>';

            var level;

            for (level = 1; level <= 11; level++) {
                html +=
                    '<option value="' + level + '">' +
                    'Lv. ' + level +
                    ' (+' + relicBonusPercent(level) + '%)' +
                    '</option>';
            }

            return html;
        }


        var tierOptions = makeTierOptions();
        var capeTierOptions = makeCapeTierOptions();
        var relicOptions = makeRelicOptions();


        /* =========================================================
         * BUILD NORMAL GEAR ROWS
         * ========================================================= */

        var rows = '';

        gear.forEach(function (item) {
            var extra = '';

            if (item.weapon) {
                extra =
                    '<select ' +
                        'class="gear-calc-weapon-type" ' +
                        'id="gear-calc-weapon-type">' +
                        '<option value="9">Melee</option>' +
                        '<option value="7">Ranged</option>' +
                    '</select>';
            }

            rows +=
                '<tr>' +

                    '<th scope="row">' +
                        '<div>' + item.name + '</div>' +
                        extra +
                    '</th>' +

                    '<td>' +
                        '<select ' +
                            'class="gear-calc-tier" ' +
                            'data-slot="' + item.id + '">' +
                            tierOptions +
                        '</select>' +
                    '</td>' +

                    '<td>' +
                        '<input ' +
                            'class="gear-calc-input gear-calc-level" ' +
                            'type="number" ' +
                            'min="1" ' +
                            'step="1" ' +
                            'value="1" ' +
                            'data-slot="' + item.id + '">' +
                    '</td>' +

                    '<td>' +
                        '<select ' +
                            'class="gear-calc-relic" ' +
                            'data-slot="' + item.id + '">' +
                            relicOptions +
                        '</select>' +
                    '</td>' +

                    '<td ' +
                        'class="gear-calc-stat" ' +
                        'id="gear-calc-result-' + item.id + '">' +
                        '—' +
                    '</td>' +

                '</tr>';
        });


        /* =========================================================
         * WINGS
         * ========================================================= */

        rows +=
            '<tr>' +

                '<th scope="row">Wings</th>' +

                '<td>' +
                    '<select id="gear-calc-wings-tier">' +
                        tierOptions +
                    '</select>' +
                '</td>' +

                '<td>' +
                    '<input ' +
                        'id="gear-calc-wings-level" ' +
                        'class="gear-calc-input" ' +
                        'type="number" ' +
                        'min="1" ' +
                        'step="1" ' +
                        'value="1">' +
                '</td>' +

                '<td>' +
                    '<select ' +
                        'id="gear-calc-wings-relic" ' +
                        'class="gear-calc-relic">' +
                        relicOptions +
                    '</select>' +
                '</td>' +

                '<td ' +
                    'class="gear-calc-stat" ' +
                    'id="gear-calc-result-wings">' +
                    '—' +
                '</td>' +

            '</tr>';


        /* =========================================================
         * CAPE
         * ========================================================= */

        rows +=
            '<tr>' +

                '<th scope="row">Cape</th>' +

                '<td>' +
                    '<select id="gear-calc-cape-tier">' +
                        capeTierOptions +
                    '</select>' +
                '</td>' +

                '<td>' +
                    '<input ' +
                        'id="gear-calc-cape-level" ' +
                        'class="gear-calc-input" ' +
                        'type="number" ' +
                        'min="1" ' +
                        'step="1" ' +
                        'value="1">' +
                '</td>' +

                '<td>' +
                    '<select ' +
                        'id="gear-calc-cape-relic" ' +
                        'class="gear-calc-relic">' +
                        relicOptions +
                    '</select>' +
                '</td>' +

                '<td ' +
                    'class="gear-calc-stat" ' +
                    'id="gear-calc-result-cape">' +
                    '—' +
                '</td>' +

            '</tr>';


        /* =========================================================
         * MAIN HTML
         * ========================================================= */

        root.innerHTML =
            '<div class="gear-calc">' +

                '<table class="gear-calc-table">' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Item</th>' +
                            '<th>Tier</th>' +
                            '<th>Level</th>' +
                            '<th>Relic</th>' +
                            '<th>Calculated stat</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

                '<div class="gear-calc-results">' +

                    '<div class="gear-calc-result">' +
                        '<span>Total Health</span>' +
                        '<strong id="gear-calc-total-health">0</strong>' +
                    '</div>' +

                    '<div class="gear-calc-result">' +
                        '<span>Total Damage</span>' +
                        '<strong id="gear-calc-total-damage">0</strong>' +
                    '</div>' +

                    '<div class="gear-calc-result">' +
                        '<span>Relic Value</span>' +
                        '<strong id="gear-calc-relic-value">0</strong>' +
                        '<small>level-1 relic equivalents</small>' +
                    '</div>' +

                '</div>' +

            '</div>';


        /* =========================================================
         * INPUT HELPERS
         * ========================================================= */

        function getLevel(selector) {
            var element = root.querySelector(selector);

            if (!element) {
                return 1;
            }

            var value = parseInt(element.value, 10);

            if (isNaN(value) || value < 1) {
                return 1;
            }

            return value;
        }

        function getInteger(selector) {
            var element = root.querySelector(selector);

            if (!element) {
                return 0;
            }

            return parseInt(element.value, 10) || 0;
        }

        function getValue(selector) {
            var element = root.querySelector(selector);

            if (!element) {
                return '';
            }

            return element.value;
        }


        /* =========================================================
         * DISPLAY HELPERS
         * ========================================================= */

        function formatStat(value) {
            return Math.round(value).toLocaleString();
        }

        function formatPercent(value) {
            var rounded = Math.round(value * 100) / 100;

            return rounded.toLocaleString() + '%';
        }


        /* =========================================================
         * CALCULATION
         * ========================================================= */

        function calculate() {
            var health = 0;
            var damage = 0;
            var totalRelicValue = 0;


            /* -----------------------------------------------------
             * NORMAL GEAR
             * ----------------------------------------------------- */

            gear.forEach(function (item) {
                var tier = getInteger(
                    '.gear-calc-tier[data-slot="' +
                    item.id +
                    '"]'
                );

                var level = getLevel(
                    '.gear-calc-level[data-slot="' +
                    item.id +
                    '"]'
                );

                var relicLevel = getInteger(
                    '.gear-calc-relic[data-slot="' +
                    item.id +
                    '"]'
                );

                var baseStat = item.base;

                if (item.weapon) {
                    baseStat = parseFloat(
                        getValue('#gear-calc-weapon-type')
                    ) || 9;
                }

                var rawStat = itemStat(
                    baseStat,
                    tier,
                    level,
                    0
                );

                var finalStat =
                    rawStat * relicMultiplier(relicLevel);

                totalRelicValue += relicValue(relicLevel);

                if (item.stat === 'health') {
                    health += finalStat;
                } else {
                    damage += finalStat;
                }

                var result =
                    root.querySelector(
                        '#gear-calc-result-' + item.id
                    );

                result.textContent =
                    (item.stat === 'health'
                        ? 'Health: '
                        : 'Damage: ') +
                    formatStat(finalStat);
            });


            /* -----------------------------------------------------
             * WINGS
             *
             * Wings use the normal item formula with +1 tier offset.
             *
             * Health base = 30
             * Damage base = 9
             * ----------------------------------------------------- */

            var wingsTier =
                getInteger('#gear-calc-wings-tier');

            var wingsLevel =
                getLevel('#gear-calc-wings-level');

            var wingsRelic =
                getInteger('#gear-calc-wings-relic');

            var wingsRelicMultiplier =
                relicMultiplier(wingsRelic);

            var wingsHealth =
                itemStat(
                    30,
                    wingsTier,
                    wingsLevel,
                    1
                ) *
                wingsRelicMultiplier;

            var wingsDamage =
                itemStat(
                    9,
                    wingsTier,
                    wingsLevel,
                    1
                ) *
                wingsRelicMultiplier;

            health += wingsHealth;
            damage += wingsDamage;

            totalRelicValue +=
                relicValue(wingsRelic);

            root.querySelector(
                '#gear-calc-result-wings'
            ).innerHTML =
                '<div>Health: ' +
                    formatStat(wingsHealth) +
                '</div>' +

                '<div>Damage: ' +
                    formatStat(wingsDamage) +
                '</div>';


            /* -----------------------------------------------------
             * CAPE
             *
             * Cape adds a percentage of all other health/damage.
             *
             * Relic boosts the cape's percentage itself.
             * ----------------------------------------------------- */

            var capeTier =
                getValue('#gear-calc-cape-tier');

            var capeLevel =
                getLevel('#gear-calc-cape-level');

            var capeRelic =
                getInteger('#gear-calc-cape-relic');

            var baseCapeBonus =
                capeBonus(capeTier, capeLevel);

            var effectiveCapeBonus =
                baseCapeBonus *
                relicMultiplier(capeRelic);

            totalRelicValue +=
                relicValue(capeRelic);

            root.querySelector(
                '#gear-calc-result-cape'
            ).innerHTML =
                '<div>Base: ' +
                    formatPercent(baseCapeBonus) +
                '</div>' +

                '<div>With relic: ' +
                    formatPercent(effectiveCapeBonus) +
                '</div>';


            /*
             * Cape applies after all other equipment has been added.
             */
            var capeMultiplier =
                1 + effectiveCapeBonus / 100;

            health *= capeMultiplier;
            damage *= capeMultiplier;


            /* -----------------------------------------------------
             * TOTALS
             * ----------------------------------------------------- */

            root.querySelector(
                '#gear-calc-total-health'
            ).textContent =
                formatStat(health);

            root.querySelector(
                '#gear-calc-total-damage'
            ).textContent =
                formatStat(damage);

            root.querySelector(
                '#gear-calc-relic-value'
            ).textContent =
                totalRelicValue.toLocaleString();
        }


        /* =========================================================
         * EVENTS
         * ========================================================= */

        root.addEventListener('input', calculate);
        root.addEventListener('change', calculate);

        calculate();
    }


    /*
     * Wait until the article DOM exists.
     */
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initRelicCalculator
        );
    } else {
        initRelicCalculator();
    }

}());