/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Commandes draw2d (undo/redo) pour l’éditeur HackCable.
 *
 * Responsabilités :
 * - Envelopper ajout / suppression / déplacement dans le command stack
 * - Garantir l’annulation cohérente des figures et connexions
 */
import draw2d from "draw2d";
import type { Canvas } from "./canvas";
import type { ComponentFigure } from "./component-figure";

/**
 * Ajoute une figure via CommandAdd (annulable).
 * @param canvas - Instance canvas draw2d.
 * @param figure - Figure composant à placer.
 * @param x - Position logique X.
 * @param y - Position logique Y.
 */
export function addFigureWithUndo(
    canvas: Canvas,
    figure: ComponentFigure,
    x: number,
    y: number,
): void {
    canvas.getCommandStack().execute(new draw2d.command.CommandAdd(canvas, figure, x, y));
}

/**
 * Supprime une figure ou connexion via CommandDelete (annulable).
 * @param figure - Figure draw2d à supprimer.
 */
export function deleteFigureWithUndo(figure: unknown): void {
    if (!figure || typeof figure !== "object") return;
    const target = figure as { getCanvas?: () => { getCommandStack: () => { execute: (cmd: unknown) => void } } | null };
    const canvas = typeof target.getCanvas === "function" ? target.getCanvas() : null;
    if (!canvas) return;
    const cmd = new draw2d.command.CommandDelete(figure);
    if (cmd.canExecute()) {
        canvas.getCommandStack().execute(cmd);
    }
}
