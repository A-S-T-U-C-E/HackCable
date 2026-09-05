/**
 * @file Minicarte du plan (aperçu, rectangle de vue, navigation clic/glisser).
 */
import type { Canvas } from "./canvas";
import { ComponentFigure } from "./component-figure";
import { CANVAS_GRID_SIZE } from "./canvas-scale";
import {
    getEditorViewport,
    getMinimapWorldBounds,
    getViewportState,
    scrollViewportToCanvasCenter,
} from "./canvas-viewport";
import {
    MINIMAP_HEIGHT,
    MINIMAP_WIDTH,
    clampRectToBounds,
    computeMinimapTransform,
    hitTestRect,
    minimapToWorld,
    type Point2D,
    viewportToMinimapRect,
    worldToMinimap,
} from "./minimap-geometry";
import { tr } from "../ui/i18n/translate";

function pointCoords(point: unknown): Point2D | null {
    if (!point || typeof point !== "object") return null;
    const candidate = point as { getX?: () => number; getY?: () => number; x?: number; y?: number };
    if (typeof candidate.getX === "function" && typeof candidate.getY === "function") {
        return { x: candidate.getX(), y: candidate.getY() };
    }
    if (typeof candidate.x === "number" && typeof candidate.y === "number") {
        return { x: candidate.x, y: candidate.y };
    }
    return null;
}

function drawWorldBackground(
    ctx: CanvasRenderingContext2D,
    transform: ReturnType<typeof computeMinimapTransform>,
    gridStep: number,
): void {
    const world = transform.world;
    const mapX = transform.offsetX;
    const mapY = transform.offsetY;
    const mapW = world.width * transform.scale;
    const mapH = world.height * transform.scale;

    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(mapX, mapY, mapW, mapH);

    if (gridStep > 0) {
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        ctx.beginPath();

        const worldStartX = Math.floor(world.x / gridStep) * gridStep;
        const worldEndX = world.x + world.width;
        for (let wx = worldStartX; wx <= worldEndX; wx += gridStep) {
            const sx = transform.offsetX + (wx - world.x) * transform.scale;
            ctx.moveTo(sx, mapY);
            ctx.lineTo(sx, mapY + mapH);
        }

        const worldStartY = Math.floor(world.y / gridStep) * gridStep;
        const worldEndY = world.y + world.height;
        for (let wy = worldStartY; wy <= worldEndY; wy += gridStep) {
            const sy = transform.offsetY + (wy - world.y) * transform.scale;
            ctx.moveTo(mapX, sy);
            ctx.lineTo(mapX + mapW, sy);
        }
        ctx.stroke();
    }

    ctx.strokeStyle = "#c8c8c8";
    ctx.strokeRect(mapX + 0.5, mapY + 0.5, mapW - 1, mapH - 1);
}

function cssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function drawConnections(
    ctx: CanvasRenderingContext2D,
    canvas: Canvas,
    transform: ReturnType<typeof computeMinimapTransform>,
): void {
    const lines = canvas.getLines().data as Array<{ getVertices?: () => { data: unknown[] } }>;
    ctx.strokeStyle = cssVar("--hc-accent", "#2c70ff");
    ctx.lineWidth = 1;

    for (const line of lines) {
        const vertices = line.getVertices?.().data ?? [];
        if (vertices.length < 2) continue;

        const first = pointCoords(vertices[0]);
        if (!first) continue;

        ctx.beginPath();
        const start = worldToMinimap(transform, first.x, first.y);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < vertices.length; i++) {
            const point = pointCoords(vertices[i]);
            if (!point) continue;
            const mapped = worldToMinimap(transform, point.x, point.y);
            ctx.lineTo(mapped.x, mapped.y);
        }
        ctx.stroke();
    }
}

function drawFigures(
    ctx: CanvasRenderingContext2D,
    canvas: Canvas,
    transform: ReturnType<typeof computeMinimapTransform>,
): void {
    const figures = canvas.getFigures().data.filter(
        (figure: unknown) => figure instanceof ComponentFigure,
    ) as ComponentFigure[];

    ctx.fillStyle = "#424b5a";
    for (const figure of figures) {
        const topLeft = worldToMinimap(transform, figure.getX(), figure.getY());
        ctx.fillRect(
            topLeft.x,
            topLeft.y,
            Math.max(2, figure.getWidth() * transform.scale),
            Math.max(2, figure.getHeight() * transform.scale),
        );
    }
}

function drawViewport(
    ctx: CanvasRenderingContext2D,
    transform: ReturnType<typeof computeMinimapTransform>,
    viewX: number,
    viewY: number,
    viewWidth: number,
    viewHeight: number,
): void {
    const mapBounds = {
        x: transform.offsetX,
        y: transform.offsetY,
        width: transform.world.width * transform.scale,
        height: transform.world.height * transform.scale,
    };
    const viewportRect = clampRectToBounds(
        viewportToMinimapRect(transform, viewX, viewY, viewWidth, viewHeight),
        mapBounds,
    );

    ctx.fillStyle = cssVar("--hc-accent-soft", "rgba(44, 112, 255, 0.18)");
    ctx.fillRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);
    ctx.strokeStyle = cssVar("--hc-accent-strong", "rgba(44, 112, 255, 0.85)");
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);
}

const MINIMAP_VISIBILITY_KEY = "hackCable-show-minimap";
const MINIMAP_POSITION_KEY = "hackCable-minimap-position";

export function isMinimapVisible(): boolean {
    return localStorage.getItem(MINIMAP_VISIBILITY_KEY) !== "false";
}

export function setMinimapVisible(visible: boolean): void {
    localStorage.setItem(MINIMAP_VISIBILITY_KEY, visible ? "true" : "false");
    const minimap = document.querySelector(".hackCable-canvas-minimap");
    if (minimap instanceof HTMLElement) {
        minimap.hidden = !visible;
    }
}

interface MinimapPosition {
    left: number;
    top: number;
}

function readSavedPosition(): MinimapPosition | null {
    try {
        const raw = localStorage.getItem(MINIMAP_POSITION_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        const { left, top } = parsed as Record<string, unknown>;
        if (typeof left !== "number" || typeof top !== "number" || !Number.isFinite(left) || !Number.isFinite(top)) {
            return null;
        }
        return { left, top };
    } catch {
        return null;
    }
}

function writeSavedPosition(position: MinimapPosition): void {
    localStorage.setItem(MINIMAP_POSITION_KEY, JSON.stringify(position));
}

function clampMinimapPosition(
    host: HTMLElement,
    root: HTMLElement,
    left: number,
    top: number,
): MinimapPosition {
    const maxLeft = Math.max(0, host.clientWidth - root.offsetWidth);
    const maxTop = Math.max(0, host.clientHeight - root.offsetHeight);
    return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop),
    };
}

function applyMinimapPosition(host: HTMLElement, root: HTMLElement, left: number, top: number): MinimapPosition {
    const clamped = clampMinimapPosition(host, root, left, top);
    root.style.left = `${clamped.left}px`;
    root.style.top = `${clamped.top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    return clamped;
}

function defaultMinimapPosition(host: HTMLElement, root: HTMLElement): MinimapPosition {
    return clampMinimapPosition(host, root, 16, Math.max(0, host.clientHeight - root.offsetHeight - 16));
}

/** Installe la minicarte flottante et retourne une fonction de nettoyage. */
export function setupCanvasMinimap(canvas: Canvas): () => void {
    const host = document.querySelector(".hackCable-editor");
    if (!(host instanceof HTMLElement)) {
        console.error("[HackCable] Unable to find element .hackCable-editor");
        return () => undefined;
    }

    const root = document.createElement("div");
    root.className = "hackCable-canvas-minimap";
    root.setAttribute("role", "img");

    const surface = document.createElement("canvas");
    surface.className = "hackCable-canvas-minimap-surface";
    surface.width = MINIMAP_WIDTH;
    surface.height = MINIMAP_HEIGHT;
    surface.setAttribute("aria-hidden", "true");
    root.appendChild(surface);
    host.appendChild(root);
    root.hidden = !isMinimapVisible();

    const saved = readSavedPosition();
    if (saved) {
        applyMinimapPosition(host, root, saved.left, saved.top);
    } else {
        const fallback = defaultMinimapPosition(host, root);
        applyMinimapPosition(host, root, fallback.left, fallback.top);
    }

    const ctx = surface.getContext("2d");
    if (!ctx) {
        root.remove();
        return () => undefined;
    }

    let rafId = 0;
    let dragging = false;
    let dragMode: "pan" | "viewport" = "pan";
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let movingWidget = false;
    let moveOffsetX = 0;
    let moveOffsetY = 0;
    let lastTransform: ReturnType<typeof computeMinimapTransform> | null = null;
    let lastView = { x: 0, y: 0, width: 0, height: 0 };

    const scheduleRender = () => {
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => {
            rafId = 0;
            render();
        });
    };

    const render = () => {
        const world = getMinimapWorldBounds(canvas);
        const transform = computeMinimapTransform(world);
        const view = getViewportState(canvas);
        lastTransform = transform;
        lastView = { x: view.viewX, y: view.viewY, width: view.viewWidth, height: view.viewHeight };

        ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

        // Pas de grille trop dense dans la minicarte (lisible + perf).
        const gridPixelStep = CANVAS_GRID_SIZE * transform.scale;
        drawWorldBackground(ctx, transform, gridPixelStep >= 3 ? CANVAS_GRID_SIZE : 0);
        drawConnections(ctx, canvas, transform);
        drawFigures(ctx, canvas, transform);
        drawViewport(ctx, transform, view.viewX, view.viewY, view.viewWidth, view.viewHeight);
    };

    const localCoords = (event: MouseEvent): Point2D => {
        const rect = surface.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (surface.width / rect.width),
            y: (event.clientY - rect.top) * (surface.height / rect.height),
        };
    };

    const onMoveWidget = (event: MouseEvent) => {
        if (!movingWidget) return;
        const hostRect = host.getBoundingClientRect();
        applyMinimapPosition(
            host,
            root,
            event.clientX - hostRect.left - moveOffsetX,
            event.clientY - hostRect.top - moveOffsetY,
        );
    };

    const onMoveWidgetEnd = () => {
        if (!movingWidget) return;
        movingWidget = false;
        root.classList.remove("is-moving");
        const left = Number.parseFloat(root.style.left);
        const top = Number.parseFloat(root.style.top);
        if (Number.isFinite(left) && Number.isFinite(top)) {
            writeSavedPosition({ left, top });
        }
        window.removeEventListener("mousemove", onMoveWidget);
        window.removeEventListener("mouseup", onMoveWidgetEnd);
    };

    const onRootPointerDown = (event: MouseEvent) => {
        if (event.button !== 0 || event.target !== root) return;
        event.preventDefault();
        event.stopPropagation();

        const rootRect = root.getBoundingClientRect();
        movingWidget = true;
        moveOffsetX = event.clientX - rootRect.left;
        moveOffsetY = event.clientY - rootRect.top;
        root.classList.add("is-moving");

        window.addEventListener("mousemove", onMoveWidget);
        window.addEventListener("mouseup", onMoveWidgetEnd);
    };

    const onPointerDown = (event: MouseEvent) => {
        if (event.button !== 0 || !lastTransform) return;
        event.preventDefault();

        const point = localCoords(event);
        const onViewport = hitTestRect(
            viewportToMinimapRect(
                lastTransform,
                lastView.x,
                lastView.y,
                lastView.width,
                lastView.height,
            ),
            point.x,
            point.y,
        );

        dragging = true;
        dragMode = onViewport ? "viewport" : "pan";

        const world = minimapToWorld(lastTransform, point.x, point.y);
        if (dragMode === "viewport") {
            dragOffsetX = world.x - lastView.x;
            dragOffsetY = world.y - lastView.y;
        } else {
            scrollViewportToCanvasCenter(canvas, world.x, world.y);
        }

        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);
    };

    const onPointerMove = (event: MouseEvent) => {
        if (!dragging || !lastTransform) return;

        const point = localCoords(event);
        const world = minimapToWorld(lastTransform, point.x, point.y);

        if (dragMode === "viewport") {
            const view = getViewportState(canvas);
            scrollViewportToCanvasCenter(
                canvas,
                world.x - dragOffsetX + view.viewWidth / 2,
                world.y - dragOffsetY + view.viewHeight / 2,
            );
        } else {
            scrollViewportToCanvasCenter(canvas, world.x, world.y);
        }
        scheduleRender();
    };

    const onPointerUp = () => {
        dragging = false;
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
    };

    const keepInsideHost = () => {
        const left = Number.parseFloat(root.style.left);
        const top = Number.parseFloat(root.style.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) {
            const fallback = defaultMinimapPosition(host, root);
            applyMinimapPosition(host, root, fallback.left, fallback.top);
            return;
        }
        applyMinimapPosition(host, root, left, top);
    };

    root.addEventListener("mousedown", onRootPointerDown);
    surface.addEventListener("mousedown", onPointerDown);

    const viewport = getEditorViewport();
    viewport?.addEventListener("scroll", scheduleRender, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
        keepInsideHost();
        scheduleRender();
    });
    resizeObserver.observe(host);
    if (viewport) resizeObserver.observe(viewport);

    const onCanvasEvent = () => scheduleRender();
    canvas.on("zoom", onCanvasEvent);
    canvas.on("figure:add", onCanvasEvent);
    canvas.on("figure:remove", onCanvasEvent);
    canvas.on("figure:move", onCanvasEvent);
    canvas.on("connect", onCanvasEvent);
    canvas.on("disconnect", onCanvasEvent);

    const onA11yChanged = () => scheduleRender();
    document.addEventListener("hackcable:a11y-changed", onA11yChanged);

    const rebuildLabel = () => {
        root.setAttribute("aria-label", tr("canvas.minimap"));
        root.title = tr("canvas.minimapHint");
    };
    rebuildLabel();

    scheduleRender();

    return () => {
        if (rafId) window.cancelAnimationFrame(rafId);
        root.removeEventListener("mousedown", onRootPointerDown);
        surface.removeEventListener("mousedown", onPointerDown);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        window.removeEventListener("mousemove", onMoveWidget);
        window.removeEventListener("mouseup", onMoveWidgetEnd);
        document.removeEventListener("hackcable:a11y-changed", onA11yChanged);
        viewport?.removeEventListener("scroll", scheduleRender);
        resizeObserver.disconnect();
        canvas.off("zoom", onCanvasEvent);
        canvas.off("figure:add", onCanvasEvent);
        canvas.off("figure:remove", onCanvasEvent);
        canvas.off("figure:move", onCanvasEvent);
        canvas.off("connect", onCanvasEvent);
        canvas.off("disconnect", onCanvasEvent);
        root.remove();
    };
}
