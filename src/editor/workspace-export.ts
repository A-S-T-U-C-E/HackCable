/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Export d’une capture PNG du plan, recadrée sur le contenu.
 *
 * Responsabilités :
 * - Rendre le canvas (SVG + overlays) en image
 * - Recadrer sur l’emprise des figures (style io_png_crop)
 *
 * @see https://freegroup.github.io/draw2d/#/examples/io_png_crop
 * @see https://freegroup.github.io/draw2d/#/examples/io_svg_basic
 */
import draw2d from "draw2d";
import { ComponentFigure } from "./component-figure";
import type { ContentBounds } from "./canvas-zoom";

const EXPORT_PADDING = 32;

type CropRect = { x: number; y: number; w: number; h: number };

type ExportCanvas = {
    getFigures: () => { data: unknown[] };
    getLines?: () => { data?: unknown[] };
    getPrimarySelection?: () => unknown;
    setCurrentSelection?: (figure: unknown) => void;
};

function asExportCanvas(canvas: object): ExportCanvas {
    return canvas as ExportCanvas;
}

function expandBounds(bounds: ContentBounds, pad: number): CropRect {
    return {
        x: Math.max(0, Math.floor(bounds.x - pad)),
        y: Math.max(0, Math.floor(bounds.y - pad)),
        w: Math.ceil(bounds.width + pad * 2),
        h: Math.ceil(bounds.height + pad * 2),
    };
}

/**
 * Calcule les bornes du schéma (composants + fils + labels).
 * @param canvas - Canvas draw2d / HackCable.
 * @returns Rectangle englobant ou `null` si le plan est vide.
 */
export function getWorkspaceExportBounds(canvas: object): ContentBounds | null {
    return getWorkspaceExportBoundsInner(asExportCanvas(canvas));
}

function getWorkspaceExportBoundsInner(canvas: ExportCanvas): ContentBounds | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;

    const includeBox = (x: number, y: number, w: number, h: number) => {
        if (!(w > 0 && h > 0) || ![x, y, w, h].every(Number.isFinite)) return;
        any = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    };

    canvas.getFigures().data.forEach((figure: unknown) => {
        if (!(figure instanceof ComponentFigure)) return;
        includeBox(figure.getX(), figure.getY(), figure.getWidth(), figure.getHeight());
    });

    const lines = canvas.getLines?.();
    const lineList = lines?.data ?? [];
    for (const raw of lineList) {
        const line = raw as {
            getVertices?: () => { data?: Array<{ x: number; y: number }> };
            getChildren?: () => {
                data?: Array<{
                    figure?: {
                        getAbsoluteX?: () => number;
                        getAbsoluteY?: () => number;
                        getWidth?: () => number;
                        getHeight?: () => number;
                    };
                }>;
            };
        };
        const verts = line.getVertices?.()?.data;
        if (Array.isArray(verts)) {
            for (const p of verts) {
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
                any = true;
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
        }
        for (const entry of line.getChildren?.()?.data ?? []) {
            const label = entry?.figure;
            if (!label?.getAbsoluteX || !label.getWidth) continue;
            includeBox(
                label.getAbsoluteX(),
                label.getAbsoluteY?.() ?? 0,
                label.getWidth(),
                label.getHeight?.() ?? 0,
            );
        }
    }

    if (!any) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image load failed"));
        img.src = src;
    });
}

async function rasterizeOverlay(
    overlay: HTMLElement,
    width: number,
    height: number,
): Promise<CanvasImageSource | null> {
    const img = overlay instanceof HTMLImageElement
        ? overlay
        : overlay.querySelector("img");
    if (img instanceof HTMLImageElement) {
        if (!img.complete || img.naturalWidth === 0) {
            try {
                await loadImage(img.currentSrc || img.src);
            } catch {
                return null;
            }
        }
        return img;
    }

    const svg =
        overlay.shadowRoot?.querySelector("svg")
        ?? overlay.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return null;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    clone.setAttribute("width", String(Math.max(1, Math.round(width))));
    clone.setAttribute("height", String(Math.max(1, Math.round(height))));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    try {
        return await loadImage(url);
    } catch {
        return null;
    }
}

async function drawComponentOverlays(
    ctx: CanvasRenderingContext2D,
    canvas: ExportCanvas,
    crop: CropRect,
): Promise<void> {
    const figures = canvas.getFigures().data.filter(
        (f: unknown) => f instanceof ComponentFigure,
    ) as ComponentFigure[];

    for (const figure of figures) {
        const overlay = figure.getOverlayElement();
        const w = figure.getWidth();
        const h = figure.getHeight();
        const source = await rasterizeOverlay(overlay, w, h);
        if (!source) continue;

        const x = figure.getX() - crop.x;
        const y = figure.getY() - crop.y;
        const angle = ((Number(figure.getRotationAngle()) || 0) % 360 + 360) % 360;

        ctx.save();
        if (angle !== 0) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((angle * Math.PI) / 180);
            if (angle === 90 || angle === 270) {
                const ratio = h / Math.max(w, 0.0001);
                ctx.scale(ratio, 1 / ratio);
            }
            ctx.drawImage(source, -w / 2, -h / 2, w, h);
        } else {
            ctx.drawImage(source, x, y, w, h);
        }
        ctx.restore();
    }
}

function marshalPngCropped(
    canvas: ExportCanvas,
    crop: CropRect,
): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const writer = new draw2d.io.png.Writer();
            const rect = new draw2d.geo.Rectangle(crop.x, crop.y, crop.w, crop.h);
            writer.marshal(canvas, (dataUrl: string) => {
                if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/png")) {
                    resolve(dataUrl);
                } else {
                    reject(new Error("PNG export failed"));
                }
            }, rect);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Capture PNG du workspace recadrée sur le contenu avec overlays composites.
 * @param canvas - Canvas draw2d / HackCable.
 * @returns Data URL PNG (`data:image/png;base64,...`).
 */
export async function exportWorkspacePngDataUrl(canvas: object): Promise<string> {
    const view = asExportCanvas(canvas);
    const bounds = getWorkspaceExportBoundsInner(view);
    if (!bounds) {
        throw new Error("empty");
    }
    const crop = expandBounds(bounds, EXPORT_PADDING);

    const selection = view.getPrimarySelection?.() ?? null;
    view.setCurrentSelection?.(null);

    const figures = view.getFigures().data.filter(
        (f: unknown) => f instanceof ComponentFigure,
    ) as ComponentFigure[];

    const saved = figures.map((figure) => ({
        figure,
        alpha: typeof figure.getAlpha === "function" ? figure.getAlpha() : 1,
        bg: typeof figure.getBackgroundColor === "function" ? figure.getBackgroundColor() : null,
    }));

    try {
        for (const { figure } of saved) {
            figure.setAlpha?.(0);
            figure.setBackgroundColor?.(null);
        }

        const wiresPng = await marshalPngCropped(view, crop);
        const wiresImg = await loadImage(wiresPng);

        const out = document.createElement("canvas");
        out.width = crop.w;
        out.height = crop.h;
        const ctx = out.getContext("2d");
        if (!ctx) throw new Error("canvas");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, crop.w, crop.h);
        await drawComponentOverlays(ctx, view, crop);
        ctx.drawImage(wiresImg, 0, 0);

        return out.toDataURL("image/png");
    } finally {
        for (const { figure, alpha, bg } of saved) {
            figure.setAlpha?.(alpha);
            if (bg != null) figure.setBackgroundColor?.(bg);
        }
        if (selection) view.setCurrentSelection?.(selection);
    }
}

/**
 * Exporte le SVG draw2d avec viewBox ajusté au contenu.
 * @param canvas - Canvas draw2d / HackCable.
 * @returns Promesse résolue avec la chaîne SVG.
 */
export function exportWorkspaceSvgString(canvas: object): Promise<string> {
    const view = asExportCanvas(canvas);
    return new Promise((resolve, reject) => {
        try {
            const bounds = getWorkspaceExportBoundsInner(view);
            if (!bounds) {
                reject(new Error("empty"));
                return;
            }
            const writer = new draw2d.io.svg.Writer();
            writer.marshal(view, (svg: string) => {
                const crop = expandBounds(bounds, EXPORT_PADDING);
                let next = svg;
                if (/viewBox\s*=/.test(next)) {
                    next = next.replace(
                        /viewBox\s*=\s*"[^"]*"/,
                        `viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}"`,
                    );
                } else {
                    next = next.replace(
                        /<svg\b/,
                        `<svg viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}"`,
                    );
                }
                next = next.replace(/\bwidth\s*=\s*"[^"]*"/, `width="${crop.w}"`);
                next = next.replace(/\bheight\s*=\s*"[^"]*"/, `height="${crop.h}"`);
                resolve(next);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function buildExportFilename(ext: "png" | "svg", date = new Date()): string {
    return `hackcable-${date.toISOString().slice(0, 10)}.${ext}`;
}

/**
 * Télécharge le SVG ajusté du workspace en fichier local.
 * @param canvas - Canvas draw2d / HackCable.
 */
export async function downloadWorkspaceSvg(canvas: object): Promise<void> {
    const svg = await exportWorkspaceSvgString(canvas);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildExportFilename("svg");
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
