/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Lit les fils branchés sur un port draw2d (extrémité opposée = peer).
 *
 * Responsabilités :
 * - Parcourir les connexions source/target d’un port
 * - Dédupliquer les peers et résoudre le libellé opposé
 */
import type { Port } from "draw2d-types";
import { isFritzingComponent } from "../../panels/component";
import { ComponentFigure } from "../component-figure";
import { getConnectionWireLabelText } from "../connection-label";
import type { McuPinPeerConnection } from "./types";

/** Sous-ensemble de l’API Port dont on a besoin (évite de dépendre de tout draw2d). */
export type PortLike = Port & {
    getConnections?: () => { data?: unknown[] };
    getLocator?: () => { portId?: string };
    getParent?: () => unknown;
};

type ConnectionLike = {
    getSource?: () => PortLike;
    getTarget?: () => PortLike;
    sourcePort?: PortLike;
};

/**
 * Résout le libellé lisible d'un port distant.
 * @param peerFigure - Composant à l'autre bout du fil.
 * @param peerPortKey - Clé draw2d (`portId`) du port distant.
 * @returns Libellé catalogue ou clé brute.
 */
export function resolvePeerPortLabel(peerFigure: ComponentFigure, peerPortKey: string): string {
    const info = peerFigure.getComponentInfo();
    if (isFritzingComponent(info)) {
        const pin = info.pins.find((p) => p.id === peerPortKey);
        return pin?.name ?? peerPortKey;
    }
    return peerPortKey;
}

/**
 * Liste les connexions d'un port MCU côté peer (extrémité opposée).
 * @param port - Port MCU (peut être `undefined` si pastille absente).
 * @returns Liste dédupliquée des extrémités opposées câblées.
 */
export function collectPeerConnections(port: PortLike | undefined): McuPinPeerConnection[] {
    if (!port || typeof port.getConnections !== "function") return [];

    const peers: McuPinPeerConnection[] = [];
    for (const raw of port.getConnections()?.data ?? []) {
        const peer = peerFromConnection(port, raw as ConnectionLike);
        if (peer) peers.push(peer);
    }
    return dedupePeers(peers);
}

/**
 * Déduit le port opposé et construit une entrée peer.
 */
function peerFromConnection(localPort: PortLike, connection: ConnectionLike): McuPinPeerConnection | null {
    const source = connection.getSource?.() ?? connection.sourcePort;
    const target = connection.getTarget?.();
    if (!source || !target) return null;

    const peerPort = source === localPort ? target : target === localPort ? source : null;
    if (!peerPort) return null;

    const peerParent = peerPort.getParent?.();
    if (!(peerParent instanceof ComponentFigure)) return null;

    const peerPortKey = String(peerPort.getLocator?.()?.portId ?? "");
    if (!peerPortKey) return null;

    const wireLabel = getConnectionWireLabelText(connection);
    return {
        peerFigureId: String(peerParent.getId()),
        peerComponentId: peerParent.getComponentInfo().id,
        peerPortKey,
        peerPortLabel: resolvePeerPortLabel(peerParent, peerPortKey),
        ...(wireLabel ? { wireLabel } : {}),
    };
}

/** Évite les doublons si draw2d liste deux fois la même connexion. */
function dedupePeers(peers: McuPinPeerConnection[]): McuPinPeerConnection[] {
    const seen = new Set<string>();
    return peers.filter((p) => {
        const key = `${p.peerFigureId}|${p.peerPortKey}|${p.wireLabel ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
