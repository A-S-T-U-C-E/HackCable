/**
 * @file Catalogue de composants Wokwi et Fritzing (types, registre, éléments UI).
 */
import {
    AnalogJoystickElement, ArduinoMegaElement,
    ArduinoNanoElement,
    ArduinoUnoElement,
    BigSoundSensorElement,
    BuzzerElement,
    Dht22Element, DipSwitch8Element,
    Ds1307Element,
    ESP32DevkitV1Element, FlameSensorElement,
    FranzininhoElement, GasSensorElement,
    HCSR04Element,
    HeartBeatSensorElement,
    ILI9341Element,
    IRReceiverElement, IRRemoteElement,
    KY040Element,
    LCD1602Element, LCD2004Element, LedBarGraphElement, LEDElement,
    LEDRingElement, MembraneKeypadElement,
    MicrosdCardElement, MPU6050Element,
    NanoRP2040ConnectElement,
    NeoPixelElement,
    NeopixelMatrixElement, NTCTemperatureSensorElement, PhotoresistorSensorElement,
    PIRMotionSensorElement,
    PotentiometerElement,
    PushbuttonElement,
    ResistorElement, RGBLedElement,
    RotaryDialerElement,
    ServoElement, SevenSegmentElement, SlidePotentiometerElement,
    SlideSwitchElement,
    SmallSoundSensorElement, SSD1306Element,
    TiltSwitchElement
} from "@wokwi/elements";
import { tr } from "../ui/i18n/translate";
import { getStoredFritzingComponents } from "./fritzing-sync";
import type { FritzingComponentInfo } from "./fritzing-types";
import {
    type FritzingCategory,
} from "./fritzing-categories";
import { scaleToCatalogPreview } from "../editor/canvas-scale";
import { fritzingDisplaySizeFromInches } from "../editor/coordinate-port-locator";
import { unitToPx } from "../utils/dom";
export type { FritzingComponentInfo } from "./fritzing-types";
export { syncFritzingCatalog } from "./fritzing-sync";

export declare type WokwiComponent = SevenSegmentElement | ArduinoUnoElement | LCD1602Element | LEDElement | NeoPixelElement | PushbuttonElement | ResistorElement | MembraneKeypadElement | PotentiometerElement | NeopixelMatrixElement | SSD1306Element | BuzzerElement | RotaryDialerElement | ServoElement | Dht22Element | ArduinoMegaElement | ArduinoNanoElement | Ds1307Element | LEDRingElement | SlideSwitchElement | HCSR04Element | LCD2004Element | AnalogJoystickElement | SlidePotentiometerElement | IRReceiverElement | IRRemoteElement | PIRMotionSensorElement | NTCTemperatureSensorElement | HeartBeatSensorElement | TiltSwitchElement | FlameSensorElement | GasSensorElement | FranzininhoElement | NanoRP2040ConnectElement | SmallSoundSensorElement | BigSoundSensorElement | MPU6050Element | ESP32DevkitV1Element | KY040Element | PhotoresistorSensorElement | RGBLedElement | ILI9341Element | LedBarGraphElement | MicrosdCardElement | DipSwitch8Element

export declare type WokwiClass = typeof Dht22Element;

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

export const wokwiComponents = (): WokwiComponents => [
    wokwiEntry(0, ArduinoUnoElement, "wokwiComponents.arduinoUno.name", "wokwiComponents.arduinoUno.description", ComponentType.CARD, "Microcontroller"),
    wokwiEntry(1, LEDElement, "wokwiComponents.led.name", "wokwiComponents.led.description", ComponentType.LED, "Output"),
    wokwiEntry(2, RGBLedElement, "wokwiComponents.rgbLed.name", "wokwiComponents.rgbLed.description", ComponentType.LED, "Output"),
    wokwiEntry(3, LedBarGraphElement, "wokwiComponents.ledBar.name", "wokwiComponents.ledBar.description", ComponentType.LED, "Output"),
    wokwiEntry(4, NeoPixelElement, "wokwiComponents.neoPixel.name", "wokwiComponents.neoPixel.description", ComponentType.LED, "Output"),
    wokwiEntry(5, SevenSegmentElement, "wokwiComponents.sevenSegment.name", "wokwiComponents.sevenSegment.description", ComponentType.LED, "Output"),
    wokwiEntry(6, LEDRingElement, "wokwiComponents.ledRing.name", "wokwiComponents.ledRing.description", ComponentType.LED, "Output"),
    wokwiEntry(7, LCD1602Element, "wokwiComponents.lcd1602.name", "wokwiComponents.lcd1602.description", ComponentType.LED, "Output"),
    wokwiEntry(8, LCD2004Element, "wokwiComponents.lcd2004.name", "wokwiComponents.lcd2004.description", ComponentType.LED, "Output"),
    wokwiEntry(9, BuzzerElement, "wokwiComponents.buzzer.name", "wokwiComponents.buzzer.description", ComponentType.TRANSMITTER, "Output"),
    wokwiEntry(10, PushbuttonElement, "wokwiComponents.pushbutton.name", "wokwiComponents.pushbutton.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(11, PotentiometerElement, "wokwiComponents.potentiometer.name", "wokwiComponents.potentiometer.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(12, SlideSwitchElement, "wokwiComponents.slideSwitch.name", "wokwiComponents.slideSwitch.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(13, AnalogJoystickElement, "wokwiComponents.analogJoystick.name", "wokwiComponents.analogJoystick.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(14, SlidePotentiometerElement, "wokwiComponents.slidePotentiometer.name", "wokwiComponents.slidePotentiometer.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(15, DipSwitch8Element, "wokwiComponents.dipSwitch8.name", "wokwiComponents.dipSwitch8.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(16, Dht22Element, "wokwiComponents.dht22.name", "wokwiComponents.dht22.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(17, HCSR04Element, "wokwiComponents.hcsr04.name", "wokwiComponents.hcsr04.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(18, NTCTemperatureSensorElement, "wokwiComponents.ntcTemperature.name", "wokwiComponents.ntcTemperature.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(19, SmallSoundSensorElement, "wokwiComponents.smallSound.name", "wokwiComponents.smallSound.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(20, BigSoundSensorElement, "wokwiComponents.bigSound.name", "wokwiComponents.bigSound.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(21, ServoElement, "wokwiComponents.servo.name", "wokwiComponents.servo.description", ComponentType.MOTOR, "Output"),
    wokwiEntry(22, KY040Element, "wokwiComponents.ky040.name", "wokwiComponents.ky040.description", ComponentType.BUTTON, "Input"),
    wokwiEntry(23, PhotoresistorSensorElement, "wokwiComponents.photoresistor.name", "wokwiComponents.photoresistor.description", ComponentType.SENSOR, "Input"),
    wokwiEntry(24, ResistorElement, "wokwiComponents.resistor.name", "wokwiComponents.resistor.description", ComponentType.OTHER, "Basic"),
    wokwiEntry(25, Ds1307Element, "wokwiComponents.ds1307.name", "wokwiComponents.ds1307.description", ComponentType.OTHER, "ICs"),
]
export const wokwiComponentById: WokwiComponentById = {};
export const wokwiComponentByClass: WokwiComponentByClass = {};
export const catalogComponentById: Record<number, CatalogComponentInfo> = {};

export function getCatalogCategory(component: CatalogComponentInfo): FritzingCategory {
    if (isFritzingComponent(component)) return component.category;
    return component.category ?? wokwiTypeToFritzingCategory(component.type);
}

export function isFritzingComponent(component: CatalogComponentInfo): component is FritzingComponentInfo {
    return component.source === "fritzing";
}

export function isWokwiComponent(component: CatalogComponentInfo): component is WokwiComponentInfo {
    return !isFritzingComponent(component);
}

/**
 * Cartes programmables (MCU, SBC) : Arduino / ESP / STM / PICAXE / Raspberry, etc.
 * Inclut la catégorie Fritzing « Computer » (Raspberry Pi, Beagle…).
 */
export function isMicrocontrollerBoard(component: CatalogComponentInfo): boolean {
    if (isWokwiComponent(component)) {
        return component.type === ComponentType.CARD
            || component.category === "Microcontroller";
    }
    return component.category === "Microcontroller"
        || component.category === "Computer";
}

export function getCatalogComponents(): CatalogComponentInfo[] {
    const wokwi = wokwiComponents().map((component) => ({ ...component, source: "wokwi" as const }));
    return [...wokwi, ...getStoredFritzingComponents()];
}

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
    for (const component of wokwiComponents()) {
        wokwiComponentById[component.id] = component;
        wokwiComponentByClass[component.clasz.name] = component;
        catalogComponentById[component.id] = { ...component, source: "wokwi" };
    }
    for (const component of getStoredFritzingComponents()) {
        catalogComponentById[component.id] = component;
    }
}

export function getComponentById(id: number): CatalogComponentInfo | undefined {
    return catalogComponentById[id];
}

function measureWokwiDisplaySize(element: HTMLElement): { width: number; height: number } {
    const svg = element.shadowRoot?.querySelector("svg");
    if (!svg) return { width: 100, height: 100 };

    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        return {
            width: parts[2] ?? unitToPx(svg.getAttribute("width")),
            height: parts[3] ?? unitToPx(svg.getAttribute("height")),
        };
    }

    return {
        width: unitToPx(svg.getAttribute("width")),
        height: unitToPx(svg.getAttribute("height")),
    };
}

function applyCatalogPreviewSize(node: HTMLElement, width: number, height: number): void {
    const scaled = scaleToCatalogPreview(width, height);
    node.style.width = `${scaled.width}px`;
    node.style.height = `${scaled.height}px`;
    node.style.display = "block";
    node.style.margin = "0 auto";
}


export class ComponentElement {

    public readonly componentId: number;
    public readonly componentInfo: CatalogComponentInfo;
    public readonly wokwiComponent?: WokwiComponent
    public readonly previewNode: HTMLElement
    public readonly name: string
    public readonly description: string
    public readonly category: FritzingCategory

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
            requestAnimationFrame(() => {
                const { width, height } = measureWokwiDisplaySize(this.wokwiComponent!);
                applyCatalogPreviewSize(wrapper, width, height);
            });
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