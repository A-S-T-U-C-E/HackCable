/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Pont GPIO/ADC avr8js ↔ overlays Wokwi (LED, boutons, buzzer, RGB…).
 *
 * Responsabilités :
 * - Netlist MCU → bindings par type de composant
 * - Sorties : LED, LED13, RGB, buzzer, 7-seg, barre LED, servo (PWM), NeoPixel / ring / matrix
 * - I²C : LCD1602 / LCD2004 / SSD1306 (adresse configurable) → bus TWI LibreCircuit
 * - HC-SR04 / DHT22 : timing clock-events ; PIR clic
 * - Stepper / keypad / ILI9341 SPI
 * - Entrées : boutons, switch, DIP, joystick, pot, KY040 (SW), capteurs (curseur / molette)
 * - Tilt / HeartBeat / relais / MPU6050 / HX711 / LCD parallèle
 */
import { PinState, type AVRIOPort } from "avr8js";
import type { Editor } from "../editor/editor";
import { ComponentFigure } from "../editor/component-figure";
import { collectPeerConnections, type PortLike } from "../editor/mcu-pin/port-connections";
import {
    AnalogJoystickElement,
    ArduinoMegaElement,
    BiaxialStepperElement,
    BigSoundSensorElement,
    BuzzerElement,
    DipSwitch8Element,
    Dht22Element,
    Ds1307Element,
    FlameSensorElement,
    GasSensorElement,
    HCSR04Element,
    HeartBeatSensorElement,
    HX711Element,
    ILI9341Element,
    IRReceiverElement,
    IRRemoteElement,
    KS2EMDC5Element,
    KY040Element,
    LCD1602Element,
    LCD2004Element,
    LEDElement,
    LedBarGraphElement,
    LEDRingElement,
    MembraneKeypadElement,
    MicrosdCardElement,
    MPU6050Element,
    NanoRP2040ConnectElement,
    NeoPixelElement,
    NeopixelMatrixElement,
    NTCTemperatureSensorElement,
    PhotoresistorSensorElement,
    PIRMotionSensorElement,
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
    SSD1306Element,
    StepperMotorElement,
    TiltSwitchElement,
} from "@wokwi/elements";
import {
    isMicrocontrollerBoard,
    isWokwiComponent,
} from "../panels/component";
import { Pca9685Element } from "../panels/pca9685-element";
import {
    buildNetlist,
    detectGpioShort,
    detectNamedRailShorts,
    detectRailShorts,
    diagramFromMcuPinTable,
    Dht22Simulator,
    Ds1307Device,
    estimateServoAngleDeg,
    estimateShortCurrentMa,
    evaluateFuse,
    evaluateFusesForNetlist,
    evaluateLed,
    evaluateRailBudget,
    evaluateServo,
    findSeriesResistanceOhms,
    HcSr04Simulator,
    Hd44780,
    Hx711Simulator,
    I2cAddressAlias,
    Ili9341SpiDevice,
    ili9341ToRgba,
    IrReceiverSimulator,
    isAvrBuiltinLedPin,
    isNanoRp2040BuiltinLedPin,
    isPoweredNet,
    Lcd1602I2cDevice,
    lcdI2cAliasAddress,
    luxToSensorVolts,
    Mpu6050Device,
    normalizeUnoPinKey,
    normalizedToAdcVolts,
    Pca9685Device,
    peersOf,
    resolveAvrBoardPin,
    resolveI2cAddress,
    resolveNanoRp2040Gpio,
    SdCardSpiDevice,
    Ssd1306Device,
    StepperSimulator,
    temperatureToSensorVolts,
    TYPICAL_LOAD_MA,
    Ws2812Decoder,
    isMegaAvrRunner,
    type AvrBoardVariant,
    type AvrGpioPortName,
    type AvrPinRef,
    type AvrRunnerLike,
    type EmulatorManager,
    type Netlist,
    type SimBoardPinSnapshot,
    type WorkerDeviceState,
} from "librecircuit";

/** Pilotage MCU : AVR (port+bit) ou RP2040 (gpio). */
type McuDriveRef = AvrPinRef | { gpio: number };

function isAvrDrive(d: McuDriveRef): d is AvrPinRef {
    return "port" in d;
}

type DigitalOutBinding = {
    kind: "digital-out";
    /** Propriété booléenne ou numérique (0/1) sur l’overlay. */
    prop: string;
    mcuFigureId: string;
    /** Broche silk MCU (pour courts-circuits). */
    mcuPinKey?: string;
    /** AVR — absent si pilotage Pico. */
    port?: AvrGpioPortName;
    bit?: number;
    /** RP2040 GPIO index. */
    gpio?: number;
    activeLow: boolean;
    figureId: string;
    /** Physique LED (luminosité / brûlage). */
    ledPhysics?: boolean;
    seriesOhms?: number;
    burned?: boolean;
    /** Court-circuit déjà signalé (évite le spam fault). */
    shortFaulted?: boolean;
};

type RelayBinding = {
    kind: "relay";
    mcuFigureId: string;
    figureId: string;
    coil: McuDriveRef;
    /** Broches contact (pour forward P1→NO1/NC1). */
    p1?: McuDriveRef;
    /** Peers NO1 : figures LED etc. (bobine ON). */
    no1FigureIds: string[];
    /** Peers NC1 : figures LED etc. (bobine OFF). */
    nc1FigureIds: string[];
    energized?: boolean;
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
    /** Broche Arduino numérique (9/10 idéales pour Timer1). */
    pwmPin: number;
    /** Dernier angle affiché (persistance si sous-alim). */
    lastAngleDeg?: number;
    /** Alimentation détectée sur le net V+. */
    powered?: boolean;
};

type NeoLayout =
    | { mode: "single" }
    | { mode: "ring"; count: number }
    | { mode: "matrix"; rows: number; cols: number };

type NeoPixelBinding = {
    kind: "neopixel";
    mcuFigureId: string;
    port: AvrGpioPortName;
    bit: number;
    figureId: string;
    decoder: Ws2812Decoder;
    layout: NeoLayout;
    lastLevel?: boolean;
};

type Dht22Binding = {
    kind: "dht22";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    port: AvrGpioPortName;
    bit: number;
    sim: Dht22Simulator;
    lastHigh?: boolean;
    onWheel?: (ev: WheelEvent) => void;
};

type StepperCoilMap = {
    ap?: AvrPinRef;
    am?: AvrPinRef;
    bp?: AvrPinRef;
    bm?: AvrPinRef;
};

type StepperBinding = {
    kind: "stepper";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    /** `angle` (NEMA) ou `outerHandAngle` / `innerHandAngle` (biaxial). */
    angleProp: "angle" | "outerHandAngle" | "innerHandAngle";
    coils: StepperCoilMap;
    sim: StepperSimulator;
};

type KeypadBinding = {
    kind: "keypad";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    rows: Array<AvrPinRef | undefined>;
    cols: Array<AvrPinRef | undefined>;
    colCount: number;
};

type Ili9341Binding = {
    kind: "ili9341";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    device: Ili9341SpiDevice;
    dc?: McuDriveRef;
    cs?: McuDriveRef;
    lastDcHigh?: boolean;
};

type SdCardBinding = {
    kind: "sd";
    mcuFigureId: string;
    figureId: string;
    device: SdCardSpiDevice;
    cs?: McuDriveRef;
};

type IrReceiverBinding = {
    kind: "ir-rx";
    mcuFigureId: string;
    figureId: string;
    drive: McuDriveRef;
    sim: IrReceiverSimulator;
};

type OutputBinding =
    | DigitalOutBinding
    | RgbBinding
    | SegmentBinding
    | ServoBinding
    | NeoPixelBinding;

type I2cDisplayBinding = {
    kind: "lcd" | "oled" | "pca9685" | "ds1307" | "mpu6050";
    mcuFigureId: string;
    figureId: string;
    device: Lcd1602I2cDevice | Ssd1306Device | Pca9685Device | Ds1307Device | Mpu6050Device;
    /** Alias 0x27↔0x3F pour LCD (même cœur). */
    alias?: I2cAddressAlias;
    overlay?: HTMLElement;
    onWheel?: (ev: WheelEvent) => void;
};

type Hx711Binding = {
    kind: "hx711";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    sim: Hx711Simulator;
    dt?: AvrPinRef;
    sck?: AvrPinRef;
    lastSckHigh?: boolean;
    onWheel?: (ev: WheelEvent) => void;
};

type ParallelLcdBinding = {
    kind: "parallel-lcd";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    core: Hd44780;
    rs?: AvrPinRef;
    e?: AvrPinRef;
    d4?: AvrPinRef;
    d5?: AvrPinRef;
    d6?: AvrPinRef;
    d7?: AvrPinRef;
    lastEHigh?: boolean;
};

type HcSr04Binding = {
    kind: "hcsr04";
    mcuFigureId: string;
    figureId: string;
    overlay: HTMLElement;
    sim: HcSr04Simulator;
    trig?: AvrPinRef;
    echo?: AvrPinRef;
    lastTrigHigh?: boolean;
    onWheel?: (ev: WheelEvent) => void;
};

type DigitalInBinding = {
    kind: "digital-in";
    mode: "button" | "switch" | "dip" | "toggle" | "encoder-sw";
    mcuFigureId: string;
    port?: AvrGpioPortName;
    bit?: number;
    gpio?: number;
    figureId: string;
    overlay: HTMLElement;
    /** Index 0–7 pour DipSwitch8. */
    dipIndex?: number;
    /** État local pour capteurs cliquables. */
    toggled?: boolean;
    /** LED visuelle optionnelle sur le module capteur. */
    ledProp?: string;
    /** Si `true`, toggle actif → pin HIGH (PIR) ; sinon actif → LOW (modules DO). */
    activeHigh?: boolean;
    onPress?: () => void;
    onRelease?: () => void;
    onToggleClick?: (ev: Event) => void;
};

type AnalogInBinding = {
    kind: "analog-in";
    mode: "pot" | "joystick-x" | "joystick-y" | "lux" | "sensor" | "ntc";
    mcuFigureId: string;
    /** Canal ADC ATmega328P (0–5 pour A0–A5). */
    adcChannel: number;
    figureId: string;
    overlay: HTMLElement;
    onWheel?: (ev: WheelEvent) => void;
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
    private i2cDisplays: I2cDisplayBinding[] = [];
    private hcSr04s: HcSr04Binding[] = [];
    private dht22s: Dht22Binding[] = [];
    private steppers: StepperBinding[] = [];
    private keypads: KeypadBinding[] = [];
    private ili9341s: Ili9341Binding[] = [];
    private sdCards: SdCardBinding[] = [];
    private irReceivers: IrReceiverBinding[] = [];
    private hx711s: Hx711Binding[] = [];
    private parallelLcds: ParallelLcdBinding[] = [];
    private relays: RelayBinding[] = [];
    private attached = false;
    private inputPollTimer: ReturnType<typeof setInterval> | undefined;
    private lastRtcWallMs = 0;
    /** Netlist LC du plan (source de vérité pour R série / peers). */
    private netlist: Netlist | undefined;
    private rpGpioUnsub: (() => void) | undefined;
    private irRemoteCleanups: Array<() => void> = [];

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
        this.rpGpioUnsub = this.emulator.onRpGpio((gpioIndex, high, mcuFigureId) => {
            this.applyRpGpioOutputs(gpioIndex, high, mcuFigureId);
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
        this.rpGpioUnsub?.();
        this.rpGpioUnsub = undefined;
        this.pinsUnsub?.();
        this.pinsUnsub = undefined;
        if (this.inputPollTimer !== undefined) {
            clearInterval(this.inputPollTimer);
            this.inputPollTimer = undefined;
        }
        this.clearDigitalInListeners();
        this.clearAnalogInListeners();
        this.clearHcSr04Listeners();
        this.clearDht22Listeners();
        this.clearHx711Listeners();
        this.clearMpu6050Listeners();
        this.detachI2cDevices();
        this.detachIli9341();
        this.detachSdCards();
        this.clearIrRemoteListeners();
        this.clearHcSr04Echoes();
        this.clearDht22Sims();
        this.resetDrivenOverlays();
        this.outputBindings = [];
        this.digitalIns = [];
        this.analogIns = [];
        this.i2cDisplays = [];
        this.hcSr04s = [];
        this.dht22s = [];
        this.steppers = [];
        this.keypads = [];
        this.hx711s = [];
        this.parallelLcds = [];
        this.relays = [];
        this.ili9341s = [];
        this.sdCards = [];
        this.irReceivers = [];
        this.attached = false;
        this.editor.canvas.setSimulationInteractionMode(false);
    }

    /** Applique l’état courant de tous les runners actifs. */
    /**
     * Charge une image disque raw (`.img`) dans la microSD liée à `figureId`.
     * @returns `true` si une carte SD a été trouvée et chargée.
     */
    loadSdDiskImage(figureId: string, image: Uint8Array): boolean {
        const binding = this.sdCards.find((b) => b.figureId === figureId);
        if (!binding) return false;
        binding.device.loadImage(image);
        return true;
    }

    /**
     * Exporte l’image disque de la microSD liée à `figureId` (copie).
     */
    exportSdDiskImage(figureId: string): Uint8Array | undefined {
        const binding = this.sdCards.find((b) => b.figureId === figureId);
        return binding?.device.exportImage();
    }

    /**
     * Applique des snapshots worker (GPIO High/Low) aux overlays digital-out / RGB / segments.
     * Socle « bridge par snapshots » — I²C/SPI/NeoPixel restent sur le runner local.
     */
    applySnapshotOutputs(snapshots: SimBoardPinSnapshot[]): void {
        for (const snap of snapshots) {
            for (const pin of snap.digital) {
                const high = pin.state === "High" || pin.state === "InputPullUp";
                for (const binding of this.outputBindings) {
                    if (binding.mcuFigureId !== snap.figureId) continue;
                    if (binding.port !== pin.port || binding.bit !== pin.bit) continue;
                    if (binding.kind === "digital-out") {
                        this.applyDigitalOutBinding(binding, high);
                    } else if (binding.kind === "rgb") {
                        const el = this.getOverlay(binding.figureId) as Record<string, number> | null;
                        if (el) el[binding.channel] = high ? 1 : 0;
                    } else if (binding.kind === "segment") {
                        const el = this.getOverlay(binding.figureId) as { values?: number[] } | null;
                        if (!el) continue;
                        const values = el.values ? [...el.values] : [];
                        while (values.length <= binding.index) values.push(0);
                        values[binding.index] = (binding.activeLow ? !high : high) ? 1 : 0;
                        el.values = values;
                    }
                }
            }
        }
    }

    /**
     * Applique l’état devices poussé par le worker (LCD / OLED / ILI).
     * Associe via `boardId` MCU + adresse I²C ou `deviceId` SPI.
     */
    applyWorkerDeviceStates(states: WorkerDeviceState[]): void {
        for (const state of states) {
            if (state.kind === "lcd1602") {
                for (const binding of this.i2cDisplays) {
                    if (binding.mcuFigureId !== state.boardId) continue;
                    if (binding.kind !== "lcd") continue;
                    if (binding.device.address !== state.address) continue;
                    const el = this.getOverlay(binding.figureId) as {
                        text?: string;
                        backlight?: boolean;
                    } | null;
                    if (!el) continue;
                    el.text = state.lines.join("");
                    el.backlight = state.backlight;
                }
                continue;
            }
            if (state.kind === "ssd1306") {
                for (const binding of this.i2cDisplays) {
                    if (binding.mcuFigureId !== state.boardId) continue;
                    if (binding.kind !== "oled") continue;
                    if (binding.device.address !== state.address) continue;
                    const el = this.getOverlay(binding.figureId) as {
                        imageData?: ImageData;
                        redraw?: () => void;
                    } | null;
                    if (!el?.imageData) continue;
                    // Peint depuis le framebuffer worker (même layout page-mode)
                    const fake = {
                        width: state.width,
                        height: state.height,
                        framebuffer: state.framebuffer,
                        isDisplayOn: state.displayOn,
                    };
                    paintSsd1306Frame(fake as Ssd1306Device, el.imageData);
                    el.redraw?.();
                }
                continue;
            }
            if (state.kind === "ili9341") {
                for (const binding of this.ili9341s) {
                    if (binding.mcuFigureId !== state.boardId) continue;
                    if (binding.device.id !== state.deviceId) continue;
                    binding.device.pixels.set(state.pixels);
                    binding.device.displayOn = state.displayOn;
                    const el = binding.overlay as { canvas?: HTMLCanvasElement | null };
                    const canvas = el.canvas ?? null;
                    if (!canvas) continue;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) continue;
                    const img = ctx.createImageData(binding.device.width, binding.device.height);
                    ili9341ToRgba(binding.device, img.data);
                    ctx.putImageData(img, 0, 0);
                }
                continue;
            }
            if (state.kind === "neopixel") {
                for (const binding of this.outputBindings) {
                    if (binding.kind !== "neopixel") continue;
                    if (binding.mcuFigureId !== state.boardId) continue;
                    if (binding.figureId !== state.deviceId) continue;
                    const colors = state.colors;
                    for (let i = 0; i < Math.min(colors.length, binding.decoder.colors.length); i++) {
                        const c = colors[i]!;
                        binding.decoder.colors[i] = { r: c.r, g: c.g, b: c.b };
                    }
                    this.applyNeoColors(binding);
                }
            }
        }
    }

    /**
     * Déclare les NeoPixel du plan auprès du worker (après `attach()`).
     */
    mirrorNeopixelsToWorker(attachNeo: (spec: {
        boardId: string;
        deviceId: string;
        port: AvrGpioPortName;
        bit: number;
        count: number;
    }) => void): void {
        for (const binding of this.outputBindings) {
            if (binding.kind !== "neopixel") continue;
            if (binding.port === undefined || binding.bit === undefined) continue;
            attachNeo({
                boardId: binding.mcuFigureId,
                deviceId: binding.figureId,
                port: binding.port,
                bit: binding.bit,
                count: binding.decoder.colors.length,
            });
        }
    }

    /**
     * Pousse boutons / pots vers le worker (mode `?worker=exclusive`, sans boucle CPU UI).
     */
    mirrorInputsToWorker(handlers: {
        setGpio: (boardId: string, port: AvrGpioPortName, bit: number, high: boolean) => void;
        setAdc: (boardId: string, channel: number, volts: number) => void;
        setRpGpio: (boardId: string, gpio: number, high: boolean) => void;
    }): void {
        for (const din of this.digitalIns) {
            const level = this.readDigitalInLevel(din);
            if (level === undefined) continue;
            if (din.gpio !== undefined) {
                handlers.setRpGpio(din.mcuFigureId, din.gpio, level);
            } else if (din.port !== undefined && din.bit !== undefined) {
                handlers.setGpio(din.mcuFigureId, din.port, din.bit, level);
            }
        }
        for (const ain of this.analogIns) {
            handlers.setAdc(ain.mcuFigureId, ain.adcChannel, this.readAnalogInVolts(ain));
        }
    }

    private readDigitalInLevel(din: DigitalInBinding): boolean | undefined {
        if (din.mode === "button" || din.mode === "encoder-sw") {
            return !Boolean((din.overlay as { pressed?: boolean }).pressed);
        }
        if (din.mode === "switch") {
            return Number((din.overlay as { value?: number }).value ?? 0) === 0;
        }
        if (din.mode === "dip") {
            const values = (din.overlay as { values?: number[] }).values ?? [];
            return Number(values[din.dipIndex ?? 0] ?? 0) === 0;
        }
        if (din.mode === "toggle") {
            const active = Boolean(din.toggled);
            if (din.ledProp) {
                (din.overlay as unknown as Record<string, unknown>)[din.ledProp] = active;
            }
            return din.activeHigh ? active : !active;
        }
        return undefined;
    }

    private readAnalogInVolts(ain: AnalogInBinding): number {
        const el = ain.overlay as {
            value?: number;
            min?: number;
            max?: number;
            xValue?: number;
            yValue?: number;
            temperature?: number;
        };
        if (ain.mode === "joystick-x") {
            return Math.min(5, Math.max(0, Number(el.xValue ?? 0.5) * 5));
        }
        if (ain.mode === "joystick-y") {
            return Math.min(5, Math.max(0, Number(el.yValue ?? 0.5) * 5));
        }
        if (ain.mode === "lux") {
            const min = Number(el.min ?? 0);
            const max = Number(el.max ?? 100);
            const value = Number(el.value ?? min);
            const span = max - min || 1;
            return luxToSensorVolts(((value - min) / span) * 1000, 1000);
        }
        if (ain.mode === "ntc") {
            const min = Number(el.min ?? -10);
            const max = Number(el.max ?? 50);
            const t = Number(el.temperature ?? el.value ?? 25);
            return temperatureToSensorVolts(t, min, max);
        }
        const min = Number(el.min ?? 0);
        const max = Number(el.max ?? 100);
        const value = Number(el.value ?? min);
        const span = max - min || 1;
        return normalizedToAdcVolts((value - min) / span);
    }

    syncAll(): void {
        for (const [mcuFigureId, runner] of this.emulator.getActiveRunners()) {
            if (isMegaAvrRunner(runner)) {
                for (const name of Object.keys(runner.ports) as AvrGpioPortName[]) {
                    this.applyPortOutputs(runner.ports[name], name, mcuFigureId);
                }
            } else {
                this.applyPortOutputs(runner.portB, "B", mcuFigureId);
                this.applyPortOutputs(runner.portC, "C", mcuFigureId);
                this.applyPortOutputs(runner.portD, "D", mcuFigureId);
            }
            this.syncDigitalIns(runner, mcuFigureId);
            this.syncAnalogIns(runner, mcuFigureId);
        }
        // Flush sorties Pico (pas de ports B/C/D)
        for (const binding of this.outputBindings) {
            if (binding.kind !== "digital-out" || binding.gpio === undefined) continue;
            const rp = this.emulator.getRp2040Runner(binding.mcuFigureId);
            if (!rp) continue;
            this.applyRpGpioOutputs(binding.gpio, rp.isGpioHigh(binding.gpio), binding.mcuFigureId);
        }
        this.syncServoAndNeo();
        this.syncI2cDisplays();
        this.syncHcSr04Distances();
        this.syncDht22Climate();
        this.syncSteppers();
        this.syncKeypads();
        this.syncIli9341();
        this.syncIrReceivers();
        this.syncHx711Dt();
        this.syncParallelLcds();
        this.syncRelays();
        this.syncRpDigitalIns();
    }

    private syncInputsOnly(): void {
        for (const [mcuFigureId, runner] of this.emulator.getActiveRunners()) {
            this.syncDigitalIns(runner, mcuFigureId);
            this.syncAnalogIns(runner, mcuFigureId);
        }
        this.syncServoAndNeo();
        this.syncI2cDisplays();
        this.syncHcSr04Distances();
        this.syncDht22Climate();
        this.syncSteppers();
        this.syncKeypads();
        this.syncIli9341();
        this.syncIrReceivers();
        this.syncHx711Dt();
        this.syncParallelLcds();
        this.syncRelays();
        this.syncRpDigitalIns();
    }

    private rebuildBindings(): void {
        this.clearDigitalInListeners();
        this.clearAnalogInListeners();
        this.clearHcSr04Listeners();
        this.clearDht22Listeners();
        this.clearHx711Listeners();
        this.clearMpu6050Listeners();
        this.detachI2cDevices();
        this.detachIli9341();
        this.detachSdCards();
        this.clearIrRemoteListeners();
        this.clearHcSr04Echoes();
        this.clearDht22Sims();
        this.outputBindings = [];
        this.digitalIns = [];
        this.analogIns = [];
        this.i2cDisplays = [];
        this.hcSr04s = [];
        this.dht22s = [];
        this.steppers = [];
        this.keypads = [];
        this.ili9341s = [];
        this.sdCards = [];
        this.irReceivers = [];
        this.hx711s = [];
        this.parallelLcds = [];
        this.relays = [];

        const table = this.editor.getMcuPinConnectionTable();
        const seen = new Set<string>();
        this.netlist = this.buildEditorNetlist(table);

        for (const board of table) {
            const boardFig = this.getFigure(board.figureId);
            if (!boardFig) continue;
            const boardInfo = boardFig.getComponentInfo();
            const isPico =
                isWokwiComponent(boardInfo) && boardInfo.clasz === NanoRP2040ConnectElement;
            const avrVariant: AvrBoardVariant =
                isWokwiComponent(boardInfo) && boardInfo.clasz === ArduinoMegaElement
                    ? "mega"
                    : "uno";

            for (const pin of board.pins) {
                const drive: McuDriveRef | undefined = isPico
                    ? resolveNanoRp2040Gpio(pin.pinKey)
                    : resolveAvrBoardPin(pin.pinKey, avrVariant);
                if (!drive) continue;

                if (isPico && isNanoRp2040BuiltinLedPin(pin.pinKey) && "gpio" in drive) {
                    const key = `${board.figureId}|ledBuiltIn`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        this.outputBindings.push({
                            kind: "digital-out",
                            prop: "ledBuiltIn",
                            mcuFigureId: board.figureId,
                            mcuPinKey: pin.pinKey,
                            gpio: drive.gpio,
                            activeLow: false,
                            figureId: board.figureId,
                        });
                    }
                } else if (
                    !isPico &&
                    isAvrDrive(drive) &&
                    isAvrBuiltinLedPin(pin.pinKey, avrVariant)
                ) {
                    const key = `${board.figureId}|led13`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        this.outputBindings.push({
                            kind: "digital-out",
                            prop: "led13",
                            mcuFigureId: board.figureId,
                            mcuPinKey: pin.pinKey,
                            port: drive.port,
                            bit: drive.bit,
                            activeLow: false,
                            figureId: board.figureId,
                        });
                    }
                }

                const adcChannel = isPico ? undefined : analogChannelFromPinKey(pin.pinKey);

                for (const peer of pin.connections) {
                    this.collectEndpointBindings(
                        board.figureId,
                        peer.peerFigureId,
                        peer.peerPortKey,
                        drive,
                        adcChannel,
                        seen,
                        new Set([board.figureId]),
                        pin.pinKey,
                    );
                }
            }
        }

        this.emitRailShortFaults();
        this.emitRailBudgetFaults();
        this.wireDigitalInListeners();
        this.wireAnalogInListeners();
        this.wireHcSr04Listeners();
        this.wireDht22Listeners();
        this.wireHx711Listeners();
        this.wireMpu6050Listeners();
        this.wireIrRemoteListeners();
        this.attachI2cDevices();
        this.attachIli9341();
        this.attachSdCards();
        this.markHitTargets();
    }

    /** Signale un court-circuit rail VCC↔GND dès la reconstruction de la netlist. */
    private emitRailShortFaults(): void {
        if (!this.netlist) return;
        const named = detectNamedRailShorts(this.netlist);
        if (!named.shorted) {
            // Fallback générique (compat)
            const r = detectRailShorts(this.netlist);
            if (!r.shorted) return;
            this.emulator.events.emit("fault", {
                code: r.faultCode ?? "rail-short",
                message: r.faultMessage ?? "Court-circuit alimentation.",
            });
            return;
        }
        this.emulator.events.emit("fault", {
            code: named.faultCode ?? "rail-short",
            message: named.faultMessage ?? "Court-circuit alimentation.",
        });
        for (const fuse of evaluateFusesForNetlist(this.netlist)) {
            this.emulator.events.emit("fault", {
                code: fuse.faultCode ?? "fuse-blown",
                message: fuse.faultMessage ?? `Fusible ${fuse.rail} grillé.`,
            });
        }
    }

    /** Budget courant rail pédagogique (LEDs / servos / MCU). */
    private emitRailBudgetFaults(): void {
        if (!this.netlist) return;
        let loadMa = TYPICAL_LOAD_MA.mcuIdle;
        for (const b of this.outputBindings) {
            if (b.kind === "digital-out" && b.ledPhysics) loadMa += TYPICAL_LOAD_MA.led;
        }
        for (const _ of this.ili9341s) loadMa += 40;
        for (const _ of this.sdCards) loadMa += 30;
        const shorted = detectRailShorts(this.netlist).shorted;
        const r = evaluateRailBudget({ loadMa, shorted });
        if (!r.faultCode || r.faultCode === "rail-short") return; // rail-short déjà émis
        this.emulator.events.emit("fault", {
            code: r.faultCode,
            message: r.faultMessage ?? "Rail en défaut.",
        });
    }

    /** Active les clics uniquement sur les overlays d’entrée. */
    private markHitTargets(): void {
        const hitIds = new Set<string>();
        for (const din of this.digitalIns) hitIds.add(din.figureId);
        for (const ain of this.analogIns) hitIds.add(ain.figureId);
        for (const hc of this.hcSr04s) hitIds.add(hc.figureId);
        for (const dht of this.dht22s) hitIds.add(dht.figureId);
        for (const kp of this.keypads) hitIds.add(kp.figureId);
        for (const hx of this.hx711s) hitIds.add(hx.figureId);
        for (const b of this.i2cDisplays) {
            if (b.kind === "mpu6050") hitIds.add(b.figureId);
        }
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
        drive: McuDriveRef,
        adcChannel: number | undefined,
        seen: Set<string>,
        visitedFigures: Set<string>,
        mcuPinKey: string,
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
        const avrPort = isAvrDrive(drive) ? drive.port : undefined;
        const avrBit = isAvrDrive(drive) ? drive.bit : undefined;
        const gpio = isAvrDrive(drive) ? undefined : drive.gpio;
        const driveKey = isAvrDrive(drive) ? `${drive.port}${drive.bit}` : `GP${drive.gpio}`;
        const avr = isAvrDrive(drive) ? drive : undefined;

        if (clasz === LEDElement) {
            const key = `${mcuFigureId}|${figureId}|led`;
            if (seen.has(key)) return;
            seen.add(key);
            const seriesOhms = this.netlist
                ? findSeriesResistanceOhms(this.netlist, figureId, pk)
                : undefined;
            this.outputBindings.push({
                kind: "digital-out",
                prop: "value",
                mcuFigureId,
                mcuPinKey,
                port: avrPort,
                bit: avrBit,
                gpio,
                activeLow: isCathodePort(pk),
                figureId,
                ledPhysics: true,
                seriesOhms,
                burned: false,
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
                mcuPinKey,
                port: avrPort,
                bit: avrBit,
                gpio,
                activeLow: false,
                figureId,
            });
            return;
        }

        if (clasz === RGBLedElement) {
            if (!avr || avrPort === undefined || avrBit === undefined) return;
            const channel = rgbChannelFromPort(pk);
            if (!channel) return;
            const key = `${mcuFigureId}|${figureId}|rgb|${channel}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "rgb",
                channel,
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                figureId,
            });
            return;
        }

        if (clasz === SevenSegmentElement) {
            if (!avr || avrPort === undefined || avrBit === undefined) return;
            const index = sevenSegIndexFromPort(pk);
            if (index < 0) return;
            const key = `${mcuFigureId}|${figureId}|7seg|${index}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "segment",
                index,
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                activeLow: false,
                figureId,
            });
            return;
        }

        if (clasz === LedBarGraphElement) {
            if (!avr || avrPort === undefined || avrBit === undefined) return;
            const index = ledBarIndexFromPort(pk);
            if (index < 0) return;
            const key = `${mcuFigureId}|${figureId}|bar|${index}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.outputBindings.push({
                kind: "segment",
                index,
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                activeLow: isCathodePort(pk) || pk.startsWith("C"),
                figureId,
            });
            return;
        }

        if (clasz === ServoElement) {
            if (!avr || avrPort === undefined || avrBit === undefined) return;
            if (pk !== "PWM") return;
            const key = `${mcuFigureId}|${figureId}|servo`;
            if (seen.has(key)) return;
            seen.add(key);
            const pwmPin = unoDigitalPinNumber(mcuPinKey) ?? 9;
            const powered = this.netlist
                ? isPoweredNet(this.netlist, figureId, "V+") ||
                  isPoweredNet(this.netlist, figureId, "VCC") ||
                  isPoweredNet(this.netlist, figureId, "VS")
                : true;
            this.outputBindings.push({
                kind: "servo",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                figureId,
                pwmPin,
                powered,
                lastAngleDeg: 90,
            });
            return;
        }

        if (clasz === NeoPixelElement || clasz === LEDRingElement || clasz === NeopixelMatrixElement) {
            if (!avr || avrPort === undefined || avrBit === undefined) return;
            if (pk !== "DIN" && pk !== "DI" && pk !== "IN") return;
            const key = `${mcuFigureId}|${figureId}|neo`;
            if (seen.has(key)) return;
            seen.add(key);
            let layout: NeoLayout = { mode: "single" };
            let count = 1;
            if (clasz === LEDRingElement) {
                count = Math.max(1, Number((overlay as { pixels?: number }).pixels ?? 16));
                layout = { mode: "ring", count };
            } else if (clasz === NeopixelMatrixElement) {
                const rows = Math.max(1, Number((overlay as { rows?: number }).rows ?? 8));
                const cols = Math.max(1, Number((overlay as { cols?: number }).cols ?? 8));
                count = rows * cols;
                layout = { mode: "matrix", rows, cols };
            }
            this.outputBindings.push({
                kind: "neopixel",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                figureId,
                decoder: new Ws2812Decoder(count, 16),
                layout,
            });
            return;
        }

        if (clasz === LCD1602Element || clasz === LCD2004Element) {
            const cols = clasz === LCD2004Element ? 20 : 16;
            const rows = clasz === LCD2004Element ? 4 : 2;
            if (pk === "SDA" || pk === "SCL") {
                const key = `${mcuFigureId}|${figureId}|lcd-i2c`;
                if (seen.has(key)) return;
                seen.add(key);
                const addr = resolveI2cAddress(overlay as HTMLElement & { i2cAddress?: number }, 0x27);
                const device = new Lcd1602I2cDevice(addr, cols, rows);
                const aliasAddr = lcdI2cAliasAddress(addr);
                this.i2cDisplays.push({
                    kind: "lcd",
                    mcuFigureId,
                    figureId,
                    device,
                    alias: aliasAddr !== undefined ? new I2cAddressAlias(aliasAddr, device) : undefined,
                });
                return;
            }
            const parallelPin = parallelLcdPinFromPort(pk);
            if (!parallelPin) return;
            const key = `${mcuFigureId}|${figureId}|lcd-par`;
            let binding = this.parallelLcds.find(
                (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
            );
            if (!binding) {
                if (seen.has(key)) return;
                seen.add(key);
                binding = {
                    kind: "parallel-lcd",
                    mcuFigureId,
                    figureId,
                    overlay,
                    core: new Hd44780(cols, rows),
                };
                this.parallelLcds.push(binding);
            }
            if (!avr) return;
            binding[parallelPin] = avr;
            return;
        }

        if (clasz === SSD1306Element) {
            if (pk !== "DATA" && pk !== "CLK" && pk !== "SDA" && pk !== "SCL") return;
            const key = `${mcuFigureId}|${figureId}|oled-i2c`;
            if (seen.has(key)) return;
            seen.add(key);
            const addr = resolveI2cAddress(overlay as HTMLElement & { i2cAddress?: number }, 0x3c);
            this.i2cDisplays.push({
                kind: "oled",
                mcuFigureId,
                figureId,
                device: new Ssd1306Device(addr),
            });
            return;
        }

        if (clasz === Pca9685Element) {
            if (pk !== "SDA" && pk !== "SCL") return;
            const key = `${mcuFigureId}|${figureId}|pca9685`;
            if (seen.has(key)) return;
            seen.add(key);
            const addr = resolveI2cAddress(overlay as HTMLElement & { i2cAddress?: number }, 0x40);
            (overlay as Pca9685Element).i2cAddress = addr;
            this.i2cDisplays.push({
                kind: "pca9685",
                mcuFigureId,
                figureId,
                device: new Pca9685Device(addr),
            });
            return;
        }

        if (clasz === Ds1307Element) {
            if (pk !== "SDA" && pk !== "SCL") return;
            const key = `${mcuFigureId}|${figureId}|ds1307`;
            if (seen.has(key)) return;
            seen.add(key);
            const addr = resolveI2cAddress(overlay as HTMLElement & { i2cAddress?: number }, 0x68);
            this.i2cDisplays.push({
                kind: "ds1307",
                mcuFigureId,
                figureId,
                device: new Ds1307Device(addr),
            });
            return;
        }

        if (clasz === MPU6050Element) {
            if (pk !== "SDA" && pk !== "SCL") return;
            const key = `${mcuFigureId}|${figureId}|mpu6050`;
            if (seen.has(key)) return;
            seen.add(key);
            const addr = resolveI2cAddress(overlay as HTMLElement & { i2cAddress?: number }, 0x68);
            const el = overlay as { value?: number; min?: number; max?: number; led1?: boolean };
            if (el.value === undefined) el.value = 0;
            el.min = -90;
            el.max = 90;
            this.i2cDisplays.push({
                kind: "mpu6050",
                mcuFigureId,
                figureId,
                device: new Mpu6050Device(addr),
                overlay,
            });
            return;
        }

        if (clasz === HX711Element) {
            if (pk !== "DT" && pk !== "SCK" && pk !== "DOUT" && pk !== "CLK") return;
            const key = `${mcuFigureId}|${figureId}|hx711`;
            let binding = this.hx711s.find(
                (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
            );
            if (!binding) {
                if (seen.has(key)) return;
                seen.add(key);
                const el = overlay as { value?: number; min?: number; max?: number };
                if (el.value === undefined) el.value = 0;
                el.min = 0;
                el.max = 5000;
                binding = {
                    kind: "hx711",
                    mcuFigureId,
                    figureId,
                    overlay,
                    sim: new Hx711Simulator(),
                };
                binding.sim.setGrams(Number(el.value));
                this.hx711s.push(binding);
            }
            if (!avr) return;
            if (pk === "DT" || pk === "DOUT") binding.dt = avr;
            else binding.sck = avr;
            return;
        }

        if (clasz === KS2EMDC5Element) {
            const key = `${mcuFigureId}|${figureId}|relay`;
            let relay = this.relays.find(
                (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
            );
            if (!relay) {
                relay = {
                    kind: "relay",
                    mcuFigureId,
                    figureId,
                    coil: drive,
                    no1FigureIds: this.netlist
                        ? contactPeerFigureIds(this.netlist, figureId, "NO1")
                        : [],
                    nc1FigureIds: this.netlist
                        ? contactPeerFigureIds(this.netlist, figureId, "NC1")
                        : [],
                };
                this.relays.push(relay);
                seen.add(key);
            }
            if (pk === "COIL1") {
                relay.coil = drive;
                this.outputBindings.push({
                    kind: "digital-out",
                    prop: "energized",
                    mcuFigureId,
                    mcuPinKey,
                    port: avrPort,
                    bit: avrBit,
                    gpio,
                    activeLow: false,
                    figureId,
                });
                return;
            }
            if (pk === "P1") {
                relay.p1 = drive;
                return;
            }
            if (pk === "NO1") {
                relay.no1FigureIds = this.netlist
                    ? contactPeerFigureIds(this.netlist, figureId, "NO1")
                    : relay.no1FigureIds;
                return;
            }
            if (pk === "NC1") {
                relay.nc1FigureIds = this.netlist
                    ? contactPeerFigureIds(this.netlist, figureId, "NC1")
                    : relay.nc1FigureIds;
                return;
            }
            return;
        }

        if (clasz === TiltSwitchElement || clasz === HeartBeatSensorElement) {
            if (pk !== "OUT") return;
            const key = `${mcuFigureId}|${figureId}|tilt-hb|${driveKey}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "toggle",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                gpio,
                figureId,
                overlay,
                toggled: false,
                activeHigh: true,
            });
            overlay.title =
                overlay.title ||
                (clasz === TiltSwitchElement
                    ? "Clic : inclinaison (tilt)"
                    : "Clic : battement cardiaque");
            return;
        }

        if (clasz === NTCTemperatureSensorElement) {
            if (adcChannel === undefined) return;
            if (pk !== "OUT" && pk !== "SIG" && pk !== "AO") return;
            const key = `${mcuFigureId}|${figureId}|ntc|${adcChannel}`;
            if (seen.has(key)) return;
            seen.add(key);
            const el = overlay as { temperature?: number; value?: number; min?: number; max?: number };
            if (el.temperature === undefined) el.temperature = 25;
            el.min = -10;
            el.max = 50;
            el.value = el.temperature;
            this.analogIns.push({
                kind: "analog-in",
                mode: "ntc",
                mcuFigureId,
                adcChannel,
                figureId,
                overlay,
            });
            return;
        }

        if (clasz === PIRMotionSensorElement) {
            if (pk !== "OUT") return;
            const key = `${mcuFigureId}|${figureId}|pir|${driveKey}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "toggle",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                gpio,
                figureId,
                overlay,
                toggled: false,
                activeHigh: true,
            });
            return;
        }

        if (clasz === Dht22Element) {
            if (!avr || avrPort === undefined || avrBit === undefined) return;
            if (pk !== "SDA" && pk !== "DATA" && pk !== "OUT") return;
            const key = `${mcuFigureId}|${figureId}|dht22`;
            if (seen.has(key)) return;
            seen.add(key);
            const el = overlay as { temperature?: number; humidity?: number; value?: number };
            if (el.temperature === undefined) el.temperature = 25;
            if (el.humidity === undefined) el.humidity = 50;
            this.dht22s.push({
                kind: "dht22",
                mcuFigureId,
                figureId,
                overlay,
                port: avrPort,
                bit: avrBit,
                sim: new Dht22Simulator({
                    temperatureC: Number(el.temperature),
                    humidity: Number(el.humidity),
                }),
            });
            return;
        }

        if (clasz === StepperMotorElement) {
            if (!avr) return;
            const coil = stepperCoilFromPort(pk);
            if (!coil) return;
            const key = `${mcuFigureId}|${figureId}|stepper`;
            let binding = this.steppers.find(
                (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId && b.angleProp === "angle",
            );
            if (!binding) {
                if (seen.has(key)) return;
                seen.add(key);
                binding = {
                    kind: "stepper",
                    mcuFigureId,
                    figureId,
                    overlay,
                    angleProp: "angle",
                    coils: {},
                    sim: new StepperSimulator(),
                };
                this.steppers.push(binding);
            }
            binding.coils[coil] = avr;
            return;
        }

        if (clasz === BiaxialStepperElement) {
            if (!avr) return;
            const mapped = biaxialCoilFromPort(pk);
            if (!mapped) return;
            const key = `${mcuFigureId}|${figureId}|biaxial|${mapped.angleProp}`;
            let binding = this.steppers.find(
                (b) =>
                    b.mcuFigureId === mcuFigureId &&
                    b.figureId === figureId &&
                    b.angleProp === mapped.angleProp,
            );
            if (!binding) {
                if (seen.has(key)) return;
                seen.add(key);
                binding = {
                    kind: "stepper",
                    mcuFigureId,
                    figureId,
                    overlay,
                    angleProp: mapped.angleProp,
                    coils: {},
                    sim: new StepperSimulator(),
                };
                this.steppers.push(binding);
            }
            binding.coils[mapped.coil] = avr;
            return;
        }

        if (clasz === MembraneKeypadElement) {
            if (!avr) return;
            const row = keypadRowFromPort(pk);
            const col = keypadColFromPort(pk);
            if (row < 0 && col < 0) return;
            const key = `${mcuFigureId}|${figureId}|keypad`;
            let binding = this.keypads.find(
                (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
            );
            if (!binding) {
                if (seen.has(key)) return;
                seen.add(key);
                const colCount = String((overlay as { columns?: string }).columns ?? "4") === "3" ? 3 : 4;
                binding = {
                    kind: "keypad",
                    mcuFigureId,
                    figureId,
                    overlay,
                    rows: [undefined, undefined, undefined, undefined],
                    cols: [undefined, undefined, undefined, undefined],
                    colCount,
                };
                this.keypads.push(binding);
            }
            if (row >= 0) binding.rows[row] = avr;
            if (col >= 0) binding.cols[col] = avr;
            return;
        }

        if (clasz === MicrosdCardElement) {
            const key = `${mcuFigureId}|${figureId}|sd`;
            const ensureSd = (): SdCardBinding | undefined => {
                let binding = this.sdCards.find(
                    (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
                );
                if (!binding) {
                    if (seen.has(key)) return undefined;
                    seen.add(key);
                    binding = {
                        kind: "sd",
                        mcuFigureId,
                        figureId,
                        device: new SdCardSpiDevice(`sd-${figureId}`),
                    };
                    this.sdCards.push(binding);
                }
                return binding;
            };
            if (pk === "CS" || pk === "SS") {
                const binding = ensureSd();
                if (binding) binding.cs = drive;
                return;
            }
            if (pk === "DI" || pk === "DO" || pk === "SCK" || pk === "MOSI" || pk === "MISO") {
                ensureSd();
                return;
            }
            return;
        }

        if (clasz === IRReceiverElement) {
            if (pk !== "DAT" && pk !== "OUT" && pk !== "DATA") return;
            const key = `${mcuFigureId}|${figureId}|ir-rx`;
            if (seen.has(key)) return;
            seen.add(key);
            const cyclesPerUs = "gpio" in drive ? 125 : 16;
            this.irReceivers.push({
                kind: "ir-rx",
                mcuFigureId,
                figureId,
                drive,
                sim: new IrReceiverSimulator({ cyclesPerUs }),
            });
            return;
        }

        if (clasz === ILI9341Element) {
            const key = `${mcuFigureId}|${figureId}|ili9341`;
            const ensureIli = (): Ili9341Binding | undefined => {
                let binding = this.ili9341s.find(
                    (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
                );
                if (!binding) {
                    if (seen.has(key)) return undefined;
                    seen.add(key);
                    binding = {
                        kind: "ili9341",
                        mcuFigureId,
                        figureId,
                        overlay,
                        device: new Ili9341SpiDevice(`ili9341-${figureId}`),
                    };
                    this.ili9341s.push(binding);
                }
                return binding;
            };
            if (pk === "D/C" || pk === "DC" || pk === "RS") {
                const binding = ensureIli();
                if (binding) binding.dc = drive;
                return;
            }
            if (pk === "CS" || pk === "SS") {
                const binding = ensureIli();
                if (binding) binding.cs = drive;
                return;
            }
            if (pk === "MOSI" || pk === "SCK") {
                ensureIli();
                return;
            }
            return;
        }

        if (clasz === HCSR04Element) {
            if (!avr) return;
            if (pk !== "TRIG" && pk !== "ECHO") return;
            const key = `${mcuFigureId}|${figureId}|hcsr04`;
            let binding = this.hcSr04s.find(
                (b) => b.mcuFigureId === mcuFigureId && b.figureId === figureId,
            );
            if (!binding) {
                if (seen.has(key)) return;
                seen.add(key);
                const el = overlay as { value?: number; min?: number; max?: number };
                if (el.value === undefined) {
                    el.min = 2;
                    el.max = 400;
                    el.value = 100;
                }
                if (el.min === undefined) el.min = 2;
                if (el.max === undefined) el.max = 400;
                binding = {
                    kind: "hcsr04",
                    mcuFigureId,
                    figureId,
                    overlay,
                    sim: new HcSr04Simulator({ distanceCm: Number(el.value) || 100 }),
                };
                this.hcSr04s.push(binding);
            }
            if (pk === "TRIG") binding.trig = avr;
            if (pk === "ECHO") binding.echo = avr;
            return;
        }

        if (clasz === PushbuttonElement || clasz === Pushbutton6mmElement) {
            const key = `${mcuFigureId}|${figureId}|btn|${driveKey}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "button",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                gpio,
                figureId,
                overlay,
                onPress: () => this.setExternalPin(mcuFigureId, drive, false),
                onRelease: () => this.setExternalPin(mcuFigureId, drive, true),
            });
            return;
        }

        if (clasz === SlideSwitchElement) {
            const key = `${mcuFigureId}|${figureId}|sw|${driveKey}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "switch",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                gpio,
                figureId,
                overlay,
            });
            return;
        }

        if (clasz === DipSwitch8Element) {
            const dipIndex = dipIndexFromPort(pk);
            if (dipIndex < 0) return;
            const key = `${mcuFigureId}|${figureId}|dip|${dipIndex}|${driveKey}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "dip",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                gpio,
                figureId,
                overlay,
                dipIndex,
            });
            return;
        }

        if (clasz === KY040Element) {
            if (pk !== "SW") return;
            const key = `${mcuFigureId}|${figureId}|ky040sw|${driveKey}`;
            if (seen.has(key)) return;
            seen.add(key);
            this.digitalIns.push({
                kind: "digital-in",
                mode: "encoder-sw",
                mcuFigureId,
                port: avrPort,
                bit: avrBit,
                gpio,
                figureId,
                overlay,
            });
            return;
        }

        if (clasz === AnalogJoystickElement) {
            if (pk === "SEL") {
                const key = `${mcuFigureId}|${figureId}|joy-sel|${driveKey}`;
                if (seen.has(key)) return;
                seen.add(key);
                this.digitalIns.push({
                    kind: "digital-in",
                    mode: "button",
                    mcuFigureId,
                    port: avrPort,
                    bit: avrBit,
                    gpio,
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

        // Capteurs modules : clic = bascule DO/DOUT ; AO → ADC (molette = curseur)
        const sensor = sensorProfile(clasz);
        if (sensor) {
            if (sensor.analogPins.includes(pk) && adcChannel !== undefined) {
                const key = `${mcuFigureId}|${figureId}|sensor-ao|${adcChannel}`;
                if (seen.has(key)) return;
                seen.add(key);
                const mode = clasz === PhotoresistorSensorElement ? "lux" : "sensor";
                this.analogIns.push({
                    kind: "analog-in",
                    mode,
                    mcuFigureId,
                    adcChannel,
                    figureId,
                    overlay,
                });
                // Grandeur 0–100 (lux relatif ou intensité) pilotable à la molette
                const el = overlay as { value?: number; min?: number; max?: number };
                if (el.value === undefined) {
                    el.min = 0;
                    el.max = 100;
                    el.value = 50;
                }
                if (el.min === undefined) el.min = 0;
                if (el.max === undefined) el.max = 100;
                return;
            }
            if (sensor.digitalPins.includes(pk)) {
                const key = `${mcuFigureId}|${figureId}|sensor-do|${driveKey}`;
                if (seen.has(key)) return;
                seen.add(key);
                this.digitalIns.push({
                    kind: "digital-in",
                    mode: "toggle",
                    mcuFigureId,
                    port: avrPort,
                    bit: avrBit,
                    gpio,
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
                        drive,
                        adcChannel,
                        seen,
                        visitedFigures,
                        mcuPinKey,
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
            if (binding.bit === undefined) continue;
            const high = isPinDrivenHigh(port.pinState(binding.bit));

            if (binding.kind === "digital-out") {
                this.applyDigitalOutBinding(binding, high);
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

            if (binding.kind === "neopixel") {
                const runner = this.emulator.getRunner(mcuFigureId);
                if (!runner) continue;
                if (binding.lastLevel === undefined || binding.lastLevel !== high) {
                    binding.decoder.edge(runner.cpu.cycles, high);
                    binding.lastLevel = high;
                }
                this.applyNeoColors(binding);
            }
            // Servo : mis à jour via OCR dans syncServoAndNeo (pas seulement HIGH/LOW).
        }
        this.applyHcSr04Trig(port, portName, mcuFigureId);
        this.applyDht22Data(port, portName, mcuFigureId);
        this.applyHx711Sck(port, portName, mcuFigureId);
        this.applyParallelLcdEnable(port, portName, mcuFigureId);
        this.applyIli9341Dc(port, portName, mcuFigureId);
        // Keypad / stepper : scan temps réel (pas seulement le poll 50 ms)
        this.syncKeypadsForMcu(mcuFigureId);
        this.syncSteppersForMcu(mcuFigureId);
    }

    private applyRpGpioOutputs(gpioIndex: number, high: boolean, mcuFigureId: string): void {
        for (const binding of this.outputBindings) {
            if (binding.kind !== "digital-out") continue;
            if (binding.mcuFigureId !== mcuFigureId || binding.gpio !== gpioIndex) continue;
            this.applyDigitalOutBinding(binding, high);
        }
        this.applyIli9341DcRp(gpioIndex, high, mcuFigureId);
        this.syncRelays();
    }

    private applyDigitalOutBinding(binding: DigitalOutBinding, high: boolean): void {
        const on = binding.activeLow ? !high : high;
        this.checkGpioShortFault(binding, high);
        const el = this.getOverlay(binding.figureId) as Record<string, unknown> | null;
        if (!el) return;
        if (binding.ledPhysics) {
            if (binding.burned) {
                el.value = false;
                el.brightness = 0;
                el.title = "LED grillée";
                return;
            }
            const result = evaluateLed({
                anodeHigh: on,
                seriesOhms: binding.seriesOhms,
            });
            if (result.burned) {
                binding.burned = true;
                el.value = false;
                el.brightness = 0;
                el.title = result.faultMessage ?? "LED grillée";
                this.emulator.events.emit("fault", {
                    boardId: binding.mcuFigureId,
                    code: result.faultCode ?? "led-fault",
                    message: result.faultMessage ?? "LED grillée",
                });
            } else {
                el.value = result.brightness > 0.02;
                el.brightness = result.brightness;
                el.title =
                    binding.seriesOhms !== undefined
                        ? `LED ${Math.round(result.brightness * 100)} % (${binding.seriesOhms} Ω)`
                        : "LED";
            }
            return;
        }
        el[binding.prop] = on;
        if (binding.prop === "energized") {
            el.title = on ? "Relais KS2E : bobine ON (NO fermé)" : "Relais KS2E : bobine OFF (NC fermé)";
        }
    }

    /** Faute pédagogique si la GPIO est câblée sur un rail (GND/VCC). */
    private checkGpioShortFault(binding: DigitalOutBinding, drivenHigh: boolean): void {
        if (!this.netlist || !binding.mcuPinKey || binding.shortFaulted) return;
        const r = detectGpioShort(
            this.netlist,
            binding.mcuFigureId,
            binding.mcuPinKey,
            drivenHigh,
        );
        if (!r.shorted) return;
        binding.shortFaulted = true;
        this.emulator.events.emit("fault", {
            boardId: binding.mcuFigureId,
            code: r.faultCode ?? "gpio-short",
            message: r.faultMessage ?? "Court-circuit GPIO.",
        });
        const kind = r.faultCode === "rail-short" ? "rail" : "gpio";
        const fuse = evaluateFuse({
            shorted: true,
            currentMa: estimateShortCurrentMa(kind),
        });
        if (fuse.blown) {
            this.emulator.events.emit("fault", {
                boardId: binding.mcuFigureId,
                code: fuse.faultCode ?? "fuse-blown",
                message: fuse.faultMessage ?? "Fusible grillé.",
            });
        }
    }

    /** Entrées digitales sur runner RP2040. */
    private syncRpDigitalIns(): void {
        for (const din of this.digitalIns) {
            if (din.gpio === undefined) continue;
            const rp = this.emulator.getRp2040Runner(din.mcuFigureId);
            if (!rp) continue;
            let level = true;
            if (din.mode === "button" || din.mode === "encoder-sw") {
                const pressed = Boolean((din.overlay as { pressed?: boolean }).pressed);
                level = !pressed;
            } else if (din.mode === "switch") {
                const value = Number((din.overlay as { value?: number }).value ?? 0);
                level = value === 0;
            } else if (din.mode === "toggle") {
                const active = Boolean(din.toggled);
                level = din.activeHigh ? active : !active;
                if (din.ledProp) {
                    (din.overlay as unknown as Record<string, unknown>)[din.ledProp] = active;
                }
            } else {
                continue;
            }
            rp.setGpioInput(din.gpio, level);
        }
    }

    /**
     * Relais : bobine ON → P1↔NO1 ; OFF → P1↔NC1 (forward vers LEDs).
     */
    private syncRelays(): void {
        for (const relay of this.relays) {
            const energized = this.readDriveHigh(relay.mcuFigureId, relay.coil);
            relay.energized = energized;
            const el = this.getOverlay(relay.figureId) as Record<string, unknown> | null;
            if (el) {
                el.energized = energized;
                el.title = energized
                    ? "Relais : contacts NO fermés"
                    : "Relais : contacts NC fermés";
            }
            if (!relay.p1) continue;
            const p1High = this.readDriveHigh(relay.mcuFigureId, relay.p1);
            const activeIds = energized ? relay.no1FigureIds : relay.nc1FigureIds;
            const idleIds = energized ? relay.nc1FigureIds : relay.no1FigureIds;
            for (const ledId of activeIds) {
                this.forwardRelayToLed(ledId, p1High);
            }
            // Contact ouvert : éteint les LEDs de l’autre côté
            for (const ledId of idleIds) {
                this.forwardRelayToLed(ledId, false);
            }
        }
    }

    private forwardRelayToLed(ledId: string, high: boolean): void {
        const out = this.outputBindings.find(
            (b) =>
                b.kind === "digital-out" &&
                b.figureId === ledId &&
                (b.ledPhysics || b.prop === "value"),
        );
        if (out && out.kind === "digital-out") {
            this.applyDigitalOutBinding(out, high);
        }
    }

    private readDriveHigh(mcuFigureId: string, drive: McuDriveRef): boolean {
        if (isAvrDrive(drive)) {
            const runner = this.emulator.getRunner(mcuFigureId);
            if (!runner) return false;
            return isPinDrivenHigh(portByName(runner, drive.port).pinState(drive.bit));
        }
        const rp = this.emulator.getRp2040Runner(mcuFigureId);
        return rp ? rp.isGpioHigh(drive.gpio) : false;
    }

    /** Met à jour angles servo (PWM) et flush NeoPixel. */
    private syncServoAndNeo(): void {
        for (const binding of this.outputBindings) {
            if (binding.kind === "servo") {
                const runner = this.emulator.getRunner(binding.mcuFigureId);
                const el = this.getOverlay(binding.figureId) as {
                    angle?: number;
                    title?: string;
                } | null;
                if (!runner || !el) continue;
                const commanded = estimateServoAngleDeg(
                    runner.cpu,
                    binding.pwmPin,
                    runner.speed,
                );
                const phys = evaluateServo(
                    {
                        commandedDeg: commanded,
                        powered: binding.powered !== false,
                    },
                    binding.lastAngleDeg ?? 90,
                );
                el.angle = phys.angleDeg;
                binding.lastAngleDeg = phys.angleDeg;
                if (phys.stalled) {
                    el.title = phys.faultMessage ?? "Servo bloqué";
                } else {
                    el.title = `Servo ${Math.round(phys.angleDeg)}°`;
                }
                continue;
            }
            if (binding.kind === "neopixel") {
                this.applyNeoColors(binding);
            }
        }
    }

    private applyNeoColors(binding: NeoPixelBinding): void {
        binding.decoder.flush();
        const el = this.getOverlay(binding.figureId) as {
            r?: number;
            g?: number;
            b?: number;
            setPixel?: (a: number, b: number | { r: number; g: number; b: number }, c?: { r: number; g: number; b: number }) => void;
            reset?: () => void;
        } | null;
        if (!el) return;
        const colors = binding.decoder.colors;
        if (binding.layout.mode === "single") {
            const c = colors[0] ?? { r: 0, g: 0, b: 0 };
            el.r = c.r;
            el.g = c.g;
            el.b = c.b;
            return;
        }
        if (!el.setPixel) return;
        if (binding.layout.mode === "ring") {
            for (let i = 0; i < binding.layout.count; i++) {
                const c = colors[i] ?? { r: 0, g: 0, b: 0 };
                el.setPixel(i, { r: c.r / 255, g: c.g / 255, b: c.b / 255 });
            }
            return;
        }
        const { rows, cols } = binding.layout;
        for (let i = 0; i < rows * cols; i++) {
            const c = colors[i] ?? { r: 0, g: 0, b: 0 };
            const row = Math.floor(i / cols);
            const col = i % cols;
            el.setPixel(row, col, { r: c.r / 255, g: c.g / 255, b: c.b / 255 });
        }
    }

    private attachI2cDevices(): void {
        for (const binding of this.i2cDisplays) {
            this.emulator.attachI2cDevice(binding.mcuFigureId, binding.device);
            if (binding.alias) {
                this.emulator.attachI2cDevice(binding.mcuFigureId, binding.alias);
            }
        }
    }

    private detachI2cDevices(): void {
        for (const binding of this.i2cDisplays) {
            const runner = this.emulator.getRunner(binding.mcuFigureId);
            runner?.bus.detachI2c(binding.device.address);
            if (binding.alias) runner?.bus.detachI2c(binding.alias.address);
        }
    }

    /** Pousse le texte LCD / framebuffer OLED vers les overlays Wokwi. */
    private syncI2cDisplays(): void {
        for (const binding of this.i2cDisplays) {
            const el = this.getOverlay(binding.figureId);
            if (!el) continue;
            if (binding.kind === "lcd" && binding.device instanceof Lcd1602I2cDevice) {
                const lcd = el as unknown as { text?: string; backlight?: boolean };
                lcd.text = binding.device.lines.join("");
                lcd.backlight = binding.device.backlight;
                continue;
            }
            if (binding.kind === "oled" && binding.device instanceof Ssd1306Device) {
                if (!binding.device.isDirty) continue;
                const oled = el as unknown as {
                    imageData?: ImageData;
                    redraw?: () => void;
                };
                if (!oled.imageData) continue;
                paintSsd1306Frame(binding.device, oled.imageData);
                oled.redraw?.();
                binding.device.clearDirty();
                continue;
            }
            if (binding.kind === "pca9685" && binding.device instanceof Pca9685Device) {
                const pca = el as Pca9685Element;
                if (!pca.angles || pca.angles.length !== 16) {
                    pca.angles = Array.from({ length: 16 }, () => 0);
                }
                for (let ch = 0; ch < 16; ch++) {
                    pca.angles[ch] = binding.device.channelServoAngleDeg(ch);
                }
                pca.refresh();
                continue;
            }
            if (binding.kind === "ds1307" && binding.device instanceof Ds1307Device) {
                const now = performance.now();
                if (this.lastRtcWallMs === 0) this.lastRtcWallMs = now;
                const elapsed = now - this.lastRtcWallMs;
                if (elapsed >= 1000) {
                    const ticks = Math.min(5, Math.floor(elapsed / 1000));
                    binding.device.tickSeconds(ticks);
                    this.lastRtcWallMs += ticks * 1000;
                }
                (el as unknown as { timeLabel?: string }).timeLabel = binding.device.timeLabel;
                if (el.title !== undefined) {
                    el.title = `DS1307 ${binding.device.timeLabel}`;
                }
                continue;
            }
            if (binding.kind === "mpu6050" && binding.device instanceof Mpu6050Device) {
                const ov = binding.overlay as { value?: number; led1?: boolean } | undefined;
                const tiltDeg = Number(ov?.value ?? 0);
                const ax = Math.round((tiltDeg / 90) * 16384);
                const az = Math.round(Math.sqrt(Math.max(0, 16384 ** 2 - ax ** 2)));
                binding.device.setMotion({ x: ax, y: 0, z: az });
                if (ov) ov.led1 = true;
                el.title = `MPU6050 tilt ${Math.round(tiltDeg)}°`;
            }
        }
    }

    private applyHcSr04Trig(
        port: AVRIOPort,
        portName: AvrGpioPortName,
        mcuFigureId: string,
    ): void {
        for (const binding of this.hcSr04s) {
            if (binding.mcuFigureId !== mcuFigureId || !binding.trig) continue;
            if (binding.trig.port !== portName) continue;
            const runner = this.emulator.getRunner(mcuFigureId);
            if (!runner) continue;
            const high = isPinDrivenHigh(port.pinState(binding.trig.bit));
            if (binding.lastTrigHigh === high) continue;
            binding.lastTrigHigh = high;
            binding.sim.onTrig(runner.cpu.cycles, high);
            if (!high && binding.echo) {
                const echoPort = portByName(runner, binding.echo.port);
                const bit = binding.echo.bit;
                // Ne programme l’écho que si le pulse TRIG était valide
                binding.sim.scheduleEcho(runner.cpu, (level) => echoPort.setPin(bit, level));
            }
        }
    }

    private syncHcSr04Distances(): void {
        for (const binding of this.hcSr04s) {
            const el = binding.overlay as { value?: number };
            if (typeof el.value === "number") {
                binding.sim.setDistanceCm(el.value);
            }
        }
    }

    private wireHcSr04Listeners(): void {
        for (const binding of this.hcSr04s) {
            binding.onWheel = (ev: WheelEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                const el = binding.overlay as { value?: number; min?: number; max?: number };
                const min = Number(el.min ?? 2);
                const max = Number(el.max ?? 400);
                const step = (max - min) / 40 || 1;
                const cur = Number(el.value ?? 100);
                const next = Math.min(max, Math.max(min, cur + (ev.deltaY < 0 ? step : -step)));
                el.value = next;
                binding.sim.setDistanceCm(next);
            };
            binding.overlay.addEventListener("wheel", binding.onWheel, { passive: false });
            binding.overlay.title = binding.overlay.title || "Molette : distance HC-SR04 (cm)";
        }
    }

    private clearHcSr04Listeners(): void {
        for (const binding of this.hcSr04s) {
            if (binding.onWheel) binding.overlay.removeEventListener("wheel", binding.onWheel);
        }
    }

    private clearHcSr04Echoes(): void {
        for (const binding of this.hcSr04s) {
            const runner = this.emulator.getRunner(binding.mcuFigureId);
            binding.sim.clearScheduledEcho(runner?.cpu);
            if (runner && binding.echo) {
                portByName(runner, binding.echo.port).setPin(binding.echo.bit, false);
            }
        }
    }

    private applyDht22Data(
        port: AVRIOPort,
        portName: AvrGpioPortName,
        mcuFigureId: string,
    ): void {
        for (const binding of this.dht22s) {
            if (binding.mcuFigureId !== mcuFigureId) continue;
            if (binding.port !== portName) continue;
            const runner = this.emulator.getRunner(mcuFigureId);
            if (!runner) continue;
            const high = !isPinDrivenLow(port.pinState(binding.bit));
            if (binding.lastHigh === high) continue;
            binding.lastHigh = high;
            const dataPort = portByName(runner, binding.port);
            const bit = binding.bit;
            binding.sim.onDataLevel(runner.cpu.cycles, high, runner.cpu, (level) => {
                dataPort.setPin(bit, level);
            });
        }
    }

    private syncDht22Climate(): void {
        for (const binding of this.dht22s) {
            const el = binding.overlay as { temperature?: number; humidity?: number };
            const t = Number(el.temperature ?? 25);
            const h = Number(el.humidity ?? 50);
            binding.sim.setClimate(t, h);
        }
    }

    private wireDht22Listeners(): void {
        for (const binding of this.dht22s) {
            binding.onWheel = (ev: WheelEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                const el = binding.overlay as { temperature?: number; humidity?: number };
                const shift = ev.shiftKey;
                if (shift) {
                    const cur = Number(el.humidity ?? 50);
                    el.humidity = Math.min(100, Math.max(0, cur + (ev.deltaY < 0 ? 2 : -2)));
                } else {
                    const cur = Number(el.temperature ?? 25);
                    el.temperature = Math.min(80, Math.max(-40, cur + (ev.deltaY < 0 ? 0.5 : -0.5)));
                }
                binding.sim.setClimate(Number(el.temperature), Number(el.humidity));
            };
            binding.overlay.addEventListener("wheel", binding.onWheel, { passive: false });
            binding.overlay.title =
                binding.overlay.title || "Molette : température (°C) — Maj+molette : humidité (%)";
        }
    }

    private clearDht22Listeners(): void {
        for (const binding of this.dht22s) {
            if (binding.onWheel) binding.overlay.removeEventListener("wheel", binding.onWheel);
        }
    }

    private clearDht22Sims(): void {
        for (const binding of this.dht22s) {
            const runner = this.emulator.getRunner(binding.mcuFigureId);
            binding.sim.clear(runner?.cpu);
        }
    }

    private applyHx711Sck(
        port: AVRIOPort,
        portName: AvrGpioPortName,
        mcuFigureId: string,
    ): void {
        for (const binding of this.hx711s) {
            if (binding.mcuFigureId !== mcuFigureId || !binding.sck) continue;
            if (binding.sck.port !== portName) continue;
            const high = isPinDrivenHigh(port.pinState(binding.sck.bit));
            if (binding.lastSckHigh === high) continue;
            binding.lastSckHigh = high;
            binding.sim.onSck(high);
            this.pushHx711Dt(binding);
        }
    }

    private syncHx711Dt(): void {
        for (const binding of this.hx711s) {
            const el = binding.overlay as { value?: number };
            if (typeof el.value === "number") binding.sim.setGrams(el.value);
            this.pushHx711Dt(binding);
        }
    }

    private pushHx711Dt(binding: Hx711Binding): void {
        if (!binding.dt) return;
        const runner = this.emulator.getRunner(binding.mcuFigureId);
        if (!runner) return;
        portByName(runner, binding.dt.port).setPin(binding.dt.bit, binding.sim.dtLevel);
    }

    private wireHx711Listeners(): void {
        for (const binding of this.hx711s) {
            binding.onWheel = (ev: WheelEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                const el = binding.overlay as { value?: number; min?: number; max?: number };
                const min = Number(el.min ?? 0);
                const max = Number(el.max ?? 5000);
                const step = (max - min) / 50 || 1;
                const cur = Number(el.value ?? 0);
                const next = Math.min(max, Math.max(min, cur + (ev.deltaY < 0 ? step : -step)));
                el.value = next;
                binding.sim.setGrams(next);
            };
            binding.overlay.addEventListener("wheel", binding.onWheel, { passive: false });
            binding.overlay.title = binding.overlay.title || "Molette : masse HX711 (g)";
        }
    }

    private clearHx711Listeners(): void {
        for (const binding of this.hx711s) {
            if (binding.onWheel) binding.overlay.removeEventListener("wheel", binding.onWheel);
        }
    }

    private wireMpu6050Listeners(): void {
        for (const binding of this.i2cDisplays) {
            if (binding.kind !== "mpu6050" || !binding.overlay) continue;
            binding.onWheel = (ev: WheelEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                const el = binding.overlay as { value?: number; min?: number; max?: number };
                const min = Number(el.min ?? -90);
                const max = Number(el.max ?? 90);
                const cur = Number(el.value ?? 0);
                el.value = Math.min(max, Math.max(min, cur + (ev.deltaY < 0 ? 2 : -2)));
            };
            binding.overlay.addEventListener("wheel", binding.onWheel, { passive: false });
            binding.overlay.title = binding.overlay.title || "Molette : inclinaison MPU6050 (°)";
        }
    }

    private clearMpu6050Listeners(): void {
        for (const binding of this.i2cDisplays) {
            if (binding.kind !== "mpu6050" || !binding.overlay || !binding.onWheel) continue;
            binding.overlay.removeEventListener("wheel", binding.onWheel);
        }
    }

    private applyParallelLcdEnable(
        port: AVRIOPort,
        portName: AvrGpioPortName,
        mcuFigureId: string,
    ): void {
        for (const binding of this.parallelLcds) {
            if (binding.mcuFigureId !== mcuFigureId || !binding.e) continue;
            if (binding.e.port !== portName) continue;
            const runner = this.emulator.getRunner(mcuFigureId);
            if (!runner) continue;
            const high = isPinDrivenHigh(port.pinState(binding.e.bit));
            if (binding.lastEHigh === high) continue;
            binding.lastEHigh = high;
            if (high) continue; // front descendant E
            const pinHigh = (ref?: AvrPinRef) =>
                ref ? isPinDrivenHigh(portByName(runner, ref.port).pinState(ref.bit)) : false;
            const rs = pinHigh(binding.rs);
            const nib =
                (pinHigh(binding.d7) ? 8 : 0) |
                (pinHigh(binding.d6) ? 4 : 0) |
                (pinHigh(binding.d5) ? 2 : 0) |
                (pinHigh(binding.d4) ? 1 : 0);
            binding.core.writeNibble(nib, rs);
            const lcd = binding.overlay as { text?: string };
            lcd.text = binding.core.text.join("");
        }
    }

    private syncParallelLcds(): void {
        for (const binding of this.parallelLcds) {
            const lcd = binding.overlay as { text?: string };
            lcd.text = binding.core.text.join("");
        }
    }

    private syncSteppers(): void {
        for (const binding of this.steppers) {
            this.syncOneStepper(binding);
        }
    }

    private syncSteppersForMcu(mcuFigureId: string): void {
        for (const binding of this.steppers) {
            if (binding.mcuFigureId === mcuFigureId) this.syncOneStepper(binding);
        }
    }

    private syncOneStepper(binding: StepperBinding): void {
        const runner = this.emulator.getRunner(binding.mcuFigureId);
        if (!runner) return;
        const { ap, am, bp, bm } = binding.coils;
        const high = (ref?: AvrPinRef) =>
            ref ? isPinDrivenHigh(portByName(runner, ref.port).pinState(ref.bit)) : false;
        const angle = binding.sim.update(high(ap), high(am), high(bp), high(bm));
        const el = binding.overlay as unknown as Record<string, unknown>;
        el[binding.angleProp] = ((angle % 360) + 360) % 360;
        if (binding.angleProp === "angle") {
            el.value = `${Math.round(angle)}`;
            el.units = "deg";
        }
    }

    private syncKeypads(): void {
        for (const binding of this.keypads) {
            this.syncOneKeypad(binding);
        }
    }

    private syncKeypadsForMcu(mcuFigureId: string): void {
        for (const binding of this.keypads) {
            if (binding.mcuFigureId === mcuFigureId) this.syncOneKeypad(binding);
        }
    }

    private syncOneKeypad(binding: KeypadBinding): void {
        const runner = this.emulator.getRunner(binding.mcuFigureId);
        if (!runner) return;
        // Colonnes au repos (pull-up)
        for (const col of binding.cols) {
            if (!col) continue;
            portByName(runner, col.port).setPin(col.bit, true);
        }
        const pressed = readKeypadPressed(binding.overlay);
        const keys = (binding.overlay as { keys?: string[] }).keys ?? [];
        const stride = keys.length >= 16 ? 4 : binding.colCount;
        for (let r = 0; r < 4; r++) {
            const row = binding.rows[r];
            if (!row) continue;
            const rowLow = isPinDrivenLow(portByName(runner, row.port).pinState(row.bit));
            if (!rowLow) continue;
            for (let c = 0; c < binding.colCount; c++) {
                const label = keys[r * stride + c];
                if (!label || !pressed.has(label.toUpperCase())) continue;
                const col = binding.cols[c];
                if (!col) continue;
                portByName(runner, col.port).setPin(col.bit, false);
            }
        }
    }

    private attachIli9341(): void {
        for (const binding of this.ili9341s) {
            const cs = binding.cs;
            if (cs && isAvrDrive(cs)) {
                this.emulator.attachSpiDevice(binding.mcuFigureId, binding.device, {
                    select: false,
                    cs: { kind: "avr", port: cs.port, bit: cs.bit },
                });
            } else if (cs && "gpio" in cs) {
                this.emulator.attachSpiDevice(binding.mcuFigureId, binding.device, {
                    select: false,
                    cs: { kind: "rp", gpio: cs.gpio },
                });
            } else {
                this.emulator.attachSpiDevice(binding.mcuFigureId, binding.device, true);
            }
        }
    }

    private detachIli9341(): void {
        for (const binding of this.ili9341s) {
            const avr = this.emulator.getRunner(binding.mcuFigureId);
            if (avr) {
                avr.bus.detachSpi(binding.device.id);
                continue;
            }
            const rp = this.emulator.getRp2040Runner(binding.mcuFigureId);
            rp?.bus.detachSpi(binding.device.id);
            rp?.bus1.detachSpi(binding.device.id);
        }
    }

    private attachSdCards(): void {
        for (const binding of this.sdCards) {
            binding.device.seedFat16({
                "README.TXT": "LibreCircuit microSD\n",
                "HELLO.TXT": "Hello from FAT16\n",
            });
            const cs = binding.cs;
            if (cs && isAvrDrive(cs)) {
                this.emulator.attachSpiDevice(binding.mcuFigureId, binding.device, {
                    select: false,
                    cs: { kind: "avr", port: cs.port, bit: cs.bit },
                });
            } else if (cs && "gpio" in cs) {
                this.emulator.attachSpiDevice(binding.mcuFigureId, binding.device, {
                    select: false,
                    cs: { kind: "rp", gpio: cs.gpio },
                });
            } else {
                this.emulator.attachSpiDevice(binding.mcuFigureId, binding.device, true);
            }
        }
    }

    private detachSdCards(): void {
        for (const binding of this.sdCards) {
            const avr = this.emulator.getRunner(binding.mcuFigureId);
            if (avr) {
                avr.bus.detachSpi(binding.device.id);
                continue;
            }
            const rp = this.emulator.getRp2040Runner(binding.mcuFigureId);
            rp?.bus.detachSpi(binding.device.id);
            rp?.bus1.detachSpi(binding.device.id);
        }
    }

    private clearIrRemoteListeners(): void {
        for (const off of this.irRemoteCleanups) off();
        this.irRemoteCleanups = [];
    }

    /** Télécommandes IR : broadcast NEC vers tous les récepteurs du plan. */
    private wireIrRemoteListeners(): void {
        this.clearIrRemoteListeners();
        const figures = this.editor.canvas.getFigures?.()?.data ?? [];
        for (const fig of figures) {
            if (!(fig instanceof ComponentFigure)) continue;
            const info = fig.getComponentInfo();
            if (!isWokwiComponent(info) || info.clasz !== IRRemoteElement) continue;
            const overlay = fig.getOverlayElement();
            if (!overlay) continue;
            const onPress = (ev: Event) => {
                const detail = (ev as CustomEvent<{ irCode?: number }>).detail;
                const code = Number(detail?.irCode ?? 0) & 0xff;
                this.broadcastIrCommand(code);
            };
            overlay.addEventListener("button-press", onPress);
            this.irRemoteCleanups.push(() => overlay.removeEventListener("button-press", onPress));
        }
    }

    private broadcastIrCommand(command: number): void {
        for (const binding of this.irReceivers) {
            const avr = this.emulator.getRunner(binding.mcuFigureId);
            if (avr) {
                binding.sim.transmit(command, avr.cpu.cycles);
                continue;
            }
            const rp = this.emulator.getRp2040Runner(binding.mcuFigureId);
            if (rp) {
                // Approx : cycles ≈ nanos / (1e9/125e6) via clock — utilise un compteur local
                const cycle = Math.floor(performance.now() * 125_000);
                binding.sim.transmit(command, cycle);
            }
        }
    }

    private syncIrReceivers(): void {
        for (const binding of this.irReceivers) {
            const avr = this.emulator.getRunner(binding.mcuFigureId);
            if (avr && isAvrDrive(binding.drive)) {
                const high = binding.sim.datLevel(avr.cpu.cycles);
                portByName(avr, binding.drive.port).setPin(binding.drive.bit, high);
                continue;
            }
            const rp = this.emulator.getRp2040Runner(binding.mcuFigureId);
            if (rp && !isAvrDrive(binding.drive)) {
                const cycle = Math.floor(performance.now() * 125_000);
                const high = binding.sim.datLevel(cycle);
                rp.setGpioInput(binding.drive.gpio, high);
            }
        }
    }

    private applyIli9341Dc(
        port: AVRIOPort,
        portName: AvrGpioPortName,
        mcuFigureId: string,
    ): void {
        for (const binding of this.ili9341s) {
            if (binding.mcuFigureId !== mcuFigureId || !binding.dc) continue;
            if (!isAvrDrive(binding.dc) || binding.dc.port !== portName) continue;
            const high = isPinDrivenHigh(port.pinState(binding.dc.bit));
            if (binding.lastDcHigh === high) continue;
            binding.lastDcHigh = high;
            binding.device.setDc(high);
        }
    }

    private applyIli9341DcRp(gpioIndex: number, high: boolean, mcuFigureId: string): void {
        for (const binding of this.ili9341s) {
            if (binding.mcuFigureId !== mcuFigureId || !binding.dc) continue;
            if (isAvrDrive(binding.dc) || binding.dc.gpio !== gpioIndex) continue;
            if (binding.lastDcHigh === high) continue;
            binding.lastDcHigh = high;
            binding.device.setDc(high);
        }
    }

    private syncIli9341(): void {
        for (const binding of this.ili9341s) {
            if (!binding.device.isDirty) continue;
            binding.device.clearDirty();
            const el = binding.overlay as { canvas?: HTMLCanvasElement | null };
            const canvas = el.canvas ?? null;
            if (!canvas) continue;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            const img = ctx.createImageData(binding.device.width, binding.device.height);
            ili9341ToRgba(binding.device, img.data);
            ctx.putImageData(img, 0, 0);
        }
    }

    private syncDigitalIns(runner: AvrRunnerLike, mcuFigureId: string): void {
        for (const din of this.digitalIns) {
            if (din.mcuFigureId !== mcuFigureId) continue;
            if (din.port === undefined || din.bit === undefined) continue; // Pico → syncRpDigitalIns
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
                port.setPin(din.bit, din.activeHigh ? active : !active);
                if (din.ledProp) {
                    (din.overlay as unknown as Record<string, unknown>)[din.ledProp] = active;
                }
            }
        }
    }

    private syncAnalogIns(runner: AvrRunnerLike, mcuFigureId: string): void {
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
            } else if (ain.mode === "lux") {
                const min = Number(el.min ?? 0);
                const max = Number(el.max ?? 100);
                const value = Number(el.value ?? min);
                const span = max - min || 1;
                const lux = ((value - min) / span) * 1000;
                volts = luxToSensorVolts(lux, 1000);
            } else if (ain.mode === "ntc") {
                const tEl = el as { temperature?: number; value?: number; min?: number; max?: number };
                const min = Number(tEl.min ?? -10);
                const max = Number(tEl.max ?? 50);
                const t = Number(tEl.temperature ?? tEl.value ?? 25);
                volts = temperatureToSensorVolts(t, min, max);
            } else if (ain.mode === "sensor") {
                const min = Number(el.min ?? 0);
                const max = Number(el.max ?? 100);
                const value = Number(el.value ?? min);
                const span = max - min || 1;
                volts = normalizedToAdcVolts((value - min) / span);
            } else {
                const min = Number(el.min ?? 0);
                const max = Number(el.max ?? 100);
                const value = Number(el.value ?? min);
                const span = max - min || 1;
                volts = normalizedToAdcVolts((value - min) / span);
            }
            runner.adc.channelValues[ain.adcChannel] = volts;
        }
    }

    private setExternalPin(mcuFigureId: string, drive: McuDriveRef, value: boolean): void {
        if (isAvrDrive(drive)) {
            const runner = this.emulator.getRunner(mcuFigureId);
            if (!runner) return;
            portByName(runner, drive.port).setPin(drive.bit, value);
            return;
        }
        const rp = this.emulator.getRp2040Runner(mcuFigureId);
        rp?.setGpioInput(drive.gpio, value);
    }

    private wireDigitalInListeners(): void {
        for (const din of this.digitalIns) {
            if (din.mode === "button" && din.onPress && din.onRelease) {
                din.overlay.addEventListener("button-press", din.onPress);
                din.overlay.addEventListener("button-release", din.onRelease);
                const pressed = Boolean((din.overlay as { pressed?: boolean }).pressed);
                const drive: McuDriveRef | undefined =
                    din.port !== undefined && din.bit !== undefined
                        ? { port: din.port, bit: din.bit }
                        : din.gpio !== undefined
                          ? { gpio: din.gpio }
                          : undefined;
                if (drive) this.setExternalPin(din.mcuFigureId, drive, !pressed);
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

    /** Molette sur capteurs AO / NTC : ajuste `value` (ou `temperature`) pour l’ADC. */
    private wireAnalogInListeners(): void {
        for (const ain of this.analogIns) {
            if (ain.mode !== "lux" && ain.mode !== "sensor" && ain.mode !== "ntc") continue;
            ain.onWheel = (ev: WheelEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                const el = ain.overlay as { value?: number; temperature?: number; min?: number; max?: number };
                const min = Number(el.min ?? (ain.mode === "ntc" ? -10 : 0));
                const max = Number(el.max ?? (ain.mode === "ntc" ? 50 : 100));
                const step = (max - min) / 20 || 1;
                const cur = Number(
                    ain.mode === "ntc"
                        ? (el.temperature ?? el.value ?? 25)
                        : (el.value ?? (min + max) / 2),
                );
                const next = Math.min(max, Math.max(min, cur + (ev.deltaY < 0 ? step : -step)));
                el.value = next;
                if (ain.mode === "ntc") el.temperature = next;
            };
            ain.overlay.addEventListener("wheel", ain.onWheel, { passive: false });
            ain.overlay.title =
                ain.overlay.title ||
                (ain.mode === "ntc" ? "Molette : température NTC (°C)" : "Molette : intensité capteur");
        }
    }

    private clearAnalogInListeners(): void {
        for (const ain of this.analogIns) {
            if (ain.onWheel) ain.overlay.removeEventListener("wheel", ain.onWheel);
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
                if (binding.layout.mode === "single") {
                    el.r = 0;
                    el.g = 0;
                    el.b = 0;
                } else {
                    (el as { reset?: () => void }).reset?.();
                }
            }
        }
        for (const binding of this.i2cDisplays) {
            const el = this.getOverlay(binding.figureId) as Record<string, unknown> | null;
            if (!el) continue;
            if (binding.kind === "lcd") {
                el.text = " ".repeat(32);
                el.backlight = true;
            } else if (binding.kind === "oled" && el.imageData instanceof ImageData) {
                el.imageData.data.fill(0);
                (el as { redraw?: () => void }).redraw?.();
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

    /** Construit la netlist LC depuis la table MCU + types de pièces du canvas. */
    private buildEditorNetlist(
        table: ReturnType<Editor["getMcuPinConnectionTable"]>,
    ): Netlist {
        const partHints: Record<string, { type: string; attrs?: Record<string, string> }> = {};
        const figures = this.editor.canvas.getFigures?.()?.data ?? [];
        for (const fig of figures) {
            if (!(fig instanceof ComponentFigure)) continue;
            const id = String(fig.getId());
            const info = fig.getComponentInfo();
            const overlay = fig.getOverlayElement() as {
                value?: number | string;
                resistance?: number | string;
            } | null;
            const attrs: Record<string, string> = {};
            if (overlay?.resistance !== undefined) attrs.resistance = String(overlay.resistance);
            else if (overlay?.value !== undefined) attrs.value = String(overlay.value);
            const className =
                isWokwiComponent(info) && info.clasz?.name ? info.clasz.name : "";
            partHints[id] = {
                type: className || info.name || "component",
                attrs,
            };
        }
        return buildNetlist(diagramFromMcuPinTable(table, { partHints }));
    }
}

function isPinDrivenHigh(state: PinState): boolean {
    return state === PinState.High;
}

function isPinDrivenLow(state: PinState): boolean {
    return state === PinState.Low;
}

/** Figures connectées à une broche contact d’un relais (hors le relais). */
function contactPeerFigureIds(
    netlist: Netlist,
    relayFigureId: string,
    pin: "NO1" | "NC1",
): string[] {
    const peers = peersOf(netlist, { partId: relayFigureId, pin });
    const ids = new Set<string>();
    for (const ep of peers) {
        if (ep.partId !== relayFigureId) ids.add(ep.partId);
    }
    return [...ids];
}

function parallelLcdPinFromPort(
    pk: string,
): "rs" | "e" | "d4" | "d5" | "d6" | "d7" | undefined {
    if (pk === "RS") return "rs";
    if (pk === "E" || pk === "EN" || pk === "ENABLE") return "e";
    if (pk === "D4") return "d4";
    if (pk === "D5") return "d5";
    if (pk === "D6") return "d6";
    if (pk === "D7") return "d7";
    return undefined;
}

function stepperCoilFromPort(pk: string): keyof StepperCoilMap | undefined {
    if (pk === "A+" || pk === "A") return "ap";
    if (pk === "A-" || pk === "A−") return "am";
    if (pk === "B+" || pk === "B") return "bp";
    if (pk === "B-" || pk === "B−") return "bm";
    return undefined;
}

function biaxialCoilFromPort(
    pk: string,
): { angleProp: "outerHandAngle" | "innerHandAngle"; coil: keyof StepperCoilMap } | undefined {
    const m = /^([AB])([12])([+-])$/.exec(pk);
    if (!m) return undefined;
    const coilLetter = m[1]!;
    const axis = m[2]!;
    const sign = m[3]!;
    const angleProp = axis === "1" ? "outerHandAngle" : "innerHandAngle";
    let coil: keyof StepperCoilMap;
    if (coilLetter === "A" && sign === "+") coil = "ap";
    else if (coilLetter === "A" && sign === "-") coil = "am";
    else if (coilLetter === "B" && sign === "+") coil = "bp";
    else coil = "bm";
    return { angleProp, coil };
}

function keypadRowFromPort(pk: string): number {
    const m = /^R([1-4])$/.exec(pk);
    return m ? Number(m[1]) - 1 : -1;
}

function keypadColFromPort(pk: string): number {
    const m = /^C([1-4])$/.exec(pk);
    return m ? Number(m[1]) - 1 : -1;
}

/** Touches enfoncées sur le keypad Wokwi (shadow DOM). */
function readKeypadPressed(overlay: HTMLElement): Set<string> {
    const out = new Set<string>();
    const root = overlay.shadowRoot;
    if (!root) return out;
    for (const node of root.querySelectorAll(".pressed")) {
        const name =
            (node as HTMLElement).dataset?.keyName ??
            node.textContent?.trim() ??
            "";
        if (name) out.add(name);
    }
    return out;
}

function portByName(runner: AvrRunnerLike, name: AvrGpioPortName): AVRIOPort {
    if (isMegaAvrRunner(runner)) return runner.portByName(name);
    if (name === "B") return runner.portB;
    if (name === "C") return runner.portC;
    if (name === "D") return runner.portD;
    // Ports Mega absents sur 328P
    throw new Error(`Port ${name} indisponible sur ATmega328P`);
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

/** Canal ADC pour A0–A15 (Uno : 0–5 ; Mega : 0–15). */
function analogChannelFromPinKey(pinKey: string): number | undefined {
    const raw = pinKey.trim();
    const base = raw.includes(".") ? raw.slice(0, raw.indexOf(".")) : raw;
    const m = /^A(\d{1,2})$/i.exec(base);
    if (!m) {
        const uno = normalizeUnoPinKey(pinKey);
        if (!uno) return undefined;
        const m2 = /^A([0-5])$/i.exec(uno);
        return m2 ? Number(m2[1]) : undefined;
    }
    const n = Number(m[1]);
    return n >= 0 && n <= 15 ? n : undefined;
}

/** Numéro de broche digitale Uno (0–13) depuis la clé silk. */
function unoDigitalPinNumber(pinKey: string): number | undefined {
    const key = normalizeUnoPinKey(pinKey);
    if (!key || /^A\d$/i.test(key)) return undefined;
    const n = Number(key);
    return Number.isFinite(n) && n >= 0 && n <= 13 ? n : undefined;
}

function dipIndexFromPort(pk: string): number {
    const m = /^([1-8])[AB]$/.exec(pk);
    if (!m) return -1;
    return Number(m[1]) - 1;
}

/** Convertit le framebuffer page-mode SSD1306 → ImageData RGBA Wokwi. */
function paintSsd1306Frame(device: Ssd1306Device, imageData: ImageData): void {
    const w = device.width;
    const h = device.height;
    const pages = Math.ceil(h / 8);
    const data = imageData.data;
    const on = device.isDisplayOn;
    for (let page = 0; page < pages; page++) {
        for (let x = 0; x < w; x++) {
            const byte = device.framebuffer[page * w + x] ?? 0;
            for (let bit = 0; bit < 8; bit++) {
                const y = page * 8 + bit;
                if (y >= h) continue;
                const i = (y * w + x) * 4;
                const lit = on && ((byte >> bit) & 1) !== 0;
                data[i] = lit ? 160 : 0;
                data[i + 1] = lit ? 220 : 0;
                data[i + 2] = lit ? 255 : 0;
                data[i + 3] = 255;
            }
        }
    }
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
