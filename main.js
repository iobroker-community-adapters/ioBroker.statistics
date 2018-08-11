/**
 *
 * statistics adapter
 *
 * the adapter creates new states according to the configuration
 * the configured objects are subscribed for changes and the statistic is calculated
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require('./lib/utils'); // Get common adapter utils
const stateObjects = require('./lib/objects');
const CronJob = require('cron').CronJob;

const adapter = utils.Adapter('statistics');

let crons = {};
const typeObjects = {}; //zum Merken der benutzen Objekte innerhalb der Typen(Berechnungen)
const statDP = {}; //enthält die kompletten Datensätze (anstatt adapter.config)
const groups = {};
let units = {};
const tasks = [];

const nameObjects = {
    count: { // Impulse zählen oder Schaltspiele zählen
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'last5Min']
    },
    sumCount: { // Aufsummierung analoger Werte (Verbrauch aus Impulsen) Multiplikation mit Preis = Kosten
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    },
    sumDelta: { // Verbrauch aus fortlaufenden Größen () Multiplikation mit Preis = Kosten
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'delta', 'last'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'last5Min']
    },
    sumGroup: { // Summenverbrauch aus fortlaufenden Größen
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    },
    avg: { // Mittelwerte etc.
        save: ['dayMin', 'dayMax', 'dayAvg'],
        temp: ['dayMin', 'dayMax', 'dayAvg', 'dayCount', 'daySum']
    },
    timeCount: { // Betriebszeitzählung aus Statuswechsel
        save: ['onDay', 'onWeek', 'onMonth', 'onQuarter', 'onYear', 'offDay', 'offWeek', 'offMonth', 'offQuarter', 'offYear'],
        temp: ['onDay', 'onWeek', 'onMonth', 'onQuarter', 'onYear', 'offDay', 'offWeek', 'offMonth', 'offQuarter', 'offYear', 'last01', 'last10']
    },
    fiveMin: { // 5 Minuten werte etc. nur bei Impulsen sinnvoll
        save: ['mean5Min', 'dayMax5Min', 'dayMin5Min'],
        temp: ['mean5Min', 'dayMax5Min', 'dayMin5Min']
    },
};

function stop () {
    for (const type in crons) {
        if (crons.hasOwnProperty(type) && crons[type]) {
            crons[type].stop();
            crons[type] = null;
        }
    }
}

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', callback => {
    try {
        adapter && adapter.log && adapter.log.info && adapter.log.info('cleaned everything up...');
        // evtl. auch noch ein paar schedules löschen
        stop();
        callback();
    } catch (e) {
        callback();
    }

});

// is called if a subscribed object changes
adapter.on('objectChange', (id, obj) => {
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
});

// is called if a subscribed state changes
adapter.on('stateChange', (id, state) => {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && state.ack) {
        if (typeObjects.sumDelta && typeObjects.sumDelta.indexOf(id) !== -1) {
            newSumDeltaValue(id, state.val);
        } else
        if (typeObjects.avg && typeObjects.avg.indexOf(id) !== -1) {
            newAvgValue(id, state.val);
        }

        if (typeObjects.count && typeObjects.count.indexOf(id) !== -1) {
            newCountValue(id, state.val);
        }
        if (typeObjects.timeCount && typeObjects.timeCount.indexOf(id) !== -1) {
            newTimeCntValue(id, state);
        }
        // 5min wird zyklisch behandelt
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', obj => {
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
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', main);

function removeObject(id) {
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
            groups[g].items.splice(pos, 1);
        }
    }
}

process.on('SIGINT', stop);

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
    adapter.log.debug('making 5min evaluation');
    const isStart = !tasks.length;

    /**
     * 5min Werte ermitteln
     *
     * derzeitiges min aus temp holen
     * derzeitiges max aus temp holen
     * aktuellen value aus dem überwachten Zähler
     * alten value (vor 5min) aus dem dem überwachten zähler
     *
     * bestimmung delta und entscheidung ob neuer min/max abgespeichert wird
     * aktueller Zählerstand wird in den altwert geschrieben
     *
     * typeObjects.fiveMin[t] enthält die objectId des überwachten Zählers
     *
     *
     */
    // alle subscribed objects durchlaufen und schreiben

    if (typeObjects.fiveMin) {
        for (let t = 0; t < typeObjects.fiveMin.length; t++) {
            tasks.push({
                name: 'async',
                args: {id: typeObjects.fiveMin[t]},
                callback: (args, callback) => {
                    let temp5MinID;
                    let actualID;
                    if (statDP[args.id].sumDelta) {
                        temp5MinID = adapter.namespace + '.temp.sumDelta.' + args.id + '.last5Min';
                        actualID = adapter.namespace + '.save.sumDelta.' + args.id + '.last';
                    } else {
                        temp5MinID = adapter.namespace + '.temp.count.' + args.id + '.last5Min';
                        actualID = adapter.namespace + '.temp.count.' + args.id + '.day';
                    }
                    adapter.getForeignState(actualID, (err, actual) => {
                        if (!actual || actual.val === null) {
                            return callback();
                        }
                        adapter.getForeignState(adapter.namespace + '.temp.fiveMin.' + args.id + '.dayMin5Min', (err, min) => {
                            adapter.getForeignState(adapter.namespace + '.temp.fiveMin.' + args.id + '.dayMax5Min', (err, max) => {
                                adapter.getForeignState(temp5MinID, (err, old) => {
                                    // Write actual state into counter object
                                    adapter.setForeignState(temp5MinID, actual.val, true, () => {
                                        if (!old || old.val === null) {
                                            return callback();
                                        }
                                        const delta = actual.val - old.val;

                                        adapter.log.debug('fiveMin; of : ' + args.id + ' with  min: ' + (min && min.val) + ' max: ' + (max && max.val) + ' actual: ' + actual + ' old: ' + (old && old.val) + ' delta: ' + delta);

                                        adapter.setForeignState(adapter.namespace + '.temp.fiveMin.' + args.id + '.mean5Min', delta, true, () => {
                                            if (!max || max.val === null || delta > max.val) {
                                                adapter.setForeignState(adapter.namespace + '.temp.fiveMin.' + args.id + '.dayMax5Min', delta, true, callback);
                                                callback = null;
                                            }
                                            if (!min || min.val === null || delta < min.val) {
                                                adapter.setForeignState(adapter.namespace + '.temp.fiveMin.' + args.id + '.dayMin5Min', delta, true, callback);
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

function newAvgValue(id, value) {
    const isStart = !tasks.length;
    /**
     * vergleich zwischen letzten min/max und jetzt übermittelten value
     */
    value = parseFloat(value) || 0;
    adapter.log.debug('avg call: ' + id + ' value ' + value);
    tasks.push({
        name: 'async',
        args: {
            id,
            value
        }, callback: (args, callback) => {
            adapter.getForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayCount', (err, count) => {
                count = count && count.val ? count.val + 1 : 1;
                adapter.setForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayCount', count, true, () => {

                    adapter.getForeignState(adapter.namespace + '.temp.avg.' + args.id + '.daySum', (err, sum) => {
                        sum = sum && sum.val ? sum.val + value : value;
                        adapter.setForeignState(adapter.namespace + '.temp.avg.' + args.id + '.daySum', sum, true, () => {

                            adapter.setForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayAvg', sum / count, true, () => {

                                adapter.getForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayMin', (err, tempMin) => {
                                    const min = tempMin && tempMin.val;
                                    if (!tempMin || tempMin.val === null || min > value) {
                                        adapter.setForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayMin', value, true);
                                        adapter.log.debug('new min for "' + args.id  + ': ' + value);
                                    }

                                    adapter.getForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayMax', (err, tempMax) => {
                                        const max = tempMax && tempMax.val;
                                        if (!tempMax || tempMax.val === null || max < value) {
                                            adapter.setForeignState(adapter.namespace + '.temp.avg.' + args.id + '.dayMax', value, true, callback);
                                            adapter.log.debug('new max for "' + args.id  + ': ' + value);
                                        } else {
                                            callback();
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

function newCountValue(id, value) {
    const isStart = !tasks.length;
    /*
    value mit Grenzwert oder state
    Wechsel auf 1 -> Erhöhung um 1
    Wert größer threshold -> Erhöhung um 1
    */
    adapter.log.debug('count call ' + id + ' with ' + value);

    if (isTrue(value)) {
        tasks.push({
            name: 'async',
            args: {id},
            callback: (args, callback) => {
                for (let s = 0; s < nameObjects.count.temp.length; s++) {
                    tasks.push({
                        name: 'async',
                        args: {
                            id: adapter.namespace + '.temp.count.' + id + '.' + nameObjects.count.temp[s]
                        },
                        callback: (args, callback) => {
                            adapter.log.debug('Increasing ' + args.id);
                            adapter.getForeignState(args.id, (err, oldVal) =>
                                adapter.setForeignState(args.id, oldVal && oldVal.val ? oldVal.val + 1 : 1, true, callback)
                            )
                        }
                    });
                    
                    // Berechnung des Verbrauchs (was ist ein Impuls in physikalischer Größe)
                    if (typeObjects.sumCount &&
                        typeObjects.sumCount.indexOf(args.id) !== -1 &&
                        statDP[args.id].impUnitPerImpulse) { // counter mit Verbrauch
                        tasks.push({
                            name: 'async',
                            args: {
                                id: adapter.namespace + '.temp.sumCount.' + args.id + '.' + nameObjects.count.temp[s],
                                impUnitPerImpulse: statDP[args.id].impUnitPerImpulse
                            },
                            callback: (args, callback) => {
                                adapter.log.debug('Increasing ' + args.id);
                                adapter.getForeignState(args.id, (err, consumption) =>
                                    adapter.setForeignState(args.id, consumption && consumption.val ? consumption.val + args.impUnitPerImpulse : args.impUnitPerImpulse, true, callback)
                                )
                            }
                        });

                        // add consumption to group
                        if (statDP[args.id].sumGroup &&
                            groups[statDP[args.id].sumGroup] &&
                            statDP[args.id].impUnitPerImpulse &&
                            statDP[args.id].groupFactor
                        ) {
                            for (let i = 0; i < nameObjects.sumGroup.temp.length; i++) {
                                tasks.push({
                                    name: 'async',
                                    args: {
                                        delta: statDP[args.id].impUnitPerImpulse * statDP[args.id].groupFactor,
                                        id: adapter.namespace + '.temp.sumGroup.' + statDP[args.id].sumGroup + '.' + nameObjects.sumGroup.temp[i]
                                    },
                                    callback: (args, callback) =>
                                        adapter.getForeignState(args.id, (err, value) => {
                                            adapter.log.debug('Increase ' + args.id + ' on ' + args.delta);
                                            adapter.setForeignState(args.id, ((value && value.val) || 0) + args.delta, true, callback);
                                        })
                                });
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

function newSumDeltaValue(id, value) {
    const isStart = !tasks.length;
    /*
    als fortlaufenden Zählerständen den Verbrauch je Zeitraum ermitteln
    Gültigkeitsprüfung neuer Wert muß größer sein als alter
    Substraktion mit letzten Wert Day
    Subtraktion mit letzten Wert today -> delta für Sum
    Delta auf alle Werte aufaddieren
    eigene Werte anders behandeln (Datenpunktname)
    */

    value = parseFloat(value) || 0;

    tasks.push({
        name: 'async',
        args: {id},
        callback: (args, callback) => {
            adapter.getForeignState(adapter.namespace + '.save.sumDelta.' + args.id + '.last', (err, old) => {
                tasks.push({
                    name: 'async',
                    args: {id: adapter.namespace + '.save.sumDelta.' + args.id + '.last', value},
                    callback: (args, callback) =>
                        adapter.setForeignState(args.id, args.value, true, callback)
                });

                if (!old || old.val === null) {
                    return callback();
                }

                let delta = old && old.val !== null ? value - old.val : 0;
                if (delta < 0) {
                    if (statDP[args.id].sumIgnoreMinus) {
                        delta = 0;
                    } else {
                        // Zählerüberlauf!
                        delta = value; // Differenz zwischen letzten Wert und Überlauf ist Fehlerquote
                    }
                }
                tasks.push({
                    name: 'async',
                    args: {delta, id: adapter.namespace + '.save.sumDelta.' + args.id + '.delta'},
                    callback: (args, callback) =>
                        adapter.setForeignState(args.id, args.delta, true, callback)
                });

                for (let i = 0; i < nameObjects.sumDelta.temp.length; i++) {
                    tasks.push({
                        name: 'async',
                        args: {delta, id: adapter.namespace + '.temp.sumDelta.' + args.id + '.' + nameObjects.sumDelta.temp[i]},
                        callback: (args, callback) =>
                            adapter.getForeignState(args.id, (err, value) => {
                                adapter.log.debug('Increase ' + args.id + ' on ' + args.delta);
                                adapter.setForeignState(args.id, ((value && value.val) || 0) + args.delta, true, callback);
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
                    for (let i = 0; i < nameObjects.sumGroup.temp.length; i++) {
                        tasks.push({
                            name: 'async',
                            args: {delta: delta * statDP[args.id].groupFactor, id: adapter.namespace + '.temp.sumGroup.' + statDP[args.id].sumGroup + '.' + nameObjects.sumGroup.temp[i]},
                            callback: (args, callback) =>
                                adapter.getForeignState(args.id, (err, value) => {
                                    adapter.log.debug('Increase ' + args.id + ' on ' + args.delta);
                                    adapter.setForeignState(args.id, ((value && value.val) || 0) + args.delta, true, callback);
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

function isTrue(val) {
    return val === 1 || val === true || val === 'true' || val === 'on' || state === 'ON';
}

function isFalse(val) {
    return val === 0 || val === false || val === 'false' || val === 'off' || val === 'OFF' || val === 'standby'
}

function newTimeCntValue(id, state) {
    const isStart = !tasks.length;
    /*
    value mit threshold oder state
    Wechsel auf 1 bei threshold 0 -> Zeit zwischen Ereignis seit letzter 0
    Addition der Zeit

    Wechsel auf 0 bei threshold 1 -> Zeit zwischen Ereignis seit letzter 1
    Addition der Zeit
    */
    adapter.log.debug('timecount call ' + id + ' with ' + val);

    if (isTrue(state.val)) {
        tasks.push({
            name: 'async',
            args: {
                id,
                state
            },
            callback: (args, callback) => {
                adapter.getForeignState(adapter.namespace + '.temp.timeCount.' + args.id + '.last10', (err, last) => {
                    const delta = last && last.val ? state.lc - last.val : 0;
                    adapter.setForeignState(adapter.namespace + '.temp.timeCount.' + args.id + '.last01', state.lc, true, () => {
                        adapter.log.debug('0->1 delta ' + delta + ' state ' + state.lc + ' last ' + last.val);

                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) {
                            if (nameObjects.timeCount.temp[s].match(/\.off\w+$/)) {
                                tasks.push({
                                    name: 'async',
                                    args: {
                                        id: adapter.namespace + '.temp.timeCount.' + args.id + '.' + nameObjects.timeCount.temp[s]
                                    },
                                    callback: (args, callback) => {
                                        adapter.getForeignState(args.id, (err, time) =>
                                            adapter.setForeignState(args.id, time && time.val ? time.val + delta : delta, true, callback)
                                        )
                                    }
                                });
                            }
                        }
                        callback();
                    });
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
                adapter.getForeignState(adapter.namespace + '.temp.timeCount.' + args.id + '.last01', (err, last) => {
                    const delta = last && last.val ? state.lc - last.val : 0;
                    adapter.setForeignState(adapter.namespace + '.temp.timeCount.' + args.id + '.last10', state.lc, true, () => {
                        adapter.log.debug('1->0 delta ' + delta + ' state ' + state.lc + ' last ' + last.lc);

                        for (let s = 0; s < nameObjects.timeCount.save.length; s++) {
                            if (nameObjects.timeCount.save[s].match(/\.on\w+$/)) {
                                tasks.push({
                                    name: 'async',
                                    args: {
                                        id: adapter.namespace + '.temp.timeCount.' + args.id + '.' + nameObjects.timeCount.save[s]
                                    },
                                    callback: (args, callback) => {
                                        adapter.getForeignState(args.id, (err, time) =>
                                            adapter.setForeignState(args.id, time && time.val ? time.val + delta : delta, true, callback)
                                        )
                                    }
                                });
                            }
                        }
                        callback();
                    });
                });
            }
        });
    }
    isStart && processTasks();
}

// zum gegebenen Zeitpunkt die Daten speichern, neue Variante
function saveValues(timePeriod) {
    const isStart = !tasks.length;
    const dayTypes = [];
    for (const key in typeObjects) {
        if (typeObjects.hasOwnProperty(key) &&
            (key === 'sumCount' || key === 'count' || key === 'sumDelta' || key === 'avg' || key === 'sumGroup') &&
            typeObjects[key].length !== -1) {
            dayTypes.push(key);
        }
    }

    adapter.log.debug('dayTypes ' + JSON.stringify(dayTypes));

    const column = ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'];

    const day = column.indexOf(timePeriod);  // nameObjects[day] enthält den zeitbezogenen Objektwert

    if (timePeriod === 'day') {
        adapter.log.debug('saving ' + timePeriod + ' values ' + day);
        // wenn daytype eine Länge hat, dann gibt es auch mindestens ein objekt zum logging
        for (let t = 0; t < dayTypes.length; t++) {
            for (let s = 0; s < typeObjects[dayTypes[t]].length; s++) {
                if (nameObjects[dayTypes[t]].temp[day] === 'temp15Min') continue;
                const id = typeObjects[dayTypes[t]][s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.' + dayTypes[t] + '.' + id + '.' + nameObjects[dayTypes[t]].temp[day],
                        save: adapter.namespace + '.save.' + dayTypes[t] + '.' + id + '.' + nameObjects[dayTypes[t]].temp[day]
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });
            }
        }

        if (typeObjects.avg) {
            for (let s = 0; s < typeObjects.avg.length; s++) {
                const id = typeObjects.avg[s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.avg.' + id + '.dayMin',
                        save: adapter.namespace + '.save.avg.' + id + '.dayMin',
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });

                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.avg.' + id + '.dayMax',
                        save: adapter.namespace + '.save.avg.' + id + '.dayMax',
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });

                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.avg.' + id + '.dayAvg',
                        save: adapter.namespace + '.save.avg.' + id + '.dayAvg',
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });

                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.avg.' + id + '.dayCount',
                        save: adapter.namespace + '.save.avg.' + id + '.dayCount',
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });

                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.avg.' + id + '.daySum',
                        save: adapter.namespace + '.save.avg.' + id + '.daySum',
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });
            }
        }

        // saving the fiveMin max/min
        if (typeObjects.fiveMin) {
            for (let s = 0; s < typeObjects.fiveMin.length; s++) {
                const id = typeObjects.fiveMin[s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.fiveMin.' + id + '.dayMin5Min',
                        save: adapter.namespace + '.save.fiveMin.' + id + '.dayMin5Min'
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.fiveMin.' + id + '.dayMax5Min',
                        save: adapter.namespace + '.save.fiveMin.' + id + '.dayMax5Min'
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, null, true, callback)
                            )
                        )
                });
            }
        }

        if (typeObjects.timeCount) {
            for (let s = 0; s < typeObjects.timeCount.length; s++) {
                const id = typeObjects.timeCount[s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.timeCount.' + id + '.' + nameObjects.timeCount.temp[day],
                        save: adapter.namespace + '.save.timeCount.' + id + '.' + nameObjects.timeCount.temp[day],
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, Math.floor((value ? value.val || 0 : 0) / 1000), true, () =>
                                adapter.setForeignState(args.temp, 0, true, callback)
                            )
                        )
                });
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.timeCount.' + id + '.' + nameObjects.timeCount.temp[day + 5],
                        save: adapter.namespace + '.save.timeCount.' + id + '.' + nameObjects.timeCount.temp[day + 5],
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, Math.floor((value ? value.val || 0 : 0)/ 1000), true, () =>
                                adapter.setForeignState(args.temp, 0, true, callback)
                            )
                        )
                });
            }
        }
    } else {
        // all values not belonging to day
        adapter.log.debug('saving ' + timePeriod + ' values');
        for (let t = 0; t < dayTypes.length; t++) {
            for (let s = 0; s < typeObjects[dayTypes[t]].length; s++) {
                const id = typeObjects[dayTypes[t]][s];
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.' + dayTypes[t] + '.' + id + '.' + nameObjects[dayTypes[t]].temp[day],
                        save: adapter.namespace + '.save.' + dayTypes[t] + '.' + id + '.' + nameObjects[dayTypes[t]].temp[day]
                    },
                    callback: (args, callback) => {
                        adapter.log.debug('Process ' + args.temp);
                        adapter.getForeignState(args.temp, (err, value) => {
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, 0, true, callback)
                            )
                        })
                    }
                });
            }
        }
        // saving the timecount not for the day
        if (typeObjects.timeCount) {
            for (let s = 0; s < typeObjects.timeCount.length; s++) {
                const id = typeObjects.timeCount[s];
                // add on
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.' + id + '.' + nameObjects[day],
                        save: adapter.namespace + '.save.' + id + '.' + nameObjects[day]
                    },
                    callback: (args, callback) => {
                        adapter.log.debug('Process ' + args.temp);
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, 0, true, callback)
                            )
                        )
                    }
                });
                // add off
                tasks.push({
                    name: 'async',
                    args: {
                        temp: adapter.namespace + '.temp.' + id + '.' + nameObjects.timeCount.temp[day + 5],
                        save: adapter.namespace + '.save.' + id + '.' + nameObjects.timeCount.temp[day + 5]
                    },
                    callback: (args, callback) =>
                        adapter.getForeignState(args.temp, (err, value) =>
                            adapter.setForeignState(args.save, value.val, true, () =>
                                adapter.setForeignState(args.temp, 0, true, callback)
                            )
                        )
                });
            }
        }
    }
    isStart && processTasks();
}

function setInitial(type, id) {
    //wenn nicht schon vom letzten Adapterstart Werte geloggt wurden, dann diese jetzt mit '0' befüllen, damit der read auf die Werte nicht auf undefined trifft.
    const nameObjectType = nameObjects[type];
    const objects = nameObjectType.temp;
    const isStart = !tasks.length;
    
    for (let s = 0; s < objects.length; s++) {
        tasks.push({
            name: 'async',
            args: {
                name: objects[s],
                id: adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[s],
                trueId: id,
                type
            },
            wait: true,
            callback: (args, callback) => {
                adapter.log.debug('[set initial] ' + args.trueId + ' ' + args.type + ' ' + args.name);
                adapter.getForeignState(args.id, (err, value) => {
                    adapter.log.debug('[set initial] ' + args.trueId + ' value ' + args.id + ' exists ?  ' + JSON.stringify(value) + ' in obj: ' + args.id);

                    if (!value || value.val === undefined || value.val === null) {
                        adapter.log.debug('[set initial] ' + args.trueId + ' replace with 0 -> ' + args.id);

                        if (args.type === 'avg') {
                            if (args.name === 'dayCount') {
                                adapter.getForeignState(args.trueId, (er, value) => {
                                    if (value && value.val !== null) {
                                        adapter.setState(args.id, 1, true, callback);
                                    } else {
                                        callback();
                                    }
                                });
                            } else {
                                adapter.getForeignState(args.trueId, (er, value) => { // aktuelle Wert holen
                                    if (value && value.val !== null) {
                                        adapter.log.debug('[set initial] ' + args.trueId + ' object ' + args.trueId + ' ' + args.name);
                                        adapter.log.debug('[set initial] ' + args.trueId + ' act value ' + value.val);
                                        adapter.setState(args.id, value.val, true, callback);
                                    } else {
                                        callback();
                                    }
                                });
                            }
                        } else {
                            if (args.name === 'last01') {
                                adapter.getForeignState(args.trueId, (err, state) => { //aktuelle Wert holen
                                    adapter.log.debug('[set initial] ' + args.trueId + ' object ' + args.trueId + ' ' + args.name);
                                    adapter.log.debug('[set initial] ' + args.trueId + ' act value ' + state.val + ' time ' + state.lc);
                                    if (isFalse(state.val)) {
                                        adapter.log.debug('[set initial] ' + args.trueId + ' state is false und last 01 now as lastChange');
                                        adapter.setState(args.id, Date.now(), true, callback);
                                    } else
                                    if (isTrue(state.val)) {
                                        adapter.log.debug('[set initial] ' + args.trueId + ' state is false und last 01  get old time');
                                        adapter.setState(args.id, state.lc, true, callback);
                                    } else {
                                        adapter.log.error('[set initial] ' + args.trueId + ' unknown state to be evaluated in timeCount');
                                        callback();
                                    }
                                });
                            } else
                            if (args.name === 'last10') {
                                adapter.getForeignState(args.trueId, (err, state) => { //aktuelle Wert holen
                                    adapter.log.debug('[set initial] ' + args.trueId + ' objects ' + args.trueId + ' ' + args.name);
                                    adapter.log.debug('[set initial] ' + args.trueId + ' act value ' + state.val + ' time ' + state.lc);
                                    if (isFasle(state.val)) {
                                        adapter.setState(args.id, state.lc, true, callback);
                                        adapter.log.debug('[set initial] ' + args.trueId + ' state is false and last 10 get old time');
                                    } else
                                    if (isTrue(state.val)) {
                                        adapter.setState(args.id, Date.now(), true, callback);
                                        adapter.log.debug('[set initial] ' + args.trueId + ' state is true and last 10 get now as lastChange');
                                    } else {
                                        adapter.log.error('[set initial] ' + args.trueId + ' unknown state to be evaluated in timeCount');
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
    adapter.log.info('statistics setting up object = ' + type + '  ' + id);
    const isStart = !tasks.length;
    // übergeordnete Struktur anlegen
    tasks.push({
        name: 'setObjectNotExists',
        id: adapter.namespace + '.save.' + type + '.' + id,
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
        id: adapter.namespace + '.temp.' + type + '.' + id,
        obj: {
            type: 'channel',
            common: {
                name: 'Temporary value for ' + name,
                role: 'sensor',
                expert: true
            },
            native: {
                addr: id
            }
        }
    });

    // wie bekommt man die Unit aus der Konfig für sumCount hinein?
    // wie bekommt man die Unit aus der zu überwachenden Größe hinein?

    // states for the saved values
    const nameObjectType = nameObjects[type];
    let objects = nameObjectType.save;
    for (let s = 0; s < objects.length; s++) {
        if (!stateObjects[objects[s]]) {
            adapter.log.error('State ' + objects[s] + ' unknown');
            continue;
        }
        const obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
        if (!obj) {
            adapter.log.error('Unknown state: ' + objects[s]);
            continue;
        }
        adapter.log.debug(type + ' obj save creation  ' + objects[s] + ' for ' + id + ' structure ' + JSON.stringify(obj));
        obj.native.addr = id;
        if (unit && objects[s] !== 'dayCount') {
            obj.common.unit = unit;
        } {

        }
        tasks.push({
            name: 'setObjectNotExists',
            id: adapter.namespace + '.save.' + type + '.' + id + '.' + objects[s],
            obj
        });
    }

    // states for the temporary values
    objects = nameObjectType.temp;

    for (let s = 0; s < objects.length; s++) {
        if (!stateObjects[objects[s]]) {
            adapter.log.error('State ' + objects[s] + ' unknown');
            continue;
        }
        const obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
        if (!obj) {
            adapter.log.error('Unknown state: ' + objects[s]);
            continue;
        }
        adapter.log.debug(type + ' obj temp creation  ' + objects[s] + ' for ' + id + ' structure ' + JSON.stringify(obj));
        obj.native.addr = id;
        obj.common.expert = true;
        if (unit && objects[s] !== 'dayCount') {
            obj.common.unit = unit;
        } else if (obj.common.unit !== undefined) {
            delete obj.common.unit;
        }
        tasks.push({
            name: 'setObjectNotExists',
            id: adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[s],
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
        obj.groupFactor = parseInt(adapter.config.groupFactor, 10) || 1;
    } else {
        obj.groupFactor = parseInt(obj.groupFactor, 10) || 1;
    }

    if (!obj.impUnitPerImpulse && obj.impUnitPerImpulse !== '0' && obj.impUnitPerImpulse !== 0) {
        obj.impUnitPerImpulse = parseInt(adapter.config.impUnitPerImpulse, 10) || 1;
    } else {
        obj.impUnitPerImpulse = parseInt(obj.impUnitPerImpulse, 10) || 1;
    }

    // merge der Kosten in den Datensatz
    if (obj.sumGroup && ((obj.count && obj.sumCount) || obj.sumDelta)) {
        groups[obj.sumGroup] = groups[obj.sumGroup] || {config: adapter.config.groups.find(g => g.id === obj.sumGroup), items: []};
        if (groups[obj.sumGroup].items.indexOf(id) === -1) {
            groups[obj.sumGroup].items.push(id);
        }
    }

    // Funktion wird mit den custom objekten aufgerufen
    adapter.log.debug('setup of object ' + id + ' obj ' + JSON.stringify(obj));
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
            id: adapter.namespace + '.save.avg', 
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
    // 5minuten Werte Lassen sich nur ermitteln, wenn auch gezählt wird
    adapter.log.debug('fiveMin = ' + obj.fiveMin + ',  count =  ' + obj.count);
    
    if (obj.fiveMin && obj.count) {
        if (!typeObjects.fiveMin || typeObjects.fiveMin.indexOf(id) === -1) {
            typeObjects.fiveMin = typeObjects.fiveMin || [];
            typeObjects.fiveMin.push(id);
        }
        defineObject('fiveMin', id, logName); //type, id, name
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: adapter.namespace + '.save.fiveMin',
            obj:{
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
            id: adapter.namespace + '.save.timeCount', 
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
            id: adapter.namespace + '.save.count', 
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
    
    // Umrechnung Impulse in Verbrauch ist nur sinnvoll wenn Impulse vorhanden
    if (obj.sumCount && obj.count) {
        if (!typeObjects.sumCount || typeObjects.sumCount.indexOf(id) === -1) {
            typeObjects.sumCount = typeObjects.sumCount || [];
            typeObjects.sumCount.push(id);
        }
        defineObject('sumCount', id, logName, obj.unit); //type, id, name, Unit
        tasks.push({
            name: 'setObjectNotExists',
            subscribe: !subscribed && id,
            id: adapter.namespace + '.save.sumCount',
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
            id: adapter.namespace + '.save.sumDelta', 
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
    // sumGroup macht nur sinn wenn es auch die deltawerte gibt
    if (obj.sumGroup && (obj.sumDelta || (obj.sumCount && obj.count))) {
        // sumgroupname für Objekterstellung übermitteln
        if (groups[obj.sumGroup] && groups[obj.sumGroup].config) {
            if (!typeObjects.sumGroup || typeObjects.sumGroup.indexOf(obj.sumGroup) === -1) {
                typeObjects.sumGroup = typeObjects.sumGroup || [];
                typeObjects.sumGroup.push(obj.sumGroup);
            }

            defineObject('sumGroup', obj.sumGroup, 'Sum for ' + obj.sumGroup); //type, id ist der gruppenname, name
            tasks.push({
                name: 'setObjectNotExists',
                id: adapter.namespace + '.save.sumGroup',
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
            adapter.log.config('No group config found for ' + obj.sumGroup);
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
        if (task.obj.native.addr &&
            task.obj.type === 'state' &&
            units[task.obj.native.addr] === undefined &&
            nameObjects.timeCount.temp.indexOf(attr) === -1 &&
            !task.id.match(/\.dayCount$/) &&
            !task.id.startsWith(adapter.namespace + '.save.sumGroup.') &&
            !task.id.startsWith(adapter.namespace + '.temp.sumGroup.')) {
            adapter.getForeignObject(task.obj.native.addr, (err, obj) => {
                if (obj && obj.common.unit) {
                    task.obj.common.unit = obj.common.unit;
                    units[task.obj.native.addr] = obj.common.unit;
                } else {
                    units[task.obj.native.addr] = '';
                }

                adapter.setObjectNotExists(task.id, task.obj, err => {
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
            if (task.obj.native.addr && !task.id.match(/\.dayCount$/)) {
                if (units[task.obj.native.addr] !== undefined) {
                    if (units[task.obj.native.addr]) {
                        task.obj.common.unit = units[task.obj.native.addr];
                    }
                } else
                if (task.id.startsWith(adapter.namespace + '.save.sumGroup.') || task.id.startsWith(adapter.namespace + '.temp.sumGroup.')) {
                    task.obj.common.unit = groups[task.obj.native.addr] && groups[task.obj.native.addr].config && groups[task.obj.native.addr].config.priceUnit ? groups[task.obj.native.addr].config.priceUnit.split('/')[0] : '€';
                }
            }

            adapter.setObjectNotExists(task.id, task.obj, err => {
                if (task.subscribe) {
                    adapter.subscribeForeignStates(task.subscribe, () => {
                        setImmediate(processTasks);
                    });
                } else {
                    setImmediate(processTasks);
                }
            });
        }
    } else if (task.name === 'async') {
        if (typeof task.callback === 'function') {
            task.callback(task.args, () => {
                setImmediate(processTasks);
            });
        } else {
            adapter.log.error('error');
        }
    } else if (task.name === 'setForeignState') {
        adapter.setForeignState(task.id, task.val, true, err => {
            setImmediate(processTasks);
        });
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
            adapter.log.debug(padding(type, 15) + '      status = ' + crons[type].running + ' next event: ' + timeConverter(crons[type].nextDates()));
        }
    }
}

function main() {
    // typeObjects wird nach start des adapters neu aufgebaut
    // beim löschen von Datenpunkten während der Laufzeit ist in den beiden arrays zu bereinigen

    // Einlesen der Einstellung (hier kommen auch andere Einstellung mit!)
    adapter.objects.getObjectView('custom', 'state', {}, (err, doc) => {
        let objCount = 0;
        if (doc && doc.rows) {
            for (let i = 0, l = doc.rows.length; i < l; i++) {
                if (doc.rows[i].value) {
                    const id = doc.rows[i].id;
                    const custom = doc.rows[i].value;
                    if (!custom || !custom[adapter.namespace] || !custom[adapter.namespace].enabled) continue;
                    statDP[id] = custom[adapter.namespace]; //pauschale Übernahme aller Antworten
                    
                    objCount++;
                    adapter.log.info('enabled statistics for ' + id);
                }
            }
            const keys = Object.keys(statDP);
            
            setupObjects(keys, () => {
                adapter.log.info('statistics observes ' + objCount + ' values after startup');
                adapter.log.debug('saved typeObjects startup' + JSON.stringify(typeObjects));
            });
        }
    });

    // cron-jobs setzen

    const timezone = adapter.config.timezone || 'Europe/Berlin';

    // alle 5min
    crons.avg5min = new CronJob('*/5 * * * *',
        () => fiveMin(),
        () => adapter.log.debug('stopped 5min'), // This function is executed when the job stops
        true,
        timezone
    );

    // Speicher der Zeiträume, 2Minuten vor dem Reset
    // Hourly at 58 min
    crons.fifteenMinSave = new CronJob('0,15,30,45 * * * *',
        () => saveValues('15Min'),
        () => adapter.log.debug('stopped daySave'), // This function is executed when the job stops
        true,
        timezone
    );

    // Speicher der Zeiträume, 2Minuten vor dem Reset
    // Hourly at 60 min
    crons.hourSave = new CronJob('0 * * * *',
        () => saveValues('hour'),
        () => adapter.log.debug('stopped daySave'), // This function is executed when the job stops
        true,
        timezone
    );

    // Speicher der Zeiträume, 2Minuten vor dem Reset
    // Täglich um 24:00
    crons.daySave = new CronJob('0 0 * * *',
        () => saveValues('day'), 
        () => adapter.log.debug('stopped daySave'), // This function is executed when the job stops
        true,
        timezone
    );

    // Sonntag 24:00
    crons.weekSave = new CronJob('0 0 * * 1',
        () => saveValues('week'),
        () => adapter.log.debug('stopped week'), // This function is executed when the job stops
        true,
        timezone
    );

    // Monatsletzte um 23:58 Uhr ausführen
    // Springt die Routine immer an und dort wird ermittelt ob Morgen der 1. ist
    crons.monthSave = new CronJob('0 24 1 * *',
        () => saveValues('month'),
        () => adapter.log.debug('stopped month'), // This function is executed when the job stops
        true,
        timezone
    );

    // Quartalsletzen (März,Juni,September,Dezember) um 23:58 Uhr ausführen
    crons.quarterSave1 = new CronJob('0 0 1 0,3,6,9 *',
        () => saveValues('quarter'),
        () => adapter.log.debug('stopped quarter'), // This function is executed when the job stops
        true,
        timezone
    );

    // Silvester um 24:00 Uhr ausführen
    crons.yearSave = new CronJob('0 0 1 0 *',
        () => saveValues('year'), //Monate ist Wertebereich 0-11
        () => adapter.log.debug('stopped yearSave'),
        true,
        timezone
    );

    // subscribe to objects, so the settings in the object are arriving to the adapter
    adapter.subscribeForeignObjects('*');

    getCronStat();
}
