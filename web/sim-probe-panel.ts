/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Mini-oscillo : plotter tension × temps sur les sondes LibreCircuit.
 */
import type { HackCable } from "../src/main";
import i18next from "i18next";

const DIALOG_ID = "sim-probe-dialog";
const REFRESH_MS = 50;
const COLORS = ["#5ec8ff", "#ffc14d", "#c59bff", "#6ddea8", "#ff8a7a", "#e0e0e0"];

type WindowMs = 2000 | 5000 | 10000;

/**
 * Modale canvas type oscilloscope pour les sondes (`attachProbe`).
 */
export function setupSimProbePanel(
    hackCable: HackCable,
    signal: AbortSignal,
): {
    refreshI18n: () => void;
    setVisible: (v: boolean) => void;
    isVisible: () => boolean;
    /** Attache / retire une sonde depuis le panneau broches. */
    toggleProbe: (boardId: string, pinKey: string) => boolean;
} {
    let dialog = document.getElementById(DIALOG_ID);
    if (!(dialog instanceof HTMLElement)) {
        dialog = document.createElement("div");
        dialog.id = DIALOG_ID;
        dialog.className = "hackCable-sim-probe-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "false");
        dialog.hidden = true;
        dialog.innerHTML = `
            <div class="hackCable-sim-probe-dialog-header" data-drag-handle="true">
                <h2 id="sim-probe-dialog-title" class="hackCable-sim-probe-dialog-title"></h2>
                <button type="button" id="sim-probe-clear" class="hackCable-sim-probe-tool"></button>
                <button type="button" id="sim-probe-dialog-close" class="hackCable-sim-probe-dialog-close">×</button>
            </div>
            <div class="hackCable-sim-probe-toolbar">
                <label class="hackCable-sim-probe-win">
                    <span id="sim-probe-win-label"></span>
                    <select id="sim-probe-window">
                        <option value="2000">2 s</option>
                        <option value="5000" selected>5 s</option>
                        <option value="10000">10 s</option>
                    </select>
                </label>
                <label class="hackCable-sim-probe-auto">
                    <input type="checkbox" id="sim-probe-auto-d13" checked />
                    <span id="sim-probe-auto-label"></span>
                </label>
            </div>
            <p id="sim-probe-dialog-hint" class="hackCable-sim-probe-hint"></p>
            <canvas id="sim-probe-canvas" width="480" height="200"></canvas>
            <ul id="sim-probe-legend" class="hackCable-sim-probe-legend"></ul>
        `;
        document.body.appendChild(dialog);
    }

    const panel = dialog;
    const titleEl = panel.querySelector("#sim-probe-dialog-title");
    const hintEl = panel.querySelector("#sim-probe-dialog-hint");
    const closeBtn = panel.querySelector("#sim-probe-dialog-close");
    const clearBtn = panel.querySelector("#sim-probe-clear");
    const winLabel = panel.querySelector("#sim-probe-win-label");
    const autoLabel = panel.querySelector("#sim-probe-auto-label");
    const winSelect = panel.querySelector("#sim-probe-window");
    const autoD13 = panel.querySelector("#sim-probe-auto-d13");
    const canvas = panel.querySelector("#sim-probe-canvas");
    const legend = panel.querySelector("#sim-probe-legend");
    const dragHandle = panel.querySelector("[data-drag-handle]");

    let visible = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let probeUnsub: (() => void) | undefined;
    let windowMs: WindowMs = 5000;
    let autoAttachD13 = true;
    let pos = { x: 40, y: 100 };
    let drag: { startX: number; startY: number; origX: number; origY: number } | null = null;

    const t = (k: string) => i18next.t(k, { ns: "common" });

    const refreshI18n = () => {
        if (titleEl) titleEl.textContent = t("web.simProbeTitle") || t("web.simProbe") || "Oscillo";
        if (hintEl) {
            hintEl.textContent =
                t("web.simProbeHint") ||
                "Cliquez une broche dans le panneau Broches pour attacher une sonde.";
        }
        if (winLabel) winLabel.textContent = t("web.simProbeWindow") || "Fenêtre";
        if (autoLabel) autoLabel.textContent = t("web.simProbeAutoD13") || "Auto D13";
        if (clearBtn instanceof HTMLElement) {
            clearBtn.textContent = t("web.simProbeClear") || "Effacer";
        }
        if (closeBtn instanceof HTMLElement) {
            closeBtn.setAttribute("aria-label", t("web.close") || "Fermer");
        }
    };

    const toggleProbe = (boardId: string, pinKey: string): boolean => {
        const id = `${boardId}:${pinKey}`;
        if (hackCable.probes.get(id)) {
            hackCable.probes.detach(id);
            paint();
            return false;
        }
        hackCable.attachProbe(boardId, pinKey, pinKey);
        paint();
        return true;
    };

    const ensureDefaultProbes = () => {
        if (!autoAttachD13) return;
        for (const [figureId] of hackCable.emulatorManager.getActiveRunners()) {
            const id = `${figureId}:D13`;
            if (!hackCable.probes.get(id)) {
                hackCable.attachProbe(figureId, "D13", "D13");
            }
        }
    };

    const paintLegend = () => {
        if (!(legend instanceof HTMLElement)) return;
        legend.replaceChildren();
        const probes = hackCable.probes.list();
        probes.forEach((probe, i) => {
            const li = document.createElement("li");
            li.className = "hackCable-sim-probe-legend-item";
            const swatch = document.createElement("span");
            swatch.className = "hackCable-sim-probe-swatch";
            swatch.style.background = COLORS[i % COLORS.length]!;
            const name = document.createElement("span");
            name.textContent = probe.label || probe.id;
            const samples = probe.samples();
            const last = samples[samples.length - 1];
            const val = document.createElement("span");
            val.className = "hackCable-sim-probe-val";
            val.textContent = last ? `${last.volts.toFixed(2)} V` : "—";
            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "hackCable-sim-probe-detach";
            rm.textContent = "×";
            rm.title = t("web.simProbeDetach") || "Retirer";
            rm.addEventListener("click", () => {
                hackCable.probes.detach(probe.id);
                paint();
            });
            li.append(swatch, name, val, rm);
            legend.appendChild(li);
        });
    };

    const paint = () => {
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 480;
        const cssH = 200;
        if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
            canvas.width = Math.floor(cssW * dpr);
            canvas.height = Math.floor(cssH * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = cssW;
        const h = cssH;

        ctx.fillStyle = "#0d1117";
        ctx.fillRect(0, 0, w, h);

        const padL = 36;
        const padR = 8;
        const padT = 8;
        const padB = 22;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        // Grille
        ctx.strokeStyle = "#21262d";
        ctx.lineWidth = 1;
        for (let v = 0; v <= 5; v++) {
            const y = padT + plotH - (v / 5) * plotH;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();
            ctx.fillStyle = "#8b949e";
            ctx.font = "11px ui-monospace, monospace";
            ctx.fillText(`${v}V`, 4, y + 3);
        }
        for (let i = 0; i <= 4; i++) {
            const x = padL + (i / 4) * plotW;
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + plotH);
            ctx.stroke();
        }

        ctx.strokeStyle = "#30363d";
        ctx.strokeRect(padL, padT, plotW, plotH);

        ensureDefaultProbes();
        const probes = hackCable.probes.list();
        if (probes.length === 0) {
            ctx.fillStyle = "#8b949e";
            ctx.fillText(t("web.simProbeEmpty") || "Aucune sonde", padL + 12, padT + plotH / 2);
            paintLegend();
            return;
        }

        const now = performance.now();
        const tMin = now - windowMs;

        probes.forEach((probe, pi) => {
            const samples = probe.samples().filter((s) => s.tMs >= tMin);
            if (samples.length < 2) return;
            ctx.strokeStyle = COLORS[pi % COLORS.length]!;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            samples.forEach((s, i) => {
                const x = padL + ((s.tMs - tMin) / windowMs) * plotW;
                const y = padT + plotH - (Math.min(5, Math.max(0, s.volts)) / 5) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });

        ctx.fillStyle = "#8b949e";
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(`−${windowMs / 1000}s`, padL, h - 6);
        ctx.fillText("0", padL + plotW - 8, h - 6);

        paintLegend();
    };

    const applyPos = () => {
        panel.style.left = `${pos.x}px`;
        panel.style.top = `${pos.y}px`;
    };

    const stopPoll = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = undefined;
        }
        probeUnsub?.();
        probeUnsub = undefined;
    };

    const startPoll = () => {
        stopPoll();
        probeUnsub = hackCable.emulatorManager.events.on("probe", () => {
            if (visible) paint();
        });
        pollTimer = setInterval(paint, REFRESH_MS);
        paint();
    };

    const setVisible = (v: boolean) => {
        visible = v;
        panel.hidden = !v;
        panel.setAttribute("aria-hidden", v ? "false" : "true");
        if (v) {
            ensureDefaultProbes();
            refreshI18n();
            applyPos();
            startPoll();
        } else {
            stopPoll();
        }
    };

    clearBtn?.addEventListener(
        "click",
        () => {
            hackCable.probes.clearAll();
            paint();
        },
        { signal },
    );

    closeBtn?.addEventListener(
        "click",
        () => {
            setVisible(false);
            panel.dispatchEvent(new CustomEvent("hackcable:sim-probe-closed", { bubbles: true }));
        },
        { signal },
    );

    winSelect?.addEventListener(
        "change",
        () => {
            if (!(winSelect instanceof HTMLSelectElement)) return;
            const n = Number(winSelect.value);
            if (n === 2000 || n === 5000 || n === 10000) windowMs = n;
            paint();
        },
        { signal },
    );

    autoD13?.addEventListener(
        "change",
        () => {
            autoAttachD13 = autoD13 instanceof HTMLInputElement && autoD13.checked;
            if (autoAttachD13) ensureDefaultProbes();
            paint();
        },
        { signal },
    );

    if (dragHandle instanceof HTMLElement) {
        dragHandle.addEventListener(
            "pointerdown",
            (ev) => {
                if ((ev.target as HTMLElement).closest("button")) return;
                drag = { startX: ev.clientX, startY: ev.clientY, origX: pos.x, origY: pos.y };
                dragHandle.setPointerCapture?.(ev.pointerId);
            },
            { signal },
        );
        dragHandle.addEventListener(
            "pointermove",
            (ev) => {
                if (!drag) return;
                const maxX = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
                const maxY = Math.max(0, window.innerHeight - 40);
                pos = {
                    x: Math.min(maxX, Math.max(8, drag.origX + (ev.clientX - drag.startX))),
                    y: Math.min(maxY, Math.max(8, drag.origY + (ev.clientY - drag.startY))),
                };
                applyPos();
            },
            { signal },
        );
        dragHandle.addEventListener(
            "pointerup",
            () => {
                drag = null;
            },
            { signal },
        );
    }

    const onPinProbe = (ev: Event) => {
        const detail = (ev as CustomEvent<{ boardId?: string; pinKey?: string }>).detail;
        if (!detail?.boardId || !detail?.pinKey) return;
        toggleProbe(detail.boardId, detail.pinKey);
        if (!visible) setVisible(true);
    };
    document.addEventListener("hackcable:toggle-probe", onPinProbe);

    signal.addEventListener("abort", () => {
        stopPoll();
        document.removeEventListener("hackcable:toggle-probe", onPinProbe);
        panel.remove();
    });

    refreshI18n();
    applyPos();

    return {
        refreshI18n,
        setVisible,
        isVisible: () => visible,
        toggleProbe,
    };
}
