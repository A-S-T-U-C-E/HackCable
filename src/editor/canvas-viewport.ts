/**
 * @file Utilitaires viewport : scroll, zoom et bornes monde du canvas.
 */
import type { Canvas } from "./canvas";
import type { ContentBounds } from "./canvas-zoom";
import { CANVAS_WORLD_HEIGHT, CANVAS_WORLD_WIDTH } from "./canvas-scale";

export { CANVAS_WORLD_HEIGHT, CANVAS_WORLD_WIDTH } from "./canvas-scale";

const VIEWPORT_SELECTOR = ".hackCable-editor-viewport";

export function getEditorViewport(): HTMLElement | null {
    const viewport = document.querySelector(VIEWPORT_SELECTOR);
    return viewport instanceof HTMLElement ? viewport : null;
}

export function getViewportClientSize(): { width: number; height: number } {
    const viewport = getEditorViewport();
    if (viewport) {
        return { width: viewport.clientWidth, height: viewport.clientHeight };
    }
    return { width: 800, height: 600 };
}

export interface ViewportState {
    scrollLeft: number;
    scrollTop: number;
    zoom: number;
    clientWidth: number;
    clientHeight: number;
    viewX: number;
    viewY: number;
    viewWidth: number;
    viewHeight: number;
}

/**
 * Coordonnées logiques draw2d visibles dans le viewport.
 * draw2d zoome via Raphael setViewBox : 1 px scroll ≈ zoom unités logiques.
 */
export function getViewportState(canvas: Canvas): ViewportState {
    const viewport = getEditorViewport();
    const zoom = canvas.getZoom();
    const scrollLeft = viewport?.scrollLeft ?? canvas.getScrollLeft();
    const scrollTop = viewport?.scrollTop ?? canvas.getScrollTop();
    const { width: clientWidth, height: clientHeight } = getViewportClientSize();

    return {
        scrollLeft,
        scrollTop,
        zoom,
        clientWidth,
        clientHeight,
        viewX: scrollLeft * zoom,
        viewY: scrollTop * zoom,
        viewWidth: clientWidth * zoom,
        viewHeight: clientHeight * zoom,
    };
}

export function getCanvasLogicalBounds(canvas: Canvas): ContentBounds {
    const dim = canvas.getDimension();
    const width = typeof dim?.getWidth === "function" ? dim.getWidth() : Number(dim?.w ?? dim?.width ?? CANVAS_WORLD_WIDTH);
    const height = typeof dim?.getHeight === "function" ? dim.getHeight() : Number(dim?.h ?? dim?.height ?? CANVAS_WORLD_HEIGHT);
    // WheelZoomPolicy : monde logique = taille initiale (viewBox fixe), pas × zoom.
    return {
        x: 0,
        y: 0,
        width: Math.max(1, width),
        height: Math.max(1, height),
    };
}

export function getMinimapWorldBounds(canvas: Canvas): ContentBounds {
    return getCanvasLogicalBounds(canvas);
}

export function setViewportScroll(canvas: Canvas, scrollLeft: number, scrollTop: number): void {
    const viewport = getEditorViewport();
    if (!viewport) {
        canvas.setScrollLeft(Math.max(0, scrollLeft));
        canvas.setScrollTop(Math.max(0, scrollTop));
        return;
    }

    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    canvas.setScrollLeft(Math.min(maxLeft, Math.max(0, scrollLeft)));
    canvas.setScrollTop(Math.min(maxTop, Math.max(0, scrollTop)));
}

export function scrollViewportToCanvasCenter(canvas: Canvas, centerX: number, centerY: number): void {
    const zoom = canvas.getZoom();
    const { width: viewW, height: viewH } = getViewportClientSize();
    setViewportScroll(
        canvas,
        centerX / zoom - viewW / 2,
        centerY / zoom - viewH / 2,
    );
}

/** Alt + molette : défilement horizontal ; molette seule : vertical (natif). */
export function setupViewportAltHorizontalScroll(): () => void {
    const viewport = getEditorViewport();
    if (!viewport) return () => undefined;

    const onWheel = (event: WheelEvent) => {
        if (!event.altKey) return;
        event.preventDefault();
        viewport.scrollLeft += event.deltaY;
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
}
