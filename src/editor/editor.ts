/**
 * @file Éditeur de schéma : sérialisation, chargement et pile undo/redo draw2d.
 */
import { Canvas } from "./canvas";
import { ComponentFigure } from "./component-figure";
import type { FigureData, WiringData } from "./component-figure";
import { createWiringConnection, markConnectionUserRouted } from "./connection-router";
import { getComponentById } from "../panels/component";
import type { Port } from "draw2d-types";

export type EditorSaveData = { figures: FigureData[]; connections: WiringData[] };

export type EditorLoadMode = "replace" | "append";

interface Draw2dCommandStack {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    markSaveLocation?: () => void;
}

function newFigureId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `fig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class Editor {
    private readonly _canvas: Canvas;

    constructor() {
        this._canvas = new Canvas("hackCable-canvas");
    }

    private getCommandStack(): Draw2dCommandStack {
        return this._canvas.getCommandStack() as Draw2dCommandStack;
    }

    public undo(): void {
        if (this.canUndo()) this.getCommandStack().undo();
    }

    public redo(): void {
        if (this.canRedo()) this.getCommandStack().redo();
    }

    public canUndo(): boolean {
        return Boolean(this.getCommandStack().canUndo?.());
    }

    public canRedo(): boolean {
        return Boolean(this.getCommandStack().canRedo?.());
    }

    /** Vrai s’il n’y a aucun composant sur le plan. */
    public isWorkspaceEmpty(): boolean {
        return !this._canvas.getFigures().data.some((figure: unknown) => figure instanceof ComponentFigure);
    }

    public getEditorSaveData(): EditorSaveData {
        const data: EditorSaveData = { figures: [], connections: [] };

        this._canvas.getFigures().data.forEach((figure: unknown) => {
            if (figure instanceof ComponentFigure) {
                data.figures.push(figure.getFigureData());
                data.connections.push(...figure.getWiringData());
            }
        });
        return data;
    }

    /**
     * Charge une sauvegarde.
     * - replace : vide le plan puis importe
     * - append : ajoute en remappant les ids en conflit
     */
    public loadEditorSaveData(data: EditorSaveData, mode: EditorLoadMode = "replace"): void {
        if (mode === "replace") {
            this._canvas.clear();
            this.importSaveData(data, null);
        } else {
            const usedIds = new Set<string>();
            this._canvas.getFigures().data.forEach((figure: unknown) => {
                if (figure instanceof ComponentFigure) usedIds.add(figure.getId());
            });
            const idMap = new Map<string, string>();
            for (const figureData of data.figures) {
                let nextId = figureData.figureId;
                if (usedIds.has(nextId)) {
                    do {
                        nextId = newFigureId();
                    } while (usedIds.has(nextId));
                }
                idMap.set(figureData.figureId, nextId);
                usedIds.add(nextId);
            }
            this.importSaveData(data, idMap);
        }
        this.getCommandStack().markSaveLocation?.();
    }

    private importSaveData(data: EditorSaveData, idMap: Map<string, string> | null): void {
        const resolveId = (id: string) => idMap?.get(id) ?? id;

        for (const figureData of data.figures) {
            const componentInfo = getComponentById(figureData.componentId);
            if (!componentInfo) continue;
            const figure = new ComponentFigure(componentInfo);
            figure.setId(resolveId(figureData.figureId));
            this._canvas.add(figure.setX(figureData.x).setY(figureData.y));
            if (typeof figureData.rotation === "number" && figureData.rotation !== 0) {
                figure.setRotationAngle(figureData.rotation);
            }
        }

        for (const connectionData of data.connections) {
            const sourceFigure: ComponentFigure = this._canvas.getFigure(resolveId(connectionData.fromFigure));
            const targetFigure: ComponentFigure = this._canvas.getFigure(resolveId(connectionData.targetFigure));
            if (sourceFigure && targetFigure) {
                const sourcePort: Port = sourceFigure.getPortByName(connectionData.fromPortName);
                const targetPort: Port = targetFigure.getPortByName(connectionData.targetPortName);
                if (sourcePort && targetPort) {
                    const con = createWiringConnection();
                    con.setSource(sourcePort);
                    con.setTarget(targetPort);
                    con.setVertices(connectionData.svgPath);
                    markConnectionUserRouted(con);
                    this._canvas.add(con);
                }
            }
        }
    }

    get canvas(): Canvas {
        return this._canvas;
    }

    public zoomIn(): void {
        this._canvas.zoomIn();
    }

    public zoomOut(): void {
        this._canvas.zoomOut();
    }

    public zoomReset(): void {
        this._canvas.zoomReset();
    }

    public zoomToFit(): void {
        this._canvas.zoomToFit();
    }
}
