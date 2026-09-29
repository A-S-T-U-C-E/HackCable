/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Compilation Arduino (sketch → Intel HEX) via le service Hexi Wokwi.
 *
 * Responsabilités :
 * - POST `https://hexi.wokwi.com/build`
 * - Renvoyer stdout / stderr / hex
 */
/** Réponse JSON du service de build Hexi. */
export type CompileResult = {
    stdout: string;
    stderr: string;
    hex: string;
};

const HEXI_BUILD_URL = "https://hexi.wokwi.com/build";

/**
 * Compile un sketch Arduino en Intel HEX (réseau requis).
 * @param source - Code source `.ino` / C++ Arduino.
 * @returns Résultat de compilation (hex éventuellement vide en cas d’échec).
 */
export async function compileToHex(source: string): Promise<CompileResult> {
    const sketch = source.trim();
    if (!sketch) {
        return { stdout: "", stderr: "Sketch vide.", hex: "" };
    }
    const resp = await fetch(HEXI_BUILD_URL, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sketch }),
    });
    if (!resp.ok) {
        return {
            stdout: "",
            stderr: `Échec HTTP ${resp.status} lors de la compilation Hexi.`,
            hex: "",
        };
    }
    return (await resp.json()) as CompileResult;
}
