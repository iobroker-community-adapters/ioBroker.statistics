module.exports = {
    'delta': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Last delta value',
                de: 'Letzter Deltawert',
                ru: 'Последнее значение delta',
                pt: 'Último valor delta',
                nl: 'Laatste delta waarde',
                fr: 'Dernière valeur delta',
                it: 'Ultimo valore delta',
                es: 'Último valor delta',
                pl: 'Wartość delta',
                'zh-cn': '上次审议的价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'last': {
        common: {
            type: 'mixed',
            role: 'value',
            name: {
                en: 'Last value',
                de: 'Letzter Wert',
                ru: 'Последняя ценность',
                pt: 'Último valor',
                nl: 'Laatste waarde',
                fr: 'Dernière valeur',
                it: 'Ultimo valore',
                es: 'Último valor',
                pl: 'Wartość końcowa',
                'zh-cn': '最后价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    '15Min': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: '15 minute value',
                de: '15 Minuten Wert',
                ru: '15 минутное значение',
                pt: 'valor de 15 minutos',
                nl: '15 minuten',
                fr: 'valeur de 15 minutes',
                it: 'valore di 15 minuti',
                es: 'valor de 15 minutos',
                pl: '15 minut',
                'zh-cn': '15分钟'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'hour': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Hourly value',
                de: 'Stundenwert',
                ru: 'Почасовая стоимость',
                pt: 'Valor por hora',
                nl: 'Urly waarde',
                fr: 'Valeur horaire',
                it: 'Valore oraria',
                es: 'Valor hora',
                pl: 'Godzina',
                'zh-cn': '高价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'day': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Daily value',
                de: 'Tageswert',
                ru: 'Ежедневная стоимость',
                pt: 'Valor diário',
                nl: 'Daily waarde',
                fr: 'Valeur quotidienne',
                it: 'Valore giornaliero',
                es: 'Valor diario',
                pl: 'Daily',
                'zh-cn': '每日价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'week': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Weekly value',
                de: 'Wöchentlicher Wert',
                ru: 'Еженедельное значение',
                pt: 'Valor semanal',
                nl: 'Weekly waarde',
                fr: 'Valeur hebdomadaire',
                it: 'Valore settimanale',
                es: 'Valor semanal',
                pl: 'Wartość tygodniowa',
                'zh-cn': '周值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'month': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Monthly value',
                de: 'Monatlicher Wert',
                ru: 'Ежемесячное значение',
                pt: 'Valor mensal',
                nl: 'Maandelijk waarde',
                fr: 'Valeur mensuelle',
                it: 'Valore mensile',
                es: 'Valor mensual',
                pl: 'Monthly wartości',
                'zh-cn': '月值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'quarter': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Quarterly value',
                de: 'Vierteljährlicher Wert',
                ru: 'Ежеквартальное значение',
                pt: 'Valor trimestral',
                nl: 'Quarteriële waarde',
                fr: 'Valeur trimestrielle',
                it: 'Valore trimestrale',
                es: 'Valor trimestral',
                pl: 'Kwartalnik',
                'zh-cn': '定量价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'year': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Yearly value',
                de: 'Jährlicher Wert',
                ru: 'Ежедневная ценность',
                pt: 'Valor anual',
                nl: 'Jarenlange waarde',
                fr: 'Valeur annuelle',
                it: 'Valore annuale',
                es: 'Valor anual',
                pl: 'Rocznik',
                'zh-cn': '年值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'dayMax': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Daily max value',
                de: 'Tagesmaximalwert',
                ru: 'Ежедневная максимальная ценность',
                pt: 'Valor máximo diário',
                nl: 'Daily Max waarde',
                fr: 'Valeur quotidienne maximale',
                it: 'Valore massimo giornaliero',
                es: 'Valor máximo diario',
                pl: 'Codzienna wartość maksymalna',
                'zh-cn': '日常价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'dayMin': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Daily min value',
                de: 'Tagesminimalwert',
                ru: 'Ежедневная мини-значимость',
                pt: 'Valor médio diário',
                nl: 'Daily min waarde',
                fr: 'Valeur quotidienne min',
                it: 'Valore minimo giornaliero',
                es: 'Valor diario min',
                pl: 'Czasopismo',
                'zh-cn': '日常价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'weekMax': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Weekly max value',
                de: 'Wöchentlicher Maximalwert',
                ru: 'Еженедельное максимальное значение',
                pt: 'Valor máximo semanal',
                nl: 'Weekly max waarde',
                fr: 'Valeur max hebdomadaire',
                it: 'Valore max settimanale',
                es: 'Valor máximo semanal',
                pl: 'Weekly max value (ang.)',
                'zh-cn': '年元值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'weekMin': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Weekly min value',
                de: 'Wöchentlicher Minimalwert',
                ru: 'Еженедельное минное значение',
                pt: 'Valor mínimo semanal',
                nl: 'Weekly min waarde',
                fr: 'Valeur hebdomadaire min',
                it: 'Valore minimo settimanale',
                es: 'Valor semanal min',
                pl: 'Czasem',
                'zh-cn': '周内价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'monthMax': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Monthly max value',
                de: 'Monatlicher Maximalwert',
                ru: 'Ежемесячная максимальная стоимость',
                pt: 'Valor máximo mensal',
                nl: 'Maandelijkse waarde',
                fr: 'Valeur maximale mensuelle',
                it: 'Valore massimo mensile',
                es: 'Valor máximo mensual',
                pl: 'Monthly max value',
                'zh-cn': '每月最高值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'monthMin': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Monthly min value',
                de: 'Monatlicher Minimalwert',
                ru: 'Ежемесячное значение мин',
                pt: 'Valor mínimo mensal',
                nl: 'Maandelijkse waarde',
                fr: 'Valeur mensuelle min',
                it: 'Valore minimo mensile',
                es: 'Valor mínimo mensual',
                pl: 'Miłość min',
                'zh-cn': '月值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'quarterMax': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Quarterly max value',
                de: 'Vierteljährlicher Maximalwert',
                ru: 'Квартально макс. значение',
                pt: 'Valor máximo trimestral',
                nl: 'Quarterale max waarde',
                fr: 'Valeur maximale trimestrielle',
                it: 'Valore massimo trimestrale',
                es: 'Valor máximo trimestral',
                pl: 'Kwartalnik maksymalny',
                'zh-cn': 'A. 定量的不可兑换值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'quarterMin': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Quarterly min value',
                de: 'Vierteljährlicher Minimalwert',
                ru: 'Ежеквартально min значение',
                pt: 'Valor mínimo trimestral',
                nl: 'Quarterly min waarde',
                fr: 'Valeur min trimestrielle',
                it: 'Valore minimo trimestrale',
                es: 'Valor trimestral min',
                pl: 'Kwartalnik',
                'zh-cn': '定量价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'yearMax': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Yearly max value',
                de: 'Jährlich Maximalwert',
                ru: 'Ежедневная максимальная ценность',
                pt: 'Valor máximo anual',
                nl: 'Jaarlijkse max waarde',
                fr: 'Valeur maximale annuelle',
                it: 'Valore massimo annuale',
                es: 'Valor máximo anual',
                pl: 'Maksimum max',
                'zh-cn': '年值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'yearMin': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Yearly min value',
                de: 'Jährlicher Minimalwert',
                ru: 'Ежегодное минное значение',
                pt: 'Valor anual mínimo',
                nl: 'Jarenlang',
                fr: 'Valeur annuelle min',
                it: 'Valore minimo annuale',
                es: 'Valor anual min',
                pl: 'Rocznik bezwartościowy',
                'zh-cn': '年值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'absMax': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Absolute max value',
                de: 'Absoluter Maximalwert',
                ru: 'Абсолютная максимальная ценность',
                pt: 'Valor máximo absoluto',
                nl: 'Absolute max waarde',
                fr: 'Valeur maximale absolue',
                it: 'Valore massimo assoluto',
                es: 'Valor máximo absoluto',
                pl: 'Absolutna wartość maksymalna',
                'zh-cn': '溶剂价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'absMin': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Absolute min value',
                de: 'Absoluter Minimalwert',
                ru: 'Абсолютная мини-значимость',
                pt: 'Valor mínimo absoluto',
                nl: 'Absolute min waarde',
                fr: 'Valeur minimale',
                it: 'Valore minimo assoluto',
                es: 'Valor absoluto min',
                pl: 'Absolute miny',
                'zh-cn': '注销价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'dayAvg': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Daily average',
                de: 'Tagesdurchschnitt',
                ru: 'Ежедневный средний',
                pt: 'Média diária',
                nl: 'Daily gemiddelde',
                fr: 'Moyenne quotidienne',
                it: 'Media giornaliera',
                es: 'Promedio diario',
                pl: 'Przeciętny',
                'zh-cn': '每日平均'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'dayCount': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Counter of daily values',
                de: 'Anzahl der Tageswerte',
                ru: 'Счет ежедневного значения',
                pt: 'Contador de valores diários',
                nl: 'Tegen de dagelijkse waarden',
                fr: 'Lutte contre les valeurs quotidiennes',
                it: 'Controvalore giornaliero',
                es: 'Lucha contra los valores diarios',
                pl: 'Przeciwko codziennym wartościom',
                'zh-cn': '反对日常价值'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'daySum': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Sum of daily values',
                de: 'Summe der Tageswerte',
                ru: 'Сумма ежедневных ценностей',
                pt: 'Sumo de valores diários',
                nl: 'Sum van dagelijkse waarden',
                fr: 'Sum of daily values',
                it: 'Somma di valori quotidiani',
                es: 'Suma de valores diarios',
                pl: 'Suma codziennych wartości',
                'zh-cn': 'A. 日常价值的概述'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'mean5Min': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: '5min mean value',
                de: '5min Mittelwert',
                ru: '5мин означает значение',
                pt: 'valor médio 5min',
                nl: '5 minuten',
                fr: 'valeur moyenne 5min',
                it: '5min valore medio',
                es: '5min valor medio',
                pl: 'wartość 5',
                'zh-cn': '5分钟'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'dayMax5Min': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Daily max value (5min)',
                de: 'Tagesmaximalwert (5min)',
                ru: 'Ежедневная максимальная ценность (5мин)',
                pt: 'Valor máximo diário (5min)',
                nl: 'Daily max waarde (5min)',
                fr: 'Valeur quotidienne max (5min)',
                it: 'Valore massimo giornaliero (5min)',
                es: 'Valor máximo diario (5min)',
                pl: 'Daily Maksymal (ang.)',
                'zh-cn': '日常价值(5分钟)'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'dayMin5Min': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Daily min value (5min)',
                de: 'Tagesminimalwert (5min)',
                ru: 'Ежедневная минимальная стоимость (5мин)',
                pt: 'Valor mínimo diário (5min)',
                nl: 'Daily min waarde (5min)',
                fr: 'Valeur quotidienne min (5min)',
                it: 'Valore minimo giornaliero (5min)',
                es: 'Valor diario de min (5min)',
                pl: 'The Daily Min (ang.)',
                'zh-cn': '每日价值(5分钟)'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'last5Min': {
        common: {
            type: 'number',
            role: 'value',
            name: {
                en: 'Last value (5min)',
                de: 'Letzter Wert (5min)',
                ru: 'Последняя ценность (5мин)',
                pt: 'Último valor (5min)',
                nl: 'Laatste waarde (5min)',
                fr: 'Dernière valeur (5min)',
                it: 'Ultimo valore (5min)',
                es: 'Último valor (5min)',
                pl: 'Ostatnia wartość (5min)',
                'zh-cn': '最后价值(5分钟)'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'last01': {
        common: {
            type: 'number',
            role: 'value.time',
            name: {
                en: 'Last change (0 to 1)',
                de: 'Letzte Änderung (0 zu 1)',
                ru: 'Последнее изменение (0 до 1)',
                pt: 'Última mudança (0 a 1)',
                nl: 'Laatste verandering',
                fr: 'Dernier changement (0 à 1)',
                it: 'Ultimo cambiamento (0 a 1)',
                es: 'Último cambio (0 a 1)',
                pl: 'Ostatnia zmiana (od 0 do 1)',
                'zh-cn': '上次变化(0至1)'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'last10': {
        common: {
            type: 'number',
            role: 'value.time',
            name: {
                en: 'Last change (1 to 0)',
                de: 'Letzte Änderung (1 zu 0)',
                ru: 'Последнее изменение (1 до 0)',
                pt: 'Última mudança (1 a 0)',
                nl: 'Laatste verandering',
                fr: 'Dernière modification (1 à 0)',
                it: 'Ultimo cambiamento (1 a 0)',
                es: 'Último cambio (1 a 0)',
                pl: 'Ostatnia zmiana (1 do 0)',
                'zh-cn': '上次变化(1至0.)'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'lastPulse': {
        common: {
            type: 'boolean',
            role: 'value',
            name: {
                en: 'Last received pulse status',
                de: 'Letzter empfangener Impulsstatus',
                ru: 'Последний получил статус импульса',
                pt: 'Último estado de pulso recebido',
                nl: 'Laatst kreeg ik een hartstilstand',
                fr: 'Dernier état des impulsions',
                it: 'Ultimo stato di impulso ricevuto',
                es: 'Último estado de pulso recibido',
                pl: 'Status pulsacyjny',
                'zh-cn': '上次收到的情况'
            },
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'on15Min': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: '15min timer (ON)',
                de: '15min Timer (ON)',
                ru: '15мин таймер (ON)',
                pt: '15min timer (ON)',
                nl: '15min timer (ON)',
                fr: 'Temporaire 15min (ON)',
                it: '15min timer (ON)',
                es: '15min timer (ON)',
                pl: '15 min timer (ON) (ang.)',
                'zh-cn': '15分钟'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'onHour': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per hour (ON)',
                de: 'Timer pro Stunde (ON)',
                ru: 'Таймер в час (ON)',
                pt: 'Temporizador por hora (ON)',
                nl: 'Timer per uur',
                fr: 'Timer per hour (ON)',
                it: 'Timer all\'ora (ON)',
                es: 'Hora por hora (ON)',
                pl: 'Timer na godzinę (pol.)',
                'zh-cn': '小时(内罗毕办事处)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'onDay': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per day (ON)',
                de: 'Timer pro Tag (ON)',
                ru: 'Таймер в день (ON)',
                pt: 'Temporizador por dia (ON)',
                nl: 'Timer per dag',
                fr: 'Timer per day (ON)',
                it: 'Timer al giorno (ON)',
                es: 'Hora por día (ON)',
                pl: 'Timer per day (ang.)',
                'zh-cn': '每天(内罗毕办事处)时间'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'onWeek': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per week (ON)',
                de: 'Timer pro Woche (ON)',
                ru: 'Таймер в неделю (ON)',
                pt: 'Temporizador por semana (ON)',
                nl: 'Timer per week',
                fr: 'Timer par semaine (ON)',
                it: 'Timer a settimana (ON)',
                es: 'Hora por semana (ON)',
                pl: 'Timer w tygodniu (ang.)',
                'zh-cn': '每周(内罗毕办事处)时间'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'onMonth': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per month (ON)',
                de: 'Timer pro Monat (ON)',
                ru: 'Таймер в месяц (ON)',
                pt: 'Temporizador por mês (ON)',
                nl: 'Timer per maand',
                fr: 'Timer per month (ON)',
                it: 'Timer al mese (ON)',
                es: 'Horaria por mes (ON)',
                pl: 'Timer na miesiąc (ang.)',
                'zh-cn': '每月(内罗毕办事处)时间'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'onQuarter': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per quarter (ON)',
                de: 'Timer pro Quartal (ON)',
                ru: 'Таймер на квартал (ON)',
                pt: 'Temporizador por trimestre (ON)',
                nl: 'Timer per kwartaal',
                fr: 'Timer par trimestre (ON)',
                it: 'Timer per trimestre (ON)',
                es: 'Hora por trimestre (ON)',
                pl: 'Timer na kwartał (ang.)',
                'zh-cn': '每季度(内罗毕办事处)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'onYear': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per year (ON)',
                de: 'Timer pro Jahr (ON)',
                ru: 'Таймер в год (ON)',
                pt: 'Temporizador por ano (ON)',
                nl: 'Timer per jaar',
                fr: 'Timer per year (ON)',
                it: 'Timer all\'anno (ON)',
                es: 'Hora por año (ON)',
                pl: 'Timer na rok (ang.)',
                'zh-cn': '每年(内罗毕办事处)时间'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'off15Min': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: '15min timer (OFF)',
                de: '15min Timer (OFF)',
                ru: '15мин таймер (OFF)',
                pt: '15min timer (OFF)',
                nl: '15min timer (OFF)',
                fr: 'Temporaire de 15min (AFP)',
                it: '15min timer (OFF)',
                es: '15min timer (OFF)',
                pl: '15 min timer (OFF) (ang.)',
                'zh-cn': '15分钟'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'offHour': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per hour (OFF)',
                de: 'Timer pro Stunde (OFF)',
                ru: 'Таймер в час (OFF)',
                pt: 'Temporizador por hora (OFF)',
                nl: 'Timer per uur',
                fr: 'Timer per hour (OFF)',
                it: 'Timer all\'ora (OFF)',
                es: 'Hora por hora (OFF)',
                pl: 'Timer na godzinę (OFF) (ang.)',
                'zh-cn': '每小时时间(森林论坛)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'offDay': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per day (OFF)',
                de: 'Timer pro Tag (OFF)',
                ru: 'Таймер в день (OFF)',
                pt: 'Temporizador por dia (OFF)',
                nl: 'Timer per dag',
                fr: 'Timer per day (OFF)',
                it: 'Timer al giorno (OFF)',
                es: 'Timer por día (OFF)',
                pl: 'Timer per day (ang.)',
                'zh-cn': '每天时间(森林论坛)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'offWeek': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per week (OFF)',
                de: 'Timer pro Woche (OFF)',
                ru: 'Таймер в неделю (OFF)',
                pt: 'Temporizador por semana (OFF)',
                nl: 'Timer per week',
                fr: 'Timer par semaine (OFF)',
                it: 'Timer a settimana (OFF)',
                es: 'Hora por semana (OFF)',
                pl: 'Timer w tygodniu (OFF)',
                'zh-cn': '每周时间(森林论坛)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'offMonth': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per month (OFF)',
                de: 'Timer pro Monat (OFF)',
                ru: 'Таймер в месяц (OFF)',
                pt: 'Temporizador por mês (OFF)',
                nl: 'Timer per maand',
                fr: 'Timer per month (OFF)',
                it: 'Timer al mese (OFF)',
                es: 'Horaria por mes (OFF)',
                pl: 'Timer na miesiąc (OFF) (ang.)',
                'zh-cn': '每月时间(森林论坛)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'offQuarter': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per quarter (OFF)',
                de: 'Timer pro Quartal (OFF)',
                ru: 'Таймер на квартал (OFF)',
                pt: 'Temporizador por trimestre (OFF)',
                nl: 'Timer per kwartaal',
                fr: 'Timer par trimestre (OFF)',
                it: 'Timer per trimestre (OFF)',
                es: 'Hora por trimestre (OFF)',
                pl: 'Timer na kwartał (OFF)',
                'zh-cn': '每季度时间(森林论坛)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    'offYear': {
        common: {
            type: 'number',
            role: 'value.interval',
            name: {
                en: 'Timer per year (OFF)',
                de: 'Timer pro Jahr (OFF)',
                ru: 'Таймер в год (OFF)',
                pt: 'Temporizador por ano (OFF)',
                nl: 'Timer per jaar',
                fr: 'Timer per year (OFF)',
                it: 'Timer all\'anno (OFF)',
                es: 'Hora por año (OFF)',
                pl: 'Timer na rok (ang.)',
                'zh-cn': '每年时间(森林论坛)'
            },
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    }
};
