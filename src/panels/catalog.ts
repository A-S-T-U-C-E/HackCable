import i18next from "i18next";
import { ComponentFigure } from "../editor/component-figure";
import { ComponentElement, ComponentType, wokwiComponents, wokwiComponentByClass } from "./component";

export class Catalog {

    elements: ComponentElement[] = []
    private readonly catalog;
    private readonly sorter: HTMLSelectElement | undefined;
    private readonly hackCable: any;
    constructor(hackCable: any) {
        this.hackCable = hackCable;

        this.elements = wokwiComponents().filter((c) => c.type != ComponentType.CARD).map((c) => {
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


    private fillSorterOptions(): void {
        if (!this.sorter) return;
        const prevValue = this.sorter.value;
        const t = (k: string) => i18next.t(k, { ns: "common" });
        this.sorter.innerHTML =
            `<option value="-1">${t("catalog.filterAll")}</option>` +
            `<option value="${ComponentType.LED}">${t("catalog.typeLed")}</option>` +
            `<option value="${ComponentType.MOTOR}">${t("catalog.typeMotor")}</option>` +
            `<option value="${ComponentType.TRANSMITTER}">${t("catalog.typeTransmitter")}</option>` +
            `<option value="${ComponentType.BUTTON}">${t("catalog.typeButton")}</option>` +
            `<option value="${ComponentType.SENSOR}">${t("catalog.typeSensor")}</option>` +
            `<option value="${ComponentType.OTHER}">${t("catalog.typeOther")}</option>`;
        const hasPrev = [...this.sorter.options].some((o) => o.value === prevValue);
        if (hasPrev) this.sorter.value = prevValue;
    }

    build() {
        if (this.sorter) {
            this.fillSorterOptions();
            this.sorter.addEventListener("change", () => {
                this.updateCatalogList();
            });
        }
        this.updateCatalogList();
    }

    /** Après changement de langue i18n (sans recharger la page). */
    rebuildFromLocale(): void {
        this.elements = wokwiComponents().filter((c) => c.type != ComponentType.CARD).map((c) => {
            return new ComponentElement(c);
        });
        this.fillSorterOptions();
        this.updateCatalogList();
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
            div.innerHTML = "<h3>" + e.name + "</h3>";
            this.catalog?.appendChild(div);

            // Rendre le composant Wokwi lui-même draggable
            const wokwiElement = e.wokwiComponent;
            wokwiElement.setAttribute("draggable", "true");
            wokwiElement.setAttribute("data-component-id", String(e.componentId));
            
            // Gestion du drag and drop sur le composant Wokwi
            wokwiElement.addEventListener('dragstart', (event) => {
                event.dataTransfer?.setData("text/plain", String(e.componentId));
            });

            // Double clic sur le composant Wokwi
            wokwiElement.addEventListener('dblclick', () => {
                const componentInfo = wokwiComponentByClass[e.wokwiComponent.constructor.name];
                const element = new ComponentFigure(componentInfo);
                this.hackCable.editor.canvas.add(element.setX(100).setY(100));
            });

            div.appendChild(e.wokwiComponent);
        })
    }
}