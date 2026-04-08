import "./ui/css.styl"
import * as avr8js from 'avr8js';
//import '@wokwi/elements';
import { LEDElement } from "@wokwi/elements";
import { Catalog } from "./panels/catalog";
import { EmulatorManager } from "./emulator/emulator-manager";
import { Editor } from "./editor/editor";

export { AVRRunner } from "./emulator/avr-runner";
export { EmulatorManager } from './emulator/emulator-manager';
import * as compiler from './emulator/compiler';
import i18next, { TFunction } from "i18next";
import { refreshWokwiComponentMaps } from "./panels/component";
//import { MouseEvent } from "react";
export type CompileResult = compiler.CompileResult;

export { initHackCableI18n } from "./ui/i18n/i18n-loader";

import './jquery-ui-draggable';

export class HackCable {
    private readonly led: LEDElement | undefined;

    private readonly _emulatorManager: EmulatorManager;
    private readonly _catalog: Catalog;
    private readonly _editor: Editor;

    constructor(mountDiv: HTMLElement, language: string = "fr_fr") {
        if (!i18next.isInitialized) {
            throw new Error(
                "HackCable: appelez d'abord await initHackCableI18n(lang) (voir web/index.ts)."
            );
        }
        void i18next.changeLanguage(language);
        refreshWokwiComponentMaps();

        console.log("Mounting HackCable...")

        // @ts-ignore
        $('header').draggable();

        mountDiv.innerHTML = require('./ui/ui.html').default
        mountDiv.classList.add("hackCable-root");

        this._catalog = new Catalog(this)
        this._emulatorManager = new EmulatorManager(this);
        this._editor = new Editor();
        
        // Implémentation du redimensionnement interne
        this.setupResizer();
    }

    public changeLanguage(language: string): Promise<TFunction> {
        return i18next.changeLanguage(language).then(() => {
            refreshWokwiComponentMaps();
            this._catalog.rebuildFromLocale();
            document.documentElement.lang = language.startsWith("en") ? "en" : "fr";
            return i18next.t.bind(i18next);
        });
    }

    public getLanguage(): string {
        return i18next.language;
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
                isResizing = true;
                startX = e.clientX;
                startWidth = sideBar.offsetWidth;
                
                // Ajouter une classe pour désactiver la sélection de texte pendant le redimensionnement
                document.body.classList.add('resizing');
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const newWidth = startWidth + (e.clientX - startX);
                
                // Limiter la taille minimale
                if (newWidth >= 100) {
                    sideBar.style.width = `${newWidth}px`;
                }
                
                // Empêcher la sélection pendant le redimensionnement
                e.preventDefault();
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.classList.remove('resizing');
            });
        }
    }

    public get emulatorManager() {
        return this._emulatorManager;
    }
    public get catalog() {
        return this._catalog;
    }
    public get editor() {
        return this._editor;
    }

    public portDUpdate(portD: avr8js.AVRIOPort) {
        if (this.led != undefined) this.led.value = portD.pinState(1) === avr8js.PinState.High;
    }
}
