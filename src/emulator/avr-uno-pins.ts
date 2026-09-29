/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Correspondance broches Arduino Uno/Nano (Wokwi) → ports ATmega328P.
 *
 * Responsabilités :
 * - Résoudre `"0"`…`"13"`, `"A0"`…`"A5"` (et aliases `D13`, `13.2`) vers port+bit
 */
import type { AvrGpioPortName } from "./emulator-manager";

/** Localisation d’une GPIO sur l’ATmega328P. */
export type AvrPinRef = {
    port: AvrGpioPortName;
    bit: number;
};

/**
 * Map Wokwi / silk Uno-Nano → port AVR.
 * D0–D7 → PORTD, D8–D13 → PORTB, A0–A5 → PORTC.
 */
const UNO_PIN_MAP: Record<string, AvrPinRef> = {
    "0": { port: "D", bit: 0 },
    "1": { port: "D", bit: 1 },
    "2": { port: "D", bit: 2 },
    "3": { port: "D", bit: 3 },
    "4": { port: "D", bit: 4 },
    "5": { port: "D", bit: 5 },
    "6": { port: "D", bit: 6 },
    "7": { port: "D", bit: 7 },
    "8": { port: "B", bit: 0 },
    "9": { port: "B", bit: 1 },
    "10": { port: "B", bit: 2 },
    "11": { port: "B", bit: 3 },
    "12": { port: "B", bit: 4 },
    "13": { port: "B", bit: 5 },
    A0: { port: "C", bit: 0 },
    A1: { port: "C", bit: 1 },
    A2: { port: "C", bit: 2 },
    A3: { port: "C", bit: 3 },
    A4: { port: "C", bit: 4 },
    A5: { port: "C", bit: 5 },
};

/**
 * Normalise une clé de pastille Wokwi (ex. `13.2`, `D13`, `A0`) vers une entrée de map.
 * @param pinKey - Identifiant draw2d / Wokwi de la broche MCU.
 * @returns Clé canonique ou `undefined` si non GPIO.
 */
export function normalizeUnoPinKey(pinKey: string): string | undefined {
    const raw = pinKey.trim();
    if (!raw) return undefined;

    // Pastilles dupliquées Nano (`13.2`, `A4.2`) → base avant le point.
    const base = raw.includes(".") ? raw.slice(0, raw.indexOf(".")) : raw;

    if (UNO_PIN_MAP[base]) return base;

    const upper = base.toUpperCase();
    if (UNO_PIN_MAP[upper]) return upper;

    // Alias silk « D13 » → « 13 »
    if (/^D\d{1,2}$/i.test(base)) {
        const num = base.slice(1);
        if (UNO_PIN_MAP[num]) return num;
    }

    return undefined;
}

/**
 * Résout une broche Arduino Uno/Nano vers port+bit AVR.
 * @param pinKey - Clé Wokwi (`"13"`, `"A0"`, …).
 * @returns Référence AVR ou `undefined` (GND, 5V, etc.).
 */
export function resolveUnoAvrPin(pinKey: string): AvrPinRef | undefined {
    const key = normalizeUnoPinKey(pinKey);
    return key ? UNO_PIN_MAP[key] : undefined;
}

/** `true` si la broche correspond à la LED intégrée (D13 / PB5). */
export function isUnoBuiltinLedPin(pinKey: string): boolean {
    return normalizeUnoPinKey(pinKey) === "13";
}
