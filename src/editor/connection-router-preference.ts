/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Factory des routeurs de fils + application sur le canvas.
 *
 * Responsabilités :
 * - Instancier le routeur selon la préférence courante
 * - Réappliquer le routeur à toutes les connexions existantes
 *
 * @see docs/wire-routers.md
 */
import draw2d from "draw2d";
import { createEditableRouter } from "./connection-router-editable";
import {
    getPreferredWireRouterId,
    normalizeWireRouterId,
    type WireRouterId,
} from "./connection-router-ids";

export {
    DEFAULT_WIRE_ROUTER,
    WIRE_ROUTER_OPTIONS,
    getPreferredWireRouterId,
    isWireRouterId,
    normalizeWireRouterId,
    setPreferredWireRouterId,
    type WireRouterId,
    type WireRouterOption,
} from "./connection-router-ids";

/** Factory pour le routeur HackCable (ponts) — enregistrée depuis connection-router.ts. */
let bridgedInteractiveFactory: (() => unknown) | null = null;

/**
 * Enregistre la factory du routeur par défaut (évite un import circulaire).
 * @param factory - Doit retourner une instance de `BridgedInteractiveManhattanRouter`.
 */
export function registerBridgedInteractiveRouterFactory(factory: () => unknown): void {
    bridgedInteractiveFactory = factory;
}

function createBridgedInteractive(): unknown {
    if (bridgedInteractiveFactory) return bridgedInteractiveFactory();
    return new draw2d.layout.connection.InteractiveManhattanConnectionRouter();
}

/**
 * Instancie le routeur draw2d correspondant à l'id.
 * @param id - Identifiant UI / URL (défaut = préférence courante).
 * @returns Instance de routeur draw2d (éventuellement wrappée pour l'édition).
 */
export function createWireRouterInstance(
    id: WireRouterId = getPreferredWireRouterId(),
): unknown {
    switch (normalizeWireRouterId(id)) {
        case "manhattan":
            return createEditableRouter(draw2d.layout.connection.ManhattanConnectionRouter);
        case "manhattanBridged":
            return createEditableRouter(draw2d.layout.connection.ManhattanBridgedConnectionRouter);
        case "interactiveManhattan":
            return new draw2d.layout.connection.InteractiveManhattanConnectionRouter();
        case "interactiveManhattanBridged":
            return createBridgedInteractive();
        case "circuit":
            return createEditableRouter(draw2d.layout.connection.CircuitConnectionRouter);
        case "direct":
            return createEditableRouter(draw2d.layout.connection.DirectRouter);
        case "spline":
            return createEditableRouter(draw2d.layout.connection.SplineConnectionRouter);
        case "maze":
            return createEditableRouter(draw2d.layout.connection.MazeConnectionRouter);
        case "sketch":
            return createEditableRouter(draw2d.layout.connection.SketchConnectionRouter);
        case "fan":
            return createEditableRouter(draw2d.layout.connection.FanConnectionRouter);
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
 * Applique un routeur à toutes les connexions du canvas.
 * @param canvas - Canvas draw2d / HackCable.
 * @param routerId - Algorithme de routage choisi.
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

    forEachLine(lines, applyOne);
    view.calculateConnectionIntersection?.();
    forEachLine(lines, (line) => {
        line.svgPathString = null;
        line.repaint?.();
    });
}

/** Parcourt `getLines()` qu’il s’agisse d’une ArrayList draw2d ou d’un tableau. */
function forEachLine(
    lines:
        | {
              data?: LineLike[];
              each?: (fn: (i: number, line: LineLike) => void) => void;
          }
        | undefined,
    fn: (line: LineLike) => void,
): void {
    if (!lines) return;
    if (typeof lines.each === "function") {
        lines.each((_i, line) => fn(line));
        return;
    }
    if (Array.isArray(lines.data)) {
        for (const line of lines.data) fn(line);
    }
}
