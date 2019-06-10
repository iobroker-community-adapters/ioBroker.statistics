module.exports = {
    delta: {
        common: {
            type: 'number',
            role: 'value',
            name: 'last delta value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    last: {
        common: {
            type: 'number',
            role: 'value',
            name: 'last value',
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
            name: '15min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    hour: {
        common: {
            type: 'number',
            role: 'value',
            name: 'hour value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    day: {
        common: {
            type: 'number',
            role: 'value',
            name: 'daily value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    week: {
        common: {
            type: 'number',
            role: 'value',
            name: 'weekly value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    month: {
        common: {
            type: 'number',
            role: 'value',
            name: 'monthly value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    quarter: {
        common: {
            type: 'number',
            role: 'value',
            name: 'quarterly value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    year: {
        common: {
            type: 'number',
            role: 'value',
            name: 'yearly value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    dayMax: {
        common: {
            type: 'number',
            role: 'value',
            name: 'daily max value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    dayMin: {
        common: {
            type: 'number',
            role: 'value',
            name: 'daily min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
        weekMax: {
        common: {
            type: 'number',
            role: 'value',
            name: 'weekly max value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    weekMin: {
        common: {
            type: 'number',
            role: 'value',
            name: 'weekly min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    monthMax: {
        common: {
            type: 'number',
            role: 'value',
            name: 'monthly max value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    monthMin: {
        common: {
            type: 'number',
            role: 'value',
            name: 'monthly min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    quarterMax: {
        common: {
            type: 'number',
            role: 'value',
            name: 'quarterly max value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    quarterMin: {
        common: {
            type: 'number',
            role: 'value',
            name: 'quarterly min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    yearMax: {
        common: {
            type: 'number',
            role: 'value',
            name: 'yearly max value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    yearMin: {
        common: {
            type: 'number',
            role: 'value',
            name: 'yearly min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    dayAvg: {
        common: {
            type: 'number',
            role: 'value',
            name: 'daily avg value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    dayCount: {
        common: {
            type: 'number',
            role: 'value',
            name: 'daily counter of values',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    daySum: {
        common: {
            type: 'number',
            role: 'value',
            name: 'Sum of daily values',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    mean5Min: {
        common: {
            type: 'number',
            role: 'value',
            name: '5min mean value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    dayMax5Min: {
        common: {
            type: 'number',
            role: 'value',
            name: '5min max value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    dayMin5Min: {
        common: {
            type: 'number',
            role: 'value',
            name: '5min min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    last5Min: {
        common: {
            type: 'number',
            role: 'value',
            name: 'last 5min value',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    last01: {
        common: {
            type: 'number',
            role: 'value.time',
            name: 'last 0->1',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    last10: {
        common: {
            type: 'number',
            role: 'value.time',
            name: 'last 1->0',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    lastPulse: {
        common: {
            type: 'boolean',
            role: 'value',
            name: 'last received pulse status',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    on15Min: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per 15 minutes',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    onHour: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per hour',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    onDay: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per day',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    onWeek: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per week',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    onMonth: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per month',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    onQuarter: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per quarter',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    onYear: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'ON timing per year',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    off15Min: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per 15 minutes',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    offHour: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per hour',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    offDay: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per day',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    offWeek: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per week',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    offMonth: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per month',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    offQuarter: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per quarter',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    },
    offYear: {
        common: {
            type: 'number',
            role: 'value.interval',
            name: 'OFF timing per year',
            unit: 'sec',
            write: false,
            read: true
        },
        native: {},
        type: 'state'
    }
};
