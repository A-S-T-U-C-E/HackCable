/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Codes de langue HackCable et helpers document (lang / dir).
 *
 * Responsabilités :
 * - Normaliser une valeur URL / navigateur
 * - Appliquer `lang` et `dir` sur `<html>` (RTL arabe)
 */
export const HACKCABLE_LANGUAGES = ["fr_fr", "en_us", "es_es", "ar_sa"] as const;
export type HackCableLanguage = (typeof HACKCABLE_LANGUAGES)[number];

const LANGUAGE_ALIASES: Record<string, HackCableLanguage> = {
    fr: "fr_fr",
    fr_fr: "fr_fr",
    "fr-fr": "fr_fr",
    en: "en_us",
    en_us: "en_us",
    "en-us": "en_us",
    es: "es_es",
    es_es: "es_es",
    "es-es": "es_es",
    ar: "ar_sa",
    ar_sa: "ar_sa",
    "ar-sa": "ar_sa",
};

/**
 * Normalise une valeur URL ou navigateur vers un code interne HackCable.
 * @param raw - Code langue brut (ex. `fr`, `en-US`).
 * @returns Code interne reconnu, ou `null` si inconnu.
 */
export function normalizeHackCableLanguage(raw: string | null | undefined): HackCableLanguage | null {
    if (!raw) return null;
    const key = raw.trim().toLowerCase().replace(/_/g, "-");
    const underscored = key.replace(/-/g, "_");
    return LANGUAGE_ALIASES[key] ?? LANGUAGE_ALIASES[underscored] ?? null;
}

/**
 * Vérifie si une chaîne est un code langue HackCable supporté.
 * @param value - Code à tester.
 * @returns `true` si le code fait partie de {@link HACKCABLE_LANGUAGES}.
 */
export function isHackCableLanguage(value: string): value is HackCableLanguage {
    return (HACKCABLE_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Retourne l’attribut BCP 47 pour `<html lang>`.
 * @param language - Code HackCable ou alias.
 * @returns Code langue HTML (ex. `fr`, `en`).
 */
export function htmlLangFor(language: string): string {
    const code = normalizeHackCableLanguage(language) ?? "fr_fr";
    if (code === "en_us") return "en";
    if (code === "es_es") return "es";
    if (code === "ar_sa") return "ar";
    return "fr";
}

/**
 * Indique si la langue s’écrit de droite à gauche.
 * @param language - Code HackCable ou alias.
 * @returns `true` pour l’arabe et variantes.
 */
export function isRtlLanguage(language: string): boolean {
    return (normalizeHackCableLanguage(language) ?? language).startsWith("ar");
}

/**
 * Met à jour `lang` et `dir` sur l’élément `<html>`.
 * @param language - Code HackCable ou alias.
 */
export function applyDocumentLocale(language: string): void {
    document.documentElement.lang = htmlLangFor(language);
    document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
}
