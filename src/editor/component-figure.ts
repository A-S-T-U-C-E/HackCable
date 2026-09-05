/**
 * @file Figure draw2d pour un composant catalogue (overlay Wokwi ou SVG Fritzing).
 */
import draw2d from "draw2d";
import type { ElementPin } from "@wokwi/elements";
import type { CatalogComponentInfo, WokwiComponent, WokwiComponentInfo } from "../panels/component";
import { isWokwiComponent } from "../panels/component";
import type { FritzingComponentInfo } from "../panels/fritzing-types";
import {
    applySvgDisplaySize,
    buildConnectorRefs,
    extractConnectorPins,
    resolveSvgPhysicalInches,
} from "../panels/fritzing-svg";
import {
    CoordinatePortLocator,
    PercentPortLocator,
    fritzingDisplaySizeFromInches,
    fritzingPortDiameter,
} from "./coordinate-port-locator";
import { css, unitToPx } from "../utils/dom";
import type { Port } from "draw2d-types";

export type FigureData = {
    componentId: number;
    figureId: string;
    x: number;
    y: number;
    rotation?: number;
};

export type WiringData = {
    svgPath: string;
    fromFigure: string;
    fromPortName: string;
    targetFigure: string;
    targetPortName: string;
};

/** Pastille draw2d avec API étendue non couverte par draw2d-types. */
type HybridDraw2dPort = Port & {
    setAlpha(alpha: number): void;
    setDiameter(diameter: number): void;
    setCoronaWidth(width: number): void;
    setVisible(visible: boolean): void;
    getDiameter?: () => number;
    getWidth?: () => number;
    on(event: "connect" | "disconnect", handler: () => void): void;
};

/**
 * Corona draw2d = marge ajoutée autour du diamètre pour le hitTest
 * (zone cliquable = diameter + 2×corona). Défaut draw2d = 5.
 * Trop de corona → impossible de saisir le composant.
 */
function coronaForDiameter(diameter: number): number {
    return Math.max(3, Math.min(5, Math.round(diameter * 0.55)));
}

/** Configure l'apparence et le comportement d'une pastille de connexion hybride. */
function wireHybridPort(port: HybridDraw2dPort, diameter: number, alpha = 0.8): void {
    port.setAlpha(alpha);
    port.setBackgroundColor("#424B5A");
    port.setDiameter(diameter);
    port.setCoronaWidth(coronaForDiameter(diameter));
    port.on("connect", () => port.setVisible(false));
    port.on("disconnect", () => port.setVisible(true));
}

/**
 * Recale diamètre/corona selon la taille du composant et le zoom.
 * Priorité : laisser le corps du composant saisissable ; pastilles petites sur les bords.
 */
export function syncFigurePortHitTargets(figure: ComponentFigure, zoomFactor: number): void {
    const zoom = Math.max(0.01, zoomFactor);
    const figureSize = Math.min(
        Math.max(1, figure.getWidth?.() ?? 1),
        Math.max(1, figure.getHeight?.() ?? 1),
    );
    const ports = (figure.getPorts?.().data ?? []) as HybridDraw2dPort[];
    if (ports.length === 0) return;

    // Diamètre logique : petit, et encore plus discret si beaucoup de ports / petite pièce.
    const baseDiameter = fritzingPortDiameter(figureSize, figureSize);
    const diameter = Math.max(4, Math.min(baseDiameter, Math.floor(figureSize / Math.max(3, ports.length))));

    // Zone hit max ~30 % du côté : le centre reste draggable.
    const maxHitSpan = figureSize * 0.3;
    for (const port of ports) {
        if (typeof port.setDiameter === "function") {
            port.setDiameter(diameter);
        }
        if (typeof port.setCoronaWidth !== "function") continue;
        // Légère compensation au dézoom, mais hit total plafonné.
        const desiredCorona = coronaForDiameter(diameter) * Math.min(1.35, Math.max(1, Math.sqrt(zoom)));
        const maxCorona = Math.max(2, (maxHitSpan - diameter) / 2);
        port.setCoronaWidth(Math.max(2, Math.min(desiredCorona, maxCorona)));
    }
}

export class ComponentFigure extends draw2d.shape.basic.Rectangle {
    private readonly component: CatalogComponentInfo;
    private readonly overlay: HTMLElement;
    private fritzingSvgLoading = false;

    constructor(component: CatalogComponentInfo) {
        super();
        this.component = component;

        this.setBackgroundColor(new draw2d.util.Color(0, 0, 0, 0.01));
        this.setColor(null);
        this.setStroke(0);
        this.setResizeable(false);
        this.setDraggable(true);
        this.installEditPolicy(new draw2d.policy.figure.AntSelectionFeedbackPolicy());

        this.overlay = isWokwiComponent(component)
            ? this.createWokwiOverlay(component)
            : this.createFritzingOverlay(component);

        this.on("added", (_emitter: unknown, event: { canvas: { overlayContainer: HTMLElement; getZoom?: () => number } }) => {
            event.canvas.overlayContainer.append(this.overlay);
            if (isWokwiComponent(this.component)) {
                setTimeout(() => this.syncOverlaySize());
            } else {
                this.syncOverlayLayout();
            }
            const zoom = typeof event.canvas.getZoom === "function" ? event.canvas.getZoom() : 1;
            syncFigurePortHitTargets(this, zoom);
        });

        this.on("removed", () => this.overlay.remove());
        this.on("move", (_emitter: unknown, event: { x: number; y: number }) => {
            this.syncOverlayLayout(event.x, event.y);
        });
        this.on("click", () => this.toFront());
    }

    private createWokwiOverlay(component: WokwiComponentInfo): HTMLElement {
        const element: WokwiComponent = new component.clasz();
        css(element, { pointerEvents: "none" });
        for (const pinInfo of element.pinInfo as ElementPin[]) {
            const port = this.createPort(
                "hybrid",
                new CoordinatePortLocator(pinInfo.name, pinInfo.x, pinInfo.y),
            );
            wireHybridPort(port as HybridDraw2dPort, 6, 0.8);
        }
        return element;
    }

    private createFritzingOverlay(component: FritzingComponentInfo): HTMLElement {
        const wrapper = document.createElement("div");
        wrapper.className = "hackCable-fritzing-overlay";

        const { width, height } = fritzingDisplaySizeFromInches(
            component.physicalWidthInches,
            component.physicalHeightInches,
        );
        this.setWidth(width);
        this.setHeight(height);
        css(wrapper, { width, height });

        void this.loadFritzingSvg(component, wrapper);
        return wrapper;
    }

    private createFritzingPort(pin: { id: string; x: number; y: number }): void {
        const port = this.createPort("hybrid", new PercentPortLocator(pin.id, pin.x, pin.y));
        wireHybridPort(port as HybridDraw2dPort, fritzingPortDiameter(this.getWidth(), this.getHeight()));
    }

    private clearFritzingPorts(): void {
        for (const port of [...this.hybridPorts.data] as Port[]) {
            this.removePort(port);
        }
    }

    private applyFritzingGeometry(
        component: FritzingComponentInfo,
        wrapper: HTMLElement,
        svgText: string,
    ): void {
        const { pins } = extractConnectorPins(svgText, buildConnectorRefs(component.pins));
        const physical = resolveSvgPhysicalInches(svgText);
        const { width, height } = fritzingDisplaySizeFromInches(
            physical.widthInches,
            physical.heightInches,
        );

        wrapper.innerHTML = svgText;
        const svg = wrapper.querySelector("svg");
        if (!(svg instanceof SVGSVGElement)) return;

        applySvgDisplaySize(svg, width, height);
        this.setWidth(width);
        this.setHeight(height);
        css(wrapper, { width, height });

        this.clearFritzingPorts();
        for (const pin of pins) this.createFritzingPort(pin);

        this.relocatePorts();
        this.syncOverlayLayout();
        const canvas = this.getCanvas?.();
        const zoom = canvas && typeof canvas.getZoom === "function" ? canvas.getZoom() : 1;
        syncFigurePortHitTargets(this, zoom);
    }

    private async loadFritzingSvg(component: FritzingComponentInfo, wrapper: HTMLElement): Promise<void> {
        if (this.fritzingSvgLoading) return;
        this.fritzingSvgLoading = true;

        try {
            const response = await fetch(component.breadboardSvgUrl);
            if (!response.ok) return;
            const svgText = await response.text();
            this.applyFritzingGeometry(component, wrapper, svgText);
        } catch (error) {
            console.error("[HackCable] Impossible de charger la géométrie Fritzing", error);
        } finally {
            this.fritzingSvgLoading = false;
        }
    }

    private relocatePorts(): void {
        if (this.getWidth() <= 0 || this.getHeight() <= 0) return;
        const self = this as unknown as { portRelayoutRequired: boolean; layoutPorts: () => void };
        self.portRelayoutRequired = true;
        self.layoutPorts();
    }

    private syncOverlaySize(): void {
        if (!isWokwiComponent(this.component)) return;

        const svg = this.overlay.shadowRoot?.querySelector("svg");
        if (!svg) return;

        const viewBox = svg.getAttribute("viewBox");
        let width: number;
        let height: number;
        if (viewBox) {
            const parts = viewBox.trim().split(/[\s,]+/).map(Number);
            width = parts[2] ?? unitToPx(svg.getAttribute("width"));
            height = parts[3] ?? unitToPx(svg.getAttribute("height"));
        } else {
            width = unitToPx(svg.getAttribute("width"));
            height = unitToPx(svg.getAttribute("height"));
        }

        this.setWidth(width);
        this.setHeight(height);
        css(this.overlay, { width, height });
        this.relocatePorts();
        this.syncOverlayLayout();
    }

    public onSelected(): void {
        this.toFront();
    }

    public onUnselected(): void {
        // Réservé pour un futur surlignage de sélection.
    }

    public toFront(): void {
        super.toFront();
        this.getCanvas().overlayContainer.append(this.overlay);
    }

    public getPortByName(name: string): Port {
        return this.hybridPorts.data.find((port: Port) => port.getLocator().portId === name);
    }

    /**
     * draw2d garde un AABB non tourné pour getBoundingBox ; le SVG / overlay
     * tournent autour du centre (+ scale 90/270). Sans ceci, les clics ratent
     * le composant et la policy de pan croit que le workspace est vide.
     */
    public hitTest(x: number, y: number, corona?: number): boolean {
        const angle = ((Number(this.getRotationAngle()) || 0) % 360 + 360) % 360;
        if (angle === 0) {
            return super.hitTest(x, y, corona);
        }

        const w = this.getWidth();
        const h = this.getHeight();
        if (w <= 0 || h <= 0) return false;

        const cx = this.getAbsoluteX() + w / 2;
        const cy = this.getAbsoluteY() + h / 2;
        let lx = x - cx;
        let ly = y - cy;

        // Inverse du scale draw2d appliqué après rotation à 90/270.
        if (angle === 90 || angle === 270) {
            const ratio = h / w;
            if (ratio > 0 && Number.isFinite(ratio)) {
                lx /= ratio;
                ly *= ratio;
            }
        }

        const rad = (-angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = lx * cos - ly * sin;
        const ry = lx * sin + ly * cos;
        const pad = typeof corona === "number" ? corona : 0;

        return Math.abs(rx) <= w / 2 + pad && Math.abs(ry) <= h / 2 + pad;
    }

    public syncOverlayLayout(canvasX?: number, canvasY?: number): void {
        const top = canvasY ?? this.getY();
        const left = canvasX ?? this.getX();
        const angle = ((Number(this.getRotationAngle()) || 0) % 360 + 360) % 360;
        const w = this.getWidth();
        const h = this.getHeight();

        // Même convention que draw2d.Rectangle.applyTransformation / PortLocator.
        let transform = angle === 0 ? "none" : `rotate(${angle}deg)`;
        if (angle === 90 || angle === 270) {
            const ratio = h / Math.max(w, 0.0001);
            transform = `rotate(${angle}deg) scale(${ratio}, ${1 / ratio})`;
        }

        css(this.overlay, {
            top,
            left,
            width: w,
            height: h,
            transform,
            transformOrigin: "center center",
        });
    }

    public rotateByDegrees(delta: number): void {
        const cur = Number(this.getRotationAngle()) || 0;
        const next = ((cur + delta) % 360 + 360) % 360;
        this.setRotationAngle(next);
        this.relocatePorts();
        this.syncOverlayLayout();
        const canvas = this.getCanvas?.();
        const zoom = canvas && typeof canvas.getZoom === "function" ? canvas.getZoom() : 1;
        syncFigurePortHitTargets(this, zoom);
    }

    public getFigureData(): FigureData {
        const angle = Number(this.getRotationAngle()) || 0;
        return {
            componentId: this.component.id,
            figureId: this.getId(),
            x: this.getX(),
            y: this.getY(),
            ...(angle !== 0 ? { rotation: angle } : {}),
        };
    }

    public getWiringData(): WiringData[] {
        const wiringData: WiringData[] = [];

        for (const sourcePort of this.hybridPorts.data as Port[]) {
            for (const connection of sourcePort.getConnections().data) {
                if (connection.sourcePort !== sourcePort) continue;
                wiringData.push({
                    svgPath: connection.getVertices().data,
                    fromFigure: this.getId(),
                    fromPortName: sourcePort.getLocator().portId,
                    targetFigure: connection.getTarget().getParent().getId(),
                    targetPortName: connection.getTarget().getLocator().portId,
                });
            }
        }

        return wiringData;
    }
}
