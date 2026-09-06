/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Utilitaires viewport : scroll, zoom et bornes monde du canvas.
 *
 * Responsabilités :
 * - Conversions document ↔ canvas
 * - Scroll horizontal Alt+molette
 * - Helpers de centrage / bornes visibles
 */
import type { Canvas } from "./canvas";
import type { ContentBounds } from "./canvas-zoom";
import { CANVAS_WORLD_HEIGHT, CANVAS_WORLD_WIDTH } from "./canvas-scale";

export { CANVAS_WORLD_HEIGHT, CANVAS_WORLD_WIDTH } from "./canvas-scale";

const VIEWPORT_SELECTOR = ".hackCable-editor-viewport";

/**
 * Retourne l'élément viewport scrollable de l'éditeur.
 * @returns Élément `.hackCable-editor-viewport` ou `null` s'il est absent.
 */
export function getEditorViewport(): HTMLElement | null {
    const viewport = document.querySelector(VIEWPORT_SELECTOR);
    return viewport instanceof HTMLElement ? viewport : null;
}

/**
 * Mesure la zone visible du viewport en pixels CSS.
 * @returns Largeur et hauteur client ; valeurs par défaut si le viewport est absent.
 */
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
 * Calcule l'état scroll/zoom et la zone logique draw2d visible dans le viewport.
 * @param canvas - Instance canvas draw2d.
 * @returns Scroll, zoom et rectangle de vue en coordonnées logiques.
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

/**
 * Retourne les bornes logiques du monde canvas (viewBox draw2d).
 * @param canvas - Instance canvas draw2d.
 * @returns Rectangle monde en coordonnées logiques.
 */
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

/**
 * Bornes monde utilisées pour la projection minicarte.
 * @param canvas - Instance canvas draw2d.
 * @returns Rectangle monde en coordonnées logiques.
 */
export function getMinimapWorldBounds(canvas: Canvas): ContentBounds {
    return getCanvasLogicalBounds(canvas);
}

/**
 * Positionne le scroll du viewport (avec clamp aux limites).
 * @param canvas - Instance canvas draw2d.
 * @param scrollLeft - Défilement horizontal en pixels CSS.
 * @param scrollTop - Défilement vertical en pixels CSS.
 */
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

/**
 * Centre le viewport sur un point logique du canvas.
 * @param canvas - Instance canvas draw2d.
 * @param centerX - Abscisse logique du centre cible.
 * @param centerY - Ordonnée logique du centre cible.
 */
export function scrollViewportToCanvasCenter(canvas: Canvas, centerX: number, centerY: number): void {
    const zoom = canvas.getZoom();
    const { width: viewW, height: viewH } = getViewportClientSize();
    setViewportScroll(
        canvas,
        centerX / zoom - viewW / 2,
        centerY / zoom - viewH / 2,
    );
}

/**
 * Active Alt+molette pour le défilement horizontal du viewport.
 * @returns Fonction de nettoyage retirant l'écouteur wheel.
 */
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
