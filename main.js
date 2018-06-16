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
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
var stateObjects = require(__dirname + '/lib/objects');
// var schedule = require('node-schedule');
var CronJob = require('cron').CronJob;
var async = require('async');


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.statistics.0
var adapter = utils.Adapter('statistics');

var statisticTimeout;

var avg5min, daysave, weeksave, monthsave, quartersave1, quartersave2,yearsave, dayreset, weekreset, monthreset, quarterreset, yearreset;

var types = []; //zum Merken welche  Berechnungen laufen umd dann die Auswahl am tagesende richtig zu triggern.
var typeobjects = {}; //zum Merken der benutzen Objekte innerhalb der Typen(Berechnungen)

var statDP = {};

var nameObjects = {
    count :{ //Impulse zählen oder Schaltspiele zählen
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year','temp5min']
    },
    sumcnt :{ //Aufsummierung analoger Werte (Verbrauch aus Impulsen) Multiplikation mit Preis = Kosten
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },
    sumdelta :{ //Verbrauch aus fortlaufenden Größen () Multiplikation mit Preis = Kosten
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },
    sumgroup :{ //Summenverbrauch aus fortlaufenden Größen
        save: ['day','week','month','quarter','year'],
        temp: ['day','week','month','quarter','year']
    },
    avg :{ //Mittelwerte etc.
        save: ['daymin','daymax','dayavg'],
        temp: ['daymin','daymax','dayavg']
    },
    timecnt :{ //Betriebszeitzählung aus Statuswechsel
        save: ['onday','onweek','onmonth','onquarter','onyear','offday','offweek','offmonth','offquarter','offyear'],
        temp: ['onday','onweek','onmonth','onquarter','onyear','offday','offweek','offmonth','offquarter','offyear','last01','last10']
    },
    fivemin :{ //5 Minuten werte etc. nur bei Impulsen sinnvoll
        save: ['mean5min','daymax5min','daymin5min'],
        temp: ['mean5min','daymax5min','daymin5min']
    },
};


// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    if (statisticTimeout) clearTimeout(statisticTimeout);
    try {
        adapter.log.info('cleaned everything up...');
        // evtl. auch noch ein paar schedules löschen

        avg5min.stop(); 
        daysave.stop(); 
        weeksave.stop(); 
        monthsave.stop(); 
        quartersave1.stop();
        quartersave2.stop(); 
        yearsave.stop(); 
        dayreset.stop(); 
        weekreset.stop(); 
        monthreset.stop(); 
        quarterreset.stop(); 
        yearreset.stop();

        callback();
    } catch (e) {
        callback();
    }

});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('received objectChange ');
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
    if (obj && obj.common &&
        (
            // todo remove history sometime (2016.08) - Do not forget object selector in io-package.json
            (obj.common.history && obj.common.history[adapter.namespace] && obj.common.history[adapter.namespace].enabled) ||
            (obj.common.custom  && obj.common.custom[adapter.namespace]  && obj.common.custom[adapter.namespace].enabled)
        )
    ) {
        adapter.log.info('received objectChange for stat');
    }
});

process.on('SIGINT', function () {
    if (statisticTimeout) clearTimeout(statisticTimeout);
    avg5min.stop(); 
    daysave.stop(); 
    weeksave.stop(); 
    monthsave.stop(); 
    quartersave1.stop();
    quartersave2.stop(); 
    yearsave.stop(); 
    dayreset.stop(); 
    weekreset.stop(); 
    monthreset.stop(); 
    quarterreset.stop(); 
    yearreset.stop();
});

function timeConverter(timestamp){
    var a = new Date(timestamp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes();
    var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

function getCronDates() {
    adapter.log.debug('avg5min '+ timeConverter(avg5min.nextDates())); 
    adapter.log.debug('daysave '+ timeConverter(daysave.nextDates()));
    adapter.log.debug('weeksave '+timeConverter( weeksave.nextDates())); 
    adapter.log.debug('monthsave '+ timeConverter(monthsave.nextDates())); 
    adapter.log.debug('quartersave1 '+ timeConverter(quartersave1.nextDates())); 
    adapter.log.debug('quartersave2 '+ timeConverter(quartersave2.nextDates()));
    adapter.log.debug('yearsave '+ timeConverter(yearsave.nextDates()));
    adapter.log.debug('dayreset '+ timeConverter(dayreset.nextDates())); 
    adapter.log.debug('weekreset '+ timeConverter(weekreset.nextDates())); 
    adapter.log.debug('monthreset '+ timeConverter(monthreset.nextDates()));
    adapter.log.debug('quarterreset '+ timeConverter(quarterreset.nextDates()));
    adapter.log.debug('yearreset '+ timeConverter(yearreset.nextDates()));
}

function fiveMin(){
    /**
     * 5min Werte ermitteln
     * 
     * derzeitiges min aus temp holen
     * derzeitiges max aus temp holen
     * aktuellen wert aus dem überwachten Zähler
     * alten wert (vor 5min) aus dem dem überwachten zähler
     * 
     * bestimmung delta und entscheidung ob neuer min/max abgespeichert wird
     * aktueller Zählerstand wird in den altwert geschrieben
     * 
     * typeobjects["fivemin"][t] enthält die objectId des überwachten Zählers
     * 
     * 
     */
    // alle subscribed objects durchlaufen und schreiben
    for (var t = 0; t < typeobjects["fivemin"].length; t++){
        var objectvar = typeobjects["fivemin"][t];
        async.series([
            function(callback) {
                //adapter.log.debug('erster callback '+ t);
                /*
                var min = adapter.getForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.daymin5min');
                adapter.log.debug('min = '+ min);
                callback(null, min);
                */
                adapter.getForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.daymin5min', function (err, value) {
                    var min = value.val;
                    //adapter.log.debug('min = '+ min);
                    callback(null, min);
                });
            },
            function(callback) {
                //adapter.log.debug('zweiter callback '+ t);
                /*
                var max = adapter.getForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.daymax5min');
                adapter.log.debug('max = '+ max);
                callback(null, max);
                */

                adapter.getForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.daymax5min', function (err, value) {
                    var max = value.val;
                    //adapter.log.debug('max = '+ max);
                    callback(null, max);                   
                });

            },
            function(callback) {
                //adapter.log.debug('dritter callback '+ t);
                /*
                var actual = adapter.getForeignState(adapter.namespace + '.temp.count.'+ objectvar + '.day'); //aus Zählerobject
                adapter.log.debug('actual = '+ actual);
                callback(null, actual);
                */
                adapter.getForeignState(adapter.namespace + '.temp.count.'+ objectvar + '.day', function (err, value) {
                    var actual = value.val;
                    //adapter.log.debug('actual = '+ actual);
                    callback(null, actual);   
                });

            },
            function(callback) {
                //adapter.log.debug('vierter callback '+ t);
                /*
                var old = adapter.getForeignState(adapter.namespace + '.temp.count.'+ objectvar +'.temp5min'); //aus Zählerobject
                adapter.log.debug('old = '+ old);
                callback(null, old);
                */
                adapter.getForeignState(adapter.namespace + '.temp.count.'+ objectvar +'.temp5min', function (err, value) {
                    var old = value.val;
                    //adapter.log.debug('old = '+ old);
                    callback(null, old);                    
                });
            }
        ],
        // final callback
        function(err, results) {
            var min = results[0];
            var max = results[1];
            var actual = results[2];
            var old = results[3];
            var delta = actual - old;
            adapter.log.debug('fivemin; of : '+ objectvar + ' with  min: '+min+' max: '+max+' actual: '+actual+' old: '+ old+' delta: '+delta);
            adapter.setForeignState(adapter.namespace + '.temp.count.' + objectvar +'.temp5min', actual, true); //Altstand in Zählerobject schreiben
            adapter.setForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.mean5min', delta, true);
            if(delta > max){
                adapter.setForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.daymax5min', delta, true);
            }
            if(delta < min){
                adapter.setForeignState(adapter.namespace + '.temp.fivemin.' + objectvar + '.daymin5min', delta, true);
            }
        });
    }
}

function newAvgValue(id, wert){
    /**
     * vergleich zwischen letzten min/max und jetzt übermittelten wert
     */
    adapter.log.debug('avg call: '+id+ ' wert '+wert);
    adapter.getForeignState(adapter.namespace + '.temp.avg.' + id + '.daymin', function (err, tempmin) {
        var min = tempmin.val; 
        if (min > wert){
            adapter.setForeignState(adapter.namespace + '.temp.avg.' + id + '.daymin', wert, true);
            adapter.log.debug('new min: ' + wert);
        }
    });

    adapter.getForeignState(adapter.namespace + '.temp.avg.'+ id + '.daymax', function (err, tempmax) {
        var max = tempmax.val;
        if (max < wert){
            adapter.setForeignState(adapter.namespace + '.temp.avg.' + id + '.daymax', wert, true);
            adapter.log.debug('new max: ' + wert); 
        }
    });
    // dayavg fehlt noch
}

function umspeichern(datapoint){
    adapter.getForeignState(datapoint, function (err, value) {
        var val = value.val;
        adapter.setForeignState(datapoint, val + 1, true); 
    });
}

function getConfigObjects(Obj, where, what){
    var foundObjects = [];
    for (var prop in Obj){
        if (Obj[prop][where] == what){
            foundObjects.push(Obj[prop]);
        }
    }
    return foundObjects;
}

function newCountValue(id, state){
    /*
    value mit Grenzwert oder state
    Wechsel auf 1 -> Erhöhung um 1
    Wert größer threshold -> Erhöhung um 1
    */
    adapter.log.debug('count call '+id+ ' with '+ state);
    
    if (state === 1 || state === true || state === 'true'){
        /*
        for (var t = 0; t < nameObjects["count"]["save"].length; t++){ // alle Stati schreiben
            adapter.log.debug('anzahl count stati: '+nameObjects["count"]["save"].length);
            adapter.log.debug('object '+t+'name  '+nameObjects["count"]["temp"][t]);
            adapter.getForeignState(adapter.namespace + '.temp.count.' + id + '.' + nameObjects["count"]["temp"][t], function (err, value) {
                    var val = value.val++;
                    adapter.setForeignState(adapter.namespace + '.temp.count.' + id + '.' + nameObjects["count"]["temp"][t], val, true); 
            });
            
            /*
            erhöht sich der zählerstand, dann ist der Verbrauchswert um die Multiplikation mit der Impils/Unit zu erhöhen
            */
            /*
            if(typeobjects["sumcnt"].indexOf(id) !== -1) { // counter mit Verbrauch
                var wo = adapter.config.stateobj.logobject.indexOf(id);
                var verbrauch = adapter.getForeignState(adapter.namespace + '.temp.count.' + id + '.' + nameobjects["sumcnt"]["temp"][t]);
                var neuverbrauch = verbrauch.val + adapter.config.stateobj[wo].impunit;
                adapter.setForeignState(adapter.namespace + '.temp.count.' + id + '.' + nameobjects["sumcnt"]["temp"][t], neuverbrauch, true);
            }
            */
            /*
            if(typeobjects["sumcnt"].indexOf(id) !== -1) { // counter mit Verbrauch
                var wo = adapter.config.stateobj.logobject.indexOf(id);
                adapter.log.debug('sumcnt found id'+wo);
                adapter.getForeignState(adapter.namespace + '.temp.count.' + id + '.' + nameObjects["sumcnt"]["temp"][t], function (err, verbrauch) {
                    var val = verbrauch.val;
                    adapter.setForeignState(adapter.namespace + '.temp.count.' + id + '.' + nameObjects["sumcnt"]["temp"][t], val + adapter.config.stateobj[wo].impunit, true); 
                });                
            }            
        }
        */
        async.eachSeries( nameObjects["count"]["save"], function(item, nextItem) {
            var dp = item;
            //adapter.log.debug('dp= '+dp);
            async.waterfall([
                function(callback) {
                    adapter.getForeignState(adapter.namespace + '.temp.count.' + id + '.' + dp, function(err, value) {
                        if (err) return callback(err);
                        if (value.length == 0) {
                            return callback(new Error('No object with name'+id + '  ' +dp +'found.'));
                        }
                        var old = value.val;
                        callback(null, old);
                    });
                },
                function(arg1, callback) {
                    var val = arg1 + 1 ;
                    adapter.setForeignState(adapter.namespace + '.temp.count.' + id + '.' + dp, val, true);
                    adapter.log.debug('Zählerwert um 1 erhöht '+id+' '+ val);
                    callback(null, 'done');
                }
            ], function (err, result) {
                // result now equals 'done'
            });
            // Berechnung des Verbrauchs (was ist ein Impuls in physikalischer Größe)
            if(typeobjects["sumcnt"].indexOf(id) !== -1) { // counter mit Verbrauch

                var array=getConfigObjects(adapter.config.stateobj, 'logobject', id);
                if (array.length === 0 || array.length !== 1) {
                    adapter.log.debug('object ID :' + id + ' is not defined in the adapter or not unique received address');
                }
                else {
                    var impulswert = array[0].impunit;
                    adapter.getForeignState(adapter.namespace + '.temp.sumcnt.' + id + '.' + dp, function (err, verbrauch) {
                        adapter.log.debug('sumcnt '+dp + ' wert ' + verbrauch.val + ' impulswert= '+ impulswert +parseFloat(impulswert));
                        var sum = parseFloat(verbrauch.val) + parseFloat(impulswert);
                        adapter.setForeignState(adapter.namespace + '.temp.sumcnt.' + id + '.' + dp, sum, true); 
                    }); 
                }               
            }

            nextItem();
            
            },function(){
                //adapter.log.debug('everything doneeee');
            });


    }
    
}

function newSumDeltaValue(id, wert){
    /*
    Gültigkeitsprüfung neuer Wert muß größer sein als alter
    Substraktion mit letzten Wert Day
    Subtraktion mit letzten Wert today -> delta für Sum
    Delta auf alle Werte aufaddieren
    eigne Werte anders behandeln (Datenpunktname)
    */
    /*
    var old = adapter.getForeignState(adapter.namespace + '.temp.sumdelta.' + id + '.day');
    var delta = wert - old.val;
    if (delta <0){
        // Zählerüberlauf!
        delta = wert; // Differenz zwischen letzten Wert und Überlauf ist Fehlerquote
    }
    for (var t = 0; t < nameObjects["sumdelta"]["save"].length; t++){ // alle Stati schreiben
        var value = adapter.getForeignState(adapter.namespace + '.temp.sumdelta.' + id + '.' + nameObjects["sumdelta"]["temp"][t]);
        var neu =  value.val + delta;
        adapter.setForeignState(adapter.namespace + '.temp.sumdelta.' + id + '.' + nameObjects["sumdelta"]["temp"][t], neu, true);
        //in summenverbrauch mit aufnehmen
        if(typeobjects["sumgroup"].indexOf(id) !== -1) {
            var wo = adapter.config.stateobj.logobject.indexOf(id);
            var gruppe = adapter.config.stateobj[wo].sumgroupname;
            var verbrauch = adapter.getForeignState(adapter.namespace + '.temp.sumgroup.' + gruppe + '.' + nameObjects["sumdelta"]["temp"][t]);
            var sumverbrauch =  verbrauch.val + delta;
            adapter.setForeignState(adapter.namespace + '.temp.sumgroup.' + gruppe + '.' + nameObjects["sumdelta"]["temp"][t], neu, true);
        }
    }
    */
    async.waterfall([
        function(callback) {
            var old = adapter.getForeignState(adapter.namespace + '.temp.sumdelta.' + id + '.day');
            var delta = wert - old.val;
            if (delta <0){
                // Zählerüberlauf!
                delta = wert; // Differenz zwischen letzten Wert und Überlauf ist Fehlerquote
            }
            callback(null, delta);
        },
        function(arg1, callback) {
            var delta = arg1;
            async.eachSeries(nameObjects["sumdelta"]["save"], function(item, nextItem) {
                var dp = item;
                async.waterfall([
                    function(callback) {
                        var value = adapter.getForeignState(adapter.namespace + '.temp.sumdelta.' + id + '.' +dp);
                        callback(null, value);
                    },
                    function(arg1, callback) {
                        var neu =  arg1.val + delta;
                        callback(null, neu);
                    },
                    function(arg1, callback) {
                        var neu = arg1;
                        adapter.setForeignState(adapter.namespace + '.temp.sumdelta.' + id + '.' + dp, neu, true);
                        callback();
                    }
                    //sumgroup fehlt noch
                ], nextItem);
            },function(){
            });
            callback(null, 'done');
        }
    ], function (err, result) {
        // result now equals 'done'
    });

}

function newTimeCntValue(id, state){
    /*
    value mit threshold oder state
    Wechsel auf 1 bei threshold 0 -> Zeit zwischen Ereignis seit letzter 0
    Addition der Zeit

    Wechsel auf 0 bei threshold 1 -> Zeit zwischen Ereignis seit letzter 1
    Addition der Zeit
    */
    adapter.log.debug('timecount call '+id+ ' with '+ state.val);
    
    if (state.val === 1 || state.val === true || state.val === 'true' || state.val === 'on'){
        //Zeitstempel im zuletzt gespeicherten Tageswert sollte hinreichend genau sein
        /*
        var last = adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last01');
        var delta = state.lc - last.lc; //Zeitstempel vom überwachten Wert subtrahiert um Zeitstempel vom letzten Wechsel

        for (var t = 0; t < nameObjects["timecnt"]["save"].length; t++){ // alle Stati schreiben (diesmal nicht aus temp, da hier auch last01/last10 drin sind)
            if (nameObjects["timecnt"]["save"][t].indexOf("on")!== -1){
                var time = adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+nameObjects["timecnt"]["save"][t]);
                var neu = time.val + delta; 
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+nameObjects["timecnt"]["save"][t], neu, true);
            }
        }
        adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last01',{lc:state.lc},true);
        */
        
        async.waterfall([
            function(callback) {
                adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last10', function(err, value) {
                    if (err) return callback(err);
                    var last= value;
                    callback(null, last);
                });
            },
            function(arg1, callback) {
                var last = arg1
                var delta = state.lc - last.lc; //Zeitstempel vom überwachten Wert subtrahiert um Zeitstempel vom letzten Wechsel
                adapter.log.debug('0->1 delta '+delta+ ' state '+state.lc+' last '+last.lc);
                callback(null, delta);
            },
            function(arg1, callback) {
                var delta = arg1;
                async.eachSeries(nameObjects["timecnt"]["save"], function(item, nextItem) {
                    var dp=item;
                    //adapter.log.debug('timecnt on' +dp);
                    // der 01 Übergang setzt die OFF Zeiten
                    if (dp.indexOf("off")!== -1 ){
                        async.waterfall([
                            function(callback) {
                                adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+dp, function(err, value) {
                                    if (err) return callback(err);
                                    var time = value;
                                    callback(null, time);
                                });
                            },
                            function(arg1, callback) {
                                var time =arg1;
                                var neu = time.val + delta; 
                                callback(null, neu);
                            },
                            function(arg1, callback) {
                                var neu = arg1;
                                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+dp, neu, true);
                                callback();
                            }
                        ]);
                    }
                    nextItem();
                },function(){
                });
                callback(); //eachSeries callback
            },
            function(callback){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last01',{lc:state.lc},true); // setzen des last01 auf das aktuelle Ereignis
                callback(null, 'done');
            }
        ], function (err, result) {
            // result now equals 'done'
        });
        
    }

    if (state.val === 0 || state.val === false || state.val === 'false' || state.val === 'off'){
        /*
        var last = adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last10');
        var delta = state.ts - last.ts;

        for (var t = 0; t < nameObjects["timecnt"]["save"].length; t++){ // alle Stati schreiben (diesmal nicht aus temp, da hier auch last01/last10 drin sind)
            if (nameObjects["timecnt"]["save"][t].indexOf("off")!== -1){
                var time = adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+nameObjects["timecnt"]["save"][t]);
                var neu = time.val + delta; 
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+nameObjects["timecnt"]["save"][t], neu, true);
            }
        }
        adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last10',{lc:state.lc},true);
        */
        
        async.waterfall([
            function(callback) {
                adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last01', function(err, value) {
                    if (err) return callback(err);
                    var last= value;
                    callback(null, last);
                });
            },
            function(arg1, callback) {
                var last = arg1;
                var delta = state.lc - last.lc; //Zeitstempel vom überwachten Wert subtrahiert um Zeitstempel vom letzten Wechsel
                adapter.log.debug('1->0 delta '+delta+ ' state '+state.lc+' last '+last.lc);
                callback(null, delta);
            },
            function(arg1, callback) {
                var delta = arg1;
                async.eachSeries(nameObjects["timecnt"]["save"], function(item, nextItem) {
                    var dp=item;
                    //adapter.log.debug('timecnt off' +dp);
                    // der 01 Übergang setzt die OFF Zeiten
                    if (dp.indexOf("on")!== -1 && dp !=="offmonth"){ //on ist auch in month
                        async.waterfall([
                            function(callback) {
                                adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+dp, function(err, value) {
                                    if (err) return callback(err);
                                    var time = value;
                                    callback(null, time);
                                });
                            },
                            function(arg1, callback) {
                                var time = arg1;
                                var neu = time.val + delta; 
                                callback(null, neu);
                            },
                            function(arg1, callback) {
                                var neu = arg1;
                                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.'+dp, neu, true);
                                callback();
                            }
                        ]);
                    }
                    nextItem();                    
                },function(){
                });
                callback(); //eachSeries callback
            },
            function(callback){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + id + '.last10',{lc:state.lc},true);
                callback(null, 'done');
            }
        ], function (err, result) {
            // result now equals 'done'
        });
        
    }
}

// zum gegebenen Zeitpunkt die Daten speichern
function speicherwerte(zeitraum) {
    switch(zeitraum) {
        case 'Tag':
            adapter.log.debug('saving daily values');
            //saving the count,sum, sumdelta values, not for avg, fivemin, timecnt
            var daytypes = types;

            // !!! das muß anders gelöst werden, weil Reihenfolge nicht sichergestellt ist, also position bestimmen und position löschen
            if (daytypes.indexOf('avg')!== -1){daytypes = daytypes.filter(function(item) {return item !== 'avg'})} //löschen von avg, wenn vorhanden, dann ist dies der erste Wert
            if (daytypes.indexOf('fivemin')!== -1){daytypes = daytypes.filter(function(item) {return item !== 'fivemin'})} //löschen von fivemin, wenn vorhanden, soll jetzt an erster stelle stehen
            if (daytypes.indexOf('timecnt')!== -1){daytypes = daytypes.filter(function(item) {return item !== 'timecnt'})} //löschen von timecnt, wenn vorhanden
            adapter.log.debug('Tagspeicherung '+JSON.stringify(daytypes));
            for (var t = 0; t < daytypes.length; t++){
                (function(tt){ 
                    for (var s = 0; s < typeobjects[daytypes[tt]].length; s++){
                        //IIEF notwendig?
                        (function(ss){ 
                            adapter.getForeignState(adapter.namespace + '.temp.'+ daytypes[tt] +'.' + typeobjects[daytypes[tt]][ss] + '.day', function (err, value) {
                                adapter.log.debug('daytypes '+daytypes[tt] +' typeobjects2 '+typeobjects[daytypes[tt]][ss]);
                                adapter.setForeignState(adapter.namespace + '.save.'+ daytypes[tt] + '.' + typeobjects[daytypes[tt]][ss] + '.day', value.val, true);
                            });
                        })(s);
                    }
                })(t);
            }
            // saving the avg values
            for (var s = 0; s < typeobjects["avg"].length; s++){
                (function(ss){

                    adapter.getForeignState(adapter.namespace + '.temp.avg.' + typeobjects["avg"][ss] + '.daymin', function (err, value) {
                        adapter.log.debug('avg daymin typeobjects '+typeobjects["avg"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.avg.' + typeobjects["avg"][ss] + '.daymin', value.val, true);
                    });

                    adapter.getForeignState(adapter.namespace + '.temp.avg.' + typeobjects["avg"][ss] + '.daymax', function (err, value) {
                        adapter.log.debug('avg daymax typeobjects '+typeobjects["avg"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.avg.' + typeobjects["avg"][ss] + '.daymax', value.val, true);
                    });

                    adapter.getForeignState(adapter.namespace + '.temp.avg.' + typeobjects["avg"][ss] + '.dayavg', function (err, value) {
                        adapter.log.debug('avg dayavg typeobjects '+typeobjects["avg"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.avg.' + typeobjects["avg"][ss] + '.dayavg', value.val, true);
                    });
                })(s);
            }
            // saving the fivemin max/min
            for (var s = 0; s < typeobjects["fivemin"].length; s++){
                (function(ss){  
                    adapter.getForeignState(adapter.namespace + '.temp.fivemin.' + typeobjects["fivemin"][ss] + '.daymin5min', function (err, value) {
                        adapter.log.debug('fivemin daymin5min typeobjects '+typeobjects["fivemin"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.fivemin.' + typeobjects["fivemin"][ss] + '.daymin5min', value.val, true);
                    });

                    adapter.getForeignState(adapter.namespace + '.temp.fivemin.' + typeobjects["fivemin"][ss] + '.daymax5min', function (err, value) {
                        adapter.log.debug('fivemin daymin5max typeobjects '+typeobjects["fivemin"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.fivemin.' + typeobjects["fivemin"][ss] + '.daymax5min', value.val, true);
                    });
                })(s);
            }
            // saving the timecount
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                (function(ss){
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.onday', function (err, value) {
                        adapter.log.debug('timecnt onday typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.onday', value.val, true);
                    });
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.offday', function (err, value) {
                        adapter.log.debug('timecnt offday typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.offday', value.val, true);
                    });
                })(s);
            }
            break;
            
        case 'Woche':
            //extraschleife für timecnt pop ("timecnt")
            adapter.log.debug('saving weekly values');
            var weektypes = types;
            if (weektypes.indexOf('avg')!== -1){weektypes = weektypes.filter(function(item) {return item !== 'avg'})}
            if (weektypes.indexOf('fivemin')!== -1){weektypes = weektypes.filter(function(item) {return item !== 'fivemin'})}
            if (weektypes.indexOf('timecnt')!== -1){weektypes = weektypes.filter(function(item) {return item !== 'timecnt'})}

            for (var t = 0; t < weektypes.length; t++){ //alle type außer timecnt und avg implementieren
                (function(tt){ 
                    for (var s = 0; s < typeobjects[weektypes[tt]].length; s++){
                        (function(ss){ 
                            adapter.getForeignState(adapter.namespace + '.temp.'+ weektypes[tt] +'.' + typeobjects[weektypes[tt]][ss] + '.week', function (err, value) {
                                adapter.log.debug('weektypes '+weektypes[tt] +' typeobjects2 '+typeobjects[weektypes[tt]][ss]);
                                adapter.setForeignState(adapter.namespace + '.save.'+ weektypes[tt] + '.' + typeobjects[weektypes[tt]][ss] + '.week', value.val, true);
                            });
                        })(s);
                    }
                })(t);
            }
            // saving the timecount
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                (function(ss){
                    getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.onweek', function (err, value) {
                        adapter.log.debug('timecnt onweek typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.onweek', value.val, true);
                    });
                    getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.offweek', function (err, value) {
                        adapter.log.debug('timecnt offweek typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.offweek', value.val, true);
                    });
                })(s);
            }
            break;
            
        case 'Monat':
            //wird mehrmals am Monatsende angesprungen
            var today = new Date(); //hier wird die Zeitzone mit beachtet
            adapter.log.debug('heute'+today);
            var tomorrow = today.setDate(today.getDate() + 1); //today wird auf Morgen gesetzt, tommorow ist in UNIX Format
            if (today.getDate() === 1){
                adapter.log.debug('saving monthly values');
                var monthtypes = types;
                if (monthtypes.indexOf('avg')!== -1){monthtypes = monthtypes.filter(function(item) {return item !== 'avg'})}
                if (monthtypes.indexOf('fivemin')!== -1){monthtypes = monthtypes.filter(function(item) {return item !== 'fivemin'})}
                if (monthtypes.indexOf('timecnt')!== -1){monthtypes = monthtypes.filter(function(item) {return item !== 'timecnt'})}
                for (var t = 0; t < monthtypes.length; t++){
                    (function(tt){ 
                        for (var s = 0; s < typeobjects[monthtypes[tt]].length; s++){
                            (function(ss){ 
                                adapter.getForeignState(adapter.namespace + '.temp.'+ monthtypes[tt] +'.' + typeobjects[monthtypes[tt]][ss] + '.month', function (err, value) {
                                    adapter.log.debug('monthttypes '+monthtypes[tt] +' typeobjects2 '+typeobjects[monthtypes[tt]][ss]);
                                    adapter.setForeignState(adapter.namespace + '.save.'+ monthtypes[tt] + '.' + typeobjects[monthtypes[tt]][ss] + '.month', value.val, true);
                                });
                            })(s);
                        }
                    })(t);
                }
                // saving the timecount
                for (var s = 0; s < typeobjects["timecnt"].length; s++){
                    (function(ss){
                        adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.onmonth', function (err, value) {
                            adapter.log.debug('timecnt onmonth typeobjects '+typeobjects["timecnt"][ss]);
                            adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.onmonth', value.val, true);
                        });
                        adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.offmonth', function (err, value) {
                            adapter.log.debug('timecnt offmonth typeobjects '+typeobjects["timecnt"][ss]);
                            adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.offmonth', value.val, true);
                        });
                    })(s);
                }  
            }                 
            break;
        
        case 'Quartal':
            adapter.log.debug('saving quarterly values');
            var quartertypes = types;
            if (quartertypes.indexOf('avg')!== -1){quartertypes = quartertypes.filter(function(item) {return item !== 'avg'})}
            if (quartertypes.indexOf('fivemin')!== -1){quartertypes = quartertypes.filter(function(item) {return item !== 'fivemin'})}
            if (quartertypes.indexOf('timecnt')!== -1){quartertypes = quartertypes.filter(function(item) {return item !== 'timecnt'})}
            for (var t = 0; t < quartertypes.length; t++){
                (function(tt){ 
                    for (var s = 0; s < typeobjects[quartertypes[tt]].length; s++){
                        (function(ss){ 
                            adapter.getForeignState(adapter.namespace + '.temp.'+ quartertypes[tt] +'.' + typeobjects[quartertypes[tt]][ss] + '.quarter', function (err, value) {
                                adapter.log.debug('quarterttypes '+quartertypes[tt] +' typeobjects2 '+typeobjects[quartertypes[tt]][ss]);
                                adapter.setForeignState(adapter.namespace + '.save.'+ quartertypes[tt] + '.' + typeobjects[quartertypes[tt]][ss] + '.quarter', value.val, true);
                            });
                        })(s);
                    }
                })(t);
            }
            // saving the timecount
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                (function(ss){ 
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.onquarter', function (err, value) {
                        adapter.log.debug('timecnt onquarter typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.onquarter', value.val, true);
                    });
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.offquarter', function (err, value) {
                        adapter.log.debug('timecnt offquarter typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.offquarter', value.val, true);
                    });
                })(s);
            } 
            break;
            
        case 'Jahr':
            adapter.log.debug('saving yearly values');
            var yeartypes = types;
            if (yeartypes.indexOf('avg')!== -1){yeartypes = yeartypes.filter(function(item) {return item !== 'avg'})}
            if (yeartypes.indexOf('fivemin')!== -1){yeartypes = yeartypes.filter(function(item) {return item !== 'fivemin'})}
            if (yeartypes.indexOf('timecnt')!== -1){yeartypes = yeartypes.filter(function(item) {return item !== 'timecnt'})}
            for (var t = 0; t < yeartypes.length; t++){
                (function(tt){ 
                    for (var s = 0; s < typeobjects[yeartypes[tt]].length; s++){
                        (function(ss){ 
                            adapter.getForeignState(adapter.namespace + '.temp.'+ yeartypes[tt] +'.' + typeobjects[yeartypes[tt]][ss] + '.year', function (err, value) {
                                adapter.log.debug('yeartypes '+yeartypes[tt] +' typeobjects2 '+typeobjects[yeartypes[tt]][ss]);
                                adapter.setForeignState(adapter.namespace + '.save.'+ yeartypes[tt] + '.' + typeobjects[yeartypes[tt]][ss] + '.year', value.val, true);
                            });
                        })(s);
                    }
                })(t);
            }
            // saving the timecount
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                (function(ss){ 
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.onyear', function (err, value) {
                        adapter.log.debug('timecnt onyear typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.onyear', value.val, true);
                    });
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.offyear', function (err, value) {
                        adapter.log.debug('timecnt offyear typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.offyear', value.val, true);
                    });
                })(s);
            }
            break;
            
        default:
            adapter.log.error('fault on archiving the values'); 
        
    }
}
// reset der temporären werte
function value_reset(zeitraum) {
    switch(zeitraum) {
        case 'Tag':
            adapter.log.debug('resetting the daily values');
            var daytypes = types;
            if (daytypes.indexOf('avg')!== -1){daytypes = daytypes.filter(function(item) {return item !== 'avg'})} 
            if (daytypes.indexOf('fivemin')!== -1){daytypes = daytypes.filter(function(item) {return item !== 'fivemin'})} 
            if (daytypes.indexOf('timecnt')!== -1){daytypes = daytypes.filter(function(item) {return item !== 'timecnt'})} 

            for (var t = 0; t < daytypes.length; t++){
                for (var s = 0; s < typeobjects[daytypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ daytypes[t] + '.' + typeobjects[s] + '.day', 0, true);
                }
            }
            //setting the min and max value to the current value
            for (var s = 0; s < typeobjects["avg"].length; s++){               
                (function(ss){ 
                    adapter.getForeignState(typeobjects["avg"][ss] , function (err, actual) {
                        adapter.setForeignState(adapter.namespace + '.temp.avg.' + typeobjects["avg"][ss] + '.daymin', actual.val, true);
                        adapter.setForeignState(adapter.namespace + '.temp.avg.' + typeobjects["avg"][ss]+ '.daymax', actual.val, true);
                        adapter.setForeignState(adapter.namespace + '.temp.avg.' + typeobjects["avg"][ss] + '.dayavg', actual.val, true);
                    });
                })(s);
            }
            //setting the min and max value to the current value
            for (var s = 0; s < typeobjects["fivemin"].length; s++){
                (function(ss){   
                    adapter.getForeignState(typeobjects["fivemin"][ss] , function (err, actual) {
                        adapter.setForeignState(adapter.namespace + '.temp.fivemin.' + typeobjects["fivemin"][ss] + '.daymin5min', actual.val, true);
                        adapter.setForeignState(adapter.namespace + '.temp.fivemin.' + typeobjects["fivemin"][ss] + '.daymax5min', actual.val, true);
                        adapter.setForeignState(adapter.namespace + '.temp.fivemin.' + typeobjects["fivemin"][ss] + '.mean5min', actual.val, true); // was hier reinschreiben?
                    });
                })(s);
            }
            //setting the time cont to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.onday', 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.offday', 0, true);
            }            
            break;
        case 'Woche':
            adapter.log.debug('resetting the weekly values');
            var weektypes = types;
            if (weektypes.indexOf('avg')!== -1){weektypes = weektypes.filter(function(item) {return item !== 'avg'})}
            if (weektypes.indexOf('fivemin')!== -1){weektypes = weektypes.filter(function(item) {return item !== 'fivemin'})}
            if (weektypes.indexOf('timecnt')!== -1){weektypes = weektypes.filter(function(item) {return item !== 'timecnt'})}
            for (var t = 0; t < weektypes.length; t++){
                for (var s = 0; s < typeobjects[weektypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ weektypes[t] + '.' + typeobjects[s] + '.week', 0, true);
                }
            }
            //setting the time cont to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.onweek', 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.offweek', 0, true);
            } 
            break;
            
        case 'Monat':
            adapter.log.debug('resetting the monthly values');
            var monthtypes = types;
            if (monthtypes.indexOf('avg')!== -1){monthtypes = monthtypes.filter(function(item) {return item !== 'avg'})}
            if (monthtypes.indexOf('fivemin')!== -1){monthtypes = monthtypes.filter(function(item) {return item !== 'fivemin'})}
            if (monthtypes.indexOf('timecnt')!== -1){monthtypes = monthtypes.filter(function(item) {return item !== 'timecnt'})}
            for (var t = 0; t < monthtypes.length; t++){
                for (var s = 0; s < typeobjects[monthtypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ monthtypes[t] + '.' + typeobjects[s] + '.month', 0, true);
                }
            }
            //setting the time cont to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.onmonth', 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.offmonth', 0, true);
            } 
            break;
            
        case 'Quartal':
            adapter.log.debug('resetting the quarterly values');
            var quartertypes = types;
            if (quartertypes.indexOf('avg')!== -1){quartertypes = quartertypes.filter(function(item) {return item !== 'avg'})}
            if (quartertypes.indexOf('fivemin')!== -1){quartertypes = quartertypes.filter(function(item) {return item !== 'fivemin'})}
            if (quartertypes.indexOf('timecnt')!== -1){quartertypes = quartertypes.filter(function(item) {return item !== 'timecnt'})}
            for (var t = 0; t < quartertypes.length; t++){
                for (var s = 0; s < typeobjects[quartertypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ quartertypes[t] + '.' + typeobjects[s] + '.quarter', 0, true);
                }
            }
            //setting the time cont to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.onquarter', 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.offquarter', 0, true);
            } 
            break;
            
        case 'Jahr':
            adapter.log.debug('resetting the yearly values');
            var yeartypes = types;
            if (yeartypes.indexOf('avg')!== -1){yeartypes = yeartypes.filter(function(item) {return item !== 'avg'})}
            if (yeartypes.indexOf('fivemin')!== -1){yeartypes = yeartypes.filter(function(item) {return item !== 'fivemin'})}
            if (yeartypes.indexOf('timecnt')!== -1){yeartypes = yeartypes.filter(function(item) {return item !== 'timecnt'})}
            for (var t = 0; t < yeartypes.length; t++){
                for (var s = 0; s < typeobjects[yeartypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ yeartypes[t] + '.' + typeobjects[s] + '.year', 0, true);
                }
            }
            //setting the time count to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.onyear', 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.offyear', 0, true);
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
        // es werden keine Befehle ausgewertet, sondern die Statuswerte und Meßwerte
    }

    if (state && state.ack) {
        adapter.log.debug('ack is set! Statuswerte und Messwerte');

        if(typeobjects["count"].indexOf(id) !== -1) {
            newCountValue(id, state.val);
        }
        if(typeobjects["sumdelta"].indexOf(id) !== -1) {
            newSumDeltaValue(id, state.val);
        }
        if(typeobjects["timecnt"].indexOf(id) !== -1) {
            newTimeCntValue(id, state);
        }
        if(typeobjects["avg"].indexOf(id) !== -1) {
            newAvgValue(id, state.val);
        }
        // 5min wird zyklisch behandelt
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
    //übergeordnete Struktur anlegen
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

    // wie bekommt man die Unit aus der Konfig für sumcnt hinein?
    // wie bekommt man die Unit aus der zu überwachenden Größe hinein?

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
        adapter.log.debug('obj anlegen  ' + objects[s] + ' structure '+ JSON.stringify(obj));
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
        adapter.log.debug('obj anlegen  ' + objects[s] + ' structure '+ JSON.stringify(obj));
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
    typeobjects["fivemin"]=[];

    for (var anz in obj){
        var logobject = obj[anz].logobject;
        var logname = obj[anz].logname;

        adapter.log.debug('werte ' + logobject +' named ' + logname);

        //reihenfolge avg/fivemin/timecnt ist wichtig um die Reigenfolge in types festzulegen, wo dann in genau der reihenfolge die täglichen Endwerte gespeichert werden -> alles blödsinn, wenn die Werte nicht genau mit der Reihenfolge auch kommen
        if(obj[anz].avg === 'true' || obj[anz].avg === true || obj[anz].avg === 1){
            // nur ein push wenn nicht schon vorhanden
            if(types.indexOf('avg') === -1){types.push("avg");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
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
        // 5minuten Werte Lassen sich nur ermitteln, wenn auch gezählt wird
        adapter.log.debug('fivemin = '+ obj[anz].fivemin + '  count=  ' + obj[anz].count);
        if((obj[anz].fivemin === 'true' && obj[anz].count === 'true') || (obj[anz].fivemin === true && obj[anz].count === true)|| (obj[anz].fivemin === 1 && obj[anz].count === 1)){
            if(types.indexOf('fivemin') === -1){types.push("fivemin");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
            //da aus eigenem Adapter, ist der id unverändert zu verwenden
            typeobjects["fivemin"].push(logobject);
            defineObject( "fivemin" , logobject, logname); //type, id, name
            adapter.setObject(adapter.namespace + '.save.fivemin', {
                type: 'channel',
                common: {
                    name: '5min Verbräuche',
                    role: 'sensor'
                },
                native: {
                }
            });
        }        
        if(obj[anz].timecount === 'true' || obj[anz].timecount === true || obj[anz].timecount === 1){
            if(types.indexOf('timecnt') === -1){types.push("timecnt");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
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
        if(obj[anz].count === 'true' || obj[anz].count === true || obj[anz].count === 1){
            if(types.indexOf('count') === -1){types.push("count");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
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
        //Umrechnung Impulse in Verbrauch ist nur sinnvoll wenn Impulse vorhanden
        if((obj[anz].sumcnt === 'true' && obj[anz].count === 'true')  || (obj[anz].sumcnt === true && obj[anz].count === true) || (obj[anz].sumcnt === 1 && obj[anz].count === 1)){
            if(types.indexOf('sumcnt') === -1){types.push("sumcnt");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
            typeobjects["sumcnt"].push(logobject);
            defineObject( "sumcnt" , logobject, logname, obj[anz].unit); //type, id, name, Unit
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
            if(types.indexOf('sumdelta') === -1){types.push("sumdelta");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
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
        //sumgroup macht nur sinn wenn es auch die deltawerte gibt
        if((obj[anz].sumgroup === 'true' && obj[anz].sumdelta === 'true') || (obj[anz].sumgroup === true && obj[anz].sumdelta === true)|| (obj[anz].sumgroup === 1 && obj[anz].sumdelta === 1)){
            if(types.indexOf('sumgroup') === -1){types.push("sumgroup");} //in types soll nur einmal jeder Eintrag sein, damit die scheduleJobs funktionieren
            //sumgroupname für Objekterstellung übermitteln
            typeobjects["sumgroup"].push(logobject);
            defineObject( "sumgroup" , obj[anz].sumgroupname, "Summe "+obj[anz].sumgroupname); //type, id ist der gruppenname, name
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
    adapter.log.debug('saved types ' + JSON.stringify(types));
    adapter.log.debug('saved typeobjects ' + JSON.stringify(typeobjects));

    //adapter.log.info('das letzte mal wurde vom Adapter vor ' + time(now) - adapter.getState() + ' geschrieben');


    function setInitial(type, id){
        //wenn nicht schon vom letzten Adapterstart Werte geloggt wurden, dann diese jetzt mit "0" befüllen, damit der read auf die Werte nicht auf undefined trifft.    
        var nameObjectType = nameObjects[type];
        var objects= nameObjectType["temp"];
        for (var s = 0; s < objects.length; s++) {
            (function(ss){ //Immediately Invoked Function Expression ss ändert sich bei jeder Änderung von s
                adapter.getForeignState(adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[ss], function (err, value) {
                    adapter.log.debug('wert vorhanden ?  '+ JSON.stringify(value)+' obj '+ adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[ss]);
                    if( value === null || value.val == undefined ){
                        adapter.log.debug('ersetze mit 0 -> '+ adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[ss]);
                        if (type === 'avg'){
                            (function(sss){ 
                                adapter.getForeignState(id, function (err, value) { //aktuelle Wert holen
                                    adapter.log.debug('objectsss '+id+objects[sss]);
                                    adapter.log.debug('act value ' + value.val);
                                    adapter.setState(adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[sss], value.val, true);
                                });
                            })(ss);
                        }
                        else{
                            adapter.setState(adapter.namespace + '.temp.' + type + '.' + id + '.' + objects[ss], 0, true);
                        }
                         
                    }
                });
            })(s); //Laufvariable schliesst die IIEF ab
        }
    }

    // initiale Werte setzen um nicht undefined in getState zu bekommen
    if(typeobjects.count.length !== 0) {typeobjects.count.forEach(function(logobject){setInitial("count", logobject);})}
    if(typeobjects.sumcnt.length !== 0) {typeobjects.sumcnt.forEach(function(logobject){setInitial("sumcnt", logobject);})}
    if(typeobjects.sumdelta.length !== 0) {typeobjects.sumdelta.forEach(function(logobject){setInitial("sumdelta", logobject);})}
    if(typeobjects.timecnt.length !== 0) {typeobjects.timecnt.forEach(function(logobject){setInitial("timecnt", logobject);})}
    if(typeobjects.avg.length !== 0) {typeobjects.avg.forEach(function(logobject){setInitial("avg", logobject);})}
    if(typeobjects.sumgroup.length !== 0) {typeobjects.sumgroup.forEach(function(logobject){setInitial("sumgroup", logobject);})}
    if(typeobjects.fivemin.length !== 0) {typeobjects.fivemin.forEach(function(logobject){setInitial("fivemin", logobject);})}    
    

    //cron-jobs setzen 

    //alle 5min
    avg5min = new CronJob("*/5 * * * *", function() {
        fiveMin();
        adapter.log.debug("making 5min evaluation");
        }, function () {
            /* This function is executed when the job stops */
                adapter.log.debug('stopped 5min');
        },
        true,
        timezone
    );

    var timezone = adapter.config.timezone || "Europe/Berlin";

    //Speicher der Zeiträume, 2Minuten vor dem Reset
    //Täglich um 23:58
    daysave = new CronJob("58 23 * * *", function() {
        speicherwerte('Tag');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped daysave');
        },
        true,
        timezone
    );

    // Sonntag 23:58
    weeksave = new CronJob("58 23 * * 0", function() {
        speicherwerte('Woche');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped weeksave');
        },
        true,
        timezone
    );

    // Monatsletzte um 23:58 Uhr ausführen
    // Springt die Routine immer an und dort wird ermittelt ob Morgen der 1. ist
    monthsave = new CronJob("58 23 28-31 * *", function() {
        speicherwerte('Monat');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped monthsave');
        },
        true,
        timezone
    );

    /*
    schedule.scheduleJob("58 23 29 * *", function() {
        speicherwerte('Monat');
    });
    schedule.scheduleJob("58 23 30 * *", function() {
        speicherwerte('Monat');
    });
    schedule.scheduleJob("58 23 31 * *", function() {
        speicherwerte('Monat');
    });
    */

 
    // Quartalsletzen (März,Juni,September,Dezember) um 23:58 Uhr ausführen
    quartersave1 = new CronJob("58 23 31 2,12 *", function() { //Monate ist Wertebereich 0-11
        speicherwerte('Quartal');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped quartersave1');
        },
        true,
        timezone
    );
    quartersave2 = new CronJob("58 23 30 5,8 *", function() { //Monate ist Wertebereich 0-11
        speicherwerte('Quartal');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped quartersave2');
        },
        true,
        timezone
    );

    // Silvester um 23:58 Uhr ausführen
    yearsave = new CronJob("58 23 31 11 *", function() { //Monate ist Wertebereich 0-11
        speicherwerte('Jahr');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped yearsave');
        },
        true,
        timezone
    );
    // RESET DER WERTE 
    // Täglich um 0 Uhr ausführen
    dayreset = new CronJob("0 0 * * *", function() {
        value_reset('Tag');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped dayreset');
        },
        true,
        timezone
    );
    // Montags um 0 Uhr ausführen
    weekreset = new CronJob("0 0 * * 1", function() {
        value_reset('Woche');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped weekreset');
        },
        true,
        timezone
    );
    // Monatsersten um 0 Uhr ausführen
    monthreset = new CronJob("0 0 1 * *", function() {
        value_reset('Monat');
    }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped monthreset');
        },
        true,
        timezone
    );
    // Quartalsersten (Jan,Apr,Jul,Okt) um 0 Uhr ausführen
    quarterreset = new CronJob("0 0 1 */3 *", function() {
        value_reset('Quartal');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped quarterreset');
        },
        true,
        timezone
    );

   
    /*
    schedule.scheduleJob("0 0 1 3 *", function() {
        value_reset('Quartal');
    });
    schedule.scheduleJob("0 0 1 6 *", function() {
        value_reset('Quartal');
    });
    schedule.scheduleJob("0 0 1 9 *", function() {
        value_reset('Quartal');
    });
    */

    
    // Neujahr um 0 Uhr ausführen
    yearreset = new CronJob("0 0 1 0 *", function() {
        value_reset('Jahr');
        }, function () {
        /* This function is executed when the job stops */
            adapter.log.debug('stopped yearreset');
        },
        true,
        timezone
    );

    // in this statistics all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    function getCronStat() {
        adapter.log.debug('avg5min      status = '+ avg5min.running + ' next event: '+ timeConverter(avg5min.nextDates())); 
        adapter.log.debug('daysave      status = '+ daysave.running + ' next event: '+ timeConverter(daysave.nextDates()));
        adapter.log.debug('weeksave     status = '+ weeksave.running + ' next event: '+ timeConverter( weeksave.nextDates())); 
        adapter.log.debug('monthsave    status = '+ monthsave.running + ' next event: '+ timeConverter(monthsave.nextDates())); 
        adapter.log.debug('quartersave1 status = '+ quartersave1.running + ' next event: '+ timeConverter(quartersave1.nextDates())); 
        adapter.log.debug('quartersave2 status = '+ quartersave2.running + ' next event: '+ timeConverter(quartersave2.nextDates()));
        adapter.log.debug('yearsave     status = '+ yearsave.running + ' next event: '+ timeConverter(yearsave.nextDates()));
        adapter.log.debug('dayreset     status = '+ dayreset.running + ' next event: '+ timeConverter(dayreset.nextDates())); 
        adapter.log.debug('weekreset    status = '+ weekreset.running + ' next event: '+ timeConverter(weekreset.nextDates())); 
        adapter.log.debug('monthreset   status = '+ monthreset.running + ' next event: '+ timeConverter(monthreset.nextDates()));
        adapter.log.debug('quarterreset status = '+ quarterreset.running + ' next event: '+ timeConverter(quarterreset.nextDates()));
        adapter.log.debug('yearreset    status = '+ yearreset.running + ' next event: '+ timeConverter(yearreset.nextDates()));
    }

    getCronStat();

}

