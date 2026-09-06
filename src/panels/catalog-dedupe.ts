/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Dédoublonnage catalogue : masque les pièces Fritzing déjà couvertes par Wokwi.
 *
 * Responsabilités :
 * - Normaliser titres / moduleId pour rapprochement
 * - Préférer Wokwi lorsqu’un équivalent Fritzing existe
 */
import type { FritzingComponentInfo } from "./fritzing-types";

/** Sous-ensemble Wokwi suffisant pour le rapprochement (évite un import circulaire). */
export type WokwiDedupeSource = {
    name: string;
    clasz: { name: string };
};

/**
 * Clés de rapprochement (anglais + aliases Fritzing), indépendantes de la locale UI.
 * Indexées par `clasz.name` Wokwi.
 */
const WOKWI_DEDUPE_KEYS: Record<string, string[]> = {
    ArduinoUnoElement: ["arduino uno"],
    ArduinoMegaElement: ["arduino mega", "arduino mega 2560"],
    ArduinoNanoElement: ["arduino nano"],
    ESP32DevkitV1Element: ["esp32 devkit v1", "esp32 devkit"],
    FranzininhoElement: ["franzininho"],
    NanoRP2040ConnectElement: ["nano rp2040 connect", "arduino nano rp2040 connect"],
    LEDElement: ["led"],
    RGBLedElement: ["rgb led"],
    LedBarGraphElement: ["led bar", "led bar graph"],
    NeoPixelElement: ["neopixel", "neo pixel", "ws2812"],
    SevenSegmentElement: ["seven segment display", "7 segment display"],
    LEDRingElement: ["led ring"],
    LCD1602Element: ["16x2 lcd", "lcd 16x2", "lcd16x2"],
    LCD2004Element: ["20x4 lcd", "lcd 20x4", "lcd20x4"],
    NeopixelMatrixElement: ["neopixel matrix", "neo pixel matrix"],
    SSD1306Element: ["ssd1306", "ssd1306 oled"],
    ILI9341Element: ["ili9341", "ili9341 display"],
    BuzzerElement: ["buzzer"],
    ServoElement: ["servo motor", "servo"],
    StepperMotorElement: ["stepper motor"],
    BiaxialStepperElement: ["biaxial stepper"],
    KS2EMDC5Element: ["ks2e m dc5", "ks2e m dc5 relay"],
    IRRemoteElement: ["ir remote"],
    PushbuttonElement: ["push button", "pushbutton"],
    Pushbutton6mmElement: ["6 mm push button", "pushbutton 6mm"],
    PotentiometerElement: ["potentiometer"],
    SlideSwitchElement: ["slide switch"],
    AnalogJoystickElement: ["joystick", "analog joystick"],
    SlidePotentiometerElement: ["slide potentiometer"],
    DipSwitch8Element: ["8 switch dip", "dip switch 8"],
    KY040Element: ["ky040", "ky040 rotary encoder"],
    MembraneKeypadElement: ["membrane keypad"],
    RotaryDialerElement: ["rotary dialer"],
    Dht22Element: ["dht22"],
    HCSR04Element: ["hc sr04", "hcsr04"],
    NTCTemperatureSensorElement: ["ntc temperature sensor", "ntc"],
    SmallSoundSensorElement: ["small sound sensor"],
    BigSoundSensorElement: ["large sound sensor", "big sound sensor"],
    PhotoresistorSensorElement: ["photoresistor", "photocell", "ldr"],
    PIRMotionSensorElement: ["pir motion sensor", "pir"],
    FlameSensorElement: ["flame sensor"],
    GasSensorElement: ["gas sensor"],
    HeartBeatSensorElement: ["heartbeat sensor", "heart beat sensor"],
    TiltSwitchElement: ["tilt switch"],
    IRReceiverElement: ["ir receiver"],
    MPU6050Element: ["mpu6050"],
    HX711Element: ["hx711"],
    ResistorElement: ["resistor"],
    Ds1307Element: ["ds1307", "ds1307 clock"],
    MicrosdCardElement: ["microsd module", "microsd card module", "micro sd card module"],
};

const NOISE_TOKENS = new Set([
    "rev",
    "revision",
    "breakout",
    "module",
    "board",
    "kit",
    "generic",
    "header",
    "usb",
    "icsp",
    "iscp",
]);

/**
 * Normalise un libellé catalogue pour comparaison (casse, ponctuation, entités HTML).
 * @param value - Texte brut à normaliser.
 * @returns Clé de comparaison en minuscules sans accents ni bruit.
 */
export function normalizeCatalogKey(value: string): string {
    return value
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
        .replace(/&[a-z]+;/gi, " ")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[×]/g, "x")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function baseKey(value: string): string {
    const tokens = normalizeCatalogKey(value)
        .split(" ")
        .filter((token) => token && !NOISE_TOKENS.has(token) && !/^v\d+$/.test(token));
    return tokens.join(" ");
}

function sortedKey(value: string): string {
    return value.split(" ").filter(Boolean).sort().join(" ");
}

function keysForWokwi(component: WokwiDedupeSource): string[] {
    return [...new Set((WOKWI_DEDUPE_KEYS[component.clasz.name] ?? []).map(baseKey).filter(Boolean))];
}

function candidateKeys(part: FritzingComponentInfo): string[] {
    const raw = [
        part.name,
        part.moduleId,
        part.family ?? "",
        part.fzpPath.replace(/^.*\//, "").replace(/\.fzp$/i, ""),
    ];
    return [...new Set(raw.map(baseKey).filter(Boolean))];
}

function matchesKey(candidate: string, key: string): boolean {
    if (!candidate || !key) return false;
    if (candidate === key || sortedKey(candidate) === sortedKey(key)) return true;
    // Variantes plus précises uniquement en préfixe (« arduino uno rev3 »).
    // Pas de suffixe : évite « lilypad slide switch » ↔ « slide switch ».
    if (!key.includes(" ")) return false;
    return candidate.startsWith(`${key} `);
}

/**
 * Indique si une pièce Fritzing est un équivalent d’un composant Wokwi.
 * @param part - Entrée Fritzing candidate au dédoublonnage.
 * @param wokwi - Liste des composants Wokwi de référence.
 * @returns `true` si la pièce Fritzing doit être masquée.
 */
export function isFritzingDuplicateOfWokwi(
    part: FritzingComponentInfo,
    wokwi: WokwiDedupeSource[],
): boolean {
    const candidates = candidateKeys(part);
    for (const component of wokwi) {
        for (const key of keysForWokwi(component)) {
            if (candidates.some((candidate) => matchesKey(candidate, key))) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Fusionne Wokwi et Fritzing en masquant les doublons Fritzing.
 * @param wokwi - Composants Wokwi (prioritaires).
 * @param fritzing - Pièces Fritzing candidates.
 * @returns Catalogue fusionné (Wokwi en premier).
 */
export function dedupeCatalogAgainstWokwi<W extends WokwiDedupeSource>(
    wokwi: W[],
    fritzing: FritzingComponentInfo[],
): Array<W | FritzingComponentInfo> {
    const kept = fritzing.filter((part) => !isFritzingDuplicateOfWokwi(part, wokwi));
    return [...wokwi, ...kept];
}
