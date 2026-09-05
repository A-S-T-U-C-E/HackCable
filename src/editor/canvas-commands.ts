/**
 * @file Commandes draw2d (undo/redo) pour l’éditeur HackCable.
 */
import draw2d from "draw2d";
import type { Canvas } from "./canvas";
import type { ComponentFigure } from "./component-figure";

/** Ajoute une figure via CommandAdd (annulable). */
export function addFigureWithUndo(
    canvas: Canvas,
    figure: ComponentFigure,
    x: number,
    y: number,
): void {
    canvas.getCommandStack().execute(new draw2d.command.CommandAdd(canvas, figure, x, y));
}

/** Supprime une figure/connexion via CommandDelete (annulable). */
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
