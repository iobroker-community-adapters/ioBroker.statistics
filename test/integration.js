'use strict';

const path = require('path');
const { tests } = require('@iobroker/testing');
const chai = require('chai');
const expect = chai.expect;

async function sleep(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}

async function assertStateChangesTo(harness, id, value, action) {
    return new Promise((resolve, reject) => {
        const ac = new AbortController();

        const timeout = setTimeout(() => {
            ac.abort();
            reject(`${id} not changed to value ${value} in expected time range`);
        }, 10 * 1000);

        harness.on('stateChange', async (changedId, state) => {
            if (id === changedId && state) {
                if (!ac.signal.aborted) {
                    clearTimeout(timeout);
                    ac.abort();

                    expect(state.val, `${id} should change to value ${value}`).to.equal(value);

                    resolve(true);
                }
            }
        }, { signal: ac.signal });

        // Run action
        action && action();
    });
}

async function assertStateEquals(harness, id, value) {
    const state = await harness.states.getStateAsync(id);
    expect(state.val, `${id} should have value ${value}`).to.equal(value);
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    allowedExitCodes: [11],
    defineAdditionalTests({ suite }) {

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
                await harness.changeAdapterConfig(harness.adapterName, {
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
                                logName: 'mySumGroupByDeltaNumber'
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
                                logName: 'mySumGroupByDeltaNumber'
                            }
                        }
                    },
                    native: {},
                });

                // Init
                await harness.states.setStateAsync(customNumberObjId1, { val: 10, ack: true });
                await harness.states.setStateAsync(customNumberObjId2, { val: 50, ack: true });

                await harness.startAdapterAndWait();
                return sleep(1000);
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId1);
                await harness.objects.delObjectAsync(customNumberObjId2);
            });

            it('calculation', async function () {
                this.timeout(60000);

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