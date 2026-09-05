/**
 * @file Initialisation i18next pour HackCable (fr / en / es / ar).
 */
import i18next from "i18next";
import frFr from "./fr_fr.json";
import enUs from "./en_us.json";
import esEs from "./es_es.json";
import arSa from "./ar_sa.json";
import { applyDocumentLocale, normalizeHackCableLanguage } from "./languages";

/**
 * À appeler avec await avant `new HackCable(...)` pour que `i18next` et les maps
 * composants soient prêts (init est asynchrone dans i18next ≥ 21).
 */
export async function initHackCableI18n(language: string, debug: boolean): Promise<void> {
    const lng = normalizeHackCableLanguage(language) ?? "fr_fr";
    if (i18next.isInitialized) {
        await i18next.changeLanguage(lng);
        applyDocumentLocale(lng);
        return;
    }
    const fr = frFr as Record<string, unknown>;
    const en = enUs as Record<string, unknown>;
    const es = esEs as Record<string, unknown>;
    const ar = arSa as Record<string, unknown>;
    await i18next.init({
        lng,
        supportedLngs: ["fr_fr", "en_us", "es_es", "ar_sa", "fr-FR", "en-US", "es-ES", "ar-SA"],
        fallbackLng: ["fr_fr", "en_us"],
        defaultNS: "common",
        ns: ["common"],
        debug,
        resources: {
            fr_fr: { common: fr },
            en_us: { common: en },
            es_es: { common: es },
            ar_sa: { common: ar },
            "fr-FR": { common: fr },
            "en-US": { common: en },
            "es-ES": { common: es },
            "ar-SA": { common: ar },
        },
        interpolation: { escapeValue: false },
    });
    applyDocumentLocale(lng);
}
