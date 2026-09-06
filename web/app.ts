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
import { applyWireRouterToCanvas } from "../src/editor/connection-router-preference";
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
