/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Modale d’édition du sketch Arduino d’une carte MCU.
 *
 * Responsabilités :
 * - Afficher / enregistrer le code d’une `ComponentFigure`
 * - i18n des libellés
 */
import i18next from "i18next";
import type { ComponentFigure } from "../src/editor/component-figure";

/**
 * Traduit une clé i18n du namespace `common`.
 * @param key - Clé de traduction.
 * @returns Chaîne traduite.
 */
function t(key: string): string {
    return i18next.t(key, { ns: "common" });
}

export type McuCodeDialogResult = {
    /** Ouvre la modale pour la figure donnée. */
    open: (figure: ComponentFigure) => void;
    /** Met à jour les libellés i18n si le dialogue est monté. */
    refreshI18n: () => void;
    /** Retire le dialogue du DOM. */
    destroy: () => void;
};

/**
 * Crée la modale d’édition de sketch MCU.
 * @param onSaved - Callback après enregistrement (figure + code).
 * @returns API open / refresh / destroy.
 */
export function createMcuCodeDialog(
    onSaved?: (figure: ComponentFigure, code: string) => void,
): McuCodeDialogResult {
    let dialog = document.getElementById("mcu-code-dialog");
    if (!(dialog instanceof HTMLDialogElement)) {
        dialog = document.createElement("dialog");
        dialog.id = "mcu-code-dialog";
        dialog.className = "hackCable-mcu-code-dialog";
        document.body.appendChild(dialog);
    }
    const panel = dialog as HTMLDialogElement;

    let currentFigure: ComponentFigure | null = null;
    let titleEl: HTMLHeadingElement | null = null;
    let boardEl: HTMLParagraphElement | null = null;
    let labelEl: HTMLLabelElement | null = null;
    let textarea: HTMLTextAreaElement | null = null;
    let saveBtn: HTMLButtonElement | null = null;
    let cancelBtn: HTMLButtonElement | null = null;

    const applyI18n = () => {
        if (titleEl) titleEl.textContent = t("web.simCodeTitle");
        if (labelEl) labelEl.textContent = t("web.simSketchLabel");
        if (saveBtn) saveBtn.textContent = t("web.simCodeSave");
        if (cancelBtn) cancelBtn.textContent = t("web.simCodeCancel");
        if (boardEl && currentFigure) {
            boardEl.textContent = currentFigure.getComponentInfo().name;
        }
    };

    const rebuild = () => {
        panel.innerHTML = "";
        panel.setAttribute("aria-labelledby", "mcu-code-dialog-title");

        titleEl = document.createElement("h2");
        titleEl.id = "mcu-code-dialog-title";
        titleEl.className = "hackCable-mcu-code-dialog-title";

        boardEl = document.createElement("p");
        boardEl.className = "hackCable-mcu-code-board";

        labelEl = document.createElement("label");
        labelEl.className = "hackCable-mcu-code-label";
        labelEl.htmlFor = "mcu-code-textarea";

        textarea = document.createElement("textarea");
        textarea.id = "mcu-code-textarea";
        textarea.className = "hackCable-mcu-code-textarea";
        textarea.spellcheck = false;
        textarea.rows = 16;

        const actions = document.createElement("div");
        actions.className = "hackCable-mcu-code-actions";

        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "hackCable-mcu-code-btn hackCable-mcu-code-btn--secondary";
        cancelBtn.addEventListener("click", () => panel.close());

        saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "hackCable-mcu-code-btn hackCable-mcu-code-btn--primary";
        saveBtn.addEventListener("click", () => {
            if (!currentFigure || !textarea) return;
            const code = textarea.value;
            currentFigure.setSketch(code);
            onSaved?.(currentFigure, code);
            panel.close();
        });

        actions.append(cancelBtn, saveBtn);
        panel.append(titleEl, boardEl, labelEl, textarea, actions);
        applyI18n();
    };

    rebuild();

    panel.addEventListener("close", () => {
        currentFigure = null;
    });

    return {
        open(figure: ComponentFigure) {
            currentFigure = figure;
            if (!textarea) rebuild();
            applyI18n();
            if (textarea) {
                textarea.value = figure.getSketch();
            }
            if (typeof panel.showModal === "function") panel.showModal();
            else panel.setAttribute("open", "");
            textarea?.focus();
        },
        refreshI18n() {
            applyI18n();
        },
        destroy() {
            panel.remove();
        },
    };
}
