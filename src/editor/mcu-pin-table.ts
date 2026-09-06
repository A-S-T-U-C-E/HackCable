/**
 * @file Table des broches MCU (connectées ou non) pour API tierce (ex. µcBlockly).
 */
import type { ElementPin } from "@wokwi/elements";
import type { Port } from "draw2d-types";
import {
    isFritzingComponent,
    isMicrocontrollerBoard,
    isWokwiComponent,
    type CatalogComponentInfo,
    type WokwiComponent,
} from "../panels/component";
import { ComponentFigure } from "./component-figure";
import { getConnectionWireLabelText } from "./connection-label";

export type McuPinPeerConnection = {
    peerFigureId: string;
    peerComponentId: number;
    peerPortKey: string;
    peerPortLabel?: string;
    wireLabel?: string;
};

export type McuPinStatus = {
    /** Clé draw2d (`portId`) pour `getPortByName`. */
    pinKey: string;
    /** Libellé humain (ex. `D13`, `GND`). */
    pinLabel: string;
    connected: boolean;
    connections: McuPinPeerConnection[];
};

export type McuBoardPinTable = {
    figureId: string;
    componentId: number;
    boardName: string;
    source: "wokwi" | "fritzing";
    moduleId?: string;
    family?: string;
    category: string;
    /** true si les pastilles Fritzing ne sont pas encore créées (SVG en cours). */
    portsPending: boolean;
    pins: McuPinStatus[];
};

export type McuPinConnectionTable = McuBoardPinTable[];

type PortLike = Port & {
    getConnections?: () => { data?: unknown[] };
    getLocator?: () => { portId?: string };
    getParent?: () => unknown;
};

type ConnectionLike = {
    getSource?: () => PortLike;
    getTarget?: () => PortLike;
    sourcePort?: PortLike;
};

type PinDescriptor = { pinKey: string; pinLabel: string };

function listPinDescriptors(component: CatalogComponentInfo, figure: ComponentFigure): PinDescriptor[] {
    if (isFritzingComponent(component)) {
        if (component.pins.length > 0) {
            return component.pins.map((pin) => ({
                pinKey: pin.id,
                pinLabel: pin.name || pin.id,
            }));
        }
    }

    if (isWokwiComponent(component)) {
        try {
            const element: WokwiComponent = new component.clasz();
            const pinInfo = (element as { pinInfo?: ElementPin[] }).pinInfo;
            if (Array.isArray(pinInfo) && pinInfo.length > 0) {
                return pinInfo.map((pin) => ({
                    pinKey: pin.name,
                    pinLabel: pin.name,
                }));
            }
        } catch {
            // fallback ports ci-dessous
        }
    }

    const ports = (figure as unknown as { hybridPorts?: { data?: PortLike[] } }).hybridPorts?.data ?? [];
    return ports
        .map((port) => {
            const key = String(port.getLocator?.()?.portId ?? "");
            return key ? { pinKey: key, pinLabel: key } : null;
        })
        .filter((p): p is PinDescriptor => p != null);
}

function peerPortLabel(peerFigure: ComponentFigure, peerPortKey: string): string | undefined {
    const info = peerFigure.getComponentInfo();
    if (isFritzingComponent(info)) {
        const pin = info.pins.find((p) => p.id === peerPortKey);
        return pin?.name ?? peerPortKey;
    }
    return peerPortKey;
}

function collectConnectionsForPort(port: PortLike | undefined): McuPinPeerConnection[] {
    if (!port || typeof port.getConnections !== "function") return [];
    const connections = port.getConnections()?.data ?? [];
    const peers: McuPinPeerConnection[] = [];

    for (const raw of connections) {
        const connection = raw as ConnectionLike;
        const source = connection.getSource?.() ?? connection.sourcePort;
        const target = connection.getTarget?.();
        if (!source || !target) continue;

        const peerPort = source === port ? target : target === port ? source : null;
        if (!peerPort) continue;

        const peerParent = peerPort.getParent?.();
        if (!(peerParent instanceof ComponentFigure)) continue;

        const peerPortKey = String(peerPort.getLocator?.()?.portId ?? "");
        if (!peerPortKey) continue;

        const wireLabel = getConnectionWireLabelText(connection);
        peers.push({
            peerFigureId: String(peerParent.getId()),
            peerComponentId: peerParent.getComponentInfo().id,
            peerPortKey,
            peerPortLabel: peerPortLabel(peerParent, peerPortKey),
            ...(wireLabel ? { wireLabel } : {}),
        });
    }

    // Deduplicate identical peers (defensive)
    const seen = new Set<string>();
    return peers.filter((p) => {
        const key = `${p.peerFigureId}|${p.peerPortKey}|${p.wireLabel ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Construit la table live des broches pour toutes les cartes MCU du canvas. */
export function buildMcuPinConnectionTable(figures: Iterable<unknown>): McuPinConnectionTable {
    const tables: McuBoardPinTable[] = [];

    for (const figure of figures) {
        if (!(figure instanceof ComponentFigure)) continue;
        const component = figure.getComponentInfo();
        if (!isMicrocontrollerBoard(component)) continue;

        const descriptors = listPinDescriptors(component, figure);
        const portCount = (figure as unknown as { hybridPorts?: { data?: unknown[] } }).hybridPorts?.data?.length ?? 0;
        const portsPending = isFritzingComponent(component) && portCount === 0 && descriptors.length > 0;

        const pins: McuPinStatus[] = descriptors.map(({ pinKey, pinLabel }) => {
            const port = figure.getPortByName(pinKey) as PortLike | undefined;
            const connections = collectConnectionsForPort(port);
            return {
                pinKey,
                pinLabel,
                connected: connections.length > 0,
                connections,
            };
        });

        tables.push({
            figureId: String(figure.getId()),
            componentId: component.id,
            boardName: component.name,
            source: isFritzingComponent(component) ? "fritzing" : "wokwi",
            ...(isFritzingComponent(component) ? { moduleId: component.moduleId, family: component.family } : {}),
            category: component.category,
            portsPending,
            pins,
        });
    }

    return tables;
}

/** Index figureId → pinKey → statut (pratique pour requêtes µcBlockly). */
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

export function isMcuPinConnectedInTable(
    table: McuPinConnectionTable,
    figureId: string,
    pinKeyOrLabel: string,
): boolean {
    const board = table.find((b) => b.figureId === figureId);
    if (!board) return false;
    const pin = board.pins.find((p) => p.pinKey === pinKeyOrLabel || p.pinLabel === pinKeyOrLabel);
    return pin?.connected === true;
}
