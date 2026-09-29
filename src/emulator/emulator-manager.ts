/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file API publique de simulation AVR (compile / load / run / pause / stop).
 *
 * Responsabilités :
 * - Un `AVRRunner` par carte MCU (`figureId`)
 * - Exécution simultanée entrelacée (boucle d’événements)
 * - Listeners GPIO tagués par `figureId` pour le bridge overlays
 */
import type { AVRIOPort } from "avr8js";
import { AVRRunner } from "./avr-runner";
import { compileToHex, type CompileResult } from "./compiler";

/** Nom logique d’un port GPIO ATmega328P exposé au canvas. */
export type AvrGpioPortName = "B" | "C" | "D";

/** Listener appelé à chaque changement d’état d’un port d’une carte. */
export type AvrGpioListener = (
    port: AVRIOPort,
    portName: AvrGpioPortName,
    figureId: string,
) => void;

/** Emplacement firmware / runner pour une instance MCU sur le canvas. */
type BoardSlot = {
    figureId: string;
    /** Runner prêt à démarrer (après compile/load), pas encore `run`. */
    loadingRunner?: AVRRunner;
    /** Runner actif (après `run`). */
    runner?: AVRRunner;
    /** Runner déjà câblé avec les listeners GPIO. */
    hardwareRunner?: AVRRunner;
};

/**
 * Gestionnaire de simulation AVR multi-cartes (sans UI).
 */
export class EmulatorManager {
    private readonly boards = new Map<string, BoardSlot>();
    private readonly gpioListeners = new Set<AvrGpioListener>();

    /**
     * Compile un sketch sans le charger.
     * @param code - Source Arduino.
     */
    static async compileCode(code: string): Promise<CompileResult> {
        return compileToHex(code);
    }

    /**
     * Compile puis prépare un runner pour une carte (pas encore démarré).
     * @param figureId - Id draw2d de la figure MCU.
     * @param code - Source Arduino.
     */
    async compileAndLoadBoard(figureId: string, code: string): Promise<CompileResult> {
        const data = await compileToHex(code);
        if (data.hex?.trim()) {
            this.loadCodeForBoard(figureId, data.hex);
        } else {
            const slot = this.ensureSlot(figureId);
            slot.loadingRunner = undefined;
        }
        return data;
    }

    /**
     * @deprecated Préférer {@link compileAndLoadBoard}. Conserve un slot `"default"`.
     * @param code - Source Arduino.
     */
    async compileAndLoadCode(code: string): Promise<CompileResult> {
        return this.compileAndLoadBoard("default", code);
    }

    /**
     * Prépare un runner à partir d’un Intel HEX pour une carte.
     * @param figureId - Id draw2d de la figure MCU.
     * @param hexCode - Firmware Intel HEX.
     */
    loadCodeForBoard(figureId: string, hexCode: string): void {
        const slot = this.ensureSlot(figureId);
        slot.loadingRunner = new AVRRunner(hexCode);
    }

    /**
     * @deprecated Préférer {@link loadCodeForBoard}.
     * @param hexCode - Firmware Intel HEX.
     */
    loadCode(hexCode: string): void {
        this.loadCodeForBoard("default", hexCode);
    }

    /**
     * Démarre (ou redémarre) toutes les cartes qui ont un firmware chargé.
     * @throws Si aucune carte n’a de firmware.
     */
    run(): void {
        const runnable = [...this.boards.values()].filter(
            (s) => s.loadingRunner || s.runner,
        );
        if (runnable.length === 0) {
            throw new Error("Aucun firmware chargé. Compilez au moins une carte d’abord.");
        }

        // Stoppe d’abord toutes les boucles, puis (re)démarre chaque slot.
        for (const slot of this.boards.values()) {
            slot.runner?.stop();
        }

        for (const slot of runnable) {
            slot.runner = slot.loadingRunner ?? slot.runner;
            slot.loadingRunner = undefined;
            if (!slot.runner) continue;
            if (slot.hardwareRunner !== slot.runner) {
                this.setupHardware(slot.runner, slot.figureId);
                slot.hardwareRunner = slot.runner;
            }
            slot.runner.execute(() => {
                /* tick UI libre — GPIO via listeners de port */
            });
        }
    }

    /**
     * Pause / reprise de toutes les cartes en cours.
     * @param pause - `true` pour geler les CPU.
     */
    setPaused(pause: boolean): void {
        for (const slot of this.boards.values()) {
            if (slot.runner) slot.runner.pause = pause;
        }
    }

    /** `true` si aucune carte en cours, ou toutes en pause. */
    isPaused(): boolean {
        const active = [...this.boards.values()].filter((s) => s.runner);
        if (active.length === 0) return true;
        return active.every((s) => s.runner!.pause);
    }

    /** Arrête toutes les boucles CPU (conserve les firmwares chargés). */
    stop(): void {
        for (const slot of this.boards.values()) {
            slot.runner?.stop();
        }
    }

    /**
     * Indique si au moins une carte a un firmware prêt à tourner.
     * @param figureId - Si fourni, teste uniquement cette carte.
     */
    hasFirmware(figureId?: string): boolean {
        if (figureId !== undefined) {
            const slot = this.boards.get(figureId);
            return Boolean(slot?.loadingRunner || slot?.runner);
        }
        for (const slot of this.boards.values()) {
            if (slot.loadingRunner || slot.runner) return true;
        }
        return false;
    }

    /** Nombre de cartes avec firmware chargé. */
    get firmwareBoardCount(): number {
        let n = 0;
        for (const slot of this.boards.values()) {
            if (slot.loadingRunner || slot.runner) n += 1;
        }
        return n;
    }

    /**
     * Runner actif d’une carte, ou premier runner (compat mono-carte).
     * @param figureId - Id optionnel.
     */
    getRunner(figureId?: string): AVRRunner | undefined {
        if (figureId !== undefined) return this.boards.get(figureId)?.runner;
        for (const slot of this.boards.values()) {
            if (slot.runner) return slot.runner;
        }
        return undefined;
    }

    /** @deprecated Utiliser {@link getRunner}. */
    get activeRunner(): AVRRunner | undefined {
        return this.getRunner();
    }

    /** Runners en cours d’exécution, indexés par `figureId`. */
    getActiveRunners(): ReadonlyMap<string, AVRRunner> {
        const map = new Map<string, AVRRunner>();
        for (const [id, slot] of this.boards) {
            if (slot.runner) map.set(id, slot.runner);
        }
        return map;
    }

    /**
     * Retire le slot d’une figure (ex. suppression sur le canvas).
     * @param figureId - Id draw2d.
     */
    removeBoard(figureId: string): void {
        const slot = this.boards.get(figureId);
        if (!slot) return;
        slot.runner?.stop();
        this.boards.delete(figureId);
    }

    /**
     * S’abonne aux changements GPIO (ports B, C, D) de toutes les cartes.
     * @param listener - Callback port + nom + figureId.
     * @returns Fonction de désabonnement.
     */
    onGpio(listener: AvrGpioListener): () => void {
        this.gpioListeners.add(listener);
        return () => {
            this.gpioListeners.delete(listener);
        };
    }

    private ensureSlot(figureId: string): BoardSlot {
        let slot = this.boards.get(figureId);
        if (!slot) {
            slot = { figureId };
            this.boards.set(figureId, slot);
        }
        return slot;
    }

    private setupHardware(runner: AVRRunner, figureId: string): void {
        const notify = (port: AVRIOPort, portName: AvrGpioPortName) => {
            for (const listener of this.gpioListeners) {
                listener(port, portName, figureId);
            }
        };
        runner.portB.addListener(() => notify(runner.portB, "B"));
        runner.portC.addListener(() => notify(runner.portC, "C"));
        runner.portD.addListener(() => notify(runner.portD, "D"));
    }
}
