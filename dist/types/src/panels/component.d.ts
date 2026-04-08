import { AnalogJoystickElement, ArduinoMegaElement, ArduinoNanoElement, ArduinoUnoElement, BigSoundSensorElement, BuzzerElement, Dht22Element, DipSwitch8Element, Ds1307Element, ESP32DevkitV1Element, FlameSensorElement, FranzininhoElement, GasSensorElement, HCSR04Element, HeartBeatSensorElement, ILI9341Element, IRReceiverElement, IRRemoteElement, KY040Element, LCD1602Element, LCD2004Element, LedBarGraphElement, LEDElement, LEDRingElement, MembraneKeypadElement, MicrosdCardElement, MPU6050Element, NanoRP2040ConnectElement, NeoPixelElement, NeopixelMatrixElement, NTCTemperatureSensorElement, PhotoresistorSensorElement, PIRMotionSensorElement, PotentiometerElement, PushbuttonElement, ResistorElement, RGBLedElement, RotaryDialerElement, ServoElement, SevenSegmentElement, SlidePotentiometerElement, SlideSwitchElement, SmallSoundSensorElement, SSD1306Element, TiltSwitchElement } from "@wokwi/elements";
export declare type WokwiComponent = SevenSegmentElement | ArduinoUnoElement | LCD1602Element | LEDElement | NeoPixelElement | PushbuttonElement | ResistorElement | MembraneKeypadElement | PotentiometerElement | NeopixelMatrixElement | SSD1306Element | BuzzerElement | RotaryDialerElement | ServoElement | Dht22Element | ArduinoMegaElement | ArduinoNanoElement | Ds1307Element | LEDRingElement | SlideSwitchElement | HCSR04Element | LCD2004Element | AnalogJoystickElement | SlidePotentiometerElement | IRReceiverElement | IRRemoteElement | PIRMotionSensorElement | NTCTemperatureSensorElement | HeartBeatSensorElement | TiltSwitchElement | FlameSensorElement | GasSensorElement | FranzininhoElement | NanoRP2040ConnectElement | SmallSoundSensorElement | BigSoundSensorElement | MPU6050Element | ESP32DevkitV1Element | KY040Element | PhotoresistorSensorElement | RGBLedElement | ILI9341Element | LedBarGraphElement | MicrosdCardElement | DipSwitch8Element;
export declare type WokwiClass = typeof Dht22Element;
export declare const wokwiComponentClasses: (typeof SevenSegmentElement | typeof ArduinoUnoElement | typeof BuzzerElement | typeof LCD1602Element | typeof LEDElement | typeof MembraneKeypadElement | typeof NeopixelMatrixElement | typeof PotentiometerElement | typeof PushbuttonElement | typeof ResistorElement | typeof RotaryDialerElement | typeof SSD1306Element | typeof Dht22Element | typeof ArduinoMegaElement | typeof ArduinoNanoElement | typeof SlideSwitchElement | typeof AnalogJoystickElement | typeof SlidePotentiometerElement | typeof IRRemoteElement | typeof FranzininhoElement | typeof KY040Element | typeof ILI9341Element)[];
export declare type WokwiComponentInfo = {
    id: number;
    clasz: WokwiClass;
    name: string;
    description: string;
    type: ComponentType;
};
export declare type WokwiComponents = WokwiComponentInfo[];
export declare type WokwiComponentById = {
    [id: number]: WokwiComponentInfo;
};
export declare type WokwiComponentByClass = {
    [clasz: string]: WokwiComponentInfo;
};
export declare enum ComponentType {
    LED = 0,
    MOTOR = 1,
    TRANSMITTER = 2,
    BUTTON = 3,
    SENSOR = 4,
    OTHER = 5,
    CARD = 6
}
export declare const wokwiComponents: WokwiComponents;
export declare const wokwiComponentById: WokwiComponentById;
export declare const wokwiComponentByClass: WokwiComponentByClass;
export declare class ComponentElement {
    readonly componentId: number;
    readonly wokwiComponent: WokwiComponent;
    readonly name: string;
    readonly description: string;
    readonly type: ComponentType;
    constructor(component: WokwiComponentInfo);
}
