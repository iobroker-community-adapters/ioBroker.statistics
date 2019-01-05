/* jshint -W097 */// jshint strict:false
/*jslint node: true */
const expect = require('chai').expect;
const setup  = require(__dirname + '/lib/setup');

let objects = null;
let states  = null;
let onStateChanged = null;
let onObjectChanged = null;
let sendToID = 1;
let updateTimer;
let counter = 0;
let TEST_ID = 'javascript.0.counter';

const adapterShortName = setup.adapterName.substring(setup.adapterName.indexOf('.') + 1);

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log('Try check #' + counter);
    if (counter > 30) {
        if (cb) cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.' + adapterShortName + '.0.alive', (err, state) => {
        if (err) console.error(err);
        if (state && state.val) {
            if (cb) cb();
        } else {
            setTimeout(() => checkConnectionOfAdapter(cb, counter + 1), 1000);
        }
    });
}

function checkValueOfState(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        if (cb) cb('Cannot check value Of State ' + id);
        return;
    }

    states.getState(id, function (err, state) {
        if (err) console.error(err);
        if (value === null && !state) {
            if (cb) cb();
        } else
        if (state && (value === undefined || state.val === value)) {
            if (cb) cb();
        } else {
            setTimeout(() => checkValueOfState(id, value, cb, counter + 1), 500);
        }
    });
}

function sendTo(target, command, message, callback) {
    onStateChanged = (id, state) => {
        if (id === 'messagebox.system.adapter.test.0') {
            callback(state.message);
        }
    };

    states.pushMessage('system.adapter.' + target, {
        command:    command,
        message:    message,
        from:       'system.adapter.test.0',
        callback: {
            message: message,
            id:      sendToID++,
            ack:     false,
            time:    (new Date()).getTime()
        }
    });
}

describe('Test ' + adapterShortName + ' adapter', function () {
    before('Test ' + adapterShortName + ' adapter: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(() => {
            const config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, (id, obj) => {

                }, (id, state) => {
                    if (onStateChanged) onStateChanged(id, state);
                },
                (_objects, _states) => {
                    objects = _objects;
                    states  = _states;

                    const obj = {
                        type: 'state',
                        common: {
                            name: 'Counter',
                            type: 'number',
                            role: 'value',
                            custom: {}
                        },
                        native: {},
                        
                    };
                    // obj.common.custom[adapterShortName + '.0'] = {
                    // obj.common.custom[TEST_ID] = {
                    obj.common.custom['statistics.0'] = {
                        "enabled":              true,
                        "logName":              "counter",
                        "count":                false,
                        "sumCount":             false,
                        "timeCount":            false,
                        "fiveMin":              false,
                        
                        "groupFactor":          1,
                        "impUnit":              "",
                        "impUnitPerImpulse":    "cnt",
                        
                        "sumIgnoreMinus":       true,
                        "sumDelta":             false,
                        "avg":                  false,
                        
                        "sumGroup":             ""
                    };
                    console.log('obj= '+ JSON.stringify(obj));
                    objects.setObject(TEST_ID, obj, () => {
                        states.setState(TEST_ID, {val: false, ack: true, lc: 1546252747743});
                        //_done()      
                    });
                        var startTime = Date.now();
                        console.log('jetzt ' + startTime);
                        setTimeout(function () {
                            var endTime = Date.now();
                            console.log("timeOut was: " + (endTime - startTime) + "ms");
                            _done();
                        }, 30000);
                });
        });
    });
    
    it('Test ' + adapterShortName + ' adapter: empty test', function (done) {
        this.timeout(300);
                        var startTime = Date.now();
                        console.log('jetzt it' + startTime);
                        setTimeout(function () {
                            var endTime = Date.now();
                            console.log("timeOut it was: " + (endTime - startTime) + "ms");
                            console.log('object?   ' + JSON.stringify(objects));
                            console.log('_object?   ' + JSON.stringify(_objects));
                            _done();
                        }, 3000);
    });

    /*
        ENABLE THIS WHEN ADAPTER RUNS IN DEAMON MODE TO CHECK THAT IT HAS STARTED SUCCESSFULLY
    */
    /*
    it('Test ' + adapterShortName + ' adapter: Check if adapter started', done => {
        checkConnectionOfAdapter(res => {
            if (res) console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject('system.adapter.test.0', {
                    common: {

                    },
                    type: 'instance'
                },
                () => {
                    states.subscribeMessage('system.adapter.test.0');
                    done();
                });
        });
    }).timeout(70000);
*/
    /*
    it('Test ' + adapterShortName + ' adapter: Objects must exist', done => {
        console.log('objects   '  + JSON.stringify(objects));

        setTimeout(function(){
            objects.getObject(adapterShortName + '.0.save.count.' + TEST_ID + '.dayMin', (err, obj) => {
                if (err) console.error('1 '+err);
                console.log('object?   ' + JSON.stringify(obj)); //object should be in {}
                //expect(obj).to.exist;
                //expect(obj).to.be.ok;
                    objects.getObject(adapterShortName + '.0.temp.count.' + TEST_ID + '.dayMax', (err, obj) => {
                        if (err) console.error('2' + err);
                        //expect(obj).to.exist;    
                        //expect(obj).to.be.ok;
                        done();
                    });
            });
        }, 1000);
    }).timeout(5000);
    
    
    it('Test ' + adapterShortName + ' adapter: Objects must exist', function (done) {
        this.timeout(5000);
        setTimeout(function() {
            objects.getObject(adapterShortName + '.0.save.count.' + TEST_ID + '.15min', function (err, obj) {
                if (err) console.error(err);
                console.log('object?   ' + JSON.stringify(obj));
                //expect(obj).to.exist;
                if (!obj) {
                    console.error(adapterShortName + '.0.save.count.' + TEST_ID + '.15min' + ' not exist');
                }
                else {
                    console.log(adapterShortName + '.0.save.count.' + TEST_ID + '.15min' + JSON.stringify(obj));
                }
                //expect(state.val).to.exist;
                //expect(state.val).to.be.equal('');
                objects.getObject(adapterShortName + '.0.temp.count.' + TEST_ID + '.last01', function (err, obj) {
                    if (err) console.error(err);
                    expect(obj).to.exist;
                    if (!obj) {
                        console.error(adapterShortName + '.0.temp.count.' + TEST_ID + '.last01' + 'not exists');
                    }
                    else {
                        console.log(adapterShortName + '.0.temp.count.' + TEST_ID + '.last01' +  JSON.stringify(obj));
                        //expect(state.val).to.exist;
                        //expect(state.val).to.be.equal();
                        done();
                    }
                });
            });
        }, 1000);
    });
    */
/*
    PUT YOUR OWN TESTS HERE USING
    it('Testname', function ( done) {
        ...
    });

    You can also use "sendTo" method to send messages to the started adapter
*/

    after('Test ' + adapterShortName + ' adapter: Stop js-controller', function (done) {
        this.timeout(10000);

        setup.stopController(normalTerminated => {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});
