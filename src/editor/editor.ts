import draw2d from "draw2d";
import {Canvas} from "./canvas";
import {ComponentFigure, FigureData, WiringData} from "./component-figure";
import {wokwiComponentById} from "../panels/component";
import {Port} from "draw2d-types";

export declare type EditorSaveData = {figures: FigureData[], connections: WiringData[]}

export class Editor{

    private readonly _canvas;

    constructor() {
        this._canvas = new Canvas('hackCable-canvas');
    }

    public getEditorSaveData(): EditorSaveData{

        let data: EditorSaveData = {figures: [], connections: []};

        this._canvas.getFigures().data.forEach((figure: any) => {
            if(figure instanceof ComponentFigure){
                data.figures.push(figure.getFigureData());
                data.connections.push(...figure.getWiringData())
            }
        });
        return data;
    }
    public loadEditorSaveData(data: EditorSaveData){
        this._canvas.clear()

        // Créer chaque figure
        data.figures.forEach((figureData) => {
            let figure = new ComponentFigure(wokwiComponentById[figureData.componentId]);
            figure.setId(figureData.figureId) // So the connections can find this figure
            this._canvas.add(figure.setX(figureData.x).setY(figureData.y))
            if (typeof figureData.rotation === "number" && figureData.rotation !== 0) {
                figure.setRotationAngle(figureData.rotation)
            }
        })
        // Puis les connexions (Connection + VertexRouter + add sur le canvas)
        data.connections.forEach((connectionData) => {
            const sourceFigure: ComponentFigure = this._canvas.getFigure(connectionData.fromFigure)
            const targetFigure: ComponentFigure = this._canvas.getFigure(connectionData.targetFigure)
            if(sourceFigure && targetFigure){
                const sourcePort: Port = sourceFigure.getPortByName(connectionData.fromPortName)
                const targetPort: Port = targetFigure.getPortByName(connectionData.targetPortName)
                if(sourcePort && targetPort){
                    const con = new draw2d.Connection();
                    con.setRouter(new draw2d.layout.connection.VertexRouter());
                    con.setSource(sourcePort)
                    con.setTarget(targetPort)
                    con.setVertices(connectionData.svgPath)
                    this._canvas.add(con)
                }
            }
        })
    }

    get canvas(){
        return this._canvas;
    }
}