import { ComponentFigure } from "../editor/component-figure";
import { ComponentElement, ComponentType, wokwiComponents, wokwiComponentByClass } from "./component";

export class Catalog {

    readonly elements: ComponentElement[] = []
    private readonly catalog;
    private readonly sorter: HTMLSelectElement | undefined;
    private readonly hackCable: any;
    constructor(hackCable: any) {
        this.hackCable = hackCable;

        this.elements = wokwiComponents.filter((c) => c.type != ComponentType.CARD).map((c) => {
            return new ComponentElement(c);
        });

        const root = document.querySelector(".hackCable-catalog-list")
        if (root instanceof HTMLDivElement) {
            this.catalog = root;

            const sorter = document.querySelector(".hackCable-catalog-sorter")
            if (sorter instanceof HTMLSelectElement) {
                this.sorter = sorter;
                this.build();
            } else console.error("[HackCable] Unable to find element .hackCable-catalog-sorter")
        } else console.error("[HackCable] Unable to find element .hackCable-catalog-list")
    }


    build() {

        // Actions
        if (this.sorter) {
            this.sorter.innerHTML = "<option value=\"-1\">Tout afficher</option>\n" +
                "<option value=" + ComponentType.LED + ">LED</option>\n" +
                "<option value=" + ComponentType.MOTOR + ">Moteur</option>\n" +
                "<option value=" + ComponentType.TRANSMITTER + ">Émmeteur</option>\n" +
                "<option value=" + ComponentType.BUTTON + ">Bouton</option>\n" +
                "<option value=" + ComponentType.SENSOR + ">Capteur</option>\n" +
                "<option value=" + ComponentType.OTHER + ">Autre</option>\n";

            this.sorter.addEventListener("change", (e) => {
                console.log(e)
                this.updateCatalogList()
            })
        }
        this.updateCatalogList()
    }

    updateCatalogList() {

        if (this.catalog) this.catalog.innerHTML = ""

        let filterType: number = -1
        if (this.sorter) {
            filterType = parseInt(this.sorter.value, 10)
        }

        this.elements.filter((e) => {
            return ComponentType[e.type] == ComponentType[filterType] || filterType == -1
        }).forEach((e) => {
            //console.log(e.pinInfo)

            const div = document.createElement('div');
            div.setAttribute("class", "hackCable-catalog-element")
            div.setAttribute("title", e.description)
            div.setAttribute("draggable", "true")
            div.setAttribute("dragstart", "dragstart_handler(event: DragEvent);")
            div.setAttribute("dragover", "dragover_handler(event: DragEvent);")
            div.setAttribute("dragend", "drop_handler(event: DragEvent);")
            div.innerHTML = "<h3>" + e.name + "</h3>";
            this.catalog?.appendChild(div);

            setTimeout(() => {
                const svg = e.wokwiComponent.shadowRoot?.querySelector("svg");
                if (svg) {
                    svg.setAttribute("style", "max-width: 100%; height: auto")
                    svg.setAttribute("id", e.description)
                    svg.addEventListener('click', () => {
                        const componentInfo = wokwiComponentByClass[e.wokwiComponent.constructor.name];
                        const element = new ComponentFigure(componentInfo);
                        // Add the component to the canvas at a default position
                        this.hackCable.editor.canvas.add(element.setX(100).setY(100));
                    })
                }
            })
            div.appendChild(e.wokwiComponent);
        })
    }
}