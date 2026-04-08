import i18next from "i18next";
import frFr from "./fr_fr.json";
import enUs from "./en_us.json";

/**
 * À appeler avec await avant `new HackCable(...)` pour que `i18next` et les maps
 * composants soient prêts (init est asynchrone dans i18next ≥ 21).
 */
export async function initHackCableI18n(language: string, debug: boolean): Promise<void> {
    if (i18next.isInitialized) {
        await i18next.changeLanguage(language);
        return;
    }
    await i18next.init({
        lng: language,
        fallbackLng: ["fr_fr", "en_us"],
        defaultNS: "common",
        ns: ["common"],
        debug,
        resources: {
            fr_fr: { common: frFr as Record<string, unknown> },
            en_us: { common: enUs as Record<string, unknown> },
        },
        interpolation: { escapeValue: false },
    });
}
