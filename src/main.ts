/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Point d’entrée bibliothèque HackCable : montage UI, catalogue et éditeur.
 *
 * Responsabilités :
 * - Classe `HackCable` (API publique pour intégrateurs)
 * - Injection du template UI, i18n, sync Fritzing
 * - Redimensionnement de la barre latérale catalogue
 *
 * @see docs/architecture.md
 * @see docs/MAINTENANCE.md
 */
import "./ui/css.styl"
import { Catalog } from "./panels/catalog";
import {
    reportCatalogBoot,
    type CatalogBootProgressCallback,
} from "./panels/catalog-boot";
import { Editor } from "./editor/editor";
import i18next, { type TFunction } from "i18next";
import { refreshWokwiComponentMaps } from "./panels/component";
import { syncFritzingCatalog } from "./panels/fritzing-sync";
import type { FritzingSyncProgress, FritzingSyncResult } from "./panels/fritzing-types";
import { applyDocumentLocale, normalizeHackCableLanguage } from "./ui/i18n/languages";

export { syncFritzingCatalog } from "./panels/fritzing-sync";
export type { FritzingSyncProgress, FritzingSyncResult } from "./panels/fritzing-types";
export type { CatalogBootProgress, CatalogBootProgressCallback } from "./panels/catalog-boot";
export { initHackCableI18n } from "./ui/i18n/i18n-loader";
export {
    HACKCABLE_LANGUAGES,
    normalizeHackCableLanguage,
    type HackCableLanguage,
} from "./ui/i18n/languages";
export { isMicrocontrollerBoard } from "./panels/component";
export type {
    McuBoardPinTable,
    McuPinConnectionTable,
    McuPinPeerConnection,
    McuPinStatus,
    McuPinTableChangeListener,
} from "./editor/mcu-pin";

import './jquery-ui-draggable';

export class HackCable {
    private readonly _catalog: Catalog;
    private readonly _editor: Editor;

    /**
     * Monte HackCable dans le DOM ; préférer {@link HackCable.create} pour un boot progressif.
     * @param mountDiv - Conteneur d’accueil de l’UI HackCable.
     * @param _language - Code langue (réservé ; i18n doit être initialisé avant).
     * @param options - `deferCatalogBuild` retarde la construction du catalogue.
     */
    constructor(
        mountDiv: HTMLElement,
        _language: string = "fr_fr",
        options?: { deferCatalogBuild?: boolean },
    ) {
        if (!i18next.isInitialized) {
            throw new Error(
                "HackCable: appelez d'abord await initHackCableI18n(lang) (voir web/index.ts)."
            );
        }

        // create() a déjà rafraîchi les maps ; sinon on le fait ici.
        if (!options?.deferCatalogBuild) {
            refreshWokwiComponentMaps();
        }

        mountDiv.innerHTML = require('./ui/ui.html').default
        mountDiv.classList.add("hackCable-root");

        // Éditeur d’abord : le workspace (drop) est prêt pendant le montage du catalogue.
        this._editor = new Editor();
        this._catalog = new Catalog(this, { deferBuild: options?.deferCatalogBuild === true });
        this.setupResizer();
    }

    /**
     * Monte HackCable et charge le catalogue par lots avec progression.
     * @param mountDiv - Conteneur d’accueil de l’UI HackCable.
     * @param language - Code langue (ex. `fr_fr`).
     * @param onProgress - Callback de progression du boot catalogue.
     * @returns Instance HackCable prête à l’emploi.
     */
    static async create(
        mountDiv: HTMLElement,
        language: string = "fr_fr",
        onProgress?: CatalogBootProgressCallback,
    ): Promise<HackCable> {
        reportCatalogBoot(onProgress, "maps", 0, 1);
        refreshWokwiComponentMaps();
        reportCatalogBoot(onProgress, "maps", 1, 1);

        const hackCable = new HackCable(mountDiv, language, { deferCatalogBuild: true });
        await hackCable._catalog.buildAsync(onProgress);
        return hackCable;
    }

    /**
     * Change la langue UI, reconstruit le catalogue et met à jour le document.
     * @param language - Code langue cible (ex. `en_us`).
     * @returns Fonction de traduction i18next (`t`).
     */
    public async changeLanguage(language: string): Promise<TFunction> {
        const code = normalizeHackCableLanguage(language) ?? "fr_fr";
        await i18next.changeLanguage(code);
        refreshWokwiComponentMaps();
        await this._catalog.rebuildFromLocaleAsync();
        applyDocumentLocale(code);
        return i18next.t.bind(i18next);
    }

    /**
     * Retourne le code langue i18next actif.
     * @returns Code langue courant (ex. `fr_fr`).
     */
    public getLanguage(): string {
        return i18next.language;
    }

    /**
     * Synchronise le catalogue Fritzing depuis GitHub et reconstruit le panneau.
     * @param onProgress - Progression de la sync Fritzing (index / intégration).
     * @param onCatalogProgress - Progression du rebuild catalogue local.
     * @returns Statistiques de la synchronisation (ajouts, mises à jour, etc.).
     */
    public async updateFritzingCatalog(
        onProgress?: (progress: FritzingSyncProgress) => void,
        onCatalogProgress?: CatalogBootProgressCallback,
    ): Promise<FritzingSyncResult> {
        const result = await syncFritzingCatalog(onProgress);
        refreshWokwiComponentMaps();
        await this._catalog.rebuildFromCatalogAsync(onCatalogProgress);
        return result;
    }

    private setupResizer() {
        const resizerCanvas = document.querySelector('.resizerCanvas') as HTMLElement;
        const sideBar = document.querySelector('.hackCable-sideBar') as HTMLElement;
        const editor = document.querySelector('.hackCable-editor') as HTMLElement;

        if (resizerCanvas && sideBar && editor) {
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;

            resizerCanvas.addEventListener('mousedown', (e) => {
                const sideBarEl = document.querySelector('.hackCable-sideBar');
                if (sideBarEl?.classList.contains('is-catalog-collapsed')) return;
                isResizing = true;
                startX = e.clientX;
                startWidth = sideBar.offsetWidth;
                document.body.classList.add('resizing');
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                if (sideBar.classList.contains('is-catalog-collapsed')) return;

                const newWidth = startWidth + (e.clientX - startX);
                if (newWidth >= 220) {
                    sideBar.style.width = `${newWidth}px`;
                }
                e.preventDefault();
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.classList.remove('resizing');
            });
        }
    }

    /** Panneau catalogue (navigation, recherche, vignettes). */
    public get catalog() {
        return this._catalog;
    }
    /** Éditeur canvas Draw2D (figures, connexions, undo). */
    public get editor() {
        return this._editor;
    }

    /**
     * Table des broches MCU connectées ou non — API pour intégrateurs (µcBlockly…).
     * @returns Table agrégée des connexions par broche MCU.
     */
    public getMcuPinConnectionTable() {
        return this._editor.getMcuPinConnectionTable();
    }

    /**
     * Table des broches d’une carte MCU identifiée sur le canvas.
     * @param figureId - Identifiant Draw2D de la figure carte.
     * @returns Table des broches de la carte, ou `undefined` si introuvable.
     */
    public getMcuBoardPinTable(figureId: string) {
        return this._editor.getMcuBoardPinTable(figureId);
    }

    /**
     * Statut d’une broche MCU (connectée, libellé, pairs, etc.).
     * @param figureId - Identifiant Draw2D de la figure carte.
     * @param pinKeyOrLabel - Clé interne ou libellé de la broche.
     * @returns Statut de la broche, ou `undefined` si introuvable.
     */
    public getMcuPinStatus(figureId: string, pinKeyOrLabel: string) {
        return this._editor.getMcuPinStatus(figureId, pinKeyOrLabel);
    }

    /**
     * Indique si une broche MCU est connectée à au moins un fil.
     * @param figureId - Identifiant Draw2D de la figure carte.
     * @param pinKeyOrLabel - Clé interne ou libellé de la broche.
     * @returns `true` si la broche a une connexion active.
     */
    public isMcuPinConnected(figureId: string, pinKeyOrLabel: string) {
        return this._editor.isMcuPinConnected(figureId, pinKeyOrLabel);
    }

    /**
     * S’abonne aux changements de la table des broches MCU.
     * @param listener - Callback invoqué à chaque mise à jour de la table.
     * @returns Fonction de désabonnement.
     */
    public onMcuPinTableChange(listener: (table: ReturnType<Editor["getMcuPinConnectionTable"]>) => void) {
        return this._editor.onMcuPinTableChange(listener);
    }
}
