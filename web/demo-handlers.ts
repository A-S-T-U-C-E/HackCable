/**
 * @file Branchements UI de la démo web (catalogue, fichiers, langue, undo/redo, URL).
 */
import i18next from "i18next";
import type { Editor } from "../src/editor/editor";
import type { HackCable } from "../src/main";
import { isMinimapVisible, setMinimapVisible } from "../src/editor/canvas-minimap";
import {
    normalizeHackCableLanguage,
    type HackCableLanguage,
} from "../src/ui/i18n/languages";
import { applyWebDemoUiI18n, buildHackCableSaveFilename, downloadJsonFile, formatSyncProgress, isEditorSaveData, resolveUiLanguage } from "./demo-utils";
import { askLoadMergeChoice } from "./load-merge-dialog";
import { readA11ySettings } from "./a11y-settings";
import { writeUrlDemoOptions } from "./url-options";

function syncDemoUrl(hackCable: HackCable): void {
    writeUrlDemoOptions({
        lang: resolveUiLanguage(),
        minimap: isMinimapVisible(),
        autocollapse: hackCable.catalog.isAutoCollapseEnabled(),
        a11y: readA11ySettings(),
    });
}

function getButtonLabelEl(button: HTMLElement): HTMLElement | null {
    return button.querySelector(".hackCable-btn-label");
}

function setButtonLabelText(button: HTMLElement, text: string): void {
    const label = getButtonLabelEl(button);
    if (label) label.textContent = text;
    else button.textContent = text;
    button.title = text;
    button.setAttribute("aria-label", text);
}

export function setupCatalogUpdate(hackCable: HackCable, signal: AbortSignal): void {
    const updateButton = document.getElementById("update-catalog");
    if (!updateButton) return;

    updateButton.addEventListener("click", () => {
        void (async () => {
            const labelEl = getButtonLabelEl(updateButton);
            const previousLabel = labelEl?.textContent ?? updateButton.textContent ?? "";
            updateButton.setAttribute("disabled", "true");
            updateButton.classList.add("is-syncing");
            try {
                const result = await hackCable.updateFritzingCatalog((progress) => {
                    setButtonLabelText(updateButton, formatSyncProgress(progress));
                });
                const t = (k: string, vars?: Record<string, unknown>) => i18next.t(k, { ns: "common", ...vars });
                if (result.upToDate) {
                    alert(t("web.updateUpToDate", { total: result.total }));
                } else {
                    alert(t("web.updateDone", {
                        added: result.added,
                        updated: result.updated,
                        removed: result.removed,
                        total: result.total,
                    }));
                }
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                alert(`${i18next.t("web.updateFailed", { ns: "common" })}:\n\n${detail}`);
            } finally {
                updateButton.classList.remove("is-syncing");
                updateButton.removeAttribute("disabled");
                setButtonLabelText(updateButton, previousLabel);
                applyWebDemoUiI18n();
            }
        })();
    }, { signal });
}

export function setupSaveRestore(editor: Editor, signal: AbortSignal): HTMLInputElement {
    const save = document.getElementById("save");
    const restore = document.getElementById("restore");
    const restoreFileInput = document.createElement("input");
    restoreFileInput.type = "file";
    restoreFileInput.accept = ".hackcable,.json,application/json";
    restoreFileInput.hidden = true;
    document.body.appendChild(restoreFileInput);

    const tWarn = (key: string) => i18next.t(key, { ns: "common" });

    save?.addEventListener("click", () => {
        const data = editor.getEditorSaveData();
        downloadJsonFile(buildHackCableSaveFilename(), data);
    }, { signal });

    restore?.addEventListener("click", () => {
        restoreFileInput.value = "";
        restoreFileInput.click();
    }, { signal });

    restoreFileInput.addEventListener("change", () => {
        const file = restoreFileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            void (async () => {
                try {
                    const text = typeof reader.result === "string" ? reader.result : "";
                    const parsed: unknown = JSON.parse(text);
                    if (!isEditorSaveData(parsed)) {
                        alert(tWarn("web.loadInvalidShape"));
                        return;
                    }

                    if (editor.isWorkspaceEmpty()) {
                        editor.loadEditorSaveData(parsed, "replace");
                        return;
                    }

                    const choice = await askLoadMergeChoice();
                    if (choice === "cancel") return;
                    editor.loadEditorSaveData(parsed, choice);
                } catch {
                    alert(tWarn("web.loadInvalidJson"));
                }
            })();
        };
        reader.onerror = () => alert(tWarn("web.loadFileError"));
        reader.readAsText(file, "UTF-8");
    }, { signal });

    return restoreFileInput;
}

export function setupLanguageSelect(hackCable: HackCable, signal: AbortSignal): void {
    const select = document.getElementById("language-select");
    if (!(select instanceof HTMLSelectElement)) return;

    const syncSelect = () => {
        select.value = resolveUiLanguage();
    };
    syncSelect();

    select.addEventListener("change", () => {
        void (async () => {
            const code = normalizeHackCableLanguage(select.value) ?? "fr_fr";
            if (code === resolveUiLanguage()) return;
            localStorage.setItem("hackCable-webExample-language", code);
            await hackCable.changeLanguage(code);
            applyWebDemoUiI18n();
            syncSelect();
            syncDemoUrl(hackCable);
        })();
    }, { signal });
}

export function setupMinimapToggle(hackCable: HackCable, signal: AbortSignal): void {
    const checkbox = document.getElementById("show-minimap");
    if (!(checkbox instanceof HTMLInputElement)) return;

    checkbox.checked = isMinimapVisible();
    setMinimapVisible(checkbox.checked);

    checkbox.addEventListener("change", () => {
        setMinimapVisible(checkbox.checked);
        syncDemoUrl(hackCable);
    }, { signal });
}

export function setupCatalogUrlSync(hackCable: HackCable): void {
    hackCable.catalog.setAutoCollapseChangeListener(() => {
        syncDemoUrl(hackCable);
    });
    syncDemoUrl(hackCable);
}

function refreshUndoRedoButtons(editor: Editor): void {
    const undoBtn = document.getElementById("undo");
    const redoBtn = document.getElementById("redo");
    if (undoBtn instanceof HTMLButtonElement) undoBtn.disabled = !editor.canUndo();
    if (redoBtn instanceof HTMLButtonElement) redoBtn.disabled = !editor.canRedo();
}

export function setupUndoRedo(editor: Editor, signal: AbortSignal): void {
    const undoBtn = document.getElementById("undo");
    const redoBtn = document.getElementById("redo");

    undoBtn?.addEventListener("click", () => {
        editor.undo();
        refreshUndoRedoButtons(editor);
    }, { signal });

    redoBtn?.addEventListener("click", () => {
        editor.redo();
        refreshUndoRedoButtons(editor);
    }, { signal });

    const onKeyDown = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) {
            event.preventDefault();
            editor.undo();
            refreshUndoRedoButtons(editor);
        } else if (key === "y" || (key === "z" && event.shiftKey)) {
            event.preventDefault();
            editor.redo();
            refreshUndoRedoButtons(editor);
        }
    };
    document.addEventListener("keydown", onKeyDown, { signal });

    const canvas = editor.canvas;
    const onCanvasChange = () => refreshUndoRedoButtons(editor);
    canvas.on("figure:add", onCanvasChange);
    canvas.on("figure:remove", onCanvasChange);
    canvas.on("figure:move", onCanvasChange);
    canvas.on("connect", onCanvasChange);
    canvas.on("disconnect", onCanvasChange);

    const stack = canvas.getCommandStack() as {
        addEventListener?: (listener: unknown) => void;
        removeEventListener?: (listener: unknown) => void;
    };
    const onStackEvent = () => refreshUndoRedoButtons(editor);
    stack.addEventListener?.(onStackEvent);

    signal.addEventListener("abort", () => {
        canvas.off("figure:add", onCanvasChange);
        canvas.off("figure:remove", onCanvasChange);
        canvas.off("figure:move", onCanvasChange);
        canvas.off("connect", onCanvasChange);
        canvas.off("disconnect", onCanvasChange);
        stack.removeEventListener?.(onStackEvent);
    });

    refreshUndoRedoButtons(editor);
}

export type { HackCableLanguage };
