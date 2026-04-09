import draw2d from "draw2d";
import i18next from "i18next";
import { ComponentFigure } from "./component-figure";

function t(key: string): string {
    return i18next.t(key, { ns: "common" });
}

type Removable = { kind: "component" | "connection"; target: any };

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
 * Menu contextuel (clic droit) branché sur l’événement draw2d `contextmenu`.
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
        // Le même clic droit qui ouvre le menu remonte en capture : ne pas fermer.
        if (e.button === 2) return;
        if (!menu.contains(e.target as Node)) hide();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (open && e.key === "Escape") hide();
    };

    const renderAndShow = (clientX: number, clientY: number, figure: unknown) => {
        const removable = resolveRemovable(figure);
        const onComponent = removable?.kind === "component" ? removable.target : null;

        menu.innerHTML = "";

        const addItem = (label: string, action: () => void) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hackCable-ctx-menu-item";
            btn.textContent = label;
            btn.addEventListener("click", () => {
                action();
                hide();
            });
            menu.appendChild(btn);
        };

        if (onComponent) {
            addItem(t("web.ctxDelete"), () => {
                canvas.remove(onComponent);
            });
            addItem(t("web.ctxToFront"), () => {
                onComponent.toFront();
            });
            addItem(t("web.ctxRotateCw"), () => {
                onComponent.rotateByDegrees(90);
            });
            addItem(t("web.ctxRotateCcw"), () => {
                onComponent.rotateByDegrees(-90);
            });
        } else if (removable?.kind === "connection") {
            addItem(t("web.ctxDeleteConnection"), () => {
                canvas.remove(removable.target);
            });
        }

        addItem(t("web.ctxZoomReset"), () => {
            canvas.setZoom(1);
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
        renderAndShow(px, py, payload.figure);
    };

    canvas.on("contextmenu", onDraw2dContextMenu);
    document.addEventListener("mousedown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    // Empêche le menu contextuel natif du navigateur (qui se superposait au nôtre).
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
