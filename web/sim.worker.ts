/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Entrée Web Worker LibreCircuit (simu multi-cartes hors thread UI).
 *
 * Activé via `?worker=1` — le thread principal garde le bridge overlays ;
 * ce worker reçoit une copie du firmware pour run/série/sondes déportés.
 */
import { bindSimWorkerServer } from "librecircuit";

bindSimWorkerServer(self as unknown as DedicatedWorkerGlobalScope);
