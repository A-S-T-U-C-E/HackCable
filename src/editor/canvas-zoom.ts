/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Zoom du canvas (niveaux, fit-to-content, bornes des figures).
 *
 * Responsabilités :
 * - Niveaux de zoom discrets
 * - Fit-to-content et reset
 * - Calcul de l’emprise des figures
 */
import type { Canvas } from "./canvas";
import { ComponentFigure } from "./component-figure";
import {
    getViewportClientSize,
    scrollViewportToCanvasCenter,
} from "./canvas-viewport";
/** Zoom minimum autorisé. */
export const MIN_ZOOM = 0.1;
/** Zoom maximum autorisé. */
export const MAX_ZOOM = 5;
/** Niveau de zoom par défaut (100 %). */
export const DEFAULT_ZOOM = 1;
/** Facteur multiplicatif entre deux niveaux de zoom discrets. */
export const ZOOM_STEP = 1.2;
const FIT_PADDING = 48;

export interface ContentBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Borne une valeur de zoom entre les limites autorisées.
 * @param zoom - Facteur de zoom demandé.
 * @returns Zoom clampé entre `MIN_ZOOM` et `MAX_ZOOM`.
 */
export function clampZoom(zoom: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Calcule l'emprise englobante de toutes les figures composant.
 * @param canvas - Instance canvas draw2d.
 * @returns Rectangle contenu ou `null` s'il n'y a aucune figure.
 */
export function getFiguresContentBounds(canvas: Canvas): ContentBounds | null {
    const figures = canvas.getFigures().data.filter(
        (figure: unknown) => figure instanceof ComponentFigure,
    ) as ComponentFigure[];

    if (figures.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const figure of figures) {
        const x = figure.getX();
        const y = figure.getY();
        const w = figure.getWidth();
        const h = figure.getHeight();
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    }

    const width = maxX - minX;
    const height = maxY - minY;
    if (width <= 0 || height <= 0) return null;

    return { x: minX, y: minY, width, height };
}

/**
 * Augmente le zoom du canvas d'un pas discret.
 * @param canvas - Instance canvas draw2d.
 */
export function zoomInCanvas(canvas: Canvas): void {
    canvas.setZoom(clampZoom(canvas.getZoom() * ZOOM_STEP), false);
}

/**
 * Diminue le zoom du canvas d'un pas discret.
 * @param canvas - Instance canvas draw2d.
 */
export function zoomOutCanvas(canvas: Canvas): void {
    canvas.setZoom(clampZoom(canvas.getZoom() / ZOOM_STEP), false);
}

/**
 * Réinitialise le zoom à 100 %.
 * @param canvas - Instance canvas draw2d.
 */
export function zoomResetCanvas(canvas: Canvas): void {
    canvas.setZoom(DEFAULT_ZOOM, false);
}

/**
 * Ajuste le zoom et le scroll pour afficher toutes les figures.
 * @param canvas - Instance canvas draw2d.
 */
export function zoomToFitCanvas(canvas: Canvas): void {
    const bounds = getFiguresContentBounds(canvas);
    if (!bounds) {
        zoomResetCanvas(canvas);
        return;
    }

    const { width: viewW, height: viewH } = getViewportClientSize();
    const zoomX = (viewW - FIT_PADDING * 2) / bounds.width;
    const zoomY = (viewH - FIT_PADDING * 2) / bounds.height;
    const zoom = clampZoom(Math.min(zoomX, zoomY));

    canvas.setZoom(zoom, false);
    window.setTimeout(
        () => scrollViewportToCanvasCenter(canvas, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
        0,
    );
}
