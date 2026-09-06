/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Utilitaires DOM (styles inline, conversion d’unités SVG).
 *
 * Responsabilités :
 * - `css()` pour styles numériques en px
 * - `unitToPx` / `measureWokwiSvgSize` (mm Wokwi → px canvas)
 */
import { CANVAS_PX_PER_MM } from "../editor/canvas-scale";

/**
 * Applique des styles inline sur un élément (nombres convertis en px).
 * @param element - Élément cible.
 * @param style - Propriétés CSS à appliquer.
 */
export function css(element: HTMLElement, style: any) {

    Object.keys(style).forEach((key: any) => {
        if (key in element.style) {
            if (typeof style[key] == 'number')
                element.style[key] = style[key] + 'px';
            else element.style[key] = style[key];
        }
    });
}
/**
 * Convertit une longueur CSS (mm, px ou nombre) en pixels canvas.
 * @param value - Valeur avec unité ou nombre brut.
 * @param fallback - Valeur par défaut si la conversion échoue.
 * @returns Longueur en pixels.
 */
export function unitToPx(value: string | null | undefined, fallback = 100): number {
    if (!value) return fallback;
    const trimmed = value.trim();
    const mm = trimmed.match(/^([\d.]+)\s*mm$/i);
    if (mm) return parseFloat(mm[1]) * CANVAS_PX_PER_MM;
    const px = trimmed.match(/^([\d.]+)\s*px$/i);
    if (px) return parseFloat(px[1]);
    const num = parseFloat(trimmed);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Mesure la taille d’affichage canvas d’un SVG Wokwi (mm ou viewBox heuristique).
 * @param svg - Élément SVG Wokwi à mesurer.
 * @returns Largeur et hauteur en pixels canvas.
 */
export function measureWokwiSvgSize(svg: SVGElement): { width: number; height: number } {
    const fromAttrW = unitToPx(svg.getAttribute("width"), 0);
    const fromAttrH = unitToPx(svg.getAttribute("height"), 0);
    if (fromAttrW > 0 && fromAttrH > 0) {
        return { width: fromAttrW, height: fromAttrH };
    }

    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        const vbW = parts[2];
        const vbH = parts[3];
        // Heuristique : petits viewBox typiques Wokwi (mm) → convertir.
        if (Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 0 && vbH > 0) {
            if (vbW < 200 && vbH < 200) {
                return { width: vbW * CANVAS_PX_PER_MM, height: vbH * CANVAS_PX_PER_MM };
            }
            return { width: vbW, height: vbH };
        }
    }

    return { width: 100, height: 100 };
}
