/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Moniteur série (USART0) branché sur LibreCircuit.
 *
 * Responsabilités :
 * - Afficher la sortie `Serial.print` / TX MCU
 * - Envoyer une ligne vers le MCU (`writeSerial`)
 */
import type { HackCable } from "../src/main";
import i18next from "i18next";

const DIALOG_ID = "sim-serial-dialog";
const MAX_CHARS = 50_000;

/**
 * Crée et branche la modale moniteur série.
 */
export function setupSimSerialPanel(
    hackCable: HackCable,
    signal: AbortSignal,
): {
    refreshI18n: () => void;
    setVisible: (v: boolean) => void;
    isVisible: () => boolean;
    clear: () => void;
} {
    let dialog = document.getElementById(DIALOG_ID);
    if (!(dialog instanceof HTMLElement)) {
        dialog = document.createElement("div");
        dialog.id = DIALOG_ID;
        dialog.className = "hackCable-sim-serial-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "false");
        dialog.hidden = true;
        dialog.innerHTML = `
            <div class="hackCable-sim-serial-dialog-header" data-drag-handle="true">
                <h2 id="sim-serial-dialog-title" class="hackCable-sim-serial-dialog-title"></h2>
                <button type="button" id="sim-serial-clear" class="hackCable-sim-serial-tool"></button>
                <button type="button" id="sim-serial-dialog-close" class="hackCable-sim-serial-dialog-close" aria-label="Close">×</button>
            </div>
            <pre id="sim-serial-output" class="hackCable-sim-serial-output" aria-live="polite"></pre>
            <form id="sim-serial-form" class="hackCable-sim-serial-form">
                <input id="sim-serial-input" type="text" autocomplete="off" spellcheck="false" />
                <button type="submit" id="sim-serial-send"></button>
            </form>
        `;
        document.body.appendChild(dialog);
    }

    const panel = dialog;
    const titleEl = panel.querySelector("#sim-serial-dialog-title");
    const outputEl = panel.querySelector("#sim-serial-output");
    const inputEl = panel.querySelector("#sim-serial-input");
    const sendBtn = panel.querySelector("#sim-serial-send");
    const clearBtn = panel.querySelector("#sim-serial-clear");
    const closeBtn = panel.querySelector("#sim-serial-dialog-close");
    const form = panel.querySelector("#sim-serial-form");
    const dragHandle = panel.querySelector("[data-drag-handle]");

    if (
        !(outputEl instanceof HTMLElement) ||
        !(inputEl instanceof HTMLInputElement) ||
        !(form instanceof HTMLFormElement)
    ) {
        return {
            refreshI18n: () => undefined,
            setVisible: () => undefined,
            isVisible: () => false,
            clear: () => undefined,
        };
    }

    let visible = false;
    let serialUnsub: (() => void) | undefined;
    let buffer = "";
    let pos = { x: 24, y: 320 };
    let drag: { startX: number; startY: number; origX: number; origY: number } | null = null;

    const t = (k: string, vars?: Record<string, unknown>) =>
        i18next.t(k, { ns: "common", ...vars });

    const applyPosition = () => {
        panel.style.left = `${pos.x}px`;
        panel.style.top = `${pos.y}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
    };

    const paintOutput = () => {
        if (buffer.length > MAX_CHARS) {
            buffer = buffer.slice(buffer.length - MAX_CHARS);
        }
        outputEl.textContent = buffer;
        outputEl.scrollTop = outputEl.scrollHeight;
    };

    const appendChunk = (chunk: string) => {
        buffer += chunk;
        if (visible) paintOutput();
    };

    const clear = () => {
        buffer = "";
        paintOutput();
    };

    const refreshI18n = () => {
        if (titleEl) titleEl.textContent = t("web.simSerialTitle");
        if (sendBtn) sendBtn.textContent = t("web.simSerialSend");
        if (clearBtn) clearBtn.textContent = t("web.simSerialClear");
        if (closeBtn instanceof HTMLElement) {
            closeBtn.setAttribute("aria-label", t("web.simSerialClose"));
        }
        inputEl.placeholder = t("web.simSerialPlaceholder");
    };

    const ensureSerialSub = () => {
        if (serialUnsub) return;
        serialUnsub = hackCable.onSerial((chunk) => appendChunk(chunk));
    };

    const setVisible = (v: boolean) => {
        visible = v;
        panel.hidden = !v;
        if (v) {
            ensureSerialSub();
            applyPosition();
            paintOutput();
            refreshI18n();
            inputEl.focus();
        }
    };

    form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const text = inputEl.value;
        if (!text) return;
        const line = text.endsWith("\n") ? text : `${text}\n`;
        hackCable.writeSerial(line);
        appendChunk(`› ${line}`);
        inputEl.value = "";
    }, { signal });

    clearBtn?.addEventListener("click", () => clear(), { signal });
    closeBtn?.addEventListener("click", () => {
        setVisible(false);
        panel.dispatchEvent(new CustomEvent("hackcable:sim-serial-closed", { bubbles: true }));
    }, { signal });

    if (dragHandle instanceof HTMLElement) {
        dragHandle.addEventListener("pointerdown", (ev) => {
            if (ev.button !== 0) return;
            // Ne pas capturer le drag sur × / Effacer (sinon le clic ne ferme pas).
            if (ev.target instanceof Element && ev.target.closest("button")) return;
            drag = {
                startX: ev.clientX,
                startY: ev.clientY,
                origX: pos.x,
                origY: pos.y,
            };
            dragHandle.setPointerCapture(ev.pointerId);
            ev.preventDefault();
        }, { signal });
        dragHandle.addEventListener("pointermove", (ev) => {
            if (!drag) return;
            const maxX = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
            const maxY = Math.max(0, window.innerHeight - 40);
            pos = {
                x: Math.min(maxX, Math.max(8, drag.origX + (ev.clientX - drag.startX))),
                y: Math.min(maxY, Math.max(8, drag.origY + (ev.clientY - drag.startY))),
            };
            applyPosition();
        }, { signal });
        dragHandle.addEventListener("pointerup", () => {
            drag = null;
        }, { signal });
        dragHandle.addEventListener("pointercancel", () => {
            drag = null;
        }, { signal });
    }

    signal.addEventListener("abort", () => {
        serialUnsub?.();
        serialUnsub = undefined;
        panel.remove();
    });

    // Toujours écouter dès le montage pour ne pas perdre la TX avant ouverture
    ensureSerialSub();
    refreshI18n();
    applyPosition();

    return {
        refreshI18n,
        setVisible,
        isVisible: () => visible,
        clear,
    };
}
