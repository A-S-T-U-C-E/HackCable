/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Pont GPIO/ADC avr8js ↔ overlays Wokwi (LED, boutons, buzzer, RGB…).
 *
 * Responsabilités :
 * - Netlist MCU → bindings par type de composant
 * - Sorties : LED, LED13, RGB, buzzer, 7-seg, barre LED, servo, NeoPixel (approx.)
 * - Entrées : boutons, switch, DIP, joystick, pot, KY040 (SW), capteurs cliquables
 */
import { PinState, type AVRIOPort } from "avr8js";
import type { Editor } from "../editor/editor";
import { ComponentFigure } from "../editor/component-figure";
import { collectPeerConnections, type PortLike } from "../editor/mcu-pin/port-connections";
import {
    AnalogJoystickElement,
    BigSoundSensorElement,
    BuzzerElement,
    DipSwitch8Element,
    FlameSensorElement,
    GasSensorElement,
    KY040Element,
    LEDElement,
    LedBarGraphElement,
    NeoPixelElement,
    PhotoresistorSensorElement,
    PotentiometerElement,
    Pushbutton6mmElement,
    PushbuttonElement,
    ResistorElement,
    RGBLedElement,
    ServoElement,
    SevenSegmentElement,
    SlidePotentiometerElement,
    SlideSwitchElement,
    SmallSoundSensorElement,
} from "@wokwi/elements";
import {
    isMicrocontrollerBoard,
    isWokwiComponent,
} from "../panels/component";
import { isUnoBuiltinLedPin, normalizeUnoPinKey, resolveUnoAvrPin, type AvrPinRef } from "./avr-uno-pins";
import type { AvrGpioPortName, EmulatorManager } from "./emulator-manager";
import type { AVRRunner } from "./avr-runner";

type DigitalOutBinding = {
    kind: "digital-out";
    /** Propriété booléenne ou numérique (0/1) sur l’overlay. */
    prop: string;
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    activeLow: boolean;
    figureId: string;
};

type RgbBinding = {
    kind: "rgb";
    channel: "ledRed" | "ledGreen" | "ledBlue";
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    figureId: string;
};

type SegmentBinding = {
    kind: "segment";
    /** Index dans `values[]` (7-seg ou barre LED). */
    index: number;
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    activeLow: boolean;
    figureId: string;
};

type ServoBinding = {
    kind: "servo";
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    figureId: string;
};

type NeoPixelBinding = {
    kind: "neopixel";
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    figureId: string;
};

type OutputBinding =
    | DigitalOutBinding
    | RgbBinding
    | SegmentBinding
    | ServoBinding
    | NeoPixelBinding;

type DigitalInBinding = {
    kind: "digital-in";
    mode: "button" | "switch" | "dip" | "toggle" | "encoder-sw";
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    figureId: string;
    overlay: HTMLElement;
    /** Index 0–7 pour DipSwitch8. */
    dipIndex?: number;
    /** État local pour capteurs cliquables. */
    toggled?: boolean;
    /** LED visuelle optionnelle sur le module capteur. */
    ledProp?: string;
    onPress?: () => void;
    onRelease?: () => void;
    onToggleClick?: (ev: Event) => void;
};

type AnalogInBinding = {
    kind: "analog-in";
    mode: "pot" | "joystick-x" | "joystick-y";
    mcuFigureId: string;
    /** Canal ADC ATmega328P (0–5 pour A0–A5). */
    adcChannel: number;
    figureId: string;
    overlay: HTMLElement;
};

/**
 * Relie l’émulateur AVR multi-cartes au canvas HackCable (overlays Wokwi).
 */
export class SimulationBridge {
    private gpioUnsub: (() => void) | undefined;
    private pinsUnsub: (() => void) | undefined;
    private outputBindings: OutputBinding[] = [];
    private digitalIns: DigitalInBinding[] = [];
    private analogIns: AnalogInBinding[] = [];
    private attached = false;
    private inputPollTimer: ReturnType<typeof setInterval> | undefined;

    /**
     * @param editor - Éditeur (figures + table MCU).
     * @param emulator - Gestionnaire de simulation multi-cartes.
     */
    constructor(
        private readonly editor: Editor,
        private readonly emulator: EmulatorManager,
    ) {}

    /** `true` si le pont écoute actuellement les GPIO. */
    get isAttached(): boolean {
        return this.attached;
    }

    /**
     * Active le pont (après `emulator.run()`).
     * Reconstruit la netlist et s’abonne aux changements de câblage.
     */
    attach(): void {
        this.detach();
        this.rebuildBindings();
        this.gpioUnsub = this.emulator.onGpio((port, portName, mcuFigureId) => {
            this.applyPortOutputs(port, portName, mcuFigureId);
        });
        this.pinsUnsub = this.editor.onMcuPinTableChange(() => {
            this.rebuildBindings();
            this.syncAll();
        });
        this.inputPollTimer = setInterval(() => this.syncInputsOnly(), 50);
        this.attached = true;
        this.editor.canvas.setSimulationInteractionMode(true);
        this.syncAll();
    }

    /** Coupe les abonnements et éteint les overlays pilotés. */
    detach(): void {
        this.gpioUnsub?.();
        this.gpioUnsub = undefined;
        this.pinsUnsub?.();
        this.pinsUnsub = undefined;
        if (this.inputPollTimer !== undefined) {
            clearInterval(this.inputPollTimer);
            this.inputPollTimer = undefined;
        }
        this.clearDigitalInListeners();
        this.resetDrivenOverlays();
        this.outputBindings = [];
        this.digitalIns = [];
        this.analogIns = [];
        this.attached = false;
        this.editor.canvas.setSimulationInteractionMode(false);
    }

    /** Applique l’état courant de tous les runners actifs. */
    syncAll(): void {
        for (const [mcuFigureId, runner] of this.emulator.getActiveRunners()) {
            this.applyPortOutputs(runner.portB, "B", mcuFigureId);
            this.applyPortOutputs(runner.portC, "C", mcuFigureId);
            this.applyPortOutputs(runner.portD, "D", mcuFigureId);
            this.syncDigitalIns(runner, mcuFigureId);
            this.syncAnalogIns(runner, mcuFigureId);
        }
    }

    private syncInputsOnly(): void {
        for (const [mcuFigureId, runner] of this.emulator.getActiveRunners()) {
            this.syncDigitalIns(runner, mcuFigureId);
            this.syncAnalogIns(runner, mcuFigureId);
        }
    }

    private rebuildBindings(): void {
        this.clearDigitalInListeners();
        this.outputBindings = [];
        this.digitalIns = [];
        this.analogIns = [];

        const table = this.editor.getMcuPinConnectionTable();
        const seen = new Set<string>();

        for (const board of table) {
            if (!this.getFigure(board.figureId)) continue;

            for (const pin of board.pins) {
                const avr = resolveUnoAvrPin(pin.pinKey);
                if (!avr) continue;

                if (isUnoBuiltinLedPin(pin.pinKey)) {
                    const key = `${board.figureId}|led13`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        this.outputBindings.push({
                            kind: "digital-out",
                            prop: "led13",
                            mcuFigureId: board.figureId,
                            port: avr.port,
                            bit: avr.bit,
                            activeLow: false,
                            figureId: board.figureId,
                        });
                    }
                }

                const adcChannel = analogChannelFromPinKey(pin.pinKey);

                for (const peer of pin.connections) {
                    this.collectEndpointBindings(
                        board.figureId,
                        peer.peerFigureId,
                        peer.peerPortKey,
                        avr,
                        adcChannel,
                        seen,
                        new Set([board.figureId]),
                    );
                }
            }
        }

        this.wireDigitalInListeners();
        this.markHitTargets();
    }

    /** Active les clics uniquement sur les overlays d’entrée. */
    private markHitTargets(): void {
        const hitIds = new Set<string>();
        for (const din of this.digitalIns) hitIds.add(din.figureId);
        for (const ain of this.analogIns) hitIds.add(ain.figureId);
        const figures = this.editor.canvas.getFigures?.()?.data ?? [];
        for (const fig of figures) {
            if (!(fig instanceof ComponentFigure)) continue;
            fig.setSimulationHitTarget(hitIds.has(String(fig.getId())));
        }
    }

    private collectEndpointBindings(
        mcuFigureId: string,
        figureId: string,
        portKey: string,
        avr: AvrPinRef,
        adcChannel: number | undefined,
        seen: Set<string>,
        visitedFigures: Set<string>,
    ): void {
        if (visitedFigures.has(figureId)) return;
        visitedFigures.add(figureId);

        const figure = this.getFigure(figureId);
        if (!figure) return;
        const info = figure.getComponentInfo();
        if (isMicrocontrollerBoard(info) || !isWokwiComponent(info)) return;

        const clasz = info.clasz;
        const overlay = figure.getOverlayElement();
        const pk = portKey.trim().toUpperCase();

        if (clasz === LEDElement) {
            const key = `${mcuFigureId}|${figureId}|led`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "digital-out",
                prop: "value",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                activeLow: isCathodePort(pk),
                figureId,
            });
            return;
        }

        if (clasz === BuzzerElement) {
            const key = `${mcuFigureId}|${figureId}|buzzer`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "digital-out",
                prop: "hasSignal",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                activeLow: false,
                figureId,
            });
            return;
        }

        if (clasz === RGBLedElement) {
            const channel = rgbChannelFromPort(pk);
            if (!channel) return;
            const key = `${mcuFigureId}|${figureId}|rgb|${channel}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "rgb",
                channel,
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
            });
            return;
        }

        if (clasz === SevenSegmentElement) {
            const index = sevenSegIndexFromPort(pk);
            if (index < 0) return;
            const key = `${mcuFigureId}|${figureId}|7seg|${index}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "segment",
                index,
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                activeLow: false,
                figureId,
            });
            return;
        }

        if (clasz === LedBarGraphElement) {
            const index = ledBarIndexFromPort(pk);
            if (index < 0) return;
            const key = `${mcuFigureId}|${figureId}|bar|${index}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "segment",
                index,
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                activeLow: isCathodePort(pk) || pk.startsWith("C"),
                figureId,
            });
            return;
        }

        if (clasz === ServoElement) {
            if (pk !== "PWM") return;
            const key = `${mcuFigureId}|${figureId}|servo`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "servo",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
            });
            return;
        }

        if (clasz === NeoPixelElement) {
            if (pk !== "DIN" && pk !== "DI" && pk !== "IN") return;
            const key = `${mcuFigureId}|${figureId}|neo`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "neopixel",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
            });
            return;
        }

        if (clasz === PushbuttonElement || clasz === Pushbutton6mmElement) {
            const key = `${mcuFigureId}|${figureId}|btn|${avr.port}${avr.bit}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "button",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
                overlay,
                onPress: () => this.setExternalPin(mcuFigureId, avr, false),
                onRelease: () => this.setExternalPin(mcuFigureId, avr, true),
            });
            return;
        }

        if (clasz === SlideSwitchElement) {
            const key = `${mcuFigureId}|${figureId}|sw|${avr.port}${avr.bit}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "switch",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
                overlay,
            });
            return;
        }

        if (clasz === DipSwitch8Element) {
            const dipIndex = dipIndexFromPort(pk);
            if (dipIndex < 0) return;
            const key = `${mcuFigureId}|${figureId}|dip|${dipIndex}|${avr.port}${avr.bit}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "dip",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
                overlay,
                dipIndex,
            });
            return;
        }

        if (clasz === KY040Element) {
            if (pk !== "SW") return;
            const key = `${mcuFigureId}|${figureId}|ky040sw|${avr.port}${avr.bit}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "encoder-sw",
                mcuFigureId,
                port: avr.port,
                bit: avr.bit,
                figureId,
                overlay,
            });
            return;
        }

        if (clasz === AnalogJoystickElement) {
            if (pk === "SEL") {
                const key = `${mcuFigureId}|${figureId}|joy-sel|${avr.port}${avr.bit}`;
                if (seen.has(key)) return;
                seen.add(key);
                this.digitalIns.push({
                    kind: "digital-in",
                    mode: "button",
                    mcuFigureId,
                    port: avr.port,
                    bit: avr.bit,
                    figureId,
                    overlay,
                });
                return;
            }
            if (adcChannel === undefined) return;
            if (pk !== "VERT" && pk !== "HORZ" && pk !== "VRX" && pk !== "VRY") return;
            const mode = pk === "HORZ" || pk === "VRX" ? "joystick-x" : "joystick-y";
            const key = `${mcuFigureId}|${figureId}|joy|${mode}|${adcChannel}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.analogIns.push({
                kind: "analog-in",
                mode,
                mcuFigureId,
                adcChannel,
                figureId,
                overlay,
            });
            return;
        }

        if (clasz === PotentiometerElement || clasz === SlidePotentiometerElement) {
            if (adcChannel === undefined) return;
            // Broche signal (pas GND/VCC)
            if (pk !== "SIG" && pk !== "OUT" && pk !== "WIPER" && pk !== "AO" && pk !== "AOUT") return;
            const key = `${mcuFigureId}|${figureId}|pot|${adcChannel}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.analogIns.push({
                kind: "analog-in",
                mode: "pot",
                mcuFigureId,
                adcChannel,
                figureId,
                overlay,
            });
            return;
        }

        // Capteurs modules : clic = bascule DO/DOUT ; AO → ADC si câblé
        const sensor = sensorProfile(clasz);
        if (sensor) {
            if (sensor.analogPins.includes(pk) && adcChannel !== undefined) {
                const key = `${mcuFigureId}|${figureId}|sensor-ao|${adcChannel}`;
                if (seen.has(key)) return;
                seen.add(key);
                this.analogIns.push({
                    kind: "analog-in",
                    mode: "pot",
                    mcuFigureId,
                    adcChannel,
                    figureId,
                    overlay,
                });
                // Capteur sans pot natif : on stocke un faux value 0–100 sur l’élément
                const el = overlay as { value?: number; min?: number; max?: number };
                if (el.value === undefined) {
                    el.min = 0;
                    el.max = 100;
                    el.value = 50;
                }
                return;
            }
            if (sensor.digitalPins.includes(pk)) {
                const key = `${mcuFigureId}|${figureId}|sensor-do|${avr.port}${avr.bit}`;
                if (seen.has(key)) return;
                seen.add(key);
                this.digitalIns.push({
                    kind: "digital-in",
                    mode: "toggle",
                    mcuFigureId,
                    port: avr.port,
                    bit: avr.bit,
                    figureId,
                    overlay,
                    toggled: false,
                    ledProp: sensor.ledProp,
                });
                return;
            }
            return;
        }

        if (clasz === ResistorElement) {
            for (const port of figure.getHybridPorts()) {
                const localKey = String((port as PortLike).getLocator?.()?.portId ?? "");
                if (!localKey || localKey === portKey) continue;
                for (const next of collectPeerConnections(port as PortLike)) {
                    this.collectEndpointBindings(
                        mcuFigureId,
                        next.peerFigureId,
                        next.peerPortKey,
                        avr,
                        adcChannel,
                        seen,
                        visitedFigures,
                    );
                }
            }
        }
    }

    private applyPortOutputs(
        port: AVRIOPort,
        portName: AvrGpioPortName,
        mcuFigureId: string,
    ): void {
        for (const binding of this.outputBindings) {
            if (binding.mcuFigureId !== mcuFigureId || binding.port !== portName) continue;
            const high = isPinDrivenHigh(port.pinState(binding.bit));

            if (binding.kind === "digital-out") {
                const on = binding.activeLow ? !high : high;
                const el = this.getOverlay(binding.figureId) as Record<string, unknown> | null;
                if (el) el[binding.prop] = on;
                continue;
            }

            if (binding.kind === "rgb") {
                const el = this.getOverlay(binding.figureId) as Record<string, number> | null;
                if (el) el[binding.channel] = high ? 1 : 0;
                continue;
            }

            if (binding.kind === "segment") {
                const el = this.getOverlay(binding.figureId) as { values?: number[] } | null;
                if (!el) continue;
                const values = el.values ? [...el.values] : [];
                while (values.length <= binding.index) values.push(0);
                values[binding.index] = (binding.activeLow ? !high : high) ? 1 : 0;
                el.values = values;
                continue;
            }

            if (binding.kind === "servo") {
                const el = this.getOverlay(binding.figureId) as { angle?: number } | null;
                // Approximation sans décodeur PWM : HIGH → 90°, LOW → 0°.
                if (el) el.angle = high ? 90 : 0;
                continue;
            }

            if (binding.kind === "neopixel") {
                const el = this.getOverlay(binding.figureId) as { r?: number; g?: number; b?: number } | null;
                // Approximation sans protocole WS2812 : DIN HIGH → blanc, LOW → off.
                if (!el) continue;
                const v = high ? 255 : 0;
                el.r = v;
                el.g = v;
                el.b = v;
            }
        }
    }

    private syncDigitalIns(runner: AVRRunner, mcuFigureId: string): void {
        for (const din of this.digitalIns) {
            if (din.mcuFigureId !== mcuFigureId) continue;
            const port = portByName(runner, din.port);
            if (din.mode === "button") {
                const pressed = Boolean((din.overlay as { pressed?: boolean }).pressed);
                port.setPin(din.bit, !pressed);
                continue;
            }
            if (din.mode === "encoder-sw") {
                const pressed = Boolean((din.overlay as { pressed?: boolean }).pressed);
                port.setPin(din.bit, !pressed);
                continue;
            }
            if (din.mode === "switch") {
                const value = Number((din.overlay as { value?: number }).value ?? 0);
                port.setPin(din.bit, value === 0);
                continue;
            }
            if (din.mode === "dip") {
                const values = (din.overlay as { values?: number[] }).values ?? [];
                const on = Number(values[din.dipIndex ?? 0] ?? 0) !== 0;
                port.setPin(din.bit, !on);
                continue;
            }
            if (din.mode === "toggle") {
                const active = Boolean(din.toggled);
                port.setPin(din.bit, !active);
                if (din.ledProp) {
                    (din.overlay as unknown as Record<string, unknown>)[din.ledProp] = active;
                }
            }
        }
    }

    private syncAnalogIns(runner: AVRRunner, mcuFigureId: string): void {
        for (const ain of this.analogIns) {
            if (ain.mcuFigureId !== mcuFigureId) continue;
            const el = ain.overlay as {
                value?: number;
                min?: number;
                max?: number;
                xValue?: number;
                yValue?: number;
            };

            let volts = 0;
            if (ain.mode === "joystick-x") {
                const x = Number(el.xValue ?? 0.5);
                volts = Math.min(5, Math.max(0, x * 5));
            } else if (ain.mode === "joystick-y") {
                const y = Number(el.yValue ?? 0.5);
                volts = Math.min(5, Math.max(0, y * 5));
            } else {
                const min = Number(el.min ?? 0);
                const max = Number(el.max ?? 100);
                const value = Number(el.value ?? min);
                const span = max - min || 1;
                volts = Math.min(5, Math.max(0, ((value - min) / span) * 5));
            }
            runner.adc.channelValues[ain.adcChannel] = volts;
        }
    }

    private setExternalPin(mcuFigureId: string, avr: AvrPinRef, value: boolean): void {
        const runner = this.emulator.getRunner(mcuFigureId);
        if (!runner) return;
        portByName(runner, avr.port).setPin(avr.bit, value);
    }

    private wireDigitalInListeners(): void {
        for (const din of this.digitalIns) {
            if (din.mode === "button" && din.onPress && din.onRelease) {
                din.overlay.addEventListener("button-press", din.onPress);
                din.overlay.addEventListener("button-release", din.onRelease);
                const pressed = Boolean((din.overlay as { pressed?: boolean }).pressed);
                this.setExternalPin(din.mcuFigureId, { port: din.port, bit: din.bit }, !pressed);
                continue;
            }
            if (din.mode === "toggle") {
                din.onToggleClick = (ev: Event) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    din.toggled = !din.toggled;
                    // Cycle aussi la valeur analogique stockée (capteurs AO).
                    const el = din.overlay as { value?: number };
                    if (typeof el.value === "number") {
                        el.value = din.toggled ? 90 : 10;
                    }
                };
                din.overlay.addEventListener("click", din.onToggleClick);
            }
        }
    }

    private clearDigitalInListeners(): void {
        for (const din of this.digitalIns) {
            if (din.onPress) din.overlay.removeEventListener("button-press", din.onPress);
            if (din.onRelease) din.overlay.removeEventListener("button-release", din.onRelease);
            if (din.onToggleClick) din.overlay.removeEventListener("click", din.onToggleClick);
        }
    }

    private resetDrivenOverlays(): void {
        for (const binding of this.outputBindings) {
            const el = this.getOverlay(binding.figureId) as Record<string, unknown> | null;
            if (!el) continue;
            if (binding.kind === "digital-out") {
                el[binding.prop] = false;
            } else if (binding.kind === "rgb") {
                el[binding.channel] = 0;
            } else if (binding.kind === "segment" && Array.isArray(el.values)) {
                const values = [...(el.values as number[])];
                if (binding.index < values.length) {
                    values[binding.index] = 0;
                    el.values = values;
                }
            } else if (binding.kind === "servo") {
                el.angle = 0;
            } else if (binding.kind === "neopixel") {
                el.r = 0;
                el.g = 0;
                el.b = 0;
            }
        }
        for (const din of this.digitalIns) {
            if (din.ledProp) {
                (din.overlay as unknown as Record<string, unknown>)[din.ledProp] = false;
            }
            din.toggled = false;
        }
    }

    private getFigure(figureId: string): ComponentFigure | undefined {
        const fig = this.editor.canvas.getFigure(figureId);
        return fig instanceof ComponentFigure ? fig : undefined;
    }

    private getOverlay(figureId: string): HTMLElement | null {
        return this.getFigure(figureId)?.getOverlayElement() ?? null;
    }
}

function isPinDrivenHigh(state: PinState): boolean {
    return state === PinState.High;
}

function portByName(runner: AVRRunner, name: AvrGpioPortName): AVRIOPort {
    if (name === "B") return runner.portB;
    if (name === "C") return runner.portC;
    return runner.portD;
}

function isCathodePort(portKey: string): boolean {
    const k = portKey.trim().toUpperCase();
    return k === "C" || k === "K" || k === "CATHODE" || /^C\d+$/.test(k);
}

function rgbChannelFromPort(pk: string): "ledRed" | "ledGreen" | "ledBlue" | undefined {
    if (pk === "R" || pk === "RED") return "ledRed";
    if (pk === "G" || pk === "GREEN") return "ledGreen";
    if (pk === "B" || pk === "BLUE") return "ledBlue";
    return undefined;
}

function sevenSegIndexFromPort(pk: string): number {
    const map: Record<string, number> = {
        A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, DP: 7,
    };
    return map[pk] ?? -1;
}

function ledBarIndexFromPort(pk: string): number {
    const m = /^[AC](\d+)$/.exec(pk);
    if (!m) return -1;
    const n = Number(m[1]);
    return n >= 1 && n <= 10 ? n - 1 : -1;
}

/** Canal ADC pour A0–A5 (et aliases). */
function analogChannelFromPinKey(pinKey: string): number | undefined {
    const key = normalizeUnoPinKey(pinKey);
    if (!key) return undefined;
    const m = /^A([0-5])$/i.exec(key);
    if (m) return Number(m[1]);
    return undefined;
}

function dipIndexFromPort(pk: string): number {
    const m = /^([1-8])[AB]$/.exec(pk);
    if (!m) return -1;
    return Number(m[1]) - 1;
}

type SensorProfile = {
    digitalPins: string[];
    analogPins: string[];
    ledProp?: string;
};

/** Profils des modules capteurs Wokwi (clic → DO, AO → ADC). */
function sensorProfile(clasz: unknown): SensorProfile | undefined {
    if (clasz === PhotoresistorSensorElement) {
        return { digitalPins: ["DO"], analogPins: ["AO"], ledProp: "ledDO" };
    }
    if (clasz === FlameSensorElement) {
        return { digitalPins: ["DO", "DOUT", "D0"], analogPins: ["AO", "AOUT", "A0"], ledProp: "ledSignal" };
    }
    if (clasz === GasSensorElement) {
        return { digitalPins: ["DO", "DOUT", "D0"], analogPins: ["AO", "AOUT", "A0"], ledProp: "ledD0" };
    }
    if (clasz === BigSoundSensorElement) {
        return { digitalPins: ["DOUT", "DO"], analogPins: ["AOUT", "AO"], ledProp: "led2" };
    }
    if (clasz === SmallSoundSensorElement) {
        return { digitalPins: ["DO", "DOUT"], analogPins: ["AO", "AOUT"], ledProp: "ledSignal" };
    }
    return undefined;
}
