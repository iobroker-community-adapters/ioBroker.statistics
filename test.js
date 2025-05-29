class TimeWeightedAverage {
    constructor() {
        this.lastTime = null; // Zeitpunkt des letzten Updates (in ms)
        this.lastValue = null; // Letzter bekannter Wert
        this.weightedSum = 0; // Summe (Wert * Dauer)
        this.totalTime = 0; // Gesamtzeit (in ms)
    }

    /**
     * Fügt einen neuen Messwert hinzu
     * @param {number} value - Neuer Wert
     */
    add(value) {
        const timestamp = Date.now();
        if (this.lastTime !== null && this.lastValue !== null) {
            const deltaTime = timestamp - this.lastTime;
            this.weightedSum += this.lastValue * deltaTime;
            this.totalTime += deltaTime;
        }

        this.lastValue = value;
        this.lastTime = timestamp;

        return this.totalTime > 0 ? this.weightedSum / this.totalTime : 0;
    }
}

const twa = new TimeWeightedAverage();

// Zeitpunkte in Millisekunden
console.log(twa.add(10));

setTimeout(() => {
    console.log(twa.add(20));

    setTimeout(() => {
        const avg = twa.add(30);

        console.log('Zeitgewichteter Durchschnitt: ', avg.toFixed(2));
    }, 11 * 1000);
}, 2 * 1000);
