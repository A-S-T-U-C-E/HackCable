import draw2d from "draw2d";
export declare class CoordinatePortLocator extends draw2d.layout.locator.PortLocator {
    readonly portId: string;
    private readonly x;
    private readonly y;
    constructor(portId: string, x: number, y: number);
    relocate(index: any, figure: any): void;
}
