/**
 * @file Menu contextuel (clic droit) sur le canvas draw2d.
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
 * Branche le menu contextuel sur l'événement draw2d `contextmenu`.
 * @param canvas Instance draw2d.Canvas (typage large à cause du module `draw2d`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupDraw2dContextMenu(canvas: any): () => void {
    const menu = document.createElement("div");
    menu.className = "hackCable-ctx-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    document.body.appendChild(menu);

    let open = false;

    const hide = () => {
        menu.hidden = true;
        open = false;
        menu.innerHTML = "";
    };

    const onDocPointerDown = (e: MouseEvent) => {
        if (!open) return;
        if (e.button === 2) return;
        if (!menu.contains(e.target as Node)) hide();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (open && e.key === "Escape") hide();
    };

    const renderAndShow = (
        clientX: number,
        clientY: number,
        figure: unknown,
        canvasX: number,
        canvasY: number,
    ) => {
        const removable = resolveRemovable(figure);
        const onComponent = removable?.kind === "component" ? removable.target : null;
        const onConnection = removable?.kind === "connection" ? removable.target : null;

        menu.innerHTML = "";

        const addItem = (label: string, action: () => void, disabled = false) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hackCable-ctx-menu-item";
            btn.textContent = label;
            btn.disabled = disabled;
            btn.addEventListener("click", () => {
                if (disabled) return;
                action();
                hide();
            });
            menu.appendChild(btn);
        };

        if (onComponent) {
            addItem(tr("web.ctxDelete"), () => {
                deleteFigureWithUndo(onComponent);
            });
            addItem(tr("web.ctxToFront"), () => {
                onComponent.toFront();
            });
            addItem(tr("web.ctxRotateCw"), () => {
                onComponent.rotateByDegrees(90);
            });
            addItem(tr("web.ctxRotateCcw"), () => {
                onComponent.rotateByDegrees(-90);
            });
        } else if (onConnection) {
            const conn = onConnection as Parameters<typeof hitConnectionSegment>[0] &
                Parameters<typeof canRemoveConnectionSegment>[0] &
                Parameters<typeof supportsOrthogonalSegmentEdit>[0] & {
                    getCanvas?: () => { setCurrentSelection?: (f: unknown) => void };
                };
            const segment = hitConnectionSegment(conn, canvasX, canvasY);

            addItem(tr("web.ctxDeleteConnection"), () => {
                deleteFigureWithUndo(onConnection);
            });

            const hasLabel = Boolean(getConnectionWireLabel(onConnection));
            if (hasLabel) {
                addItem(tr("web.ctxEditLabel"), () => {
                    const label = getConnectionWireLabel(onConnection);
                    label?.editor?.start?.(label);
                });
                addItem(tr("web.ctxRemoveLabel"), () => {
                    removeConnectionWireLabel(onConnection);
                });
            } else {
                addItem(tr("web.ctxAddLabel"), () => {
                    addConnectionWireLabel(onConnection);
                });
            }

            if (segment && supportsOrthogonalSegmentEdit(conn)) {
                addItem(tr("web.ctxAddSegment"), () => {
                    splitConnectionSegment(onConnection, segment.index, canvasX, canvasY);
                    const host = conn.getCanvas?.();
                    host?.setCurrentSelection?.(null);
                    host?.setCurrentSelection?.(onConnection);
                });
                addItem(
                    tr("web.ctxRemoveSegment"),
                    () => {
                        removeConnectionSegment(onConnection, segment.index);
                        const host = conn.getCanvas?.();
                        host?.setCurrentSelection?.(null);
                        host?.setCurrentSelection?.(onConnection);
                    },
                    !canRemoveConnectionSegment(conn, segment.index),
                );
            }
        }

        addItem(tr("web.ctxZoomReset"), () => {
            canvas.zoomReset();
        });

        addItem(tr("canvas.zoomToFit"), () => {
            canvas.zoomToFit();
        });

        addItem(tr("web.ctxExportSvg"), () => {
            void (async () => {
                try {
                    await downloadWorkspaceSvg(canvas);
                } catch (error) {
                    const empty = error instanceof Error && error.message === "empty";
                    alert(empty ? tr("web.exportEmpty") : tr("web.exportFailed"));
                }
            })();
        });

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
