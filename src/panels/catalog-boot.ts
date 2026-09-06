/**
 * @file Progression du chargement catalogue (boot / rebuild par lots).
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

/** Laisse le navigateur peindre / traiter les events entre deux lots. */
export function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

/**
 * Pondération des phases : maps ~8 %, création éléments ~42 %, montage DOM ~50 %.
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
