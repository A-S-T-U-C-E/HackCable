/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Labels éditables sur les connexions (style draw2d connection_custom_labeld).
 *
 * Responsabilités :
 * - Ajouter / lire / supprimer le texte au milieu d’un fil
 * - Édition au double-clic
 *
 * @see https://freegroup.github.io/draw2d/#/examples/connection_custom_labeld
 */
import draw2d from "draw2d";
import { tr } from "../ui/i18n/translate";

const LABEL_FLAG = "hackCableWireLabel";

type ConnLike = {
    add: (child: unknown, locator: unknown) => void;
    remove: (child: unknown) => void;
    getChildren: () => {
        data?: Array<{ figure?: LabelLike } | LabelLike>;
        each?: (fn: (i: number, entry: { figure?: LabelLike } | LabelLike) => void) => void;
        getSize?: () => number;
        get?: (i: number) => { figure?: LabelLike } | LabelLike;
    };
};

type LabelLike = {
    getText?: () => string;
    setText?: (t: string) => void;
    editor?: { start: (label: LabelLike) => void } | null;
    userData?: Record<string, unknown> | null;
    getUserData?: () => Record<string, unknown> | null;
    setUserData?: (data: Record<string, unknown>) => void;
};

function isWireLabel(figure: unknown): figure is LabelLike {
    if (!figure || typeof figure !== "object") return false;
    const f = figure as LabelLike;
    const data = typeof f.getUserData === "function" ? f.getUserData() : f.userData;
    return Boolean(data && data[LABEL_FLAG]);
}

function eachChildFigure(conn: ConnLike, fn: (figure: LabelLike) => void): void {
    const children = conn.getChildren?.();
    if (!children) return;
    if (typeof children.each === "function") {
        children.each((_i, entry) => {
            const figure = (entry as { figure?: LabelLike })?.figure ?? (entry as LabelLike);
            if (figure) fn(figure);
        });
        return;
    }
    const data = children.data;
    if (Array.isArray(data)) {
        for (const entry of data) {
            const figure = (entry as { figure?: LabelLike })?.figure ?? (entry as LabelLike);
            if (figure) fn(figure);
        }
    }
}

/**
 * Retourne le label déjà présent sur la connexion, ou null.
 * @param conn - Connexion draw2d.
 * @returns Figure label ou `null`.
 */
export function getConnectionWireLabel(conn: unknown): LabelLike | null {
    if (!conn || typeof conn !== "object") return null;
    let found: LabelLike | null = null;
    eachChildFigure(conn as ConnLike, (figure) => {
        if (!found && isWireLabel(figure)) found = figure;
    });
    return found;
}

/**
 * Retourne le texte du label de fil, ou undefined.
 * @param conn - Connexion draw2d.
 * @returns Texte non vide ou `undefined`.
 */
export function getConnectionWireLabelText(conn: unknown): string | undefined {
    const label = getConnectionWireLabel(conn);
    if (!label || typeof label.getText !== "function") return undefined;
    const text = String(label.getText() ?? "").trim();
    return text.length > 0 ? text : undefined;
}

/**
 * Crée (ou remplace) un label au milieu du fil, éditable au double-clic.
 * @param conn - Connexion draw2d.
 * @param text - Texte initial (défaut i18n si absent).
 * @param options - `startEdit: false` pour ne pas ouvrir l'éditeur inline.
 * @returns Instance label draw2d créée.
 */
export function addConnectionWireLabel(conn: unknown, text?: string, options?: { startEdit?: boolean }): LabelLike {
    const connection = conn as ConnLike;
    const existing = getConnectionWireLabel(conn);
    if (existing) {
        connection.remove(existing);
    }

    const labelText = text?.trim() || tr("web.ctxLabelDefault");
    const label = new draw2d.shape.basic.Label({
        text: labelText,
        color: "#0d0d0d",
        fontColor: "#0d0d0d",
        bgColor: "#ffffff",
        stroke: 1,
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
    });

    if (typeof label.setUserData === "function") {
        label.setUserData({ [LABEL_FLAG]: true });
    } else {
        (label as LabelLike).userData = { [LABEL_FLAG]: true };
    }

    label.installEditor(new draw2d.ui.LabelInplaceEditor());
    connection.add(label, new draw2d.layout.locator.ManhattanMidpointLocator());

    if (options?.startEdit !== false) {
        // Laisse le menu se fermer / le layout se poser avant l’éditeur inline.
        requestAnimationFrame(() => {
            label.editor?.start?.(label);
        });
    }

    return label;
}

/**
 * Supprime le label de fil s'il existe.
 * @param conn - Connexion draw2d.
 * @returns `true` si un label a été retiré.
 */
export function removeConnectionWireLabel(conn: unknown): boolean {
    const label = getConnectionWireLabel(conn);
    if (!label) return false;
    (conn as ConnLike).remove(label);
    return true;
}
