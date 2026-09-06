/**
 * @file Overlay de progression au démarrage (chargement catalogue par lots).
 */
import i18next from "i18next";
import type { CatalogBootProgress } from "../src/panels/catalog-boot";

export type BootProgressHandle = {
    update: (progress: CatalogBootProgress) => void;
    close: () => void;
};

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

/** Affiche une barre de progression (sur `document.body` pour survivre au montage UI). */
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

/** Laisse le navigateur peindre l’overlay avant un travail bloquant. */
export function paintBeforeHeavyWork(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}
