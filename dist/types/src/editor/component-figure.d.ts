import draw2d from "draw2d";
import { WokwiComponentInfo } from "../panels/component";
import { Port } from "draw2d-types";
export declare type FigureData = {
    componentId: number;
    figureId: string;
    x: number;
    y: number;
};
export declare type WiringData = {
    svgPath: string;
    fromFigure: string;
    fromPortName: string;
    targetFigure: string;
    targetPortName: string;
};
export declare class ComponentFigure extends draw2d.shape.basic.Rectangle {
    private readonly component;
    constructor(component: WokwiComponentInfo);
    onSelected(): void;
    onUnselected(): void;
    toFront(): void;
    getPortByName(name: string): Port;
    getFigureData(): FigureData;
    getWiringData(): WiringData[];
}
