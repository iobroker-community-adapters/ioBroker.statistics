/**
 *
 * statistics adapter
 * 
 * the adapter creates counter objects for each radiator, which has to be set periodically via vis
 * statistics can be done afterwards
 * 
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
var stateObjects = require(__dirname + '/lib/objects');

var statisticTimeout;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.statistics.0
var adapter = utils.adapter('statistics');

var types = [];
var typeobjects = {};

var nameObjects = {
    count :{ //Impulse zählen oder Schaltspiele zählen
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },
    sumcnt :{ //Aufsummierung analoger Werte (Verbrauch aus Impulsen) Multiplikation mit Preis = Kosten
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },
    sumdelta :{ //Verbrauch aus fortlaufenden Größen () Multiplikation mit Preis = Kosten
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },
    avg :{ //Mittelwerte etc.
        save: ['daymin','daymax','dayavg','mean5min','max5min'],
        temp: ['daymin','daymax','dayavg']
    },
    timecnt :{ //Betriebszeitzählung aus Statuswechsel
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },

};


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    if (statisticTimeout) clearTimeout(statisticTimeout);
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

process.on('SIGINT', function () {
    if (statisticTimeout) clearTimeout(statisticTimeout);
});

function getConfigObjects(Obj, where, what){
    var foundObjects = [];
    for (var prop in Obj){
        if (Obj[prop][where] == what){
            foundObjects.push(Obj[prop]);
        }
    }
    return foundObjects;
}

function fiveMin(){
    /**
     * 5min Werte ermitteln
     * 
     */

}
function newAvgValue(id, wert){
    /*
    to solve asynchronity
    */
    var tempmin = adapter.getForeignState(adapter.namespace + '.temp.avg.' + id + '.daymin');
    if (tempmin > wert){
        adapter.setForeignState(adapter.namespace + '.temp.avg.' + id + '.daymin', value, true);   
    }

    var tempmax = adapter.getForeignState(adapter.namespace + '.temp.avg.'+ id + '.daymin');
    if (tempmax < wert){
        adapter.setForeignState(adapter.namespace + '.temp.avg.' + id + '.daymax', value, true);
    }
}

function newCountValue(id, state){
    /*
    value mit Grenzwert oder state
    Wechsel auf 1 -> Erhöhung um 1
    Wert größer threshold -> Erhöhung um 1
    */

    if (state === 1 || state === true || state === 'true'){
        var value = adapter.getForeignState(adapter.namespace + '.temp.count.' + id + '.day');
        value++;
        adapter.setForeignState(adapter.namespace + '.temp.count.' + id + '.day', value, true);
    }

    
}
function newSumDeltaValue(id, value){
    /*
    Gültigkeitsprüfung neuer Wert muß größer sein als alter
    Substraktion mit letzten Wert Day
    Subtraktion mit letzten Wert today -> delta für Sum
    */


}
function newSumCntValue(id, value){
    /*
    erhöht sich der zählerstand, dann ist der Verbrauchswert um die Multiplikation mit der Impils/Unit zu erhöhen
    */

}

function newSumGroupValue(id, value, group){
    /*
    Welche Gruppe?
    Gültigkeitsprüfung neuer Wert muß größer sein als alter
    Addition des Wertes in jeweiliger Gruppe
    */

}

function newTimeCntValue(id, state){

    /*
    value mit threshold oder state
    Wechsel auf 1 bei threshold 0 -> Zeit zwischen Ereignis seit letzter 0
    Addition der Zeit

    Wechsel auf 0 bei threshold 1 -> Zeit zwischen Ereignis seit letzter 1
    Addition der Zeit
    */

}

function speicherwerte(zeitraum) {
    switch(zeitraum) {
        case 'Tag':
            adapter.log.debug('saving daily values');
            //setting the count and sum values
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    var value = getForeignState(adapter.namespace + '.temp.'+ type[t] +'.' + typeobjects[s] + '.day');
                    adapter.setForeignState(adapter.namespace + '.save.'+ type[t] + '.' + typeobjects[s] + '.day', value, true);
                }
            }
            // setting the avg values
            for (var s = 0; s < typeobjects["avg"].length; s++){
                id = typeobjects["avg"][s]
                var min = getForeignState(adapter.namespace + '.temp.avg.' + id + '.daymin');
                var max = getForeignState(adapter.namespace + '.temp.avg.' + id + '.daymax');
                adapter.setForeignState(adapter.namespace + '.save.avg.' + id + '.daymin', min, true);
                adapter.setForeignState(adapter.namespace + '.save.avg.' + id + '.daymax', max, true);
            }
            break;
            
        case 'Woche':
            adapter.log.debug('saving weekly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    var value = getForeignState(adapter.namespace + '.temp.'+ type[t] +'.' + typeobjects[s] + '.week');
                    adapter.setForeignState(adapter.namespace + '.save.'+ type[t] + '.' + typeobjects[s] + '.week', value, true);
                }
            }
            break;
            
        case 'Monat':
            adapter.log.debug('saving monthly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    var value = getForeignState(adapter.namespace + '.temp.'+ type[t] +'.' + typeobjects[s] + '.month');
                    adapter.setForeignState(adapter.namespace + '.save.'+ type[t] + '.' + typeobjects[s] + '.month', value, true);
                }
            }
            
            break;
        
        case 'Quartal':
            adapter.log.debug('saving querterly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    var value = getForeignState(adapter.namespace + '.temp.'+ type[t] +'.' + typeobjects[s] + '.quarter');
                    adapter.setForeignState(adapter.namespace + '.save.'+ type[t] + '.' + typeobjects[s] + '.quarter', value, true);
                }
            }
            break;
            
        case 'Jahr':
            adapter.log.debug('saving yearly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    var value = getForeignState(adapter.namespace + '.temp.'+ type[t] +'.' + typeobjects[s] + '.year');
                    adapter.setForeignState(adapter.namespace + '.save.'+ type[t] + '.' + typeobjects[s] + '.year', value, true);
                }
            }
            break;
            
        default:
            adapter.log.error('fault on archiving the values'); 
        
    }
}

function value_reset(zeitraum) {
    switch(zeitraum) {
        case 'Tag':
            adapter.log.debug('resetting the daily values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ type[t] + '.' + typeobjects[s] + '.day', 0, true);
                }
            }
            //setting the min and max value to the current value
            for (var s = 0; s < typeobjects["avg"].length; s++){
                id = typeobjects["avg"][s]
                var actual = adapter.getForeignState(id);
                adapter.setForeignState(adapter.namespace + '.temp.avg.' + id + '.daymin', actual, true);
                adapter.setForeignState(adapter.namespace + '.temp.avg.' + id + '.daymax', actual, true);
            }
            break;

        case 'Woche':
            adapter.log.debug('resetting the weekly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ type[t] + '.' + typeobjects[s] + '.week', 0, true);
                }
            }
            break;
            
        case 'Monat':
            adapter.log.debug('resetting the monthly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ type[t] + '.' + typeobjects[s] + '.month', 0, true);
                }
            }
            break;
            
        case 'Quartal':
            adapter.log.debug('resetting the quarterly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ type[t] + '.' + typeobjects[s] + '.quarter', 0, true);
                }
            }
            break;
            
        case 'Jahr':
            adapter.log.debug('resetting the yearly values');
            for (var t = 0; s < types.length; t++){
                for (var s = 0; s < typeobjects[types[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ type[t] + '.' + typeobjects[s] + '.year', 0, true);
                }
            }
            break;
            
        default:
            adapter.log.error('fault on resetting the values');   
    }
}


// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.debug('ack is not set!');
        // es werden keine Befehle ausgewertet, sondern die Status und Meßwerte
    }

    if (state && state.ack) {
        adapter.log.debug('ack is set! Status und Messwerte');

        if(typeobjects["count"].indexOf(id) !== -1) {
            newCountValue(id, state.val);
        }
        if(typeobjects["sumcnt"].indexOf(id) !== -1) {
            newSumCntValue(id, state.val);
        }
        if(typeobjects["sumdelta"].indexOf(id) !== -1) {
            newSumDeltaValue(id, state.val);
        }
        if(typeobjects["avg"].indexOf(id) !== -1) {
            newSumGroupValue(id, state.val);
        }
        if(typeobjects["timecnt"].indexOf(id) !== -1) {
            newTimeCntValue(id, state.val);
        }
        if(typeobjects["avg"].indexOf(id) !== -1) {
            newAvgValue(id, state.val);
        }
    }

});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function defineObject(type, id, name){
    adapter.log.info('statistics setting up object = ' + type + '  ' + id);
    adapter.setObject(adapter.namespace + '.save.' + type + '.' + id, {
        type: 'channel',
        common: {
            name: 'Speicherwerte für ' + name,
            role: 'sensor'
        },
        native: {
            "addr": id
        }
    });
    adapter.setObject(adapter.namespace + '.temp.' + type + '.' + id, {
        type: 'channel',
        common: {
            name: 'temporäre Werte für ' + name,
            role: 'sensor'
        },
        native: {
            "addr": id
        }
    });

    // states for the saved values

    var nameObjectType = nameObjects[type];
    var objects= nameObjectType["save"];
    for (var s = 0; s < objects.length; s++) {
        if (!stateObjects[objects[s]]) {
            adapter.log.error('State ' + objects[s] + ' unknown');
            continue;
        }
        var obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
        if (!obj) {
            adapter.log.error('Unknown state: ' + objects[s]);
            continue;
        }
        adapter.log.debug('obj anlegen  '+ JSON.stringify(obj));
        adapter.setObject(adapter.namespace + '.save.' + type + '.' + id + '.' + objects[s], obj);
    }

    // states for the temporary values
    var objects= nameObjectType["temp"];
    for (var s = 0; s < objects.length; s++) {
        if (!stateObjects[objects[s]]) {
            adapter.log.error('State ' + objects[s] + ' unknown');
            continue;
        }
        var obj = JSON.parse(JSON.stringify(stateObjects[objects[s]]));
        if (!obj) {
            adapter.log.error('Unknown state: ' + objects[s]);
            continue;
        }
        adapter.log.debug('obj anlegen  '+ JSON.stringify(obj));
        adapter.setObject(adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[s], obj);
    }

}


function timestamp(ts) {
    var now = new Date(ts);
    var day = now.getDate();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();
    var weekday = now.getDay();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var seconds = now.getSeconds();
    var day0  = ((day < 10) ? "0" : "");
    var month0  = ((month < 10) ? "0" : "");
    var hours0  = ((hours < 10) ? "0" : "");
    var minutes0  = ((minutes < 10) ? "0" : "");
    var seconds0  = ((seconds < 10) ? "0" : "");
    var output = year + "-" + month0 + month + "-" + day0 + day + " " + hours0 + hours + ":" + minutes0 + minutes + ":" + seconds0 + seconds;  
    return output;    
}

function main() {
    // objects with statistics
    var obj = adapter.config.stateobj;
    adapter.log.debug('obj config ' + JSON.stringify(obj));
    if (!adapter.config.stateobj) {
        adapter.log.warn('No config defined');
        return;
    }

    typeobjects["count"]=[];
    typeobjects["sumcnt"]=[];
    typeobjects["sumdelta"]=[];
    typeobjects["timecnt"]=[];
    typeobjects["avg"]=[];
    typeobjects["sumgroup"]=[];

    for (var anz in obj){
        var logobject = obj[anz].logobject;
        var logname = obj[anz].logname;

        adapter.log.debug('werte ' + logobject +'  ' + logname);

        if(obj[anz].count === 'true' || obj[anz].count === true || obj[anz].count === 1){
            types.push("count");
            typeobjects["count"].push(logobject);
            defineObject( "count" , logobject, logname); //type, id, name
            adapter.subscribeForeignStates(logobject);
            adapter.setObject(adapter.namespace + '.save.count', {
                type: 'channel',
                common: {
                    name: 'Impulszählung, Schaltspielzählung',
                    role: 'sensor'
                },
                native: {
                }
            });
        }
        if(obj[anz].sumcnt === 'true' || obj[anz].sumcnt === true || obj[anz].sumcnt === 1){
            types.push("sumcnt");
            typeobjects["sumcnt"].push(logobject);
            defineObject( "sumcnt" , logobject, logname); //type, id, name
            adapter.subscribeForeignStates(logobject);
            adapter.setObject(adapter.namespace + '.save.sumcnt', {
                type: 'channel',
                common: {
                    name: 'Verbrauch aus Impulszählung',
                    role: 'sensor'
                },
                native: {
                }
            });
        }
        if(obj[anz].sumdelta === 'true' || obj[anz].sumdelta === true || obj[anz].sumdelta === 1){
            types.push("sumdelta");
            typeobjects["sumdelta"].push(logobject);
            defineObject( "sumdelta" , logobject, logname); //type, id, name
            adapter.subscribeForeignStates(logobject);
            adapter.setObject(adapter.namespace + '.save.sumdelta', {
                type: 'channel',
                common: {
                    name: 'Verbrauch',
                    role: 'sensor'
                },
                native: {
                }
            });
        }
        if(obj[anz].timecount === 'true' || obj[anz].timecount === true || obj[anz].timecount === 1){
            types.push("timecnt");
            typeobjects["timecnt"].push(logobject);
            defineObject( "timecnt" , logobject, logname); //type, id, name
            adapter.subscribeForeignStates(logobject);
            adapter.setObject(adapter.namespace + '.save.timecnt', {
                type: 'channel',
                common: {
                    name: 'Betriebszeitzähler',
                    role: 'sensor'
                },
                native: {
                }
            });
        }
        if(obj[anz].avg === 'true' || obj[anz].avg === true || obj[anz].avg === 1){
            typeobjects["avg"].push(logobject);
            defineObject( "avg" , logobject, logname); //type, id, name
            adapter.subscribeForeignStates(logobject);
            adapter.setObject(adapter.namespace + '.save.avg', {
                type: 'channel',
                common: {
                    name: 'Mittelwerte',
                    role: 'sensor'
                },
                native: {
                }
            });
        }
        if(obj[anz].sumgroup === 'true' || obj[anz].sumgroup === true || obj[anz].sumgroup === 1){
            types.push("sumgroup");
            //sumgroupname für Objekterstellung übermitteln
            typeobjects["sumgroup"].push(logobject);
            defineObject( "sumgroup" , logobject, logname); //type, id, name
            adapter.subscribeForeignStates(logobject);
            adapter.setObject(adapter.namespace + '.save.sumgroup', {
                type: 'channel',
                common: {
                    name: 'Verbrauch zusammengefasst',
                    role: 'sensor'
                },
                native: {
                }
            });
        }
    }

    adapter.log.debug('typeobjects ' + JSON.stringify(typeobjects));

    //adapter.log.info('das letzte mal wurde vom Adapter vor ' + time(now) - adapter.getState() + ' geschrieben');

    //die jetzigen Werte sind die alten Werte beim nächsten Mal
    //getValuesNow(adapter.config.meter);
    //getValuesNow(adapter.config.sum);
    //getValuesNow(adapter.config.avg);

    function pollStatisticData() {
        fiveMin();
        // falls es kein cron gibt, dann hier die Auswertung ob man vor oder nach Mitternacht ist
        // ts=newDate
        // ts + 5min
        // timestamp(ts)-> Day = 1 -> neuer Monat
        // Loop über alle werte mit entsprechenden Zeitrum speicherwerte(date);
        // Loop über alle werte mit entsrechenden value_reset();
        adapter.log.debug("making 5min evaluation");
        statisticTimeout = setTimeout(pollStatisticData, 300000); //alle 5min
    }

    pollStatisticData();

    // in this statistics all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
    
}
