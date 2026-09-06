/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Taxonomie Fritzing : catégories, parsing core.fzb et résolution.
 *
 * Responsabilités :
 * - Liste ordonnée des catégories breadboard
 * - Maps module/famille/fichier → catégorie
 * - Heuristiques de repli (titre, tags, chemin FZP)
 */
export const FRITZING_CATEGORIES = [

    "Wokwi",

    "Basic",

    "Input",

    "Output",

    "Textile",

    "ICs",

    "Power",

    "Microcontroller",

    "Computer",

    "Connection",

    "Breadboard View",

    "Schematic View",

    "PCB View",

    "Tools",

    "Measuring Tools",

] as const;



export type FritzingCategory = (typeof FRITZING_CATEGORIES)[number];



/** Catégories orientées « vue » ou outils — masquées par défaut dans le catalogue. */

export const FRITZING_VIEW_CATEGORIES = new Set<FritzingCategory>([

    "Breadboard View",

    "Schematic View",

    "PCB View",

    "Tools",

    "Measuring Tools",

]);



export interface FritzingCategoryMaps {

    moduleToCategory: Map<string, FritzingCategory>;

    familyToCategory: Map<string, FritzingCategory>;

    fzpFileToCategory: Map<string, FritzingCategory>;

}



export interface FritzingCategoryContext {

    moduleId: string;

    family?: string;

    tags: string[];

    title: string;

    taxonomy?: string;

    fzpPath?: string;

}



const CATEGORY_I18N_KEYS: Record<FritzingCategory, string> = {

    Wokwi: "catalog.fritzing.wokwi",

    Basic: "catalog.fritzing.basic",

    Input: "catalog.fritzing.input",

    Output: "catalog.fritzing.output",

    Textile: "catalog.fritzing.textile",

    ICs: "catalog.fritzing.ics",

    Power: "catalog.fritzing.power",

    Microcontroller: "catalog.fritzing.microcontroller",

    Computer: "catalog.fritzing.computer",

    Connection: "catalog.fritzing.connection",

    "Breadboard View": "catalog.fritzing.breadboardView",

    "Schematic View": "catalog.fritzing.schematicView",

    "PCB View": "catalog.fritzing.pcbView",

    Tools: "catalog.fritzing.tools",

    "Measuring Tools": "catalog.fritzing.measuringTools",

};



const CATEGORY_ORDER = new Map(FRITZING_CATEGORIES.map((category, index) => [category, index]));



/** Règles famille → catégorie (ordre important : la première correspondance gagne). */

const FAMILY_CATEGORY_RULES: Array<{ pattern: RegExp; category: FritzingCategory }> = [

    { pattern: /^(sparkfun|adafruit)\s+(accelerometer|gyro|magnetic|gps|sensor|fsr|photo|therm|humidity|pressure|distance|proximity|ultrasonic|reed|tilt|motion|pir|encoder|joystick|keypad|potentiometer|switch|button|tactile)/i, category: "Input" },

    { pattern: /^(sparkfun|adafruit)\s+(led|lcd|oled|display|matrix|motor|servo|stepper|buzzer|speaker|relay|vibrator|el driver|bar graph)/i, category: "Output" },

    { pattern: /^(sparkfun|adafruit)\s+(diode|resistor|capacitor|inductor|transistor|ferrite|crystal|discrete)/i, category: "Basic" },

    { pattern: /^(sparkfun|adafruit)\s+(dac|adc|op.?amp|logic|shift|mux|driver|amplifier|memory|eeprom|rtc|timer|counter|ic|microcontroller|pic|avr|arm|fpga)/i, category: "ICs" },

    { pattern: /^(sparkfun|adafruit)\s+(voltage regulator|power|battery|lipo|buck|boost|converter)/i, category: "Power" },

    { pattern: /^(sparkfun|adafruit)\s+(header|connector|usb|jack|plug|socket|wire|cable|terminal|ffc|isp|jtag)/i, category: "Connection" },

    { pattern: /^(sparkfun|adafruit)\s+(arduino|esp|teensy|feather|board|module|mcu|microcontroller)/i, category: "Microcontroller" },

    { pattern: /^(sparkfun|adafruit)\s+(raspberry|pi|computer|pc)/i, category: "Computer" },

    { pattern: /^(sparkfun|adafruit)\s+(textile|lilypad|fabric|conductive)/i, category: "Textile" },

    { pattern: /microcontroller board/i, category: "Microcontroller" },

    { pattern: /^(74|40)\d{2}\s*series|logic ic|ttl|cmos|eeprom|memory|rtc|timer|gate|op.?amp|adc|dac|shift register|mux|demux|driver ic|amplifier ic|generic ic/i, category: "ICs" },

    { pattern: /^(resistor|capacitor|diode|transistor|inductor|crystal|ferrite|discrete)/i, category: "Basic" },

    { pattern: /^(potentiometer|switch|button|encoder|joystick|keypad|fsr|photo|sensor|therm|accelerometer|gyro|reed|tilt|distance|pressure|humidity|input)/i, category: "Input" },

    { pattern: /^(led|lcd|oled|display|matrix|motor|servo|stepper|buzzer|speaker|relay|solenoid|actuator|output|vibrator)/i, category: "Output" },

    { pattern: /^(battery|power supply|regulator|voltage|lipo|transformer|converter|buck|boost)/i, category: "Power" },

    { pattern: /^(header|connector|pin header|socket|jumper|wire|usb|cable|jack|terminal|sub-d|ffc|din connector)/i, category: "Connection" },

    { pattern: /^(arduino|esp32|esp8266|teensy|nodemcu|wemos|feather|stm32|atmega|attiny|picaxe|basic stamp|mcu|microcontroller)/i, category: "Microcontroller" },

    { pattern: /^(raspberry|beagle|orange pi|computer|pc board)/i, category: "Computer" },

    { pattern: /^(textile|lilypad|conductive thread|fabric)/i, category: "Textile" },

    { pattern: /^(multimeter|oscilloscope|logic analyzer|probe|measuring)/i, category: "Measuring Tools" },

    { pattern: /^(ruler|note|label|logo|frame|annotation)/i, category: "Tools" },

];



const TAXONOMY_ROOT_CATEGORY: Record<string, FritzingCategory> = {

    discreteparts: "Basic",

    part: "Basic",

    input: "Input",

    output: "Output",

    microcontroller: "Microcontroller",

    microcontrollers: "Microcontroller",

    computer: "Computer",

    connection: "Connection",

    power: "Power",

    ics: "ICs",

    ic: "ICs",

    textile: "Textile",

    tactile: "Input",

    tools: "Tools",

    measuring: "Measuring Tools",

};



/**
 * Retourne la clé i18n associée à une catégorie Fritzing.
 * @param category - Catégorie Fritzing.
 * @returns Clé de traduction dans le namespace `common`.
 */
export function fritzingCategoryI18nKey(category: FritzingCategory): string {

    return CATEGORY_I18N_KEYS[category];

}



/**
 * Type guard : vérifie si une chaîne est une catégorie Fritzing connue.
 * @param value - Chaîne à tester.
 * @returns `true` si la valeur est dans {@link FRITZING_CATEGORIES}.
 */
export function isFritzingCategory(value: string): value is FritzingCategory {

    return (FRITZING_CATEGORIES as readonly string[]).includes(value);

}



/**
 * Compare deux catégories Fritzing selon l’ordre d’affichage catalogue.
 * @param a - Première catégorie.
 * @param b - Seconde catégorie.
 * @returns Delta d’index négatif, nul ou positif pour le tri.
 */
export function compareFritzingCategories(a: FritzingCategory, b: FritzingCategory): number {

    return (CATEGORY_ORDER.get(a) ?? 999) - (CATEGORY_ORDER.get(b) ?? 999);

}



/**
 * Indique si une catégorie est affichée dans le catalogue breadboard.
 * @param category - Catégorie Fritzing.
 * @returns `false` pour les catégories « vue » ou outils masqués par défaut.
 */
export function isBreadboardCatalogCategory(category: FritzingCategory): boolean {

    return !FRITZING_VIEW_CATEGORIES.has(category);

}

function fzpBasename(path: string): string {

    return path.replace(/^.*\//, "").toLowerCase();

}



function extractFzpFile(path: string): string | null {

    const file = path.replace(/^.*\//, "");

    return file.toLowerCase().endsWith(".fzp") ? file.toLowerCase() : null;

}



/**
 * Parse le fichier bins/core.fzb et extrait les maps module/fichier → catégorie.
 * @param xml - Contenu XML de core.fzb.
 * @returns Maps de résolution de catégories Fritzing.
 */
export function parseCoreFzb(xml: string): FritzingCategoryMaps {

    const moduleToCategory = new Map<string, FritzingCategory>();

    const fzpFileToCategory = new Map<string, FritzingCategory>();

    let currentCategory: FritzingCategory | null = null;



    for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {

        const ref = match[1];

        const path = match[2];

        if (ref === "__spacer__" && isFritzingCategory(path)) {

            currentCategory = path;

            continue;

        }

        if (!currentCategory || ref === "__spacer__") continue;



        moduleToCategory.set(ref, currentCategory);



        const fzpFile = extractFzpFile(path);

        if (fzpFile && !fzpFileToCategory.has(fzpFile)) {

            fzpFileToCategory.set(fzpFile, currentCategory);

        }

    }



    return { moduleToCategory, familyToCategory: new Map(), fzpFileToCategory };

}



/**
 * Construit la map famille → catégorie à partir de core.fzb et des familles FZP.
 * @param fzbXml - Contenu XML de core.fzb.
 * @param familyByModuleId - Map moduleId → famille extraite des FZP.
 * @returns Map famille → catégorie Fritzing.
 */
export function buildFamilyCategoryMap(

    fzbXml: string,

    familyByModuleId: Map<string, string>,

): Map<string, FritzingCategory> {

    const { moduleToCategory } = parseCoreFzb(fzbXml);

    const familyToCategory = new Map<string, FritzingCategory>();



    for (const [moduleId, category] of moduleToCategory) {

        const family = familyByModuleId.get(moduleId);

        if (family && !familyToCategory.has(family)) {

            familyToCategory.set(family, category);

        }

    }



    return familyToCategory;

}



function categoryFromTaxonomy(taxonomy?: string): FritzingCategory | null {

    if (!taxonomy) return null;

    const root = taxonomy.split(".")[0].toLowerCase();

    return TAXONOMY_ROOT_CATEGORY[root] ?? null;

}



function categoryFromFamily(family?: string): FritzingCategory | null {

    if (!family) return null;

    for (const rule of FAMILY_CATEGORY_RULES) {

        if (rule.pattern.test(family.trim())) return rule.category;

    }

    return null;

}



function categoryFromFzpPath(fzpPath?: string, maps?: FritzingCategoryMaps): FritzingCategory | null {

    if (!fzpPath) return null;

    const base = fzpBasename(fzpPath);

    const fromBin = maps?.fzpFileToCategory.get(base);

    if (fromBin) return fromBin;

    return inferFritzingCategoryFromText(base);

}



function inferFritzingCategoryFromText(hay: string): FritzingCategory | null {

    const text = hay.toLowerCase();



    if (/(breadboard|protoboard)/.test(text)) return "Breadboard View";

    if (/(schematic|symbol|ground|supply_sine|supply_dc)/.test(text)) return "Schematic View";

    if (/(pcb|footprint|smd|copper|trace|via|pad)/.test(text)) return "PCB View";

    if (/(textile|lilypad|conductive)/.test(text)) return "Textile";

    if (/(arduino|esp32|esp8266|teensy|nodemcu|wemos|feather|stm32|atmega|attiny|picaxe|mcu|microcontroller|board)/.test(text)) {

        return "Microcontroller";

    }

    if (/(raspberry|beagle|orangepi|computer)/.test(text)) return "Computer";

    if (/(battery|power|regulator|lipo|buck|boost|converter|supply)/.test(text)) return "Power";

    if (/(header|connector|pin.?header|socket|jumper|wire|usb|cable|jack|terminal|ffc|din)/.test(text)) {

        return "Connection";

    }

    if (/(multimeter|oscilloscope|probe|logic.?analyzer)/.test(text)) return "Measuring Tools";

    if (/(ruler|note|label|logo|frame|annotation)/.test(text)) return "Tools";

    if (/(eeprom|memory|rtc|timer|gate|logic|74hc|4000|adc|dac|driver|amplifier|counter|opamp|shift|mux)/.test(text)) {

        return "ICs";

    }

    if (/(sensor|switch|button|potentiometer|encoder|joystick|keypad|fsr|photo|therm|accelerometer|gyro|reed|tilt|distance|pressure|humidity)/.test(text)) {

        return "Input";

    }

    if (/(led|lcd|oled|display|matrix|motor|servo|stepper|buzzer|speaker|relay|solenoid|actuator|vibrator)/.test(text)) {

        return "Output";

    }

    if (/(resistor|capacitor|diode|transistor|inductor|crystal|ferrite)/.test(text)) return "Basic";



    return null;

}



/**
 * Résout la catégorie Fritzing d’une pièce (bin officiel, famille, taxonomie, heuristiques).
 * @param context - Métadonnées de la pièce (moduleId, famille, tags, etc.).
 * @param maps - Maps de catégories issues de core.fzb.
 * @returns Catégorie Fritzing retenue.
 */
export function resolveFritzingCategory(

    context: FritzingCategoryContext,

    maps: FritzingCategoryMaps,

): FritzingCategory {

    const fromModule = maps.moduleToCategory.get(context.moduleId);

    if (fromModule) return fromModule;



    const fromFzp = categoryFromFzpPath(context.fzpPath, maps);

    if (fromFzp) return fromFzp;



    if (context.family) {

        const fromBinFamily = maps.familyToCategory.get(context.family);

        if (fromBinFamily) return fromBinFamily;



        const fromFamily = categoryFromFamily(context.family);

        if (fromFamily) return fromFamily;

    }



    const fromTaxonomy = categoryFromTaxonomy(context.taxonomy);

    if (fromTaxonomy) return fromTaxonomy;



    return inferFritzingCategory(context);

}



function inferFritzingCategory(context: FritzingCategoryContext): FritzingCategory {

    const hay = [

        context.moduleId,

        context.family ?? "",

        context.tags.join(" "),

        context.title,

        context.taxonomy ?? "",

        context.fzpPath ?? "",

    ].join(" ");



    return inferFritzingCategoryFromText(hay) ?? "Basic";

}


