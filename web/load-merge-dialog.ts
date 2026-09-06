/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Dialogue de fusion à l’ouverture d’un fichier (remplacer / ajouter / annuler).
 *
 * Responsabilités :
 * - Demander le mode `EditorLoadMode`
 * - Accessibilité dialog / focus
 */
import i18next from "i18next";

export type LoadMergeChoice = "replace" | "append" | "cancel";

/**
 * Propose Remplacer / Ajouter / Annuler lorsque le plan n’est pas vide.
 * @returns Promesse résolue avec le choix de l’utilisateur.
 */
export function askLoadMergeChoice(): Promise<LoadMergeChoice> {
    const t = (key: string) => i18next.t(key, { ns: "common" });

    return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "hackCable-load-merge-backdrop";
        backdrop.setAttribute("role", "presentation");

        const dialog = document.createElement("div");
        dialog.className = "hackCable-load-merge-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "hackCable-load-merge-title");

        const title = document.createElement("h2");
        title.id = "hackCable-load-merge-title";
        title.textContent = t("web.loadMergeTitle");

        const message = document.createElement("p");
        message.textContent = t("web.loadMergeMessage");

        const actions = document.createElement("div");
        actions.className = "hackCable-load-merge-actions";

        const finish = (choice: LoadMergeChoice) => {
            document.removeEventListener("keydown", onKeyDown, true);
            backdrop.remove();
            resolve(choice);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish("cancel");
            }
        };

        const addBtn = (label: string, choice: LoadMergeChoice, primary = false) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = primary
                ? "hackCable-load-merge-btn hackCable-load-merge-btn--primary"
                : "hackCable-load-merge-btn";
            btn.textContent = label;
            btn.addEventListener("click", () => finish(choice));
            actions.appendChild(btn);
            return btn;
        };

        addBtn(t("web.loadAppend"), "append", true);
        addBtn(t("web.loadReplace"), "replace");
        addBtn(t("web.loadCancel"), "cancel");

        dialog.append(title, message, actions);
        backdrop.appendChild(dialog);
        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) finish("cancel");
        });
        document.addEventListener("keydown", onKeyDown, true);
        document.body.appendChild(backdrop);
        (actions.querySelector("button") as HTMLButtonElement | null)?.focus();
    });
}
