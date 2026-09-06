/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Géométrie SVG Fritzing : viewBox, dimensions physiques et extraction des broches.
 *
 * Responsabilités :
 * - Convertir unités SVG → pouces (logique fritzing-app)
 * - Positions de broches en % pour `PercentPortLocator`
 */
import type { FritzingPin } from "./fritzing-types";

export interface SvgViewBox {
    minX: number;
    minY: number;
    width: number;
    height: number;
}

export interface FritzingConnectorRef {
    id: string;
    name: string;
    svgId: string;
}

function parseLength(value: string | null | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** Équivalent de `GraphicsUtils::SVGDPI` dans fritzing-app (affichage breadboard). */
export const FRITZING_SVG_DPI = 90;

/** DPI Illustrator pour les SVG exportés en px (fritzing-app `IllustratorDPI`). */
export const ILLUSTRATOR_SVG_DPI = 72;

/** @deprecated Utiliser {@link FRITZING_SVG_DPI} ou {@link ILLUSTRATOR_SVG_DPI}. */
export const FRITZING_VIEWBOX_DPI = ILLUSTRATOR_SVG_DPI;

function chopTrailingNonDigits(value: string): string {
    let s = value;
    while (s.length > 0) {
        const ch = s[s.length - 1];
        if (ch >= "0" && ch <= "9" || ch === ".") return s;
        s = s.slice(0, -1);
    }
    return s;
}

/**
 * Détecte un export Adobe Illustrator dans le texte SVG.
 * @param svgText - Contenu SVG brut.
 * @returns `true` si le SVG provient d’Illustrator.
 */
export function isIllustratorSvg(svgText: string): boolean {
    return /Adobe Illustrator/i.test(svgText);
}

/**
 * Convertit une longueur SVG en pouces (logique fritzing-app `TextUtils::convertToInches`).
 * @param raw - Valeur avec unité (mm, px, in, etc.).
 * @param isIllustrator - Utilise le DPI Illustrator si le SVG en est l’origine.
 * @returns Longueur en pouces, ou `null` si invalide.
 */
export function fritzingConvertToInches(raw: string, isIllustrator: boolean): number | null {
    let text = raw.trim();
    if (!text) return null;

    let divisor = 1;
    let chop = 2;
    const lower = text.toLowerCase();

    if (lower.endsWith("cm")) {
        divisor = 2.54;
    } else if (lower.endsWith("mm")) {
        divisor = 25.4;
    } else if (lower.endsWith("in")) {
        divisor = 1;
    } else if (lower.endsWith("px")) {
        divisor = isIllustrator ? ILLUSTRATOR_SVG_DPI : FRITZING_SVG_DPI;
    } else if (lower.endsWith("mil")) {
        divisor = 1000;
        chop = 3;
    } else if (lower.endsWith("pt")) {
        divisor = ILLUSTRATOR_SVG_DPI;
    } else if (lower.endsWith("pc")) {
        divisor = 6;
    } else {
        text = chopTrailingNonDigits(text);
        divisor = FRITZING_SVG_DPI;
        chop = 0;
    }

    if (chop > 0) text = text.slice(0, -chop);
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value / divisor;
}

function fallbackInchesFromViewBox(viewBoxAxis: number, isIllustrator: boolean): number {
    const dpi = isIllustrator ? ILLUSTRATOR_SVG_DPI : FRITZING_SVG_DPI;
    return viewBoxAxis / dpi;
}

/**
 * Convertit une longueur SVG en pouces avec repli sur le viewBox.
 * @param raw - Valeur avec unité, ou `null`/`undefined`.
 * @param viewBoxAxis - Dimension du viewBox pour le repli.
 * @param isIllustrator - Utilise le DPI Illustrator si applicable.
 * @returns Longueur en pouces.
 * @deprecated Préférer {@link fritzingConvertToInches}.
 */
export function parseSvgLengthInches(
    raw: string | null | undefined,
    viewBoxAxis: number,
    isIllustrator = false,
): number {
    if (!raw) return fallbackInchesFromViewBox(viewBoxAxis, isIllustrator);
    return fritzingConvertToInches(raw, isIllustrator)
        ?? fallbackInchesFromViewBox(viewBoxAxis, isIllustrator);
}

/**
 * Résout les dimensions physiques breadboard d’un SVG Fritzing.
 * @param svgText - Contenu SVG brut.
 * @returns Largeur/hauteur en pouces et viewBox parsé.
 */
export function resolveSvgPhysicalInches(svgText: string): {
    widthInches: number;
    heightInches: number;
    viewBox: SvgViewBox;
} {
    const isIllustrator = isIllustratorSvg(svgText);
    const viewBox = parseSvgViewBox(svgText);
    const open = svgText.match(/<svg[^>]*>/)?.[0] ?? "";
    const widthRaw = open.match(/\bwidth="([^"]+)"/)?.[1];
    const heightRaw = open.match(/\bheight="([^"]+)"/)?.[1];

    return {
        widthInches: parseSvgLengthInches(widthRaw, viewBox.width, isIllustrator),
        heightInches: parseSvgLengthInches(heightRaw, viewBox.height, isIllustrator),
        viewBox,
    };
}

/**
 * Parse le viewBox (ou width/height) d’un SVG Fritzing.
 * @param svgText - Contenu SVG brut.
 * @returns ViewBox normalisé avec dimensions positives.
 */
export function parseSvgViewBox(svgText: string): SvgViewBox {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
        const [minX, minY, width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
        if ([minX, minY, width, height].every(Number.isFinite) && width > 0 && height > 0) {
            return { minX, minY, width, height };
        }
    }

    const width = parseLength(svg.getAttribute("width"), 100);
    const height = parseLength(svg.getAttribute("height"), 100);
    return { minX: 0, minY: 0, width: Math.max(width, 1), height: Math.max(height, 1) };
}

function getPathCenter(d: string): { x: number; y: number } | null {
    const move = d.match(/m\s*([-\d.e]+)[,\s]+([-\d.e]+)/i);
    if (!move) return null;

    const x = Number.parseFloat(move[1]);
    const y = Number.parseFloat(move[2]);
    const h = d.match(/\bh\s*([-\d.e]+)/i);
    const v = d.match(/\bv\s*([-\d.e]+)/i);
    const width = h ? Number.parseFloat(h[1]) : 0;
    const height = v ? Number.parseFloat(v[2] ?? v[1]) : 0;

    if (![x, y].every(Number.isFinite)) return null;
    return { x: x + width / 2, y: y + height / 2 };
}

function findGraphicsChild(element: Element): SVGGraphicsElement | null {
    if (element instanceof SVGGraphicsElement && element.tagName.toLowerCase() !== "g") {
        return element;
    }
    const child = element.querySelector("circle, rect, path, ellipse, line, polygon, polyline");
    return child instanceof SVGGraphicsElement ? child : null;
}

/**
 * Localise l’élément graphique d’un connecteur par son `svgId`.
 * @param doc - Document ou nœud SVG parent.
 * @param svgId - Identifiant du connecteur dans le SVG.
 * @returns Élément graphique trouvé, ou `null`.
 */
export function findConnectorElement(doc: ParentNode, svgId: string): SVGGraphicsElement | null {
    const escaped = svgId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const candidates = [
        doc.querySelector(`[id="${escaped}"]`),
        doc.querySelector(`[id="${svgId}"]`),
    ].filter(Boolean) as Element[];

    for (const candidate of candidates) {
        const graphics = findGraphicsChild(candidate);
        if (graphics) return graphics;
    }
    return null;
}

function getElementCenterInViewBox(
    element: SVGGraphicsElement,
    svg: SVGSVGElement,
    viewBox: SvgViewBox,
): { x: number; y: number } | null {
    try {
        const elRect = element.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        if (svgRect.width <= 0 || svgRect.height <= 0) return null;

        const cx = elRect.left + elRect.width / 2 - svgRect.left;
        const cy = elRect.top + elRect.height / 2 - svgRect.top;

        return {
            x: viewBox.minX + (cx / svgRect.width) * viewBox.width,
            y: viewBox.minY + (cy / svgRect.height) * viewBox.height,
        };
    } catch {
        return null;
    }
}

function getElementCenterFromAttributes(element: Element): { x: number; y: number } | null {
    const tag = element.tagName.toLowerCase();

    if (tag === "circle") {
        return {
            x: parseLength(element.getAttribute("cx"), 0),
            y: parseLength(element.getAttribute("cy"), 0),
        };
    }

    if (tag === "rect") {
        const x = parseLength(element.getAttribute("x"), 0);
        const y = parseLength(element.getAttribute("y"), 0);
        const width = parseLength(element.getAttribute("width"), 0);
        const height = parseLength(element.getAttribute("height"), 0);
        return { x: x + width / 2, y: y + height / 2 };
    }

    if (tag === "line") {
        const x1 = parseLength(element.getAttribute("x1"), 0);
        const y1 = parseLength(element.getAttribute("y1"), 0);
        const x2 = parseLength(element.getAttribute("x2"), 0);
        const y2 = parseLength(element.getAttribute("y2"), 0);
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    }

    if (tag === "ellipse") {
        return {
            x: parseLength(element.getAttribute("cx"), 0),
            y: parseLength(element.getAttribute("cy"), 0),
        };
    }

    if (tag === "path") {
        const d = element.getAttribute("d");
        if (d) return getPathCenter(d);
    }

    return null;
}

function withMeasuredSvg<T>(svgText: string, measure: (doc: Document, svg: SVGSVGElement) => T): T {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none";
    host.innerHTML = svgText;
    document.body.appendChild(host);

    try {
        const svg = host.querySelector("svg");
        if (!svg) {
            const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
            return measure(doc, doc.documentElement as unknown as SVGSVGElement);
        }
        return measure(svg.ownerDocument, svg);
    } finally {
        host.remove();
    }
}

function toViewBoxPercent(
    point: { x: number; y: number },
    viewBox: SvgViewBox,
): { x: number; y: number } {
    return {
        x: ((point.x - viewBox.minX) / viewBox.width) * 100,
        y: ((point.y - viewBox.minY) / viewBox.height) * 100,
    };
}

/**
 * Extrait les positions de broches en % viewBox depuis un SVG breadboard.
 * @param svgText - Contenu SVG breadboard.
 * @param connectors - Références connecteurs issues du FZP.
 * @returns Broches positionnées et viewBox utilisé.
 */
export function extractConnectorPins(
    svgText: string,
    connectors: FritzingConnectorRef[],
): { pins: FritzingPin[]; viewBox: SvgViewBox } {
    return withMeasuredSvg(svgText, (doc, svg) => {
        const viewBox = parseSvgViewBox(svgText);

        const pins = connectors.map((connector, index) => {
            const element = findConnectorElement(svg, connector.svgId)
                ?? findConnectorElement(doc, connector.svgId);
            let center: { x: number; y: number } | null = null;

            if (element) {
                center = getElementCenterInViewBox(element, svg, viewBox);
                if (!center) {
                    const fromAttributes = getElementCenterFromAttributes(element);
                    if (fromAttributes) center = fromAttributes;
                }
            }

            const fallbackX = ((index + 1) / (connectors.length + 1)) * 100;
            const fallbackY = 90;
            const percent = center
                ? toViewBoxPercent(center, viewBox)
                : { x: fallbackX, y: fallbackY };

            return {
                id: connector.id,
                name: connector.name,
                svgId: connector.svgId,
                x: percent.x,
                y: percent.y,
            };
        });

        return { pins, viewBox };
    });
}

/**
 * Construit des références connecteur à partir de broches catalogue.
 * @param pins - Broches avec id, nom et svgId optionnel.
 * @returns Références prêtes pour {@link extractConnectorPins}.
 */
export function buildConnectorRefs(
    pins: { id: string; name: string; svgId?: string }[],
): FritzingConnectorRef[] {
    return pins.map((pin) => ({
        id: pin.id,
        name: pin.name,
        svgId: pin.svgId ?? `${pin.id}pin`,
    }));
}

/**
 * Applique une taille d’affichage px à un élément SVG.
 * @param svg - Élément SVG cible.
 * @param width - Largeur d’affichage en pixels.
 * @param height - Hauteur d’affichage en pixels.
 */
export function applySvgDisplaySize(svg: SVGSVGElement, width: number, height: number): void {
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.display = "block";
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}
