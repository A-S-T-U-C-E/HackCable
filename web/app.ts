import i18next from "i18next";
import type { EditorSaveData } from "../src/editor/editor";
import {
    CompileResult,
    EmulatorManager,
    HackCable,
    initHackCableI18n,
} from "../src/main";

function isEditorSaveData(x: unknown): x is EditorSaveData {
    if (x === null || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    return Array.isArray(o.figures) && Array.isArray(o.connections);
}

function downloadJsonFile(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function applyWebDemoUiI18n(): void {
    const t = (k: string) => i18next.t(k, { ns: "common" });
    const setBtn = (id: string, key: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = t(key);
    };
    setBtn("compile", "web.compile");
    setBtn("execute", "web.execute");
    setBtn("stop", "web.stop");
    setBtn("pause", "web.pause");
    setBtn("save", "web.save");
    setBtn("restore", "web.restore");
    setBtn("restore-local", "web.restoreLocal");
    setBtn("undo", "web.undo");
    setBtn("redo", "web.redo");
    setBtn("language-en", "web.langEn");
    setBtn("language-fr", "web.langFr");
    const labelCode = document.querySelector('label[for="code-editor"]');
    if (labelCode) labelCode.textContent = t("web.labelCode");
    const labelHex = document.querySelector('label[for="code-compiled"]');
    if (labelHex) labelHex.textContent = t("web.labelHex");
    document.documentElement.lang = i18next.language.startsWith("en") ? "en" : "fr";
}

/**
 * Monte la démo web. Retourne une fonction pour retirer les écouteurs (HMR).
 */
export async function mountWebDemoApp(): Promise<() => void> {
    const ac = new AbortController();
    const { signal } = ac;

    const mountingDiv = document.getElementById("hackCable");
    if (!mountingDiv) throw new DOMException("Mounting div not found");

    mountingDiv.innerHTML = "";
    mountingDiv.classList.remove("hackCable-root");

    const lang = localStorage.getItem("hackCable-webExample-language") ?? "fr_fr";
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
        .process;
    const debugI18n = proc?.env?.NODE_ENV === "development";

    await initHackCableI18n(lang, debugI18n);

    const hackCable = new HackCable(mountingDiv, lang);
    applyWebDemoUiI18n();

    const compileButton = document.getElementById("compile");
    const executeButton = document.getElementById("execute");
    const stopButton = document.getElementById("stop");
    const pauseButton = document.getElementById("pause");
    const codeInput = document.getElementById("code-editor");
    const hexInput = document.getElementById("code-compiled");

    if (
        compileButton &&
        executeButton &&
        stopButton &&
        pauseButton &&
        codeInput instanceof HTMLTextAreaElement &&
        hexInput instanceof HTMLTextAreaElement
    ) {
        const code = localStorage.getItem("hackCable-webExample-inputCode");
        if (code) codeInput.value = code;
        const hex = localStorage.getItem("hackCable-webExample-inputHex");
        if (hex) hexInput.value = hex;

        function compile() {
            if (codeInput instanceof HTMLTextAreaElement && hexInput instanceof HTMLTextAreaElement) {
                console.log("Compiling...");
                localStorage.setItem("hackCable-webExample-inputCode", codeInput.value);
                hackCable.emulatorManager.compileAndLoadCode(codeInput.value).then(() => {});
                EmulatorManager.compileCode(codeInput.value).then((data: CompileResult) => {
                    if (data) {
                        console.log("done");
                        hexInput.value = data.hex;
                        localStorage.setItem("hackCable-webExample-inputHex", data.hex);
                    }
                });
            }
        }
        function execute() {
            hackCable.emulatorManager.stop();
            if (hexInput instanceof HTMLTextAreaElement) {
                localStorage.setItem("hackCable-webExample-inputHex", hexInput.value);
                hackCable.emulatorManager.loadCode(hexInput.value);
                hackCable.emulatorManager.run();
            }
        }

        compileButton.addEventListener("click", () => compile(), { signal });
        executeButton.addEventListener("click", () => execute(), { signal });
        stopButton.addEventListener("click", () => hackCable.emulatorManager.stop(), { signal });
        pauseButton.addEventListener(
            "click",
            () => {
                hackCable.emulatorManager.setPaused(!hackCable.emulatorManager.isPosed());
            },
            { signal }
        );
    }

    const save = document.getElementById("save");
    const restore = document.getElementById("restore");
    const restoreLocal = document.getElementById("restore-local");
    const restoreFileInput = document.createElement("input");
    restoreFileInput.type = "file";
    restoreFileInput.accept = ".json,application/json";
    restoreFileInput.hidden = true;
    document.body.appendChild(restoreFileInput);

    const tWarn = (key: string) => i18next.t(key, { ns: "common" });

    if (save) {
        save.addEventListener(
            "click",
            () => {
                const data = hackCable.editor.getEditorSaveData();
                const json = JSON.stringify(data);
                localStorage.setItem("savedEditor", json);
                const day = new Date().toISOString().slice(0, 10);
                downloadJsonFile(`hackcable-editor-${day}.json`, data);
            },
            { signal }
        );
    }

    if (restore) {
        restore.addEventListener(
            "click",
            () => {
                restoreFileInput.value = "";
                restoreFileInput.click();
            },
            { signal }
        );
    }

    restoreFileInput.addEventListener(
        "change",
        () => {
            const file = restoreFileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const text = typeof reader.result === "string" ? reader.result : "";
                    const parsed: unknown = JSON.parse(text);
                    if (!isEditorSaveData(parsed)) {
                        alert(tWarn("web.loadInvalidShape"));
                        return;
                    }
                    localStorage.setItem("savedEditor", JSON.stringify(parsed));
                    hackCable.editor.loadEditorSaveData(parsed);
                } catch {
                    alert(tWarn("web.loadInvalidJson"));
                }
            };
            reader.onerror = () => alert(tWarn("web.loadFileError"));
            reader.readAsText(file, "UTF-8");
        },
        { signal }
    );

    if (restoreLocal) {
        restoreLocal.addEventListener(
            "click",
            () => {
                const raw = localStorage.getItem("savedEditor");
                if (raw == null || raw === "") {
                    alert(tWarn("web.noLocalSave"));
                    return;
                }
                try {
                    const parsed: unknown = JSON.parse(raw);
                    if (!isEditorSaveData(parsed)) {
                        alert(tWarn("web.loadInvalidShape"));
                        return;
                    }
                    hackCable.editor.loadEditorSaveData(parsed);
                } catch {
                    alert(tWarn("web.loadInvalidJson"));
                }
            },
            { signal }
        );
    }

    function isResolvedLanguage(code: "en_us" | "fr_fr", resolved: string): boolean {
        const lng = resolved.toLowerCase();
        return code === "en_us" ? lng.startsWith("en") : lng.startsWith("fr");
    }

    async function switchWebLanguage(code: "en_us" | "fr_fr"): Promise<void> {
        if (isResolvedLanguage(code, hackCable.getLanguage())) return;
        localStorage.setItem("hackCable-webExample-language", code);
        await hackCable.changeLanguage(code);
        applyWebDemoUiI18n();
    }

    document.getElementById("language-en")?.addEventListener(
        "click",
        () => {
            void switchWebLanguage("en_us");
        },
        { signal }
    );
    document.getElementById("language-fr")?.addEventListener(
        "click",
        () => {
            void switchWebLanguage("fr_fr");
        },
        { signal }
    );

    const resizerCode = document.getElementById("resizerCode");
    const sideBar = document.querySelector(".sideBar") as HTMLElement;
    const hackCableDiv = document.getElementById("hackCable");

    if (resizerCode && sideBar && hackCableDiv) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const onMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth >= 50) {
                sideBar.style.width = `${newWidth}px`;
            }
            e.preventDefault();
        };
        const onUp = () => {
            isResizing = false;
            document.body.classList.remove("resizing");
        };

        resizerCode.addEventListener(
            "mousedown",
            (e) => {
                isResizing = true;
                startX = e.clientX;
                startWidth = sideBar.offsetWidth;
                document.body.classList.add("resizing");
            },
            { signal }
        );
        document.addEventListener("mousemove", onMove, { signal });
        document.addEventListener("mouseup", onUp, { signal });
    }

    return () => {
        ac.abort();
        restoreFileInput.remove();
    };
}
