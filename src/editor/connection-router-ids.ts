/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Identifiants et préférence utilisateur pour les routeurs de fils.
 *
 * Responsabilités :
 * - Énumérer les algorithmes exposés dans l’UI accessibilité
 * - Valider / normaliser l’id stocké (localStorage, URL)
 */
export type WireRouterId =
    | "manhattan"
    | "manhattanBridged"
    | "interactiveManhattan"
    | "interactiveManhattanBridged"
    | "circuit"
    | "direct"
    | "spline"
    | "maze"
    | "sketch"
    | "fan";

export type WireRouterOption = {
    id: WireRouterId;
    /** Clé i18n sous `a11y.router*` */
    labelKey: string;
};

/** Options du panneau Accessibilité (ordre proche de l’exemple draw2d). */
export const WIRE_ROUTER_OPTIONS: readonly WireRouterOption[] = [
    { id: "manhattan", labelKey: "a11y.routerManhattan" },
    { id: "manhattanBridged", labelKey: "a11y.routerManhattanBridged" },
    { id: "interactiveManhattan", labelKey: "a11y.routerInteractiveManhattan" },
    { id: "interactiveManhattanBridged", labelKey: "a11y.routerInteractiveManhattanBridged" },
    { id: "circuit", labelKey: "a11y.routerCircuit" },
    { id: "direct", labelKey: "a11y.routerDirect" },
    { id: "spline", labelKey: "a11y.routerSpline" },
    { id: "maze", labelKey: "a11y.routerMaze" },
    { id: "sketch", labelKey: "a11y.routerSketch" },
    { id: "fan", labelKey: "a11y.routerFan" },
] as const;

export const DEFAULT_WIRE_ROUTER: WireRouterId = "interactiveManhattanBridged";

const ROUTER_IDS = new Set<string>(WIRE_ROUTER_OPTIONS.map((o) => o.id));

/**
 * Garde de type pour une chaîne issue de l'UI ou de l'URL.
 * @param value - Chaîne candidate.
 * @returns `true` si la valeur est un `WireRouterId` valide.
 */
export function isWireRouterId(value: string): value is WireRouterId {
    return ROUTER_IDS.has(value);
}

/**
 * Normalise une valeur en identifiant de routeur valide.
 * @param value - Valeur brute (localStorage, URL, etc.).
 * @returns Identifiant valide ou routeur par défaut.
 */
export function normalizeWireRouterId(value: unknown): WireRouterId {
    return typeof value === "string" && isWireRouterId(value) ? value : DEFAULT_WIRE_ROUTER;
}

let preferredWireRouterId: WireRouterId = DEFAULT_WIRE_ROUTER;

/**
 * Retourne le routeur de fils actuellement préféré.
 * @returns Identifiant du routeur actif en mémoire.
 */
export function getPreferredWireRouterId(): WireRouterId {
    return preferredWireRouterId;
}

/**
 * Définit le routeur de fils préféré.
 * @param id - Identifiant ou chaîne à normaliser.
 * @returns Identifiant effectivement appliqué.
 */
export function setPreferredWireRouterId(id: WireRouterId | string): WireRouterId {
    preferredWireRouterId = normalizeWireRouterId(id);
    return preferredWireRouterId;
}
