/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Façade simulation HackCable : noyau LibreCircuit + pont overlays draw2d.
 *
 * Responsabilités :
 * - Ré-exporter l’API LibreCircuit pour les intégrateurs existants
 * - Exposer `SimulationBridge` (GPIO, I²C LCD/OLED, HC-SR04, servo, NeoPixel)
 */
export {
    AVRRunner,
    EmulatorManager,
    compileToHex,
    parseAvrHex,
    resolveUnoAvrPin,
    resolveMegaAvrPin,
    resolveAvrBoardPin,
    isUnoBuiltinLedPin,
    isMegaBuiltinLedPin,
    isAvrBuiltinLedPin,
    normalizeUnoPinKey,
    DEFAULT_MCU_SKETCH,
    pinStateToLabel,
    snapshotBoardPins,
} from "librecircuit";
export type {
    AvrBoardVariant,
    AvrGpioListener,
    AvrGpioPortName,
    AvrPinRef,
    CompileBoardOptions,
    CompileResult,
    ParsedAvrHex,
    PushSketchOptions,
    PushSketchResult,
    SimulatableBoardRef,
    SimAdcChannelSnapshot,
    SimBoardPinSnapshot,
    SimDigitalPinSnapshot,
    SimPinLevel,
} from "librecircuit";
export { SimulationBridge } from "./simulation-bridge";
