/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Point d’entrée du module « table des broches MCU ».
 *
 * Responsabilités :
 * - Ré-exporter types et fonctions publics
 * - Documenter l’organisation du dossier pour un néophyte
 *
 * Organisation :
 * - `types.ts` → formes de données publiques
 * - `list-pins.ts` → quelles broches existent sur une carte
 * - `port-connections.ts` → quels fils sont branchés
 * - `build-table.ts` → assemblage snapshot
 * - `query.ts` → recherches dans un snapshot
 * - `watch.ts` → cache + événements canvas
 *
 * @see docs/mcu-pin-api.md
 */
export type {
    McuBoardPinTable,
    McuPinConnectionTable,
    McuPinDescriptor,
    McuPinPeerConnection,
    McuPinStatus,
    McuPinTableChangeListener,
} from "./types";

export { buildMcuPinConnectionTable } from "./build-table";
export { listMcuPinDescriptors } from "./list-pins";
export { collectPeerConnections, resolvePeerPortLabel } from "./port-connections";
export {
    findMcuPinStatus,
    indexMcuPinConnectionTable,
    isMcuPinConnectedInTable,
} from "./query";
export { McuPinTableStore, asMcuPinWatchCanvas } from "./watch";
export type { McuPinWatchCanvas } from "./watch";
