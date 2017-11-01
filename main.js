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

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.statistics.0
var adapter = utils.adapter('statistics');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
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


function getConfigObjects(Obj, where, what){
    var foundObjects = [];
    for (var prop in Obj){
        if (Obj[prop][where] == what){
            foundObjects.push(Obj[prop]);
        }
    }
    return foundObjects;
}


function newAvgValue(){

    /*
    Gültigkeitsprüfung 
    Vergleich mit today min
    Vergleich mit today max
    */
}

function newMeterValue(){

    /*
    Gültigkeitsprüfung neuer Wert muß größer sein als alter
    Substraktion mit letzten Wert Day
    Subtraktion mit letzten Wert today -> delta für Sum
    */
}
function newSumValue(){

    /*
    Welche Gruppe?
    Gültigkeitsprüfung neuer Wert muß größer sein als alter
    Addition des Wertes in jeweiliger Gruppe
    */
}

function newCntValue(){

    /*
    value oder state
    Wechsel auf 1 -> Erhöhung um 1
    Wert größer threshold -> Erhöhung um 1
    */
}

function newOPCntValue(){

    /*
    value oder state
    Wechsel auf 1 bei threshold 0 -> Zeit zwischen Ereignis seit letzter 0
    Addition der Zeit

    Wechsel auf 0 bei threshold 1 -> Zeit zwischen Ereignis seit letzter 1
    Addition der Zeit
    */
}

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');

        //var array=getConfigObjects(adapter.config.states, 'iobrokerstate', id);
        //adapter.log.info('send to nest variable : ' + array[0].emonname + ' new value : ' + JSON.stringify(state.val));
        //adapter.setState('meter_'+ array[0].usid +'.cw_mom', {val: errechneter wert, ack: true, ts: zeitvomtagesende}, );





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

function defineMeter(id){
    adapter.setObject('meter_' + id, {
        type: 'channel',
        common: {
            name: id,
            role: 'sensor'
        },
        native: {
            "addr": id
        }
    });
    adapter.log.info('statistics setting up object = meter' + id);

    //Werte für Tag, Woche, Monat, Quartal, Jahr

    adapter.setObject('meter_' + id + '.count', {
        type: 'state',
        common: {
            "name": "Counter",
            "type": "number",
            "read": true,
            "write": true,
            "role": "level",
            "desc": "Counter"
        },
        native: {}
    });
}
function defineSum(id){ //Werte für heute, Tag, Woche, Monat, Quartal, Jahr

}
function defineAvg(id){ //Werte für heute, Tag, Woche, Monat, Quartal, Jahr, minTag, maxTag, avgTag, nur in Tag min24h, max24h

}

function defineCnt(id){ //Werte für heute, Tag, Woche, Monat, Quartal, Jahr

}

function defineOpCnt(id){ //Werte für heute, Tag, Woche, Monat, Quartal, Jahr

}
function defineTime(){ //Ablage für timestap last written object of adapter, 

}

function getValuesNow(array){ //alle Objekte lesen und im Adapter anlegen

}

function defineTime(){ //alle Objekte lesen und im Adapter anlegen

}


function newDay(){ //wenn ein neuer Tag beginnt, dann wird der Tageswert für alle geschrieben und ggf. Monat/Quartal/Jahr, bzw bei sum der heute-wert auf 0 gesetzt

}

function timestamp(ts) {
    var now=new Date(ts);
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

    // meter für Werte die kummuliert gesendet werden
    var obj = adapter.config.meter;
    for (var anz in obj){
            defineMeter(obj[anz].mstate);
            adapter.subscribeForeignStates(obj[anz].mstate);
    }
    // sum für Werte die gruppiert aufsummiert werden
    var obj = adapter.config.sum;
    for (var anz in obj){
            defineSum(obj[anz].sstate);
            adapter.subscribeForeignStates(obj[anz].sstate);
    }
    // avg für Werte die sich in ihrem messbereich um einen Nennwert pendeln
    var obj = adapter.config.avg;
    for (var anz in obj){
            defineAvg(obj[anz].astate);
            adapter.subscribeForeignStates(obj[anz].astate);
    }
    // cnt für Schaltspielzählung
    var obj = adapter.config.cnt;
    for (var anz in obj){
            defineCnt(obj[anz].cstate);
            adapter.subscribeForeignStates(obj[anz].cstate);
    }
    // opcnt für Betriebszeitzählung
    var obj = adapter.config.opcnt;
    for (var anz in obj){
            defineOpCnt(obj[anz].ocstate);
            adapter.subscribeForeignStates(obj[anz].ocstate);
    }

    //adapter.log.info('das letzte mal wurde vom Adapter vor ' + time(now) - adapter.getState() + ' geschrieben');

    //die jetzigen Werte sind die alten Werte beim nächsten Mal
    getValuesNow(adapter.config.meter);
    getValuesNow(adapter.config.sum);
    getValuesNow(adapter.config.avg);


    // in this statistics all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
    
}
