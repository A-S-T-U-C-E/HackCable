/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Menu contextuel (clic droit) sur le canvas draw2d + raccourcis Alt.
 *
 * Responsabilités :
 * - Afficher actions figure / fil / plan (supprimer, label, etc.)
 * - Positionner le menu hors overflow du viewport
 * - Raccourcis clavier Alt+lettre pour les mêmes actions
 */
import draw2d from "draw2d";
import { deleteFigureWithUndo } from "./canvas-commands";
import { ComponentFigure } from "./component-figure";
import {
    canRemoveConnectionSegment,
    hitConnectionSegment,
    removeConnectionSegment,
    splitConnectionSegment,
    supportsOrthogonalSegmentEdit,
} from "./connection-router";
import {
    addConnectionWireLabel,
    getConnectionWireLabel,
    removeConnectionWireLabel,
} from "./connection-label";
import { downloadWorkspaceSvg } from "./workspace-export";
import { tr } from "../ui/i18n/translate";

/** Raccourcis Alt (lettres distinctes ; évite Alt+D / Alt+E réservés par Chrome). */
export const CTX_SHORTCUTS = {
    delete: "k",
    toFront: "p",
    rotateCw: "r",
    rotateCcw: "t",
    zoomReset: "z",
    zoomToFit: "a",
    exportSvg: "v",
    addLabel: "b",
    editLabel: "m",
    removeLabel: "u",
    addSegment: "g",
    removeSegment: "x",
} as const;

type Removable = { kind: "component"; target: ComponentFigure } | { kind: "connection"; target: unknown };

function resolveRemovable(figure: unknown): Removable | null {
    if (!figure) return null;
    const f = figure as { getParent?: () => unknown };
    if (f instanceof ComponentFigure) return { kind: "component", target: f };
    if (f instanceof draw2d.Connection) return { kind: "connection", target: f };
    let p: unknown = f;
    for (let i = 0; i < 12 && p && typeof p === "object"; i++) {
        if (p instanceof ComponentFigure) return { kind: "component", target: p };
        if (p instanceof draw2d.Connection) return { kind: "connection", target: p };
        const gp = (p as { getParent?: () => unknown }).getParent;
        p = typeof gp === "function" ? gp.call(p) : null;
    }
    return null;
}

/**
 * Indique si le focus est dans un champ éditable (raccourcis à ignorer).
 * @param target - Cible de l’événement clavier.
 * @returns `true` si la frappe doit aller au champ, pas aux raccourcis.
 */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable;
}

/**
 * Libellé d’affichage d’un raccourci Alt.
 * @param letter - Lettre du raccourci (ex. `k`).
 * @returns Texte du type `Alt+K`.
 */
function formatAltShortcut(letter: string): string {
    return `Alt+${letter.toUpperCase()}`;
}

/**
 * Sélection primaire draw2d (figure ou connexion).
 * @param canvas - Instance canvas.
 * @returns Élément sélectionné ou `null`.
 */
function getPrimarySelection(canvas: { getPrimarySelection?: () => unknown; getSelection?: () => { getPrimary?: () => unknown; primary?: unknown } }): unknown {
    if (typeof canvas.getPrimarySelection === "function") {
        return canvas.getPrimarySelection();
    }
    const selection = canvas.getSelection?.();
    if (!selection) return null;
    if (typeof selection.getPrimary === "function") return selection.getPrimary();
    return selection.primary ?? null;
}

type CtxAction = {
    id: string;
    label: string;
    shortcut: string;
    disabled?: boolean;
    run: () => void;
};

/**
 * Construit les actions contextuelles pour une figure / un point canvas.
 * @param canvas - Instance canvas draw2d.
 * @param figure - Figure sous le clic (ou sélection pour raccourcis).
 * @param canvasX - X logique canvas (segments de fil).
 * @param canvasY - Y logique canvas.
 * @returns Actions affichables / exécutables.
 */
function buildContextActions(
    canvas: {
        zoomReset: () => void;
        zoomToFit: () => void;
        setCurrentSelection?: (f: unknown) => void;
    },
    figure: unknown,
    canvasX?: number,
    canvasY?: number,
): CtxAction[] {
    const removable = resolveRemovable(figure);
    const onComponent = removable?.kind === "component" ? removable.target : null;
    const onConnection = removable?.kind === "connection" ? removable.target : null;
    /** @type {CtxAction[]} */
    const actions: CtxAction[] = [];

    if (onComponent) {
        actions.push({
            id: "delete",
            label: tr("web.ctxDelete"),
            shortcut: CTX_SHORTCUTS.delete,
            run: () => deleteFigureWithUndo(onComponent),
        });
        actions.push({
            id: "toFront",
            label: tr("web.ctxToFront"),
            shortcut: CTX_SHORTCUTS.toFront,
            run: () => onComponent.toFront(),
        });
        actions.push({
            id: "rotateCw",
            label: tr("web.ctxRotateCw"),
            shortcut: CTX_SHORTCUTS.rotateCw,
            run: () => onComponent.rotateByDegrees(90),
        });
        actions.push({
            id: "rotateCcw",
            label: tr("web.ctxRotateCcw"),
            shortcut: CTX_SHORTCUTS.rotateCcw,
            run: () => onComponent.rotateByDegrees(-90),
        });
    } else if (onConnection) {
        const conn = onConnection as Parameters<typeof hitConnectionSegment>[0] &
            Parameters<typeof canRemoveConnectionSegment>[0] &
            Parameters<typeof supportsOrthogonalSegmentEdit>[0] & {
                getCanvas?: () => { setCurrentSelection?: (f: unknown) => void };
            };

        actions.push({
            id: "delete",
            label: tr("web.ctxDeleteConnection"),
            shortcut: CTX_SHORTCUTS.delete,
            run: () => deleteFigureWithUndo(onConnection),
        });

        const hasLabel = Boolean(getConnectionWireLabel(onConnection));
        if (hasLabel) {
            actions.push({
                id: "editLabel",
                label: tr("web.ctxEditLabel"),
                shortcut: CTX_SHORTCUTS.editLabel,
                run: () => {
                    const label = getConnectionWireLabel(onConnection);
                    label?.editor?.start?.(label);
                },
            });
            actions.push({
                id: "removeLabel",
                label: tr("web.ctxRemoveLabel"),
                shortcut: CTX_SHORTCUTS.removeLabel,
                run: () => removeConnectionWireLabel(onConnection),
            });
        } else {
            actions.push({
                id: "addLabel",
                label: tr("web.ctxAddLabel"),
                shortcut: CTX_SHORTCUTS.addLabel,
                run: () => addConnectionWireLabel(onConnection),
            });
        }

        if (
            canvasX !== undefined &&
            canvasY !== undefined &&
            supportsOrthogonalSegmentEdit(conn)
        ) {
            const segment = hitConnectionSegment(conn, canvasX, canvasY);
            if (segment) {
                actions.push({
                    id: "addSegment",
                    label: tr("web.ctxAddSegment"),
                    shortcut: CTX_SHORTCUTS.addSegment,
                    run: () => {
                        splitConnectionSegment(onConnection, segment.index, canvasX, canvasY);
                        const host = conn.getCanvas?.();
                        host?.setCurrentSelection?.(null);
                        host?.setCurrentSelection?.(onConnection);
                    },
                });
                actions.push({
                    id: "removeSegment",
                    label: tr("web.ctxRemoveSegment"),
                    shortcut: CTX_SHORTCUTS.removeSegment,
                    disabled: !canRemoveConnectionSegment(conn, segment.index),
                    run: () => {
                        removeConnectionSegment(onConnection, segment.index);
                        const host = conn.getCanvas?.();
                        host?.setCurrentSelection?.(null);
                        host?.setCurrentSelection?.(onConnection);
                    },
                });
            }
        }
    }

    actions.push({
        id: "zoomReset",
        label: tr("web.ctxZoomReset"),
        shortcut: CTX_SHORTCUTS.zoomReset,
        run: () => canvas.zoomReset(),
    });
    actions.push({
        id: "zoomToFit",
        label: tr("canvas.zoomToFit"),
        shortcut: CTX_SHORTCUTS.zoomToFit,
        run: () => canvas.zoomToFit(),
    });
    actions.push({
        id: "exportSvg",
        label: tr("web.ctxExportSvg"),
        shortcut: CTX_SHORTCUTS.exportSvg,
        run: () => {
            void (async () => {
                try {
                    await downloadWorkspaceSvg(canvas as Parameters<typeof downloadWorkspaceSvg>[0]);
                } catch (error) {
                    const empty = error instanceof Error && error.message === "empty";
                    alert(empty ? tr("web.exportEmpty") : tr("web.exportFailed"));
                }
            })();
        },
    });

    return actions;
}

/**
 * Branche le menu contextuel sur l'événement draw2d `contextmenu`.
 * @param canvas - Instance draw2d.Canvas (typage large à cause du module `draw2d`).
 * @returns Fonction de nettoyage retirant menu et écouteurs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupDraw2dContextMenu(canvas: any): () => void {
    const menu = document.createElement("div");
    menu.className = "hackCable-ctx-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    document.body.appendChild(menu);

    let open = false;
    /** @type {CtxAction[]} */
    let openActions: CtxAction[] = [];

    const hide = () => {
        menu.hidden = true;
        open = false;
        openActions = [];
        menu.innerHTML = "";
    };

    const onDocPointerDown = (e: MouseEvent) => {
        if (!open) return;
        if (e.button === 2) return;
        if (!menu.contains(e.target as Node)) hide();
    };

    const runAction = (action: CtxAction) => {
        if (action.disabled) return;
        action.run();
        hide();
    };

    const renderAndShow = (
        clientX: number,
        clientY: number,
        figure: unknown,
        canvasX: number,
        canvasY: number,
    ) => {
        const actions = buildContextActions(canvas, figure, canvasX, canvasY);
        openActions = actions;
        menu.innerHTML = "";

        for (const action of actions) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hackCable-ctx-menu-item";
            btn.disabled = Boolean(action.disabled);
            btn.setAttribute("role", "menuitem");

            const label = document.createElement("span");
            label.className = "hackCable-ctx-menu-label";
            label.textContent = action.label;

            const shortcut = document.createElement("span");
            shortcut.className = "hackCable-ctx-menu-shortcut";
            shortcut.textContent = formatAltShortcut(action.shortcut);

            btn.append(label, shortcut);
            btn.addEventListener("click", () => runAction(action));
            menu.appendChild(btn);
        }

        menu.hidden = false;
        open = true;

        const pad = 4;
        let left = clientX + pad;
        let top = clientY + pad;
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        requestAnimationFrame(() => {
            const r = menu.getBoundingClientRect();
            if (r.right > window.innerWidth) left = Math.max(pad, window.innerWidth - r.width - pad);
            if (r.bottom > window.innerHeight) top = Math.max(pad, window.innerHeight - r.height - pad);
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
        });
    };

    const onDraw2dContextMenu = (_emitter: unknown, payload: { figure: unknown; x: number; y: number }) => {
        const docPt = canvas.fromCanvasToDocumentCoordinate(payload.x, payload.y);
        const px = typeof docPt.getX === "function" ? docPt.getX() : (docPt as { x: number }).x;
        const py = typeof docPt.getY === "function" ? docPt.getY() : (docPt as { y: number }).y;
        renderAndShow(px, py, payload.figure, payload.x, payload.y);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (open && e.key === "Escape") {
            e.preventDefault();
            hide();
            return;
        }

        if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (isEditableTarget(e.target)) return;

        const letter = e.key.length === 1 ? e.key.toLowerCase() : "";
        if (!letter || letter < "a" || letter > "z") return;

        // Menu ouvert : exécuter l’entrée correspondante.
        if (open) {
            const action = openActions.find((a) => a.shortcut === letter);
            if (!action) return;
            e.preventDefault();
            runAction(action);
            return;
        }

        // Raccourcis globaux (sélection courante pour actions figure/fil).
        const selection = getPrimarySelection(canvas);
        const actions = buildContextActions(canvas, selection);
        const action = actions.find((a) => a.shortcut === letter);
        if (!action) return;
        e.preventDefault();
        action.run();
    };

    canvas.on("contextmenu", onDraw2dContextMenu);
    document.addEventListener("mousedown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    const blockNativeContextMenu = (e: Event) => {
        e.preventDefault();
    };
    const rawRoot = canvas.html?.[0] ?? canvas.html;
    const canvasRoot = rawRoot instanceof HTMLElement ? rawRoot : null;
    if (canvasRoot) {
        canvasRoot.addEventListener("contextmenu", blockNativeContextMenu, true);
    }

    return () => {
        canvas.off("contextmenu", onDraw2dContextMenu);
        document.removeEventListener("mousedown", onDocPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
        canvasRoot?.removeEventListener("contextmenu", blockNativeContextMenu, true);
        menu.remove();
    };
}
