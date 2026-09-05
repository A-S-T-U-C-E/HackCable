/**
 * @file Échelle et grille du workspace — alignés sur µcBlockly (grille 25 px) et Wokwi (3,8 px/mm).
 */

/** Pas de grille BlocklyArduino / µcBlockly. */
export const CANVAS_GRID_SIZE = 25;

/** Pixels canvas par millimètre (convention Wokwi). */
export const CANVAS_PX_PER_MM = 3.8;

/** Pixels canvas par pouce physique pour l'affichage (3,8 px/mm × 25,4 mm/in). */
export const CANVAS_PX_PER_INCH = CANVAS_PX_PER_MM * 25.4;

export const CANVAS_WORLD_WIDTH = 1500;
export const CANVAS_WORLD_HEIGHT = 1000;

/** Largeur max des vignettes catalogue (ratio conservé). */
export const CATALOG_PREVIEW_MAX_WIDTH = 130;

/** Convertit des dimensions physiques (pouces) en pixels d'affichage canvas. */
export function canvasSizeFromInches(
    widthInches: number,
    heightInches: number,
): { width: number; height: number } {
    return {
        width: widthInches * CANVAS_PX_PER_INCH,
        height: heightInches * CANVAS_PX_PER_INCH,
    };
}

/** Applique le même facteur d'échelle que les vignettes catalogue. */
export function scaleToCatalogPreview(
    width: number,
    height: number,
    maxWidth = CATALOG_PREVIEW_MAX_WIDTH,
): { width: number; height: number; scale: number } {
    const scale = width > maxWidth ? maxWidth / width : 1;
    return {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        scale,
    };
}

export function snapToCanvasGrid(value: number, gridSize = CANVAS_GRID_SIZE): number {
    return Math.round(value / gridSize) * gridSize;
}

export function snapPointToCanvasGrid(
    x: number,
    y: number,
    gridSize = CANVAS_GRID_SIZE,
): { x: number; y: number } {
    return {
        x: snapToCanvasGrid(x, gridSize),
        y: snapToCanvasGrid(y, gridSize),
    };
}
