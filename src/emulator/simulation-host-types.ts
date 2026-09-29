/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Types et helpers de l’API hôte simulation (BlocklyDuino / µcBlockly…).
 *
 * Responsabilités :
 * - Décrire les cartes MCU adressables
 * - Options / résultats de `pushSketch`
 */
import type { CompileResult } from "./compiler";

/** Référence publique d’une carte MCU sur le plan. */
export type SimulatableBoardRef = {
    figureId: string;
    componentId: number;
    boardName: string;
    source: "wokwi" | "fritzing";
};

/** Options pour injecter un sketch depuis un hôte externe. */
export type PushSketchOptions = {
    /**
     * Id draw2d de la carte cible.
     * Si omis : unique MCU du plan, sinon la première.
     */
    figureId?: string;
    /** Enregistre le sketch sur la figure (défaut `true`). */
    saveSketch?: boolean;
    /**
     * Compile et charge le firmware (défaut `true`).
     * Si `false`, seul `setBoardSketch` est effectué.
     */
    compile?: boolean;
    /**
     * Démarre la simulation après une compile réussie (défaut `true` si `compile`).
     */
    run?: boolean;
};

/** Résultat de {@link PushSketchOptions} / `pushSketch`. */
export type PushSketchResult = {
    figureId: string;
    boardName: string;
    /** `undefined` si `compile: false`. */
    compile?: CompileResult;
    /** `true` si le runner tourne et le bridge est attaché. */
    running: boolean;
};

/** Options de compilation ciblée. */
export type CompileBoardOptions = {
    figureId?: string;
    /** Utiliser ce code à la place du sketch stocké sur la figure. */
    code?: string;
    /** Persister `code` sur la figure si fourni (défaut `true`). */
    saveSketch?: boolean;
};
