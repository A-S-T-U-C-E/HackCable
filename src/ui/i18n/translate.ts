/**
 * @file Helper i18n : traduction courte depuis le namespace `common`.
 */
import i18next from "i18next";

export function tr(key: string): string {
    return i18next.t(key, { ns: "common" });
}
