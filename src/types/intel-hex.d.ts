/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Déclarations ambient pour le paquet `intel-hex` (sans types officiels).
 */
declare module "intel-hex" {
    import type { Buffer } from "buffer";

    export function parse(
        data: string | Buffer,
        bufferSize?: number,
        addressOffset?: number,
    ): {
        data: Buffer;
        startSegmentAddress: number | null;
        startLinearAddress: number | null;
    };
}
