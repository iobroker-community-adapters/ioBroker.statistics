'use strict';

const path = require('path');
const { tests } = require('@iobroker/testing');
const chai = require('chai');
const expect = chai.expect;

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

            const customNumberObjId = '0_userdata.0.mynumber';

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

            it('enableStatistics - existing ID', function (done) {
                this.timeout(60000);

                // Perform the actual test
                harness.sendTo(adapterNamespace, 'enableStatistics', { id: customNumberObjId }, async (data) => {
                    expect(data.success).to.be.true;

                    const customObj = await harness.objects.getObjectAsync(customNumberObjId);

                    expect(customObj.common.custom[adapterNamespace].enabled).to.be.true;
                    expect(customObj.common.custom[adapterNamespace].avg).to.be.true; // default for number states

                    done();
                });
            });

            it('enableStatistics - non existing ID', function (done) {
                this.timeout(60000);

                expect(harness.isControllerRunning()).to.equal(true);
                expect(harness.isAdapterRunning()).to.equal(true);

                // Perform the actual test
                harness.sendTo(adapterNamespace, 'enableStatistics', { id: 'this.id.does.not.exist' }, async (data) => {
                    expect(data.success).to.be.false;
                    expect(data.err).to.be.not.empty;

                    done();
                });
            });
        });
    }
});