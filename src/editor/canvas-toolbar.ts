/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Barre d’outils de zoom flottante sur le canvas.
 *
 * Responsabilités :
 * - Boutons zoom + / − / 100 % / ajuster à la fenêtre
 * - Branchement i18n et accessibilité
 */
import i18next from "i18next";
import { tr } from "../ui/i18n/translate";
import type { Canvas } from "./canvas";
import {
    zoomInCanvas,
    zoomOutCanvas,
    zoomResetCanvas,
    zoomToFitCanvas,
} from "./canvas-zoom";

type ZoomAction = "in" | "out" | "reset" | "fit";

function createButton(action: ZoomAction, label: string, glyph: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hackCable-canvas-zoom-btn";
    button.dataset.zoomAction = action;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<span class="hackCable-canvas-zoom-glyph" aria-hidden="true">${glyph}</span>`;
    button.addEventListener("click", onClick);
    return button;
}

/**
 * Installe les boutons de zoom et retourne une fonction de nettoyage.
 * @param canvas - Instance canvas draw2d.
 * @returns Fonction de nettoyage retirant la barre d'outils.
 */
export function setupCanvasZoomToolbar(canvas: Canvas): () => void {
    const host = document.querySelector(".hackCable-editor");
    if (!(host instanceof HTMLElement)) {
        console.error("[HackCable] Unable to find element .hackCable-editor");
        return () => undefined;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "hackCable-canvas-zoom";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", tr("canvas.zoomToolbar"));

    const buttons = [
        createButton("in", tr("canvas.zoomIn"), "+", () => zoomOutCanvas(canvas)),
        createButton("out", tr("canvas.zoomOut"), "−", () => zoomInCanvas(canvas)),
        createButton("reset", tr("canvas.zoomReset"), "100%", () => zoomResetCanvas(canvas)),
        createButton("fit", tr("canvas.zoomToFit"), "⤢", () => zoomToFitCanvas(canvas)),
    ];

    for (const button of buttons) toolbar.appendChild(button);
    host.appendChild(toolbar);

    const rebuildLabels = () => {
        toolbar.setAttribute("aria-label", tr("canvas.zoomToolbar"));
        const labels: Record<ZoomAction, string> = {
            in: tr("canvas.zoomIn"),
            out: tr("canvas.zoomOut"),
            reset: tr("canvas.zoomReset"),
            fit: tr("canvas.zoomToFit"),
        };
        for (const button of buttons) {
            const action = button.dataset.zoomAction as ZoomAction;
            button.title = labels[action];
            button.setAttribute("aria-label", labels[action]);
        }
    };

    i18next.on("languageChanged", rebuildLabels);

    return () => {
        i18next.off("languageChanged", rebuildLabels);
        toolbar.remove();
    };
}
