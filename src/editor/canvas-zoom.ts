/**
 * @file Zoom du canvas (niveaux, fit-to-content, bornes des figures).
 */
import type { Canvas } from "./canvas";
import { ComponentFigure } from "./component-figure";
import {
    getViewportClientSize,
    scrollViewportToCanvasCenter,
} from "./canvas-viewport";
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const DEFAULT_ZOOM = 1;
export const ZOOM_STEP = 1.2;
const FIT_PADDING = 48;

export interface ContentBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function clampZoom(zoom: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

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

export function zoomInCanvas(canvas: Canvas): void {
    canvas.setZoom(clampZoom(canvas.getZoom() * ZOOM_STEP), false);
}

export function zoomOutCanvas(canvas: Canvas): void {
    canvas.setZoom(clampZoom(canvas.getZoom() / ZOOM_STEP), false);
}

export function zoomResetCanvas(canvas: Canvas): void {
    canvas.setZoom(DEFAULT_ZOOM, false);
}

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
