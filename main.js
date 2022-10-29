'use strict';

const utils = require('@iobroker/adapter-core');
const CronJob = require('cron').CronJob;
const stateObjects = require('./lib/objects');

const PRECISION = 5;

// Which objects should be created (see lib/objects.js)
const nameObjects = {
    count: {
        // Count impulses or counting operations
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'last5Min', 'lastPulse']
    },
    sumCount: {
        // Addition of analogue values (consumption from pulses) Multiplication with price = costs
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'lastPulse']
    },
    sumDelta: {
        // Consumption from continuous quantities () Multiplication with price = costs
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'delta', 'last'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    },
    sumGroup: {
        // Total consumption from consecutive quantities
        save: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
        temp: ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    },
    minmax: {
        // Min/Max timeframe
        save: ['dayMin', 'weekMin', 'monthMin', 'quarterMin', 'yearMin', 'dayMax', 'weekMax', 'monthMax', 'quarterMax', 'yearMax', 'absMin', 'absMax'],
        temp: ['dayMin', 'weekMin', 'monthMin', 'quarterMin', 'yearMin', 'dayMax', 'weekMax', 'monthMax', 'quarterMax', 'yearMax', 'last']
    },
    avg: {
        // Mean values etc.
        save: ['dayMin', 'dayMax', 'dayAvg'],
        temp: ['dayMin', 'dayMax', 'dayAvg', 'dayCount', 'daySum', 'last']
    },
    timeCount: {
        // Operating time counting from status change
        save: ['onDay', 'onWeek', 'onMonth', 'onQuarter', 'onYear', 'offDay', 'offWeek', 'offMonth', 'offQuarter', 'offYear'],
        temp: ['onDay', 'onWeek', 'onMonth', 'onQuarter', 'onYear', 'offDay', 'offWeek', 'offMonth', 'offQuarter', 'offYear', 'last01', 'last10', 'last']
    },
    fiveMin: {
        // 5 minutes, etc. only useful with impulses
        save: ['mean5Min', 'dayMax5Min', 'dayMin5Min'],
        temp: ['mean5Min', 'dayMax5Min', 'dayMin5Min']
    }
};

const column = ['15Min', 'hour', 'day', 'week', 'month', 'quarter', 'year'];
const copyToSave = ['count', 'sumCount', 'sumGroup', 'sumDelta'];

function isTrue(val) {
    return val === 1 || val === '1' || val === true || val === 'true' || val === 'on' || val === 'ON';
}

function isFalse(val) {
    return val === 0 || val === '0' || val === false || val === 'false' || val === 'off' || val === 'OFF' || val === 'standby';
}

function roundValue(value, precision = 0) {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
}

function timeConverter(timestamp) {
    const a = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours();
    const min = a.getMinutes();
    const sec = a.getSeconds();

    return `${date < 10 ? ' ' + date : date} ${month} ${year} ${hour < 10 ? '0' + hour : hour}:${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
}

class Statistics extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'statistics'
        });

        this.tasks = [];
        this.taskCallback = null;
        this.tasksFinishedCallbacks = [];

        this.crons = {};

        this.groups = {};
        this.states = {}; // hold all states locally
        this.units = {};

        // to remember the used objects within the types (calculations)
        this.typeObjects = {
            sumDelta: [],
            sumGroup: [],
            avg: [],
            minmax: [],
            count: [],
            sumCount: [],
            timeCount: [],
            fiveMin: [],
        };
        this.statDP = {};      // contains all custom object definitions (with Object-ID as key)

        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        // typeObjects is rebuilt after starting the adapter
        // deleting data points during runtime must be cleaned up in both arrays
        // reading the setting (here come with other setting!)
        this.getObjectView('system', 'custom', {}, (err, doc) => {
            let objCount = 0;
            if (doc && doc.rows) {
                for (let i = 0, l = doc.rows.length; i < l; i++) {
                    if (doc.rows[i].value) {
                        const id = doc.rows[i].id;
                        const custom = doc.rows[i].value;
                        if (!custom || !custom[this.namespace] || !custom[this.namespace].enabled) continue;
                        this.statDP[id] = custom[this.namespace]; // all-inclusive assumption of all answers
                        objCount++;
                        this.log.info(`[SETUP] enabled statistics for ${id}`);
                    }
                }

                const keys = Object.keys(this.statDP);
                this.setupObjects(keys, () => {
                    this.log.info(`[SETUP] statistics observes ${objCount} values after startup`);

                    // create cron-jobs
                    const timezone = this.config.timezone || 'Europe/Berlin';

                    // every 5min
                    try {
                        this.crons.avg5min = new CronJob('*/5 * * * *',
                            () => this.fiveMin(),
                            () => this.log.debug('stopped avg5min'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron avg5min errored with: ${e}`);
                    }

                    // Every 15 minutes
                    try {
                        this.crons.fifteenMinSave = new CronJob('0,15,30,45 * * * *',
                            () => this.saveValues('15Min'),
                            () => this.log.debug('stopped fifteenMinSave'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron fifteenMinSave errored with: ${e}`);
                    }

                    // Hourly at 00 min
                    try {
                        this.crons.hourSave = new CronJob('0 * * * *',
                            () => this.saveValues('hour'),
                            () => this.log.debug('stopped hourSave'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron hourSave errored with: ${e}`);
                    }

                    // daily um 23:59:58
                    try {
                        this.crons.dayTriggerTimeCount = new CronJob('58 59 23 * * *',
                            () => this.setTimeCountMidnight(),
                            () => this.log.debug('stopped dayTriggerTimeCount'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron dayTriggerTimeCount errored with: ${e}`);
                    }

                    // daily um 00:00
                    try {
                        this.crons.daySave = new CronJob('0 0 * * *',
                            () => this.saveValues('day'),
                            () => this.log.debug('stopped daySave'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron daySave errored with: ${e}`);
                    }

                    // Monday 00:00
                    try {
                        this.crons.weekSave = new CronJob('0 0 * * 1',
                            () => this.saveValues('week'),
                            () => this.log.debug('stopped weekSave'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron weekSave errored with: ${e}`);
                    }

                    // Monthly at 1 of every month at 00:00
                    try {
                        this.crons.monthSave = new CronJob('0 0 1 * *',
                            () => this.saveValues('month'),
                            () => this.log.debug('stopped monthSave'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron monthSave errored with: ${e}`);
                    }

                    // Quarter
                    try {
                        this.crons.quarterSave = new CronJob('0 0 1 0,3,6,9 *',
                            () => this.saveValues('quarter'),
                            () => this.log.debug('stopped quarterSave'), // This function is executed when the job stops
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron quarterSave errored with: ${e}`);
                    }

                    // New year
                    try {
                        this.crons.yearSave = new CronJob('0 0 1 0 *',
                            () => this.saveValues('year'), // Months is value range 0-11
                            () => this.log.debug('stopped yearSave'),
                            true,
                            timezone
                        );
                    } catch (e) {
                        this.log.error(`creating cron yearSave errored with: ${e}`);
                    }

                    // subscribe to objects, so the settings in the object are arriving to the adapter
                    this.subscribeForeignObjects('*');

                    for (const type in this.crons) {
                        if (Object.prototype.hasOwnProperty.call(this.crons, type) && this.crons[type]) {
                            this.log.debug(`[SETUP] ${type} status = ${this.crons[type].running} next event: ${timeConverter(this.crons[type].nextDates())}`);
                        }
                    }
                });
            }
        });
    }

    /**
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        // Warning, obj can be null if it was deleted
        // this.log.debug('received objectChange '+ id + ' obj  '+JSON.stringify(obj));
        // nur das verarbeiten was auch diesen Adapter interessiert
        if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace] && obj.common.custom[this.namespace].enabled) {
            //hier sollte nur ein Datenpunkt angekommen sein
            this.log.debug(`[OBJECT CHANGE] stat "${id}" ${JSON.stringify(obj.common.custom)}`);

            // old but changed
            if (this.statDP[id]) {
                this.statDP[id] = obj.common.custom[this.namespace];
                this.removeObject(id);
                this.setupObjects([id]);
                this.log.debug(`[OBJECT CHANGE] saved (updated) typeObject: ${JSON.stringify(this.statDP[id])}`);
            } else {
                this.statDP[id] = obj.common.custom[this.namespace];
                this.setupObjects([id]);
                this.log.info('enabled logging of ' + id);
                this.log.debug(`[OBJECT CHANGE] saved (new) typeObjects: ${JSON.stringify(this.statDP[id])}`);
            }
        } else if (this.statDP[id]) {
            this.log.debug(`[OBJECT CHANGE] removing typeObjects: ${JSON.stringify(this.statDP[id])}`);

            // Delete objects of all types
            Object.keys(this.typeObjects).forEach(type => {
                this.delObject(`save.${type}.${id}`, { recursive: true });
                this.delObject(`temp.${type}.${id}`, { recursive: true });
            });

            delete this.statDP[id];
            this.removeObject(id);
            this.unsubscribeForeignObjects(id);
            this.unsubscribeForeignStates(id);
        }
    }

    /**
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (id && state && state.ack) {
            this.log.debug(`[STATE CHANGE] ======================= ${id} =======================`);
            this.log.debug(`[STATE CHANGE] stateChange => ${state.val}`);

            if ((state.val === null) || (state.val === undefined) || isNaN(state.val)) {
                this.log.warn(`[STATE CHANGE] wrong value => ${state.val} on ${id} => check the other adapter where value comes from `);
            } else {
                if (this.typeObjects.sumDelta.includes(id)) {
                    this.log.debug(`[STATE CHANGE] starting onStateChangeSumDeltaValue for ${id}`);
                    this.onStateChangeSumDeltaValue(id, state.val);
                } else if (this.typeObjects.avg.includes(id)) {
                    this.log.debug(`[STATE CHANGE] starting onStateChangeAvgValue for ${id}`);
                    this.onStateChangeAvgValue(id, state.val);
                }

                if (this.typeObjects.minmax.includes(id)) {
                    this.log.debug(`[STATE CHANGE] starting onStateChangeMinMaxValue for ${id}`);
                    this.onStateChangeMinMaxValue(id, state.val);
                }

                if (this.typeObjects.count.includes(id)) {
                    this.log.debug(`[STATE CHANGE] starting onStateChangeCountValue for ${id}`);
                    this.onStateChangeCountValue(id, state.val);
                }

                if (this.typeObjects.sumCount.includes(id)) {
                    this.log.debug(`[STATE CHANGE] starting onStateChangeSumCountValue for ${id}`);
                    this.onStateChangeSumCountValue(id, state.val);
                }

                if (this.typeObjects.timeCount.includes(id)) {
                    this.log.debug(`[STATE CHANGE] starting onStateChangeTimeCntValue for ${id}`);
                    this.onStateChangeTimeCntValue(id, state);
                }

                // 5min is treated cyclically
            }
        }
    }

    /**
     * @param {ioBroker.Message} msg
     */
    onMessage(msg) {
        this.log.debug(`[onMessage] Received ${JSON.stringify(msg)}`);

        if (msg.command === 'groups' && msg.callback) {
            this.sendTo(msg.from, msg.command, (this.config.groups || []).map(item => ({ label: item.name, value: item.id })), msg.callback);
        } else if (msg.command === 'enableStatistics') {
            if (typeof msg.message === 'object' && msg.message?.id) {
                const objId = msg.message.id;

                this.getForeignObject(objId, (err, obj) => {
                    if (err || !obj) {
                        this.sendTo(msg.from, msg.command, {
                            success: false,
                            err: `Unable to get object with ID ${objId}`
                        }, msg.callback);
                    } else {
                        if (obj?.type === 'state') {

                            const objCustomOptions = {
                                common: {
                                    custom: {}
                                }
                            };

                            const objCustomDefaults = {
                                enabled: true,

                                // for boolean states
                                count: false,
                                fiveMin: false, // requires .count = true
                                sumCount: false,
                                impUnitPerImpulse: 1, // requires .sumCount = true
                                impUnit: '', // requires .sumCount = true
                                timeCount: false,

                                // for number states
                                avg: false,
                                minmax: false,
                                sumDelta: false,
                                sumIgnoreMinus: false,

                                sumGroup: undefined, // requires .sumCount = true or .sumDelta = true
                                groupFactor: 1, // requres sumGroup

                                logName: String(obj._id).split('.').pop()
                            };

                            if (typeof msg.message === 'object' && typeof msg.message?.options === 'object') {
                                objCustomOptions.common.custom[this.namespace] = {
                                    ...objCustomDefaults,
                                    ...msg.message.options
                                };
                            } else {
                                objCustomOptions.common.custom[this.namespace] = {
                                    ...objCustomDefaults,
                                    count: obj.common.type === 'boolean',
                                    avg: obj.common.type === 'number'
                                };
                            }

                            this.log.debug(`Extending state ${JSON.stringify(obj)} with ${JSON.stringify(objCustomOptions)}`);
                            this.extendForeignObject(objId, objCustomOptions, (err) => {
                                if (err) {
                                    this.log.error(`enableStatistics of ${objId} failed: ${err}`);
                                    this.sendTo(msg.from, msg.command, {
                                        success: false,
                                        err: err
                                    }, msg.callback);
                                } else {
                                    this.sendTo(msg.from, msg.command, {
                                        success: true,
                                        err: null
                                    }, msg.callback);
                                }
                            });

                        } else {
                            this.sendTo(msg.from, msg.command, {
                                success: false,
                                err: `Object with ID ${objId} is not a state: ${obj?.type}`
                            }, msg.callback);
                        }
                    }
                });
            } else {
                this.sendTo(msg.from, msg.command, {
                    success: false,
                    err: `Configuration missing - please set at least { id: 'your.object.id' }`
                }, msg.callback);
            }
        }
    }

    /**
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // possibly also delete a few schedules
            for (const type in this.crons) {
                if (Object.prototype.hasOwnProperty.call(this.crons, type) && this.crons[type]) {
                    this.crons[type].stop();
                    this.crons[type] = null;
                }
            }

            this.log.info('cleaned everything up...');

            callback();
        } catch (e) {
            callback();
        }
    }

    isTrueNew(id, val, type) {
        // detection if a count value is real or only from polling with same state
        let newPulse = false;
        this.getValue(`temp.${type}.${id}.lastPulse`, (err, value) => {
            this.setValue(`temp.${type}.${id}.lastPulse`, val);
            if (value === val) {
                newPulse = false;
                this.log.debug(`new pulse false ? ${newPulse}`);
            } else {
                newPulse = isTrue(val);
                this.log.debug(`new pulse true ? ${newPulse}`);
            }
        });
        return newPulse;
    }

    getValue(id, callback) {
        if (Object.prototype.hasOwnProperty.call(this.states, id)) {
            callback(null, this.states[id]);
        } else {
            this.getState(id, (err, state) => {
                this.states[id] = state ? state.val : null;

                callback(err, this.states[id], state && state.ts);
            });
        }
    }

    async getValueAsync(id) {
        return new Promise((resolve, reject) => {
            if (Object.prototype.hasOwnProperty.call(this.states, id)) {
                resolve(this.states[id]);
            } else {
                this.getState(id, (err, state) => {
                    if (err) {
                        reject(err);
                    }

                    this.states[id] = state ? state.val : null;

                    resolve(this.states[id]);
                });
            }
        });
    }

    setValue(id, value, callback) {
        this.states[id] = value;
        this.setState(id, { val: value, ack: true }, callback);
    }

    async setValueAsync(id, value) {
        this.states[id] = value;
        return this.setStateAsync(id, { val: value, ack: true });
    }

    setValueStat(id, value, callback) {
        const ts = new Date();
        ts.setMinutes(ts.getMinutes() - 1);
        ts.setSeconds(59);
        ts.setMilliseconds(0);

        this.states[id] = value;
        this.setState(id, { val: value, ts: ts.getTime(), ack: true }, callback);
    }

    checkValue(value, ts, id, type) {
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);

        if (type === '15Min') {
            // value may not be older than 15 min
            now.setMinutes(now.getMinutes() - now.getMinutes() % 15);
        } else if (type === 'hour') {
            // value may not be older than full hour
            now.setMinutes(0);
        } else if (type === 'day') {
            // value may not be older than 00:00 of today
            now.setMinutes(0);
            now.setHours(0);
        } else if (type === 'week') {
            // value may not be older than 00:00 of today
            now.setMinutes(0);
            now.setHours(0);
        } else if (type === 'month') {
            // value may not be older than 00:00 of today
            now.setMinutes(0);
            now.setHours(0);
            now.setDate(1);
        } else if (type === 'quarter') {
            // value may not be older than 00:00 of today
            now.setMinutes(0);
            now.setHours(0);
            now.setDate(1);
            // 0, 3, 6, 9
            now.setMonth(now.getMonth() - now.getMonth() % 3);
        } else if (type === 'year') {
            // value may not be older than 1 Januar of today
            now.setMinutes(0);
            now.setHours(0);
            now.setDate(1);
            now.setMonth(0);
        } else {
            this.log.error('Unknown calc type: ' + type);
            return value;
        }

        if (ts < now.getTime()) {
            this.log.warn(`[STATE CHANGE] Value of ${id} ignored because older than ${now.toISOString()}`);
            value = 0;
        }

        return value;
    }

    // normales Umspeichern, temp wird auf 0 gesetzt!!
    copyValue(args, callback) {
        this.getValue(args.temp, (err, value) => {
            if (value !== null && value !== undefined) {
                this.log.debug('[SAVE VALUES] Process ' + args.temp + ' = ' + value);
                value = value || 0; // protect against NaN
                this.setValueStat(args.save, value, () => this.setValue(args.temp, 0, callback));
            } else {
                this.log.debug('[SAVE VALUES] Process ' + args.temp + ' => no value found');
                callback && callback();
            }
        });
    }

    // Setzen der Ausgangspunkte für Min/Max mit aktuelle Wert, anstatt mit 0
    copyValueActMinMax(args, callback) {
        this.getValue(args.temp, (err, value) => {
            if (value !== null && value !== undefined) {
                this.log.debug(`[SAVE VALUES] Process ${args.temp} = ${value} to ${args.save}`);
                value = value || 0; // protect against NaN
                this.setValueStat(args.save, value, () =>
                    this.getValue(args.actual, (err, actual) => {
                        this.log.debug(`[SET DAILY START MINMAX] Process ${args.temp} = ${actual} from ${args.actual}`);
                        this.setValue(args.temp, actual, callback);
                    })
                );
            } else {
                this.log.debug(`[SAVE VALUES & SET DAILY START MINMAX] Process ${args.temp} => no value found`);
                callback && callback();
            }
        });
    }

    // für gruppenwerte
    copyValueRound(args, callback) {
        this.getValue(args.temp, (err, value) => {
            if (value !== null && value !== undefined) {
                this.log.debug(`[SAVE VALUES] Process ${args.temp} = ${value} to ${args.save}`);
                this.setValueStat(args.save, roundValue(value, PRECISION), () => this.setValue(args.temp, 0, callback));
            } else {
                this.log.debug(`[SAVE VALUES] Process ${args.temp} => no value found`);
                callback && callback();
            }
        });
    }

    // avg Werte umspeichern und auf 0 setzen
    copyValue0(args, callback) {
        this.getValue(args.temp, (err, value) => {
            value = value || 0;
            this.log.debug(`[SAVE VALUES] Process ${args.temp} = ${value} to ${args.save}`);
            this.setValueStat(args.save, value, () => this.setValue(args.temp, 0, callback));
        });
    }

    // Betriebszeitzählung umspeichern und temp Werte auf 0 setzen
    copyValue1000(args, callback) {
        this.getValue(args.temp, (err, value) => {
            //value = Math.floor((value || 0) / 1000);
            this.log.debug(`[SAVE VALUES] Process ${args.temp} = ${value} to ${args.save}`);
            this.setValueStat(args.save, value, () => this.setValue(args.temp, 0, callback));
        });
    }

    setTimeCountMidnight() {
        if (this.typeObjects.timeCount) {
            for (let s = 0; s < this.typeObjects.timeCount.length; s++) {
                const id = this.typeObjects.timeCount[s];
                // bevor umgespeichert wird, muß noch ein Aufruf mit actual erfolgen, damit die restliche Zeit vom letzten Signalwechsel bis Mitternacht erfolgt
                // aufruf von newTimeCntValue(id, "last") damit wird gleicher Zustand getriggert und last01 oder last10 zu Mitternacht neu gesetzt
                this.getState(`temp.timeCount.${id}.last`, (err, last) => { //hier muss nur id stehen, dann aber noch Beachtung des Timestamps
                    //evtl. status ermitteln und dann setForeignState nochmals den Zustand schreiben um anzutriggern und aktuelle Zeit zu verwenden (bzw. 00:00:00)
                    const ts = new Date();
                    //ts.setMinutes(ts.getMinutes() - 1);
                    //ts.setSeconds(59);
                    //ts.setMilliseconds(0);
                    if (last) {
                        last.ts = ts.getTime();
                        this.onStateChangeTimeCntValue(id, last);
                    }
                });
            }
        }
    }

    setupObjects(ids, callback) {
        const isStart = !this.tasks.length;

        if (!ids || !ids.length) {
            if (isStart) {
                this.taskCallback = callback;
                return this.processTasks();
            } else {
                return callback && callback();
            }
        }

        const id = ids.shift();
        const obj = this.statDP[id];
        if (!obj) {
            return setImmediate(this.setupObjects.bind(this), ids, callback);
        }

        if (obj.groupFactor && obj.groupFactor !== '0' && obj.groupFactor !== 0) {
            obj.groupFactor = parseFloat(obj.groupFactor) || this.config.impFactor;
        } else {
            obj.groupFactor = this.config.impFactor;
        }

        if (obj.impUnitPerImpulse && obj.impUnitPerImpulse !== '0' && obj.impUnitPerImpulse !== 0) {
            obj.impUnitPerImpulse = parseFloat(obj.impUnitPerImpulse) || this.config.impUnitPerImpulse;
        } else {
            this.log.debug(`[CREATION] avg: ${id}`);
            obj.impUnitPerImpulse = this.config.impUnitPerImpulse;
        }

        // merge der Kosten in den Datensatz
        if (obj.sumGroup && (obj.count || obj.sumCount || obj.sumDelta)) {
            this.groups[obj.sumGroup] = this.groups[obj.sumGroup] || { config: this.config.groups.find(g => g.id === obj.sumGroup), items: [] };
            if (!this.groups[obj.sumGroup].items.includes(id)) {
                this.groups[obj.sumGroup].items.push(id);
            }
        }

        // function is called with the custom objects
        this.log.debug(`[CREATION] ============================== ${id} =============================`);
        this.log.debug(`[CREATION] setup of object ${id}: ${JSON.stringify(obj)}`);
        const logName = obj.logName;

        // avg
        if (obj.avg) {
            this.log.debug(`[CREATION] avg: ${id}`);

            if (!this.typeObjects.avg.includes(id)) {
                this.typeObjects.avg.push(id);
            }

            this.defineObject('avg', id, logName); // type, id, name
        }

        // minMax
        if (obj.minmax) {
            this.log.debug(`[CREATION] minmax: ${id}`);

            if (!this.typeObjects.minmax.includes(id)) {
                this.typeObjects.minmax.push(id);
            }

            this.defineObject('minmax', id, logName); // type, id, name
        }

        // 5minutes Values can only be determined when counting
        if (obj.fiveMin && obj.count) {
            this.log.debug(`[CREATION] fiveMin: ${id}`);

            if (!this.typeObjects.fiveMin.includes(id)) {
                this.typeObjects.fiveMin.push(id);
            }

            this.defineObject('fiveMin', id, logName); // type, id, name
        }

        // timeCount
        if (obj.timeCount) {
            this.log.debug(`[CREATION] timeCount: ${id}`);

            if (!this.typeObjects.timeCount.includes(id)) {
                this.typeObjects.timeCount.push(id);
            }

            this.defineObject('timeCount', id, logName); // type, id, name
        }

        // count
        if (obj.count) {
            this.log.debug(`[CREATION] count: ${id}`);

            if (!this.typeObjects.count.includes(id)) {
                this.typeObjects.count.push(id);
            }

            this.defineObject('count', id, logName); // type, id, name
        }

        // sumCount
        if (obj.sumCount) {
            this.log.debug(`[CREATION] sumCount: ${id}`);

            if (!this.typeObjects.sumCount.includes(id)) {
                this.typeObjects.sumCount.push(id);
            }

            this.defineObject('sumCount', id, logName, obj.impUnit); // type, id, name, Unit
        }

        // sumDelta
        if (obj.sumDelta) {
            this.log.debug(`[CREATION] sumDelta: ${id}`);

            if (!this.typeObjects.sumDelta.includes(id)) {
                this.typeObjects.sumDelta.push(id);
            }

            this.defineObject('sumDelta', id, logName); // type, id, name
        }

        // sumGroup
        if (obj.sumGroup && (obj.sumDelta || (obj.sumCount))) {
            this.log.debug(`[CREATION] sumGroup: ${id}`);

            // submit sumgroupname for object creation
            if (this.groups[obj.sumGroup] && this.groups[obj.sumGroup].config) {
                if (!this.typeObjects.sumGroup.includes(obj.sumGroup)) {
                    this.typeObjects.sumGroup.push(obj.sumGroup);
                }

                this.defineObject('sumGroup', obj.sumGroup, `Sum for ${obj.sumGroup}`); // type, id ist der gruppenname, name
            } else {
                this.log.error(`[CREATION] No group config found for ${obj.sumGroup}`);
            }
        }

        this.subscribeForeignStates(id);

        setImmediate(this.setupObjects.bind(this), ids, callback);
    }

    removeObject(id) {
        Object.keys(this.typeObjects).forEach(type => {
            if (Array.isArray(this.typeObjects[type])) {
                this.typeObjects[type] = this.typeObjects[type].filter(typeId => typeId !== id);
            }
        });

        Object.keys(this.groups).forEach(g => {
            if (this.groups[g].items && Array.isArray(this.groups[g].items)) {
                this.groups[g].items = this.groups[g].items.filter(groupId => groupId !== id);
            } else {
                this.log.error(`Invalid structure of group "${g}": ${JSON.stringify(this.groups[g])}`);
            }
        });
    }

    saveValues(timePeriod) {
        const isStart = !this.tasks.length;
        const dayTypes = [];
        for (const key in this.typeObjects) {
            if (this.typeObjects[key].length && copyToSave.includes(key)) {
                dayTypes.push(key);
            }
        }
        const day = column.indexOf(timePeriod);  // nameObjects[day] contains the time-related object value
        // all values
        this.log.debug(`[SAVE VALUES] saving ${timePeriod} values`);

        // Schleife für alle Werte die durch day-variable bestimmt sind, gilt durch copyToSave für 'count', 'sumCount', 'sumGroup', 'sumDelta'
        // avg, timeCount /fivemin braucht extra Behandlung
        for (let t = 0; t < dayTypes.length; t++) {
            for (let s = 0; s < this.typeObjects[dayTypes[t]].length; s++) {
                // ignore last5min
                if (nameObjects[dayTypes[t]].temp[day] === 'last5Min') {
                    continue;
                }
                const id = this.typeObjects[dayTypes[t]][s];
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.${dayTypes[t]}.${id}.${nameObjects[dayTypes[t]].temp[day]}`,
                        save: `save.${dayTypes[t]}.${id}.${nameObjects[dayTypes[t]].temp[day]}`
                    },
                    callback: dayTypes[t] === 'sumGroup' ? this.copyValueRound.bind(this) : this.copyValue.bind(this)
                });
            }
        }

        // avg values sind nur Tageswerte, also nur bei 'day' auszuwerten
        // Setzen auf den aktuellen Wert fehlt noch irgendwie ? jetz copyValueActMinMAx
        if (timePeriod === 'day' && this.typeObjects.avg) {
            for (let s = 0; s < this.typeObjects.avg.length; s++) {
                const id = this.typeObjects.avg[s];
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.avg.${id}.dayMin`,
                        save: `save.avg.${id}.dayMin`,
                        actual: `temp.avg.${id}.last`,
                    },
                    callback: this.copyValueActMinMax.bind(this)
                });
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.avg.${id}.dayMax`,
                        save: `save.avg.${id}.dayMax`,
                        actual: `temp.avg.${id}.last`,
                    },
                    callback: this.copyValueActMinMax.bind(this)
                });
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.avg.${id}.dayAvg`,
                        save: `save.avg.${id}.dayAvg`,
                    },
                    callback: this.copyValue0.bind(this)
                });
                // just reset the counter
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.avg.${id}.dayCount`
                    },
                    callback: (args, callback) => this.setValueStat(args.temp, 0, callback)
                });
                // just reset the counter
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.avg.${id}.daySum`
                    },
                    callback: (args, callback) => this.setValueStat(args.temp, 0, callback)
                });
            }
        }

        // saving the daily fiveMin max/min
        // Setzen auf den aktuellen Wert fehlt noch irgendwie ?
        if (timePeriod === 'day' && this.typeObjects.fiveMin) {
            for (let s = 0; s < this.typeObjects.fiveMin.length; s++) {
                const id = this.typeObjects.fiveMin[s];
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.fiveMin.${id}.dayMin5Min`,
                        save: `save.fiveMin.${id}.dayMin5Min`
                    },
                    callback: this.copyValue.bind(this)
                });
                this.tasks.push({
                    name: 'async',
                    args: {
                        temp: `temp.fiveMin.${id}.dayMax5Min`,
                        save: `save.fiveMin.${id}.dayMax5Min`
                    },
                    callback: this.copyValue.bind(this)
                });
            }
        }

        // timeCount hat andere Objektbezeichnungen und deswegen kann day aus timeperiod nicht benutzt werden
        // day erst ab 2ter Stelle im Array (ohne 15min und hour soll benutzt werden) -> also (day > 1) und [day-2]
        if (day > 1) {
            if (this.typeObjects.timeCount) {
                for (let s = 0; s < this.typeObjects.timeCount.length; s++) {
                    const id = this.typeObjects.timeCount[s];
                    this.tasks.push({
                        name: 'async',
                        args: {
                            temp: 'temp.timeCount.' + id + '.' + nameObjects.timeCount.temp[day - 2], // 0 ist onDay
                            save: 'save.timeCount.' + id + '.' + nameObjects.timeCount.temp[day - 2],
                        },
                        callback: this.copyValue1000.bind(this)
                    });
                    this.tasks.push({
                        name: 'async',
                        args: {
                            temp: 'temp.timeCount.' + id + '.' + nameObjects.timeCount.temp[day + 3], // +5 ist offDay
                            save: 'save.timeCount.' + id + '.' + nameObjects.timeCount.temp[day + 3],
                        },
                        callback: this.copyValue1000.bind(this)
                    });
                }
            }
        }

        // minmax hat andere Objektbezeichnungen und deswegen kann day aus timeperiod nicht benutzt werden
        // day erst ab 2ter Stelle im Array (ohne 15min und hour soll benutzt werden) -> also (day > 1) und [day-2]
        if (day > 1) { //bezieht sich auf column array
            if (this.typeObjects.minmax) {
                for (let s = 0; s < this.typeObjects.minmax.length; s++) {
                    const id = this.typeObjects.minmax[s];
                    this.tasks.push({
                        name: 'async',
                        args: {
                            temp: 'temp.minmax.' + id + '.' + nameObjects.minmax.temp[day - 2], // 0 ist minDay
                            save: 'save.minmax.' + id + '.' + nameObjects.minmax.temp[day - 2],
                            actual: 'temp.minmax.' + id + '.last',
                        },
                        callback: this.copyValueActMinMax.bind(this)
                    });
                    this.tasks.push({
                        name: 'async',
                        args: {
                            temp: 'temp.minmax.' + id + '.' + nameObjects.minmax.temp[day + 3], // +5 ist maxDay
                            save: 'save.minmax.' + id + '.' + nameObjects.minmax.temp[day + 3],
                            actual: 'temp.minmax.' + id + '.last',
                        },
                        callback: this.copyValueActMinMax.bind(this)
                    });
                }
            }
        }
        isStart && this.processTasks();
    }

    defineObject(type, id, name, unit) {
        const isStart = !this.tasks.length;

        // Workaround for untranslated objects
        if (typeof name !== 'object') {
            name = {
                en: name
            };
        }

        // Create channels
        this.tasks.push({
            name: 'setObjectNotExists',
            id: `save.${type}.${id}`,
            obj: {
                type: 'channel',
                common: {
                    name: {
                        en: `Saved values for ${name.en}`,
                        de: `Gespeicherte Werte für ${name.de || name.en}`,
                        ru: `Сохраненные значения для ${name.ru || name.en}`,
                        pt: `Valores salvos para ${name.pt || name.en}`,
                        nl: `Bespaarde waarden voor ${name.nl || name.en}`,
                        fr: `Valeurs sauvegardées pour ${name.fr || name.en}`,
                        it: `Valori salvati per ${name.it || name.en}`,
                        es: `Valores guardados para ${name.es || name.en}`,
                        pl: `Oszczędne wartości dla ${name.pl || name.en}`,
                        'zh-cn': `保存的价值 ${name['zh-cn'] || name.en}`
                    }
                },
                native: {
                    addr: id
                }
            }
        });

        this.tasks.push({
            name: 'setObjectNotExists',
            id: `temp.${type}.${id}`,
            obj: {
                type: 'channel',
                common: {
                    name: {
                        en: `Temporary values for ${name.en}`,
                        de: `Vorläufige Werte für ${name.de || name.en}`,
                        ru: `Временные значения для ${name.ru || name.en}`,
                        pt: `Valores temporários para ${name.pt || name.en}`,
                        nl: `Tijdelijke waarden voor ${name.nl || name.en}`,
                        fr: `Valeurs temporaires pour ${name.fr || name.en}`,
                        it: `Valori temporanei per ${name.it || name.en}`,
                        es: `Valores temporales para ${name.es || name.en}`,
                        pl: `Temporary wartości dla ${name.pl || name.en}`,
                        'zh-cn': `${name['zh-cn'] || name.en} 的临时值`,
                    }
                },
                native: {
                    addr: id
                }
            }
        });

        // states for the saved values
        let objects = nameObjects[type].save;
        for (let s = 0; s < objects.length; s++) {
            if (!stateObjects[objects[s]]) {
                this.log.error(`[CREATION] State ${objects[s]} unknown`);
                continue;
            }
            const obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
            if (!obj) {
                this.log.error(`[CREATION] Unknown state: ${objects[s]}`);
                continue;
            }

            obj.native.addr = id;

            if (unit && objects[s] !== 'dayCount') {
                obj.common.unit = unit;
            }

            this.tasks.push({
                name: 'setObjectNotExists',
                id: `save.${type}.${id}.${objects[s]}`,
                obj
            });
        }

        // states for the temporary values
        objects = nameObjects[type].temp;
        for (let s = 0; s < objects.length; s++) {
            if (!stateObjects[objects[s]]) {
                this.log.error(`[CREATION] State ${objects[s]} unknown`);
                continue;
            }

            const obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
            if (!obj) {
                this.log.error(`[CREATION] Unknown state: ${objects[s]}`);
                continue;
            }

            obj.native.addr = id;
            // obj.common.expert = true;

            if (unit && objects[s] !== 'dayCount') {
                obj.common.unit = unit;
            } else if (obj.common.unit !== undefined) {
                delete obj.common.unit;
            }

            this.tasks.push({
                name: 'setObjectNotExists',
                id: `temp.${type}.${id}.${objects[s]}`,
                obj
            });
        }

        isStart && this.processTasks();
        this.setInitial(type, id);
    }

    setInitial(type, id) {
        // if values have not already been logged from the last adapter start,
        // then fill them with '0' so that the read does not hit the values undefined.
        const nameObjectType = nameObjects[type];
        const objects = nameObjectType.temp;
        const isStart = !this.tasks.length;
        for (let s = 0; s < objects.length; s++) {
            this.tasks.push({
                name: 'async',
                args: {
                    name: objects[s],
                    id: `temp.${type}.${id}.${objects[s]}`,
                    trueId: id,
                    type: type
                },
                wait: true,
                callback: (args, callback) => {
                    this.log.debug(`[SET INITIAL] ${args.trueId} ${args.type} ${args.name}`);
                    this.getValue(args.id, (err, value) => {
                        this.log.debug(`[SET INITIAL] ${args.trueId} value ${args.id} exists ? ${value} in obj: ${args.id}`);
                        if (value === null) {
                            this.log.debug(`[SET INITIAL] ${args.trueId} replace with 0 -> ${args.id}`);
                            if (args.type === 'avg') {
                                if (args.name === 'dayCount') {
                                    return this.getForeignState(args.trueId, (er, value) => {
                                        if (value && value.val !== null) {
                                            this.setValue(args.id, 1, callback);
                                        } else {
                                            callback();
                                        }
                                    });
                                } else {
                                    return this.getForeignState(args.trueId, (er, value) => { // get current value to set for initial min, max, last
                                        if (value && value.val !== null) {
                                            this.log.debug(`[SET INITIAL] ${args.trueId} object ${args.trueId} ${args.name}`);
                                            this.log.debug(`[SET INITIAL] ${args.trueId} act value ${value.val}`);
                                            this.setValue(args.id, value.val, callback);
                                        } else {
                                            callback();
                                        }
                                    });
                                }
                            } else if (args.type === 'minmax') {
                                return this.getForeignState(args.trueId, (er, value) => { // get current value to set for initial min, max, last
                                    if (value && value.val !== null) {
                                        this.log.debug(`[SET INITIAL] ${args.trueId} object ${args.trueId} ${args.name}`);
                                        this.log.debug(`[SET INITIAL] ${args.trueId} act value ${value.val}`);
                                        this.setValue(args.id, value.val, callback);
                                    } else {
                                        callback();
                                    }
                                });
                            } else {
                                if (args.name === 'last01') {
                                    return this.getForeignState(args.trueId, (err, state) => { // get current value
                                        this.log.debug(`[SET INITIAL] ${args.trueId} object ${args.trueId} ${args.name}`);
                                        this.log.debug(`[SET INITIAL] ${args.trueId} act value ${state && state.val} time ${state && state.lc}`);
                                        if (isFalse(state && state.val)) {
                                            this.log.debug(`[SET INITIAL] ${args.trueId} state is false und last 01 now as lastChange`);
                                            this.setValue(args.id, Date.now(), callback);
                                        } else
                                        if (isTrue(state && state.val)) {
                                            this.log.debug(`[SET INITIAL] ${args.trueId} state is false und last 01  get old time`);
                                            this.setValue(args.id, state.lc, callback);
                                        } else {
                                            this.log.error(`[SET INITIAL] ${args.trueId} unknown state to be evaluated in timeCount`);
                                            callback();
                                        }
                                    });
                                } else if (args.name === 'last10') {
                                    return this.getForeignState(args.trueId, (err, state) => { // get actual values
                                        this.log.debug(`[SET INITIAL] ${args.trueId} objects ${args.trueId} ${args.name}`);
                                        this.log.debug(`[SET INITIAL] ${args.trueId} act value ${state && state.val} time ${state && state.lc}`);
                                        if (isFalse(state && state.val)) {
                                            this.setValue(args.id, state.lc, callback);
                                            this.log.debug(`[SET INITIAL] ${args.trueId} state is false and last 10 get old time`);
                                        } else
                                        if (isTrue(state && state.val)) {
                                            this.setValue(args.id, Date.now(), callback);
                                            this.log.debug(`[SET INITIAL] ${args.trueId} state is true and last 10 get now as lastChange`);
                                        } else {
                                            this.log.error(`[SET INITIAL] ${args.trueId} unknown state to be evaluated in timeCount`);
                                            callback();
                                        }
                                    });
                                } else if (args.name === 'lastPulse') {
                                    return this.getForeignState(args.trueId, (err, state) => { // get actual values
                                        this.log.debug(`[SET INITIAL] ${args.trueId} objects ${args.trueId} ${args.name}`);
                                        this.log.debug(`[SET INITIAL] ${args.trueId} act value ${state && state.val} time ${state && state.lc}`);
                                        if (isTrue(state && state.val) || isFalse(state && state.val)) { //egal was drin ist, es muß zum Wertebereich passen und es wird auf den Wert von lastPulse gesetzt
                                            this.setValue(args.id, state.val, callback);
                                            this.log.debug(`[SET INITIAL] ${args.trueId} state was ${state.val} and lastPulse get old time`);
                                        } else {
                                            this.log.error(`[SET INITIAL] ${args.trueId} unknown state to be evaluated in count`);
                                            callback();
                                        }
                                    });
                                } else if (args.name === 'last') { // speichern des aktuellen Zustandes für timecount, sofern mit poll gleiche Zustände geholt werden und keinen Signalwechsel darstellen
                                    return this.getForeignState(args.trueId, (err, state) => { // get actual value for the state in timecount
                                        this.log.debug(`[SET INITIAL] ${args.trueId} objects ${args.trueId} ${args.name}`);
                                        this.log.debug(`[SET INITIAL] ${args.trueId} act value ${state && state.val} time ${state && state.lc}`);
                                        if (isTrue(state && state.val) || isFalse(state && state.val)) { //egal was drin ist, es muß zum Wertebereich passen und es wird auf den Wert von lastPulse gesetzt
                                            this.setValue(args.id, state.val, callback);
                                            this.log.debug(`[SET INITIAL] ${args.trueId} state is ${state.val} and set to last `);
                                        } else {
                                            this.log.error(`[SET INITIAL] ${args.trueId} unknown state to be evaluated in count`);
                                            callback();
                                        }
                                    });
                                }
                            }
                            return void callback();
                        } else {
                            return void callback();
                        }
                    });
                }
            });
        }
        isStart && this.processTasks();
    }

    processNext() {
        this.tasks.shift();
        setImmediate(this.processTasks.bind(this));
    }

    processTasks(callback) {
        if (callback) {
            this.tasksFinishedCallbacks.push(callback);
        }

        if (!this.tasks || !this.tasks.length) {
            if (this.taskCallback) {
                const cb = this.taskCallback;
                this.taskCallback = null;
                cb();
            }

            this.units = {};
            const processCallbacks = this.tasksFinishedCallbacks;
            this.tasksFinishedCallbacks = [];
            processCallbacks.forEach(cb => setImmediate(cb));
            return;
        }

        const task = this.tasks[0];
        if (task.name === 'setObjectNotExists') {
            const attr = task.id.split('.').pop();
            // detect unit
            if (task.obj.native.addr &&
                task.obj.type === 'state' &&
                this.units[task.obj.native.addr] === undefined &&
                !nameObjects.timeCount.temp.includes(attr) &&
                !task.id.match(/\.dayCount$/) && // !! Problem mit .?
                !task.id.startsWith('save.sumGroup.') && !task.id.startsWith('temp.sumGroup.')) {
                this.getForeignObject(task.obj.native.addr, (err, obj) => {

                    if (obj && obj.common && obj.common.unit) {
                        task.obj.common.unit = obj.common.unit;
                        this.units[task.obj.native.addr] = obj.common.unit;
                    } else {
                        this.units[task.obj.native.addr] = '';
                    }

                    this.setObjectNotExists(task.id, task.obj, (err, isCreated) => {
                        if (isCreated) {
                            this.log.debug(`[CREATION] ${task.id}`);
                        }

                        this.processNext();
                    });
                });
            } else {
                if (task.obj.native.addr && !task.id.match(/\.dayCount$/)) { // !! Problem mit .?
                    if (this.units[task.obj.native.addr] !== undefined) {
                        if (this.units[task.obj.native.addr]) {
                            task.obj.common.unit = this.units[task.obj.native.addr];
                        }
                    } else if (task.id.startsWith('save.sumGroup.') || task.id.startsWith('temp.sumGroup.')) {
                        task.obj.common.unit = this.groups[task.obj.native.addr] && this.groups[task.obj.native.addr].config && this.groups[task.obj.native.addr].config.priceUnit ? this.groups[task.obj.native.addr].config.priceUnit.split('/')[0] : '€';
                    }
                }

                this.setObjectNotExists(task.id, task.obj, (err, isCreated) => {
                    if (isCreated) {
                        this.log.debug(`[CREATION] ${task.id}`);
                    }

                    this.processNext();
                });
            }
        } else if (task.name === 'async') {
            if (typeof task.callback === 'function') {
                task.callback(task.args, this.processNext.bind(this));
            } else {
                this.log.error('error async task');
                this.processNext();
            }
        } else if (task.name === 'promise') {
            if (typeof task.callback === 'function') {
                task.callback(task.args).then(() => {
                    this.processNext();
                });
            } else {
                this.log.error('error async task');
                this.processNext();
            }
        }
    }

    fiveMin() {
        this.log.debug('[5 MINUTES] evaluation');
        const isStart = !this.tasks.length;
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
        if (this.typeObjects.fiveMin) {
            for (let t = 0; t < this.typeObjects.fiveMin.length; t++) {
                this.tasks.push({
                    name: 'async',
                    args: { id: this.typeObjects.fiveMin[t] },
                    callback: (args, callback) => {
                        if (!this.statDP[args.id]) {
                            return callback && callback();
                        }
                        let temp5MinID;
                        let actualID;
                        if (this.statDP[args.id].sumDelta) {
                            temp5MinID = `temp.sumDelta.${args.id}.last5Min`;
                            actualID = `save.sumDelta.${args.id}.last`;
                        } else {
                            temp5MinID = `temp.count.${args.id}.last5Min`;
                            actualID = `temp.count.${args.id}.day`;
                        }

                        this.getValue(actualID, (err, actual) => {
                            if (actual === null) {
                                return callback();
                            }
                            this.getValue(`temp.fiveMin.${args.id}.dayMin5Min`, (err, min) => {
                                this.getValue(`temp.fiveMin.${args.id}.dayMax5Min`, (err, max) => {
                                    this.getValue(temp5MinID, (err, old) => {
                                        // Write actual state into counter object
                                        this.setValueStat(temp5MinID, actual, () => {
                                            if (old === null) {
                                                return callback();
                                            }
                                            const delta = actual - old;
                                            this.log.debug(`[STATE CHANGE] fiveMin; of : ${args.id} with  min: ${min} max: ${max} actual: ${actual} old: ${old} delta: ${delta}`);
                                            this.setValueStat(`temp.fiveMin.${args.id}.mean5Min`, delta, () => {
                                                if (max === null || delta > max) {
                                                    this.log.debug(`[STATE CHANGE] new Max temp.fiveMin.${args.id}.dayMax5Min: ${delta}`);
                                                    this.setValueStat(`temp.fiveMin.${args.id}.dayMax5Min`, delta, callback);
                                                    callback = null;
                                                }
                                                if (min === null || delta < min) {
                                                    this.log.debug(`[STATE CHANGE] new Min temp.fiveMin.${args.id}.dayMin5Min: ${delta}`);
                                                    this.setValueStat(`temp.fiveMin.${args.id}.dayMin5Min`, delta, callback);
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
        isStart && this.processTasks();
    }

    onStateChangeAvgValue(id, value) {
        const isStart = !this.tasks.length;
        /**
         * Comparison between last min / max and now transmitted value
         */
        value = parseFloat(value); // || 0; if NaN we should not put a zero inside, better to skip everything

        if (!isNaN(value)) {
            this.log.debug(`[STATE CHANGE] avg call: ${id} value ${value}`);
            this.tasks.push({
                name: 'promise',
                args: {
                    id,
                    value
                }, callback: async (args) => {
                    this.log.debug(`[STATE CHANGE] new last for "temp.avg.${args.id}.last: ${value}`);
                    // memorize current value to have it available when date change for actual=starting point of new time frame
                    await this.setValueAsync(`temp.avg.${args.id}.last`, value);

                    let count = await this.getValueAsync(`temp.avg.${args.id}.dayCount`);
                    count = count ? count + 1 : 1;

                    await this.setValueAsync(`temp.avg.${args.id}.dayCount`, count);

                    let sum = await this.getValueAsync(`temp.avg.${args.id}.daySum`);
                    sum = sum ? sum + value : value;

                    await this.setValueAsync(`temp.avg.${args.id}.daySum`);
                    await this.setValueAsync(`temp.avg.${args.id}.dayAvg`, roundValue(sum / count, PRECISION));

                    const tempMin = await this.getValueAsync(`temp.avg.${args.id}.dayMin`);
                    if (tempMin === null || tempMin > value) {
                        await this.setValueAsync(`temp.avg.${args.id}.dayMin`, value);
                        this.log.debug(`[STATE CHANGE] new min for "temp.avg.${args.id}.dayMin: ${value}`);
                    }

                    const tempMax = await this.getValueAsync(`temp.avg.${args.id}.dayMax`);
                    if (tempMax === null || tempMax < value) {
                        await this.setValueAsync(`temp.avg.${args.id}.dayMax`, value);
                        this.log.debug(`[STATE CHANGE] new max for "temp.avg.${args.id}.dayMax: ${value}`);
                    }
                }
            });
            isStart && this.processTasks();
        }
    }

    onStateChangeTimeCntValue(id, state) {
        const isStart = !this.tasks.length;
        /*
        value with threshold or state
        Change to 1 at threshold 0 -> time between event since last 0
        Addition of time
        Change to 0 at threshold 1 -> time between event since last 1
        Addition of time
        no change but re-trigger counts up the time of respective state
        */
        this.log.debug(`[STATE CHANGE] timecount call ${id} with ${state.val}`); // !! val ist hier falsch da state komplett übergeben
        if (isTrue(state.val)) {
            this.tasks.push({
                name: 'async',
                args: {
                    id,
                    state
                },
                callback: (args, callback) => {
                    this.getValue(`temp.timeCount.${args.id}.last`, (err, actual) => { //Bestimmung letzter Zustand, wegen mehrfach gleicher Wert
                        if (!isTrue(actual)) { // ein echter Signalwechsel, somit Bestimmung delta für OFF-Zeitraum von 1->0 bis jetzt 0->1
                            this.getValue(`temp.timeCount.${args.id}.last10`, (err, last) => {
                                let delta = last ? state.ts - last : 0; // wenn last true dann delta, ansonsten 0
                                if (delta < 0) {
                                    delta = 0;
                                } else {
                                    delta = Math.floor(delta / 1000);
                                }
                                this.log.debug(`[STATE CHANGE] new last temp.timeCount.${args.id}.last: ${state.val}`);
                                this.setValue(`temp.timeCount.${args.id}.last`, state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                    this.log.debug(`[STATE CHANGE] new last01 temp.timeCount.${args.id}.last01: ${state.ts}  ${timeConverter(state.ts)}` );
                                    this.setValue(`temp.timeCount.${args.id}.last01`, state.ts, () => {
                                        this.log.debug(`[STATE CHANGE] 0->1 delta ${delta} state ${timeConverter(state.ts)} last ${timeConverter(last)}`);
                                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) { // über alle Zeiträume den Wert aufaddieren
                                            if (nameObjects.timeCount.temp[s].match(/off\w+$/)) {
                                                this.tasks.push({
                                                    name: 'async',
                                                    args: {
                                                        id: `temp.timeCount.${args.id}.${nameObjects.timeCount.temp[s]}`
                                                    },
                                                    callback: (args, callback) =>
                                                        this.getValue(args.id, (err, time) => {
                                                            this.log.debug(`[STATE CHANGE] 0->1 new val ${args.id}: ${(time || 0) + delta}`);
                                                            this.setValue(args.id, (time || 0) + delta, callback);
                                                        })
                                                });
                                            }
                                        }
                                        callback();
                                    });
                                });
                            });
                        } else { // kein Signalwechsel, nochmal gleicher Zustand, somit Bestimmung delta für update ON-Zeitraum von letzten 0->1 bis jetzt 0->1
                            this.getValue(`temp.timeCount.${args.id}.last01`, (err, last) => {
                                let delta = last ? state.ts - last : 0; // wenn last true dann delta, ansonsten 0
                                if (delta < 0) {
                                    delta = 0;
                                } else {
                                    delta = Math.floor(delta / 1000);
                                }
                                this.log.debug(`[STATE CHANGE] new last temp.timeCount.${args.id}.last: ${state.val}`);
                                this.setValue(`temp.timeCount.${args.id}.last`, state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                    this.log.debug(`[STATE CHANGE] new last01 temp.timeCount.${args.id}.last01: ${state.ts} ${timeConverter(state.ts)}`);
                                    this.setValue(`temp.timeCount.${args.id}.last01`, state.ts, () => {
                                        this.log.debug(`[STATE EQUAL] 1->1 delta ${delta} state ${timeConverter(state.ts)} last ${timeConverter(last)}`);
                                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) { // über alle Zeiträume den Wert aufaddieren
                                            if (nameObjects.timeCount.temp[s].match(/^on\w+$/)) { // ^ wegen on in Month
                                                this.tasks.push({
                                                    name: 'async',
                                                    args: {
                                                        id: `temp.timeCount.${args.id}.${nameObjects.timeCount.temp[s]}`
                                                    },
                                                    callback: (args, callback) =>
                                                        this.getValue(args.id, (err, time) => {
                                                            this.log.debug(`[STATE EQUAL] 1->1 new val ${args.id}: ${(time || 0) + delta}`);
                                                            this.setValue(args.id, (time || 0) + delta, callback);
                                                        })
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
        } else if (isFalse(state.val)) {
            this.tasks.push({
                name: 'async',
                args: {
                    id,
                    state
                },
                callback: (args, callback) => {
                    this.getValue(`temp.timeCount.${args.id}.last`, (err, actual) => { // Bestimmung letzter Zustand, wegen mehrfach gleicher Wert
                        if (isTrue(actual)) { // ein echter Signalwechsel, somit Bestimmung delta für ON-Zeitraum von 0->1 bis jetzt 1->0
                            this.getValue(`temp.timeCount.${args.id}.last01`, (err, last) => {
                                let delta = last ? state.ts - last : 0;
                                if (delta < 0) {
                                    delta = 0;
                                } else {
                                    delta = Math.floor(delta / 1000);
                                }
                                this.log.debug(`[STATE CHANGE] new last temp.timeCount.${args.id}.last: ${state.val}`);
                                this.setValue(`temp.timeCount.${args.id}.last`, state.val, () => { // setzen des last-Werte auf derzeitig verarbeiteten Wert
                                    this.log.debug(`[STATE CHANGE] new last10 temp.timeCount.${args.id}.last10: ${state.ts} ${timeConverter(state.ts)}`);
                                    this.setValue(`temp.timeCount.${args.id}.last10`, state.ts, () => {
                                        this.log.debug(`[STATE CHANGE] 1->0 delta ${delta} state ${timeConverter(state.ts)} last ${timeConverter(last)}`);
                                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) {
                                            if (nameObjects.timeCount.temp[s].match(/^on\w+$/)) { // on auch in Month drin, deswegen ^
                                                this.tasks.push({
                                                    name: 'async',
                                                    args: {
                                                        id: `temp.timeCount.${args.id}.${nameObjects.timeCount.temp[s]}`
                                                    },
                                                    callback: (args, callback) =>
                                                        this.getValue(args.id, (err, time) => {
                                                            this.log.debug(`[STATE CHANGE] 1->0 new val ${args.id}: ${(time || 0) + delta}`);
                                                            this.setValue(args.id, (time || 0) + delta, callback);
                                                        })
                                                });
                                            }
                                        }
                                        callback();
                                    });
                                });
                            });
                        } else { // kein Signalwechsel, nochmal gleicher Zustand, somit Bestimmung delta für update OFF-Zeitraum von letzten 1->0 bis jetzt 1->0
                            this.getValue(`temp.timeCount.${args.id}.last10`, (err, last) => {
                                let delta = last ? state.ts - last : 0;
                                if (delta < 0) {
                                    delta = 0;
                                } else {
                                    delta = Math.floor(delta / 1000);
                                }
                                this.log.debug(`[STATE CHANGE] new last temp.timeCount.${args.id}.last: ${state.val}`);
                                this.setValue(`temp.timeCount.${args.id}.last`, state.val, () => { //setzen des last-Werte auf derzeitig verarbeiteten Wert
                                    this.log.debug(`[STATE CHANGE] new last10 temp.timeCount.${args.id}.last10: ${state.ts} ${timeConverter(state.ts)}`);
                                    this.setValue(`temp.timeCount.${args.id}.last10`, state.ts, () => {
                                        this.log.debug(`[STATE EQUAL] 0->0 delta ${delta} state ${timeConverter(state.ts)} last ${timeConverter(last)}`);
                                        for (let s = 0; s < nameObjects.timeCount.temp.length; s++) {
                                            if (nameObjects.timeCount.temp[s].match(/off\w+$/)) {
                                                this.tasks.push({
                                                    name: 'async',
                                                    args: {
                                                        id: `temp.timeCount.${args.id}.${nameObjects.timeCount.temp[s]}`
                                                    },
                                                    callback: (args, callback) =>
                                                        this.getValue(args.id, (err, time) => {
                                                            this.log.debug(`[STATE EQUAL] 0->0 new val ${args.id}: ${(time || 0) + delta}`);
                                                            this.setValue(args.id, (time || 0) + delta, callback);
                                                        })
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

        isStart && this.processTasks();
    }

    onStateChangeCountValue(id, value) {
        const isStart = !this.tasks.length;
        /*
            value with limit or state
            Change to 1 -> increase by 1
            Value greater threshold -> increase by 1
        */
        this.log.debug(`[STATE CHANGE] count call ${id} with ${value}`);
        // nicht nur auf true/false prüfen, es muß sich um eine echte Flanke handeln
        // derzeitigen Zustand mit prüfen, sonst werden subscribed status updates mitgezählt
        if (this.isTrueNew(id, value, 'count')) {
            this.tasks.push({
                name: 'promise',
                args: { id },
                callback: async (args) => {
                    if (!this.statDP[args.id]) {
                        return false;
                    }

                    for (let s = 0; s < nameObjects.count.temp.length; s++) {
                        if (nameObjects.count.temp[s] !== 'lastPulse') {
                            const countId = `temp.count.${id}.${nameObjects.count.temp[s]}`;

                            let prevValue = await this.getValueAsync(countId);
                            prevValue = prevValue ? prevValue + 1 : 1;

                            this.log.debug(`[STATE CHANGE] Increase ${countId} on 1 to ${prevValue}`);
                            await this.setValueAsync(countId, prevValue);
                        }
                    }
                }
            });
        }

        isStart && this.processTasks();
    }

    onStateChangeSumCountValue(id, value) {
        const isStart = !this.tasks.length;
        /*
            value with limit or state
            Change to 1 -> increase by 1
            Value greater threshold -> increase by 1
        */
        this.log.debug(`[STATE CHANGE] sum count call ${id} with ${value}`);
        // nicht nur auf true/false prüfen, es muß sich um eine echte Flanke handeln
        // derzeitigen Zustand mit prüfen, sonst werden subscribed status updates mitgezählt
        if (this.isTrueNew(id, value, 'sumCount')) {
            this.tasks.push({
                name: 'promise',
                args: { id },
                callback: async (args) => {
                    if (!this.statDP[args.id]) {
                        return false;
                    }

                    // Calculation of consumption (what is a physical-sized pulse)
                    if (this.typeObjects.sumCount &&
                        this.typeObjects.sumCount.includes(args.id) &&
                        this.statDP[args.id].impUnitPerImpulse) { // counter mit Verbrauch

                        for (let s = 0; s < nameObjects.sumGroup.temp.length; s++) {

                            const sumCountId = `temp.sumCount.${args.id}.${nameObjects.sumGroup.temp[s]}`;
                            const sumGroupId = `temp.sumGroup.${this.statDP[args.id].sumGroup}.${nameObjects.sumGroup.temp[s]}`;

                            const impUnitPerImpulse = this.statDP[args.id].impUnitPerImpulse;

                            const prevValue = await this.getValueAsync(sumCountId);
                            const newValue = prevValue ? prevValue + impUnitPerImpulse : impUnitPerImpulse;

                            this.log.debug(`[STATE CHANGE] Increase ${sumCountId} on ${impUnitPerImpulse} to ${newValue}`);
                            await this.setValueAsync(sumCountId, newValue);

                            // add consumption to group
                            if (this.statDP[args.id].sumGroup &&
                                this.groups[this.statDP[args.id].sumGroup] &&
                                this.groups[this.statDP[args.id].sumGroup].config &&
                                this.statDP[args.id].groupFactor
                            ) {
                                const factor = this.statDP[args.id].groupFactor;
                                const price = this.groups[this.statDP[args.id].sumGroup].config.price;

                                const increaseValueBy = price * args.impUnitPerImpulse * factor;

                                let prevVal = await this.getValueAsync(sumGroupId);
                                // TODO
                                /*
                                if (ts) {
                                    prevVal = this.checkValue(prevVal || 0, ts, sumGroupId, args.type);
                                }
                                */

                                prevVal = roundValue(((prevVal || 0) + increaseValueBy), PRECISION);
                                this.log.debug(`[STATE CHANGE] Increase group ${sumGroupId} by ${increaseValueBy} to ${prevVal}`);
                                await this.setValueAsync(sumGroupId, prevVal);
                            }
                        }
                    }
                }
            });
        }
        isStart && this.processTasks();
    }

    onStateChangeMinMaxValue(id, value) {
        const isStart = !this.tasks.length;
        /**
         * Comparison between last min / max and now transmitted value
         */
        value = parseFloat(value) || 0;
        if (!isNaN(value)) {
            this.log.debug(`[STATE CHANGE] minmax call: ${id} value ${value}`);
            this.tasks.push({
                name: 'promise',
                args: {
                    id,
                    value
                }, callback: async (args) => {
                    this.log.debug(`[STATE CHANGE] new last for "temp.minmax.${args.id}.last: ${value}`);
                    await this.setValueAsync(`temp.minmax.${args.id}.last`, value); // memorize current value to have it available when date change for actual=starting point of new time frame

                    const absMin = await this.getValueAsync(`save.minmax.${args.id}.absMin`);
                    if (absMin === null || absMin > value) {
                        await this.setValueAsync(`save.minmax.${args.id}.absMin`, value);
                        this.log.debug(`[STATE CHANGE] new abs min for "${args.id}: ${value}`);
                    }

                    const absMax = await this.getValueAsync(`save.minmax.${args.id}.absMax`);
                    if (absMax === null || absMax < value) {
                        await this.setValueAsync(`save.minmax.${args.id}.absMax`, value);
                        this.log.debug(`[STATE CHANGE] new abs max for "${args.id}: ${value}`);
                    }

                    const yearMin = await this.getValueAsync(`temp.minmax.${args.id}.yearMin`);
                    if (yearMin === null || yearMin > value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.yearMin`, value);
                        this.log.debug(`[STATE CHANGE] new year min for "${args.id}: ${value}`);
                    }

                    const yearMax = await this.getValueAsync(`temp.minmax.${args.id}.yearMax`);
                    if (yearMax === null || yearMax < value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.yearMax`, value);
                        this.log.debug(`[STATE CHANGE] new year max for "${args.id}: ${value}`);
                    }

                    const quarterMin = await this.getValueAsync(`temp.minmax.${args.id}.quarterMin`);
                    if (quarterMin === null || quarterMin > value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.quarterMin`, value);
                        this.log.debug(`[STATE CHANGE] new quarter min for "${args.id}: ${value}`);
                    }

                    const quarterMax = await this.getValueAsync(`temp.minmax.${args.id}.quarterMax`);
                    if (quarterMax === null || quarterMax < value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.quarterMax`, value);
                        this.log.debug(`[STATE CHANGE] new quarter max for "${args.id}: ${value}`);
                    }

                    const monthMin = await this.getValueAsync(`temp.minmax.${args.id}.monthMin`);
                    if (monthMin === null || monthMin > value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.monthMin`, value);
                        this.log.debug(`[STATE CHANGE] new month min for "${args.id}: ${value}`);
                    }

                    const monthMax = await this.getValueAsync(`temp.minmax.${args.id}.monthMax`)
                    if (monthMax === null || monthMax < value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.monthMax`, value);
                        this.log.debug(`[STATE CHANGE] new month max for "${args.id}: ${value}`);
                    }

                    const weekMin = await this.getValueAsync(`temp.minmax.${args.id}.weekMin`);
                    if (weekMin === null || weekMin > value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.weekMin`, value);
                        this.log.debug(`[STATE CHANGE] new week min for "${args.id}: ${value}`);
                    }

                    const weekMax = await this.getValueAsync(`temp.minmax.${args.id}.weekMax`);
                    if (weekMax === null || weekMax < value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.weekMax`, value);
                        this.log.debug(`[STATE CHANGE] new week max for "${args.id}: ${value}`);
                    }

                    const dayMin = await this.getValueAsync(`temp.minmax.${args.id}.dayMin`);
                    if (dayMin === null || dayMin > value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.dayMin`, value);
                        this.log.debug(`[STATE CHANGE] new day min for "${args.id}: ${value}`);
                    }

                    const dayMax = await this.getValueAsync(`temp.minmax.${args.id}.dayMax`);
                    if (dayMax === null || dayMax < value) {
                        await this.setValueAsync(`temp.minmax.${args.id}.dayMax`, value);
                        this.log.debug(`[STATE CHANGE] new day max for "${args.id}: ${value}`);
                    }
                }
            });
            isStart && this.processTasks();
        }
    }

    onStateChangeSumDeltaValue(id, value) {
        const isStart = !this.tasks.length;
        /*
            determine the consumption per period as consecutive meter readings.
             - Validity check new value must be greater than age
             - Subtraction with last value Day
             - Subtraction with last value today -> delta for sum
             - Add delta to all values
             - treat own values differently (datapoint name)
        */
        value = parseFloat(value) || 0; // here we can probably leave the 0, if undefined then we have 0
        this.tasks.push({
            name: 'promise',
            args: { id },
            callback: async (args) => {
                const prevValue = await this.getValueAsync(`save.sumDelta.${args.id}.last`);

                if (!this.statDP[args.id]) {
                    return false;
                }

                await this.setValueAsync(`save.sumDelta.${args.id}.last`, value);

                if (prevValue === null) {
                    return false;
                }

                let delta = value - prevValue;
                if (delta < 0) {
                    if (this.statDP[args.id].sumIgnoreMinus) {
                        delta = 0;
                    }
                }
                delta = roundValue(delta, PRECISION);

                await this.setValueAsync(`save.sumDelta.${args.id}.delta`, delta);

                for (let i = 0; i < nameObjects.sumDelta.temp.length; i++) {
                    const sumDeltaId = `temp.sumDelta.${args.id}.${nameObjects.sumDelta.temp[i]}`;

                    let prevVal = await this.getValueAsync(sumDeltaId);
                    // Check if the value not older than interval
                    // TODO
                    /*
                    if (ts) {
                        prevVal = this.checkValue(prevVal, ts, sumDeltaId, nameObjects.sumDelta.temp[i]);
                    }
                    */

                    prevVal = roundValue((prevVal || 0) + delta, PRECISION);
                    this.log.debug(`[STATE CHANGE] Increase ${sumDeltaId} on ${delta} to ${prevVal}`);
                    await this.setValueAsync(sumDeltaId, prevVal);
                }

                if (this.statDP[args.id].sumGroup &&
                    this.groups[this.statDP[args.id].sumGroup] &&
                    this.groups[this.statDP[args.id].sumGroup].config &&
                    this.statDP[args.id].groupFactor
                ) {
                    const factor = this.statDP[args.id].groupFactor;
                    const price = this.groups[this.statDP[args.id].sumGroup].config.price;

                    for (let i = 0; i < nameObjects.sumGroup.temp.length; i++) {
                        const sumGroupId = `temp.sumGroup.${this.statDP[args.id].sumGroup}.${nameObjects.sumGroup.temp[i]}`;
                        const sumGroupDelta = delta * factor * price;

                        let prevVal = await this.getValueAsync(sumGroupId);

                        // Check if the value not older than interval
                        // TODO
                        /*
                        if (ts) {
                            prevVal = this.checkValue(prevVal || 0, ts, sumGroupId, nameObjects.sumGroup.temp[i]);
                        }
                        */

                        prevVal = roundValue((prevVal || 0) + sumGroupDelta, PRECISION);
                        this.log.debug(`[STATE CHANGE] Increase ${sumGroupId} on ${sumGroupDelta} to ${prevVal}`);
                        await this.setValueAsync(sumGroupId, prevVal);
                    }
                }

                // calculate average based on delta (skipped in onStateChange)
                if (this.typeObjects.avg.includes(args.id)) {
                    this.onStateChangeAvgValue(args.id, delta);
                }
            }
        });
        isStart && this.processTasks();
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Statistics(options);
} else {
    // otherwise start the instance directly
    new Statistics();
}