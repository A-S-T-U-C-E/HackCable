/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Cache + abonnements pour la table des broches MCU.
 *
 * Responsabilités :
 * - `McuPinTableStore` : invalidation sur add/remove/connect
 * - Notifier les listeners (µcBlockly, UI debug, etc.)
 */
import { buildMcuPinConnectionTable } from "./build-table";
import { findMcuPinStatus, isMcuPinConnectedInTable } from "./query";
import type {
    McuBoardPinTable,
    McuPinConnectionTable,
    McuPinStatus,
    McuPinTableChangeListener,
} from "./types";

/** Canvas draw2d minimal pour l’écoute d’événements. */
export type McuPinWatchCanvas = {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    getFigures?: () => { data?: unknown[] };
};

/**
 * Adapte n'importe quel canvas draw2d-like pour l'écoute MCU.
 * @param canvas - Instance canvas (typage large).
 * @returns Canvas typé pour `McuPinTableStore`.
 */
export function asMcuPinWatchCanvas(canvas: object): McuPinWatchCanvas {
    return canvas as McuPinWatchCanvas;
}

/** Événements qui rendent la table obsolète. */
const WATCH_EVENTS = [
    "figure:add",
    "figure:remove",
    "connect",
    "disconnect",
    "figure:ports",
] as const;

/**
 * Maintient une copie à jour de la table MCU pour un canvas donné.
 *
 * Usage typique (dans Editor) :
 * ```ts
 * const store = new McuPinTableStore(canvas);
 * store.startWatching();
 * store.getTable(); // lazy rebuild si dirty
 * ```
 */
export class McuPinTableStore {
    private cache: McuPinConnectionTable = [];
    private dirty = true;
    private watching = false;
    private readonly listeners = new Set<McuPinTableChangeListener>();

    /**
     * Crée le store de table MCU pour un canvas donné.
     * @param canvas - Canvas draw2d à observer.
     */
    constructor(private readonly canvas: McuPinWatchCanvas) {}

    /**
     * Branche les écouteurs canvas (idempotent).
     */
    startWatching(): void {
        if (this.watching) return;
        this.watching = true;
        const onChange = () => this.invalidate();
        for (const event of WATCH_EVENTS) {
            this.canvas.on(event, onChange);
        }
    }

    /**
     * Marque le cache obsolète et notifie les abonnés au prochain microtask.
     */
    invalidate(): void {
        this.dirty = true;
        if (this.listeners.size === 0) return;
        queueMicrotask(() => this.notifyListeners());
    }

    /**
     * Retourne le snapshot courant de la table MCU (reconstruit si besoin).
     * @returns Table des cartes MCU présentes sur le plan.
     */
    getTable(): McuPinConnectionTable {
        if (this.dirty) this.rebuild();
        return this.cache;
    }

    /**
     * Retourne la table d'une carte MCU par identifiant figure.
     * @param figureId - Identifiant de l'instance figure.
     * @returns Table de la carte ou `undefined`.
     */
    getBoard(figureId: string): McuBoardPinTable | undefined {
        return this.getTable().find((board) => board.figureId === figureId);
    }

    /**
     * Retourne le statut d'une broche MCU.
     * @param figureId - Identifiant de l'instance figure.
     * @param pinKeyOrLabel - Clé draw2d ou libellé humain.
     * @returns Statut de la broche ou `undefined`.
     */
    getPinStatus(figureId: string, pinKeyOrLabel: string): McuPinStatus | undefined {
        return findMcuPinStatus(this.getTable(), figureId, pinKeyOrLabel);
    }

    /**
     * Indique si une broche MCU est câblée.
     * @param figureId - Identifiant de l'instance figure.
     * @param pinKeyOrLabel - Clé draw2d ou libellé humain.
     * @returns `true` si au moins un fil est branché.
     */
    isPinConnected(figureId: string, pinKeyOrLabel: string): boolean {
        return isMcuPinConnectedInTable(this.getTable(), figureId, pinKeyOrLabel);
    }

    /**
     * Abonne un listener aux changements de la table MCU.
     * @param listener - Callback invoqué immédiatement puis à chaque invalidation.
     * @returns Fonction de désabonnement.
     */
    subscribe(listener: McuPinTableChangeListener): () => void {
        this.listeners.add(listener);
        listener(this.getTable());
        return () => {
            this.listeners.delete(listener);
        };
    }

    private rebuild(): void {
        const figures = this.canvas.getFigures?.()?.data ?? [];
        this.cache = buildMcuPinConnectionTable(figures);
        this.dirty = false;
    }

    private notifyListeners(): void {
        const table = this.getTable();
        for (const listener of this.listeners) {
            listener(table);
        }
    }
}
