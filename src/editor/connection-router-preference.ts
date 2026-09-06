/**
 * @file Préférence d’algorithme de routage des fils (draw2d connection routers).
 * @see https://freegroup.github.io/draw2d/#/examples/connection_router
 * @see https://freegroup.github.io/draw2d/#/examples/connection_vertex
 */
import draw2d from "draw2d";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RoutingMeta = {
    routedByUserInteraction?: boolean;
    fromDir?: number;
    toDir?: number;
};

type VertexList = {
    getSize: () => number;
    get: (i: number) => { x: number; y: number };
};

type ConnLike = {
    _routingMetaData?: RoutingMeta;
    addPoint: (p: unknown) => void;
    getVertices: () => {
        getSize: () => number;
        get: (i: number) => { setPosition: (p: unknown) => void };
        first: () => { setPosition: (p: unknown) => void };
        last: () => { setPosition: (p: unknown) => void };
    };
    getStartPosition: (peer?: unknown) => unknown;
    getEndPosition: (peer?: unknown) => unknown;
    installEditPolicy: (policy: unknown) => void;
};

function ensureRouterMeta(conn: ConnLike): RoutingMeta {
    if (!conn._routingMetaData) {
        conn._routingMetaData = {
            routedByUserInteraction: false,
            fromDir: -1,
            toDir: -1,
        };
    }
    return conn._routingMetaData;
}

/** Conserve les sommets après édition manuelle (comportement VertexRouter). */
function stickyVertexRoute(
    conn: ConnLike,
    oldVertices: VertexList,
    paint: () => void,
): void {
    const count = oldVertices.getSize();
    for (let i = 0; i < count; i++) {
        conn.addPoint(oldVertices.get(i));
    }
    const ps = conn.getVertices();
    if (ps.getSize() >= 2) {
        const startAnchor = conn.getStartPosition(ps.get(1));
        const endAnchor = conn.getEndPosition(ps.get(ps.getSize() - 2));
        ps.first().setPosition(startAnchor);
        ps.last().setPosition(endAnchor);
    }
    paint();
}

const editableRouterCache = new WeakMap<object, new () => unknown>();

/**
 * Routeur algorithmique + poignées de sommets éditables
 * (comme l’exemple draw2d connection_vertex).
 * Les Manhattan interactifs gardent OrthogonalSelectionFeedbackPolicy via leur onInstall.
 */
function withVertexEditing(RouterClass: { extend: (proto: object) => any; prototype?: { NAME?: string } }): new () => unknown {
    const cached = editableRouterCache.get(RouterClass);
    if (cached) return cached;

    const Editable = RouterClass.extend({
        NAME: `${RouterClass.prototype?.NAME ?? "Router"}.Editable`,

        onInstall(connection: ConnLike) {
            if (typeof (this as any)._super === "function") {
                (this as any)._super(connection);
            }
            connection.installEditPolicy(new draw2d.policy.line.VertexSelectionFeedbackPolicy());
            ensureRouterMeta(connection);
        },

        route(conn: ConnLike, routingHints: { oldVertices?: VertexList }) {
            const hints = routingHints ?? {};
            const oldVertices: VertexList = hints.oldVertices ?? new draw2d.util.ArrayList();
            hints.oldVertices = oldVertices;
            const meta = ensureRouterMeta(conn);
            if (meta.routedByUserInteraction && oldVertices.getSize() > 0) {
                stickyVertexRoute(conn, oldVertices, () => (this as any)._paint(conn));
                return;
            }
            return (this as any)._super(conn, hints);
        },

        canRemoveVertexAt(conn: ConnLike, index: number) {
            return index > 0 && index < conn.getVertices().getSize() - 1;
        },
    });

    editableRouterCache.set(RouterClass, Editable);
    return Editable;
}

function createEditable(RouterClass: { extend: (proto: object) => any; prototype?: { NAME?: string } }): unknown {
    const Ctor = withVertexEditing(RouterClass);
    return new Ctor();
}

export type WireRouterId =
    | "manhattan"
    | "manhattanBridged"
    | "interactiveManhattan"
    | "interactiveManhattanBridged"
    | "circuit"
    | "direct"
    | "spline"
    | "maze"
    | "sketch"
    | "fan";

export type WireRouterOption = {
    id: WireRouterId;
    /** Clé i18n sous a11y.router* */
    labelKey: string;
};

/** Options proposées (ordre proche de l’exemple draw2d). */
export const WIRE_ROUTER_OPTIONS: readonly WireRouterOption[] = [
    { id: "manhattan", labelKey: "a11y.routerManhattan" },
    { id: "manhattanBridged", labelKey: "a11y.routerManhattanBridged" },
    { id: "interactiveManhattan", labelKey: "a11y.routerInteractiveManhattan" },
    { id: "interactiveManhattanBridged", labelKey: "a11y.routerInteractiveManhattanBridged" },
    { id: "circuit", labelKey: "a11y.routerCircuit" },
    { id: "direct", labelKey: "a11y.routerDirect" },
    { id: "spline", labelKey: "a11y.routerSpline" },
    { id: "maze", labelKey: "a11y.routerMaze" },
    { id: "sketch", labelKey: "a11y.routerSketch" },
    { id: "fan", labelKey: "a11y.routerFan" },
] as const;

export const DEFAULT_WIRE_ROUTER: WireRouterId = "interactiveManhattanBridged";

const ROUTER_IDS = new Set<string>(WIRE_ROUTER_OPTIONS.map((o) => o.id));

export function isWireRouterId(value: string): value is WireRouterId {
    return ROUTER_IDS.has(value);
}

export function normalizeWireRouterId(value: unknown): WireRouterId {
    return typeof value === "string" && isWireRouterId(value) ? value : DEFAULT_WIRE_ROUTER;
}

let preferredWireRouterId: WireRouterId = DEFAULT_WIRE_ROUTER;

export function getPreferredWireRouterId(): WireRouterId {
    return preferredWireRouterId;
}

export function setPreferredWireRouterId(id: WireRouterId | string): WireRouterId {
    preferredWireRouterId = normalizeWireRouterId(id);
    return preferredWireRouterId;
}

/** Factory pour le routeur HackCable (ponts) — enregistrée depuis connection-router.ts. */
let bridgedInteractiveFactory: (() => unknown) | null = null;

export function registerBridgedInteractiveRouterFactory(factory: () => unknown): void {
    bridgedInteractiveFactory = factory;
}

function createBridgedInteractive(): unknown {
    if (bridgedInteractiveFactory) return bridgedInteractiveFactory();
    return new draw2d.layout.connection.InteractiveManhattanConnectionRouter();
}

/** Instancie le routeur draw2d correspondant (éditabilité des sommets par défaut). */
export function createWireRouterInstance(id: WireRouterId = getPreferredWireRouterId()): unknown {
    switch (normalizeWireRouterId(id)) {
        case "manhattan":
            return createEditable(draw2d.layout.connection.ManhattanConnectionRouter);
        case "manhattanBridged":
            return createEditable(draw2d.layout.connection.ManhattanBridgedConnectionRouter);
        case "interactiveManhattan":
            // OrthogonalSelectionFeedbackPolicy via onInstall (segments orthogonaux).
            return new draw2d.layout.connection.InteractiveManhattanConnectionRouter();
        case "interactiveManhattanBridged":
            return createBridgedInteractive();
        case "circuit":
            return createEditable(draw2d.layout.connection.CircuitConnectionRouter);
        case "direct":
            return createEditable(draw2d.layout.connection.DirectRouter);
        case "spline":
            return createEditable(draw2d.layout.connection.SplineConnectionRouter);
        case "maze":
            return createEditable(draw2d.layout.connection.MazeConnectionRouter);
        case "sketch":
            return createEditable(draw2d.layout.connection.SketchConnectionRouter);
        case "fan":
            return createEditable(draw2d.layout.connection.FanConnectionRouter);
        default:
            return createBridgedInteractive();
    }
}

type LineLike = {
    setRouter?: (router: unknown) => void;
    svgPathString?: string | null;
    repaint?: () => void;
    _routingMetaData?: { routedByUserInteraction?: boolean };
};

type CanvasLike = {
    getLines?: () => {
        data?: LineLike[];
        each?: (fn: (i: number, line: LineLike) => void) => void;
    };
    calculateConnectionIntersection?: () => void;
};

/**
 * Applique le routeur à toutes les connexions du canvas
 * (comme l’exemple draw2d connection_router).
 */
export function applyWireRouterToCanvas(canvas: object, routerId: WireRouterId): void {
    const view = canvas as CanvasLike;
    const router = createWireRouterInstance(routerId);
    const lines = view.getLines?.();

    const applyOne = (line: LineLike) => {
        if (line._routingMetaData) {
            line._routingMetaData.routedByUserInteraction = false;
        }
        line.setRouter?.(router);
        line.svgPathString = null;
        line.repaint?.();
    };

    if (typeof lines?.each === "function") {
        lines.each((_i, line) => applyOne(line));
    } else if (Array.isArray(lines?.data)) {
        for (const line of lines.data) applyOne(line);
    }

    view.calculateConnectionIntersection?.();
    if (typeof lines?.each === "function") {
        lines.each((_i, line) => {
            line.svgPathString = null;
            line.repaint?.();
        });
    } else if (Array.isArray(lines?.data)) {
        for (const line of lines.data) {
            line.svgPathString = null;
            line.repaint?.();
        }
    }
}
