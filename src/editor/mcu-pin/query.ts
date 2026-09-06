/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Requêtes simples sur une table MCU déjà construite.
 *
 * Responsabilités :
 * - Indexer / chercher une broche par id
 * - Savoir si une broche est connectée
 */
import type { McuPinConnectionTable, McuPinStatus } from "./types";

/**
 * Indexe une table MCU pour des lookups O(1) par figure et broche.
 * @param table - Snapshot retourné par `buildMcuPinConnectionTable`.
 * @returns Map `figureId → (pinKey|pinLabel → statut)`.
 */
export function indexMcuPinConnectionTable(
    table: McuPinConnectionTable,
): Map<string, Map<string, McuPinStatus>> {
    const byFigure = new Map<string, Map<string, McuPinStatus>>();

    for (const board of table) {
        const pins = new Map<string, McuPinStatus>();
        for (const pin of board.pins) {
            pins.set(pin.pinKey, pin);
            if (pin.pinLabel !== pin.pinKey) {
                pins.set(pin.pinLabel, pin);
            }
        }
        byFigure.set(board.figureId, pins);
    }

    return byFigure;
}

/**
 * Indique si une broche est câblée dans une table MCU.
 * @param table - Snapshot de la table MCU.
 * @param figureId - Identifiant de l'instance figure.
 * @param pinKeyOrLabel - Clé draw2d ou libellé humain (ex. `D13`).
 * @returns `true` si au moins un fil est branché.
 */
export function isMcuPinConnectedInTable(
    table: McuPinConnectionTable,
    figureId: string,
    pinKeyOrLabel: string,
): boolean {
    const board = table.find((b) => b.figureId === figureId);
    if (!board) return false;
    const pin = board.pins.find(
        (p) => p.pinKey === pinKeyOrLabel || p.pinLabel === pinKeyOrLabel,
    );
    return pin?.connected === true;
}

/**
 * Retrouve le statut d'une broche dans une table MCU.
 * @param table - Snapshot de la table MCU.
 * @param figureId - Identifiant de l'instance figure.
 * @param pinKeyOrLabel - Clé draw2d ou libellé humain.
 * @returns Statut de la broche ou `undefined`.
 */
export function findMcuPinStatus(
    table: McuPinConnectionTable,
    figureId: string,
    pinKeyOrLabel: string,
): McuPinStatus | undefined {
    return indexMcuPinConnectionTable(table).get(figureId)?.get(pinKeyOrLabel);
}
