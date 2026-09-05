/**
 * @file Utilitaires DOM (styles inline, conversion d'unités SVG).
 */
import { CANVAS_PX_PER_MM } from "../editor/canvas-scale";

export function css(element: HTMLElement, style: any) {

    Object.keys(style).forEach((key: any) => {
        if (key in element.style) {
            if (typeof style[key] == 'number')
                element.style[key] = style[key] + 'px';
            else element.style[key] = style[key];
        }
    });
}
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