/**
 * @file Locateurs de ports draw2d et échelle d'affichage des composants Fritzing.
 */
import draw2d from "draw2d";
import { FRITZING_SVG_DPI } from "../panels/fritzing-svg";
import { canvasSizeFromInches } from "./canvas-scale";

/** Convertit des dimensions physiques (pouces) en pixels d'affichage canvas (échelle Wokwi/Blockly). */
export function fritzingDisplaySizeFromInches(
    widthInches: number,
    heightInches: number,
): { width: number; height: number } {
    return canvasSizeFromInches(widthInches, heightInches);
}

/** Rétrocompatibilité : viewBox sans attributs width/height explicites (90 unités/pouce Fritzing). */
export function fritzingDisplaySize(viewBoxWidth: number, viewBoxHeight: number): { width: number; height: number } {
    return fritzingDisplaySizeFromInches(
        viewBoxWidth / FRITZING_SVG_DPI,
        viewBoxHeight / FRITZING_SVG_DPI,
    );
}

/** Port positionné en coordonnées absolues (composants Wokwi). */
export class CoordinatePortLocator extends draw2d.layout.locator.PortLocator {
    public readonly portId: string;
    /** Coordonnées locales (avant rotation) pour la direction de sortie des fils. */
    public readonly x: number;
    public readonly y: number;

    constructor(portId: string, x: number, y: number) {
        super();
        this.portId = portId;
        this.x = x;
        this.y = y;
    }

    public relocate(index: unknown, figure: unknown): void {
        super.relocate(index, figure);
        this.applyConsiderRotation(figure, this.x, this.y);
    }
}

/** Port positionné en % de la largeur/hauteur du composant (composants Fritzing). */
export class PercentPortLocator extends draw2d.layout.locator.PortLocator {
    public readonly portId: string;
    /** Position relative (%) pour la direction de sortie des fils. */
    public readonly xPercent: number;
    public readonly yPercent: number;

    constructor(portId: string, xPercent: number, yPercent: number) {
        super();
        this.portId = portId;
        this.xPercent = xPercent;
        this.yPercent = yPercent;
    }

    public relocate(_index: unknown, figure: { getParent: () => { getWidth: () => number; getHeight: () => number } }): void {
        const parent = figure.getParent();
        this.applyConsiderRotation(
            figure,
            (parent.getWidth() / 100) * this.xPercent,
            (parent.getHeight() / 100) * this.yPercent,
        );
    }
}

/** Diamètre des pastilles de connexion, proportionnel et borné pour les petits composants. */
export function fritzingPortDiameter(width: number, height: number): number {
    const side = Math.min(width, height);
    // ~6 % du côté, entre 4 et 7 px logiques — assez pour viser, sans masquer le corps.
    return Math.max(4, Math.min(7, Math.round(side * 0.06)));
}
