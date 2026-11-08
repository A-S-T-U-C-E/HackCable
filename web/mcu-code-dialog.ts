/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Panneaux flottants d’édition du sketch Arduino (multi-cartes).
 *
 * Responsabilités :
 * - Une fenêtre par MCU (déplaçable, redimensionnable, refermable)
 * - Plusieurs panneaux ouverts en parallèle
 * - i18n des libellés
 */
import i18next from "i18next";
import type { ComponentFigure } from "../src/editor/component-figure";

const PANEL_CLASS = "hackCable-mcu-code-dialog";
const DEFAULT_W = 480;
const DEFAULT_H = 420;
const MIN_W = 280;
const MIN_H = 200;
const CASCADE = 28;

function t(key: string, vars?: Record<string, unknown>): string {
    return i18next.t(key, { ns: "common", ...vars });
}

type PanelState = {
    figure: ComponentFigure;
    root: HTMLElement;
    titleEl: HTMLElement;
    boardEl: HTMLElement;
    textarea: HTMLTextAreaElement;
    saveBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
    pos: { x: number; y: number };
    size: { w: number; h: number };
    drag: { startX: number; startY: number; origX: number; origY: number } | null;
    resize: { startX: number; startY: number; origW: number; origH: number } | null;
    abort: AbortController;
};

export type McuCodeDialogResult = {
    /** Ouvre (ou focus) le panneau pour la figure donnée. */
    open: (figure: ComponentFigure) => void;
    /** Met à jour les libellés i18n de tous les panneaux. */
    refreshI18n: () => void;
    /** Ferme et retire tous les panneaux. */
    destroy: () => void;
};

/**
 * Gestionnaire de panneaux d’édition sketch MCU (style moniteur série).
 */
export function createMcuCodeDialog(
    onSaved?: (figure: ComponentFigure, code: string) => void,
): McuCodeDialogResult {
    const panels = new Map<string, PanelState>();
    let zTop = 1210;
    let cascadeIndex = 0;

    const applyPosition = (state: PanelState) => {
        state.root.style.left = `${state.pos.x}px`;
        state.root.style.top = `${state.pos.y}px`;
        state.root.style.right = "auto";
        state.root.style.bottom = "auto";
    };

    const applySize = (state: PanelState) => {
        state.root.style.width = `${state.size.w}px`;
        state.root.style.height = `${state.size.h}px`;
    };

    const applyGeometry = (state: PanelState) => {
        applyPosition(state);
        applySize(state);
    };

    const applyI18n = (state: PanelState) => {
        state.titleEl.textContent = t("web.simCodeTitle");
        state.boardEl.textContent = state.figure.getComponentInfo().name;
        state.saveBtn.textContent = t("web.simCodeSave");
        state.closeBtn.setAttribute("aria-label", t("web.simCodeClose"));
    };

    const bringToFront = (state: PanelState) => {
        zTop += 1;
        state.root.style.zIndex = String(zTop);
    };

    const closePanel = (figureId: string) => {
        const state = panels.get(figureId);
        if (!state) return;
        state.abort.abort();
        state.root.remove();
        panels.delete(figureId);
    };

    const createPanel = (figure: ComponentFigure): PanelState => {
        const figureId = figure.getId();
        const abort = new AbortController();
        const { signal } = abort;

        const root = document.createElement("div");
        root.className = PANEL_CLASS;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "false");
        root.dataset.figureId = figureId;

        const header = document.createElement("div");
        header.className = "hackCable-mcu-code-dialog-header";
        header.dataset.dragHandle = "true";

        const titleEl = document.createElement("h2");
        titleEl.className = "hackCable-mcu-code-dialog-title";

        const boardEl = document.createElement("span");
        boardEl.className = "hackCable-mcu-code-board";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "hackCable-mcu-code-btn hackCable-mcu-code-btn--primary";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "hackCable-mcu-code-dialog-close";
        closeBtn.textContent = "×";

        header.append(titleEl, boardEl, saveBtn, closeBtn);

        const textarea = document.createElement("textarea");
        textarea.className = "hackCable-mcu-code-textarea";
        textarea.spellcheck = false;
        textarea.value = figure.getSketch();

        const resizeHandle = document.createElement("div");
        resizeHandle.className = "hackCable-mcu-code-resize";
        resizeHandle.title = "Resize";
        resizeHandle.setAttribute("aria-hidden", "true");

        root.append(header, textarea, resizeHandle);
        document.body.appendChild(root);

        const offset = (cascadeIndex++ % 8) * CASCADE;
        const state: PanelState = {
            figure,
            root,
            titleEl,
            boardEl,
            textarea,
            saveBtn,
            closeBtn,
            pos: {
                x: Math.min(48 + offset, Math.max(8, window.innerWidth - DEFAULT_W - 16)),
                y: Math.min(72 + offset, Math.max(8, window.innerHeight - DEFAULT_H - 16)),
            },
            size: { w: DEFAULT_W, h: DEFAULT_H },
            drag: null,
            resize: null,
            abort,
        };

        applyI18n(state);
        applyGeometry(state);
        bringToFront(state);

        saveBtn.addEventListener(
            "click",
            () => {
                const code = textarea.value;
                state.figure.setSketch(code);
                onSaved?.(state.figure, code);
            },
            { signal },
        );

        closeBtn.addEventListener("click", () => closePanel(figureId), { signal });

        root.addEventListener("pointerdown", () => bringToFront(state), { signal });

        header.addEventListener(
            "pointerdown",
            (ev) => {
                if (ev.button !== 0) return;
                if (ev.target instanceof Element && ev.target.closest("button")) return;
                // Geler la taille : ne jamais réécrire width/height pendant le drag
                // (évite le bug navigateur resize/CSS qui agrandit le panneau).
                state.drag = {
                    startX: ev.clientX,
                    startY: ev.clientY,
                    origX: state.pos.x,
                    origY: state.pos.y,
                };
                header.setPointerCapture(ev.pointerId);
                ev.preventDefault();
            },
            { signal },
        );
        header.addEventListener(
            "pointermove",
            (ev) => {
                if (!state.drag) return;
                const maxX = Math.max(0, window.innerWidth - state.size.w - 8);
                const maxY = Math.max(0, window.innerHeight - 40);
                state.pos = {
                    x: Math.min(maxX, Math.max(8, state.drag.origX + (ev.clientX - state.drag.startX))),
                    y: Math.min(maxY, Math.max(8, state.drag.origY + (ev.clientY - state.drag.startY))),
                };
                applyPosition(state);
            },
            { signal },
        );
        const endDrag = () => {
            state.drag = null;
        };
        header.addEventListener("pointerup", endDrag, { signal });
        header.addEventListener("pointercancel", endDrag, { signal });

        resizeHandle.addEventListener(
            "pointerdown",
            (ev) => {
                if (ev.button !== 0) return;
                state.resize = {
                    startX: ev.clientX,
                    startY: ev.clientY,
                    origW: state.size.w,
                    origH: state.size.h,
                };
                resizeHandle.setPointerCapture(ev.pointerId);
                ev.preventDefault();
                ev.stopPropagation();
            },
            { signal },
        );
        resizeHandle.addEventListener(
            "pointermove",
            (ev) => {
                if (!state.resize) return;
                const maxW = Math.max(MIN_W, window.innerWidth - state.pos.x - 8);
                const maxH = Math.max(MIN_H, window.innerHeight - state.pos.y - 8);
                state.size = {
                    w: Math.min(
                        maxW,
                        Math.max(MIN_W, state.resize.origW + (ev.clientX - state.resize.startX)),
                    ),
                    h: Math.min(
                        maxH,
                        Math.max(MIN_H, state.resize.origH + (ev.clientY - state.resize.startY)),
                    ),
                };
                applySize(state);
            },
            { signal },
        );
        const endResize = () => {
            state.resize = null;
        };
        resizeHandle.addEventListener("pointerup", endResize, { signal });
        resizeHandle.addEventListener("pointercancel", endResize, { signal });

        return state;
    };

    return {
        open(figure: ComponentFigure) {
            const id = figure.getId();
            const existing = panels.get(id);
            if (existing) {
                existing.figure = figure;
                existing.textarea.value = figure.getSketch();
                applyI18n(existing);
                bringToFront(existing);
                existing.textarea.focus();
                return;
            }
            const state = createPanel(figure);
            panels.set(id, state);
            state.textarea.focus();
        },
        refreshI18n() {
            for (const state of panels.values()) applyI18n(state);
        },
        destroy() {
            for (const id of [...panels.keys()]) closePanel(id);
            cascadeIndex = 0;
        },
    };
}
