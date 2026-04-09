import draw2d from "draw2d";
import { setupDraw2dContextMenu } from "./canvas-context-menu";
import { connectionsPolicy } from "./connections-policies";
import { ComponentFigure } from "./component-figure";
import { wokwiComponentByClass, wokwiComponentById } from "../panels/component";
import { css } from "../utils/dom";
import { ArduinoUnoElement } from "@wokwi/elements";

const DEFAULT_ZOOM = 1;

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
        // Zoom molette + Shift (natif draw2d ; sans Shift le conteneur défile normalement)
        this.installEditPolicy(new draw2d.policy.canvas.WheelZoomPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToGeometryEditPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToInBetweenEditPolicy())
        this.installEditPolicy(new draw2d.policy.canvas.SnapToCenterEditPolicy())
        this.installEditPolicy(connectionsPolicy);

        // Listeners
        this.on("select", (_emitter: any, event: any) => this.onSelectionChange(event.figure));
        this.on("zoom", () => this.onZoomChange());

        this.setZoom(DEFAULT_ZOOM)

        // Add drag and drop event listeners to the canvas
        const htmlElement = this.html[0] ?? this.html;
        htmlElement.addEventListener('dragover', this.dragover_handler.bind(this));
        htmlElement.addEventListener('drop', this.drop_handler.bind(this));

        setupDraw2dContextMenu(this);

        // Add test figures
        let board = new ComponentFigure(wokwiComponentByClass[ArduinoUnoElement.name]);
        this.add(board.setX(200).setY(150))

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
    public dragover_handler(event: DragEvent) {
        event.preventDefault(); // This is crucial to allow dropping
        event.dataTransfer!.dropEffect = "copy";
    }

    // when the draggable object is dropped onto a droppable object
    public drop_handler(event: DragEvent) {
        event.preventDefault();
        const item_data = event.dataTransfer!.getData("text");
        const componentId = parseInt(item_data);
        if (!isNaN(componentId)) {
            const figure = new ComponentFigure(wokwiComponentById[componentId]);
            const htmlElement = document.querySelector('.hackCable-editor');
            const rect = htmlElement!.getBoundingClientRect();
            //fix zoom problem
            const x = (event.clientX - rect.left) * this.getZoom();
            const y = (event.clientY - rect.top) * this.getZoom();
            this.add(figure.setX(x).setY(y));
        }
    }
}