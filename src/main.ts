/**
 * @file Point d'entrée HackCable : montage UI, catalogue et éditeur.
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
} from "./editor/editor";

import './jquery-ui-draggable';

export class HackCable {
    private readonly _catalog: Catalog;
    private readonly _editor: Editor;

    /**
     * Préfère {@link HackCable.create} : le catalogue est construit par lots
     * avec progression, pour ne pas figer l’UI au démarrage.
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
     * Monte HackCable et charge le catalogue par lots.
     * @param onProgress progression 0..1 (maps → éléments → DOM)
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

    public async changeLanguage(language: string): Promise<TFunction> {
        const code = normalizeHackCableLanguage(language) ?? "fr_fr";
        await i18next.changeLanguage(code);
        refreshWokwiComponentMaps();
        await this._catalog.rebuildFromLocaleAsync();
        applyDocumentLocale(code);
        return i18next.t.bind(i18next);
    }

    public getLanguage(): string {
        return i18next.language;
    }

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

    public get catalog() {
        return this._catalog;
    }
    public get editor() {
        return this._editor;
    }

    /** Table des broches MCU (connectées ou non) — API pour logiciels tiers (µcBlockly…). */
    public getMcuPinConnectionTable() {
        return this._editor.getMcuPinConnectionTable();
    }

    public getMcuBoardPinTable(figureId: string) {
        return this._editor.getMcuBoardPinTable(figureId);
    }

    public getMcuPinStatus(figureId: string, pinKeyOrLabel: string) {
        return this._editor.getMcuPinStatus(figureId, pinKeyOrLabel);
    }

    public isMcuPinConnected(figureId: string, pinKeyOrLabel: string) {
        return this._editor.isMcuPinConnected(figureId, pinKeyOrLabel);
    }

    /** @returns désabonnement */
    public onMcuPinTableChange(listener: (table: ReturnType<Editor["getMcuPinConnectionTable"]>) => void) {
        return this._editor.onMcuPinTableChange(listener);
    }
}
