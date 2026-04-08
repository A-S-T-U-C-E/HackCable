import i18next from "i18next";
import {
    CompileResult,
    EmulatorManager,
    HackCable,
    initHackCableI18n,
} from "../src/main";

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
    if (save && restore) {
        save.addEventListener(
            "click",
            () => {
                const data = hackCable.editor.getEditorSaveData();
                console.log("Saving data:", data);
                localStorage.setItem("savedEditor", JSON.stringify(data));
            },
            { signal }
        );
        restore.addEventListener(
            "click",
            () => {
                const data = JSON.parse(<string>localStorage.getItem("savedEditor"));
                console.log("Loading data:", data);
                hackCable.editor.loadEditorSaveData(data);
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

    return () => ac.abort();
}
