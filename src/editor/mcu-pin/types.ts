/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Types publics de la table des broches MCU.
 *
 * Responsabilités :
 * - Définir les structures stables pour intégrateurs (µcBlockly, etc.)
 * - Documenter source Wokwi vs Fritzing
 *
 * @see docs/mcu-pin-api.md
 */
/** Autre extrémité d’un fil branché sur une broche MCU. */
export type McuPinPeerConnection = {
    peerFigureId: string;
    peerComponentId: number;
    /** Clé draw2d du port distant (`portId`). */
    peerPortKey: string;
    /** Libellé lisible si connu (ex. nom Fritzing). */
    peerPortLabel?: string;
    /** Label optionnel posé sur le fil. */
    wireLabel?: string;
};

/** Statut d’une broche d’une carte MCU. */
export type McuPinStatus = {
    /**
     * Clé draw2d pour `getPortByName`.
     * Fritzing : souvent `connector0` ; Wokwi : souvent `"13"`.
     */
    pinKey: string;
    /** Libellé humain (ex. `D13`, `GND`). */
    pinLabel: string;
    /** Au moins un fil est branché. */
    connected: boolean;
    connections: McuPinPeerConnection[];
};

/** Table complète pour une instance de carte sur le canvas. */
export type McuBoardPinTable = {
    figureId: string;
    componentId: number;
    boardName: string;
    source: "wokwi" | "fritzing";
    /** Identifiant module FZP (Fritzing uniquement). */
    moduleId?: string;
    family?: string;
    category: string;
    /**
     * `true` si le SVG Fritzing n’a pas encore créé les pastilles :
     * la liste des broches vient du catalogue, mais `connected` reste faux.
     */
    portsPending: boolean;
    pins: McuPinStatus[];
};

/** Liste des cartes MCU présentes sur le plan. */
export type McuPinConnectionTable = McuBoardPinTable[];

/** Callback notifié quand le câblage MCU change. */
export type McuPinTableChangeListener = (table: McuPinConnectionTable) => void;

/** Descripteur interne (avant lecture des connexions). */
export type McuPinDescriptor = {
    pinKey: string;
    pinLabel: string;
};
