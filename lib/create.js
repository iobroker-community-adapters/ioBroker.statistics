function setupObjects(id, obj){

    //Funktion wird mit den custom objekten aufgerufen

    var logobject = id;
    adapter.log.debug('object ' + logobject +' obj ' + JSON.stringify(obj));
    var logname = obj[adapter.namespace].logname;

    adapter.log.debug('werte ' + logobject +' named ' + logname);

    //reihenfolge avg/fivemin/timecnt ist wichtig um die Reihenfolge in types festzulegen, wo dann in genau der reihenfolge die täglichen Endwerte gespeichert werden -> alles blödsinn, wenn die Werte nicht genau mit der Reihenfolge auch kommen
    if(obj[adapter.namespace].avg === 'true' || obj[adapter.namespace].avg === true || obj[adapter.namespace].avg === 1){
        typeobjects["avg"].push(logobject);
        defineObject( "avg" , logobject, logname); //type, id, name
        adapter.subscribeForeignStates(logobject);
        adapter.setObjectNotExists(adapter.namespace + '.save.avg', {
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
    adapter.log.debug('fivemin = '+ obj[adapter.namespace].fivemin + '  count=  ' + obj[adapter.namespace].count);
    if((obj[adapter.namespace].fivemin === 'true' && obj[adapter.namespace].count === 'true') || (obj[adapter.namespace].fivemin === true && obj[adapter.namespace].count === true)|| (obj[adapter.namespace].fivemin === 1 && obj[adapter.namespace].count === 1)){
        typeobjects["fivemin"].push(logobject);
        defineObject( "fivemin" , logobject, logname); //type, id, name
        adapter.setObjectNotExists(adapter.namespace + '.save.fivemin', {
            type: 'channel',
            common: {
                name: '5min Verbräuche',
                role: 'sensor'
            },
            native: {
            }
        });
    }        
    if(obj[adapter.namespace].timecount === 'true' || obj[adapter.namespace].timecount === true || obj[adapter.namespace].timecount === 1){
        typeobjects["timecnt"].push(logobject);
        defineObject( "timecnt" , logobject, logname); //type, id, name
        adapter.subscribeForeignStates(logobject);
        adapter.setObjectNotExists(adapter.namespace + '.save.timecnt', {
            type: 'channel',
            common: {
                name: 'Betriebszeitzähler',
                role: 'sensor'
            },
            native: {
            }
        });
    }
    if(obj[adapter.namespace].count === 'true' || obj[adapter.namespace].count === true || obj[adapter.namespace].count === 1){
        typeobjects["count"].push(logobject);
        defineObject( "count" , logobject, logname); //type, id, name
        adapter.subscribeForeignStates(logobject);
        adapter.setObjectNotExists(adapter.namespace + '.save.count', {
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
    if((obj[adapter.namespace].sumcnt === 'true' && obj[adapter.namespace].count === 'true')  || (obj[adapter.namespace].sumcnt === true && obj[adapter.namespace].count === true) || (obj[adapter.namespace].sumcnt === 1 && obj[adapter.namespace].count === 1)){
        typeobjects["sumcnt"].push(logobject);
        defineObject( "sumcnt" , logobject, logname, obj[adapter.namespace].unit); //type, id, name, Unit
        adapter.setObjectNotExists(adapter.namespace + '.save.sumcnt', {
            type: 'channel',
            common: {
                name: 'Verbrauch aus Impulszählung',
                role: 'sensor'
            },
            native: {
            }
        });
    }
    if(obj[adapter.namespace].sumdelta === 'true' || obj[adapter.namespace].sumdelta === true || obj[adapter.namespace].sumdelta === 1){
        typeobjects["sumdelta"].push(logobject);
        defineObject( "sumdelta" , logobject, logname); //type, id, name
        adapter.subscribeForeignStates(logobject);
        adapter.setObjectNotExists(adapter.namespace + '.save.sumdelta', {
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
    if((obj[adapter.namespace].sumgroup === 'true' && obj[adapter.namespace].sumdelta === 'true') || (obj[adapter.namespace].sumgroup === true && obj[adapter.namespace].sumdelta === true)|| (obj[adapter.namespace].sumgroup === 1 && obj[adapter.namespace].sumdelta === 1)){
        //sumgroupname für Objekterstellung übermitteln
        typeobjects["sumgroup"].push(logobject);
        defineObject( "sumgroup" , obj[adapter.namespace].sumgroupname, "Summe "+obj[adapter.namespace].sumgroupname); //type, id ist der gruppenname, name
        adapter.setObjectNotExists(adapter.namespace + '.save.sumgroup', {
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
