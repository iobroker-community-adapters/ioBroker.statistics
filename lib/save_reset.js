// not used
// reset der temporären werte
function value_reset2(zeitraum) {
    var daytypes =[];
    for (var key in typeobjects){
        if (key === "sumcnt" || key === "count" || key === "sumdelta" || key === "avg" || key === "sumgroup"){
            if (typeobjects[key].length !== -1){
                daytypes.push(key);
            }
        }
    }
    adapter.log.debug('daytypes '+ JSON.stringify(daytypes));
    spalte =["day","week","month","quarter","year"];
    day = spalte.indexOf(zeitraum);  // nameObjects[day] enthält den zeitbezogenen Objektwert

    if(zeitraum === "day"){
        adapter.log.debug('resetting the daily values');
        if(daytypes.length !== 0){
            for (var t = 0; t < daytypes.length; t++){
                for (var s = 0; s < typeobjects[daytypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ daytypes[t] + '.' + typeobjects[s] + '.day', 0, true);
                }
            }
        }
        if(typeobjects[avg].length !== 0){
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
        }
        if(typeobjects[fivemin].length !== 0){
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
        }
        if(typeobjects[timecnt].length !== 0){
            //setting the timecount to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.onday', 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.offday', 0, true);
            }
        }
    }
    else {
        if(daytypes.length !== 0){
            for (var t = 0; t < daytypes.length; t++){
                for (var s = 0; s < typeobjects[daytypes[t]].length; s++){
                    adapter.setForeignState(adapter.namespace + '.temp.'+ daytypes[t] + '.' + typeobjects[s] + '.week', 0, true);
                }
            }
        }
        if(typeobjects[timecnt].length !== 0){
            //setting the time cont to 0
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.'+nameObjects[day], 0, true);
                adapter.setForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][s] + '.'+nameObjects[day+5], 0, true);
            }
        } 
    }
}

// zum gegebenen Zeitpunkt die Daten speichern, neue Variante
function speicherwerte2(zeitraum) {

    var daytypes =[];
    for (var key in typeobjects){
        if (key === "sumcnt" || key === "count" || key === "sumdelta" || key === "avg" || key === "sumgroup"){
            if (typeobjects[key].length !== -1){
                daytypes.push(key);
            }
        }
    }
    adapter.log.debug('daytypes '+ JSON.stringify(daytypes));
    spalte =["day","week","month","quarter","year"];
    day = spalte.indexOf(zeitraum);  // nameObjects[day] enthält den zeitbezogenen Objektwert

    if (zeitraum === 'day'){
        adapter.log.debug('saving '+zeitraum+' values');
        //wenn daytype eine Länge hat, dann gibt es auch mindestens ein objekt zum logging
        if(daytypes.length !== 0){
            for (var t = 0; t < daytypes.length; t++){
                (function(tt){ 
                    for (var s = 0; s < typeobjects[daytypes[tt]].length; s++){
                        //IIEF notwendig?
                        (function(ss){ 
                            adapter.getForeignState(adapter.namespace + '.temp.'+ daytypes[tt] +'.' + typeobjects[daytypes[tt]][ss] + '.' + nameObjects[day], function (err, value) {
                                adapter.log.debug(nameObjects[day] + 'daytypes '+daytypes[tt] +' typeobjects2 '+typeobjects[daytypes[tt]][ss]);
                                adapter.setForeignState(adapter.namespace + '.save.'+ daytypes[tt] + '.' + typeobjects[daytypes[tt]][ss] + '.'+ nameObjects[day], value.val, true);
                            });
                        })(s);
                    }
                })(t);
            }
        }
        if(typeobjects[avg].length !== 0){
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
        }
        if(typeobjects[fivemin].length !== 0){
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

        }
        if(typeobjects[timecnt].length !== 0){
            // saving the timecount
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                (function(ss){
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day], function (err, value) {
                        adapter.log.debug('timecnt '+ nameObjects[day] +' typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day], value.val, true);
                    });
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day+5], function (err, value) {
                        adapter.log.debug('timecnt '+ nameObjects[day+5] +' typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day+5], value.val, true);
                    });
                })(s);
            }
        }

    }
    else {
        // all values not belonging to day
        adapter.log.debug('saving '+zeitraum+' values');
        if(daytypes.length !== 0){
            for (var t = 0; t < daytypes.length; t++){
                (function(tt){ 
                    for (var s = 0; s < typeobjects[daytypes[tt]].length; s++){
                        //IIEF notwendig?
                        (function(ss){ 
                            adapter.getForeignState(adapter.namespace + '.temp.'+ daytypes[tt] +'.' + typeobjects[daytypes[tt]][ss] + '.' + nameObjects[day], function (err, value) {
                                adapter.log.debug(nameObjects[day] + 'daytypes '+daytypes[tt] +' typeobjects2 '+typeobjects[daytypes[tt]][ss]);
                                adapter.setForeignState(adapter.namespace + '.save.'+ daytypes[tt] + '.' + typeobjects[daytypes[tt]][ss] + '.'+ nameObjects[day], value.val, true);
                            });
                        })(s);
                    }
                })(t);
            }
        }
        // saving the timecount not for the day
        if(typeobjects[timecnt].length !== 0){
            for (var s = 0; s < typeobjects["timecnt"].length; s++){
                (function(ss){
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day], function (err, value) {
                        adapter.log.debug('timecnt '+ nameObjects[day] +' typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day], value.val, true);
                    });
                    adapter.getForeignState(adapter.namespace + '.temp.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day+5], function (err, value) {
                        adapter.log.debug('timecnt '+ nameObjects[day+5] +' typeobjects '+typeobjects["timecnt"][ss]);
                        adapter.setForeignState(adapter.namespace + '.save.timecnt.' + typeobjects["timecnt"][ss] + '.'+nameObjects[day+5], value.val, true);
                    });
                })(s);
            }
        }
    }
}