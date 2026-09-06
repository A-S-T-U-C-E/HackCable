/**
 * @file Panneau d’options d’accessibilité (style µcBlockly).
 */
import i18next from "i18next";
import {
    A11Y_FONTS,
    type A11ySettings,
    applyA11ySettings,
    normalizeA11ySettings,
    readA11ySettings,
    writeA11ySettings,
} from "./a11y-settings";
import { WIRE_ROUTER_OPTIONS } from "../src/editor/connection-router-preference";

type OnChange = (settings: A11ySettings) => void;

function t(key: string): string {
    return i18next.t(key, { ns: "common" });
}

function fieldRow(label: HTMLElement, control: HTMLElement): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "hackCable-a11y-row";
    row.append(label, control);
    return row;
}

export function setupA11yPanel(signal: AbortSignal, onChange: OnChange): () => void {
    const openBtn = document.getElementById("a11y-open");
    let dialog = document.getElementById("a11y-dialog");

    if (!(openBtn instanceof HTMLButtonElement)) {
        return () => undefined;
    }

    if (!(dialog instanceof HTMLDialogElement)) {
        dialog = document.createElement("dialog");
        dialog.id = "a11y-dialog";
        dialog.className = "hackCable-a11y-dialog";
        document.body.appendChild(dialog);
    }

    const panel = dialog as HTMLDialogElement;
    let settings = readA11ySettings();

    const rebuild = () => {
        panel.innerHTML = "";

        const title = document.createElement("h2");
        title.id = "a11y-dialog-title";
        title.className = "hackCable-a11y-dialog-title";
        title.textContent = t("a11y.title");

        const form = document.createElement("form");
        form.className = "hackCable-a11y-form";
        form.method = "dialog";

        // Labels mode
        const labelsLabel = document.createElement("label");
        labelsLabel.htmlFor = "a11y-labels";
        labelsLabel.textContent = t("a11y.labels");
        const labelsSelect = document.createElement("select");
        labelsSelect.id = "a11y-labels";
        for (const [value, key] of [
            ["both", "a11y.labelsBoth"],
            ["icons", "a11y.labelsIcons"],
            ["text", "a11y.labelsText"],
        ] as const) {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = t(key);
            if (settings.labels === value) opt.selected = true;
            labelsSelect.appendChild(opt);
        }

        // Font
        const fontLabel = document.createElement("label");
        fontLabel.htmlFor = "a11y-font";
        fontLabel.textContent = t("a11y.font");
        const fontSelect = document.createElement("select");
        fontSelect.id = "a11y-font";
        for (const font of A11Y_FONTS) {
            const opt = document.createElement("option");
            opt.value = font.id;
            opt.textContent = font.id;
            opt.style.fontFamily = font.stack;
            if (settings.font === font.id) opt.selected = true;
            fontSelect.appendChild(opt);
        }

        // Font size
        const sizeLabel = document.createElement("label");
        sizeLabel.htmlFor = "a11y-fontsize";
        sizeLabel.textContent = t("a11y.fontSize");
        const sizeInput = document.createElement("input");
        sizeInput.type = "range";
        sizeInput.id = "a11y-fontsize";
        sizeInput.min = "11";
        sizeInput.max = "22";
        sizeInput.step = "1";
        sizeInput.value = String(settings.fontSize);
        const sizeValue = document.createElement("span");
        sizeValue.className = "hackCable-a11y-value";
        sizeValue.textContent = `${settings.fontSize}px`;
        const sizeWrap = document.createElement("div");
        sizeWrap.className = "hackCable-a11y-range";
        sizeWrap.append(sizeInput, sizeValue);

        // Line height
        const lhLabel = document.createElement("label");
        lhLabel.htmlFor = "a11y-lineheight";
        lhLabel.textContent = t("a11y.lineHeight");
        const lhInput = document.createElement("input");
        lhInput.type = "range";
        lhInput.id = "a11y-lineheight";
        lhInput.min = "1.1";
        lhInput.max = "2.2";
        lhInput.step = "0.05";
        lhInput.value = String(settings.lineHeight);
        const lhValue = document.createElement("span");
        lhValue.className = "hackCable-a11y-value";
        lhValue.textContent = settings.lineHeight.toFixed(2);
        const lhWrap = document.createElement("div");
        lhWrap.className = "hackCable-a11y-range";
        lhWrap.append(lhInput, lhValue);

        // Align
        const alignLabel = document.createElement("label");
        alignLabel.htmlFor = "a11y-align";
        alignLabel.textContent = t("a11y.align");
        const alignSelect = document.createElement("select");
        alignSelect.id = "a11y-align";
        for (const [value, key] of [
            ["start", "a11y.alignStart"],
            ["justify", "a11y.alignJustify"],
        ] as const) {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = t(key);
            if (settings.align === value) opt.selected = true;
            alignSelect.appendChild(opt);
        }

        // Strong focus
        const focusWrap = document.createElement("label");
        focusWrap.className = "hackCable-a11y-check";
        focusWrap.htmlFor = "a11y-focus";
        const focusInput = document.createElement("input");
        focusInput.type = "checkbox";
        focusInput.id = "a11y-focus";
        focusInput.checked = settings.strongFocus;
        const focusText = document.createElement("span");
        focusText.textContent = t("a11y.strongFocus");
        focusWrap.append(focusInput, focusText);

        // Accent color
        const accentLabel = document.createElement("label");
        accentLabel.htmlFor = "a11y-accent";
        accentLabel.textContent = t("a11y.accent");
        const accentInput = document.createElement("input");
        accentInput.type = "color";
        accentInput.id = "a11y-accent";
        accentInput.value = settings.accent;

        // Wire router (draw2d connection algorithms)
        const routerLabel = document.createElement("label");
        routerLabel.htmlFor = "a11y-wire-router";
        routerLabel.textContent = t("a11y.wireRouter");
        const routerSelect = document.createElement("select");
        routerSelect.id = "a11y-wire-router";
        for (const option of WIRE_ROUTER_OPTIONS) {
            const opt = document.createElement("option");
            opt.value = option.id;
            opt.textContent = t(option.labelKey);
            if (settings.wireRouter === option.id) opt.selected = true;
            routerSelect.appendChild(opt);
        }

        const commit = () => {
            settings = normalizeA11ySettings({
                labels: labelsSelect.value as A11ySettings["labels"],
                font: fontSelect.value,
                fontSize: Number(sizeInput.value),
                lineHeight: Number(lhInput.value),
                align: alignSelect.value as A11ySettings["align"],
                strongFocus: focusInput.checked,
                accent: accentInput.value,
                wireRouter: routerSelect.value as A11ySettings["wireRouter"],
            });
            sizeValue.textContent = `${settings.fontSize}px`;
            lhValue.textContent = settings.lineHeight.toFixed(2);
            writeA11ySettings(settings);
            applyA11ySettings(settings);
            onChange(settings);
        };

        labelsSelect.addEventListener("change", commit);
        fontSelect.addEventListener("change", commit);
        sizeInput.addEventListener("input", commit);
        lhInput.addEventListener("input", commit);
        alignSelect.addEventListener("change", commit);
        focusInput.addEventListener("change", commit);
        accentInput.addEventListener("input", commit);
        routerSelect.addEventListener("change", commit);

        const actions = document.createElement("div");
        actions.className = "hackCable-a11y-actions";

        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "hackCable-a11y-reset";
        resetBtn.textContent = t("a11y.reset");
        resetBtn.addEventListener("click", () => {
            settings = normalizeA11ySettings(null);
            writeA11ySettings(settings);
            applyA11ySettings(settings);
            onChange(settings);
            rebuild();
        });

        const closeBtn = document.createElement("button");
        closeBtn.type = "submit";
        closeBtn.className = "hackCable-a11y-close";
        closeBtn.textContent = t("a11y.close");

        actions.append(resetBtn, closeBtn);

        form.append(
            fieldRow(labelsLabel, labelsSelect),
            fieldRow(fontLabel, fontSelect),
            fieldRow(sizeLabel, sizeWrap),
            fieldRow(lhLabel, lhWrap),
            fieldRow(alignLabel, alignSelect),
            focusWrap,
            fieldRow(accentLabel, accentInput),
            fieldRow(routerLabel, routerSelect),
            actions,
        );

        panel.setAttribute("aria-labelledby", "a11y-dialog-title");
        panel.append(title, form);
    };

    const open = () => {
        settings = readA11ySettings();
        rebuild();
        if (!panel.open) panel.showModal();
    };

    const onOpenClick = () => open();
    openBtn.addEventListener("click", onOpenClick, { signal });

    const onDialogClick = (event: MouseEvent) => {
        if (event.target === panel) panel.close();
    };
    panel.addEventListener("click", onDialogClick, { signal });

    const refreshLabels = () => {
        openBtn.title = t("a11y.title");
        openBtn.setAttribute("aria-label", t("a11y.title"));
        const label = openBtn.querySelector(".hackCable-btn-label");
        if (label) label.textContent = t("a11y.open");
        if (panel.open) rebuild();
    };

    refreshLabels();

    return () => {
        refreshLabels();
    };
}

export function refreshA11yPanelI18n(): void {
    const openBtn = document.getElementById("a11y-open");
    if (!(openBtn instanceof HTMLButtonElement)) return;
    openBtn.title = t("a11y.title");
    openBtn.setAttribute("aria-label", t("a11y.title"));
    const label = openBtn.querySelector(".hackCable-btn-label");
    if (label) label.textContent = t("a11y.open");
}
