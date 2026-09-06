/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Helper i18n : traduction courte depuis le namespace `common`.
 *
 * Responsabilités :
 * - Wrapper `i18next.t` → `tr(key)`
 */
import i18next from "i18next";

/**
 * Traduit une clé du namespace `common`.
 * @param key - Clé i18n (ex. `catalog.searchLabel`).
 * @returns Chaîne traduite pour la locale courante.
 */
export function tr(key: string): string {
    return i18next.t(key, { ns: "common" });
}
