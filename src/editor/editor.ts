/**
 * @file Éditeur de schéma : sérialisation, chargement et pile undo/redo draw2d.
 */
import draw2d from "draw2d";
import { Canvas } from "./canvas";
import { ComponentFigure } from "./component-figure";
import type { FigureData, WiringData } from "./component-figure";
import { getComponentById } from "../panels/component";
import type { Port } from "draw2d-types";

export type EditorSaveData = { figures: FigureData[]; connections: WiringData[] };

interface Draw2dCommandStack {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
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

    public loadEditorSaveData(data: EditorSaveData): void {
        this._canvas.clear();

        for (const figureData of data.figures) {
            const componentInfo = getComponentById(figureData.componentId);
            if (!componentInfo) continue;
            const figure = new ComponentFigure(componentInfo);
            figure.setId(figureData.figureId);
            this._canvas.add(figure.setX(figureData.x).setY(figureData.y));
            if (typeof figureData.rotation === "number" && figureData.rotation !== 0) {
                figure.setRotationAngle(figureData.rotation);
            }
        }

        for (const connectionData of data.connections) {
            const sourceFigure: ComponentFigure = this._canvas.getFigure(connectionData.fromFigure);
            const targetFigure: ComponentFigure = this._canvas.getFigure(connectionData.targetFigure);
            if (sourceFigure && targetFigure) {
                const sourcePort: Port = sourceFigure.getPortByName(connectionData.fromPortName);
                const targetPort: Port = targetFigure.getPortByName(connectionData.targetPortName);
                if (sourcePort && targetPort) {
                    const con = new draw2d.Connection();
                    con.setRouter(new draw2d.layout.connection.VertexRouter());
                    con.setSource(sourcePort);
                    con.setTarget(targetPort);
                    con.setVertices(connectionData.svgPath);
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
