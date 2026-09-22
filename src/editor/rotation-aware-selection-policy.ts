/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Feedback de sélection (fourmis bleues) compatible rotation pure.
 *
 * draw2d.Rectangle applique un scale à 90°/270° qui garde l’AABB largeur×hauteur.
 * Après rotation réelle du composant, ce cadre restait « à plat » à l’ancien emplacement.
 */
import draw2d from "draw2d";

type SelectionBox = {
    shape?: { transform: (ts: string) => void };
    getRotationAngle: () => number;
    applyTransformation: () => unknown;
    repaint?: () => void;
};

type SelectableFigure = {
    selectionHandles: {
        isEmpty: () => boolean;
        first: () => SelectionBox | null | undefined;
    };
};

/**
 * Remplace `applyTransformation` du cadre de sélection pour une rotation pure.
 * @param box - Rectangle de feedback draw2d.
 */
function makeRotationAware(box: SelectionBox): void {
    box.applyTransformation = function applyTransformation(this: SelectionBox) {
        if (!this.shape) return this;
        const angle = Number(this.getRotationAngle()) || 0;
        this.shape.transform(angle ? `R${angle}` : "");
        return this;
    };
}

/**
 * AntSelectionFeedbackPolicy dont le cadre suit la rotation visuelle du composant.
 */
export const rotationAwareAntSelectionPolicy =
    draw2d.policy.figure.AntSelectionFeedbackPolicy.extend({
        NAME: "HackCableAntSelectionFeedbackPolicy",

        onSelect(canvas: unknown, figure: SelectableFigure, isPrimarySelection: boolean) {
            const wasEmpty = figure.selectionHandles.isEmpty();
            draw2d.policy.figure.AntSelectionFeedbackPolicy.prototype.onSelect.call(
                this,
                canvas,
                figure,
                isPrimarySelection,
            );
            if (!wasEmpty) return;
            const box = figure.selectionHandles.first();
            if (!box) return;
            makeRotationAware(box);
            box.repaint?.();
        },
    });
