/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Liste les broches d’un composant catalogue (Fritzing / Wokwi / ports live).
 *
 * Responsabilités :
 * - Priorité : métadonnées Fritzing → pinInfo Wokwi → ports de la figure
 * - Instancier brièvement un élément Wokwi pour lire `pinInfo`
 */
import type { ElementPin } from "@wokwi/elements";
import {
    isFritzingComponent,
    isWokwiComponent,
    type CatalogComponentInfo,
    type WokwiClass,
    type WokwiComponent,
} from "../../panels/component";
import type { ComponentFigure } from "../component-figure";
import type { McuPinDescriptor } from "./types";

/**
 * Liste les broches d'un composant catalogue pour l'API MCU.
 * @param component - Entrée catalogue (Fritzing ou Wokwi).
 * @param figure - Instance sur le canvas (repli ports live).
 * @returns Descripteurs `{ pinKey, pinLabel }` ordonnés.
 */
export function listMcuPinDescriptors(
    component: CatalogComponentInfo,
    figure: ComponentFigure,
): McuPinDescriptor[] {
    const fromCatalog = listFromCatalog(component);
    if (fromCatalog.length > 0) return fromCatalog;
    return listFromLivePorts(figure);
}

/** Lit les broches depuis le catalogue (sans regarder le canvas). */
function listFromCatalog(component: CatalogComponentInfo): McuPinDescriptor[] {
    if (isFritzingComponent(component) && component.pins.length > 0) {
        return component.pins.map((pin) => ({
            pinKey: pin.id,
            pinLabel: pin.name || pin.id,
        }));
    }

    if (isWokwiComponent(component)) {
        return listFromWokwiClass(component.clasz);
    }

    return [];
}

/**
 * Instancie un élément Wokwi uniquement pour lire `pinInfo`.
 * Échoue silencieusement si le constructeur plante.
 */
function listFromWokwiClass(clasz: WokwiClass): McuPinDescriptor[] {
    try {
        const element: WokwiComponent = new clasz();
        const pinInfo = (element as { pinInfo?: ElementPin[] }).pinInfo;
        if (!Array.isArray(pinInfo) || pinInfo.length === 0) return [];
        return pinInfo.map((pin) => ({
            pinKey: pin.name,
            pinLabel: pin.name,
        }));
    } catch {
        return [];
    }
}

/** Repli : ports draw2d déjà montés sur la figure. */
function listFromLivePorts(figure: ComponentFigure): McuPinDescriptor[] {
    const result: McuPinDescriptor[] = [];
    for (const port of figure.getHybridPorts()) {
        const key = String(port.getLocator?.()?.portId ?? "");
        if (!key) continue;
        result.push({ pinKey: key, pinLabel: key });
    }
    return result;
}
