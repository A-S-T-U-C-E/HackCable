/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Rend un routeur draw2d « éditable » (poignées de sommets, sticky route).
 *
 * Responsabilités :
 * - Policy de sélection des vertex (style connection_vertex)
 * - Conserver le tracé manuel après déplacement des composants
 *
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

type Draw2dRouterClass = {
    extend: (proto: object) => new () => unknown;
    prototype?: { NAME?: string };
};

/** Crée `_routingMetaData` si absent (flag « tracé manuel »). */
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

/**
 * Rejoue les anciens sommets et recolle les ancres aux ports
 * (comportement de `VertexRouter`).
 */
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
 * Étend une classe de routeur draw2d pour y ajouter l’édition de sommets.
 *
 * @param RouterClass - ex. `draw2d.layout.connection.DirectRouter`
 * @returns Constructeur étendu (mis en cache)
 */
function withVertexEditing(RouterClass: Draw2dRouterClass): new () => unknown {
    const cached = editableRouterCache.get(RouterClass);
    if (cached) return cached;

    const Editable = RouterClass.extend({
        NAME: `${RouterClass.prototype?.NAME ?? "Router"}.Editable`,

        onInstall(connection: ConnLike) {
            if (typeof (this as any)._super === "function") {
                (this as any)._super(connection);
            }
            connection.installEditPolicy(
                new draw2d.policy.line.VertexSelectionFeedbackPolicy(),
            );
            ensureRouterMeta(connection);
        },

        route(conn: ConnLike, routingHints: { oldVertices?: VertexList }) {
            const hints = routingHints ?? {};
            const oldVertices: VertexList =
                hints.oldVertices ?? new draw2d.util.ArrayList();
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

/**
 * Instancie un routeur algorithmique avec édition de sommets activée.
 * @param RouterClass - Classe draw2d de base (ex. `DirectRouter`).
 * @returns Instance de routeur étendu.
 */
export function createEditableRouter(RouterClass: Draw2dRouterClass): unknown {
    const Ctor = withVertexEditing(RouterClass);
    return new Ctor();
}
