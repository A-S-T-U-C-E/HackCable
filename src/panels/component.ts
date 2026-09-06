/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Catalogue de composants Wokwi et Fritzing (types, registre, éléments UI).
 *
 * Responsabilités :
 * - Registre Wokwi (ids, classes Lit, i18n)
 * - Fusion + dédoublonnage avec le cache Fritzing
 * - `ComponentElement` : vignette catalogue dimensionnée
 */
import {
    AnalogJoystickElement,
    ArduinoMegaElement,
    ArduinoNanoElement,
    ArduinoUnoElement,
    BiaxialStepperElement,
    BigSoundSensorElement,
    BuzzerElement,
    Dht22Element,
    DipSwitch8Element,
    Ds1307Element,
    ESP32DevkitV1Element,
    FlameSensorElement,
    FranzininhoElement,
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
    LedBarGraphElement,
    LEDElement,
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
    RotaryDialerElement,
    ServoElement,
    SevenSegmentElement,
    SlidePotentiometerElement,
    SlideSwitchElement,
    SmallSoundSensorElement,
    SSD1306Element,
    StepperMotorElement,
    TiltSwitchElement,
} from "@wokwi/elements";
import { tr } from "../ui/i18n/translate";
import { dedupeCatalogAgainstWokwi } from "./catalog-dedupe";
import { getStoredFritzingComponents } from "./fritzing-sync";
import type { FritzingComponentInfo } from "./fritzing-types";
import {
    type FritzingCategory,
} from "./fritzing-categories";
import { scaleToCatalogPreview } from "../editor/canvas-scale";
import { fritzingDisplaySizeFromInches } from "../editor/coordinate-port-locator";
import { measureWokwiSvgSize } from "../utils/dom";
export type { FritzingComponentInfo } from "./fritzing-types";
export { syncFritzingCatalog } from "./fritzing-sync";

export declare type WokwiComponent =
    | AnalogJoystickElement
    | ArduinoMegaElement
    | ArduinoNanoElement
    | ArduinoUnoElement
    | BiaxialStepperElement
    | BigSoundSensorElement
    | BuzzerElement
    | Dht22Element
    | DipSwitch8Element
    | Ds1307Element
    | ESP32DevkitV1Element
    | FlameSensorElement
    | FranzininhoElement
    | GasSensorElement
    | HCSR04Element
    | HeartBeatSensorElement
    | HX711Element
    | ILI9341Element
    | IRReceiverElement
    | IRRemoteElement
    | KS2EMDC5Element
    | KY040Element
    | LCD1602Element
    | LCD2004Element
    | LedBarGraphElement
    | LEDElement
    | LEDRingElement
    | MembraneKeypadElement
    | MicrosdCardElement
    | MPU6050Element
    | NanoRP2040ConnectElement
    | NeoPixelElement
    | NeopixelMatrixElement
    | NTCTemperatureSensorElement
    | PhotoresistorSensorElement
    | PIRMotionSensorElement
    | PotentiometerElement
    | Pushbutton6mmElement
    | PushbuttonElement
    | ResistorElement
    | RGBLedElement
    | RotaryDialerElement
    | ServoElement
    | SevenSegmentElement
    | SlidePotentiometerElement
    | SlideSwitchElement
    | SmallSoundSensorElement
    | SSD1306Element
    | StepperMotorElement
    | TiltSwitchElement;

export declare type WokwiClass = new (...args: never[]) => WokwiComponent;


export declare type WokwiComponentInfo = {
    id: number;
    source?: "wokwi";
    clasz: WokwiClass;
    name: string;
    description: string;
    type: ComponentType;
    category: FritzingCategory;
}
export type CatalogComponentInfo = WokwiComponentInfo | FritzingComponentInfo;
export declare type WokwiComponents = WokwiComponentInfo[]
export declare type WokwiComponentById = {[id: number]: WokwiComponentInfo}
export declare type WokwiComponentByClass = {[clasz: string]: WokwiComponentInfo}

export enum ComponentType {
    LED,
    MOTOR,
    TRANSMITTER,
    BUTTON,
    SENSOR,
    OTHER,
    CARD
}

/**
 * Mappe un type Wokwi vers une catégorie Fritzing du catalogue.
 * @param type - Type fonctionnel Wokwi.
 * @returns Catégorie Fritzing correspondante.
 */
export function wokwiTypeToFritzingCategory(type: ComponentType): FritzingCategory {
    switch (type) {
        case ComponentType.LED:
        case ComponentType.MOTOR:
        case ComponentType.TRANSMITTER:
            return "Output";
        case ComponentType.BUTTON:
        case ComponentType.SENSOR:
            return "Input";
        case ComponentType.OTHER:
            return "Basic";
        case ComponentType.CARD:
            return "Microcontroller";
        default:
            return "Basic";
    }
}

function wokwiEntry(
    id: number,
    clasz: WokwiClass,
    nameKey: string,
    descKey: string,
    type: ComponentType,
    category: FritzingCategory,
): WokwiComponentInfo {
    return {
        id,
        clasz,
        name: tr(nameKey),
        description: tr(descKey),
        type,
        category,
    };
}

/**
 * Retourne la liste des composants Wokwi intégrés avec libellés traduits.
 * @returns Tableau des entrées catalogue Wokwi.
 */
export const wokwiComponents = (): WokwiComponents => [
    // Cartes / MCU
    wokwiEntry(0, ArduinoUnoElement, "wokwiComponents.arduinoUno.name", "wokwiComponents.arduinoUno.description", ComponentType.CARD, "Microcontroller"),
    wokwiEntry(26, ArduinoMegaElement, "wokwiComponents.arduinoMega.name", "wokwiComponents.arduinoMega.description", ComponentType.CARD, "Microcontroller"),
    wokwiEntry(27, ArduinoNanoElement, "wokwiComponents.arduinoNano.name", "wokwiComponents.arduinoNano.description", ComponentType.CARD, "Microcontroller"),
    wokwiEntry(28, ESP32DevkitV1Element, "wokwiComponents.esp32Devkit.name", "wokwiComponents.esp32Devkit.description", ComponentType.CARD, "Microcontroller"),
    wokwiEntry(29, FranzininhoElement, "wokwiComponents.franzininho.name", "wokwiComponents.franzininho.description", ComponentType.CARD, "Microcontroller"),
    wokwiEntry(30, NanoRP2040ConnectElement, "wokwiComponents.nanoRp2040.name", "wokwiComponents.nanoRp2040.description", ComponentType.CARD, "Microcontroller"),
    // Affichage / LED
    wokwiEntry(1, LEDElement, "wokwiComponents.led.name", "wokwiComponents.led.description", ComponentType.LED, "Output"),
    wokwiEntry(2, RGBLedElement, "wokwiComponents.rgbLed.name", "wokwiComponents.rgbLed.description", ComponentType.LED, "Output"),
    wokwiEntry(3, LedBarGraphElement, "wokwiComponents.ledBar.name", "wokwiComponents.ledBar.description", ComponentType.LED, "Output"),
    wokwiEntry(4, NeoPixelElement, "wokwiComponents.neoPixel.name", "wokwiComponents.neoPixel.description", ComponentType.LED, "Output"),
    wokwiEntry(5, SevenSegmentElement, "wokwiComponents.sevenSegment.name", "wokwiComponents.sevenSegment.description", ComponentType.LED, "Output"),
    wokwiEntry(6, LEDRingElement, "wokwiComponents.ledRing.name", "wokwiComponents.ledRing.description", ComponentType.LED, "Output"),
    wokwiEntry(7, LCD1602Element, "wokwiComponents.lcd1602.name", "wokwiComponents.lcd1602.description", ComponentType.LED, "Output"),
    wokwiEntry(8, LCD2004Element, "wokwiComponents.lcd2004.name", "wokwiComponents.lcd2004.description", ComponentType.LED, "Output"),
    wokwiEntry(31, NeopixelMatrixElement, "wokwiComponents.neopixelMatrix.name", "wokwiComponents.neopixelMatrix.description", ComponentType.LED, "Output"),
    wokwiEntry(32, SSD1306Element, "wokwiComponents.ssd1306.name", "wokwiComponents.ssd1306.description", ComponentType.LED, "Output"),
    wokwiEntry(33, ILI9341Element, "wokwiComponents.ili9341.name", "wokwiComponents.ili9341.description", ComponentType.LED, "Output"),
    // Actionneurs / sortie
    wokwiEntry(9, BuzzerElement, "wokwiComponents.buzzer.name", "wokwiComponents.buzzer.description", ComponentType.TRANSMITTER, "Output"),
    wokwiEntry(21, ServoElement, "wokwiComponents.servo.name", "wokwiComponents.servo.description", ComponentType.MOTOR, "Output"),
    wokwiEntry(34, StepperMotorElement, "wokwiComponents.stepperMotor.name", "wokwiComponents.stepperMotor.description", ComponentType.MOTOR, "Output"),
    wokwiEntry(35, BiaxialStepperElement, "wokwiComponents.biaxialStepper.name", "wokwiComponents.biaxialStepper.description", ComponentType.MOTOR, "Output"),
    wokwiEntry(36, KS2EMDC5Element, "wokwiComponents.ks2eRelay.name", "wokwiComponents.ks2eRelay.description", ComponentType.OTHER, "Output"),
    wokwiEntry(37, IRRemoteElement, "wokwiComponents.irRemote.name", "wokwiComponents.irRemote.description", ComponentType.TRANSMITTER, "Output"),
    // Entrées
    wokwiEntry(10, PushbuttonElement, "wokwiComponents.pushbutton.name", "wokwiComponents.pushbutton.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(38, Pushbutton6mmElement, "wokwiComponents.pushbutton6mm.name", "wokwiComponents.pushbutton6mm.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(11, PotentiometerElement, "wokwiComponents.potentiometer.name", "wokwiComponents.potentiometer.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(12, SlideSwitchElement, "wokwiComponents.slideSwitch.name", "wokwiComponents.slideSwitch.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(13, AnalogJoystickElement, "wokwiComponents.analogJoystick.name", "wokwiComponents.analogJoystick.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(14, SlidePotentiometerElement, "wokwiComponents.slidePotentiometer.name", "wokwiComponents.slidePotentiometer.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(15, DipSwitch8Element, "wokwiComponents.dipSwitch8.name", "wokwiComponents.dipSwitch8.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(22, KY040Element, "wokwiComponents.ky040.name", "wokwiComponents.ky040.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(39, MembraneKeypadElement, "wokwiComponents.membraneKeypad.name", "wokwiComponents.membraneKeypad.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(40, RotaryDialerElement, "wokwiComponents.rotaryDialer.name", "wokwiComponents.rotaryDialer.description", ComponentType.BUTTON, "Input"),
    // Capteurs
    wokwiEntry(16, Dht22Element, "wokwiComponents.dht22.name", "wokwiComponents.dht22.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(17, HCSR04Element, "wokwiComponents.hcsr04.name", "wokwiComponents.hcsr04.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(18, NTCTemperatureSensorElement, "wokwiComponents.ntcTemperature.name", "wokwiComponents.ntcTemperature.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(19, SmallSoundSensorElement, "wokwiComponents.smallSound.name", "wokwiComponents.smallSound.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(20, BigSoundSensorElement, "wokwiComponents.bigSound.name", "wokwiComponents.bigSound.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(23, PhotoresistorSensorElement, "wokwiComponents.photoresistor.name", "wokwiComponents.photoresistor.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(41, PIRMotionSensorElement, "wokwiComponents.pirMotion.name", "wokwiComponents.pirMotion.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(42, FlameSensorElement, "wokwiComponents.flameSensor.name", "wokwiComponents.flameSensor.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(43, GasSensorElement, "wokwiComponents.gasSensor.name", "wokwiComponents.gasSensor.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(44, HeartBeatSensorElement, "wokwiComponents.heartBeat.name", "wokwiComponents.heartBeat.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(45, TiltSwitchElement, "wokwiComponents.tiltSwitch.name", "wokwiComponents.tiltSwitch.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(46, IRReceiverElement, "wokwiComponents.irReceiver.name", "wokwiComponents.irReceiver.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(47, MPU6050Element, "wokwiComponents.mpu6050.name", "wokwiComponents.mpu6050.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(48, HX711Element, "wokwiComponents.hx711.name", "wokwiComponents.hx711.description", ComponentType.SENSOR, "Input"),
    // Divers / CI
    wokwiEntry(24, ResistorElement, "wokwiComponents.resistor.name", "wokwiComponents.resistor.description", ComponentType.OTHER, "Basic"),
    wokwiEntry(25, Ds1307Element, "wokwiComponents.ds1307.name", "wokwiComponents.ds1307.description", ComponentType.OTHER, "ICs"),
    wokwiEntry(49, MicrosdCardElement, "wokwiComponents.microsdCard.name", "wokwiComponents.microsdCard.description", ComponentType.OTHER, "ICs"),
];
export const wokwiComponentById: WokwiComponentById = {};
export const wokwiComponentByClass: WokwiComponentByClass = {};
export const catalogComponentById: Record<number, CatalogComponentInfo> = {};

/**
 * Retourne la catégorie d’affichage d’un composant catalogue.
 * @param component - Entrée Wokwi ou Fritzing.
 * @returns Catégorie Fritzing (`Wokwi` pour les composants Wokwi).
 */
export function getCatalogCategory(component: CatalogComponentInfo): FritzingCategory {
    if (isWokwiComponent(component)) return "Wokwi";
    return component.category;
}

/**
 * Type guard : composant issu du catalogue Fritzing.
 * @param component - Entrée catalogue à tester.
 * @returns `true` si la source est Fritzing.
 */
export function isFritzingComponent(component: CatalogComponentInfo): component is FritzingComponentInfo {
    return component.source === "fritzing";
}

/**
 * Type guard : composant issu du catalogue Wokwi.
 * @param component - Entrée catalogue à tester.
 * @returns `true` si la source n’est pas Fritzing.
 */
export function isWokwiComponent(component: CatalogComponentInfo): component is WokwiComponentInfo {
    return !isFritzingComponent(component);
}

/**
 * Indique si un composant est une carte programmable (MCU, SBC, etc.).
 * @param component - Entrée catalogue Wokwi ou Fritzing.
 * @returns `true` si la pièce doit apparaître dans l’API table des broches MCU.
 */
export function isMicrocontrollerBoard(component: CatalogComponentInfo): boolean {
    if (isWokwiComponent(component)) {
        return component.type === ComponentType.CARD
            || component.category === "Microcontroller";
    }
    return component.category === "Microcontroller"
        || component.category === "Computer";
}

/**
 * Retourne le catalogue fusionné Wokwi + Fritzing (doublons masqués).
 * @returns Liste des composants disponibles dans le panneau catalogue.
 */
export function getCatalogComponents(): CatalogComponentInfo[] {
    const wokwi = wokwiComponents().map((component) => ({ ...component, source: "wokwi" as const }));
    return dedupeCatalogAgainstWokwi(wokwi, getStoredFritzingComponents());
}

/**
 * Reconstruit les maps d’accès rapide aux composants catalogue en mémoire.
 */
export function refreshWokwiComponentMaps(): void {
    for (const id of Object.keys(wokwiComponentById)) {
        delete wokwiComponentById[Number(id)];
    }
    for (const name of Object.keys(wokwiComponentByClass)) {
        delete wokwiComponentByClass[name];
    }
    for (const id of Object.keys(catalogComponentById)) {
        delete catalogComponentById[Number(id)];
    }
    for (const component of getCatalogComponents()) {
        catalogComponentById[component.id] = component;
        if (isWokwiComponent(component)) {
            wokwiComponentById[component.id] = component;
            wokwiComponentByClass[component.clasz.name] = component;
        }
    }
}

/**
 * Recherche un composant catalogue par identifiant numérique.
 * @param id - Identifiant catalogue (Wokwi ou Fritzing décalé).
 * @returns Entrée trouvée, ou `undefined`.
 */
export function getComponentById(id: number): CatalogComponentInfo | undefined {
    return catalogComponentById[id];
}

function measureWokwiDisplaySize(element: HTMLElement): { width: number; height: number } {
    const svg = element.shadowRoot?.querySelector("svg");
    if (!svg) return { width: 0, height: 0 };
    return measureWokwiSvgSize(svg);
}

function applyCatalogPreviewSize(node: HTMLElement, width: number, height: number): { scale: number } {
    const scaled = scaleToCatalogPreview(width, height);
    node.style.width = `${scaled.width}px`;
    node.style.height = `${scaled.height}px`;
    node.style.display = "block";
    node.style.margin = "0 auto";
    node.style.overflow = "hidden";
    node.style.position = "relative";
    return { scale: scaled.scale };
}

async function waitForWokwiSvg(element: HTMLElement): Promise<SVGElement | null> {
    const lit = element as HTMLElement & { updateComplete?: Promise<unknown> };
    try {
        if (lit.updateComplete) await lit.updateComplete;
    } catch {
        // ignore
    }
    for (let i = 0; i < 20; i += 1) {
        const svg = element.shadowRoot?.querySelector("svg");
        if (svg) return svg;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return null;
}

/** Cadre la vignette Wokwi : mesure réelle puis scale du custom element dans le wrapper. */
async function fitWokwiCatalogPreview(wrapper: HTMLElement, element: HTMLElement): Promise<void> {
    await waitForWokwiSvg(element);
    let { width, height } = measureWokwiDisplaySize(element);
    if (!(width > 0) || !(height > 0)) {
        const rect = element.getBoundingClientRect();
        width = rect.width || 100;
        height = rect.height || 100;
    }
    const { scale } = applyCatalogPreviewSize(wrapper, width, height);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.maxWidth = "none";
    element.style.display = "block";
    element.style.transformOrigin = "top left";
    element.style.transform = scale === 1 ? "none" : `scale(${scale})`;
    element.style.pointerEvents = "none";
}


export class ComponentElement {

    public readonly componentId: number;
    public readonly componentInfo: CatalogComponentInfo;
    public readonly wokwiComponent?: WokwiComponent
    public readonly previewNode: HTMLElement
    public readonly name: string
    public readonly description: string
    public readonly category: FritzingCategory

    /**
     * Crée une vignette catalogue dimensionnée pour un composant Wokwi ou Fritzing.
     * @param component - Métadonnées catalogue source.
     */
    constructor(component: CatalogComponentInfo) {
        this.componentInfo = component;
        this.componentId = component.id;
        this.name = component.name;
        this.description = component.description;
        this.category = getCatalogCategory(component);

        if (isWokwiComponent(component)) {
            const wrapper = document.createElement("div");
            wrapper.className = "hackCable-catalog-preview";
            this.wokwiComponent = new component.clasz();
            wrapper.appendChild(this.wokwiComponent);
            void fitWokwiCatalogPreview(wrapper, this.wokwiComponent);
            this.previewNode = wrapper;
            return;
        }

        const image = document.createElement("img");
        image.src = component.breadboardSvgUrl;
        image.alt = component.name;
        image.className = "hackCable-fritzing-preview";
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("error", () => {
            image.classList.add("is-missing");
            image.removeAttribute("src");
        });
        const { width, height } = fritzingDisplaySizeFromInches(
            component.physicalWidthInches,
            component.physicalHeightInches,
        );
        applyCatalogPreviewSize(image, width, height);
        image.style.objectFit = "contain";
        this.previewNode = image;
    }

}