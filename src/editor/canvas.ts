/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Canvas draw2d principal : viewport, zoom, overlay HTML et politiques d’édition.
 *
 * Responsabilités :
 * - Installer pan / zoom / snap / connexions
 * - Overlay HTML des composants sous le SVG draw2d
 * - Drop catalogue → `ComponentFigure`, grille et monde extensible
 */
import draw2d from "draw2d";
import { setupDraw2dContextMenu } from "./canvas-context-menu";
import { addFigureWithUndo } from "./canvas-commands";
import { patchDraw2dCommandStack } from "./draw2d-patches";
import { hackCablePanningPolicy } from "./canvas-panning-policy";
import { setupViewportAltHorizontalScroll, getEditorViewport } from "./canvas-viewport";
import { setupCanvasMinimap } from "./canvas-minimap";
import { setupCanvasZoomToolbar } from "./canvas-toolbar";
import { DEFAULT_ZOOM } from "./canvas-zoom";
import { connectionsPolicy } from "./connections-policies";
import { ComponentFigure, syncFigurePortHitTargets } from "./component-figure";
import { getComponentById } from "../panels/component";
import { css } from "../utils/dom";
import { CANVAS_WORLD_HEIGHT, CANVAS_WORLD_WIDTH, snapPointToCanvasGrid } from "./canvas-scale";
import {
    zoomInCanvas,
    zoomOutCanvas,
    zoomResetCanvas,
    zoomToFitCanvas,
} from "./canvas-zoom";

const DEFAULT_ZOOM_LEVEL = DEFAULT_ZOOM;

export class Canvas extends draw2d.Canvas {

    private selected: any = null;
    private disposeZoomToolbar: (() => void) | null = null;
    private disposeMinimap: (() => void) | null = null;
    private disposeViewportWheel: (() => void) | null = null;
    private disposeLayoutSync: (() => void) | null = null;

    /**
     * Initialise le canvas draw2d avec overlay HTML, politiques et UI flottante.
     * @param divId - Identifiant DOM du conteneur canvas.
     */
    constructor(divId: string) {
        patchDraw2dCommandStack();
        super(divId);

        // Overlay HTML sous le SVG draw2d : visuel seulement (pointer-events: none).
        // Les broches et connexions draw2d restent au-dessus et cliquables (voir css.styl).
        this.overlayContainer = document.querySelector('.hackCable-canvas-overlay-container');
        this.html.prepend(this.overlayContainer);

        this.setScrollArea(document.querySelector('.hackCable-editor-viewport'))

        // Edit policies
        this.installEditPolicy(new hackCablePanningPolicy())
        // Zoom molette + Shift (draw2d) ; molette seule = scroll vertical ; Alt+molette = scroll horizontal
        this.installEditPolicy(new draw2d.policy.canvas.WheelZoomPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToGeometryEditPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToInBetweenEditPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToCenterEditPolicy())
        this.installEditPolicy(connectionsPolicy);

        // Listeners
        this.on("select", (_emitter: any, event: any) => this.onSelectionChange(event.figure));
        this.on("zoom", () => this.onZoomChange());

        this.setZoom(DEFAULT_ZOOM_LEVEL)

        // Add drag and drop event listeners to the canvas
        const htmlElement = this.html[0] ?? this.html;
        htmlElement.addEventListener('dragover', this.dragover_handler.bind(this));
        htmlElement.addEventListener('drop', this.drop_handler.bind(this));
        htmlElement.addEventListener('mouseup', this.snapSelectedFigureToGrid.bind(this));

        setupDraw2dContextMenu(this);
        this.disposeZoomToolbar = setupCanvasZoomToolbar(this);
        this.disposeMinimap = setupCanvasMinimap(this);
        this.disposeViewportWheel = setupViewportAltHorizontalScroll();
        this.disposeLayoutSync = this.setupViewportLayoutSync();

    }

    private setupViewportLayoutSync(): () => void {
        const viewport = getEditorViewport();
        if (!viewport) return () => undefined;

        const refresh = () => {
            this.ensureWorldCoversViewport();
            this.onZoomChange();
            for (const figure of this.getFigures().data) {
                if (figure instanceof ComponentFigure) {
                    figure.syncOverlayLayout();
                }
            }
        };

        const observer = new ResizeObserver(() => refresh());
        observer.observe(viewport);
        requestAnimationFrame(() => requestAnimationFrame(refresh));

        return () => observer.disconnect();
    }

    /** Augmente le zoom d'un pas discret. */
    public zoomIn(): void {
        zoomInCanvas(this);
    }

    /** Diminue le zoom d'un pas discret. */
    public zoomOut(): void {
        zoomOutCanvas(this);
    }

    /** Réinitialise le zoom à 100 %. */
    public zoomReset(): void {
        zoomResetCanvas(this);
    }

    /** Ajuste le zoom pour afficher toutes les figures. */
    public zoomToFit(): void {
        zoomToFitCanvas(this);
    }

    /**
     * Libère les ressources UI (minicarte, toolbar, écouteurs) avant destruction draw2d.
     */
    public destroy(): void {
        this.disposeLayoutSync?.();
        this.disposeLayoutSync = null;
        this.disposeViewportWheel?.();
        this.disposeViewportWheel = null;
        this.disposeMinimap?.();
        this.disposeMinimap = null;
        this.disposeZoomToolbar?.();
        this.disposeZoomToolbar = null;
        super.destroy();
    }

    private syncAllPortHitTargets(): void {
        const zoom = this.getZoom();
        for (const figure of this.getFigures().data) {
            if (figure instanceof ComponentFigure) {
                syncFigurePortHitTargets(figure, zoom);
            }
        }
    }

    /**
     * Le scrollArea est un ancêtre (.hackCable-editor-viewport), pas le canvas lui-même.
     * La formule draw2d (offset(canvas) + scroll) compte alors le pan deux fois et
     * casse getBestFigure / pastilles après un déplacement du viewport.
     */
    /**
     * Convertit des coordonnées document (viewport) en coordonnées logiques canvas.
     * @param x - Abscisse en pixels écran.
     * @param y - Ordonnée en pixels écran.
     * @returns Point logique draw2d.
     */
    public fromDocumentToCanvasCoordinate(x: number, y: number) {
        const viewport = getEditorViewport();
        if (!viewport) {
            return super.fromDocumentToCanvasCoordinate(x, y);
        }
        const rect = viewport.getBoundingClientRect();
        const zoom = this.getZoom();
        return new draw2d.geo.Point(
            (x - rect.left + viewport.scrollLeft) * zoom,
            (y - rect.top + viewport.scrollTop) * zoom,
        );
    }

    /**
     * Convertit des coordonnées logiques canvas en coordonnées document (viewport).
     * @param x - Abscisse logique draw2d.
     * @param y - Ordonnée logique draw2d.
     * @returns Point en pixels écran.
     */
    public fromCanvasToDocumentCoordinate(x: number, y: number) {
        const viewport = getEditorViewport();
        if (!viewport) {
            return super.fromCanvasToDocumentCoordinate(x, y);
        }
        const rect = viewport.getBoundingClientRect();
        const zoom = this.getZoom();
        return new draw2d.geo.Point(
            x / zoom - viewport.scrollLeft + rect.left,
            y / zoom - viewport.scrollTop + rect.top,
        );
    }

    /**
     * Sur grand écran, le monde fixe 1500×1000 laisse du blanc hors grille.
     * On agrandit la taille logique pour que CSS (logical/zoom) couvre au moins le viewport.
     */
    private ensureWorldCoversViewport(): void {
        const viewport = getEditorViewport();
        if (!viewport) return;

        const zoom = Math.max(0.01, this.getZoom());
        const needW = Math.max(
            CANVAS_WORLD_WIDTH,
            Math.ceil(viewport.clientWidth * zoom),
        );
        const needH = Math.max(
            CANVAS_WORLD_HEIGHT,
            Math.ceil(viewport.clientHeight * zoom),
        );

        const curW = Number(this.initialWidth) || CANVAS_WORLD_WIDTH;
        const curH = Number(this.initialHeight) || CANVAS_WORLD_HEIGHT;
        if (needW <= curW && needH <= curH) return;

        const newW = Math.max(curW, needW);
        const newH = Math.max(curH, needH);
        this.initialWidth = newW;
        this.initialHeight = newH;
        this.setDimension(newW, newH);
    }

    private onZoomChange() {
        this.ensureWorldCoversViewport();
        const zoom = Math.max(0.01, this.getZoom());
        // WheelZoomPolicy : viewBox fixe, SVG = initial/zoom. Aligner le div canvas
        // pour que la zone scrollable couvre bien le dessin.
        const initialW = Number(this.initialWidth) || CANVAS_WORLD_WIDTH;
        const initialH = Number(this.initialHeight) || CANVAS_WORLD_HEIGHT;
        const cssW = initialW / zoom;
        const cssH = initialH / zoom;
        const canvasEl = this.html?.[0] ?? this.html;
        if (canvasEl instanceof HTMLElement) {
            css(canvasEl, { width: `${cssW}px`, height: `${cssH}px` });
        }
        // Overlay en coords logiques, scale(1/zoom) pour coller au SVG redimensionné.
        css(this.overlayContainer, {
            transform: `scale(${1 / zoom})`,
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
        });
        if (this.overlayContainer instanceof HTMLElement) {
            this.overlayContainer.style.pointerEvents = "none";
        }
        this.syncAllPortHitTargets();
    }
    private onSelectionChange(selected: any) {
        if (this.selected != selected) {
            if (this.selected instanceof ComponentFigure) this.selected.onUnselected()
            if (selected instanceof ComponentFigure) selected.onSelected();
            this.selected = selected;
        }
    }
    /** Vide le canvas et réinitialise le zoom à 100 %. */
    public clear() {
        super.clear();
        this.setZoom(DEFAULT_ZOOM_LEVEL);
    }

    private snapSelectedFigureToGrid(): void {
        if (!(this.selected instanceof ComponentFigure)) return;
        const { x, y } = snapPointToCanvasGrid(this.selected.getX(), this.selected.getY());
        if (x === this.selected.getX() && y === this.selected.getY()) return;
        this.selected.setX(x);
        this.selected.setY(y);
        this.selected.syncOverlayLayout(x, y);
    }

    /**
     * Autorise le dépôt drag-and-drop depuis le catalogue.
     * @param event - Événement dragover natif.
     */
    public dragover_handler(event: DragEvent) {
        event.preventDefault(); // This is crucial to allow dropping
        event.dataTransfer!.dropEffect = "copy";
    }

    /**
     * Crée une figure composant à la position du drop catalogue.
     * @param event - Événement drop natif.
     */
    public drop_handler(event: DragEvent) {
        event.preventDefault();
        const item_data = event.dataTransfer!.getData("text");
        const componentId = parseInt(item_data);
        if (!isNaN(componentId)) {
            const componentInfo = getComponentById(componentId);
            if (!componentInfo) return;
            const figure = new ComponentFigure(componentInfo);
            const viewport = document.querySelector('.hackCable-editor-viewport');
            if (!(viewport instanceof HTMLElement)) return;
            const rect = viewport.getBoundingClientRect();
            const rawX = (event.clientX - rect.left + viewport.scrollLeft) * this.getZoom();
            const rawY = (event.clientY - rect.top + viewport.scrollTop) * this.getZoom();
            const { x, y } = snapPointToCanvasGrid(rawX, rawY);
            addFigureWithUndo(this, figure, x, y);
        }
    }
}