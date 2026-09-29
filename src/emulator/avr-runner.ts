/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Exécution ATmega328P dans le navigateur via avr8js.
 *
 * Responsabilités :
 * - Charger un Intel HEX en flash
 * - Faire tourner CPU + timers + ports B/C/D + USART0 + ADC
 * - Tranches de cycles non bloquantes, calées sur le temps réel (16 MHz)
 */
import {
    AVRTimer,
    AVRIOPort,
    AVRUSART,
    AVRADC,
    CPU,
    adcConfig,
    avrInstruction,
    portBConfig,
    portCConfig,
    portDConfig,
    timer0Config,
    timer1Config,
    timer2Config,
    usart0Config,
} from "avr8js";
import { parseAvrHex } from "./intel-hex";
import { MicroTaskScheduler } from "./micro-task-scheduler";

/** Taille flash ATmega328P (mots 16 bits). */
const FLASH_WORDS = 0x8000;

/**
 * Runner CPU AVR8 (Uno / Nano compatibles ATmega328P).
 *
 * Les cycles sont calés sur le temps mur (`performance.now`) pour qu’un
 * `delay(500)` dure ~500 ms à l’écran, et non « aussi vite que le CPU le peut ».
 */
export class AVRRunner {
    readonly program: Uint16Array;
    readonly cpu: CPU;
    readonly timer0: AVRTimer;
    readonly timer1: AVRTimer;
    readonly timer2: AVRTimer;
    readonly portB: AVRIOPort;
    readonly portC: AVRIOPort;
    readonly portD: AVRIOPort;
    readonly usart: AVRUSART;
    readonly adc: AVRADC;
    /** Fréquence simulée ATmega328P (Hz). */
    readonly speed = 16e6;
    /** Budget max de cycles par tranche (~1 frame à 60 Hz). */
    readonly workUnitCycles = Math.floor(16e6 / 60);
    readonly taskScheduler = new MicroTaskScheduler();

    private tickCallback: ((cpu: CPU) => void) | null = null;
    /** Horloge mur au dernier point de sync (ms). */
    private syncWallMs = 0;
    /** Compteur de cycles CPU au dernier point de sync. */
    private syncCpuCycles = 0;
    private throttleTimer: ReturnType<typeof setTimeout> | undefined;

    /**
     * @param hex - Firmware Intel HEX (sketch Arduino compilé).
     */
    constructor(hex: string) {
        const { data } = parseAvrHex(hex);
        this.program = new Uint16Array(FLASH_WORDS);
        const words = new Uint16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
        this.program.set(words.subarray(0, FLASH_WORDS));

        this.cpu = new CPU(this.program);
        this.timer0 = new AVRTimer(this.cpu, timer0Config);
        this.timer1 = new AVRTimer(this.cpu, timer1Config);
        this.timer2 = new AVRTimer(this.cpu, timer2Config);
        this.portB = new AVRIOPort(this.cpu, portBConfig);
        this.portC = new AVRIOPort(this.cpu, portCConfig);
        this.portD = new AVRIOPort(this.cpu, portDConfig);
        this.usart = new AVRUSART(this.cpu, usart0Config, this.speed);
        this.adc = new AVRADC(this.cpu, adcConfig);
        this.taskScheduler.start();
    }

    /**
     * Lance (ou reprend) la boucle d’exécution.
     * @param callback - Appelé après chaque tranche de `workUnitCycles`.
     */
    execute(callback: (cpu: CPU) => void): void {
        this.tickCallback = callback;
        if (this.taskScheduler.stopped) {
            this.taskScheduler.start();
        }
        this.resetTimingSync();
        this.scheduleNext();
    }

    private resetTimingSync(): void {
        this.clearThrottleTimer();
        this.syncWallMs = performance.now();
        this.syncCpuCycles = this.cpu.cycles;
    }

    private clearThrottleTimer(): void {
        if (this.throttleTimer !== undefined) {
            clearTimeout(this.throttleTimer);
            this.throttleTimer = undefined;
        }
    }

    private scheduleNext(): void {
        const callback = this.tickCallback;
        if (!callback || this.taskScheduler.stopped) return;

        const cyclesToRun = this.cpu.cycles + this.workUnitCycles;
        while (this.cpu.cycles < cyclesToRun) {
            avrInstruction(this.cpu);
            this.cpu.tick();
        }
        callback(this.cpu);

        // Temps simulé écoulé depuis le sync vs temps mur → dormir si on est en avance.
        const wallNow = performance.now();
        const simulatedMs = ((this.cpu.cycles - this.syncCpuCycles) / this.speed) * 1000;
        const wallElapsedMs = wallNow - this.syncWallMs;
        const aheadMs = simulatedMs - wallElapsedMs;

        if (aheadMs > 4) {
            this.throttleTimer = setTimeout(() => {
                this.throttleTimer = undefined;
                this.syncWallMs = performance.now();
                this.syncCpuCycles = this.cpu.cycles;
                if (!this.taskScheduler.stopped && this.tickCallback) {
                    this.taskScheduler.postTask(() => this.scheduleNext());
                }
            }, aheadMs);
            return;
        }

        // Légèrement en retard : resync et enchaîner sans attendre.
        if (aheadMs < -50) {
            this.syncWallMs = wallNow;
            this.syncCpuCycles = this.cpu.cycles;
        }
        this.taskScheduler.postTask(() => this.scheduleNext());
    }

    /** Met en pause (`true`) ou reprend (`false`) l’exécution. */
    set pause(pause: boolean) {
        if (pause && !this.pause) {
            this.clearThrottleTimer();
            this.taskScheduler.stop();
            return;
        }
        if (!pause && this.pause) {
            this.taskScheduler.start();
            this.resetTimingSync();
            if (this.tickCallback) {
                this.scheduleNext();
            }
        }
    }

    get pause(): boolean {
        return this.taskScheduler.stopped;
    }

    /** Arrête définitivement la boucle (jusqu’au prochain `execute`). */
    stop(): void {
        this.tickCallback = null;
        this.clearThrottleTimer();
        this.taskScheduler.stop();
    }
}
