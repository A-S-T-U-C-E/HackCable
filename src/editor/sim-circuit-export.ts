/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Conversion du schéma HackCable vers Wokwi `diagram.json` et Velxio `.vlx`.
 *
 * Responsabilités :
 * - Mapper les composants Wokwi (tag `wokwi-*`) et ignorer Fritzing non supporté
 * - Produire un `diagram.json` importable dans Wokwi
 * - Produire un projet `.vlx` (format velxio-project) importable dans Velxio
 */
import type { EditorSaveData } from "./editor";
import type { FigureData, WiringData } from "./component-figure";
import {
    getComponentById,
    isFritzingComponent,
    isMicrocontrollerBoard,
    isWokwiComponent,
    type CatalogComponentInfo,
    type WokwiComponentInfo,
} from "../panels/component";

/** Partie Wokwi dans `diagram.json`. */
export type WokwiDiagramPart = {
    id: string;
    type: string;
    left: number;
    top: number;
    attrs: Record<string, string>;
    rotate?: number;
};

/** Document `diagram.json` Wokwi. */
export type WokwiDiagram = {
    version: 1;
    author: string;
    editor: string;
    parts: WokwiDiagramPart[];
    connections: Array<[string, string, string, string[]]>;
};

/** Résumé d’un export simulateur (Wokwi / Velxio). */
export type SimCircuitExportResult = {
    /** Nombre de pièces réellement exportées (cartes + composants). */
    exportedCount: number;
    /** Pièces Fritzing omises (non représentables en Wokwi/Velxio). */
    skippedFritzing: number;
    /** Pièces Wokwi sans type reconnu / non exportables. */
    skippedUnsupported: number;
};

type MappedPart = {
    figureId: string;
    exportId: string;
    wokwiType: string;
    metadataId: string;
    isBoard: boolean;
    boardKind: string | null;
    x: number;
    y: number;
    rotate: number;
};

/** Correspondance classe Lit → kind Velxio (cartes MCU). */
const BOARD_KIND_BY_CLASS: Record<string, string> = {
    ArduinoUnoElement: "arduino-uno",
    ArduinoNanoElement: "arduino-nano",
    ArduinoMegaElement: "arduino-mega",
    ESP32DevkitV1Element: "esp32",
    FranzininhoElement: "attiny85",
};

/** Préfixe d’id Wokwi préféré par kind de carte. */
const BOARD_ID_PREFIX: Record<string, string> = {
    "arduino-uno": "uno",
    "arduino-nano": "nano",
    "arduino-mega": "mega",
    esp32: "esp",
    attiny85: "attiny",
};

/**
 * Déduit le tag custom element Wokwi (`wokwi-…`) depuis la classe Lit.
 * @param clasz - Constructeur d’élément Wokwi.
 * @returns Tag `wokwi-*` ou `null` si indétectable.
 */
export function resolveWokwiElementTag(clasz: new () => HTMLElement): string | null {
    try {
        const el = new clasz();
        const tag = (el.localName || el.tagName || "").toLowerCase();
        if (tag.startsWith("wokwi-")) return tag;
    } catch {
        /* ignore */
    }
    const name = clasz.name || "";
    const base = name.replace(/Element$/, "");
    if (!base) return null;
    const kebab = base
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
        .toLowerCase();
    return `wokwi-${kebab}`;
}

/**
 * Identifiant catalogue Velxio (sans préfixe `wokwi-`).
 * @param wokwiType - Tag `wokwi-led`, etc.
 */
function metadataIdFromWokwiType(wokwiType: string): string {
    return wokwiType.replace(/^wokwi-/, "");
}

function uniqueId(prefix: string, used: Set<string>): string {
    let candidate = prefix;
    let n = 1;
    while (used.has(candidate)) {
        n += 1;
        candidate = `${prefix}${n}`;
    }
    used.add(candidate);
    return candidate;
}

function wireColorForPins(fromPin: string, toPin: string): string {
    const pins = `${fromPin} ${toPin}`.toUpperCase();
    if (/\bGND\b|\.GND|GROUND/.test(pins)) return "black";
    if (/\bVCC\b|\b5V\b|\b3V3\b|\bVIN\b|\.VCC/.test(pins)) return "red";
    return "green";
}

function mapFigures(figures: FigureData[]): {
    mapped: MappedPart[];
    skippedFritzing: number;
    skippedUnsupported: number;
    figureToExportId: Map<string, string>;
} {
    const used = new Set<string>();
    const mapped: MappedPart[] = [];
    let skippedFritzing = 0;
    let skippedUnsupported = 0;
    const figureToExportId = new Map<string, string>();

    for (const fig of figures) {
        const info = getComponentById(fig.componentId) as CatalogComponentInfo | undefined;
        if (!info) {
            skippedUnsupported += 1;
            continue;
        }
        if (isFritzingComponent(info)) {
            skippedFritzing += 1;
            continue;
        }
        if (!isWokwiComponent(info)) {
            skippedUnsupported += 1;
            continue;
        }
        const wokwi = info as WokwiComponentInfo;
        const wokwiType = resolveWokwiElementTag(wokwi.clasz);
        if (!wokwiType) {
            skippedUnsupported += 1;
            continue;
        }
        const boardKind = BOARD_KIND_BY_CLASS[wokwi.clasz.name] ?? null;
        const isBoard = isMicrocontrollerBoard(wokwi) && boardKind !== null;
        const idPrefix = isBoard && boardKind
            ? (BOARD_ID_PREFIX[boardKind] ?? metadataIdFromWokwiType(wokwiType))
            : metadataIdFromWokwiType(wokwiType).replace(/[^a-z0-9]+/gi, "_") || "part";
        const exportId = uniqueId(idPrefix, used);
        figureToExportId.set(fig.figureId, exportId);
        mapped.push({
            figureId: fig.figureId,
            exportId,
            wokwiType,
            metadataId: metadataIdFromWokwiType(wokwiType),
            isBoard,
            boardKind,
            x: fig.x,
            y: fig.y,
            rotate: typeof fig.rotation === "number" ? fig.rotation : 0,
        });
    }

    return { mapped, skippedFritzing, skippedUnsupported, figureToExportId };
}

/**
 * Construit un `diagram.json` Wokwi à partir d’une sauvegarde éditeur.
 * @param data - Figures et connexions HackCable.
 * @param options - Métadonnées auteur / éditeur.
 */
export function buildWokwiDiagram(
    data: EditorSaveData,
    options: { author?: string; editor?: string } = {},
): { diagram: WokwiDiagram } & SimCircuitExportResult {
    const { mapped, skippedFritzing, skippedUnsupported, figureToExportId } = mapFigures(data.figures);

    const parts: WokwiDiagramPart[] = mapped.map((p) => {
        const part: WokwiDiagramPart = {
            id: p.exportId,
            type: p.wokwiType,
            left: Math.round(p.x),
            top: Math.round(p.y),
            attrs: {},
        };
        if (p.rotate) part.rotate = p.rotate;
        return part;
    });

    const connections: WokwiDiagram["connections"] = [];
    for (const wire of data.connections) {
        const fromId = figureToExportId.get(wire.fromFigure);
        const toId = figureToExportId.get(wire.targetFigure);
        if (!fromId || !toId) continue;
        const color = wireColorForPins(wire.fromPortName, wire.targetPortName);
        connections.push([
            `${fromId}:${wire.fromPortName}`,
            `${toId}:${wire.targetPortName}`,
            color,
            [],
        ]);
    }

    return {
        diagram: {
            version: 1,
            author: options.author ?? "HackCable",
            editor: options.editor ?? "hackcable",
            parts,
            connections,
        },
        exportedCount: parts.length,
        skippedFritzing,
        skippedUnsupported,
    };
}

/** Payload `.vlx` (sous-ensemble compatible Velxio OSS). */
export type VelxioVlxPayload = {
    format: "velxio-project";
    version: 1;
    exportedAt: string;
    name?: string;
    boards: Array<{
        id: string;
        boardKind: string;
        x: number;
        y: number;
        activeFileGroupId: string;
        languageMode: "arduino";
    }>;
    fileGroups: Record<string, Array<{ name: string; content: string }>>;
    components: Array<{
        id: string;
        metadataId: string;
        x: number;
        y: number;
        properties: Record<string, unknown>;
    }>;
    wires: Array<{
        id: string;
        start: { componentId: string; pinName: string; x: number; y: number };
        end: { componentId: string; pinName: string; x: number; y: number };
        waypoints: Array<{ x: number; y: number }>;
        color: string;
    }>;
    activeBoardId: string | null;
};

function defaultSketchForBoard(boardKind: string): string {
    const ledHint = boardKind.startsWith("esp32") ? "2" : "13";
    return [
        `// Exported from HackCable — board: ${boardKind}`,
        "void setup() {",
        `  pinMode(${ledHint}, OUTPUT);`,
        "}",
        "",
        "void loop() {",
        `  digitalWrite(${ledHint}, HIGH);`,
        "  delay(500);",
        `  digitalWrite(${ledHint}, LOW);`,
        "  delay(500);",
        "}",
        "",
    ].join("\n");
}

/**
 * Construit un projet Velxio `.vlx` à partir d’une sauvegarde éditeur.
 * @param data - Figures et connexions HackCable.
 * @param options - Nom de projet optionnel.
 */
export function buildVelxioVlx(
    data: EditorSaveData,
    options: { name?: string } = {},
): { payload: VelxioVlxPayload } & SimCircuitExportResult {
    const { mapped, skippedFritzing, skippedUnsupported, figureToExportId } = mapFigures(data.figures);

    const boards: VelxioVlxPayload["boards"] = [];
    const fileGroups: VelxioVlxPayload["fileGroups"] = {};
    const components: VelxioVlxPayload["components"] = [];

    for (const p of mapped) {
        if (p.isBoard && p.boardKind) {
            const groupId = `group-${p.exportId}`;
            boards.push({
                id: p.exportId,
                boardKind: p.boardKind,
                x: Math.round(p.x),
                y: Math.round(p.y),
                activeFileGroupId: groupId,
                languageMode: "arduino",
            });
            fileGroups[groupId] = [
                { name: "sketch.ino", content: defaultSketchForBoard(p.boardKind) },
            ];
        } else {
            components.push({
                id: p.exportId,
                metadataId: p.metadataId,
                x: Math.round(p.x),
                y: Math.round(p.y),
                properties: p.rotate ? { rotate: p.rotate } : {},
            });
        }
    }

    const wires: VelxioVlxPayload["wires"] = [];
    let wireIndex = 0;
    for (const wire of data.connections as WiringData[]) {
        const fromId = figureToExportId.get(wire.fromFigure);
        const toId = figureToExportId.get(wire.targetFigure);
        if (!fromId || !toId) continue;
        wireIndex += 1;
        const color = wireColorForPins(wire.fromPortName, wire.targetPortName);
        const hex = color === "red" ? "#ef4444" : color === "black" ? "#111827" : "#22c55e";
        wires.push({
            id: `wire_${wireIndex}`,
            start: { componentId: fromId, pinName: wire.fromPortName, x: 0, y: 0 },
            end: { componentId: toId, pinName: wire.targetPortName, x: 0, y: 0 },
            waypoints: [],
            color: hex,
        });
    }

    return {
        payload: {
            format: "velxio-project",
            version: 1,
            exportedAt: new Date().toISOString(),
            name: options.name ?? "HackCable export",
            boards,
            fileGroups,
            components,
            wires,
            activeBoardId: boards[0]?.id ?? null,
        },
        exportedCount: boards.length + components.length,
        skippedFritzing,
        skippedUnsupported,
    };
}
