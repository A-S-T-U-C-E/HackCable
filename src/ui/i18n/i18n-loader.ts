/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Initialisation i18next pour HackCable (fr / en / es / ar).
 *
 * Responsabilités :
 * - Charger les JSON `common`
 * - Exposer `initHackCableI18n`
 */
import i18next from "i18next";
import frFr from "./fr_fr.json";
import enUs from "./en_us.json";
import esEs from "./es_es.json";
import arSa from "./ar_sa.json";
import { applyDocumentLocale, normalizeHackCableLanguage } from "./languages";

type Bundle = Record<string, unknown>;

const LOCALE_ALIASES: Array<[string, () => Bundle]> = [
    ["fr_fr", () => frFr as Bundle],
    ["en_us", () => enUs as Bundle],
    ["es_es", () => esEs as Bundle],
    ["ar_sa", () => arSa as Bundle],
    ["fr-FR", () => frFr as Bundle],
    ["en-US", () => enUs as Bundle],
    ["es-ES", () => esEs as Bundle],
    ["ar-SA", () => arSa as Bundle],
];

/** Réinjecte les JSON (nécessaire au HMR : init ne se relance pas sinon). */
function applyLocaleResourceBundles(): void {
    for (const [code, getBundle] of LOCALE_ALIASES) {
        i18next.addResourceBundle(code, "common", getBundle(), true, true);
    }
}

/**
 * Initialise i18next et charge les bundles de traduction HackCable.
 * @param language - Code langue initial (ex. `fr_fr`).
 * @param debug - Active les logs i18next en console.
 */
export async function initHackCableI18n(language: string, debug: boolean): Promise<void> {
    const lng = normalizeHackCableLanguage(language) ?? "fr_fr";

    if (i18next.isInitialized) {
        applyLocaleResourceBundles();
        await i18next.changeLanguage(lng);
        applyDocumentLocale(lng);
        return;
    }

    const resources: Record<string, { common: Bundle }> = {};
    for (const [code, getBundle] of LOCALE_ALIASES) {
        resources[code] = { common: getBundle() };
    }

    await i18next.init({
        lng,
        supportedLngs: ["fr_fr", "en_us", "es_es", "ar_sa", "fr-FR", "en-US", "es-ES", "ar-SA"],
        fallbackLng: ["fr_fr", "en_us"],
        defaultNS: "common",
        ns: ["common"],
        debug,
        resources,
        interpolation: { escapeValue: false },
    });
    applyDocumentLocale(lng);
}

declare const module: {
    hot?: {
        accept(deps: string[], callback: () => void): void;
    };
};

if (typeof module !== "undefined" && module.hot) {
    module.hot.accept(["./fr_fr.json", "./en_us.json", "./es_es.json", "./ar_sa.json"], () => {
        if (i18next.isInitialized) applyLocaleResourceBundles();
    });
}
