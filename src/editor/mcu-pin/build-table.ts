/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Construit la table live « broches MCU × connexions ».
 *
 * Responsabilités :
 * - Assembler un snapshot pour une figure carte
 * - Associer chaque broche à ses peers câblés
 */
import {
    isFritzingComponent,
    isMicrocontrollerBoard,
} from "../../panels/component";
import { ComponentFigure } from "../component-figure";
import { listMcuPinDescriptors } from "./list-pins";
import { collectPeerConnections, type PortLike } from "./port-connections";
import type { McuBoardPinTable, McuPinConnectionTable, McuPinStatus } from "./types";

/**
 * Construit la table MCU à partir des figures d'un canvas.
 * @param figures - Itérable (souvent `canvas.getFigures().data`).
 * @returns Une entrée par instance MCU ; ignore les composants non-MCU.
 */
export function buildMcuPinConnectionTable(figures: Iterable<unknown>): McuPinConnectionTable {
    const tables: McuBoardPinTable[] = [];

    for (const figure of figures) {
        if (!(figure instanceof ComponentFigure)) continue;
        const board = buildOneBoardTable(figure);
        if (board) tables.push(board);
    }

    return tables;
}

/**
 * Construit la table d’une seule figure, ou `null` si ce n’est pas une MCU.
 */
function buildOneBoardTable(figure: ComponentFigure): McuBoardPinTable | null {
    const component = figure.getComponentInfo();
    if (!isMicrocontrollerBoard(component)) return null;

    const descriptors = listMcuPinDescriptors(component, figure);
    const portCount = figure.getHybridPorts().length;
    const portsPending =
        isFritzingComponent(component) && portCount === 0 && descriptors.length > 0;

    const pins: McuPinStatus[] = descriptors.map(({ pinKey, pinLabel }) => {
        const port = figure.getPortByName(pinKey) as PortLike | undefined;
        const connections = collectPeerConnections(port);
        return {
            pinKey,
            pinLabel,
            connected: connections.length > 0,
            connections,
        };
    });

    const fritzing = isFritzingComponent(component);
    return {
        figureId: String(figure.getId()),
        componentId: component.id,
        boardName: component.name,
        source: fritzing ? "fritzing" : "wokwi",
        ...(fritzing ? { moduleId: component.moduleId, family: component.family } : {}),
        category: component.category,
        portsPending,
        pins,
    };
}
