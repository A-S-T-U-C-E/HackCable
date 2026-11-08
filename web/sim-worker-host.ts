/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Branche optionnelle `SimWorkerClient` (`?worker=1` | `?worker=exclusive`).
 *
 * - `worker=1` : miroir dual (UI + worker)
 * - `worker=exclusive` : CPU uniquement dans le worker ; overlays via snapshots / deviceState
 */
import {
    Ili9341SpiDevice,
    Lcd1602I2cDevice,
    SdCardSpiDevice,
    SimWorkerClient,
    Ssd1306Device,
} from "librecircuit";
import type { HackCable } from "../src/main";

export type SimWorkerHost = {
    client: SimWorkerClient;
    exclusive: boolean;
    dispose: () => void;
};

export type WorkerUrlMode = false | true | "exclusive";

/**
 * Démarre le worker LibreCircuit selon le mode URL.
 */
export async function connectOptionalSimWorker(
    mode: WorkerUrlMode,
    signal: AbortSignal,
): Promise<SimWorkerHost | undefined> {
    if (!mode || typeof Worker === "undefined") return undefined;

    try {
        const worker = new Worker(new URL("./sim.worker.ts", import.meta.url));
        const client = new SimWorkerClient(worker);
        await Promise.race([
            client.whenReady(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("SimWorker ready timeout")), 8000),
            ),
        ]);
        await client.ping();

        const dispose = () => {
            client.stopSnapshotPush();
            client.terminate();
        };
        signal.addEventListener("abort", dispose, { once: true });

        return { client, exclusive: mode === "exclusive", dispose };
    } catch (err) {
        console.warn("[HackCable] SimWorker indisponible:", err);
        return undefined;
    }
}

/**
 * Miroir load/run/stop + bus + NeoPixel ; mode exclusive = pas de CPU UI.
 */
export function attachWorkerFirmwareMirror(
    hackCable: HackCable,
    host: SimWorkerHost,
): () => void {
    const emu = hackCable.emulatorManager;
    const client = host.client;
    const bridge = hackCable.simulationBridge;
    const exclusive = host.exclusive;

    const loadCode = emu.loadCodeForBoard.bind(emu);
    const loadUf2 = emu.loadUf2ForBoard.bind(emu);
    const loadRp = emu.loadRp2040HexForBoard.bind(emu);
    const run = emu.run.bind(emu);
    const stop = emu.stop.bind(emu);
    const attachI2c = emu.attachI2cDevice.bind(emu);
    const attachSpi = emu.attachSpiDevice.bind(emu);
    const bridgeAttach = bridge.attach.bind(bridge);

    let inputTimer: ReturnType<typeof setInterval> | undefined;

    const offSnap = client.onPinSnapshots((snapshots) => {
        if (!bridge.isAttached) return;
        bridge.applySnapshotOutputs(snapshots);
    });
    const offDev = client.onDeviceState((states) => {
        if (!bridge.isAttached) return;
        bridge.applyWorkerDeviceStates(states);
    });

    const mirrorNeos = () => {
        bridge.mirrorNeopixelsToWorker((spec) => client.attachBuiltinNeo(spec));
    };

    const pushInputs = () => {
        if (!bridge.isAttached) return;
        bridge.mirrorInputsToWorker({
            setGpio: (boardId, port, bit, high) =>
                client.setGpioInput(boardId, port, bit, high),
            setAdc: (boardId, channel, volts) =>
                client.setAdcChannel(boardId, channel, volts),
            setRpGpio: (boardId, gpio, high) =>
                client.setRpGpioInput(boardId, gpio, high),
        });
    };

    const startExclusiveInputLoop = () => {
        if (!exclusive || inputTimer !== undefined) return;
        inputTimer = setInterval(pushInputs, 50);
    };

    const stopExclusiveInputLoop = () => {
        if (inputTimer === undefined) return;
        clearInterval(inputTimer);
        inputTimer = undefined;
    };

    emu.loadCodeForBoard = (figureId, hexCode, options) => {
        if (exclusive) {
            // Netlist / overlays sans runner UI — CPU uniquement dans le worker.
            emu.markRemoteFirmware(figureId, "avr");
        } else {
            loadCode(figureId, hexCode, options);
        }
        client.loadCodeForBoard(figureId, hexCode, options);
    };
    emu.loadUf2ForBoard = (figureId, uf2) => {
        if (exclusive) {
            emu.markRemoteFirmware(figureId, "rp2040");
        } else {
            loadUf2(figureId, uf2);
        }
        client.loadUf2ForBoard(figureId, uf2);
    };
    emu.loadRp2040HexForBoard = (figureId, hexCode) => {
        if (exclusive) {
            emu.markRemoteFirmware(figureId, "rp2040");
        } else {
            loadRp(figureId, hexCode);
        }
        client.loadRp2040HexForBoard(figureId, hexCode);
    };
    emu.attachI2cDevice = (figureId, device, options) => {
        let mirrored = false;
        if (device instanceof Lcd1602I2cDevice) {
            client.attachBuiltinI2c({
                boardId: figureId,
                kind: "lcd1602",
                address: device.address,
                bus: options?.bus,
            });
            mirrored = true;
        } else if (device instanceof Ssd1306Device) {
            client.attachBuiltinI2c({
                boardId: figureId,
                kind: "ssd1306",
                address: device.address,
                bus: options?.bus,
                width: device.width,
                height: device.height,
            });
            mirrored = true;
        }
        if (exclusive && mirrored) return true;
        return attachI2c(figureId, device, options);
    };
    emu.attachSpiDevice = (figureId, device, selectOrOptions) => {
        const opts =
            typeof selectOrOptions === "boolean"
                ? { select: selectOrOptions }
                : (selectOrOptions ?? {});
        let mirrored = false;
        if (device instanceof SdCardSpiDevice) {
            client.attachBuiltinSpi({
                boardId: figureId,
                kind: "sd",
                deviceId: device.id,
                bus: opts.bus,
                select: opts.select,
                cs: opts.cs,
                activeLow: opts.activeLow,
                blockCount: device.blockCount,
            });
            mirrored = true;
        } else if (device instanceof Ili9341SpiDevice) {
            client.attachBuiltinSpi({
                boardId: figureId,
                kind: "ili9341",
                deviceId: device.id,
                bus: opts.bus,
                select: opts.select,
                cs: opts.cs,
                activeLow: opts.activeLow,
                width: device.width,
                height: device.height,
            });
            mirrored = true;
        }
        if (exclusive && mirrored) return true;
        return attachSpi(figureId, device, selectOrOptions);
    };
    emu.run = () => {
        if (!exclusive) {
            run();
        } else if (!emu.hasFirmware()) {
            throw new Error("Aucun firmware chargé. Compilez au moins une carte d’abord.");
        }
        try {
            client.run();
            client.startSnapshotPush(50);
            startExclusiveInputLoop();
        } catch {
            /* worker sans firmware */
        }
        voidDelay(0).then(() => {
            if (bridge.isAttached) mirrorNeos();
        });
    };
    emu.stop = () => {
        stopExclusiveInputLoop();
        client.stopSnapshotPush();
        if (!exclusive) stop();
        client.stop();
    };

    bridge.attach = () => {
        bridgeAttach();
        mirrorNeos();
    };

    return () => {
        stopExclusiveInputLoop();
        offSnap();
        offDev();
        client.stopSnapshotPush();
        emu.loadCodeForBoard = loadCode;
        emu.loadUf2ForBoard = loadUf2;
        emu.loadRp2040HexForBoard = loadRp;
        emu.attachI2cDevice = attachI2c;
        emu.attachSpiDevice = attachSpi;
        emu.run = run;
        emu.stop = stop;
        bridge.attach = bridgeAttach;
    };
}

function voidDelay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
