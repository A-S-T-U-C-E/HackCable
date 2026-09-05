/**
 * @file Point d'entrée HackCable : montage UI, catalogue et éditeur.
 */
import "./ui/css.styl"
import { Catalog } from "./panels/catalog";
import { Editor } from "./editor/editor";
import i18next, { type TFunction } from "i18next";
import { refreshWokwiComponentMaps } from "./panels/component";
import { syncFritzingCatalog } from "./panels/fritzing-sync";
import type { FritzingSyncProgress, FritzingSyncResult } from "./panels/fritzing-types";
import { applyDocumentLocale, normalizeHackCableLanguage } from "./ui/i18n/languages";

export { syncFritzingCatalog } from "./panels/fritzing-sync";
export type { FritzingSyncProgress, FritzingSyncResult } from "./panels/fritzing-types";
export { initHackCableI18n } from "./ui/i18n/i18n-loader";
export {
    HACKCABLE_LANGUAGES,
    normalizeHackCableLanguage,
    type HackCableLanguage,
} from "./ui/i18n/languages";

import './jquery-ui-draggable';

export class HackCable {
    private readonly _catalog: Catalog;
    private readonly _editor: Editor;

    constructor(mountDiv: HTMLElement, _language: string = "fr_fr") {
        if (!i18next.isInitialized) {
            throw new Error(
                "HackCable: appelez d'abord await initHackCableI18n(lang) (voir web/index.ts)."
            );
        }
        refreshWokwiComponentMaps();

        mountDiv.innerHTML = require('./ui/ui.html').default
        mountDiv.classList.add("hackCable-root");

        this._catalog = new Catalog(this)
        this._editor = new Editor();
        
        this.setupResizer();
    }

    public changeLanguage(language: string): Promise<TFunction> {
        const code = normalizeHackCableLanguage(language) ?? "fr_fr";
        return i18next.changeLanguage(code).then(() => {
            refreshWokwiComponentMaps();
            this._catalog.rebuildFromLocale();
            applyDocumentLocale(code);
            return i18next.t.bind(i18next);
        });
    }

    public getLanguage(): string {
        return i18next.language;
    }

    public async updateFritzingCatalog(
        onProgress?: (progress: FritzingSyncProgress) => void,
    ): Promise<FritzingSyncResult> {
        const result = await syncFritzingCatalog(onProgress);
        refreshWokwiComponentMaps();
        this._catalog.rebuildFromCatalog();
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
}
