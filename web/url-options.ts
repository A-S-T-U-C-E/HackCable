/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Options démo déclenchables par l’URL (?lang=fr&minimap&labels=icons&…).
 *
 * Responsabilités :
 * - Parser les query params
 * - Appliquer langue, minimap, a11y, routeur au démarrage
 */
import type { HackCableLanguage } from "../src/ui/i18n/languages";
import { normalizeHackCableLanguage } from "../src/ui/i18n/languages";
import {
    type A11ySettings,
    normalizeA11ySettings,
    parseA11yFromUrlParams,
    readA11ySettings,
    writeA11yToUrlParams,
} from "./a11y-settings";

export interface UrlDemoOptions {
    lang?: HackCableLanguage;
    minimap?: boolean;
    autocollapse?: boolean;
    a11y?: Partial<A11ySettings>;
}

/**
 * Interprète un paramètre booléen d’URL (`1`, `true`, `on`, etc.).
 * @param value - Valeur brute du paramètre ou `null` si absent.
 * @returns Booléen interprété ou `undefined` si non reconnu.
 */
function parseBoolParam(value: string | null): boolean | undefined {
    if (value === null) return undefined;
    const v = value.trim().toLowerCase();
    if (v === "" || v === "1" || v === "true" || v === "on" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "off" || v === "no") return false;
    return undefined;
}

/**
 * Convertit un code langue HackCable en code court pour l’URL.
 * @param lang - Code langue complet (`fr_fr`, `en_us`, …).
 * @returns Code court (`fr`, `en`, `es`, `ar`).
 */
function shortLangCode(lang: HackCableLanguage): string {
    if (lang === "en_us") return "en";
    if (lang === "es_es") return "es";
    if (lang === "ar_sa") return "ar";
    return "fr";
}

/**
 * Parse les options de démo depuis la query string de l’URL.
 * @param search - Chaîne de requête (défaut : `window.location.search`).
 * @returns Options reconnues (langue, minimap, auto-repli, a11y).
 */
export function parseUrlDemoOptions(search = window.location.search): UrlDemoOptions {
    const params = new URLSearchParams(search);
    const options: UrlDemoOptions = {};

    const lang = normalizeHackCableLanguage(params.get("lang"));
    if (lang) options.lang = lang;

    if (params.has("nominimap")) {
        options.minimap = false;
    } else if (params.has("minimap")) {
        const parsed = parseBoolParam(params.get("minimap"));
        options.minimap = parsed ?? true;
    }

    if (params.has("noautocollapse") || params.has("keepopen")) {
        options.autocollapse = false;
    } else if (params.has("autocollapse")) {
        const parsed = parseBoolParam(params.get("autocollapse"));
        options.autocollapse = parsed ?? true;
    }

    const a11y = parseA11yFromUrlParams(params);
    if (Object.keys(a11y).length > 0) options.a11y = a11y;

    return options;
}

export interface DemoOptionsState {
    lang: HackCableLanguage;
    minimap: boolean;
    autocollapse: boolean;
    a11y?: A11ySettings;
}

/**
 * Met à jour l’URL du navigateur pour refléter l’état courant de la démo.
 * @param state - État à sérialiser dans les paramètres de requête.
 */
export function writeUrlDemoOptions(state: DemoOptionsState): void {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set("lang", shortLangCode(state.lang));

    if (state.minimap) {
        params.set("minimap", "1");
        params.delete("nominimap");
    } else {
        params.set("minimap", "0");
        params.delete("nominimap");
    }

    if (state.autocollapse) {
        params.set("autocollapse", "1");
        params.delete("noautocollapse");
        params.delete("keepopen");
    } else {
        params.set("autocollapse", "0");
        params.delete("noautocollapse");
        params.delete("keepopen");
    }

    writeA11yToUrlParams(params, state.a11y ?? readA11ySettings());

    const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ""}${url.hash}`;
    window.history.replaceState(null, "", next);
}

export { normalizeA11ySettings };
