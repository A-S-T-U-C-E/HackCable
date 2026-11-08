/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
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
import { ComponentFigure } from "./editor/component-figure";
import {
    EmulatorManager,
    buildNetlist,
    diagramFromMcuPinTable,
    type CompileBoardOptions,
    type Diagram,
    type Netlist,
    type PushSketchOptions,
    type PushSketchResult,
    type SimulatableBoardRef,
} from "librecircuit";
import { SimulationBridge } from "./emulator/simulation-bridge";
import i18next, { type TFunction } from "i18next";
import { isMicrocontrollerBoard, refreshWokwiComponentMaps } from "./panels/component";
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
export {
    buildVelxioVlx,
    buildWokwiDiagram,
    resolveWokwiElementTag,
} from "./editor/sim-circuit-export";
export type {
    SimCircuitExportResult,
    VelxioVlxPayload,
    WokwiDiagram,
    WokwiDiagramPart,
} from "./editor/sim-circuit-export";
export {
    AVRRunner,
    EmulatorManager,
    SimulationBridge,
    compileToHex,
    parseAvrHex,
    resolveUnoAvrPin,
} from "./emulator";
export type {
    AvrGpioListener,
    AvrGpioPortName,
    AvrPinRef,
    CompileBoardOptions,
    CompileResult,
    ParsedAvrHex,
    PushSketchOptions,
    PushSketchResult,
    SimulatableBoardRef,
} from "./emulator";

import './jquery-ui-draggable';

export class HackCable {
    private readonly _catalog: Catalog;
    private readonly _editor: Editor;
    private readonly _emulatorManager: EmulatorManager;
    private readonly _simulationBridge: SimulationBridge;

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
        this._emulatorManager = new EmulatorManager();
        this._simulationBridge = new SimulationBridge(this._editor, this._emulatorManager);
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
        const resizerCanvas = document.querySelector('.resizerCanvas') as HTMLElement | null;
        const sideBar = document.querySelector('.hackCable-sideBar') as HTMLElement | null;

        if (!resizerCanvas || !sideBar) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            if (sideBar.classList.contains('is-catalog-collapsed')) return;

            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth >= 220) {
                sideBar.style.width = `${newWidth}px`;
            }
            e.preventDefault();
        };

        const onMouseUp = () => {
            if (!isResizing) return;
            isResizing = false;
            document.body.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        resizerCanvas.addEventListener('mousedown', (e) => {
            if (sideBar.classList.contains('is-catalog-collapsed')) return;
            isResizing = true;
            startX = e.clientX;
            startWidth = sideBar.offsetWidth;
            document.body.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
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
     * Simulation AVR (compile LibrEduc / load HEX / run / pause).
     */
    public get emulatorManager() {
        return this._emulatorManager;
    }

    /**
     * Pont GPIO ↔ overlays Wokwi (LED, boutons, LED13).
     * Préférer {@link runSimulation} / {@link stopSimulation} qui gèrent le bridge.
     */
    public get simulationBridge() {
        return this._simulationBridge;
    }

    // —— API hôte simulation (BlocklyDuino / µcBlockly…) ——————————————

    /**
     * Liste les cartes MCU présentes sur le plan (cibles pour `pushSketch`).
     * @returns Références `figureId` + nom catalogue.
     */
    public listSimulatableBoards(): SimulatableBoardRef[] {
        return this.listMcuFigures().map((figure) => {
            const info = figure.getComponentInfo();
            const fritzing = info.source === "fritzing";
            return {
                figureId: String(figure.getId()),
                componentId: info.id,
                boardName: info.name,
                source: fritzing ? "fritzing" : "wokwi",
            };
        });
    }

    /**
     * Lit le sketch Arduino associé à une carte.
     * @param figureId - Id draw2d de la figure MCU.
     * @returns Code source, ou `undefined` si la figure n’est pas une MCU.
     */
    public getBoardSketch(figureId: string): string | undefined {
        const figure = this.resolveMcuFigure(figureId, { optional: true });
        return figure?.getSketch();
    }

    /**
     * Associe un sketch Arduino à une carte (persisté dans la sauvegarde).
     * @param figureId - Id draw2d de la figure MCU.
     * @param code - Source `.ino` / C++.
     * @throws Si la carte est introuvable.
     */
    public setBoardSketch(figureId: string, code: string): void {
        const figure = this.resolveMcuFigure(figureId);
        figure.setSketch(code);
    }

    /**
     * Injecte un sketch depuis un hôte externe (compile ± run).
     *
     * Exemple µcBlockly / BlocklyDuino :
     * ```ts
     * await hackCable.pushSketch(generatedArduinoCode, { run: true });
     * // multi-cartes :
     * await hackCable.pushSketch(code, { figureId: board.figureId, run: true });
     * ```
     *
     * @param code - Source Arduino générée.
     * @param options - Cible, compile, démarrage.
     * @returns Carte touchée + résultat de compile + état running.
     */
    public async pushSketch(
        code: string,
        options: PushSketchOptions = {},
    ): Promise<PushSketchResult> {
        const saveSketch = options.saveSketch !== false;
        const doCompile = options.compile !== false;
        const doRun = options.run ?? doCompile;

        const figure = this.resolveMcuFigure(options.figureId);
        const figureId = String(figure.getId());
        const boardName = figure.getComponentInfo().name;

        if (saveSketch) {
            figure.setSketch(code);
        }

        if (!doCompile) {
            return { figureId, boardName, running: this.isSimulationRunning() };
        }

        const mcu = boardName.toLowerCase().includes("mega") ? ("2560" as const) : ("328p" as const);
        const compile = await this._emulatorManager.compileAndLoadBoard(figureId, code, { mcu });
        const ok = Boolean(compile.hex?.trim());
        if (!ok || !doRun) {
            if (!ok) this.stopSimulation();
            return { figureId, boardName, compile, running: false };
        }

        this.runSimulation();
        return { figureId, boardName, compile, running: true };
    }

    /**
     * Compile le sketch d’une carte (stocké ou fourni) sans forcément démarrer.
     * @param options - `figureId` et/ou `code` de remplacement.
     */
    public async compileBoard(options: CompileBoardOptions = {}) {
        const figure = this.resolveMcuFigure(options.figureId);
        const figureId = String(figure.getId());
        const code = options.code ?? figure.getSketch();
        if (options.code !== undefined && options.saveSketch !== false) {
            figure.setSketch(options.code);
        }
        const boardName = figure.getComponentInfo().name;
        const mcu = boardName.toLowerCase().includes("mega") ? ("2560" as const) : ("328p" as const);
        const compile = await this._emulatorManager.compileAndLoadBoard(figureId, code, { mcu });
        return { figureId, boardName, compile };
    }

    /**
     * Charge un Intel HEX déjà compilé pour une carte (sans appel réseau).
     * @param figureId - Id draw2d de la figure MCU.
     * @param hex - Firmware Intel HEX.
     */
    public loadBoardHex(figureId: string, hex: string): void {
        const figure = this.resolveMcuFigure(figureId);
        const name = (figure.getComponentInfo().name ?? "").toLowerCase();
        const mcu = name.includes("mega") ? ("2560" as const) : ("328p" as const);
        this._emulatorManager.loadCodeForBoard(figureId, hex, { mcu });
    }

    /**
     * Charge un UF2 RP2040 / Pico pour une carte (Nano RP2040 Connect…).
     * @param figureId - Id draw2d de la figure MCU.
     * @param uf2 - Contenu binaire UF2.
     */
    public loadBoardUf2(figureId: string, uf2: Uint8Array): void {
        this.resolveMcuFigure(figureId);
        this._emulatorManager.loadUf2ForBoard(figureId, uf2);
    }

    /**
     * Charge un Intel HEX dans la flash RP2040 (Pico / Nano RP2040 Connect).
     */
    public loadBoardRp2040Hex(figureId: string, hex: string): void {
        this.resolveMcuFigure(figureId);
        this._emulatorManager.loadRp2040HexForBoard(figureId, hex);
    }

    /**
     * Démarre (ou redémarre) la simulation et attache le bridge GPIO → overlays.
     * @throws Si aucun firmware n’a été chargé.
     */
    public runSimulation(): void {
        this._emulatorManager.run();
        this._simulationBridge.attach();
    }

    /** Arrête la simulation et détache le bridge (éteint les overlays pilotés). */
    public stopSimulation(): void {
        this._emulatorManager.stop();
        this._simulationBridge.detach();
    }

        /**
     * Pause / reprise de toutes les cartes en cours.
     * @param paused - `true` pour geler.
     */
    public setSimulationPaused(paused: boolean): void {
        this._emulatorManager.setPaused(paused);
    }

    /** `true` si aucune simu active ou toutes les cartes en pause. */
    public isSimulationPaused(): boolean {
        return this._emulatorManager.isPaused();
    }

    /** `true` si le bridge est attaché et au moins un runner n’est pas en pause. */
    public isSimulationRunning(): boolean {
        return this._simulationBridge.isAttached
            && this._emulatorManager.hasFirmware()
            && !this._emulatorManager.isPaused();
    }

    /**
     * Avance la simulation d’environ `ms` ms (reste en pause ensuite).
     * Attache le bridge si besoin et resynchronise les overlays.
     * @param ms - Durée simulée (défaut 1).
     */
    public stepSimulation(ms = 1): void {
        if (!this._emulatorManager.hasFirmware()) {
            throw new Error("Aucun firmware chargé. Compilez au moins une carte d’abord.");
        }
        // Si run() n’a jamais été appelé, démarrer une fois pour créer les runners.
        if (this._emulatorManager.getActiveRunners().size === 0) {
            this.runSimulation();
            this._emulatorManager.setPaused(true);
        }
        this._emulatorManager.stepMilliseconds(ms);
        if (this._simulationBridge.isAttached) {
            this._simulationBridge.syncAll();
        } else {
            this._simulationBridge.attach();
            this._simulationBridge.syncAll();
        }
    }

    /**
     * Avance de `count` instructions AVR (reste en pause).
     * @param count - Nombre d’instructions (défaut 1).
     */
    public stepSimulationInstructions(count = 1): void {
        if (!this._emulatorManager.hasFirmware()) {
            throw new Error("Aucun firmware chargé. Compilez au moins une carte d’abord.");
        }
        if (this._emulatorManager.getActiveRunners().size === 0) {
            this.runSimulation();
            this._emulatorManager.setPaused(true);
        }
        this._emulatorManager.stepInstructions(count);
        if (this._simulationBridge.isAttached) {
            this._simulationBridge.syncAll();
        } else {
            this._simulationBridge.attach();
            this._simulationBridge.syncAll();
        }
    }

    /**
     * Instantanés GPIO/ADC des cartes en simulation (panneau debug / API hôte).
     * @returns Un snapshot par carte avec runner actif.
     */
    public getSimulationPinSnapshots() {
        return this._emulatorManager.getPinSnapshots();
    }

    /**
     * Envoie du texte vers l’USART0 d’une carte (ou toutes si `figureId` omis).
     * @returns Nombre d’octets acceptés.
     */
    public writeSerial(text: string, figureId?: string): number {
        return this._emulatorManager.writeSerial(text, figureId);
    }

    /**
     * S’abonne à la sortie série (MCU → hôte).
     * @returns Fonction de désabonnement.
     */
    /** Registre de sondes plotter (`boardId:pinKey`, ex. `fig:D13`). */
    public get probes() {
        return this._emulatorManager.probes;
    }

    /** Attache une sonde de tension sur une broche (plotter). */
    public attachProbe(boardId: string, pinKey: string, label?: string) {
        const id = `${boardId}:${pinKey}`;
        return this._emulatorManager.probes.attach(id, label ?? pinKey);
    }

    public onSerial(listener: (chunk: string, figureId: string) => void): () => void {
        return this._emulatorManager.onSerial(listener);
    }

    /** Charge une image disque raw dans la microSD du figure donné. */
    public loadSdDiskImage(figureId: string, image: Uint8Array): boolean {
        return this._simulationBridge.loadSdDiskImage(figureId, image);
    }

    /** Exporte l’image disque de la microSD (copie), ou `undefined` si absente. */
    public exportSdDiskImage(figureId: string): Uint8Array | undefined {
        return this._simulationBridge.exportSdDiskImage(figureId);
    }

    /**
     * Schéma pur LibreCircuit dérivé de la table MCU live (sans draw2d).
     * Utile pour export, analyse, ou futurs bridges basés sur la netlist LC.
     */
    public getCircuitDiagram(): Diagram {
        const figures = this._editor.canvas.getFigures?.()?.data ?? [];
        const componentHints: Record<string, { type: string }> = {};
        for (const fig of figures) {
            if (fig instanceof ComponentFigure) {
                const info = fig.getComponentInfo();
                componentHints[String(fig.getId())] = { type: info.name };
            }
        }
        return diagramFromMcuPinTable(this.getMcuPinConnectionTable(), {
            partHints: componentHints,
        });
    }

    /** Netlist électrique (union-find) du plan courant. */
    public getCircuitNetlist(): Netlist {
        return buildNetlist(this.getCircuitDiagram());
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

    /** Figures MCU présentes sur le canvas. */
    private listMcuFigures(): ComponentFigure[] {
        const canvas = this._editor.canvas as unknown as {
            getFigures?: () => { data?: unknown[] };
        };
        const out: ComponentFigure[] = [];
        for (const fig of canvas.getFigures?.()?.data ?? []) {
            if (fig instanceof ComponentFigure && isMicrocontrollerBoard(fig.getComponentInfo())) {
                out.push(fig);
            }
        }
        return out;
    }

    /**
     * Résout une figure MCU par id, ou la première du plan.
     * @param figureId - Id optionnel.
     * @param opts - `optional: true` renvoie `undefined` au lieu de throw.
     */
    private resolveMcuFigure(
        figureId?: string,
        opts?: { optional?: boolean },
    ): ComponentFigure;
    private resolveMcuFigure(
        figureId: string | undefined,
        opts: { optional: true },
    ): ComponentFigure | undefined;
    private resolveMcuFigure(
        figureId?: string,
        opts?: { optional?: boolean },
    ): ComponentFigure | undefined {
        const boards = this.listMcuFigures();

        if (figureId) {
            const match = boards.find((f) => String(f.getId()) === figureId);
            if (match) return match;
            if (opts?.optional) return undefined;
            throw new Error(`Carte MCU introuvable : figureId=${figureId}`);
        }

        if (boards.length === 0) {
            if (opts?.optional) return undefined;
            throw new Error(
                "Aucune carte microcontrôleur sur le plan. Placez un Uno/Nano (ou passez figureId).",
            );
        }
        return boards[0];
    }
}
