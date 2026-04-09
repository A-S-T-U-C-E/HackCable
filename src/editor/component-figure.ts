import draw2d from "draw2d";
import {ElementPin} from "@wokwi/elements";
import {WokwiComponent, WokwiComponentInfo} from "../panels/component";
import {CoordinatePortLocator} from "./coordinate-port-locator";
import {css, unitToPx} from "../utils/dom";
import {Port} from "draw2d-types";

export declare type FigureData = {componentId: number, figureId: string, x: number, y: number, rotation?: number}
export declare type WiringData = {svgPath: string, fromFigure: string, fromPortName: string, targetFigure: string, targetPortName: string}

export class ComponentFigure extends draw2d.shape.basic.Rectangle{

    private readonly component: WokwiComponentInfo;
    constructor(component: WokwiComponentInfo){
        super();
        this.component = component;

        this.setBackgroundColor(null)
        this.setColor(null)
        this.setResizeable(false)
        this.installEditPolicy(new draw2d.policy.figure.AntSelectionFeedbackPolicy());

        // Load wokwi component into overlay
        let element: WokwiComponent = new component.clasz();
        this.overlay = element;

        element.pinInfo.forEach((pinInfo: ElementPin) => {
            let port = this.createPort("hybrid", new CoordinatePortLocator(pinInfo.name, pinInfo.x, pinInfo.y));
            port.setAlpha(.7)
            port.setBackgroundColor('#424B5A')
            port.setDiameter(7)
            port.on("connect", () => port.setVisible(false));
            port.on("disconnect", () => port.setVisible(true));
        })


        // Listeners
        this.on("added", (_emitter: any, event: any) => {
            event.canvas.overlayContainer.append(this.overlay)

            setTimeout(() => {
                let svg = this.overlay.shadowRoot?.querySelector("svg")
                this.setWidth(unitToPx(svg.getAttribute('width')))
                this.setHeight(unitToPx(svg.getAttribute('height')))
                this.syncOverlayLayout()
            })
        })
        this.on("removed", (_emitter: any, _event: any) => {
            this.overlay.remove()
        })
        this.on("move", (_emitter: any, event: any) => {
            this.syncOverlayLayout(event.x, event.y)
        })
        this.on("click", (_emitter: any, _event: any) => {
            this.toFront()
        })
    }

    public onSelected(){
        this.toFront()
    }
    public onUnselected(){

    }
    public toFront(){
        super.toFront()
        this.getCanvas().overlayContainer.append(this.overlay)
    }

    public getPortByName(name: string): Port{
        return this.hybridPorts.data.find((port: Port) => { // Iterate through ports
            return port.getLocator().portId === name;
        })
    }

    /** Aligne l’overlay DOM (Wokwi) sur la position et la rotation draw2d. */
    public syncOverlayLayout(canvasX?: number, canvasY?: number): void {
        const top = canvasY ?? this.getY()
        const left = canvasX ?? this.getX()
        const angle = Number(this.getRotationAngle()) || 0
        css(this.overlay, {
            top,
            left,
            transform: `rotate(${angle}deg)`,
            transformOrigin: "center center",
        })
    }

    public rotateByDegrees(delta: number): void {
        const cur = Number(this.getRotationAngle()) || 0
        const next = ((cur + delta) % 360 + 360) % 360
        this.setRotationAngle(next)
        this.syncOverlayLayout()
    }

    public getFigureData(): FigureData{
        const angle = Number(this.getRotationAngle()) || 0
        return {
            componentId: this.component.id,
            figureId: this.getId(),
            x: this.getX(),
            y: this.getY(),
            ...(angle !== 0 ? {rotation: angle} : {}),
        }
    }
    public getWiringData(): WiringData[]{

        let wiringData: WiringData[] = [];

        this.hybridPorts.data.forEach((sourcePort: Port) => { // Iterate through ports
            sourcePort.getConnections().data.forEach((connection: any) => { // Iterate through connections of this port
                if(connection.sourcePort === sourcePort){ // Save connections only from theirs source port
                    wiringData.push({
                        svgPath: connection.getVertices().data,
                        fromFigure: this.getId(),
                        fromPortName: sourcePort.getLocator().portId,
                        targetFigure: connection.getTarget().getParent().getId(),
                        targetPortName: connection.getTarget().getLocator().portId
                    });
                }
            })
        })
        return wiringData;
    }
}
