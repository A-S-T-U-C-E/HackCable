/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Échelle et grille du workspace — µcBlockly (25 px) et Wokwi (3,8 px/mm).
 *
 * Responsabilités :
 * - Constantes grille / px-par-mm / taille monde
 * - Mise à l’échelle des vignettes catalogue
 * - Snap des points sur la grille
 */
/** Pas de grille BlocklyArduino / µcBlockly. */
export const CANVAS_GRID_SIZE = 25;

/** Pixels canvas par millimètre (convention Wokwi). */
export const CANVAS_PX_PER_MM = 3.8;

/** Pixels canvas par pouce physique pour l'affichage (3,8 px/mm × 25,4 mm/in). */
export const CANVAS_PX_PER_INCH = CANVAS_PX_PER_MM * 25.4;

/** Largeur logique par défaut du monde canvas (px). */
export const CANVAS_WORLD_WIDTH = 1500;
/** Hauteur logique par défaut du monde canvas (px). */
export const CANVAS_WORLD_HEIGHT = 1000;

/** Largeur max des vignettes catalogue (ratio conservé). */
export const CATALOG_PREVIEW_MAX_WIDTH = 130;

/** Hauteur max des vignettes catalogue (évite les pièces très hautes). */
export const CATALOG_PREVIEW_MAX_HEIGHT = 110;

/**
 * Convertit des dimensions physiques (pouces) en pixels d'affichage canvas.
 * @param widthInches - Largeur physique en pouces.
 * @param heightInches - Hauteur physique en pouces.
 * @returns Dimensions en pixels canvas.
 */
export function canvasSizeFromInches(
    widthInches: number,
    heightInches: number,
): { width: number; height: number } {
    return {
        width: widthInches * CANVAS_PX_PER_INCH,
        height: heightInches * CANVAS_PX_PER_INCH,
    };
}

/**
 * Applique le même facteur d'échelle que les vignettes catalogue.
 * @param width - Largeur source en pixels.
 * @param height - Hauteur source en pixels.
 * @param maxWidth - Largeur maximale autorisée.
 * @param maxHeight - Hauteur maximale autorisée.
 * @returns Dimensions redimensionnées et facteur d'échelle appliqué.
 */
export function scaleToCatalogPreview(
    width: number,
    height: number,
    maxWidth = CATALOG_PREVIEW_MAX_WIDTH,
    maxHeight = CATALOG_PREVIEW_MAX_HEIGHT,
): { width: number; height: number; scale: number } {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const scale = Math.min(1, maxWidth / safeW, maxHeight / safeH);
    return {
        width: Math.max(1, Math.round(safeW * scale)),
        height: Math.max(1, Math.round(safeH * scale)),
        scale,
    };
}

/**
 * Aligne une coordonnée sur la grille canvas.
 * @param value - Valeur à arrondir.
 * @param gridSize - Pas de grille en pixels.
 * @returns Coordonnée alignée sur la grille.
 */
export function snapToCanvasGrid(value: number, gridSize = CANVAS_GRID_SIZE): number {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * Aligne un point (x, y) sur la grille canvas.
 * @param x - Abscisse à arrondir.
 * @param y - Ordonnée à arrondir.
 * @param gridSize - Pas de grille en pixels.
 * @returns Point aligné sur la grille.
 */
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
