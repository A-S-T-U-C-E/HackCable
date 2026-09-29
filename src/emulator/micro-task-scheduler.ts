/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Planification asynchrone des tranches CPU AVR (MessageChannel).
 *
 * Responsabilités :
 * - File de micro-tâches pour `AVRRunner.execute`
 * - Démarrer / arrêter la boucle sans bloquer le thread UI
 */
export type IMicroTaskCallback = () => void;

/**
 * Ordonnanceur léger basé sur `MessageChannel` (comme l’ancien runner HackCable).
 */
export class MicroTaskScheduler {
    private readonly channel = new MessageChannel();
    private readonly executionQueue: Array<IMicroTaskCallback> = [];
    private _stopped = true;

    /** Démarre (ou reprend) le traitement de la file. */
    start(): void {
        if (this._stopped) {
            this._stopped = false;
            this.channel.port2.onmessage = this.handleMessage;
        }
    }

    /** Arrête le scheduler et vide la file. */
    stop(): void {
        this._stopped = true;
        this.executionQueue.splice(0, this.executionQueue.length);
        this.channel.port2.onmessage = null;
    }

    /** `true` si aucune tâche ne sera plus planifiée. */
    get stopped(): boolean {
        return this._stopped;
    }

    /**
     * Enfile une callback à exécuter dès que possible.
     * @param fn - Travail à exécuter sur le prochain tick.
     */
    postTask(fn: IMicroTaskCallback): void {
        if (!this._stopped) {
            this.executionQueue.push(fn);
            this.channel.port1.postMessage(null);
        }
    }

    private readonly handleMessage = (): void => {
        const executeJob = this.executionQueue.shift();
        if (executeJob !== undefined) {
            executeJob();
        }
    };
}
