/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Instantané des broches GPIO / ADC d’un `AVRRunner` (panneau debug).
 *
 * Responsabilités :
 * - Mapper PORTB/C/D → libellés Arduino Uno (D0–D13, A0–A5)
 * - Exposer l’état PinState + canaux ADC en volts
 */
import { PinState } from "avr8js";
import type { AVRRunner } from "./avr-runner";
import type { AvrGpioPortName } from "./emulator-manager";

/** État textuel d’une broche pour l’UI / l’API hôte. */
export type SimPinLevel = "Low" | "High" | "Input" | "InputPullUp";

/** Instantané d’une broche digitale Uno. */
export type SimDigitalPinSnapshot = {
    /** Libellé silk Arduino (`D13`, `A0`, …). */
    label: string;
    port: AvrGpioPortName;
    bit: number;
    state: SimPinLevel;
};

/** Instantané d’un canal ADC (A0–A5). */
export type SimAdcChannelSnapshot = {
    /** Libellé (`A0`…`A5`). */
    label: string;
    channel: number;
    /** Tension injectée (0–5 V). */
    volts: number;
};

/** Instantané complet d’une carte en simulation. */
export type SimBoardPinSnapshot = {
    figureId: string;
    /** Compteur de cycles CPU. */
    cycles: number;
    /** Program counter (mot flash). */
    pc: number;
    paused: boolean;
    digital: SimDigitalPinSnapshot[];
    adc: SimAdcChannelSnapshot[];
};

/** Correspondance bit de port → libellé Uno. */
const UNO_LABELS: Record<AvrGpioPortName, string[]> = {
    D: ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"],
    B: ["D8", "D9", "D10", "D11", "D12", "D13"],
    C: ["A0", "A1", "A2", "A3", "A4", "A5"],
};

/**
 * Convertit un `PinState` avr8js en libellé stable.
 * @param state - État du périphérique GPIO.
 */
export function pinStateToLabel(state: PinState): SimPinLevel {
    switch (state) {
        case PinState.High:
            return "High";
        case PinState.Low:
            return "Low";
        case PinState.InputPullUp:
            return "InputPullUp";
        default:
            return "Input";
    }
}

/**
 * Construit l’instantané GPIO/ADC d’un runner.
 * @param figureId - Id draw2d de la carte.
 * @param runner - Runner AVR actif.
 */
export function snapshotBoardPins(figureId: string, runner: AVRRunner): SimBoardPinSnapshot {
    const digital: SimDigitalPinSnapshot[] = [];
    appendPort(digital, "D", runner.portD);
    appendPort(digital, "B", runner.portB);
    appendPort(digital, "C", runner.portC);

    const adc: SimAdcChannelSnapshot[] = [];
    for (let ch = 0; ch < 6; ch++) {
        const volts = Number(runner.adc.channelValues[ch] ?? 0);
        adc.push({
            label: `A${ch}`,
            channel: ch,
            volts: Number.isFinite(volts) ? volts : 0,
        });
    }

    return {
        figureId,
        cycles: runner.cpu.cycles,
        pc: runner.cpu.pc,
        paused: runner.pause,
        digital,
        adc,
    };
}

function appendPort(
    out: SimDigitalPinSnapshot[],
    portName: AvrGpioPortName,
    port: AVRRunner["portB"],
): void {
    const labels = UNO_LABELS[portName];
    for (let bit = 0; bit < labels.length; bit++) {
        out.push({
            label: labels[bit],
            port: portName,
            bit,
            state: pinStateToLabel(port.pinState(bit)),
        });
    }
}
