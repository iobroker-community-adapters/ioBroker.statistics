'use strict';

const path = require('path');
const { tests } = require('@iobroker/testing');
const chai = require('chai');
const expect = chai.expect;

function sleep(duration) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(true), duration);
    });
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

        suite('Test Number', (getHarness) => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;

            const customNumberObjId = '0_userdata.0.myNumber';

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

                return harness.startAdapterAndWait();
            });

            beforeEach(async function() {
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
                                enabled: true, // relevant for all tests
                                count: false,
                                fiveMin: false,
                                sumCount: false,
                                impUnitPerImpulse: 1,
                                impUnit: '',
                                timeCount: false,
                                avg: true, // relevant for avg test
                                minmax: true, // relevant for avg test
                                sumDelta: false,
                                sumIgnoreMinus: false,
                                groupFactor: 1,
                                logName: 'myNumber'
                            }
                        }
                    },
                    native: {},
                });
            });

            afterEach(async function() {
                await harness.objects.delObjectAsync(customNumberObjId);
            });

            it('avg', async function () {
                this.timeout(60000);

                const tempAvgId = `${harness.adapterName}.0.temp.avg.${customNumberObjId}`;

                // Round 1
                await harness.states.setStateAsync(customNumberObjId, { val: 10, ack: true });
                await sleep(1000);

                const avgLastStateRound1 = await harness.states.getStateAsync(`${tempAvgId}.last`);
                const avgDayCountStateRound1 = await harness.states.getStateAsync(`${tempAvgId}.dayCount`);
                const avgDayAvgStateRound1 = await harness.states.getStateAsync(`${tempAvgId}.dayAvg`);
                const avgDayMinStateRound1 = await harness.states.getStateAsync(`${tempAvgId}.dayMin`);
                const avgDayMaxStateRound1 = await harness.states.getStateAsync(`${tempAvgId}.dayMax`);

                expect(avgLastStateRound1.val).to.equal(10);
                expect(avgDayCountStateRound1.val).to.equal(1);
                expect(avgDayAvgStateRound1.val).to.equal(10);
                expect(avgDayMinStateRound1.val).to.equal(10);
                expect(avgDayMaxStateRound1.val).to.equal(10);

                // Round 2
                await harness.states.setStateAsync(customNumberObjId, { val: 50, ack: true });
                await sleep(1000);

                const avgLastStateRound2 = await harness.states.getStateAsync(`${tempAvgId}.last`);
                const avgDayCountStateRound2 = await harness.states.getStateAsync(`${tempAvgId}.dayCount`);
                const avgDayAvgStateRound2 = await harness.states.getStateAsync(`${tempAvgId}.dayAvg`);
                const avgDayMinStateRound2 = await harness.states.getStateAsync(`${tempAvgId}.dayMin`);
                const avgDayMaxStateRound2 = await harness.states.getStateAsync(`${tempAvgId}.dayMax`);

                expect(avgLastStateRound2.val).to.equal(50);
                expect(avgDayCountStateRound2.val).to.equal(2);
                expect(avgDayAvgStateRound2.val).to.equal(30);
                expect(avgDayMinStateRound2.val).to.equal(10);
                expect(avgDayMaxStateRound2.val).to.equal(50);

                // Round 3
                await harness.states.setStateAsync(customNumberObjId, { val: 20, ack: true });
                await sleep(1000);

                const avgLastStateRound3 = await harness.states.getStateAsync(`${tempAvgId}.last`);
                const avgDayCountStateRound3 = await harness.states.getStateAsync(`${tempAvgId}.dayCount`);
                const avgDayAvgStateRound3 = await harness.states.getStateAsync(`${tempAvgId}.dayAvg`);
                const avgDayMinStateRound3 = await harness.states.getStateAsync(`${tempAvgId}.dayMin`);
                const avgDayMaxStateRound3 = await harness.states.getStateAsync(`${tempAvgId}.dayMax`);

                expect(avgLastStateRound3.val).to.equal(20);
                expect(avgDayCountStateRound3.val).to.equal(3);
                expect(avgDayAvgStateRound3.val).to.equal(26.66667);
                expect(avgDayMinStateRound3.val).to.equal(10);
                expect(avgDayMaxStateRound3.val).to.equal(50);
            });
        });
    }
});