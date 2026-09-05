/**
 * @file Géométrie de projection monde ↔ minicarte.
 */
import type { ContentBounds } from "./canvas-zoom";

export const MINIMAP_WIDTH = 168;
export const MINIMAP_HEIGHT = 126;
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

/** Calcule l'échelle et le décalage pour afficher les bornes monde dans la minicarte. */
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

export function worldToMinimap(transform: MinimapTransform, x: number, y: number): Point2D {
    return {
        x: transform.offsetX + (x - transform.world.x) * transform.scale,
        y: transform.offsetY + (y - transform.world.y) * transform.scale,
    };
}

export function minimapToWorld(transform: MinimapTransform, x: number, y: number): Point2D {
    return {
        x: transform.world.x + (x - transform.offsetX) / transform.scale,
        y: transform.world.y + (y - transform.offsetY) / transform.scale,
    };
}

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

export function hitTestRect(rect: Rect2D, mx: number, my: number): boolean {
    return mx >= rect.x && mx <= rect.x + rect.width && my >= rect.y && my <= rect.y + rect.height;
}
