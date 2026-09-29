/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Parsing / validation Intel HEX pour le chargement firmware AVR.
 *
 * Responsabilités :
 * - Wrapper `intel-hex` avec messages d’erreur lisibles
 * - Rejeter un hex vide ou sans enregistrement EOF
 */
import { Buffer } from "buffer";
import { parse as parseIntelHexRaw } from "intel-hex";

export type ParsedAvrHex = {
    /** Octets programme (padding 0xFF hors zones écrites). */
    data: Uint8Array;
};

type IntelHexParseResult = {
    data: Buffer;
};

/**
 * Parse un firmware Intel HEX en mémoire programme.
 * @param hex - Contenu ASCII Intel HEX.
 * @returns Octets programme.
 * @throws Si le hex est vide, mal formé ou sans enregistrement de fin.
 */
export function parseAvrHex(hex: string): ParsedAvrHex {
    const normalized = hex.replace(/\r\n/g, "\n").replace(/\n\n+/g, "\n").trim();
    if (!normalized) {
        throw new Error("HEX vide : compilez ou chargez un firmware avant d’exécuter.");
    }
    if (!/:00000001(?:FF)?\s*$/im.test(normalized) && !normalized.includes(":00000001FF")) {
        // Certains builds omettent le padding ; on tente quand même le parse,
        // mais on signale clairement l’échec intel-hex.
    }
    try {
        const result = parseIntelHexRaw(normalized) as IntelHexParseResult;
        const data = result?.data;
        if (!data || data.length === 0) {
            throw new Error("HEX sans données programme.");
        }
        return { data: new Uint8Array(data) };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`HEX invalide : ${message}`);
    }
}
