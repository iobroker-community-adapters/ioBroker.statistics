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

async function assertStateEquals(harness, id, value) {
    const state = await harness.states.getStateAsync(id);
    expect(state.val, `${id} should have value ${value}`).to.equal(value);
}

async function assertStateIsNull(harness, id) {
    const state = await harness.states.getStateAsync(id);
    expect(state, `${id} should be null`).to.be.null;
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

                return harness.startAdapterAndWait();
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);
            });

            it('enableStatistics - existing ID', function (done) {
                this.timeout(60000);

                // Perform the actual test
                harness.sendTo(adapterNamespace, 'enableStatistics', { id: customNumberObjId }, async (data) => {
                    expect(data.success).to.be.true;
                    expect(data.err).to.be.null;

                    const customObj = await harness.objects.getObjectAsync(customNumberObjId);

                    expect(customObj.common.custom[adapterNamespace].enabled).to.be.true;
                    expect(customObj.common.custom[adapterNamespace].avg).to.be.true; // default for number states

                    done();
                });
            });

            it('enableStatistics - non existing ID', function (done) {
                this.timeout(60000);

                // Perform the actual test
                harness.sendTo(adapterNamespace, 'enableStatistics', { id: 'this.id.does.not.exist' }, async (data) => {
                    expect(data.success).to.be.false;
                    expect(data.err).to.be.not.empty;

                    done();
                });
            });

            it('groups', function (done) {
                this.timeout(60000);

                // Perform the actual test
                harness.sendTo(adapterNamespace, 'groups', '', async (data) => {
                    expect(data).to.be.an('array');
                    //expect(data).to.have.lengthOf(1);

                    expect(data[0]).to.have.own.property('label');
                    expect(data[0]).to.have.own.property('value');

                    done();
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

                return harness.startAdapterAndWait();
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);
            });

            it('calculation', async function () {
                this.timeout(60000);

                const tempId = `${harness.adapterName}.0.temp.avg.${customNumberObjId}`;

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 10, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${tempId}.last`, 10);
                await assertStateEquals(harness, `${tempId}.dayCount`, 1);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 10);
                await assertStateEquals(harness, `${tempId}.dayMin`, 10);
                await assertStateEquals(harness, `${tempId}.dayMax`, 10);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 50, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${tempId}.last`, 50);
                await assertStateEquals(harness, `${tempId}.dayCount`, 2);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 30);
                await assertStateEquals(harness, `${tempId}.dayMin`, 10);
                await assertStateEquals(harness, `${tempId}.dayMax`, 50);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 20, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${tempId}.last`, 20);
                await assertStateEquals(harness, `${tempId}.dayCount`, 3);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 26.66667);
                await assertStateEquals(harness, `${tempId}.dayMin`, 10);
                await assertStateEquals(harness, `${tempId}.dayMax`, 50);
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

                await harness.states.setStateAsync(customNumberObjId, { val: 1000, ack: true });

                return harness.startAdapterAndWait();
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);
            });

            beforeEach(async function() {
                // Wait until adapter has created all objects/states
                this.timeout(60000);
                return sleep(5000);
            });

            it('calculation', async function () {
                this.timeout(60000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId}`;

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 1050, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 1050);
                await assertStateIsNull(harness, `${saveId}.delta`);
                await assertStateIsNull(harness, `${tempId}.day`);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 1051.5, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 1051.5);
                await assertStateEquals(harness, `${saveId}.delta`, 1.5);
                await assertStateEquals(harness, `${tempId}.day`, 1.5);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 1010, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 1010);
                await assertStateEquals(harness, `${saveId}.delta`, -41.5);
                await assertStateEquals(harness, `${tempId}.day`, -40);
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

                await harness.states.setStateAsync(customNumberObjId, { val: 1000, ack: true });

                return harness.startAdapterAndWait();
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);
            });

            beforeEach(async function() {
                // Wait until adapter has created all objects/states
                this.timeout(60000);
                return sleep(5000);
            });

            it('calculation', async function () {
                this.timeout(60000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.sumDelta.${customNumberObjId}`;

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 1050, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 1050);
                await assertStateIsNull(harness, `${saveId}.delta`);
                await assertStateIsNull(harness, `${tempId}.day`);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 1051.5, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 1051.5);
                await assertStateEquals(harness, `${saveId}.delta`, 1.5);
                await assertStateEquals(harness, `${tempId}.day`, 1.5);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 1010, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 1010);
                await assertStateEquals(harness, `${saveId}.delta`, 0);
                await assertStateEquals(harness, `${tempId}.day`, 1.5);
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

                return harness.startAdapterAndWait();
            });

            after(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);
            });

            beforeEach(async function() {
                // Wait until adapter has created all objects/states
                this.timeout(60000);
                return sleep(5000);
            });

            it('calculation', async function () {
                this.timeout(60000);

                const saveId = `${harness.adapterName}.0.save.sumDelta.${customNumberObjId}`;
                const tempId = `${harness.adapterName}.0.temp.avg.${customNumberObjId}`;

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 30, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 30);
                await assertStateIsNull(harness, `${saveId}.delta`);
                await assertStateEquals(harness, `${tempId}.last`, 10);
                await assertStateEquals(harness, `${tempId}.dayCount`, 1);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 10);
                await assertStateEquals(harness, `${tempId}.dayMin`, 10);
                await assertStateEquals(harness, `${tempId}.dayMax`, 10);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 60, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 60);
                await assertStateEquals(harness, `${saveId}.delta`, 30);
                await assertStateEquals(harness, `${tempId}.last`, 30);
                await assertStateEquals(harness, `${tempId}.dayCount`, 2);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 20);
                await assertStateEquals(harness, `${tempId}.dayMin`, 10);
                await assertStateEquals(harness, `${tempId}.dayMax`, 30);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 100, ack: true });
                await sleep(1000);

                await assertStateEquals(harness, `${saveId}.last`, 100);
                await assertStateEquals(harness, `${saveId}.delta`, 40);
                await assertStateEquals(harness, `${tempId}.last`, 40);
                await assertStateEquals(harness, `${tempId}.dayCount`, 3);
                await assertStateEquals(harness, `${tempId}.dayAvg`, 26.66667);
                await assertStateEquals(harness, `${tempId}.dayMin`, 10);
                await assertStateEquals(harness, `${tempId}.dayMax`, 40);
            });
        });
    }
});