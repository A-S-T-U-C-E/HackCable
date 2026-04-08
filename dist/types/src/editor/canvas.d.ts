import draw2d from "draw2d";
export declare class Canvas extends draw2d.Canvas {
    private selected;
    constructor(divId: string);
    private onZoomChange;
    private onSelectionChange;
    clear(): void;
    dragstart_handler(event: DragEvent): void;
    dragover_handler(event: DragEvent): void;
    drop_handler(event: DragEvent): void;
}
