'use strict';

const path = require('node:path');
const { tests } = require('@iobroker/testing');
const chai = require('chai');
const expect = chai.expect;

async function sleep(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}

async function assertStateChangesTo(harness, id, value, action) {
    const result = await waitUntilStateChangesTo(harness, id, value, action);

    expect(result, `${id} should change to value ${value}`).to.equal(value);
}

async function waitUntilStateChangesTo(harness, id, value, action) {
    return new Promise((resolve, reject) => {
        const ac = new AbortController();

        const timeout = setTimeout(() => {
            ac.abort();
            reject(`${id} not changed to value ${value} in expected time range`);
        }, 10 * 1000);

        harness.on('stateChange', async (changedId, state) => {
            if (id === changedId && state && state.val === value) {
                if (!ac.signal.aborted) {
                    clearTimeout(timeout);
                    ac.abort();

                    resolve(state.val);
                }
            }
        }, { signal: ac.signal });

        // Run action
        action && action();
    });
}

async function assertStateEquals(harness, id, value) {
    const state = await harness.states.getStateAsync(id);
    expect(state, `${id} should be an object (with value ${value})`).to.be.an('object');
    if (state) {
        expect(state.val, `${id} should have value ${value}`).to.equal(value);
    }
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    allowedExitCodes: [11],
    defineAdditionalTests({ suite }) {

        suite('sendTo', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;
            let adapterNamespace;

            const customNumberObjId = '0_userdata.0.myCustomState';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: [
                            {
                                id: 'energy',
                                name: 'total energy',
                                price: 0.28,
                                priceUnit: '€/kWh'
                            }
                        ]
                    }
                });

                adapterNamespace = `${harness.adapterName}.0`;

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId, {
                    type: 'state',
                    common: {
                        name: 'Test number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                    },
                    native: {},
                });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('enableStatistics - existing ID', async function () {
                this.timeout(60000);
                await sleep(1000);

                return new Promise((resolve) => {
                    harness.sendTo(adapterNamespace, 'enableStatistics', { id: customNumberObjId }, async (data) => {
                        expect(data.success).to.be.true;
                        expect(data.err).to.be.null;

                        const customObj = await harness.objects.getObjectAsync(customNumberObjId);

                        expect(customObj.common.custom[adapterNamespace].enabled).to.be.true;
                        expect(customObj.common.custom[adapterNamespace].avg).to.be.true; // default for number states

                        resolve();
                    });
                });
            });

            it('enableStatistics - non existing ID', async function () {
                this.timeout(60000);
                await sleep(1000);

                return new Promise((resolve) => {
                    harness.sendTo(adapterNamespace, 'enableStatistics', { id: 'this.id.does.not.exist' }, (data) => {
                        expect(data.success).to.be.false;
                        expect(data.err).to.be.not.empty;

                        resolve();
                    });
                });
            });

            it('groups', async function () {
                this.timeout(60000);
                await sleep(1000);

                return new Promise((resolve) => {
                    harness.sendTo(adapterNamespace, 'groups', '', (data) => {
                        expect(data).to.be.an('array');
                        //expect(data).to.have.lengthOf(1);

                        expect(data[0]).to.have.own.property('label');
                        expect(data[0]).to.have.own.property('value');

                        resolve();
                    });
                });
            });

            it('getCrons', async function () {
                this.timeout(60000);

                const validCrons = ['fiveMin', 'fifteenMinSave', 'hourSave', 'dayTriggerTimeCount', 'daySave', 'weekSave', 'monthSave', 'quarterSave', 'yearSave'];

                return new Promise((resolve) => {
                    harness.sendTo(adapterNamespace, 'getCrons', '', (data) => {
                        expect(data).to.be.an('array');
                        expect(data).to.have.lengthOf(9);

                        for (const cron of data) {
                            expect(cron).to.have.own.property('label');
                            expect(cron).to.have.own.property('value');

                            expect(cron.label, `cron.label is invalid`).to.be.oneOf(validCrons);
                            expect(cron.value, `cron.value must be a number - ${cron.label}`).to.be.a('number');
                            expect(cron.value, `cron.value must be in the future - ${cron.label}`).to.be.greaterThan(Date.now());
                        }

                        resolve();
                    });
                });
            });
        });

        suite('Test Number avg', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId = '0_userdata.0.myAvgNumber';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId, {
                    type: 'state',
                    common: {
                        name: 'Test average number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for this test
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: true, // relevant for this test
                                minmax: true, // relevant for this test
                                sumDelta: false,
                                sumIgnoreMinus: false,
                                groupFactor: 1,
                                logName: 'myAvgNumber'
                            }
                        }
                    },
                    native: {},
                });

                await harness.states.setStateAsync(customNumberObjId, { val: 10, ack: true });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const tempId = `${harness.adapterName}.0.temp.avg.${customNumberObjId}`;

                await assertStateEquals(harness, `${tempId}.last`, 10);
                await assertStateEquals(harness, `${tempId}.dayCount`, 1);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 10);

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 20, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${tempId}.last`, 20);
                await assertStateEquals(harness, `${tempId}.dayCount`, 2);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 15);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 50, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${tempId}.last`, 50);
                await assertStateEquals(harness, `${tempId}.dayCount`, 3);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 26.66667);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 20, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${tempId}.last`, 20);
                await assertStateEquals(harness, `${tempId}.dayCount`, 4);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 25);
            });
        });

        suite('Test Number sumDelta', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId = '0_userdata.0.mySumDeltaNumber';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId, {
                    type: 'state',
                    common: {
                        name: 'Test sum delta number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for all tests
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: true, // relevant for this test
                                sumIgnoreMinus: false, // relevant for this test
                                groupFactor: 1,
                                logName: 'mySumDeltaNumber'
                            }
                        }
                    },
                    native: {},
                });

                await harness.states.setStateAsync(customNumberObjId, { val: 10, ack: true });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId}`;

                await assertStateEquals(harness, `${saveId}.last`, 10);
                await assertStateEquals(harness, `${saveId}.delta`, 0);
                await assertStateEquals(harness, `${tempId}.day`, 0);

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 50, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 50);
                await assertStateEquals(harness, `${saveId}.delta`, 40);
                await assertStateEquals(harness, `${tempId}.day`, 40);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 1051.5, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 1051.5);
                await assertStateEquals(harness, `${saveId}.delta`, 1001.5);
                await assertStateEquals(harness, `${tempId}.day`, 1041.5);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 1010, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 1010);
                await assertStateEquals(harness, `${saveId}.delta`, -41.5);
                await assertStateEquals(harness, `${tempId}.day`, 1000);
            });
        });

        suite('Test Number sumDelta (sumIgnoreMinus)', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId = '0_userdata.0.mySumDeltaMinusNumber';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId, {
                    type: 'state',
                    common: {
                        name: 'Test sum delta number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for all tests
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: true, // relevant for this test
                                sumIgnoreMinus: true, // relevant for this test
                                groupFactor: 1,
                                logName: 'mySumDeltaMinusNumber'
                            }
                        }
                    },
                    native: {},
                });

                await harness.states.setStateAsync(customNumberObjId, { val: 10, ack: true });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId}`;

                await assertStateEquals(harness, `${saveId}.last`, 10);
                await assertStateEquals(harness, `${saveId}.delta`, 0);
                await assertStateEquals(harness, `${tempId}.day`, 0);

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 50, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 50);
                await assertStateEquals(harness, `${saveId}.delta`, 40);
                await assertStateEquals(harness, `${tempId}.day`, 40);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 1051.5, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 1051.5);
                await assertStateEquals(harness, `${saveId}.delta`, 1001.5);
                await assertStateEquals(harness, `${tempId}.day`, 1041.5);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 1010, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 1010);
                await assertStateEquals(harness, `${saveId}.delta`, 0);
                await assertStateEquals(harness, `${tempId}.day`, 1041.5);

                // Round 4
                await harness.states.setStateAsync(customNumberObjId, { val: 1011, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 1011);
                await assertStateEquals(harness, `${saveId}.delta`, 1);
                await assertStateEquals(harness, `${tempId}.day`, 1042.5);
            });
        });

        suite('Test Number sumDelta based on avg', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId = '0_userdata.0.mySumDeltaAvgNumber';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId, {
                    type: 'state',
                    common: {
                        name: 'Test sum delta avg number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for all tests
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: true, // relevant for this test
                                minmax: true, // relevant for this test
                                sumDelta: true, // relevant for this test
                                sumIgnoreMinus: false, // relevant for this test
                                groupFactor: 1,
                                logName: 'mySumDeltaAvgNumber'
                            }
                        }
                    },
                    native: {},
                });

                await harness.states.setStateAsync(customNumberObjId, { val: 10, ack: true });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.avg.${customNumberObjId}`;

                await assertStateEquals(harness, `${saveId}.last`, 10);
                await assertStateEquals(harness, `${saveId}.delta`, 0);
                await assertStateEquals(harness, `${tempId}.last`, 10);
                await assertStateEquals(harness, `${tempId}.dayCount`, 1);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 10);

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 30, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 30);
                await assertStateEquals(harness, `${saveId}.delta`, 20);
                await assertStateEquals(harness, `${tempId}.last`, 20);
                await assertStateEquals(harness, `${tempId}.dayCount`, 2);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 15);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 60, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 60);
                await assertStateEquals(harness, `${saveId}.delta`, 30);
                await assertStateEquals(harness, `${tempId}.last`, 30);
                await assertStateEquals(harness, `${tempId}.dayCount`, 3);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 20);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 100, ack: true });
                await sleep(500);

                await assertStateEquals(harness, `${saveId}.last`, 100);
                await assertStateEquals(harness, `${saveId}.delta`, 40);
                await assertStateEquals(harness, `${tempId}.last`, 40);
                await assertStateEquals(harness, `${tempId}.dayCount`, 4);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 25);
            });
        });

        suite('Test Number sumDelta (fast changing)', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId = '0_userdata.0.mySumDeltaFastNumber';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId, {
                    type: 'state',
                    common: {
                        name: 'Test sum delta number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for all tests
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: true, // relevant for this test
                                sumIgnoreMinus: false, // relevant for this test
                                groupFactor: 1,
                                logName: 'mySumDeltaFastNumber'
                            }
                        }
                    },
                    native: {},
                });

                await harness.states.setStateAsync(customNumberObjId, { val: 1000, ack: true });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                for (let i = 1; i <= 5; i++) {
                    await harness.states.setStateAsync(customNumberObjId, { val: 1000 + (i * 3.3), ack: true });
                }

                await sleep(3000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId}`;

                await assertStateEquals(harness, `${saveId}.last`, 1016.5);
                await assertStateEquals(harness, `${saveId}.delta`, 3.3);
                await assertStateEquals(harness, `${tempId}.day`, 16.5);
            });
        });

        suite('Test Boolean count', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customBooleanObjId = '0_userdata.0.myCountBoolean';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customBooleanObjId, {
                    type: 'state',
                    common: {
                        name: 'Test count boolean',
                        type: 'boolean',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for this test
                                count: true, // relevant for this test
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: false,
                                sumIgnoreMinus: false,
                                groupFactor: 1,
                                logName: 'myCountBoolean'
                            }
                        }
                    },
                    native: {},
                });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customBooleanObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const tempId = `${harness.adapterName}.0.temp.count.${customBooleanObjId}`;

                await assertStateChangesTo(harness, `${tempId}.day`, 10, () => {
                    for (let i = 0; i < 10; i++) {
                        harness.states.setState(customBooleanObjId, { val: true, ack: true });
                        harness.states.setState(customBooleanObjId, { val: false, ack: true });
                    }
                });
            });

            it('calculation (no false)', async function () {
                this.timeout(60000);
                await sleep(1000);

                const tempId = `${harness.adapterName}.0.temp.count.${customBooleanObjId}`;

                // just +1 (ignore other setState)
                for (let i = 0; i < 10; i++) {
                    await harness.states.setStateAsync(customBooleanObjId, { val: true, ack: true });
                }

                await sleep(1000);
                await assertStateEquals(harness, `${tempId}.day`, 11);
            });
        });

        suite('Test Boolean count to consumption', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customBooleanObjId = '0_userdata.0.myCountConsumptionBoolean';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: []
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customBooleanObjId, {
                    type: 'state',
                    common: {
                        name: 'Test count consumption boolean',
                        type: 'boolean',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for this test
                                count: false,
                                fiveMin: false,
                                sumCount: true,  // relevant for this test
                                impUnitPerImpulse: 3,  // relevant for this test
                                impUnit: 'Wh',  // relevant for this test
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: false,
                                sumIgnoreMinus: false,
                                groupFactor: 1,
                                logName: 'myCountConsumptionBoolean'
                            }
                        }
                    },
                    native: {},
                });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customBooleanObjId);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const tempId = `${harness.adapterName}.0.temp.sumCount.${customBooleanObjId}`;

                await assertStateChangesTo(harness, `${tempId}.day`, 30, () => {
                    for (let i = 0; i < 10; i++) {
                        harness.states.setState(customBooleanObjId, { val: true, ack: true });
                        harness.states.setState(customBooleanObjId, { val: false, ack: true });
                    }
                });
            });
        });

        suite('Test SumGroup based on sumDelta', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId1 = '0_userdata.0.mySumGroupByDeltaNumber1';
            const customNumberObjId2 = '0_userdata.0.mySumGroupByDeltaNumber2';

            before(async function () {
                this.timeout(60000);

                harness = getHarness();
                harness.changeAdapterConfig(harness.adapterName, {
                    native: {
                        impUnitPerImpulse: 1,
                        impFactor: 1,
                        timezone: 'Europe/Berlin',
                        groups: [
                            {
                                id: 'energy',
                                name: 'total energy',
                                price: 0.28,
                                priceUnit: '€/kWh'
                            }
                        ]
                    }
                });

                // Create test object
                await harness.objects.setObjectAsync(customNumberObjId1, {
                    type: 'state',
                    common: {
                        name: 'Test sum group by delta number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for this test
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: true, // relevant for this test
                                sumIgnoreMinus: true, // relevant for this test
                                groupFactor: 0.001, // relevant for this test
                                sumGroup: 'energy', // relevant for this test
                                logName: 'mySumGroupByDeltaNumber1'
                            }
                        }
                    },
                    native: {},
                });

                await harness.objects.setObjectAsync(customNumberObjId2, {
                    type: 'state',
                    common: {
                        name: 'Test sum group by delta number',
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        custom: {
                            'statistics.0': {
                                enabled: true, // relevant for this test
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: false,
                                minmax: false,
                                sumDelta: true, // relevant for this test
                                sumIgnoreMinus: false, // relevant for this test
                                groupFactor: 0.005, // relevant for this test
                                sumGroup: 'energy', // relevant for this test
                                logName: 'mySumGroupByDeltaNumber2'
                            }
                        }
                    },
                    native: {},
                });

                // Init
                await harness.states.setStateAsync(customNumberObjId1, { val: 10, ack: true });
                await harness.states.setStateAsync(customNumberObjId2, { val: 50, ack: true });

                // Wait for adapter startup
                await waitUntilStateChangesTo(harness, `${harness.adapterName}.0.info.started`, true, () => {
                    harness.startAdapterAndWait();
                });
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId1);
                await harness.objects.delObjectAsync(customNumberObjId2);

                await sleep(1000);
                await harness.stopAdapter();
            });

            it('calculation', async function () {
                this.timeout(60000);
                await sleep(1000);

                const tempId1 = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId1}`;
                const tempId2 = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId2}`;
                const sumGroupTempId = `${harness.adapterName}.0.temp.sumGroup.energy`;

                await assertStateEquals(harness, `${tempId1}.day`, 0);
                await assertStateEquals(harness, `${tempId2}.day`, 0);
                await assertStateEquals(harness, `${sumGroupTempId}.day`, 0);

                // Round 1
                await Promise.all([
                    assertStateChangesTo(harness, `${tempId1}.day`, 10, () => {
                        harness.states.setStateAsync(customNumberObjId1, { val: 20, ack: true }); // + 10
                    }),
                    assertStateChangesTo(harness, `${tempId2}.day`, 20, () => {
                        harness.states.setStateAsync(customNumberObjId2, { val: 70, ack: true }); // + 20
                    })
                ]);

                await sleep(1000);
                await assertStateEquals(harness, `${sumGroupTempId}.day`, 0.0308); // (10 * 0.001 * 0.28) + (20 * 0.005 * 0.28)

                // Round 2
                await Promise.all([
                    assertStateChangesTo(harness, `${tempId1}.day`, 40.5, () => {
                        harness.states.setStateAsync(customNumberObjId1, { val: 50.5, ack: true }); // + 30.5
                    }),
                    assertStateChangesTo(harness, `${tempId2}.day`, 22.25, () => {
                        harness.states.setStateAsync(customNumberObjId2, { val: 72.25, ack: true }); // + 2.25
                    })
                ]);

                await sleep(1000);
                await assertStateEquals(harness, `${sumGroupTempId}.day`, 0.04249); // (30.5 * 0.001 * 0.28) + (2.25 * 0.005 * 0.28)

                // Round 3
                await Promise.all([
                    assertStateChangesTo(harness, `${tempId1}.day`, 40.5, () => {
                        harness.states.setStateAsync(customNumberObjId1, { val: 40, ack: true }); // 0 (sumIgnoreMinus: true)
                    }),
                    assertStateChangesTo(harness, `${tempId2}.day`, 12.25, () => {
                        harness.states.setStateAsync(customNumberObjId2, { val: 62.25, ack: true }); // - 10
                    })
                ]);

                await sleep(1000);
                await assertStateEquals(harness, `${sumGroupTempId}.day`, 0.02849); // (0 * 0.001 * 0.28) + (-10 * 0.005 * 0.28)
            });
        });
    }
});