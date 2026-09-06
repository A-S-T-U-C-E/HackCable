/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Géométrie de projection monde ↔ minicarte.
 *
 * Responsabilités :
 * - Calculer matrices / rectangles de projection
 * - Hit-test du rectangle de viewport sur la minicarte
 */
import type { ContentBounds } from "./canvas-zoom";

/** Largeur fixe de la surface minicarte (px). */
export const MINIMAP_WIDTH = 168;
/** Hauteur fixe de la surface minicarte (px). */
export const MINIMAP_HEIGHT = 126;
/** Marge intérieure autour du monde projeté (px). */
export const MINIMAP_PADDING = 6;

export interface MinimapTransform {
    scale: number;
    offsetX: number;
    offsetY: number;
    world: ContentBounds;
}

export interface Point2D {
    x: number;
    y: number;
}

export interface Rect2D {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Calcule l'échelle et le décalage pour afficher les bornes monde dans la minicarte.
 * @param world - Rectangle monde en coordonnées logiques.
 * @returns Transformation de projection monde → minicarte.
 */
export function computeMinimapTransform(world: ContentBounds): MinimapTransform {
    const innerW = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
    const innerH = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;
    const scale = Math.min(innerW / world.width, innerH / world.height);
    const drawnW = world.width * scale;
    const drawnH = world.height * scale;

    return {
        scale,
        offsetX: MINIMAP_PADDING + (innerW - drawnW) / 2,
        offsetY: MINIMAP_PADDING + (innerH - drawnH) / 2,
        world,
    };
}

/**
 * Projette un point monde en coordonnées minicarte.
 * @param transform - Transformation de projection.
 * @param x - Abscisse logique monde.
 * @param y - Ordonnée logique monde.
 * @returns Point en pixels minicarte.
 */
export function worldToMinimap(transform: MinimapTransform, x: number, y: number): Point2D {
    return {
        x: transform.offsetX + (x - transform.world.x) * transform.scale,
        y: transform.offsetY + (y - transform.world.y) * transform.scale,
    };
}

/**
 * Convertit un point minicarte en coordonnées logiques monde.
 * @param transform - Transformation de projection.
 * @param x - Abscisse en pixels minicarte.
 * @param y - Ordonnée en pixels minicarte.
 * @returns Point en coordonnées logiques monde.
 */
export function minimapToWorld(transform: MinimapTransform, x: number, y: number): Point2D {
    return {
        x: transform.world.x + (x - transform.offsetX) / transform.scale,
        y: transform.world.y + (y - transform.offsetY) / transform.scale,
    };
}

/**
 * Projette le rectangle de viewport visible en coordonnées minicarte.
 * @param transform - Transformation de projection.
 * @param viewX - Origine X logique du viewport.
 * @param viewY - Origine Y logique du viewport.
 * @param viewWidth - Largeur logique visible.
 * @param viewHeight - Hauteur logique visible.
 * @returns Rectangle en pixels minicarte.
 */
export function viewportToMinimapRect(
    transform: MinimapTransform,
    viewX: number,
    viewY: number,
    viewWidth: number,
    viewHeight: number,
): Rect2D {
    const topLeft = worldToMinimap(transform, viewX, viewY);
    return {
        x: topLeft.x,
        y: topLeft.y,
        width: viewWidth * transform.scale,
        height: viewHeight * transform.scale,
    };
}

/**
 * Contraint un rectangle à rester dans des bornes données.
 * @param rect - Rectangle à contraindre.
 * @param bounds - Rectangle limites.
 * @returns Rectangle clampé.
 */
export function clampRectToBounds(rect: Rect2D, bounds: Rect2D): Rect2D {
    const x = Math.max(bounds.x, Math.min(rect.x, bounds.x + bounds.width - rect.width));
    const y = Math.max(bounds.y, Math.min(rect.y, bounds.y + bounds.height - rect.height));
    return {
        x,
        y,
        width: Math.min(rect.width, bounds.width),
        height: Math.min(rect.height, bounds.height),
    };
}

/**
 * Teste si un point touche un rectangle.
 * @param rect - Rectangle cible.
 * @param mx - Abscisse du point.
 * @param my - Ordonnée du point.
 * @returns `true` si le point est à l'intérieur.
 */
export function hitTestRect(rect: Rect2D, mx: number, my: number): boolean {
    return mx >= rect.x && mx <= rect.x + rect.width && my >= rect.y && my <= rect.y + rect.height;
}
