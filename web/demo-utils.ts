/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Utilitaires partagés de la démo web (fichiers JSON, i18n barre latérale).
 *
 * Responsabilités :
 * - Téléchargement / lecture de fichiers schéma
 * - Rafraîchir libellés i18n de la toolbar
 */
import i18next from "i18next";
import type { EditorSaveData } from "../src/editor/editor";
import type { FritzingSyncProgress } from "../src/main";
import {
    applyDocumentLocale,
    normalizeHackCableLanguage,
    type HackCableLanguage,
} from "../src/ui/i18n/languages";

/**
 * Vérifie si une valeur inconnue a la forme d’un fichier de sauvegarde éditeur.
 * @param x - Valeur JSON parsée à valider.
 * @returns Vrai si l’objet contient `figures` et `connections`.
 */
export function isEditorSaveData(x: unknown): x is EditorSaveData {
    if (x === null || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    return Array.isArray(o.figures) && Array.isArray(o.connections);
}

/**
 * Télécharge un objet JSON formaté sous forme de fichier.
 * @param filename - Nom du fichier de destination.
 * @param data - Données sérialisables en JSON.
 */
export function downloadJsonFile(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
    });
    downloadBlob(filename, blob);
}

/**
 * Déclenche le téléchargement d’une data URL.
 * @param filename - Nom du fichier de destination.
 * @param dataUrl - URL de données (ex. PNG en base64).
 */
export function downloadDataUrl(filename: string, dataUrl: string): void {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

/**
 * Déclenche le téléchargement d’un blob via un lien temporaire.
 * @param filename - Nom du fichier de destination.
 * @param blob - Contenu binaire à télécharger.
 */
export function downloadBlob(filename: string, blob: Blob): void {
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

/**
 * Télécharge un fichier texte brut.
 * @param filename - Nom du fichier de destination.
 * @param text - Contenu textuel.
 * @param mime - Type MIME du blob (défaut : `text/plain;charset=utf-8`).
 */
export function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
    downloadBlob(filename, new Blob([text], { type: mime }));
}

/**
 * Génère un nom de fichier de sauvegarde avec extension `.hackcable`.
 * @param date - Date utilisée pour le segment du nom (défaut : aujourd’hui).
 * @returns Nom de fichier `hackcable-YYYY-MM-DD.hackcable`.
 */
export function buildHackCableSaveFilename(date = new Date()): string {
    const day = date.toISOString().slice(0, 10);
    return `hackcable-${day}.hackcable`;
}

/**
 * Génère un nom de fichier d’export image (PNG ou SVG).
 * @param ext - Extension de l’image exportée.
 * @param date - Date utilisée pour le segment du nom (défaut : aujourd’hui).
 * @returns Nom de fichier `hackcable-YYYY-MM-DD.{ext}`.
 */
export function buildHackCableExportFilename(ext: "png" | "svg", date = new Date()): string {
    const day = date.toISOString().slice(0, 10);
    return `hackcable-${day}.${ext}`;
}

/**
 * Retourne le code langue UI normalisé depuis i18next.
 * @returns Code langue HackCable (`fr_fr` par défaut).
 */
export function resolveUiLanguage(): HackCableLanguage {
    return normalizeHackCableLanguage(i18next.language) ?? "fr_fr";
}

/** Rafraîchit les libellés i18n de la toolbar et du document. */
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
    setBtn("export-image", "web.exportImage");
    setBtn("undo", "web.undo");
    setBtn("redo", "web.redo");
    setBtn("a11y-open", "a11y.open");
    setBtn("about-open", "about.open");

    const a11yOpen = document.getElementById("a11y-open");
    if (a11yOpen instanceof HTMLButtonElement) {
        a11yOpen.title = t("a11y.title");
        a11yOpen.setAttribute("aria-label", t("a11y.title"));
    }

    const aboutOpen = document.getElementById("about-open");
    if (aboutOpen instanceof HTMLButtonElement) {
        aboutOpen.title = t("about.title");
        aboutOpen.setAttribute("aria-label", t("about.title"));
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

/**
 * Formate le libellé de progression d’une sync catalogue Fritzing.
 * @param progress - État de progression de la synchronisation.
 * @returns Chaîne traduite pour la phase en cours.
 */
export function formatSyncProgress(progress: FritzingSyncProgress): string {
    const t = (k: string, vars?: Record<string, unknown>) => i18next.t(k, { ns: "common", ...vars });
    if (progress.phase === "index") {
        return t("web.updateIndexing");
    }
    return t("web.updateIntegrating", { done: progress.done, total: progress.total });
}
