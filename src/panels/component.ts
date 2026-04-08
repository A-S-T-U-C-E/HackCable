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
        name: "Arduino Uno",
        description: td("wokwiComponents.arduinoUno.description"),
        type: ComponentType.CARD
    },{
        id: 1,
        clasz: LEDElement,
        name: "LED",
        description: td("wokwiComponents.led.description"),
        type: ComponentType.LED
    },{
        id: 2,
        clasz: RGBLedElement,
        name: "LED RGB",
        description: td("wokwiComponents.rgbLed.description"),
        type: ComponentType.LED
    },{
        id: 3,
        clasz: LedBarGraphElement,
        name: "Barre de LEDs",
        description: td("wokwiComponents.ledBar.description"),
        type: ComponentType.LED
    },{
        id: 4,
        clasz: NeoPixelElement,
        name: "Pixel",
        description: td("wokwiComponents.neoPixel.description"),
        type: ComponentType.LED
    },{
        id: 5,
        clasz: SevenSegmentElement,
        name: "Numitrons",
        description: td("wokwiComponents.sevenSegment.description"),
        type: ComponentType.LED
    },{
        id: 6,
        clasz: LEDRingElement,
        name: "LED Ring",
        description: td("wokwiComponents.ledRing.description"),
        type: ComponentType.LED
    },{
        id: 7,
        clasz: LCD1602Element,
        name: "Écran 2*16 caractères",
        description: td("wokwiComponents.lcd1602.description"),
        type: ComponentType.LED
    },{
        id: 8,
        clasz: LCD2004Element,
        name: "Écran 4*20 caractères",
        description: td("wokwiComponents.lcd2004.description"),
        type: ComponentType.LED
    },{
        id: 9,
        clasz: BuzzerElement,
        name: "Buzzer",
        description: td("wokwiComponents.buzzer.description"),
        type: ComponentType.TRANSMITTER
    },{
        id: 10,
        clasz: PushbuttonElement,
        name: "Bouton poussoir",
        description: td("wokwiComponents.pushbutton.description"),
        type: ComponentType.BUTTON
    },{
        id: 11,
        clasz: PotentiometerElement,
        name: "Potentiomètre",
        description: td("wokwiComponents.potentiometer.description"),
        type: ComponentType.BUTTON
    },{
        id: 12,
        clasz: SlideSwitchElement,
        name: "Slide switch",
        description: td("wokwiComponents.slideSwitch.description"),
        type: ComponentType.BUTTON
    },{
        id: 13,
        clasz: AnalogJoystickElement,
        name: "Joystick",
        description: td("wokwiComponents.analogJoystick.description"),
        type: ComponentType.BUTTON
    },{
        id: 14,
        clasz: SlidePotentiometerElement,
        name: "Potentiomètre",
        description: td("wokwiComponents.slidePotentiometer.description"),
        type: ComponentType.BUTTON
    },{
        id: 15,
        clasz: DipSwitch8Element,
        name: "DipSwitch8",
        description: td("wokwiComponents.dipSwitch8.description"),
        type: ComponentType.BUTTON
    },{
        id: 16,
        clasz: Dht22Element,
        name: "DHT22 (T° et φ)",
        description: td("wokwiComponents.dht22.description"),
        type: ComponentType.SENSOR
    },{
        id: 17,
        clasz: HCSR04Element,
        name: "HCSR04",
        description: td("wokwiComponents.hcsr04.description"),
        type: ComponentType.SENSOR
    },{
        id: 18,
        clasz: NTCTemperatureSensorElement,
        name: "Temperature sensor",
        description: td("wokwiComponents.ntcTemperature.description"),
        type: ComponentType.SENSOR
    },{
        id: 19,
        clasz: SmallSoundSensorElement,
        name: "Détecteur de son faible",
        description: td("wokwiComponents.smallSound.description"),
        type: ComponentType.SENSOR
    },{
        id: 20,
        clasz: BigSoundSensorElement,
        name: "Détecteur de son fort",
        description: td("wokwiComponents.bigSound.description"),
        type: ComponentType.SENSOR
    },{
        id: 21,
        clasz: ServoElement,
        name: "Servo moteur",
        description: td("wokwiComponents.servo.description"),
        type: ComponentType.MOTOR
    },{
        id: 22,
        clasz: KY040Element,
        name: "Potentiometre KY040",
        description: td("wokwiComponents.ky040.description"),
        type: ComponentType.BUTTON
    },{
        id: 23,
        clasz: PhotoresistorSensorElement,
        name: "Photoresistance",
        description: td("wokwiComponents.photoresistor.description"),
        type: ComponentType.SENSOR
    },{
        id: 24,
        clasz: ResistorElement,
        name: "Résistance",
        description: td("wokwiComponents.resistor.description"),
        type: ComponentType.OTHER
    },{
        id: 25,
        clasz: Ds1307Element,
        name: "Ds1307 (Horloge)",
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