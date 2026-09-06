/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Progression du chargement catalogue (boot / rebuild par lots).
 *
 * Responsabilités :
 * - Découper le montage pour laisser le navigateur peindre
 * - Callback de progression (`CatalogBootProgress`)
 */
export type CatalogBootPhase = "maps" | "elements" | "mount" | "ready";

export type CatalogBootProgress = {
    phase: CatalogBootPhase;
    /** Unités déjà traitées dans la phase courante (ou global si total global). */
    done: number;
    total: number;
    /** Avancement global 0..1. */
    ratio: number;
};

export type CatalogBootProgressCallback = (progress: CatalogBootProgress) => void;

/** Taille d’un lot DOM / création d’éléments (équilibre fluidité vs durée totale). */
export const CATALOG_BOOT_BATCH_SIZE = 48;

/**
 * Laisse le navigateur peindre entre deux lots de boot catalogue.
 * @returns Promesse résolue au prochain frame d’animation.
 */
export function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

/**
 * Calcule l’avancement global 0..1 du boot catalogue selon la phase courante.
 * @param phase - Phase en cours (`maps`, `elements`, `mount`, `ready`).
 * @param done - Unités déjà traitées dans la phase.
 * @param total - Total d’unités dans la phase.
 * @returns Ratio global pondéré entre 0 et 1.
 */
export function catalogBootRatio(phase: CatalogBootPhase, done: number, total: number): number {
    const safeTotal = Math.max(1, total);
    const local = Math.min(1, Math.max(0, done / safeTotal));
    switch (phase) {
        case "maps":
            return 0.08 * local;
        case "elements":
            return 0.08 + 0.42 * local;
        case "mount":
            return 0.5 + 0.5 * local;
        case "ready":
            return 1;
        default:
            return local;
    }
}

/**
 * Notifie le callback de progression du boot catalogue.
 * @param onProgress - Callback optionnel de progression.
 * @param phase - Phase en cours.
 * @param done - Unités déjà traitées dans la phase.
 * @param total - Total d’unités dans la phase.
 */
export function reportCatalogBoot(
    onProgress: CatalogBootProgressCallback | undefined,
    phase: CatalogBootPhase,
    done: number,
    total: number,
): void {
    onProgress?.({
        phase,
        done,
        total,
        ratio: catalogBootRatio(phase, done, total),
    });
}
