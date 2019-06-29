/**
 *
 * statistics adapter
 *
 * the adapter creates new states according to the configuration
 * the configured objects are subscribed for changes and the statistic is calculated
 *
 */

/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const stateObjects = require('./lib/objects');
const CronJob = require('cron').CronJob;

let adapter;

let crons = {};
const typeObjects = {}; // to remember the used objects within the types (calculations)
const statDP = {};      // contains the complete datasets (instead of adapter.config)
const groups = {};
let units = {};
const tasks = [];
const states = {}; // hold all states locally

const nameObjects = {
    count: { // Count impulses or counting operations
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'last5Min', 'lastPulse']
    },
    sumCount: { // Addition of analogue values (consumption from pulses) Multiplication with price = costs
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    },
    sumDelta: { // Consumption from continuous quantities () Multiplication with price = costs
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'delta', 'last'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']//, 'last5Min']
    },
    sumGroup: { // Total consumption from consecutive quantities
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    },
    minmax: { // Min/Max timeframe 
        save: ['dayMin', 'weekMin', 'monthMin', 'quarterMin', 'yearMin', 'dayMax', 'weekMax', 'monthMax', 'quarterMax', 'yearMax'],
        temp: ['dayMin', 'weekMin', 'monthMin', 'quarterMin', 'yearMin', 'dayMax', 'weekMax', 'monthMax', 'quarterMax', 'yearMax', 'last']
    },
    avg: { // Mean values etc.
        save: ['dayMin', 'dayMax', 'dayAvg'],
        temp: ['dayMin', 'dayMax', 'dayAvg', 'dayCount', 'daySum', 'last']
    },
    timeCount: { // Operating time counting from status change
        save: ['onDay', 'onWeek', 'onMonth', 'onQuarter', 'onYear', 'offDay', 'offWeek', 'offMonth', 'offQuarter', 'offYear'],
        temp: ['onDay', 'onWeek', 'onMonth', 'onQuarter', 'onYear', 'offDay', 'offWeek', 'offMonth', 'offQuarter', 'offYear', 'last01', 'last10', 'last']
    },
    fiveMin: { // 5 minutes, etc. only useful with impulses
        save: ['mean5Min', 'dayMax5Min', 'dayMin5Min'],
        temp: ['mean5Min', 'dayMax5Min', 'dayMin5Min']
    },
};
function stop() {
    for (const type in crons) {
        if (crons.hasOwnProperty(type) && crons[type]) {
            crons[type].stop();
            crons[type] = null;
        }
    }
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'statistics',
        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: callback => {
            try {
                adapter && adapter.log && adapter.log.info && adapter.log.info('cleaned everything up...');
                // possibly also delete a few schedules
                stop();
                callback();
            } catch (e) {
                callback();
            }
        },
        objectChange: (id, obj) => {
            // Warning, obj can be null if it was deleted
            // adapter.log.debug('received objectChange '+ id + ' obj  '+JSON.stringify(obj));
            //nur das verarbeiten was auch diesen Adapter interessiert
            if (obj && obj.common && obj.common.custom && obj.common.custom[adapter.namespace] && obj.common.custom[adapter.namespace].enabled) {
                //hier sollte nur ein Datenpunkt angekommen sein
                adapter.log.debug('received objectChange for stat' + id + ' ' + obj.common.custom);
                // old but changhed
                if (statDP[id]) {
                    //adapter.log.info('neu aber anderes Setting ' + id);
                    statDP[id] = obj.common.custom[adapter.namespace];
                    removeObject(id);
                    setupObjects([id], null, undefined, true);
                    adapter.log.debug('saved typeObjects update1 ' + JSON.stringify(typeObjects));
                } else {
                    //adapter.log.info('ganz neu ' + id);  
                    statDP[id] = obj.common.custom[adapter.namespace];
                    setupObjects([id]);
                    adapter.log.info('enabled logging of ' + id);
                    adapter.log.debug('saved typeObjects update2 ' + JSON.stringify(typeObjects));
                }
            } else if (statDP[id]) {
                //adapter.log.info('alt aber disabled id' + id );
                adapter.unsubscribeForeignStates(id);
                delete statDP[id];
                adapter.log.info('disabled logging of ' + id);
                removeObject(id);
                adapter.log.debug('saved typeObjects update3 ' + JSON.stringify(typeObjects));
            }
        },
        // is called if a subscribed state changes
        stateChange: (id, state) => {
            // Warning, state can be null if it was deleted
            adapter.log.debug('[STATE CHANGE] ======================= ' + id + ' =======================');
            adapter.log.debug('[STATE CHANGE] stateChange => ' + state.val + ' [' + state.ack + ']');
            
            // you can use the ack flag to detect if it is status (true) or command (false)
            if (state && state.ack ) {
                if( (state.val === null) || (state.val === undefined) || (state.val === NaN) ){
                    adapter.log.error('[STATE CHANGE] wrong value => ' + state.val + ' on ' + id + ' check your other adapters ');   
                }
                else{
                    if (typeObjects.sumDelta && typeObjects.sumDelta.indexOf(id) !== -1) {
                        newSumDeltaValue(id, state.val);
                    } else
                        if (typeObjects.avg && typeObjects.avg.indexOf(id) !== -1) {
                            newAvgValue(id, state.val);
                        }
                    if (typeObjects.minmax && typeObjects.minmax.indexOf(id) !== -1) {
                        newMinMaxValue(id, state.val);
                    }
                    if (typeObjects.count && typeObjects.count.indexOf(id) !== -1) {
                        newCountValue(id, state.val);
                    }
                    if (typeObjects.timeCount && typeObjects.timeCount.indexOf(id) !== -1) {
                        newTimeCntValue(id, state);
                    }
                    // 5min is treated cyclically
                }
            }
        },
        /** for future use, when message is needed
            // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
            message: obj => {
                if (typeof obj === 'object' && obj.message) {
                    if (obj.command === 'export') {
                        // e.g. send email or pushover or whatever
                        console.log('got export command');
                        // Send response in callback if required
                        if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                    } else
                    if (obj.command === 'import') {
                        // e.g. send email or pushover or whatever
                        console.log('got import command');
                        // Send response in callback if required
                        if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                    } else if (obj.command === 'test') {
                        saveValues(obj.message || '15Min');
                    }
                }
            },
         **/
        // is called when databases are connected and adapter received configuration.
        // start here!
        ready: () => { main() }
    });
    adapter = new utils.Adapter(options);
    return adapter;
};
function removeObject(id) { //interne states[id] auch löschen?
    for (const key in typeObjects) {
        if (!typeObjects.hasOwnProperty(key)) continue;
        const pos = typeObjects[key].indexOf(id);
        if (pos !== -1) {
            adapter.log.debug('found ' + id + ' on pos ' + typeObjects[key].indexOf(id) + ' of ' + key + ' for removal');
            typeObjects[key].splice(pos, 1);
        }
    }
    for (const g in groups) {
        if (!groups.hasOwnProperty(g)) continue;
        const pos = groups[g].items.indexOf(id);
        if (pos !== -1) {
            adapter.log.debug('found ' + id + ' on pos ' + groups[g].indexOf(id) + ' of ' + g + ' for removal');
            groups[g].items.splice(pos, 1);
        }
    }
}

// to be removed in compact? process.on('SIGINT', stop);
function timeConverter(timestamp) {
    const a = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    let date = a.getDate();
    date = date < 10 ? ' ' + date : date;
    let hour = a.getHours();
    hour = hour < 10 ? '0' + hour : hour;
    let min = a.getMinutes();
    min = min < 10 ? '0' + min : min;
    let sec = a.getSeconds();
    sec = sec < 10 ? '0' + sec : sec;
    return date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
}

function fiveMin() {
    adapter.log.debug('[5 MINUTES] evaluation');
    const isStart = !tasks.length;
    /**
     * Determine 5min values
     *
     * Get current min from temp
     * Get current max from temp
     * current value from the monitored counter
     * old value (before 5min) from the monitored counter
     *
     * determination delta and decision whether new min / max is stored
     * current counter reading is written in the old value
     *
     * typeObjects.fiveMin [t] contains the objectId of the monitored counter
     *
     */

    // go through all subscribed objects and write
    if (typeObjects.fiveMin) {
        for (let t = 0; t < typeObjects.fiveMin.length; t++) {
            tasks.push({
                name: 'async',
                args: { id: typeObjects.fiveMin[t] },
                callback: (args, callback) => {
                    let temp5MinID;
                    let actualID;
                    if (statDP[args.id].sumDelta) {
                        temp5MinID = 'temp.sumDelta.' + args.id + '.last5Min';
                        actualID = 'save.sumDelta.' + args.id + '.last';
                    } else {
                        temp5MinID = 'temp.count.' + args.id + '.last5Min';
                        actualID = 'temp.count.' + args.id + '.day';
                    }
                    getValue(actualID, (err, actual) => {
                        if (actual === null) {
                            return callback();
                        }
                        getValue('temp.fiveMin.' + args.id + '.dayMin5Min', (err, min) => {
                            getValue('temp.fiveMin.' + args.id + '.dayMax5Min', (err, max) => {
                                getValue(temp5MinID, (err, old) => {
                                    // Write actual state into counter object
                                    setValueStat(temp5MinID, actual, () => {
                                        if (old === null) {
                                            return callback();
                                        }
                                        const delta = actual - old;
                                        adapter.log.debug('[STATE CHANGE] fiveMin; of : ' + args.id + ' with  min: ' + min + ' max: ' + max + ' actual: ' + actual + ' old: ' + old + ' delta: ' + delta);
                                        setValueStat('temp.fiveMin.' + args.id + '.mean5Min', delta, () => {
                                            if (max === null || delta > max) {
                                                adapter.log.debug('[STATE CHANGE] new Max ' + 'temp.fiveMin.' + args.id + '.dayMax5Min'+ ': ' + delta);
                                                setValueStat('temp.fiveMin.' + args.id + '.dayMax5Min', delta, callback);
                                                callback = null;
                                            }
                                            if (min === null || delta < min) {
                                                adapter.log.debug('[STATE CHANGE] new Min ' + 'temp.fiveMin.' + args.id + '.dayMin5Min' + ': ' + delta);
                                                setValueStat('temp.fiveMin.' + args.id + '.dayMin5Min', delta, callback);
                                                callback = null;
                                            }
                                            callback && callback();
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            });
        }
    }
    isStart && processTasks();
}

// cached function 
function getValue(id, callback) {
    if (states.hasOwnProperty(id)) {
        callback(null, states[id]);
    } else {
        adapter.getForeignState(adapter.namespace + '.' + id, (err, value) => {
            if (value) {
                states[id] = value.val;
            } else {
                states[id] = null;
            }
            callback(err, states[id], value && value.ts);
        });
    }
}

// cached function 
function setValueStat(id, val, callback) {
    let ts = new Date();
    ts.setMinutes(ts.getMinutes() - 1);
    ts.setSeconds(59);
    ts.setMilliseconds(0);
    states[id] = val;
    adapter.setForeignState(adapter.namespace + '.' + id, { val, ts: ts.getTime(), ack: true }, callback);
}

// cached function
function setValue(id, val, callback) {
    states[id] = val;
    adapter.setForeignState(adapter.namespace + '.' + id, val, true, callback);
}

function newAvgValue(id, value) {
    const isStart = !tasks.length;
    /**
     * Comparison between last min / max and now transmitted value
     */
    value = parseFloat(value) // || 0; if NaN we should not put a zero inside, better to skip everything
    if (!isNaN(value)) {
        adapter.log.debug('[STATE CHANGE] avg call: ' + id + ' value ' + value);
        tasks.push({
            name: 'async',
            args: {
                id,
                value
            }, callback: (args, callback) => {
                adapter.log.debug('[STATE CHANGE] new last for "' + 'temp.avg.' + args.id + '.last' + ': ' + value);
                setValue('temp.avg.' + args.id + '.last', value); //memorize current value to have it available when date change for actual=starting point of new time frame
                getValue('temp.avg.' + args.id + '.dayCount', (err, count) => {
                    count = count ? count + 1 : 1;
                    setValue('temp.avg.' + args.id + '.dayCount', count, () => {
                        getValue('temp.avg.' + args.id + '.daySum', (err, sum) => {
                            sum = sum ? sum + value : value;
                            setValue('temp.avg.' + args.id + '.daySum', sum, () => {
                                setValue('temp.avg.' + args.id + '.dayAvg', Math.round(sum / count), () => {
                                    getValue('temp.avg.' + args.id + '.dayMin', (err, tempMin) => {
                                        if (tempMin === null || tempMin > value) {
                                            setValue('temp.avg.' + args.id + '.dayMin', value);
                                            adapter.log.debug('[STATE CHANGE] new min for "' + 'temp.avg.' + args.id + '.dayMin' + ': ' + value);
                                        }
                                        getValue('temp.avg.' + args.id + '.dayMax', (err, tempMax) => {
                                            if (tempMax === null || tempMax < value) {
                                                setValue('temp.avg.' + args.id + '.dayMax', value, callback);
                                                adapter.log.debug('[STATE CHANGE] new max for "' + 'temp.avg.' + args.id + '.dayMax'+ ': ' + value);
                                            } else {
                                                callback && callback();
                                            }
                                        });
                                    });
                                })
                            });
                        });
                    });
                });
            }
        });
        isStart && processTasks();
    }
}
function newMinMaxValue(id, value) {
    const isStart = !tasks.length;
    /**
     * Comparison between last min / max and now transmitted value
     */
    value = parseFloat(value) || 0;
    if (!isNaN(value)) {
        adapter.log.debug('[STATE CHANGE] minmax call: ' + id + ' value ' + value);
        tasks.push({
            name: 'async',
            args: {
                id,
                value
            }, callback: (args, callback) => {
                adapter.log.debug('[STATE CHANGE] new last for "' + 'temp.minmax.' + args.id + '.last' + ': ' + value);
                setValue('temp.minmax.' + args.id + '.last', value); //memorize current value to have it available when date change for actual=starting point of new time frame
                getValue('temp.minmax.' + args.id + '.yearMin', (err, tempMin) => {
                    if (tempMin === null || tempMin > value) {
                        setValue('temp.minmax.' + args.id + '.yearMin', value);
                        adapter.log.debug('[STATE CHANGE] new year min for "' + args.id + ': ' + value);
                    }
                    getValue('temp.minmax.' + args.id + '.yearMax', (err, tempMax) => {
                        if (tempMax === null || tempMax < value) {
                            setValue('temp.minmax.' + args.id + '.yearMax', value);
                            adapter.log.debug('[STATE CHANGE] new year max for "' + args.id + ': ' + value);
                        }
                        getValue('temp.minmax.' + args.id + '.quarterMin', (err, tempMin) => {
                            if (tempMin === null || tempMin > value) {
                                setValue('temp.minmax.' + args.id + '.quarterMin', value);
                                adapter.log.debug('[STATE CHANGE] new quarter min for "' + args.id + ': ' + value);
                            }
                            getValue('temp.minmax.' + args.id + '.quarterMax', (err, tempMax) => {
                                if (tempMax === null || tempMax < value) {
                                    setValue('temp.minmax.' + args.id + '.quarterMax', value);
                                    adapter.log.debug('[STATE CHANGE] new quarter max for "' + args.id + ': ' + value);
                                }
                                getValue('temp.minmax.' + args.id + '.monthMin', (err, tempMin) => {
                                    if (tempMin === null || tempMin > value) {
                                        setValue('temp.minmax.' + args.id + '.monthMin', value);
                                        adapter.log.debug('[STATE CHANGE] new month min for "' + args.id + ': ' + value);
                                    }
                                    getValue('temp.minmax.' + args.id + '.monthMax', (err, tempMax) => {
                                        if (tempMax === null || tempMax < value) {
                                            setValue('temp.minmax.' + args.id + '.monthMax', value);
                                            adapter.log.debug('[STATE CHANGE] new month max for "' + args.id + ': ' + value);
                                        }
                                        getValue('temp.minmax.' + args.id + '.weekMin', (err, tempMin) => {
                                            if (tempMin === null || tempMin > value) {
                                                setValue('temp.minmax.' + args.id + '.weekMin', value);
                                                adapter.log.debug('[STATE CHANGE] new week min for "' + args.id + ': ' + value);
                                            }
                                            getValue('temp.minmax.' + args.id + '.weekMax', (err, tempMax) => {
                                                if (tempMax === null || tempMax < value) {
                                                    setValue('temp.minmax.' + args.id + '.weekMax', value);
                                                    adapter.log.debug('[STATE CHANGE] new week max for "' + args.id + ': ' + value);
                                                }
                                                getValue('temp.minmax.' + args.id + '.dayMin', (err, tempMin) => {
                                                    if (tempMin === null || tempMin > value) {
                                                        setValue('temp.minmax.' + args.id + '.dayMin', value);
                                                        adapter.log.debug('[STATE CHANGE] new day min for "' + args.id + ': ' + value);
                                                    }
                                                    getValue('temp.minmax.' + args.id + '.dayMax', (err, tempMax) => {
                                                        if (tempMax === null || tempMax < value) {
                                                            setValue('temp.minmax.' + args.id + '.dayMax', value, callback);
                                                            adapter.log.debug('[STATE CHANGE] new day max for "' + args.id + ': ' + value);
                                                        } else {
                                                            callback && callback();
                                                        }
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
        isStart && processTasks();
    }
}
function newCountValue(id, value) {
    const isStart = !tasks.length;
    /*
        value with limit or state
        Change to 1 -> increase by 1
        Value greater threshold -> increase by 1
    */
    adapter.log.debug('[STATE CHANGE] count call ' + id + ' with ' + value);
    // nicht nur auf true/false prüfen, es muß sich um eine echte Flanke handeln
    // derzeitigen Zustand mit prüfen, sonst werden subscribed status updates mitgezählt
    if (isTrueNew(id, value)) {
        tasks.push({
            name: 'async',
            args: { id },
            callback: (args, callback) => {
                for (let s = 0; s < nameObjects.count.temp.length; s++) {
                    if (nameObjects.count.temp[s] !== 'lastPulse') {
                        tasks.push({
                            name: 'async',
                            args: {
                                id: 'temp.count.' + id + '.' + nameObjects.count.temp[s]
                            },
                            callback: (args, callback) => {
                                getValue(args.id, (err, oldVal) => {
                                    oldVal = oldVal ? oldVal + 1 : 1;
                                    adapter.log.debug('[STATE CHANGE] Increase ' + args.id + ' on 1 to ' + oldVal);
                                    setValue(args.id, oldVal, callback);
                                });
                            }
                        });
                        // Calculation of consumption (what is a physical-sized pulse)
                        if (typeObjects.sumCount &&
                            typeObjects.sumCount.indexOf(args.id) !== -1 &&
                            statDP[args.id].impUnitPerImpulse) { // counter mit Verbrauch
                            tasks.push({
                                name: 'async',
                                args: {
                                    id: 'temp.sumCount.' + args.id + '.' + nameObjects.count.temp[s],
                                    impUnitPerImpulse: statDP[args.id].impUnitPerImpulse
                                },
                                callback: (args, callback) => {
                                    getValue(args.id, (err, consumption) => {
                                        const value = consumption ? consumption + args.impUnitPerImpulse : args.impUnitPerImpulse;
                                        adapter.log.debug('[STATE CHANGE] Increase ' + args.id + ' on ' + args.impUnitPerImpulse + ' to ' + value);
                                        setValue(args.id, value, callback)
                                    })
                                }
                            });
                            // add consumption to group
                            if (statDP[args.id].sumGroup &&
                                groups[statDP[args.id].sumGroup] &&
                                statDP[args.id].impUnitPerImpulse &&
                                statDP[args.id].groupFactor
                            ) {
                                const factor = statDP[args.id].groupFactor;
                                const price = groups[statDP[args.id].sumGroup].config.price;
                                for (let i = 0; i < nameObjects.sumGroup.temp.length; i++) {
                                    tasks.push({
                                        name: 'async',
                                        args: {
                                            delta: statDP[args.id].impUnitPerImpulse * factor * price,
                                            id: 'temp.sumGroup.' + statDP[args.id].sumGroup + '.' + nameObjects.sumGroup.temp[i],
                                            type: nameObjects.sumGroup.temp[i]
                                        },
                                        callback: (args, callback) =>
                                            getValue(args.id, (err, value, ts) => {
                                                if (ts) {
                                                    value = checkValue(value || 0, ts, args.id, args.type);
                                                }
                                                value = Math.round((((value || 0) + args.delta) * 10000) / 10000);
                                                adapter.log.debug('[STATE CHANGE] Increase ' + args.id + ' on ' + args.delta + ' to ' + value);
                                                setValue(args.id, value, callback);
                                            })
                                    });
                                }
                            }
                        }
                    }
                }
                callback();
            }
        });
    }
    isStart && processTasks();
}

function checkValue(value, ts, id, type) {
    let now = new Date();
    now.setSeconds(0);
    now.setMilliseconds(0);
    if (type === '15Min') {
        // value may not be older than 15 min
        now.setMinutes(now.getMinutes() - now.getMinutes() % 15);
    } else
        if (type === 'hour') {
            // value may not be older than full hour
            now.setMinutes(0);
        } else
            if (type === 'day') {
                // value may not be older than 00:00 of today
                now.setMinutes(0);
                now.setHours(0);
            } else
                if (type === 'week') {
                    // value may not be older than 00:00 of today
                    now.setMinutes(0);
                    now.setHours(0);
                } else
                    if (type === 'month') {
                        // value may not be older than 00:00 of today
                        now.setMinutes(0);
                        now.setHours(0);
                        now.setDate(1);
                    } else
                        if (type === 'quarter') {
                            // value may not be older than 00:00 of today
                            now.setMinutes(0);
                            now.setHours(0);
                            now.setDate(1);
                            //0, 3, 6, 9
                            now.setMonth(now.getMonth() - now.getMonth() % 3);
                        } else
                            if (type === 'year') {
                                // value may not be older than 1 Januar of today
                                now.setMinutes(0);
                                now.setHours(0);
                                now.setDate(1);
                                now.setMonth(0);
                            } else {
                                adapter.log.error('Unknown calc type: ' + type);
                                return value;
                            }
    if (ts < now.getTime()) {
        adapter.log.warn('[STATE CHANGE] Value of ' + id + ' ignored because older than ' + now.toISOString());
        value = 0;
    }
    return value;
}

function newSumDeltaValue(id, value) {
    const isStart = !tasks.length;
    /*
        determine the consumption per period as consecutive meter readings.
             - Validity check new value must be greater than age
             - Subtraction with last value Day
             - Subtraction with last value today -> delta for sum
             - Add delta to all values
             - treat own values differently (datapoint name)
    */
    value = parseFloat(value) || 0; //here we can probably leave the 0, if undefined then we have 0
    tasks.push({
        name: 'async',
        args: { id },
        callback: (args, callback) => {
            getValue('save.sumDelta.' + args.id + '.last', (err, old) => {
                tasks.push({
                    name: 'async',
                    args: { id: 'save.sumDelta.' + args.id + '.last', value },
                    callback: (args, callback) => setValue(args.id, args.value, callback)
                });
                if (old === null) {
                    return callback();
                }
                let delta = old !== null ? value - old : 0;
                if (delta < 0) {
                    if (statDP[args.id].sumIgnoreMinus) {
                        delta = 0;
                    } else {
                        // Counter overflow!
                        delta = value; // Difference between last value and overflow is error rate
                    }
                }
                tasks.push({
                    name: 'async',
                    args: {
                        delta,
                        id: 'save.sumDelta.' + args.id + '.delta'
                    },
                    callback: (args, callback) => setValue(args.id, args.delta, callback)
                });
                for (let i = 0; i < nameObjects.sumDelta.temp.length; i++) {
                    tasks.push({
                        name: 'async',
                        args: {
                            delta,
                            id: 'temp.sumDelta.' + args.id + '.' + nameObjects.sumDelta.temp[i],
                            type: nameObjects.sumDelta.temp[i]
                        },
                        callback: (args, callback) =>
                            getValue(args.id, (err, value, ts) => {
                                // Check if the value not older than interval
                                if (ts) {
                                    value = checkValue(value, ts, args.id, args.type);
                                }
                                value = (value || 0) + args.delta;
                                adapter.log.debug('[STATE CHANGE] Increase ' + args.id + ' on ' + args.delta + ' to ' + value);
                                setValue(args.id, value, callback);
                            })
                    });
                }
                // calculate average
                if (typeObjects.avg && typeObjects.avg.indexOf(args.id)) {
                    newAvgValue(args.id, delta);
                }
                if (statDP[args.id].sumGroup &&
                    groups[statDP[args.id].sumGroup] &&
                    statDP[args.id].groupFactor
                ) {
                    const factor = statDP[args.id].groupFactor;
                    const price = groups[statDP[args.id].sumGroup].config.price;
                    for (let i = 0; i < nameObjects.sumGroup.temp.length; i++) {
                        tasks.push({
                            name: 'async',
                            args: {
                                delta: delta * factor * price,
                                id: 'temp.sumGroup.' + statDP[args.id].sumGroup + '.' + nameObjects.sumGroup.temp[i],
                                type: nameObjects.sumGroup.temp[i]
                            },
                            callback: (args, callback) =>
                                getValue(args.id, (err, value, ts) => {
                                    // Check if the value not older than interval
                                    if (ts) {
                                        value = checkValue(value || 0, ts, args.id, args.type);
                                    }
                                    value = Math.round((((value || 0) + args.delta) * 10000) / 10000);
                                    adapter.log.debug('[STATE CHANGE] Increase ' + args.id + ' on ' + args.delta + ' to ' + value);
                                    setValue(args.id, value, callback);
                                })
                        });
                    }
                }
                callback();
            });
        }
    });
    isStart && processTasks();
}

function isTrueNew(id, val) { //detection if a count value is real or only from polling with same state
    let newPulse = false;
    getValue('temp.count.' + id + '.lastPulse', (err, value) => {
        setValue('temp.count.' + id + '.lastPulse', val);
        if (value === val) {
            newPulse = false;
            adapter.log.debug('new pulse false ? ' + newPulse);
        } else {
            newPulse = isTrue(val);
            adapter.log.debug('new pulse true ? ' + newPulse);
        }
    });
    return newPulse;
}

function isTrue(val) {
    return val === 1 || val === '1' || val === true || val === 'true' || val === 'on' || val === 'ON';
}

function isFalse(val) {
    return val === 0 || val === '0' || val === false || val === 'false' || val === 'off' || val === 'OFF' || val === 'standby'
}
function newTimeCntValue(id, state) {
    const isStart = !tasks.length;
    /*
    value with threshold or state
    Change to 1 at threshold 0 -> time between event since last 0
    Addition of time
    Change to 0 at threshold 1 -> time between event since last 1
    Addition of time
    no change but retrigger counts up the time of respective state
    */
    adapter.log.debug('[STATE CHANGE] timecount call ' + id + ' with ' + state.val); // !! val ist hier falsch da state komplett übergeben
    if (isTrue(state.val)) {
        tasks.push({
            name: 'async',
            args: {
                id,
                state
            },
            callback: (args, callback) => {
                getValue('temp.timeCount.' + args.id + '.last', (err, actual) => { //Bestimmung letzter Zustand, wegen mehrfach gleicher Wert
                    if (!isTrue(actual)) { // ein echter Signalwechsel, somit Bestimmung delta für OFF-Zeitraum von 1->0 bis jetzt 0->1
                        getValue('temp.timeCount.' + args.id + '.last10', (err, last) => {
                            let delta = last ? state.ts - last : 0; // wenn last true dann delta, ansonsten 0
                            if (delta < 0) { delta = 0 }
                            else { delta = parseInt(delta / 1000) }
                            adapter.log.debug('[STATE CHANGE] new last ' + 'temp.timeCount.' + args.id + '.last' + ': ' + state.val);
                            setValue('temp.timeCount.' + args.id + '.last', state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                adapter.log.debug('[STATE CHANGE] new last01 ' + 'temp.timeCount.' + args.id + '.last01' + ': ' + state.ts + '  '+ timeConverter(state.ts) );
                                setValue('temp.timeCount.' + args.id + '.last01', state.ts, () => {
                                    adapter.log.debug('[STATE CHANGE] 0->1 delta ' + delta + ' state ' + timeConverter(state.ts) + ' last ' + timeConverter(last));
                                    for (let s = 0; s < nameObjects.timeCount.temp.length; s++) { // über alle Zeiträume den Wert aufaddieren
                                        if (nameObjects.timeCount.temp[s].match(/\off\w+$/)) {
                                            tasks.push({
                                                name: 'async',
                                                args: {
                                                    id: 'temp.timeCount.' + args.id + '.' + nameObjects.timeCount.temp[s]
                                                },
                                                callback: (args, callback) => {
                                                    getValue(args.id, (err, time) => {
                                                        adapter.log.debug('[STATE CHANGE] 0->1 new val ' + args.id + ': ' + ((time || 0) + delta));
                                                        setValue(args.id, (time || 0) + delta, callback) 
                                                    })
                                                }
                                            });
                                        }
                                    }
                                    callback();
                                });
                            });
                        });
                    }
                    else { // kein Signalwechsel, nochmal gleicher Zustand, somit Bestimmung delta für update ON-Zeitraum von letzten 0->1 bis jetzt 0->1
                        getValue('temp.timeCount.' + args.id + '.last01', (err, last) => {
                            let delta = last ? state.ts - last : 0; // wenn last true dann delta, ansonsten 0
                            if (delta < 0) { delta = 0 }
                            else { delta = parseInt(delta / 1000) }
                            adapter.log.debug('[STATE CHANGE] new last ' + 'temp.timeCount.' + args.id + '.last' + ': ' + state.val);
                            setValue('temp.timeCount.' + args.id + '.last', state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                adapter.log.debug('[STATE CHANGE] new last01 ' + 'temp.timeCount.' + args.id + '.last01' + ': ' + state.ts + '  '+ timeConverter(state.ts));
                                setValue('temp.timeCount.' + args.id + '.last01', state.ts, () => {
                                    adapter.log.debug('[STATE EQUAL] 1->1 delta ' + delta + ' state ' + timeConverter(state.ts) + ' last ' + timeConverter(last));
                                    for (let s = 0; s < nameObjects.timeCount.temp.length; s++) { // über alle Zeiträume den Wert aufaddieren
                                        if (nameObjects.timeCount.temp[s].match(/^\on\w+$/)) { // ^ wegen on in Month
                                            tasks.push({
                                                name: 'async',
                                                args: {
                                                    id: 'temp.timeCount.' + args.id + '.' + nameObjects.timeCount.temp[s]
                                                },
                                                callback: (args, callback) => {
                                                    getValue(args.id, (err, time) => {
                                                        adapter.log.debug('[STATE EQUAL] 1->1 new val ' + args.id + ': ' + ((time || 0) + delta));
                                                        setValue(args.id, (time || 0) + delta, callback)
                                                    })
                                                }
                                            });
                                        }
                                    }
                                    callback();
                                });
                            });
                        });
                    }
                });
            }
        });
    } else
        if (isFalse(state.val)) {
            tasks.push({
                name: 'async',
                args: {
                    id,
                    state
                },
                callback: (args, callback) => {
                    getValue('temp.timeCount.' + args.id + '.last', (err, actual) => { //Bestimmung letzter Zustand, wegen mehrfach gleicher Wert
                        if (isTrue(actual)) { // ein echter Signalwechsel, somit Bestimmung delta für ON-Zeitraum von 0->1 bis jetzt 1->0
                            getValue('temp.timeCount.' + args.id + '.last01', (err, last) => {
                                let delta = last ? state.ts - last : 0;
                                if (delta < 0) { delta = 0 }
                                else { delta = parseInt(delta / 1000) }
                                adapter.log.debug('[STATE CHANGE] new last ' + 'temp.timeCount.' + args.id + '.last' + ': ' + state.val);
                                setValue('temp.timeCount.' + args.id + '.last', state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                    adapter.log.debug('[STATE CHANGE] new last10 ' + 'temp.timeCount.' + args.id + '.last10' + ': ' + state.ts + '  '+ timeConverter(state.ts));
                                    setValue('temp.timeCount.' + args.id + '.last10', state.ts, () => {
                                        adapter.log.debug('[STATE CHANGE] 1->0 delta ' + delta + ' state ' + timeConverter(state.ts) + ' last ' + timeConverter(last));
                                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) {
                                            if (nameObjects.timeCount.temp[s].match(/^\on\w+$/)) { // on auch in Month drin, deswegen ^
                                                tasks.push({
                                                    name: 'async',
                                                    args: {
                                                        id: 'temp.timeCount.' + args.id + '.' + nameObjects.timeCount.temp[s]
                                                    },
                                                    callback: (args, callback) => {
                                                        getValue(args.id, (err, time) => {
                                                            adapter.log.debug('[STATE CHANGE] 1->0 new val ' + args.id + ': ' + ((time || 0) + delta));
                                                            setValue(args.id, (time || 0) + delta, callback)
                                                        })
                                                    }
                                                });
                                            }
                                        }
                                        callback();
                                    });
                                });
                            });
                        }
                        else { // kein Signalwechsel, nochmal gleicher Zustand, somit Bestimmung delta für update OFF-Zeitraum von letzten 1->0 bis jetzt 1->0
                            getValue('temp.timeCount.' + args.id + '.last10', (err, last) => {
                                let delta = last ? state.ts - last : 0;
                                if (delta < 0) { delta = 0 }
                                else { delta = parseInt(delta / 1000) }
                                adapter.log.debug('[STATE CHANGE] new last ' + 'temp.timeCount.' + args.id + '.last' + ': ' + state.val);
                                setValue('temp.timeCount.' + args.id + '.last', state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                    adapter.log.debug('[STATE CHANGE] new last10 ' + 'temp.timeCount.' + args.id + '.last10' + ': ' + state.ts + '  '+ timeConverter(state.ts) );
                                    setValue('temp.timeCount.' + args.id + '.last10', state.ts, () => {
                                        adapter.log.debug('[STATE EQUAL] 0->0 delta ' + delta + ' state ' + timeConverter(state.ts) + ' last ' + timeConverter(last));
                                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) {
                                            if (nameObjects.timeCount.temp[s].match(/\off\w+$/)) {
                                                tasks.push({
                                                    name: 'async',
                                                    args: {
                                                        id: 'temp.timeCount.' + args.id + '.' + nameObjects.timeCount.temp[s]
                                                    },
                                                    callback: (args, callback) => {
                                                        getValue(args.id, (err, time) => {
                                                            adapter.log.debug('[STATE EQUAL] 0->0 new val ' + args.id + ': ' + ((time || 0) + delta));
                                                            setValue(args.id, (time || 0) + delta, callback)
                                                        })
                                                    }
                                                });
                                            }
                                        }
                                        callback();
                                    });
                                });
                            });
                        }
                    });
                }
            });
        }
    isStart && processTasks();
}
// normales Umspeichern, temp wird auf 0 gesetzt!!
function copyValue(args, callback) {
    getValue(args.temp, (err, value) => {
        if (value !== null && value !== undefined) {
            adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' = ' + value);
            value = value || 0; // protect against NaN
            setValueStat(args.save, value, () =>
                setValue(args.temp, 0, callback)
            );
        } else {
            adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' => no value found');
            callback && callback();
        }
    });
}

// Setzen der Ausgangspunkte für Min/Maxmit aktuelle Wert, anstatt mit 0
function copyValueActMinMax(args, callback) {
    getValue(args.temp, (err, value) => {
        if (value !== null && value !== undefined) {
            adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' = ' + value + ' to ' +args.save);
            value = value || 0; // protect against NaN
            setValueStat(args.save, value, () => {
                getValue(args.actual, (err, actual) => {
                    adapter.log.debug('[SET DAILY START MINMAX] Process ' + args.temp + ' = ' + actual + ' from ' + args.actual);
                    setValue(args.temp, actual, callback)
                });
            });
        } else {
            adapter.log.debug('[SAVE VALUES & SET DAILY START MINMAX] Process ' + args.temp + ' => no value found');
            callback && callback();
        }
    });
}

// für gruppenwerte
function copyValueRound(args, callback) {
    getValue(args.temp, (err, value) => {
        if (value !== null && value !== undefined) {
            adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' = ' + value + ' to ' +args.save);
            setValueStat(args.save, Math.round(value * 100) / 100, () => // may be use Math.floor here
                setValue(args.temp, 0, callback)
            );
        } else {
            adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' => no value found');
            callback && callback();
        }
    });
}

// avg Werte umspeichern und auf 0 setzen
function copyValue0(args, callback) {
    getValue(args.temp, (err, value, ts) => {
        value = value || 0;
        adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' = ' + value + ' to ' +args.save);
        setValueStat(args.save, value, () =>
            setValue(args.temp, 0, callback)
        );
    });
}

// Betriebszeitzählung umspeichern und temp Werte auf 0 setzen
function copyValue1000(args, callback) {
    getValue(args.temp, (err, value, ts) => {
        //value = Math.floor((value || 0) / 1000);
        adapter.log.debug('[SAVE VALUES] Process ' + args.temp + ' = ' + value + ' to ' +args.save);
        setValueStat(args.save, value, () =>
            setValue(args.temp, 0, callback)
        );
    });
}

function setTimeCountMidnight() {
    if (typeObjects.timeCount) {
        for (let s = 0; s < typeObjects.timeCount.length; s++) {
            const id = typeObjects.timeCount[s];
            //bevor umgespeichert wird, muß noch ein Aufruf mit actual erfolgen, damit die restliche Zeit vom letzten Signalwechsel bis Mitternacht erfolgt
            //aufruf von newTimeCntValue(id, "last") damit wird gleicher Zustand getriggert und last01 oder last10 zu Mitternacht neu gesetzt
            adapter.getForeignState(adapter.namespace + '.temp.timeCount.' + id + '.last', (err, last) => { //hier muss nur id stehen, dann aber noch Beachtung des Timestamps
                //evtl. status ermitteln und dann setForeignState nochmals den Zustand schreiben um anzutriggern und aktuelle Zeit zu verwenden (bzw. 00:00:00)
                let ts = new Date();
                //ts.setMinutes(ts.getMinutes() - 1);
                //ts.setSeconds(59);
                //ts.setMilliseconds(0);
                last.ts = ts.getTime()
                newTimeCntValue(id, last);
            });
        }
    }
}


const column = ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'];
const copyToSave = ['count', 'sumCount', 'sumGroup', 'sumDelta'];

// Store values to "save" for specific period
function saveValues(timePeriod) {
    const isStart = !tasks.length;
    const dayTypes = [];
    for (const key in typeObjects) {
        if (typeObjects.hasOwnProperty(key) &&
            typeObjects[key] &&
            typeObjects[key].length &&
            copyToSave.indexOf(key) !== -1
        ) {
            dayTypes.push(key);
        }
    }
    const day = column.indexOf(timePeriod);  // nameObjects[day] contains the time-related object value
    // all values
    adapter.log.debug('[SAVE VALUES] saving ' + timePeriod + ' values');

    // Schleife für alle Werte die durch day-variable bestimmt sind, gilt durch copyToSave für 'count', 'sumCount', 'sumGroup', 'sumDelta'
    // avg, timeCount /fivemin braucht extra Behandlung
    for (let t = 0; t < dayTypes.length; t++) {
        for (let s = 0; s < typeObjects[dayTypes[t]].length; s++) {
            // ignore last5min
            if (nameObjects[dayTypes[t]].temp[day] === 'last5Min') continue;
            const id = typeObjects[dayTypes[t]][s];
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.' + dayTypes[t] + '.' + id + '.' + nameObjects[dayTypes[t]].temp[day],
                    save: 'save.' + dayTypes[t] + '.' + id + '.' + nameObjects[dayTypes[t]].temp[day]
                },
                callback: dayTypes[t] === 'sumGroup' ? copyValueRound : copyValue
            });
        }
    }

    // avg values sind nur Tageswerte, also nur bei 'day' auszuwerten
    // Setzen auf den aktuellen Wert fehlt noch irgendwie ? jetz copyValueActMinMAx
    if (timePeriod === 'day' && typeObjects.avg) {
        for (let s = 0; s < typeObjects.avg.length; s++) {
            const id = typeObjects.avg[s];
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.avg.' + id + '.dayMin',
                    save: 'save.avg.' + id + '.dayMin',
                    actual: 'temp.avg.' + id + '.last',
                },
                callback: copyValueActMinMax
            });
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.avg.' + id + '.dayMax',
                    save: 'save.avg.' + id + '.dayMax',
                    actual: 'temp.avg.' + id + '.last',
                },
                callback: copyValueActMinMax
            });
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.avg.' + id + '.dayAvg',
                    save: 'save.avg.' + id + '.dayAvg',
                },
                callback: copyValue0
            });
            // just reset the counter
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.avg.' + id + '.dayCount'
                },
                callback: (args, callback) => setValueStat(args.temp, 0, callback)
            });
            // just reset the counter
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.avg.' + id + '.daySum'
                },
                callback: (args, callback) => setValueStat(args.temp, 0, callback)
            });
        }
    }

    // saving the dayly fiveMin max/min
    // Setzen auf den aktuellen Wert fehlt noch irgendwie ?
    if (timePeriod === 'day' && typeObjects.fiveMin) {
        for (let s = 0; s < typeObjects.fiveMin.length; s++) {
            const id = typeObjects.fiveMin[s];
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.fiveMin.' + id + '.dayMin5Min',
                    save: 'save.fiveMin.' + id + '.dayMin5Min'
                },
                callback: copyValue
            });
            tasks.push({
                name: 'async',
                args: {
                    temp: 'temp.fiveMin.' + id + '.dayMax5Min',
                    save: 'save.fiveMin.' + id + '.dayMax5Min'
                },
                callback: copyValue
            });
        }
    }

    // timeCount hat andere Objektbezeichnungen und deswegen kann day aus timeperiod nicht benutzt werden
    // day erst ab 2ter Stelle im Array (ohne 15min und hour soll benutzt werden) -> also (day > 1) und [day-2]
    if (day > 1) {
        if (typeObjects.timeCount) {
            for (let s = 0; s < typeObjects.timeCount.length; s++) {
                const id = typeObjects.timeCount[s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: 'temp.timeCount.' + id + '.' + nameObjects.timeCount.temp[day - 2], // 0 ist onDay
                        save: 'save.timeCount.' + id + '.' + nameObjects.timeCount.temp[day - 2],
                    },
                    callback: copyValue1000
                });
                tasks.push({
                    name: 'async',
                    args: {
                        temp: 'temp.timeCount.' + id + '.' + nameObjects.timeCount.temp[day + 3], // +5 ist offDay
                        save: 'save.timeCount.' + id + '.' + nameObjects.timeCount.temp[day + 3],
                    },
                    callback: copyValue1000
                });
            }
        }
    }
    // minmax hat andere Objektbezeichnungen und deswegen kann day aus timeperiod nicht benutzt werden
    // day erst ab 2ter Stelle im Array (ohne 15min und hour soll benutzt werden) -> also (day > 1) und [day-2]
    if (day > 1) { //bezieht sich auf column array
        if (typeObjects.minmax) {
            for (let s = 0; s < typeObjects.minmax.length; s++) {
                const id = typeObjects.minmax[s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: 'temp.minmax.' + id + '.' + nameObjects.minmax.temp[day - 2], // 0 ist minDay
                        save: 'save.minmax.' + id + '.' + nameObjects.minmax.temp[day - 2],
                        actual: 'temp.minmax.' + id + '.last',
                    },
                    callback: copyValueActMinMax
                });
                tasks.push({
                    name: 'async',
                    args: {
                        temp: 'temp.minmax.' + id + '.' + nameObjects.minmax.temp[day + 3], // +5 ist maxDay
                        save: 'save.minmax.' + id + '.' + nameObjects.minmax.temp[day + 3],
                        actual: 'temp.minmax.' + id + '.last',
                    },
                    callback: copyValueActMinMax
                });
            }
        }
    }
    isStart && processTasks();
}

function setInitial(type, id) {
    // if values have not already been logged from the last adapter start,
    // then fill them with '0' so that the read does not hit the values undefined.
    const nameObjectType = nameObjects[type];
    const objects = nameObjectType.temp;
    const isStart = !tasks.length;
    for (let s = 0; s < objects.length; s++) {
        tasks.push({
            name: 'async',
            args: {
                name: objects[s],
                id: 'temp.' + type + '.' + id + '.' + objects[s],
                trueId: id,
                type
            },
            wait: true,
            callback: (args, callback) => {
                adapter.log.debug('[SET INITIAL] ' + args.trueId + ' ' + args.type + ' ' + args.name);
                getValue(args.id, (err, value) => {
                    adapter.log.debug('[SET INITIAL] ' + args.trueId + ' value ' + args.id + ' exists ?  ' + value + ' in obj: ' + args.id);
                    if (value === null) {
                        adapter.log.debug('[SET INITIAL] ' + args.trueId + ' replace with 0 -> ' + args.id);
                        if (args.type === 'avg') {
                            if (args.name === 'dayCount') {
                                adapter.getForeignState(args.trueId, (er, value) => {
                                    if (value && value.val !== null) {
                                        setValue(args.id, 1, callback);
                                    } else {
                                        callback();
                                    }
                                });
                            } else {
                                adapter.getForeignState(args.trueId, (er, value) => { // get current value to set for initial min, max, last
                                    if (value && value.val !== null) {
                                        adapter.log.debug('[SET INITIAL] ' + args.trueId + ' object ' + args.trueId + ' ' + args.name);
                                        adapter.log.debug('[SET INITIAL] ' + args.trueId + ' act value ' + value.val);
                                        setValue(args.id, value.val, callback);
                                    } else {
                                        callback();
                                    }
                                });
                            }
                        } else if (args.type === 'minmax') {
                            adapter.getForeignState(args.trueId, (er, value) => { // get current value to set for initial min, max, last
                                if (value && value.val !== null) {
                                    adapter.log.debug('[SET INITIAL] ' + args.trueId + ' object ' + args.trueId + ' ' + args.name);
                                    adapter.log.debug('[SET INITIAL] ' + args.trueId + ' act value ' + value.val);
                                    setValue(args.id, value.val, callback);
                                } else {
                                    callback();
                                }
                            });
                        } else {
                            if (args.name === 'last01') {
                                adapter.getForeignState(args.trueId, (err, state) => { // get current value
                                    adapter.log.debug('[SET INITIAL] ' + args.trueId + ' object ' + args.trueId + ' ' + args.name);
                                    adapter.log.debug('[SET INITIAL] ' + args.trueId + ' act value ' + (state && state.val) + ' time ' + state.lc);
                                    if (isFalse(state && state.val)) {
                                        adapter.log.debug('[SET INITIAL] ' + args.trueId + ' state is false und last 01 now as lastChange');
                                        setValue(args.id, Date.now(), callback);
                                        setValue(args.id, Date.now(), callback);
                                    } else
                                        if (isTrue(state && state.val)) {
                                            adapter.log.debug('[SET INITIAL] ' + args.trueId + ' state is false und last 01  get old time');
                                            setValue(args.id, state.lc, callback);
                                        } else {
                                            adapter.log.error('[SET INITIAL] ' + args.trueId + ' unknown state to be evaluated in timeCount');
                                            callback();
                                        }
                                });
                            } else
                                if (args.name === 'last10') {
                                    adapter.getForeignState(args.trueId, (err, state) => { // get actual values
                                        adapter.log.debug('[SET INITIAL] ' + args.trueId + ' objects ' + args.trueId + ' ' + args.name);
                                        adapter.log.debug('[SET INITIAL] ' + args.trueId + ' act value ' + (state && state.val) + ' time ' + state.lc);
                                        if (isFalse(state && state.val)) {
                                            setValue(args.id, state.lc, callback);
                                            adapter.log.debug('[SET INITIAL] ' + args.trueId + ' state is false and last 10 get old time');
                                        } else
                                            if (isTrue(state && state.val)) {
                                                setValue(args.id, Date.now(), callback);
                                                adapter.log.debug('[SET INITIAL] ' + args.trueId + ' state is true and last 10 get now as lastChange');
                                            } else {
                                                adapter.log.error('[SET INITIAL] ' + args.trueId + ' unknown state to be evaluated in timeCount');
                                                callback();
                                            }
                                    });
                                } else
                                    if (args.name === 'lastPulse') {
                                        adapter.getForeignState(args.trueId, (err, state) => { // get actual values
                                            adapter.log.debug('[SET INITIAL] ' + args.trueId + ' objects ' + args.trueId + ' ' + args.name);
                                            adapter.log.debug('[SET INITIAL] ' + args.trueId + ' act value ' + (state && state.val) + ' time ' + state.lc);
                                            if (isTrue(state && state.val) || isFalse(state && state.val)) { //egal was drin ist, es muß zum Wertebereich passen und es wird auf den Wert von lastPulse gesetzt
                                                setValue(args.id, state.val, callback);
                                                adapter.log.debug('[SET INITIAL] ' + args.trueId + ' state was ' + state.val + ' and lastPulse get old time');
                                            } else {
                                                adapter.log.error('[SET INITIAL] ' + args.trueId + ' unknown state to be evaluated in count');
                                                callback();
                                            }
                                        });
                                    } else
                                        if (args.name === 'last') { // speichern des aktuellen Zustandes für timecount, sofern mit poll gleiche Zustände geholt werden und keinen Signalwechsel darstellen
                                            adapter.getForeignState(args.trueId, (err, state) => { // get actual value for the state in timecount
                                                adapter.log.debug('[SET INITIAL] ' + args.trueId + ' objects ' + args.trueId + ' ' + args.name);
                                                adapter.log.debug('[SET INITIAL] ' + args.trueId + ' act value ' + (state && state.val) + ' time ' + state.lc);
                                                if (isTrue(state && state.val) || isFalse(state && state.val)) { //egal was drin ist, es muß zum Wertebereich passen und es wird auf den Wert von lastPulse gesetzt
                                                    setValue(args.id, state.val, callback);
                                                    adapter.log.debug('[SET INITIAL] ' + args.trueId + ' state is ' + state.val + ' and set to last ');
                                                } else {
                                                    adapter.log.error('[SET INITIAL] ' + args.trueId + ' unknown state to be evaluated in count');
                                                    callback();
                                                }
                                            });
                                        } else {
                                            callback();
                                        }
                        }
                    } else {
                        callback();
                    }
                });
            }
        });
    }
    isStart && processTasks();
}

function defineObject(type, id, name, unit) {
    const isStart = !tasks.length;
    // Create channels
    tasks.push({
        name: 'setObjectNotExists',
        id: 'save.' + type + '.' + id,
        obj: {
            type: 'channel',
            common: {
                name: 'Save values for ' + name,
                role: 'sensor'
            },
            native: {
                addr: id
            }
        }
    });
    tasks.push({
        name: 'setObjectNotExists',
        id: 'temp.' + type + '.' + id,
        obj: {
            type: 'channel',
            common: {
                name: 'Temporary value for ' + name,
                role: 'sensor',
                // expert: true
            },
            native: {
                addr: id
            }
        }
    });

    // states for the saved values
    const nameObjectType = nameObjects[type];
    let objects = nameObjectType.save;
    for (let s = 0; s < objects.length; s++) {
        if (!stateObjects[objects[s]]) {
            adapter.log.error('[CREATION] State ' + objects[s] + ' unknown');
            continue;
        }
        const obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
        if (!obj) {
            adapter.log.error('[CREATION] Unknown state: ' + objects[s]);
            continue;
        }
        obj.native.addr = id;
        if (unit && objects[s] !== 'dayCount') {
            obj.common.unit = unit;
        }
        tasks.push({
            name: 'setObjectNotExists',
            id: 'save.' + type + '.' + id + '.' + objects[s],
            obj
        });
    }

    // states for the temporary values
    objects = nameObjectType.temp;
    for (let s = 0; s < objects.length; s++) {
        if (!stateObjects[objects[s]]) {
            adapter.log.error('[CREATION] State ' + objects[s] + ' unknown');
            continue;
        }
        const obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
        if (!obj) {
            adapter.log.error('[CREATION] Unknown state: ' + objects[s]);
            continue;
        }
        obj.native.addr = id;
        // obj.common.expert = true;
        if (unit && objects[s] !== 'dayCount') {
            obj.common.unit = unit;
        } else if (obj.common.unit !== undefined) {
            delete obj.common.unit;
        }
        tasks.push({
            name: 'setObjectNotExists',
            id: 'temp.' + type + '.' + id + '.' + objects[s],
            obj
        });
    }
    isStart && processTasks();
    setInitial(type, id);
}

function setupObjects(ids, callback, isStart, noSubscribe) {
    if (!ids || !ids.length) {
        isStart && processTasks();
        return callback && callback();
    }
    if (isStart === undefined) {
        isStart = !tasks.length;
    }
    const id = ids.shift();
    const obj = statDP[id];
    let subscribed = !!noSubscribe;
    if (!obj.groupFactor && obj.groupFactor !== '0' && obj.groupFactor !== 0) {
        obj.groupFactor = parseFloat(adapter.config.groupFactor) || 1;
    } else {
        obj.groupFactor = parseFloat(obj.groupFactor) || 1;
    }
    if (!obj.impUnitPerImpulse && obj.impUnitPerImpulse !== '0' && obj.impUnitPerImpulse !== 0) {
        obj.impUnitPerImpulse = parseInt(adapter.config.impUnitPerImpulse, 10) || 1;
    } else {
        obj.impUnitPerImpulse = parseInt(obj.impUnitPerImpulse, 10) || 1;
    }
    // merge der Kosten in den Datensatz
    if (obj.sumGroup && ((obj.count && obj.sumCount) || obj.sumDelta)) {
        groups[obj.sumGroup] = groups[obj.sumGroup] || { config: adapter.config.groups.find(g => g.id === obj.sumGroup), items: [] };
        if (groups[obj.sumGroup].items.indexOf(id) === -1) {
            groups[obj.sumGroup].items.push(id);
        }
    }

    // Function is called with the custom objects
    adapter.log.debug('[CREATION] ============================== ' + id + ' =============================');
    adapter.log.debug('[CREATION] setup of object ' + JSON.stringify(obj));
    const logName = obj.logName;
    if (obj.avg && !obj.sumDelta) {
        if (!typeObjects.avg || typeObjects.avg.indexOf(id) === -1) {
            typeObjects.avg = typeObjects.avg || [];
            typeObjects.avg.push(id);
        }
        defineObject('avg', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.avg',
            obj: {
                type: 'channel',
                common: {
                    name: 'Average values',
                    role: 'sensor'
                },
                native: {}
            }
        });
        subscribed = true;
    }
    //	minmax over time
    if (obj.minmax) {
        if (!typeObjects.minmax || typeObjects.minmax.indexOf(id) === -1) {
            typeObjects.minmax = typeObjects.minmax || [];
            typeObjects.minmax.push(id);
        }
        defineObject('minmax', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.minmax',
            obj: {
                type: 'channel',
                common: {
                    name: 'MinMax values',
                    role: 'sensor'
                },
                native: {}
            }
        });
        subscribed = true;
    }
    // 5minutes Values can only be determined when counting
    adapter.log.debug('[CREATION] fiveMin = ' + obj.fiveMin + ',  count =  ' + obj.count);

    if (obj.fiveMin && obj.count) {
        if (!typeObjects.fiveMin || typeObjects.fiveMin.indexOf(id) === -1) {
            typeObjects.fiveMin = typeObjects.fiveMin || [];
            typeObjects.fiveMin.push(id);
        }
        defineObject('fiveMin', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.fiveMin',
            obj: {
                type: 'channel',
                common: {
                    name: '5min Consumption',
                    role: 'sensor'
                },
                native: {}
            }
        });
        subscribed = true;
    }

    if (obj.timeCount) {
        if (!typeObjects.timeCount || typeObjects.timeCount.indexOf(id) === -1) {
            typeObjects.timeCount = typeObjects.timeCount || [];
            typeObjects.timeCount.push(id);
        }
        defineObject('timeCount', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.timeCount',
            obj: {
                type: 'channel',
                common: {
                    name: 'Operation time counter',
                    role: 'sensor'
                },
                native: {}
            }
        });
        subscribed = true;
    }

    if (obj.count) {
        if (!typeObjects.count || typeObjects.count.indexOf(id) === -1) {
            typeObjects.count = typeObjects.count || [];
            typeObjects.count.push(id);
        }
        defineObject('count', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.count',
            obj: {
                type: 'channel',
                common: {
                    name: 'Impulse counter, Counting of switching cycles',
                    role: 'sensor'
                },
                native: {}
            }
        });
        subscribed = true;
    }

    // Conversion pulses into consumption is only useful if pulses exist
    if (obj.sumCount && obj.count) {
        if (!typeObjects.sumCount || typeObjects.sumCount.indexOf(id) === -1) {
            typeObjects.sumCount = typeObjects.sumCount || [];
            typeObjects.sumCount.push(id);
        }
        defineObject('sumCount', id, logName, obj.unit); //type, id, name, Unit
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.sumCount',
            obj: {
                type: 'channel',
                common: {
                    name: 'Consumption from impulse counter',
                    role: 'sensor'
                },
                native: {}
            }
        });
    }

    if (obj.sumDelta) {
        if (!typeObjects.sumDelta || typeObjects.sumDelta.indexOf(id) === -1) {
            typeObjects.sumDelta = typeObjects.sumDelta || [];
            typeObjects.sumDelta.push(id);
        }
        defineObject('sumDelta', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: 'save.sumDelta',
            obj: {
                type: 'channel',
                common: {
                    name: 'Consumption',
                    role: 'sensor'
                },
                native: {}
            }
        });
        subscribed = true;
    }
    // sumGroup only makes sense if there are also the delta values
    if (obj.sumGroup && (obj.sumDelta || (obj.sumCount && obj.count))) {
        // submit sumgroupname for object creation
        if (groups[obj.sumGroup] && groups[obj.sumGroup].config) {
            if (!typeObjects.sumGroup || typeObjects.sumGroup.indexOf(obj.sumGroup) === -1) {
                typeObjects.sumGroup = typeObjects.sumGroup || [];
                typeObjects.sumGroup.push(obj.sumGroup);
            }
            defineObject('sumGroup', obj.sumGroup, 'Sum for ' + obj.sumGroup); //type, id ist der gruppenname, name
            tasks.push({
                name: 'setObjectNotExists',
                id: 'save.sumGroup',
                obj: {
                    type: 'channel',
                    common: {
                        name: 'Total consumption',
                        role: 'sensor'
                    },
                    native: {}
                }
            });
        } else {
            adapter.log.error('[CREATION] No group config found for ' + obj.sumGroup);
        }
    }
    setImmediate(setupObjects, ids, callback, isStart);
}

function processTasks() {
    if (!tasks || !tasks.length) {
        units = {};
        return;
    }
    const task = tasks.shift();
    if (task.name === 'setObjectNotExists') {
        const attr = task.id.split('.').pop();
        // detect unit
        if (task.obj.native.addr &&
            task.obj.type === 'state' &&
            units[task.obj.native.addr] === undefined &&
            nameObjects.timeCount.temp.indexOf(attr) === -1 &&
            !task.id.match(/\.dayCount$/) &&       // !! Problem mit .?
            !task.id.startsWith('save.sumGroup.') &&
            !task.id.startsWith('temp.sumGroup.')) {
            adapter.getForeignObject(task.obj.native.addr, (err, obj) => {
                if (obj && obj.common.unit) {
                    task.obj.common.unit = obj.common.unit;
                    units[task.obj.native.addr] = obj.common.unit;
                } else {
                    units[task.obj.native.addr] = '';
                }

                adapter.setObjectNotExists(task.id, task.obj, (err, isCreated) => {
                    if (isCreated) {
                        adapter.log.debug('[CREATION] ' + task.id);
                    }
                    if (task.subscribe) {
                        adapter.subscribeForeignStates(task.subscribe, () => {
                            setImmediate(processTasks);
                        });
                    } else {
                        setImmediate(processTasks);
                    }
                });
            });
        } else {
            if (task.obj.native.addr && !task.id.match(/\.dayCount$/)) { // !! Problem mit .?
                if (units[task.obj.native.addr] !== undefined) {
                    if (units[task.obj.native.addr]) {
                        task.obj.common.unit = units[task.obj.native.addr];
                    }
                } else
                    if (task.id.startsWith('save.sumGroup.') || task.id.startsWith('temp.sumGroup.')) {
                        task.obj.common.unit = groups[task.obj.native.addr] && groups[task.obj.native.addr].config && groups[task.obj.native.addr].config.priceUnit ? groups[task.obj.native.addr].config.priceUnit.split('/')[0] : '€';
                    }
            }

            adapter.setObjectNotExists(task.id, task.obj, (err, isCreated) => {
                if (isCreated) {
                    adapter.log.debug('[CREATION] ' + task.id);
                }
                if (task.subscribe) {
                    adapter.subscribeForeignStates(task.subscribe, () => setImmediate(processTasks));
                } else {
                    setImmediate(processTasks);
                }
            });
        }
    } else if (task.name === 'async') {
        if (typeof task.callback === 'function') {
            task.callback(task.args, () => setImmediate(processTasks));
        } else {
            adapter.log.error('error');
        }
    }
}
function padding(text, num) {
    if (text.length > num) {
        return text;
    } else {
        return text + new Array(num - text.length).join(' ');
    }
}
function getCronStat() {
    for (const type in crons) {
        if (crons.hasOwnProperty(type)) {
            adapter.log.debug('[INFO] ' + padding(type, 15) + '      status = ' + crons[type].running + ' next event: ' + timeConverter(crons[type].nextDates()));
        }
    }
}

function main() {
    // typeObjects is rebuilt after starting the adapter
    // deleting data points during runtime must be cleaned up in both arrays
    // reading the setting (here come with other setting!)
    adapter.objects.getObjectView('custom', 'state', {}, (err, doc) => {
        let objCount = 0;
        if (doc && doc.rows) {
            for (let i = 0, l = doc.rows.length; i < l; i++) {
                if (doc.rows[i].value) {
                    const id = doc.rows[i].id;
                    const custom = doc.rows[i].value;
                    if (!custom || !custom[adapter.namespace] || !custom[adapter.namespace].enabled) continue;
                    statDP[id] = custom[adapter.namespace]; // all-inclusive assumption of all answers
                    objCount++;
                    adapter.log.info('[CREATION] enabled statistics for ' + id);
                }
            }
            const keys = Object.keys(statDP);
            setupObjects(keys, () => {
                adapter.log.info('[INFO] statistics observes ' + objCount + ' values after startup');
                for (const type in typeObjects) {
                    if (typeObjects.hasOwnProperty(type)) {
                        for (let i = 0; i < typeObjects[type].length; i++) {
                            adapter.log.info('[INFO] monitor "' + typeObjects[type][i] + '" as ' + type);
                        }
                    }
                }
                getCronStat();
            });
        }
    });

    // create cron-jobs
    const timezone = adapter.config.timezone || 'Europe/Berlin';

    // every 5min
    crons.avg5min = new CronJob('*/5 * * * *',
        () => fiveMin(),
        () => adapter.log.debug('stopped 5min'), // This function is executed when the job stops
        true,
        timezone
    );

    // Every 15 minutes
    crons.fifteenMinSave = new CronJob('0,15,30,45 * * * *',
        () => saveValues('15Min'),
        () => adapter.log.debug('stopped daySave'), // This function is executed when the job stops
        true,
        timezone
    );

    // Hourly at 00 min
    crons.hourSave = new CronJob('0 * * * *',
        () => saveValues('hour'),
        () => adapter.log.debug('stopped daySave'), // This function is executed when the job stops
        true,
        timezone
    );
    
    // daily um 23:59:58
    crons.dayTriggerTimeCount = new CronJob('58 59 23 * * *',                       
        () => setTimeCountMidnight(),
        () => adapter.log.debug('stopped timecount midnight trigger'), // This function is executed when the job stops
        true,
        timezone
    );
    
    // daily um 00:00
    crons.daySave = new CronJob('0 0 * * *',
        () => saveValues('day'),
        () => adapter.log.debug('stopped daySave'), // This function is executed when the job stops
        true,
        timezone
    );

    // Monday 00:00
    crons.weekSave = new CronJob('0 0 * * 1',
        () => saveValues('week'),
        () => adapter.log.debug('stopped week'), // This function is executed when the job stops
        true,
        timezone
    );

    // Monthly at 1 of every month at 00:00
    crons.monthSave = new CronJob('0 0 1 * *',
        () => saveValues('month'),
        () => adapter.log.debug('stopped month'), // This function is executed when the job stops
        true,
        timezone
    );

    // Quarter
    crons.quarterSave = new CronJob('0 0 1 0,3,6,9 *',
        () => saveValues('quarter'),
        () => adapter.log.debug('stopped quarter'), // This function is executed when the job stops
        true,
        timezone
    );

    // New year
    crons.yearSave = new CronJob('0 0 1 0 *',
        () => saveValues('year'), // Months is value range 0-11
        () => adapter.log.debug('stopped yearSave'),
        true,
        timezone
    );

    // subscribe to objects, so the settings in the object are arriving to the adapter
    adapter.subscribeForeignObjects('*');
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
