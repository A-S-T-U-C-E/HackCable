/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Overlay de progression au démarrage (chargement catalogue par lots).
 *
 * Responsabilités :
 * - Afficher phases boot (éléments / montage / prêt)
 * - Masquer l’overlay une fois le catalogue prêt
 */
import i18next from "i18next";
import type { CatalogBootProgress } from "../src/panels/catalog-boot";

export type BootProgressHandle = {
    update: (progress: CatalogBootProgress) => void;
    close: () => void;
};

/**
 * Retourne le libellé i18n d’une phase de chargement du catalogue.
 * @param phase - Identifiant de phase (`maps`, `elements`, `mount`, `ready`).
 * @returns Libellé traduit pour la phase.
 */
function phaseLabel(phase: CatalogBootProgress["phase"]): string {
    const t = (key: string) => i18next.t(key, { ns: "common" });
    switch (phase) {
        case "maps":
            return t("web.bootPhaseMaps");
        case "elements":
            return t("web.bootPhaseElements");
        case "mount":
            return t("web.bootPhaseMount");
        case "ready":
            return t("web.bootPhaseReady");
        default:
            return t("web.bootLoading");
    }
}

/**
 * Affiche une barre de progression de démarrage sur le document.
 * @param host - Conteneur DOM recevant l’overlay (défaut : `document.body`).
 * @returns Poignée `{ update, close }` pour piloter l’overlay.
 */
export function showBootProgress(host: HTMLElement = document.body): BootProgressHandle {
    const backdrop = document.createElement("div");
    backdrop.className = "hackCable-boot-progress";
    backdrop.setAttribute("role", "status");
    backdrop.setAttribute("aria-live", "polite");
    backdrop.setAttribute("aria-busy", "true");

    const panel = document.createElement("div");
    panel.className = "hackCable-boot-progress-panel";

    const title = document.createElement("p");
    title.className = "hackCable-boot-progress-title";
    title.textContent = i18next.t("web.bootLoading", { ns: "common" });

    const detail = document.createElement("p");
    detail.className = "hackCable-boot-progress-detail";
    detail.textContent = phaseLabel("maps");

    const track = document.createElement("div");
    track.className = "hackCable-boot-progress-track";
    track.setAttribute("aria-hidden", "true");

    const fill = document.createElement("div");
    fill.className = "hackCable-boot-progress-fill";
    fill.style.width = "0%";

    const percent = document.createElement("p");
    percent.className = "hackCable-boot-progress-percent";
    percent.textContent = "0 %";

    track.appendChild(fill);
    panel.append(title, detail, track, percent);
    backdrop.appendChild(panel);
    host.appendChild(backdrop);

    return {
        update(progress: CatalogBootProgress) {
            const pct = Math.round(Math.min(1, Math.max(0, progress.ratio)) * 100);
            fill.style.width = `${pct}%`;
            percent.textContent = `${pct} %`;
            detail.textContent = phaseLabel(progress.phase);
            if (progress.phase === "elements" || progress.phase === "mount") {
                detail.textContent = `${phaseLabel(progress.phase)} (${progress.done}/${progress.total})`;
            }
        },
        close() {
            backdrop.setAttribute("aria-busy", "false");
            backdrop.remove();
        },
    };
}

/**
 * Laisse le navigateur peindre l’overlay avant un travail bloquant.
 * @returns Promesse résolue après deux frames d’animation.
 */
export function paintBeforeHeavyWork(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}
