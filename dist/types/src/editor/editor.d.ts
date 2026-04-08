import { Canvas } from "./canvas";
import { FigureData, WiringData } from "./component-figure";
export declare type EditorSaveData = {
    figures: FigureData[];
    connections: WiringData[];
};
export declare class Editor {
    private readonly _canvas;
    constructor();
    getEditorSaveData(): EditorSaveData;
    loadEditorSaveData(data: EditorSaveData): void;
    get canvas(): Canvas;
}
