/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Routeur Manhattan interactif + ponts aux croisements de fils.
 *
 * Responsabilités :
 * - Router les connexions avec sauts (bridges)
 * - Créer une connexion câblée (`createWiringConnection`)
 * - Marquer un tracé comme modifié par l’utilisateur
 *
 * @see docs/wire-routers.md
 */
import draw2d from "draw2d";
import { segmentMatchesExitDirection } from "./port-connection-direction";
import {
    createWireRouterInstance,
    getPreferredWireRouterId,
    registerBridgedInteractiveRouterFactory,
} from "./connection-router-preference";

type Point2 = { x: number; y: number };
type IntersectionPoint = Point2 & {
    justTouching?: boolean;
    other?: { getId?: () => string };
};

type WiringConnection = {
    getId: () => string;
    getCanvas: () => {
        getIntersection?: (line: unknown) => {
            each: (fn: (i: number, p: IntersectionPoint) => void) => void;
        };
        calculateConnectionIntersection?: () => void;
    } | null;
    getVertices: () => {
        getSize: () => number;
        get: (i: number) => Point2;
    };
    getSource?: () => { getConnectionDirection: (peer: unknown) => number };
    getTarget?: () => { getConnectionDirection: (peer: unknown) => number };
    svgPathString: string;
    routingRequired?: boolean;
    _routingMetaData?: {
        routedByUserInteraction?: boolean;
        fromDir?: number;
        toDir?: number;
    };
};

type VertexList = {
    getSize: () => number;
    get: (i: number) => Point2;
};

/**
 * Vérifie si la sortie du port correspond encore au premier/dernier segment.
 * @param conn - Connexion draw2d à analyser.
 * @returns `true` si un recalcul de routage a été demandé.
 */
export function ensureOrthogonalPortExits(conn: WiringConnection): boolean {
    const meta = conn._routingMetaData;
    if (!meta?.routedByUserInteraction) return false;
    const source = conn.getSource?.();
    const target = conn.getTarget?.();
    if (!source || !target) return false;

    const verts = conn.getVertices();
    if (!verts || verts.getSize() < 2) return false;

    const fromDir = source.getConnectionDirection(target);
    const toDir = target.getConnectionDirection(source);
    const n = verts.getSize();
    const startOk = segmentMatchesExitDirection(verts.get(0), verts.get(1), fromDir);
    const endOk = segmentMatchesExitDirection(verts.get(n - 1), verts.get(n - 2), toDir);
    if (startOk && endOk) return false;

    meta.routedByUserInteraction = false;
    conn.routingRequired = true;
    return true;
}

function clearUserRoutingIfStubMismatch(
    conn: WiringConnection,
    oldVertices?: VertexList | null,
): void {
    const meta = conn._routingMetaData;
    if (!meta?.routedByUserInteraction) return;
    const source = conn.getSource?.();
    const target = conn.getTarget?.();
    if (!source || !target) return;

    const verts = oldVertices && oldVertices.getSize() > 0 ? oldVertices : conn.getVertices();
    if (!verts || verts.getSize() < 2) return;

    const fromDir = source.getConnectionDirection(target);
    const toDir = target.getConnectionDirection(source);
    const n = verts.getSize();
    const startOk = segmentMatchesExitDirection(verts.get(0), verts.get(1), fromDir);
    const endOk = segmentMatchesExitDirection(verts.get(n - 1), verts.get(n - 2), toDir);
    if (!startOk || !endOk) {
        meta.routedByUserInteraction = false;
    }
}

const BRIDGE_HALF = 7;
const BRIDGE_HUMP = 6;

/** Policy draw2d pour split/remove de segments orthogonaux. */
const segmentPolicy = new draw2d.policy.line.OrthogonalSelectionFeedbackPolicy();

function collectIntersections(
    canvas: NonNullable<ReturnType<WiringConnection["getCanvas"]>>,
    conn: WiringConnection,
): IntersectionPoint[] {
    if (typeof canvas.calculateConnectionIntersection === "function") {
        canvas.calculateConnectionIntersection();
    }
    const list = canvas.getIntersection?.(conn);
    const points: IntersectionPoint[] = [];
    list?.each((_i, p) => points.push(p));
    return points;
}

function dist2(a: Point2, b: Point2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function shouldDrawBridgeOnSegment(
    conn: WiringConnection,
    segmentStart: Point2,
    segmentEnd: Point2,
    interP: IntersectionPoint,
): boolean {
    const otherId = interP.other && typeof interP.other.getId === "function"
        ? String(interP.other.getId())
        : "";
    const selfId = String(conn.getId());
    if (otherId) return selfId <= otherId;

    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    return Math.abs(dx) >= Math.abs(dy);
}

function appendOrientedBridge(
    path: Array<string | number>,
    from: Point2,
    to: Point2,
    inter: Point2,
): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const half = Math.min(BRIDGE_HALF, len / 3);
    const beforeX = inter.x - ux * half;
    const beforeY = inter.y - uy * half;
    const afterX = inter.x + ux * half;
    const afterY = inter.y + uy * half;
    const peakX = inter.x + nx * BRIDGE_HUMP;
    const peakY = inter.y + ny * BRIDGE_HUMP;

    path.push(" L", (beforeX | 0) + 0.5, " ", (beforeY | 0) + 0.5);
    path.push(
        " Q",
        (peakX | 0) + 0.5,
        " ",
        (peakY | 0) + 0.5,
        " ",
        (afterX | 0) + 0.5,
        " ",
        (afterY | 0) + 0.5,
    );
}

function paintConnectionWithBridges(conn: WiringConnection, fallback: () => void): void {
    const canvas = conn.getCanvas?.();
    if (!canvas || typeof canvas.getIntersection !== "function") {
        fallback();
        return;
    }

    const intersections = collectIntersections(canvas, conn);
    const ps = conn.getVertices();
    if (!ps || ps.getSize() === 0) {
        conn.svgPathString = "";
        return;
    }

    const first = ps.get(0);
    const path: Array<string | number> = ["M", (first.x | 0) + 0.5, " ", (first.y | 0) + 0.5];
    let oldP = first;

    for (let i = 1; i < ps.getSize(); i++) {
        const p = ps.get(i);
        const onSegment = intersections
            .filter((interP) => {
                if (interP.justTouching) return false;
                if (!draw2d.shape.basic.Line.hit(1, oldP.x, oldP.y, p.x, p.y, interP.x, interP.y)) {
                    return false;
                }
                return shouldDrawBridgeOnSegment(conn, oldP, p, interP);
            })
            .sort((a, b) => dist2(oldP, a) - dist2(oldP, b));

        for (const interP of onSegment) {
            appendOrientedBridge(path, oldP, p, interP);
        }

        path.push(" L", (p.x | 0) + 0.5, " ", (p.y | 0) + 0.5);
        oldP = p;
    }

    conn.svgPathString = path.join("");
}

/**
 * InteractiveManhattan (segments orthogonaux éditables) + bridges.
 * Install OrthogonalSelectionFeedbackPolicy via onInstall du parent.
 */
export const BridgedInteractiveManhattanRouter =
    draw2d.layout.connection.InteractiveManhattanConnectionRouter.extend({
        NAME: "hackCable.BridgedInteractiveManhattanRouter",

        route(conn: WiringConnection, routingHints: { oldVertices?: VertexList }) {
            const hints = routingHints ?? {};
            clearUserRoutingIfStubMismatch(conn, hints.oldVertices);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (this as any)._super(conn, hints);
        },

        _paint(conn: WiringConnection) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paintConnectionWithBridges(conn, () => (this as any)._super(conn));
        },
    });

/**
 * Marque une connexion comme routée manuellement (conserve les sommets au reload).
 * @param conn - Connexion draw2d à marquer.
 */
export function markConnectionUserRouted(conn: {
    _routingMetaData?: { routedByUserInteraction?: boolean; fromDir?: number; toDir?: number };
}): void {
    ensureRoutingMetaData(conn);
    conn._routingMetaData!.routedByUserInteraction = true;
}

/**
 * Crée `_routingMetaData` si absent (requis par split/remove de segments).
 * @param conn - Connexion draw2d à initialiser.
 */
export function ensureRoutingMetaData(conn: {
    _routingMetaData?: { routedByUserInteraction?: boolean; fromDir?: number; toDir?: number };
}): void {
    if (!conn._routingMetaData) {
        conn._routingMetaData = {
            routedByUserInteraction: false,
            fromDir: -1,
            toDir: -1,
        };
    }
}

export type ConnectionSegmentHit = {
    index: number;
    start: Point2;
    end: Point2;
};

/**
 * Retourne le segment de connexion sous le point canvas, ou null.
 * @param conn - Connexion draw2d.
 * @param x - Abscisse logique du point.
 * @param y - Ordonnée logique du point.
 * @returns Segment touché ou `null`.
 */
export function hitConnectionSegment(
    conn: { hitSegment?: (x: number, y: number) => ConnectionSegmentHit | null },
    x: number,
    y: number,
): ConnectionSegmentHit | null {
    if (typeof conn.hitSegment !== "function") return null;
    return conn.hitSegment(x, y) ?? null;
}

/**
 * Indique si la connexion supporte l'édition de segments orthogonaux.
 * @param conn - Connexion draw2d.
 * @returns `true` si split/remove de segments est possible.
 */
export function supportsOrthogonalSegmentEdit(conn: {
    getRouter?: () => { canRemoveSegmentAt?: (c: unknown, index: number) => boolean; NAME?: string };
}): boolean {
    const router = conn.getRouter?.();
    if (!router) return false;
    if (typeof router.canRemoveSegmentAt === "function") return true;
    const name = String(router.NAME ?? "");
    return name.includes("InteractiveManhattan");
}

/**
 * Indique si le segment peut être supprimé selon les règles InteractiveManhattan.
 * @param conn - Connexion draw2d.
 * @param segmentIndex - Index du segment à supprimer.
 * @returns `true` si la suppression est autorisée.
 */
export function canRemoveConnectionSegment(
    conn: { getRouter?: () => { canRemoveSegmentAt?: (c: unknown, index: number) => boolean } },
    segmentIndex: number,
): boolean {
    if (!supportsOrthogonalSegmentEdit(conn)) return false;
    const router = conn.getRouter?.();
    if (!router || typeof router.canRemoveSegmentAt !== "function") return false;
    return router.canRemoveSegmentAt(conn, segmentIndex) === true;
}

/**
 * Ajoute un coude orthogonal sur le segment (comme l'exemple draw2d).
 * @param conn - Connexion draw2d.
 * @param segmentIndex - Index du segment cible.
 * @param x - Abscisse logique du nouveau sommet.
 * @param y - Ordonnée logique du nouveau sommet.
 */
export function splitConnectionSegment(
    conn: unknown,
    segmentIndex: number,
    x: number,
    y: number,
): void {
    ensureRoutingMetaData(conn as WiringConnection);
    segmentPolicy.splitSegment(conn, segmentIndex, x, y);
    markConnectionUserRouted(conn as WiringConnection);
}

/**
 * Supprime un segment orthogonal de la connexion.
 * @param conn - Connexion draw2d.
 * @param segmentIndex - Index du segment à retirer.
 */
export function removeConnectionSegment(conn: unknown, segmentIndex: number): void {
    ensureRoutingMetaData(conn as WiringConnection);
    segmentPolicy.removeSegment(conn, segmentIndex);
    markConnectionUserRouted(conn as WiringConnection);
}

/**
 * Crée une connexion câblage avec le routeur préféré.
 * @returns Nouvelle instance draw2d.Connection configurée.
 */
export function createWiringConnection(): InstanceType<typeof draw2d.Connection> {
    return new draw2d.Connection({
        router: createWireRouterInstance(getPreferredWireRouterId()),
        stroke: 2,
        color: "#2c70ff",
        radius: 3,
    });
}

registerBridgedInteractiveRouterFactory(() => new BridgedInteractiveManhattanRouter());
