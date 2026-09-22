/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Orchestration de la démo web HackCable (toolbar, panneaux, cycle de vie).
 *
 * Responsabilités :
 * - Créer l’instance `HackCable`
 * - Brancher sauvegarde, sync catalogue, accessibilité, à propos
 * - Appliquer les options URL
 */
import { HackCable, initHackCableI18n } from "../src/main";
import { isMinimapVisible, setMinimapVisible } from "../src/editor/canvas-minimap";
import { setCatalogAutoCollapsePreference } from "../src/panels/catalog";
import { normalizeHackCableLanguage } from "../src/ui/i18n/languages";
import { createWiringConnection } from "../src/editor/connection-router";
import {
    addConnectionWireLabel,
    getConnectionWireLabel,
    removeConnectionWireLabel,
} from "../src/editor/connection-label";
import { applyWireRouterToCanvas } from "../src/editor/connection-router-preference";
import type { ComponentFigure } from "../src/editor/component-figure";
import {
    applyA11ySettings,
    normalizeA11ySettings,
    readA11ySettings,
    writeA11ySettings,
} from "./a11y-settings";
import { setupAboutPanel } from "./about-panel";
import { setupA11yPanel } from "./a11y-panel";
import { paintBeforeHeavyWork, showBootProgress } from "./boot-progress";
import { applyWebDemoUiI18n, resolveUiLanguage } from "./demo-utils";
import {
    setupCatalogUpdate,
    setupCatalogUrlSync,
    setupExportImage,
    setupLanguageSelect,
    setupMinimapToggle,
    setupSaveRestore,
    setupUndoRedo,
} from "./demo-handlers";
import { parseUrlDemoOptions, writeUrlDemoOptions } from "./url-options";

/**
 * Monte la démo web HackCable (toolbar, panneaux, cycle de vie).
 * @returns Fonction de nettoyage pour retirer les écouteurs (HMR).
 */
export async function mountWebDemoApp(): Promise<() => void> {
    const ac = new AbortController();
    const { signal } = ac;

    const mountingDiv = document.getElementById("hackCable");
    if (!mountingDiv) throw new DOMException("Mounting div not found");

    mountingDiv.innerHTML = "";
    mountingDiv.classList.remove("hackCable-root");

    const urlOptions = parseUrlDemoOptions();
    const storedLang = localStorage.getItem("hackCable-webExample-language");
    const lang = urlOptions.lang
        ?? normalizeHackCableLanguage(storedLang)
        ?? "fr_fr";

    if (urlOptions.lang) {
        localStorage.setItem("hackCable-webExample-language", lang);
    }
    if (urlOptions.minimap !== undefined) {
        setMinimapVisible(urlOptions.minimap);
    }
    if (urlOptions.autocollapse !== undefined) {
        setCatalogAutoCollapsePreference(urlOptions.autocollapse);
    }

    const a11y = normalizeA11ySettings({
        ...readA11ySettings(),
        ...(urlOptions.a11y ?? {}),
    });
    writeA11ySettings(a11y);
    applyA11ySettings(a11y);

    const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
    const debugI18n = proc?.env?.NODE_ENV === "development";

    await initHackCableI18n(lang, debugI18n);

    const boot = showBootProgress();
    await paintBeforeHeavyWork();

    let hackCable: HackCable;
    try {
        hackCable = await HackCable.create(mountingDiv, lang, (progress) => boot.update(progress));
    } finally {
        boot.close();
    }

    applyWebDemoUiI18n();

    const syncUrl = () => {
        writeUrlDemoOptions({
            lang: resolveUiLanguage(),
            minimap: isMinimapVisible(),
            autocollapse: hackCable.catalog.isAutoCollapseEnabled(),
            a11y: readA11ySettings(),
        });
    };

    setupCatalogUpdate(hackCable, signal);
    const restoreFileInput = setupSaveRestore(hackCable.editor, signal);
    setupExportImage(hackCable.editor, signal);
    setupLanguageSelect(hackCable, signal);
    setupMinimapToggle(hackCable, signal);
    setupUndoRedo(hackCable.editor, signal);
    setupCatalogUrlSync(hackCable);

    // Hook réservé à `scripts/record-demo.mjs` (?record=1) : câblage fiable + liste des ports.
    if (new URLSearchParams(window.location.search).get("record") === "1") {
        (window as unknown as { __hackCableRecord?: unknown }).__hackCableRecord = {
            listFigures() {
                return hackCable.editor.canvas.getFigures().data
                    .filter((f: unknown): f is ComponentFigure =>
                        typeof (f as ComponentFigure).getComponentInfo === "function")
                    .map((figure) => {
                        const info = figure.getComponentInfo();
                        const ports = figure.getHybridPorts().map((port) => {
                            const abs = port.getAbsoluteX && port.getAbsoluteY
                                ? { x: port.getAbsoluteX(), y: port.getAbsoluteY() }
                                : { x: 0, y: 0 };
                            return {
                                name: port.getLocator?.()?.portId ?? port.getName?.() ?? "",
                                canvasX: abs.x,
                                canvasY: abs.y,
                            };
                        });
                        return {
                            id: figure.getId(),
                            componentId: info.id,
                            name: info.name,
                            x: figure.getX(),
                            y: figure.getY(),
                            ports,
                        };
                    });
            },
            connect(fromFigureId: string, fromPort: string, toFigureId: string, toPort: string) {
                const canvas = hackCable.editor.canvas;
                const sourceFigure = canvas.getFigure(fromFigureId) as ComponentFigure | null;
                const targetFigure = canvas.getFigure(toFigureId) as ComponentFigure | null;
                if (!sourceFigure || !targetFigure) return null;
                const sourcePort = sourceFigure.getPortByName(fromPort);
                const targetPort = targetFigure.getPortByName(toPort);
                if (!sourcePort || !targetPort) return null;
                const con = createWiringConnection();
                con.setSource(sourcePort);
                con.setTarget(targetPort);
                canvas.add(con);
                return con.getId?.() ?? true;
            },
            clearDanglingConnections() {
                const canvas = hackCable.editor.canvas;
                const lines = [...(canvas.getLines?.().data ?? [])];
                for (const line of lines) {
                    const src = line.getSource?.();
                    const tgt = line.getTarget?.();
                    if (!src || !tgt) {
                        canvas.remove(line);
                    }
                }
            },
            canvasToPage(canvasX: number, canvasY: number) {
                const canvas = hackCable.editor.canvas;
                const doc = canvas.fromCanvasToDocumentCoordinate(canvasX, canvasY);
                return { x: doc.getX?.() ?? doc.x, y: doc.getY?.() ?? doc.y };
            },
            figurePageCenter(figureId: string) {
                const canvas = hackCable.editor.canvas;
                const figure = canvas.getFigure(figureId) as ComponentFigure | null;
                if (!figure) return null;
                const cx = figure.getAbsoluteX() + figure.getWidth() / 2;
                const cy = figure.getAbsoluteY() + figure.getHeight() / 2;
                const doc = canvas.fromCanvasToDocumentCoordinate(cx, cy);
                return { x: doc.getX?.() ?? doc.x, y: doc.getY?.() ?? doc.y };
            },
            /** Point page sur le plus long segment d’une connexion (clic droit fil). */
            connectionClickPage(connectionIndex = 0) {
                const canvas = hackCable.editor.canvas;
                const lines = canvas.getLines?.().data ?? [];
                const line = lines[connectionIndex];
                if (!line) return null;
                const verts = line.getVertices?.();
                if (!verts || verts.getSize() < 2) return null;
                let best = { len: -1, x: 0, y: 0, canvasX: 0, canvasY: 0 };
                for (let i = 0; i < verts.getSize() - 1; i++) {
                    const a = verts.get(i);
                    const b = verts.get(i + 1);
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len = Math.hypot(dx, dy);
                    if (len > best.len) {
                        const canvasX = a.x + dx * 0.5;
                        const canvasY = a.y + dy * 0.5;
                        best = { len, canvasX, canvasY, x: 0, y: 0 };
                    }
                }
                const doc = canvas.fromCanvasToDocumentCoordinate(best.canvasX, best.canvasY);
                return {
                    x: doc.getX?.() ?? doc.x,
                    y: doc.getY?.() ?? doc.y,
                    canvasX: best.canvasX,
                    canvasY: best.canvasY,
                    id: line.getId?.() ?? String(connectionIndex),
                };
            },
            connectionCount() {
                return hackCable.editor.canvas.getLines?.().data?.length ?? 0;
            },
            setWireLabel(connectionIndex: number, text: string, startEdit = false) {
                const lines = hackCable.editor.canvas.getLines?.().data ?? [];
                const line = lines[connectionIndex];
                if (!line) return false;
                addConnectionWireLabel(line, text, { startEdit });
                return true;
            },
            removeWireLabel(connectionIndex: number) {
                const lines = hackCable.editor.canvas.getLines?.().data ?? [];
                const line = lines[connectionIndex];
                if (!line) return false;
                return removeConnectionWireLabel(line);
            },
            startWireLabelEdit(connectionIndex: number) {
                const lines = hackCable.editor.canvas.getLines?.().data ?? [];
                const line = lines[connectionIndex];
                if (!line) return false;
                const label = getConnectionWireLabel(line);
                if (!label?.editor?.start) return false;
                label.editor.start(label);
                return true;
            },
        };
    }

    let lastWireRouter = a11y.wireRouter;
    const refreshA11yI18n = setupA11yPanel(signal, (settings) => {
        if (settings.wireRouter !== lastWireRouter) {
            lastWireRouter = settings.wireRouter;
            applyWireRouterToCanvas(hackCable.editor.canvas, settings.wireRouter);
        }
        syncUrl();
    });
    const refreshAboutI18n = setupAboutPanel(signal);

    const languageSelect = document.getElementById("language-select");
    languageSelect?.addEventListener("change", () => {
        window.setTimeout(() => {
            applyWebDemoUiI18n();
            refreshA11yI18n();
            refreshAboutI18n();
        }, 0);
    }, { signal });

    return () => {
        ac.abort();
        hackCable.catalog.setAutoCollapseChangeListener(null);
        restoreFileInput.remove();
        document.getElementById("a11y-dialog")?.remove();
        document.getElementById("about-dialog")?.remove();
    };
}
