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
    const fr = frFr as Record<string, unknown>;
    const en = enUs as Record<string, unknown>;
    await i18next.init({
        lng: language,
        supportedLngs: ["fr_fr", "en_us"],
        fallbackLng: ["fr_fr", "en_us"],
        defaultNS: "common",
        ns: ["common"],
        debug,
        // Alias si le navigateur / i18next normalise en fr-FR / en-US
        resources: {
            fr_fr: { common: fr },
            en_us: { common: en },
            "fr-FR": { common: fr },
            "en-US": { common: en },
        },
        interpolation: { escapeValue: false },
    });
}
