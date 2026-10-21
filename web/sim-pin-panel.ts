/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Modale déplaçable d’état GPIO/ADC (esprit ElectroBlocks).
 *
 * Responsabilités :
 * - Afficher D0–D13 / A0–A5 par carte MCU active
 * - Fenêtre flottante non bloquante, déplaçable par la barre de titre
 * - Rafraîchir sur GPIO, step, et intervalle pendant le run
 */
import type { HackCable } from "../src/main";
import type { SimBoardPinSnapshot, SimPinLevel } from "../src/emulator/pin-snapshot";
import i18next from "i18next";

const REFRESH_MS = 100;
const DIALOG_ID = "sim-pin-dialog";

/**
 * Crée et branche la modale d’état des broches.
 * @param hackCable - Instance HackCable.
 * @param signal - Annulation (démontage démo).
 * @returns API locale (refresh i18n + paint + visibilité).
 */
export function setupSimPinPanel(
    hackCable: HackCable,
    signal: AbortSignal,
): {
    refreshI18n: () => void;
    paint: () => void;
    setVisible: (v: boolean) => void;
    isVisible: () => boolean;
} {
    // Retirer l’ancien panneau docké s’il reste dans le DOM.
    document.getElementById("sim-pin-panel")?.remove();

    let dialog = document.getElementById(DIALOG_ID);
    if (!(dialog instanceof HTMLElement)) {
        dialog = document.createElement("div");
        dialog.id = DIALOG_ID;
        dialog.className = "hackCable-sim-pin-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "false");
        dialog.hidden = true;
        dialog.innerHTML = `
            <div class="hackCable-sim-pin-dialog-header" data-drag-handle="true">
                <h2 id="sim-pin-dialog-title" class="hackCable-sim-pin-dialog-title"></h2>
                <button type="button" id="sim-pin-dialog-close" class="hackCable-sim-pin-dialog-close" aria-label="Close">×</button>
            </div>
            <p id="sim-pin-dialog-empty" class="hackCable-sim-pin-dialog-empty"></p>
            <div id="sim-pin-dialog-body" class="hackCable-sim-pin-dialog-body"></div>
        `;
        document.body.appendChild(dialog);
    }

    const panel = dialog;
    const body = panel.querySelector("#sim-pin-dialog-body");
    const titleEl = panel.querySelector("#sim-pin-dialog-title");
    const emptyEl = panel.querySelector("#sim-pin-dialog-empty");
    const closeBtn = panel.querySelector("#sim-pin-dialog-close");
    const dragHandle = panel.querySelector("[data-drag-handle]");

    if (!(body instanceof HTMLElement)) {
        return {
            refreshI18n: () => undefined,
            paint: () => undefined,
            setVisible: () => undefined,
            isVisible: () => false,
        };
    }

    let visible = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let gpioUnsub: (() => void) | undefined;
    let pos = { x: 24, y: 72 };
    let drag: { startX: number; startY: number; origX: number; origY: number } | null = null;

    const t = (k: string, vars?: Record<string, unknown>) =>
        i18next.t(k, { ns: "common", ...vars });

    const applyPosition = () => {
        panel.style.left = `${pos.x}px`;
        panel.style.top = `${pos.y}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
    };

    const boardName = (figureId: string): string => {
        try {
            const boards = hackCable.listSimulatableBoards();
            return boards.find((b) => b.figureId === figureId)?.boardName ?? figureId;
        } catch {
            return figureId;
        }
    };

    const paint = () => {
        const snaps = hackCable.getSimulationPinSnapshots();
        body.replaceChildren();

        if (emptyEl instanceof HTMLElement) {
            emptyEl.hidden = snaps.length > 0;
            emptyEl.textContent = t("web.simPinsEmpty");
        }

        for (const snap of snaps) {
            body.appendChild(renderBoard(snap, boardName(snap.figureId), t));
        }
    };

    const refreshI18n = () => {
        if (titleEl) titleEl.textContent = t("web.simPinsTitle");
        if (closeBtn instanceof HTMLElement) {
            closeBtn.setAttribute("aria-label", t("web.simPinsClose"));
            closeBtn.title = t("web.simPinsClose");
        }
        if (emptyEl instanceof HTMLElement && emptyEl.hidden === false) {
            emptyEl.textContent = t("web.simPinsEmpty");
        }
        paint();
    };

    const stopPoll = () => {
        if (pollTimer !== undefined) {
            clearInterval(pollTimer);
            pollTimer = undefined;
        }
        gpioUnsub?.();
        gpioUnsub = undefined;
    };

    const startPoll = () => {
        stopPoll();
        if (!visible) return;
        gpioUnsub = hackCable.emulatorManager.onGpio(() => paint());
        pollTimer = setInterval(paint, REFRESH_MS);
        paint();
    };

    const setVisible = (v: boolean) => {
        visible = v;
        panel.hidden = !v;
        panel.setAttribute("aria-hidden", v ? "false" : "true");
        if (v) {
            // Position initiale bas-droite si jamais déplacée
            if (!panel.dataset.placed) {
                const w = panel.offsetWidth || 420;
                const h = panel.offsetHeight || 200;
                pos = {
                    x: Math.max(12, window.innerWidth - w - 24),
                    y: Math.max(56, window.innerHeight - h - 48),
                };
                panel.dataset.placed = "1";
            }
            applyPosition();
            startPoll();
        } else {
            stopPoll();
        }
    };

    const onPointerDown = (ev: PointerEvent) => {
        if (!(ev.target instanceof Element)) return;
        if (ev.target.closest("button")) return;
        drag = {
            startX: ev.clientX,
            startY: ev.clientY,
            origX: pos.x,
            origY: pos.y,
        };
        (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
        ev.preventDefault();
    };

    const onPointerMove = (ev: PointerEvent) => {
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        const maxX = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
        const maxY = Math.max(0, window.innerHeight - 40);
        pos = {
            x: Math.min(maxX, Math.max(8, drag.origX + dx)),
            y: Math.min(maxY, Math.max(8, drag.origY + dy)),
        };
        applyPosition();
    };

    const onPointerUp = () => {
        drag = null;
    };

    if (dragHandle instanceof HTMLElement) {
        dragHandle.addEventListener("pointerdown", onPointerDown);
        dragHandle.addEventListener("pointermove", onPointerMove);
        dragHandle.addEventListener("pointerup", onPointerUp);
        dragHandle.addEventListener("pointercancel", onPointerUp);
    }

    closeBtn?.addEventListener("click", () => {
        setVisible(false);
        panel.dispatchEvent(new CustomEvent("hackcable:sim-pins-closed", { bubbles: true }));
    });

    signal.addEventListener("abort", () => {
        stopPoll();
        panel.remove();
    });

    panel.setAttribute("aria-labelledby", "sim-pin-dialog-title");
    refreshI18n();

    return {
        refreshI18n,
        paint,
        setVisible,
        isVisible: () => visible,
    };
}

function renderBoard(
    snap: SimBoardPinSnapshot,
    name: string,
    t: (k: string, vars?: Record<string, unknown>) => string,
): HTMLElement {
    const section = document.createElement("section");
    section.className = "hackCable-sim-pin-board";

    const heading = document.createElement("h3");
    heading.className = "hackCable-sim-pin-board-title";
    const pauseLabel = snap.paused ? t("web.simPinsPaused") : t("web.simPinsLive");
    heading.textContent = `${name} — PC ${snap.pc} · ${snap.cycles} cy · ${pauseLabel}`;
    section.appendChild(heading);

    const digRow = document.createElement("div");
    digRow.className = "hackCable-sim-pin-row";
    digRow.setAttribute("role", "list");
    for (const pin of snap.digital) {
        digRow.appendChild(pinChip(pin.label, pin.state, levelClass(pin.state)));
    }
    section.appendChild(digRow);

    const adcRow = document.createElement("div");
    adcRow.className = "hackCable-sim-pin-row hackCable-sim-pin-row--adc";
    adcRow.setAttribute("role", "list");
    for (const ch of snap.adc) {
        const label = `${ch.label} ${ch.volts.toFixed(2)}V`;
        const level: SimPinLevel = ch.volts >= 2.5 ? "High" : "Low";
        adcRow.appendChild(pinChip(label, level, levelClass(level)));
    }
    section.appendChild(adcRow);

    return section;
}

function pinChip(label: string, state: SimPinLevel, cls: string): HTMLElement {
    const el = document.createElement("span");
    el.className = `hackCable-sim-pin-chip ${cls}`;
    el.setAttribute("role", "listitem");
    el.title = `${label}: ${state}`;
    el.textContent = label;
    el.dataset.state = state;
    return el;
}

function levelClass(state: SimPinLevel): string {
    if (state === "High") return "is-high";
    if (state === "Low") return "is-low";
    if (state === "InputPullUp") return "is-pullup";
    return "is-input";
}
