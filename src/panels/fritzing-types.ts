/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Types et constantes du catalogue Fritzing (broches, sync, stockage).
 *
 * Responsabilités :
 * - Modèle `FritzingComponentInfo` / store localStorage
 * - Versions d’algo (pins, catégories, URLs SVG)
 */
import type { FritzingCategory } from "./fritzing-categories";

export const FRITZING_ID_OFFSET = 10000;
/** Incrémenter pour forcer le recalcul des positions de broches au prochain sync. */
export const FRITZING_PINS_ALGO_VERSION = 4;
/** Incrémenter pour forcer le recalcul des catégories au prochain sync. */
export const FRITZING_CATEGORY_ALGO_VERSION = 2;
/** Incrémenter pour forcer la résolution des URLs de vignettes au prochain sync. */
export const FRITZING_SVG_URL_ALGO_VERSION = 1;

export interface FritzingPin {
    id: string;
    name: string;
    svgId?: string;
    /** Position horizontale en % de la largeur du composant (0–100). */
    x: number;
    /** Position verticale en % de la hauteur du composant (0–100). */
    y: number;
}

export interface FritzingComponentInfo {
    id: number;
    source: "fritzing";
    moduleId: string;
    name: string;
    description: string;
    category: FritzingCategory;
    family?: string;
    fzpPath: string;
    fzpSha: string;
    breadboardSvgUrl: string;
    /** Chemin `image` du FZP (breadboardView), pour migration des URLs. */
    breadboardImagePath?: string;
    /** Largeur physique réelle du SVG breadboard (pouces). */
    physicalWidthInches: number;
    /** Hauteur physique réelle du SVG breadboard (pouces). */
    physicalHeightInches: number;
    viewBoxWidth: number;
    viewBoxHeight: number;
    pins: FritzingPin[];
}

export interface FritzingCatalogStore {
    repoSha: string;
    syncedAt: string;
    pinsAlgoVersion?: number;
    categoryAlgoVersion?: number;
    svgUrlAlgoVersion?: number;
    parts: FritzingComponentInfo[];
}

export interface FritzingSyncProgress {
    phase: "index" | "integrate";
    done: number;
    total: number;
}

export interface FritzingSyncResult {
    upToDate: boolean;
    added: number;
    updated: number;
    removed: number;
    total: number;
    repoSha: string;
}
