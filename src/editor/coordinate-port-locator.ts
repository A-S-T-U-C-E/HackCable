/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Locateurs de ports draw2d et échelle d’affichage des composants Fritzing.
 *
 * Responsabilités :
 * - `CoordinatePortLocator` (Wokwi, px absolus)
 * - `PercentPortLocator` (Fritzing, % largeur/hauteur)
 * - Conversion pouces physiques → pixels canvas
 */
import draw2d from "draw2d";
import { FRITZING_SVG_DPI } from "../panels/fritzing-svg";
import { canvasSizeFromInches } from "./canvas-scale";

/**
 * Convertit des dimensions physiques (pouces) en pixels d'affichage canvas.
 * @param widthInches - Largeur physique en pouces.
 * @param heightInches - Hauteur physique en pouces.
 * @returns Dimensions en pixels canvas.
 */
export function fritzingDisplaySizeFromInches(
    widthInches: number,
    heightInches: number,
): { width: number; height: number } {
    return canvasSizeFromInches(widthInches, heightInches);
}

/**
 * Convertit un viewBox Fritzing (sans width/height explicites) en pixels canvas.
 * @param viewBoxWidth - Largeur du viewBox en unités SVG.
 * @param viewBoxHeight - Hauteur du viewBox en unités SVG.
 * @returns Dimensions d'affichage en pixels canvas.
 */
export function fritzingDisplaySize(viewBoxWidth: number, viewBoxHeight: number): { width: number; height: number } {
    return fritzingDisplaySizeFromInches(
        viewBoxWidth / FRITZING_SVG_DPI,
        viewBoxHeight / FRITZING_SVG_DPI,
    );
}

type SizedParent = {
    getWidth: () => number;
    getHeight: () => number;
};

/**
 * Place un port en coordonnées parent en appliquant uniquement la rotation
 * (sans le scale draw2d à 90°/270° qui déforme les composants allongés).
 * @param port - Port draw2d (ou figure avec `getParent` / `setPosition`).
 * @param x - X locale avant rotation.
 * @param y - Y locale avant rotation.
 */
export function applyPortRotationOnly(
    port: { getParent: () => SizedParent & { getRotationAngle?: () => number }; setPosition: (x: number, y: number) => void },
    x: number,
    y: number,
): void {
    const parent = port.getParent();
    const halfW = parent.getWidth() / 2;
    const halfH = parent.getHeight() / 2;
    const rotAngle = ((Number(parent.getRotationAngle?.() ?? 0) || 0) % 360 + 360) % 360;
    if (rotAngle === 0) {
        port.setPosition(x, y);
        return;
    }
    const rad = (rotAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const lx = x - halfW;
    const ly = y - halfH;
    port.setPosition(lx * cos - ly * sin + halfW, lx * sin + ly * cos + halfH);
}

/** Port positionné en coordonnées absolues (composants Wokwi). */
export class CoordinatePortLocator extends draw2d.layout.locator.PortLocator {
    public readonly portId: string;
    /** Coordonnées locales (avant rotation) pour la direction de sortie des fils. */
    public readonly x: number;
    public readonly y: number;

    /**
     * Crée un locateur de port en coordonnées absolues.
     * @param portId - Identifiant draw2d du port.
     * @param x - Position X locale en pixels.
     * @param y - Position Y locale en pixels.
     */
    constructor(portId: string, x: number, y: number) {
        super();
        this.portId = portId;
        this.x = x;
        this.y = y;
    }

    /**
     * Repositionne le port en tenant compte de la rotation du composant parent.
     * @param index - Index draw2d (non utilisé).
     * @param figure - Figure port ou parent draw2d.
     */
    public relocate(index: unknown, figure: unknown): void {
        super.relocate(index, figure);
        applyPortRotationOnly(figure as Parameters<typeof applyPortRotationOnly>[0], this.x, this.y);
    }
}

/** Port positionné en % de la largeur/hauteur du composant (composants Fritzing). */
export class PercentPortLocator extends draw2d.layout.locator.PortLocator {
    public readonly portId: string;
    /** Position relative (%) pour la direction de sortie des fils. */
    public readonly xPercent: number;
    public readonly yPercent: number;

    /**
     * Crée un locateur de port en pourcentage de la taille parent.
     * @param portId - Identifiant draw2d du port.
     * @param xPercent - Position X en % de la largeur.
     * @param yPercent - Position Y en % de la hauteur.
     */
    constructor(portId: string, xPercent: number, yPercent: number) {
        super();
        this.portId = portId;
        this.xPercent = xPercent;
        this.yPercent = yPercent;
    }

    /**
     * Repositionne le port selon les pourcentages et la rotation du parent.
     * @param _index - Index draw2d (non utilisé).
     * @param figure - Port draw2d avec accès au parent.
     */
    public relocate(
        _index: unknown,
        figure: {
            getParent: () => { getWidth: () => number; getHeight: () => number; getRotationAngle?: () => number };
            setPosition: (x: number, y: number) => void;
        },
    ): void {
        const parent = figure.getParent();
        applyPortRotationOnly(
            figure,
            (parent.getWidth() / 100) * this.xPercent,
            (parent.getHeight() / 100) * this.yPercent,
        );
    }
}

/**
 * Calcule le diamètre des pastilles de connexion pour un composant.
 * @param width - Largeur logique du composant.
 * @param height - Hauteur logique du composant.
 * @returns Diamètre en pixels logiques (borné entre 4 et 7).
 */
export function fritzingPortDiameter(width: number, height: number): number {
    const side = Math.min(width, height);
    // ~6 % du côté, entre 4 et 7 px logiques — assez pour viser, sans masquer le corps.
    return Math.max(4, Math.min(7, Math.round(side * 0.06)));
}
