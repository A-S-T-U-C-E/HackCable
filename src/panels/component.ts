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
import i18next from "i18next";

export declare type WokwiComponent = SevenSegmentElement | ArduinoUnoElement | LCD1602Element | LEDElement | NeoPixelElement | PushbuttonElement | ResistorElement | MembraneKeypadElement | PotentiometerElement | NeopixelMatrixElement | SSD1306Element | BuzzerElement | RotaryDialerElement | ServoElement | Dht22Element | ArduinoMegaElement | ArduinoNanoElement | Ds1307Element | LEDRingElement | SlideSwitchElement | HCSR04Element | LCD2004Element | AnalogJoystickElement | SlidePotentiometerElement | IRReceiverElement | IRRemoteElement | PIRMotionSensorElement | NTCTemperatureSensorElement | HeartBeatSensorElement | TiltSwitchElement | FlameSensorElement | GasSensorElement | FranzininhoElement | NanoRP2040ConnectElement | SmallSoundSensorElement | BigSoundSensorElement | MPU6050Element | ESP32DevkitV1Element | KY040Element | PhotoresistorSensorElement | RGBLedElement | ILI9341Element | LedBarGraphElement | MicrosdCardElement | DipSwitch8Element

export declare type WokwiClass = typeof Dht22Element;

export const wokwiComponentClasses = [SevenSegmentElement, ArduinoUnoElement, LCD1602Element, LEDElement, NeoPixelElement, PushbuttonElement, ResistorElement, MembraneKeypadElement, PotentiometerElement, NeopixelMatrixElement, SSD1306Element, BuzzerElement, RotaryDialerElement, ServoElement, Dht22Element, ArduinoMegaElement, ArduinoNanoElement, Ds1307Element, LEDRingElement, SlideSwitchElement, HCSR04Element, LCD2004Element, AnalogJoystickElement, SlidePotentiometerElement, IRReceiverElement, IRRemoteElement,  PIRMotionSensorElement, NTCTemperatureSensorElement, HeartBeatSensorElement, TiltSwitchElement, FlameSensorElement, GasSensorElement, FranzininhoElement, NanoRP2040ConnectElement, SmallSoundSensorElement, BigSoundSensorElement, MPU6050Element, ESP32DevkitV1Element, KY040Element, PhotoresistorSensorElement, RGBLedElement, ILI9341Element, LedBarGraphElement, MicrosdCardElement, DipSwitch8Element]

export declare type WokwiComponentInfo = {id: number, clasz: WokwiClass, name: string, description: string, type: ComponentType}
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

function td(key: string): string {
    return i18next.t(key, { ns: "common" });
}

export const wokwiComponents = (): WokwiComponents => [
    {
        id: 0,
        clasz: ArduinoUnoElement,
        name: td("wokwiComponents.arduinoUno.name"),
        description: td("wokwiComponents.arduinoUno.description"),
        type: ComponentType.CARD
    },{
        id: 1,
        clasz: LEDElement,
        name: td("wokwiComponents.led.name"),
        description: td("wokwiComponents.led.description"),
        type: ComponentType.LED
    },{
        id: 2,
        clasz: RGBLedElement,
        name: td("wokwiComponents.rgbLed.name"),
        description: td("wokwiComponents.rgbLed.description"),
        type: ComponentType.LED
    },{
        id: 3,
        clasz: LedBarGraphElement,
        name: td("wokwiComponents.ledBar.name"),
        description: td("wokwiComponents.ledBar.description"),
        type: ComponentType.LED
    },{
        id: 4,
        clasz: NeoPixelElement,
        name: td("wokwiComponents.neoPixel.name"),
        description: td("wokwiComponents.neoPixel.description"),
        type: ComponentType.LED
    },{
        id: 5,
        clasz: SevenSegmentElement,
        name: td("wokwiComponents.sevenSegment.name"),
        description: td("wokwiComponents.sevenSegment.description"),
        type: ComponentType.LED
    },{
        id: 6,
        clasz: LEDRingElement,
        name: td("wokwiComponents.ledRing.name"),
        description: td("wokwiComponents.ledRing.description"),
        type: ComponentType.LED
    },{
        id: 7,
        clasz: LCD1602Element,
        name: td("wokwiComponents.lcd1602.name"),
        description: td("wokwiComponents.lcd1602.description"),
        type: ComponentType.LED
    },{
        id: 8,
        clasz: LCD2004Element,
        name: td("wokwiComponents.lcd2004.name"),
        description: td("wokwiComponents.lcd2004.description"),
        type: ComponentType.LED
    },{
        id: 9,
        clasz: BuzzerElement,
        name: td("wokwiComponents.buzzer.name"),
        description: td("wokwiComponents.buzzer.description"),
        type: ComponentType.TRANSMITTER
    },{
        id: 10,
        clasz: PushbuttonElement,
        name: td("wokwiComponents.pushbutton.name"),
        description: td("wokwiComponents.pushbutton.description"),
        type: ComponentType.BUTTON
    },{
        id: 11,
        clasz: PotentiometerElement,
        name: td("wokwiComponents.potentiometer.name"),
        description: td("wokwiComponents.potentiometer.description"),
        type: ComponentType.BUTTON
    },{
        id: 12,
        clasz: SlideSwitchElement,
        name: td("wokwiComponents.slideSwitch.name"),
        description: td("wokwiComponents.slideSwitch.description"),
        type: ComponentType.BUTTON
    },{
        id: 13,
        clasz: AnalogJoystickElement,
        name: td("wokwiComponents.analogJoystick.name"),
        description: td("wokwiComponents.analogJoystick.description"),
        type: ComponentType.BUTTON
    },{
        id: 14,
        clasz: SlidePotentiometerElement,
        name: td("wokwiComponents.slidePotentiometer.name"),
        description: td("wokwiComponents.slidePotentiometer.description"),
        type: ComponentType.BUTTON
    },{
        id: 15,
        clasz: DipSwitch8Element,
        name: td("wokwiComponents.dipSwitch8.name"),
        description: td("wokwiComponents.dipSwitch8.description"),
        type: ComponentType.BUTTON
    },{
        id: 16,
        clasz: Dht22Element,
        name: td("wokwiComponents.dht22.name"),
        description: td("wokwiComponents.dht22.description"),
        type: ComponentType.SENSOR
    },{
        id: 17,
        clasz: HCSR04Element,
        name: td("wokwiComponents.hcsr04.name"),
        description: td("wokwiComponents.hcsr04.description"),
        type: ComponentType.SENSOR
    },{
        id: 18,
        clasz: NTCTemperatureSensorElement,
        name: td("wokwiComponents.ntcTemperature.name"),
        description: td("wokwiComponents.ntcTemperature.description"),
        type: ComponentType.SENSOR
    },{
        id: 19,
        clasz: SmallSoundSensorElement,
        name: td("wokwiComponents.smallSound.name"),
        description: td("wokwiComponents.smallSound.description"),
        type: ComponentType.SENSOR
    },{
        id: 20,
        clasz: BigSoundSensorElement,
        name: td("wokwiComponents.bigSound.name"),
        description: td("wokwiComponents.bigSound.description"),
        type: ComponentType.SENSOR
    },{
        id: 21,
        clasz: ServoElement,
        name: td("wokwiComponents.servo.name"),
        description: td("wokwiComponents.servo.description"),
        type: ComponentType.MOTOR
    },{
        id: 22,
        clasz: KY040Element,
        name: td("wokwiComponents.ky040.name"),
        description: td("wokwiComponents.ky040.description"),
        type: ComponentType.BUTTON
    },{
        id: 23,
        clasz: PhotoresistorSensorElement,
        name: td("wokwiComponents.photoresistor.name"),
        description: td("wokwiComponents.photoresistor.description"),
        type: ComponentType.SENSOR
    },{
        id: 24,
        clasz: ResistorElement,
        name: td("wokwiComponents.resistor.name"),
        description: td("wokwiComponents.resistor.description"),
        type: ComponentType.OTHER
    },{
        id: 25,
        clasz: Ds1307Element,
        name: td("wokwiComponents.ds1307.name"),
        description: td("wokwiComponents.ds1307.description"),
        type: ComponentType.OTHER
    }]

export const wokwiComponentById: WokwiComponentById = {};
export const wokwiComponentByClass: WokwiComponentByClass = {};

export function refreshWokwiComponentMaps(): void {
    for (const id of Object.keys(wokwiComponentById)) {
        delete wokwiComponentById[Number(id)];
    }
    for (const name of Object.keys(wokwiComponentByClass)) {
        delete wokwiComponentByClass[name];
    }
    for (const component of wokwiComponents()) {
        wokwiComponentById[component.id] = component;
        wokwiComponentByClass[component.clasz.name] = component;
    }
}


export class ComponentElement {

    public readonly componentId: number;
    public readonly wokwiComponent: WokwiComponent
    public readonly name: string
    public readonly description: string
    public readonly type: ComponentType

    constructor(component: WokwiComponentInfo) {
        this.componentId = component.id;
        this.wokwiComponent = new component.clasz();
        this.name = component.name;
        this.description = component.description;
        this.type = component.type
    }

}