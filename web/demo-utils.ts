/**
 * @file Utilitaires partagés de la démo web (fichiers JSON, i18n barre latérale).
 */
import i18next from "i18next";
import type { EditorSaveData } from "../src/editor/editor";
import type { FritzingSyncProgress } from "../src/main";
import {
    applyDocumentLocale,
    normalizeHackCableLanguage,
    type HackCableLanguage,
} from "../src/ui/i18n/languages";

export function isEditorSaveData(x: unknown): x is EditorSaveData {
    if (x === null || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    return Array.isArray(o.figures) && Array.isArray(o.connections);
}

export function downloadJsonFile(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function resolveUiLanguage(): HackCableLanguage {
    return normalizeHackCableLanguage(i18next.language) ?? "fr_fr";
}

export function applyWebDemoUiI18n(): void {
    const t = (k: string) => i18next.t(k, { ns: "common" });

    const setBtn = (id: string, key: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        const text = t(key);
        const label = el.querySelector(".hackCable-btn-label");
        if (label) label.textContent = text;
        else el.textContent = text;
        el.title = text;
        el.setAttribute("aria-label", text);
    };

    setBtn("update-catalog", "web.updateCatalog");
    setBtn("save", "web.save");
    setBtn("restore", "web.restore");
    setBtn("undo", "web.undo");
    setBtn("redo", "web.redo");
    setBtn("a11y-open", "a11y.open");

    const a11yOpen = document.getElementById("a11y-open");
    if (a11yOpen instanceof HTMLButtonElement) {
        a11yOpen.title = t("a11y.title");
        a11yOpen.setAttribute("aria-label", t("a11y.title"));
    }

    const languageLabel = document.getElementById("language-select-label");
    if (languageLabel) languageLabel.textContent = t("web.languageLabel");

    const minimapLabel = document.getElementById("show-minimap-label");
    if (minimapLabel) minimapLabel.textContent = t("web.showMinimap");

    const languageSelect = document.getElementById("language-select");
    if (languageSelect instanceof HTMLSelectElement) {
        const setOption = (value: string, key: string) => {
            const option = languageSelect.querySelector(`option[value="${value}"]`);
            if (option) option.textContent = t(key);
        };
        setOption("fr_fr", "web.langFr");
        setOption("en_us", "web.langEn");
        setOption("es_es", "web.langEs");
        setOption("ar_sa", "web.langAr");
        languageSelect.value = resolveUiLanguage();
    }

    applyDocumentLocale(resolveUiLanguage());
}

export function formatSyncProgress(progress: FritzingSyncProgress): string {
    const t = (k: string, vars?: Record<string, unknown>) => i18next.t(k, { ns: "common", ...vars });
    if (progress.phase === "index") {
        return t("web.updateIndexing");
    }
    return t("web.updateIntegrating", { done: progress.done, total: progress.total });
}
