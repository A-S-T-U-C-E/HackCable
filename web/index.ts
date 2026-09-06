/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Boot de la démo web (HMR webpack) et montage de `HackCable`.
 *
 * Responsabilités :
 * - Charger i18n puis démarrer `app.ts`
 * - Recharger à chaud en développement
 */
import "./css/main.styl";
import { mountWebDemoApp } from "./app";

console.log("Running HackCable web interface");

let disposeWebDemo: (() => void) | undefined;

/** Démarre ou redémarre la démo web (nettoyage HMR inclus). */
async function bootWebDemo(): Promise<void> {
    disposeWebDemo?.();
    disposeWebDemo = await mountWebDemoApp();
}

void bootWebDemo();

/** Webpack HMR : `app.ts` et le graphe `src/*` peuvent se mettre à jour sans rechargement complet. */
declare const module: {
    hot?: {
        accept(path?: string, callback?: () => void): void;
    };
};

if (typeof module !== "undefined" && module.hot) {
    module.hot.accept("./app", () => {
        void bootWebDemo();
    });
    module.hot.accept();
}
