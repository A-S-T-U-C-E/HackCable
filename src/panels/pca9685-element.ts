/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Overlay catalogue PCA9685 (I²C) — pas d’élément Wokwi officiel.
 */
import type { ElementPin } from "@wokwi/elements";

const TAG = "hackcable-pca9685";

/**
 * Carte PCA9685 minimaliste : broches SDA/SCL/VCC/GND + angles canaux 0–15.
 */
export class Pca9685Element extends HTMLElement {
    /** Adresse I²C 7 bits (défaut 0x40). */
    i2cAddress = 0x40;
    /** Angles servo estimés (°) par canal, mis à jour par le bridge. */
    angles: number[] = Array.from({ length: 16 }, () => 0);

    private root: ShadowRoot;

    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.render();
    }

    get pinInfo(): ElementPin[] {
        // Coordonnées en px (repère overlay Wokwi-like)
        return [
            { name: "VCC", x: 12, y: 88, signals: [] },
            { name: "GND", x: 28, y: 88, signals: [] },
            { name: "SDA", x: 44, y: 88, signals: [] },
            { name: "SCL", x: 60, y: 88, signals: [] },
        ];
    }

    connectedCallback(): void {
        this.render();
    }

    /** Rafraîchit le bandeau d’angles (appelé par le bridge). */
    refresh(): void {
        const label = this.root.getElementById("angles");
        if (!label) return;
        const sample = this.angles
            .slice(0, 4)
            .map((a, i) => `ch${i}:${Math.round(a)}°`)
            .join("  ");
        label.textContent = sample || "PCA9685";
    }

    private render(): void {
        const addr = `0x${(this.i2cAddress & 0x7f).toString(16)}`;
        this.root.innerHTML = `
      <style>
        :host { display: inline-block; font-family: ui-monospace, Consolas, monospace; }
        .board {
          width: 72px; height: 96px;
          background: linear-gradient(160deg, #1a5c3a 0%, #0d3d26 100%);
          border: 2px solid #0a2818;
          border-radius: 4px;
          color: #e8ffe8;
          box-sizing: border-box;
          padding: 6px 4px;
          position: relative;
        }
        .title { font-size: 9px; font-weight: 700; letter-spacing: 0.04em; }
        .addr { font-size: 8px; opacity: 0.85; margin-top: 2px; }
        #angles { font-size: 7px; margin-top: 8px; line-height: 1.25; opacity: 0.95; }
        .pin-row {
          position: absolute; left: 4px; right: 4px; bottom: 4px;
          display: flex; justify-content: space-between;
          font-size: 6px; opacity: 0.7;
        }
      </style>
      <div class="board" part="board">
        <div class="title">PCA9685</div>
        <div class="addr">${addr}</div>
        <div id="angles">ch0:0°  ch1:0°  ch2:0°  ch3:0°</div>
        <div class="pin-row"><span>VCC</span><span>GND</span><span>SDA</span><span>SCL</span></div>
      </div>
    `;
    }
}

if (!customElements.get(TAG)) {
    customElements.define(TAG, Pca9685Element);
}
