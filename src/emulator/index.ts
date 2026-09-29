/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Point d’entrée du module de simulation AVR.
 *
 * Responsabilités :
 * - Ré-exporter l’API publique (`EmulatorManager`, `AVRRunner`, compile, bridge)
 */
export { AVRRunner } from "./avr-runner";
export {
    isUnoBuiltinLedPin,
    normalizeUnoPinKey,
    resolveUnoAvrPin,
} from "./avr-uno-pins";
export type { AvrPinRef } from "./avr-uno-pins";
export { compileToHex } from "./compiler";
export type { CompileResult } from "./compiler";
export { EmulatorManager } from "./emulator-manager";
export type { AvrGpioListener, AvrGpioPortName } from "./emulator-manager";
export { parseAvrHex } from "./intel-hex";
export type { ParsedAvrHex } from "./intel-hex";
export { SimulationBridge } from "./simulation-bridge";
export { DEFAULT_MCU_SKETCH } from "./default-sketch";
export type {
    CompileBoardOptions,
    PushSketchOptions,
    PushSketchResult,
    SimulatableBoardRef,
} from "./simulation-host-types";
