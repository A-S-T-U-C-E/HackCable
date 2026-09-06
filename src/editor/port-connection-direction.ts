/**
 * @file Direction de sortie des fils depuis une pastille (bord le plus proche).
 *
 * draw2d.Rectangle.getDirection, pour un point *intérieur* au bbox, ne renvoie
 * que UP/DOWN — d’où des sorties verticales sur des ports latéraux inset (Fritzing).
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

/** Bord le plus proche en coordonnées locales (avant rotation du composant). */
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

/** Fait tourner une direction draw2d avec l’angle du composant (pas de 90°). */
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

/** Direction de connexion attendue (sortie orthogonale hors du composant). */
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

/** Le premier (ou dernier) segment suit-il la direction de sortie du port ? */
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
