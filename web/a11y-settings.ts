/**
 * @file Options d’accessibilité (labels, police, interligne, focus, couleur UI, routeur).
 */
import {
    DEFAULT_WIRE_ROUTER,
    normalizeWireRouterId,
    setPreferredWireRouterId,
    type WireRouterId,
} from "../src/editor/connection-router-preference";

export type A11yLabelMode = "icons" | "text" | "both";
export type A11yTextAlign = "start" | "justify";
export type { WireRouterId };

export interface A11ySettings {
    labels: A11yLabelMode;
    font: string;
    fontSize: number;
    lineHeight: number;
    align: A11yTextAlign;
    strongFocus: boolean;
    accent: string;
    /** Algorithme de tracé des fils (draw2d connection router). */
    wireRouter: WireRouterId;
}

export const A11Y_STORAGE_KEY = "hackCable-a11y-settings";

export const A11Y_FONTS = [
    { id: "Rubik", stack: "Rubik, sans-serif" },
    { id: "Arial", stack: "Arial, Helvetica, sans-serif" },
    { id: "Verdana", stack: "Verdana, Geneva, sans-serif" },
    { id: "Trebuchet MS", stack: "\"Trebuchet MS\", sans-serif" },
    { id: "Georgia", stack: "Georgia, serif" },
    { id: "Atkinson Hyperlegible", stack: "\"Atkinson Hyperlegible\", sans-serif" },
    { id: "Comic Sans MS", stack: "\"Comic Sans MS\", \"Comic Sans\", cursive" },
    { id: "OpenDyslexic", stack: "OpenDyslexic, sans-serif" },
] as const;

export const DEFAULT_A11Y_SETTINGS: A11ySettings = {
    labels: "both",
    font: "Rubik",
    fontSize: 13,
    lineHeight: 1.35,
    align: "start",
    strongFocus: false,
    accent: "#2c70ff",
    wireRouter: DEFAULT_WIRE_ROUTER,
};

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function isLabelMode(value: string): value is A11yLabelMode {
    return value === "icons" || value === "text" || value === "both";
}

function isAlign(value: string): value is A11yTextAlign {
    return value === "start" || value === "justify";
}

function normalizeAccent(raw: string): string {
    const value = raw.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
        const r = value[1];
        const g = value[2];
        const b = value[3];
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return DEFAULT_A11Y_SETTINGS.accent;
}

export function normalizeA11ySettings(partial: Partial<A11ySettings> | null | undefined): A11ySettings {
    const base = { ...DEFAULT_A11Y_SETTINGS, ...(partial ?? {}) };
    const font = A11Y_FONTS.some((f) => f.id === base.font) ? base.font : DEFAULT_A11Y_SETTINGS.font;
    return {
        labels: isLabelMode(base.labels) ? base.labels : DEFAULT_A11Y_SETTINGS.labels,
        font,
        fontSize: clamp(Number(base.fontSize) || DEFAULT_A11Y_SETTINGS.fontSize, 11, 22),
        lineHeight: clamp(Number(base.lineHeight) || DEFAULT_A11Y_SETTINGS.lineHeight, 1.1, 2.2),
        align: isAlign(base.align) ? base.align : DEFAULT_A11Y_SETTINGS.align,
        strongFocus: Boolean(base.strongFocus),
        accent: normalizeAccent(String(base.accent ?? DEFAULT_A11Y_SETTINGS.accent)),
        wireRouter: normalizeWireRouterId(base.wireRouter),
    };
}

export function readA11ySettings(): A11ySettings {
    try {
        const raw = localStorage.getItem(A11Y_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_A11Y_SETTINGS };
        return normalizeA11ySettings(JSON.parse(raw) as Partial<A11ySettings>);
    } catch {
        return { ...DEFAULT_A11Y_SETTINGS };
    }
}

export function writeA11ySettings(settings: A11ySettings): void {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(normalizeA11ySettings(settings)));
}

function fontStackFor(fontId: string): string {
    return A11Y_FONTS.find((f) => f.id === fontId)?.stack ?? "Rubik, sans-serif";
}

let openDyslexicLinked = false;

function ensureOpenDyslexicFont(): void {
    if (openDyslexicLinked) return;
    openDyslexicLinked = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic.css";
    document.head.appendChild(link);
}

let atkinsonLinked = false;

function ensureAtkinsonFont(): void {
    if (atkinsonLinked) return;
    atkinsonLinked = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
    document.head.appendChild(link);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const raw = hex.replace("#", "").trim();
    const full = raw.length === 3
        ? raw.split("").map((c) => c + c).join("")
        : raw;
    const n = Number.parseInt(full, 16);
    if (!Number.isFinite(n) || full.length !== 6) {
        return { r: 44, g: 112, b: 255 };
    }
    return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255,
    };
}

/** Palette dérivée de l’accent (CSS + canvas). */
export function getUiAccentPalette(accentHex = DEFAULT_A11Y_SETTINGS.accent): {
    hex: string;
    rgb: string;
    soft: string;
    muted: string;
    strong: string;
} {
    const hex = normalizeAccent(accentHex);
    const { r, g, b } = hexToRgb(hex);
    return {
        hex,
        rgb: `${r}, ${g}, ${b}`,
        soft: `rgba(${r}, ${g}, ${b}, 0.18)`,
        muted: `rgba(${r}, ${g}, ${b}, 0.45)`,
        strong: `rgba(${r}, ${g}, ${b}, 0.85)`,
    };
}

export function readAccentFromDocument(): ReturnType<typeof getUiAccentPalette> {
    const fromCss = getComputedStyle(document.documentElement).getPropertyValue("--hc-accent").trim();
    return getUiAccentPalette(fromCss || DEFAULT_A11Y_SETTINGS.accent);
}

/** Applique les réglages via variables CSS et attributs sur `<html>`. */
export function applyA11ySettings(settings: A11ySettings): void {
    const s = normalizeA11ySettings(settings);
    if (s.font === "OpenDyslexic") ensureOpenDyslexicFont();
    if (s.font === "Atkinson Hyperlegible") ensureAtkinsonFont();

    const palette = getUiAccentPalette(s.accent);
    const root = document.documentElement;
    root.style.setProperty("--hc-ui-font", fontStackFor(s.font));
    root.style.setProperty("--hc-ui-font-size", `${s.fontSize}px`);
    root.style.setProperty("--hc-ui-line-height", String(s.lineHeight));
    root.style.setProperty("--hc-ui-text-align", s.align);
    root.style.setProperty("--hc-accent", palette.hex);
    root.style.setProperty("--hc-accent-rgb", palette.rgb);
    root.style.setProperty("--hc-accent-soft", palette.soft);
    root.style.setProperty("--hc-accent-muted", palette.muted);
    root.style.setProperty("--hc-accent-strong", palette.strong);
    root.style.setProperty("--hc-focus-outline-width", s.strongFocus ? "4px" : "2px");
    root.style.setProperty("--hc-focus-outline-offset", s.strongFocus ? "3px" : "2px");
    root.dataset.a11yLabels = s.labels;
    root.dataset.a11yStrongFocus = s.strongFocus ? "true" : "false";
    root.dataset.a11yAlign = s.align;
    root.dataset.a11yWireRouter = s.wireRouter;
    setPreferredWireRouterId(s.wireRouter);

    document.dispatchEvent(new CustomEvent("hackcable:a11y-changed", { detail: s }));
}

export function parseA11yFromUrlParams(params: URLSearchParams): Partial<A11ySettings> {
    const partial: Partial<A11ySettings> = {};

    const labels = params.get("labels") ?? params.get("a11yLabels");
    if (labels && isLabelMode(labels)) partial.labels = labels;

    const font = params.get("font") ?? params.get("a11yFont");
    if (font) partial.font = decodeURIComponent(font);

    const fontSize = params.get("fontsize") ?? params.get("fontSize");
    if (fontSize != null && fontSize !== "") partial.fontSize = Number(fontSize);

    const lineHeight = params.get("lineheight") ?? params.get("lineHeight");
    if (lineHeight != null && lineHeight !== "") partial.lineHeight = Number(lineHeight);

    const align = params.get("align") ?? params.get("textalign");
    if (align && isAlign(align)) partial.align = align;

    if (params.has("focus") || params.has("strongfocus")) {
        const raw = params.get("focus") ?? params.get("strongfocus");
        partial.strongFocus = raw === null || raw === "" || raw === "1" || raw === "true" || raw === "on";
    }
    if (params.has("nofocus")) partial.strongFocus = false;

    const accent = params.get("accent") ?? params.get("color") ?? params.get("couleur");
    if (accent) partial.accent = decodeURIComponent(accent.startsWith("#") ? accent : `#${accent}`);

    const wireRouter = params.get("router") ?? params.get("wireRouter") ?? params.get("wirerouter");
    if (wireRouter) partial.wireRouter = normalizeWireRouterId(decodeURIComponent(wireRouter));

    return partial;
}

export function writeA11yToUrlParams(params: URLSearchParams, settings: A11ySettings): void {
    const s = normalizeA11ySettings(settings);
    params.set("labels", s.labels);
    params.set("font", s.font);
    params.set("fontsize", String(s.fontSize));
    params.set("lineheight", String(s.lineHeight));
    params.set("align", s.align);
    params.set("focus", s.strongFocus ? "1" : "0");
    params.set("accent", s.accent.replace(/^#/, ""));
    params.set("router", s.wireRouter);
}
