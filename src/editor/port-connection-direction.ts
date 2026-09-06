/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Direction de sortie des fils depuis une pastille (bord le plus proche).
 *
 * Responsabilités :
 * - Corriger le bug draw2d UP/DOWN pour un point intérieur au bbox
 * - Tourner la direction avec l’angle du composant
 * - Vérifier l’alignement du premier segment de fil
 */
import type { Port } from "draw2d-types";
import { CoordinatePortLocator, PercentPortLocator } from "./coordinate-port-locator";

/** Aligné sur draw2d.geo.Rectangle.DIRECTION_*. */
export const PORT_DIR = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3,
} as const;

type SizedParent = {
    getWidth: () => number;
    getHeight: () => number;
    getAbsoluteX?: () => number;
    getAbsoluteY?: () => number;
    getRotationAngle?: () => number;
};

/**
 * Détermine le bord le plus proche en coordonnées locales (avant rotation).
 * @param localX - Position X locale du port.
 * @param localY - Position Y locale du port.
 * @param width - Largeur du composant parent.
 * @param height - Hauteur du composant parent.
 * @returns Constante `PORT_DIR` du bord le plus proche.
 */
export function nearestEdgeDirection(localX: number, localY: number, width: number, height: number): number {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const candidates: Array<[number, number]> = [
        [PORT_DIR.UP, localY],
        [PORT_DIR.RIGHT, w - localX],
        [PORT_DIR.DOWN, h - localY],
        [PORT_DIR.LEFT, localX],
    ];
    candidates.sort((a, b) => a[1] - b[1]);
    return candidates[0][0];
}

/**
 * Fait tourner une direction draw2d avec l'angle du composant (pas de 90°).
 * @param direction - Direction initiale (`PORT_DIR`).
 * @param angleDeg - Angle de rotation du composant en degrés.
 * @returns Direction tournée.
 */
export function rotatePortDirection(direction: number, angleDeg: number): number {
    const steps = ((Math.round(angleDeg / 90) % 4) + 4) % 4;
    return (((direction % 4) + 4) % 4 + steps) % 4;
}

type PortLike = {
    getParent?: () => SizedParent | null | undefined;
    getLocator?: () => unknown;
    getAbsoluteX?: () => number;
    getAbsoluteY?: () => number;
};

function localPortPoint(port: PortLike, parent: SizedParent): { x: number; y: number } {
    const locator = typeof port.getLocator === "function" ? port.getLocator() : null;
    const w = parent.getWidth();
    const h = parent.getHeight();

    if (locator instanceof PercentPortLocator) {
        return {
            x: (w / 100) * locator.xPercent,
            y: (h / 100) * locator.yPercent,
        };
    }
    if (locator instanceof CoordinatePortLocator) {
        return { x: locator.x, y: locator.y };
    }

    const ax = typeof port.getAbsoluteX === "function" ? port.getAbsoluteX() : 0;
    const ay = typeof port.getAbsoluteY === "function" ? port.getAbsoluteY() : 0;
    const px = typeof parent.getAbsoluteX === "function" ? parent.getAbsoluteX() : 0;
    const py = typeof parent.getAbsoluteY === "function" ? parent.getAbsoluteY() : 0;
    return { x: ax - px, y: ay - py };
}

/**
 * Calcule la direction de connexion attendue (sortie orthogonale hors du composant).
 * @param port - Port draw2d ou objet port-like.
 * @returns Constante `PORT_DIR` de sortie.
 */
export function resolvePortConnectionDirection(port: Port | PortLike): number {
    const parent = (port as PortLike).getParent?.() as SizedParent | null | undefined;
    if (!parent || typeof parent.getWidth !== "function") {
        return PORT_DIR.LEFT;
    }
    const { x, y } = localPortPoint(port as PortLike, parent);
    const localDir = nearestEdgeDirection(x, y, parent.getWidth(), parent.getHeight());
    const angle = Number(parent.getRotationAngle?.()) || 0;
    return rotatePortDirection(localDir, angle);
}

/**
 * Vérifie si un segment suit la direction de sortie du port.
 * @param portPoint - Point d'ancrage au port.
 * @param nextPoint - Extrémité opposée du segment.
 * @param direction - Direction attendue (`PORT_DIR`).
 * @returns `true` si le segment est aligné avec la direction.
 */
export function segmentMatchesExitDirection(
    portPoint: { x: number; y: number },
    nextPoint: { x: number; y: number },
    direction: number,
): boolean {
    const dx = nextPoint.x - portPoint.x;
    const dy = nextPoint.y - portPoint.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    switch (direction) {
        case PORT_DIR.LEFT:
            return horizontal && dx <= 0;
        case PORT_DIR.RIGHT:
            return horizontal && dx >= 0;
        case PORT_DIR.UP:
            return !horizontal && dy <= 0;
        case PORT_DIR.DOWN:
            return !horizontal && dy >= 0;
        default:
            return true;
    }
}
