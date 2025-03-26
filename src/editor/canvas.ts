import draw2d from "draw2d";
import { connectionsPolicy } from "./connections-policies";
//import {CoordinatePortLocator} from "./coordinate-port-locator";
import { ComponentFigure } from "./component-figure";
import { wokwiComponentById } from "../panels/component";
//import { ArduinoUnoElement, Dht22Element, NeoPixelElement } from "@wokwi/elements";
import { css } from "../utils/dom";

const DEFAULT_ZOOM = .6;

export class Canvas extends draw2d.Canvas {

    private selected: any = null;

    constructor(divId: string) {
        super(divId);

        // Overlay
        this.overlayContainer = document.querySelector('.hackCable-canvas-overlay-container');
        this.html.prepend(this.overlayContainer);

        this.setScrollArea(document.querySelector('.hackCable-canvas'))

        // Edit policies
        this.installEditPolicy(new draw2d.policy.canvas.PanningSelectionPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToGeometryEditPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToInBetweenEditPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToCenterEditPolicy())
        this.installEditPolicy(connectionsPolicy);

        // Listeners
        this.on("select", (_emitter: any, event: any) => this.onSelectionChange(event.figure));
        this.on("zoom", () => this.onZoomChange());
        /*this.on("figure:add", () => {});*/

        this.setZoom(DEFAULT_ZOOM)

        // Add test figures
        /*let board = new ComponentFigure(wokwiComponentByClass[ArduinoUnoElement.name]);
        this.add(board.setX(200).setY(150))
        let pixel = new ComponentFigure(wokwiComponentByClass[NeoPixelElement.name]);
        this.add(pixel.setX(200).setY(50))
        let dht22 = new ComponentFigure(wokwiComponentByClass[Dht22Element.name]);
        this.add(dht22.setX(250).setY(10))*/

    }
    private onZoomChange() {
        css(this.overlayContainer, { transform: 'scale(' + 1 / this.getZoom() + ')' })
    }
    private onSelectionChange(selected: any) {
        if (this.selected != selected) {
            if (this.selected instanceof ComponentFigure) this.selected.onUnselected()
            if (selected instanceof ComponentFigure) selected.onSelected();
            this.selected = selected;
        }
    }
    public clear() {
        super.clear()
        this.setZoom(DEFAULT_ZOOM)
    }
    public dragstart_handler(event: DragEvent) {
        const target = event.target as HTMLElement;  
        if (!target.dataset?.id) {
            console.error('Le dataset id est inexistant');
        }
        event.dataTransfer!.setData("text/plain", String(target.dataset.id));
        console.log(event.dataTransfer!.getData("text"))
    }

    // while the object is being dragged
    public dragover_handler(_event: DragEvent) {
    }

    // when the draggable object is dropped onto a droppable object
    public drop_handler(event: DragEvent) {
        event.preventDefault();
        const item_data = event.dataTransfer!.getData("text");
        const componentId = parseInt(item_data);
        if (!isNaN(componentId)) {
            const figure = new ComponentFigure(wokwiComponentById[componentId]);
            const rect = this.html.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.add(figure.setX(x).setY(y));
        }

    }
}