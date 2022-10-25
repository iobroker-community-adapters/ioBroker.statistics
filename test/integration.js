'use strict';

const path = require('path');
const { tests, IntegrationTestHarness } = require('@iobroker/testing');
const chai = require('chai');
const expect = chai.expect;

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    allowedExitCodes: [11],
    defineAdditionalTests({ suite }) {

        suite('Test Today', getHarness => {
            /**
             * @type {IntegrationTestHarness}
             */
            let harness;
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
            });

            it('Check statistics', async function () {

                

                const stateDataCount = await harness.states.getStateAsync(`${harness.adapterName}.0.data.count`);
                expect(stateDataCount.val).to.be.equal(5);

                const stateDataCountTomorrow = await harness.states.getStateAsync(`${harness.adapterName}.0.data.countTomorrow`);
                expect(stateDataCountTomorrow.val).to.be.equal(7);

            });
        });
    }
});