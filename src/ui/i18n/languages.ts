/**
 * @file Codes de langue HackCable et helpers document (lang / dir).
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

/** Normalise une valeur URL / navigateur vers un code interne. */
export function normalizeHackCableLanguage(raw: string | null | undefined): HackCableLanguage | null {
    if (!raw) return null;
    const key = raw.trim().toLowerCase().replace(/_/g, "-");
    const underscored = key.replace(/-/g, "_");
    return LANGUAGE_ALIASES[key] ?? LANGUAGE_ALIASES[underscored] ?? null;
}

export function isHackCableLanguage(value: string): value is HackCableLanguage {
    return (HACKCABLE_LANGUAGES as readonly string[]).includes(value);
}

export function htmlLangFor(language: string): string {
    const code = normalizeHackCableLanguage(language) ?? "fr_fr";
    if (code === "en_us") return "en";
    if (code === "es_es") return "es";
    if (code === "ar_sa") return "ar";
    return "fr";
}

export function isRtlLanguage(language: string): boolean {
    return (normalizeHackCableLanguage(language) ?? language).startsWith("ar");
}

/** Met à jour `lang` et `dir` sur `<html>`. */
export function applyDocumentLocale(language: string): void {
    document.documentElement.lang = htmlLangFor(language);
    document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
}
