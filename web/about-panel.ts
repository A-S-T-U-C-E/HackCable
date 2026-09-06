/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Dialogue « À propos » (style µcBlockly) : projet, icônes, crédits Fritzing.
 *
 * Responsabilités :
 * - Construire le `<dialog>` et les rangées logo + texte
 * - Liens fork / upstream / Fritzing / Wokwi
 */
import i18next from "i18next";

const HACKCABLE_UPSTREAM = "https://github.com/ClementGre/HackCable";
const HACKCABLE_FORK = "https://github.com/A-S-T-U-C-E/HackCable";
const FRITZING_SITE = "https://fritzing.org/";
const FRITZING_GITHUB = "https://github.com/fritzing/fritzing-app";
const WOKWI_SITE = "https://wokwi.com/";

/**
 * Traduit une clé i18n du namespace `common`.
 * @param key - Clé de traduction.
 * @returns Chaîne traduite.
 */
function t(key: string): string {
    return i18next.t(key, { ns: "common" });
}

/**
 * Résout l’URL d’un asset relatif au document.
 * @param file - Nom de fichier dans le dossier `assets/`.
 * @returns URL absolue ou chemin relatif de repli.
 */
function assetUrl(file: string): string {
    try {
        return new URL(`assets/${file}`, document.baseURI).href;
    } catch {
        return `./assets/${file}`;
    }
}

/**
 * Branche le bouton « À propos » et construit le dialogue modal.
 * @param signal - Signal d’annulation pour retirer les écouteurs et le dialogue.
 * @returns Fonction de reconstruction des libellés i18n du panneau.
 */
export function setupAboutPanel(signal: AbortSignal): () => void {
    const openBtn = document.getElementById("about-open");
    let dialog = document.getElementById("about-dialog");

    if (!(openBtn instanceof HTMLButtonElement)) {
        return () => undefined;
    }

    if (!(dialog instanceof HTMLDialogElement)) {
        dialog = document.createElement("dialog");
        dialog.id = "about-dialog";
        dialog.className = "hackCable-about-dialog";
        document.body.appendChild(dialog);
    }

    const panel = dialog as HTMLDialogElement;

    const rebuild = () => {
        panel.innerHTML = "";
        panel.setAttribute("aria-labelledby", "about-dialog-title");

        const title = document.createElement("h2");
        title.id = "about-dialog-title";
        title.className = "hackCable-about-dialog-title";
        title.textContent = t("about.title");

        const makeLogoLink = (src: string, alt: string, href: string, wide = false) => {
            const link = document.createElement("a");
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "hackCable-about-logo-link";
            const img = document.createElement("img");
            img.src = src;
            img.alt = alt;
            img.className = wide
                ? "hackCable-about-logo hackCable-about-logo--wide"
                : "hackCable-about-logo";
            img.width = wide ? 120 : 64;
            img.height = 64;
            img.addEventListener("error", () => {
                if (img.dataset.fallback === "1") return;
                img.dataset.fallback = "1";
                img.src = assetUrl("icon.png");
                img.classList.remove("hackCable-about-logo--wide");
                img.width = 64;
            });
            link.appendChild(img);
            return link;
        };

        /** Rangée : icône à gauche, paragraphe à droite. */
        const makeIconRow = (src: string, alt: string, href: string, text: string, wide = false) => {
            const row = document.createElement("div");
            row.className = "hackCable-about-row";
            const textEl = document.createElement("p");
            textEl.className = "hackCable-about-row-text";
            textEl.textContent = text;
            row.append(makeLogoLink(src, alt, href, wide), textEl);
            return row;
        };

        const body = document.createElement("div");
        body.className = "hackCable-about-body";
        body.append(
            makeIconRow(assetUrl("icon.png"), "HackCable", HACKCABLE_FORK, t("about.blurb")),
            makeIconRow(assetUrl("fritzing.png"), "Fritzing", FRITZING_SITE, t("about.fritzingCredit"), true),
        );

        const links = document.createElement("ul");
        links.className = "hackCable-about-links";

        const addLink = (labelKey: string, href: string) => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = href;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = t(labelKey);
            li.appendChild(a);
            links.appendChild(li);
        };

        addLink("about.linkFork", HACKCABLE_FORK);
        addLink("about.linkUpstream", HACKCABLE_UPSTREAM);
        addLink("about.linkFritzing", FRITZING_SITE);
        addLink("about.linkFritzingGitHub", FRITZING_GITHUB);
        addLink("about.linkWokwi", WOKWI_SITE);

        const license = document.createElement("p");
        license.className = "hackCable-about-license";
        license.textContent = t("about.license");

        body.append(links, license);

        const actions = document.createElement("div");
        actions.className = "hackCable-about-actions";
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "hackCable-about-close";
        closeBtn.textContent = t("about.close");
        closeBtn.addEventListener("click", () => panel.close());
        actions.appendChild(closeBtn);

        panel.append(title, body, actions);
    };

    rebuild();

    const onOpen = () => {
        rebuild();
        if (!panel.open) panel.showModal();
    };

    openBtn.addEventListener("click", onOpen, { signal });
    panel.addEventListener("click", (event) => {
        if (event.target === panel) panel.close();
    }, { signal });

    signal.addEventListener("abort", () => {
        panel.close();
        panel.remove();
    });

    return rebuild;
}
