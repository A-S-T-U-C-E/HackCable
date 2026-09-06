/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Éditeur de schéma : sérialisation, zoom, undo/redo, API MCU.
 *
 * Responsabilités :
 * - Canvas draw2d (`Canvas`)
 * - Sauvegarde / chargement JSON (`EditorSaveData`)
 * - Délégation de la table des broches MCU à `mcu-pin/McuPinTableStore`
 */
import type { Port } from "draw2d-types";
import { getComponentById } from "../panels/component";
import { Canvas } from "./canvas";
import { ComponentFigure } from "./component-figure";
import type { FigureData, WiringData } from "./component-figure";
import { addConnectionWireLabel } from "./connection-label";
import { createWiringConnection, markConnectionUserRouted } from "./connection-router";
import {
    asMcuPinWatchCanvas,
    McuPinTableStore,
    type McuBoardPinTable,
    type McuPinConnectionTable,
    type McuPinStatus,
    type McuPinTableChangeListener,
} from "./mcu-pin";

export type EditorSaveData = { figures: FigureData[]; connections: WiringData[] };

export type EditorLoadMode = "replace" | "append";

export type {
    McuBoardPinTable,
    McuPinConnectionTable,
    McuPinPeerConnection,
    McuPinStatus,
    McuPinTableChangeListener,
} from "./mcu-pin";

interface Draw2dCommandStack {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    markSaveLocation?: () => void;
}

/** Nouvel id de figure (évite les collisions en mode « Ajouter »). */
function newFigureId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `fig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class Editor {
    private readonly _canvas: Canvas;
    private readonly mcuPins: McuPinTableStore;

    /** Crée l'éditeur, le canvas draw2d et le store de broches MCU. */
    constructor() {
        this._canvas = new Canvas("hackCable-canvas");
        this.mcuPins = new McuPinTableStore(asMcuPinWatchCanvas(this._canvas));
        this.mcuPins.startWatching();
    }

    private getCommandStack(): Draw2dCommandStack {
        return this._canvas.getCommandStack() as Draw2dCommandStack;
    }

    // —— API broches MCU (voir docs/mcu-pin-api.md) ————————————————

    /**
     * Table entretenue des broches MCU (Arduino, Raspberry, STM, PICAXE…).
     * @returns Snapshot courant ; source de vérité = état live du canvas.
     */
    public getMcuPinConnectionTable(): McuPinConnectionTable {
        return this.mcuPins.getTable();
    }

    /**
     * Retourne la table d'une carte MCU du plan.
     * @param figureId - Identifiant de l'instance figure.
     * @returns Table de la carte ou `undefined` si absente.
     */
    public getMcuBoardPinTable(figureId: string): McuBoardPinTable | undefined {
        return this.mcuPins.getBoard(figureId);
    }

    /**
     * Retourne le statut d'une broche MCU.
     * @param figureId - Identifiant de l'instance figure.
     * @param pinKeyOrLabel - Clé draw2d ou libellé humain (ex. `D13`).
     * @returns Statut de la broche ou `undefined`.
     */
    public getMcuPinStatus(figureId: string, pinKeyOrLabel: string): McuPinStatus | undefined {
        return this.mcuPins.getPinStatus(figureId, pinKeyOrLabel);
    }

    /**
     * Indique si une broche MCU est câblée.
     * @param figureId - Identifiant de l'instance figure.
     * @param pinKeyOrLabel - Clé draw2d ou libellé humain.
     * @returns `true` si au moins un fil est branché.
     */
    public isMcuPinConnected(figureId: string, pinKeyOrLabel: string): boolean {
        return this.mcuPins.isPinConnected(figureId, pinKeyOrLabel);
    }

    /**
     * Abonnement aux changements de câblage / figures MCU.
     * @param listener - Callback invoqué à chaque mise à jour de la table.
     * @returns Fonction de désabonnement.
     */
    public onMcuPinTableChange(listener: McuPinTableChangeListener): () => void {
        return this.mcuPins.subscribe(listener);
    }

    // —— Undo / redo ——————————————————————————————————————————————

    /** Annule la dernière commande si possible. */
    public undo(): void {
        if (this.canUndo()) this.getCommandStack().undo();
    }

    /** Rétablit la dernière commande annulée si possible. */
    public redo(): void {
        if (this.canRedo()) this.getCommandStack().redo();
    }

    /** @returns `true` si une commande peut être annulée. */
    public canUndo(): boolean {
        return Boolean(this.getCommandStack().canUndo?.());
    }

    /** @returns `true` si une commande peut être rétablie. */
    public canRedo(): boolean {
        return Boolean(this.getCommandStack().canRedo?.());
    }

    // —— Workspace ————————————————————————————————————————————————

    /**
     * Indique si le workspace ne contient aucun composant.
     * @returns `true` s'il n'y a aucune figure composant sur le plan.
     */
    public isWorkspaceEmpty(): boolean {
        return !this._canvas.getFigures().data.some(
            (figure: unknown) => figure instanceof ComponentFigure,
        );
    }

    /**
     * Exporte le schéma (figures + fils) pour fichier `.hackcable`.
     * @returns Données sérialisables du workspace.
     */
    public getEditorSaveData(): EditorSaveData {
        const data: EditorSaveData = { figures: [], connections: [] };

        this._canvas.getFigures().data.forEach((figure: unknown) => {
            if (figure instanceof ComponentFigure) {
                data.figures.push(figure.getFigureData());
                data.connections.push(...figure.getWiringData());
            }
        });
        return data;
    }

    /**
     * Charge une sauvegarde.
     * @param data - Figures et connexions à importer.
     * @param mode - `replace` vide le plan ; `append` ajoute avec remap d'ids.
     */
    public loadEditorSaveData(data: EditorSaveData, mode: EditorLoadMode = "replace"): void {
        if (mode === "replace") {
            this._canvas.clear();
            this.importSaveData(data, null);
        } else {
            this.importSaveData(data, this.buildAppendIdMap(data));
        }
        this.getCommandStack().markSaveLocation?.();
        this.mcuPins.invalidate();
    }

    /**
     * Construit une map ancien figureId → nouvel id pour le mode append.
     */
    private buildAppendIdMap(data: EditorSaveData): Map<string, string> {
        const usedIds = new Set<string>();
        this._canvas.getFigures().data.forEach((figure: unknown) => {
            if (figure instanceof ComponentFigure) usedIds.add(figure.getId());
        });

        const idMap = new Map<string, string>();
        for (const figureData of data.figures) {
            let nextId = figureData.figureId;
            if (usedIds.has(nextId)) {
                do {
                    nextId = newFigureId();
                } while (usedIds.has(nextId));
            }
            idMap.set(figureData.figureId, nextId);
            usedIds.add(nextId);
        }
        return idMap;
    }

    /**
     * Importe figures puis connexions.
     * @param idMap - `null` = garder les ids du fichier ; sinon remap
     */
    private importSaveData(data: EditorSaveData, idMap: Map<string, string> | null): void {
        const resolveId = (id: string) => idMap?.get(id) ?? id;

        for (const figureData of data.figures) {
            const componentInfo = getComponentById(figureData.componentId);
            if (!componentInfo) continue;
            const figure = new ComponentFigure(componentInfo);
            figure.setId(resolveId(figureData.figureId));
            this._canvas.add(figure.setX(figureData.x).setY(figureData.y));
            if (typeof figureData.rotation === "number" && figureData.rotation !== 0) {
                figure.setRotationAngle(figureData.rotation);
            }
        }

        for (const connectionData of data.connections) {
            const sourceFigure: ComponentFigure = this._canvas.getFigure(
                resolveId(connectionData.fromFigure),
            );
            const targetFigure: ComponentFigure = this._canvas.getFigure(
                resolveId(connectionData.targetFigure),
            );
            if (!sourceFigure || !targetFigure) continue;

            const sourcePort: Port = sourceFigure.getPortByName(connectionData.fromPortName);
            const targetPort: Port = targetFigure.getPortByName(connectionData.targetPortName);
            if (!sourcePort || !targetPort) continue;

            const con = createWiringConnection();
            con.setSource(sourcePort);
            con.setTarget(targetPort);
            con.setVertices(connectionData.svgPath);
            markConnectionUserRouted(con);
            this._canvas.add(con);
            if (connectionData.label) {
                addConnectionWireLabel(con, connectionData.label, { startEdit: false });
            }
        }
    }

    /** Instance canvas draw2d sous-jacente. */
    get canvas(): Canvas {
        return this._canvas;
    }

    /** Augmente le zoom du canvas. */
    public zoomIn(): void {
        this._canvas.zoomIn();
    }

    /** Diminue le zoom du canvas. */
    public zoomOut(): void {
        this._canvas.zoomOut();
    }

    /** Réinitialise le zoom à 100 %. */
    public zoomReset(): void {
        this._canvas.zoomReset();
    }

    /** Ajuste le zoom pour afficher toutes les figures. */
    public zoomToFit(): void {
        this._canvas.zoomToFit();
    }
}
