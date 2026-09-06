/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Persistance locale du catalogue Fritzing (localStorage + migration).
 *
 * Responsabilités :
 * - Charger / sauver le store JSON
 * - Migrer catégories et URLs SVG si algo obsolète
 */
import { resolveFritzingCategory, type FritzingCategoryMaps } from "./fritzing-categories";
import type { FritzingCatalogStore, FritzingComponentInfo } from "./fritzing-types";
import { FRITZING_CATEGORY_ALGO_VERSION, FRITZING_SVG_URL_ALGO_VERSION } from "./fritzing-types";
import { resolveBreadboardSvgUrl } from "./fritzing-github";

const STORAGE_KEY = "hackCable-fritzing-catalog";

/**
 * Charge le catalogue Fritzing persisté dans localStorage.
 * @returns Store parsé, ou `null` si absent ou invalide.
 */
export function loadFritzingCatalog(): FritzingCatalogStore | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as FritzingCatalogStore;
    } catch {
        return null;
    }
}

/**
 * Persiste le catalogue Fritzing dans localStorage.
 * @param store - Store complet à sérialiser.
 */
export function saveFritzingCatalog(store: FritzingCatalogStore): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Retourne les pièces Fritzing stockées, avec migrations si algo obsolète.
 * @returns Liste des composants Fritzing prêts pour le catalogue.
 */
export function getStoredFritzingComponents(): FritzingComponentInfo[] {
    const store = loadFritzingCatalog();
    const parts = store?.parts ?? [];
    const recategorize = (store?.categoryAlgoVersion ?? 0) < FRITZING_CATEGORY_ALGO_VERSION;
    const refreshSvgUrls = (store?.svgUrlAlgoVersion ?? 0) < FRITZING_SVG_URL_ALGO_VERSION;
    return parts.map((part) => migrateFritzingPart(part, recategorize, refreshSvgUrls));
}

function migrateBreadboardSvgUrl(part: FritzingComponentInfo): string {
    if (part.breadboardImagePath) {
        return resolveBreadboardSvgUrl(part.breadboardImagePath);
    }
    const fixed = part.breadboardSvgUrl.replace(
        "/svg/core/breadboard/icon/",
        "/svg/core/icon/",
    );
    if (fixed !== part.breadboardSvgUrl) return fixed;
    return part.breadboardSvgUrl;
}

function migrateFritzingPart(
    part: FritzingComponentInfo & { type?: number },
    recategorize = false,
    refreshSvgUrls = false,
): FritzingComponentInfo {
    const physicalWidthInches = part.physicalWidthInches ?? part.viewBoxWidth / 90;
    const physicalHeightInches = part.physicalHeightInches ?? part.viewBoxHeight / 90;
    const migrated: FritzingComponentInfo = {
        ...part,
        physicalWidthInches,
        physicalHeightInches,
    };

    if (part.category && !recategorize && !refreshSvgUrls) return migrated;

    const next: FritzingComponentInfo = refreshSvgUrls
        ? { ...migrated, breadboardSvgUrl: migrateBreadboardSvgUrl(migrated) }
        : migrated;

    if (part.category && !recategorize) return next;

    const legacy = part as FritzingComponentInfo & { type?: number };
    const maps: FritzingCategoryMaps = {
        moduleToCategory: new Map(),
        familyToCategory: new Map(),
        fzpFileToCategory: new Map(),
    };
    return {
        ...next,
        category: resolveFritzingCategory({
            moduleId: legacy.moduleId,
            family: legacy.family,
            tags: [],
            title: legacy.name,
            fzpPath: legacy.fzpPath,
        }, maps),
    };
}
