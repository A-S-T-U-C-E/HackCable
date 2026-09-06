/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Panning du viewport sans interférer avec le tirage de fil depuis un port.
 *
 * Responsabilités :
 * - Étendre `PanningSelectionPolicy` draw2d
 * - Ignorer le pan pendant un drag de port / connexion
 */
import draw2d from "draw2d";
import type { Canvas } from "./canvas";
import { connectionsPolicy } from "./connections-policies";

function hasActivePortDrag(policy: unknown): boolean {
    if (!policy || typeof policy !== "object") return false;

    const candidate = policy as {
        mouseDraggingElement?: unknown;
        policies?: unknown[];
    };

    if (Array.isArray(candidate.policies)) {
        return candidate.policies.some((sub) => hasActivePortDrag(sub));
    }

    return candidate.mouseDraggingElement instanceof draw2d.Port;
}

function isWireDragInProgress(): boolean {
    return hasActivePortDrag(connectionsPolicy);
}

type PanningCanvas = Canvas & { mouseDownX: number; mouseDownY: number; zoomFactor: number };

/**
 * PanningSelectionPolicy personnalisée : le pan natif draw2d entre en conflit
 * avec le tirage de fil dès que getBestFigure renvoie null pendant un drag.
 */
export const hackCablePanningPolicy = draw2d.policy.canvas.PanningSelectionPolicy.extend({
    NAME: "HackCablePanningSelectionPolicy",

    onMouseDrag(
        canvas: Canvas,
        dx: number,
        dy: number,
        dx2: number,
        dy2: number,
        shiftKey: boolean,
        ctrlKey: boolean,
    ) {
        draw2d.policy.canvas.SingleSelectionPolicy.prototype.onMouseDrag.call(
            this,
            canvas,
            dx,
            dy,
            dx2,
            dy2,
            shiftKey,
            ctrlKey,
        );

        if (isWireDragInProgress()) {
            return;
        }

        const self = this as {
            mouseDraggingElement: unknown;
            mouseDownElement: unknown;
        };

        if (self.mouseDraggingElement === null && self.mouseDownElement === null) {
            const canvasAny = canvas as PanningCanvas;
            const point = canvas.fromDocumentToCanvasCoordinate(
                canvasAny.mouseDownX + dx / canvasAny.zoomFactor,
                canvasAny.mouseDownY + dy / canvasAny.zoomFactor,
            );
            const figure = canvas.getBestFigure(point.x, point.y);
            if (figure === null) {
                const area = canvas.getScrollArea();
                area.scrollTop(area.scrollTop() - dy2);
                area.scrollLeft(area.scrollLeft() - dx2);
            }
        }
    },
});
