/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Panneau catalogue : navigation par catégories (flyout type µcBlockly) et liste.
 *
 * Responsabilités :
 * - Nav catégories + recherche + repli automatique
 * - Monter les vignettes (Wokwi / Fritzing) et le DnD vers le canvas
 * - Rebuild progressif (boot par lots)
 */
import { ComponentFigure } from "../editor/component-figure";
import { addFigureWithUndo } from "../editor/canvas-commands";
import { snapPointToCanvasGrid } from "../editor/canvas-scale";
import type { Editor } from "../editor/editor";
import { tr } from "../ui/i18n/translate";
import {
    ComponentElement,
    catalogComponentById,
    getCatalogComponents,
    getComponentById,
    isWokwiComponent,
    type CatalogComponentInfo,
} from "./component";
import { normalizeCatalogKey } from "./catalog-dedupe";
import {
    CATALOG_BOOT_BATCH_SIZE,
    reportCatalogBoot,
    yieldToBrowser,
    type CatalogBootProgressCallback,
} from "./catalog-boot";
import {
    FRITZING_CATEGORIES,
    compareFritzingCategories,
    fritzingCategoryI18nKey,
    isBreadboardCatalogCategory,
    type FritzingCategory,
} from "./fritzing-categories";

const DEFAULT_EXPANDED_SIDEBAR_WIDTH = 320;
const COLLAPSED_SIDEBAR_WIDTH = 132;
const AUTO_COLLAPSE_STORAGE_KEY = "hackCable-catalog-auto-collapse";
const SEARCH_DEBOUNCE_MS = 180;

function readAutoCollapsePreference(): boolean {
    return localStorage.getItem(AUTO_COLLAPSE_STORAGE_KEY) !== "false";
}

function writeAutoCollapsePreference(enabled: boolean): void {
    localStorage.setItem(AUTO_COLLAPSE_STORAGE_KEY, enabled ? "true" : "false");
}

/**
 * Définit la préférence de repli automatique du flyout catalogue.
 * @param enabled - `true` pour replier le flyout au clic workspace / Escape / drag.
 */
export function setCatalogAutoCollapsePreference(enabled: boolean): void {
    writeAutoCollapsePreference(enabled);
}

function categoryDomId(category: FritzingCategory): string {
    return `hackCable-catalog-cat-${category.replace(/\s+/g, "-").toLowerCase()}`;
}

export class Catalog {
    elements: ComponentElement[] = [];
    private readonly catalog: HTMLDivElement | undefined;
    private readonly nav: HTMLElement | undefined;
    private readonly hackCable: { editor: Editor };
    private activeCategory: FritzingCategory | "" = "";
    private listOpen = false;
    private autoCollapse = true;
    private lastExpandedWidth = DEFAULT_EXPANDED_SIDEBAR_WIDTH;
    private autoCollapseBound = false;
    private autoCollapseButton: HTMLButtonElement | undefined;
    private searchQuery = "";
    private searchDebounceTimer: number | undefined;
    private catalogListGeneration = 0;

    /**
     * Initialise le panneau catalogue (nav, recherche, liste de vignettes).
     * @param hackCable - Instance parente exposant l’éditeur canvas.
     * @param options - `deferBuild` retarde le premier montage asynchrone.
     */
    constructor(hackCable: { editor: Editor }, options?: { deferBuild?: boolean }) {
        this.hackCable = hackCable;
        this.autoCollapse = readAutoCollapsePreference();

        const root = document.querySelector(".hackCable-catalog-list");
        const nav = document.querySelector(".hackCable-catalog-nav");
        if (root instanceof HTMLDivElement && nav instanceof HTMLElement) {
            this.catalog = root;
            this.nav = nav;
            this.bindAutoCollapse();
            this.setListOpen(!this.autoCollapse);
            if (!options?.deferBuild) {
                void this.buildAsync();
            }
        } else {
            console.error("[HackCable] Unable to find catalog list or category nav");
        }
    }

    private onAutoCollapseChange: ((enabled: boolean) => void) | null = null;

    /**
     * Indique si le repli automatique du flyout catalogue est activé.
     * @returns `true` si le flyout se replie au clic workspace, Escape ou drag.
     */
    isAutoCollapseEnabled(): boolean {
        return this.autoCollapse;
    }

    /**
     * Enregistre un écouteur sur le changement de préférence repli auto.
     * @param listener - Callback appelé avec la nouvelle valeur, ou `null` pour retirer.
     */
    setAutoCollapseChangeListener(listener: ((enabled: boolean) => void) | null): void {
        this.onAutoCollapseChange = listener;
    }

    /**
     * Active ou désactive le repli automatique du flyout catalogue.
     * @param enabled - Nouvelle valeur de la préférence.
     */
    setAutoCollapseEnabled(enabled: boolean): void {
        if (this.autoCollapse === enabled) {
            this.syncAutoCollapseButton();
            return;
        }
        this.autoCollapse = enabled;
        writeAutoCollapsePreference(enabled);
        this.syncAutoCollapseButton();
        if (enabled) {
            this.setListOpen(false);
            this.setActiveCategory("");
        } else {
            this.setListOpen(true);
        }
        this.onAutoCollapseChange?.(enabled);
    }

    /**
     * Recharge les éléments catalogue depuis les maps composants en mémoire.
     */
    reloadElements(): void {
        this.elements = this.listCatalogComponents()
            .map((component) => new ComponentElement(component));
    }

    /** Composants catalogue (évite un 2ᵉ parse localStorage si les maps sont déjà remplies). */
    private listCatalogComponents(): CatalogComponentInfo[] {
        const fromMaps = Object.values(catalogComponentById);
        if (fromMaps.length > 0) {
            return fromMaps;
        }
        return getCatalogComponents();
    }

    private async reloadElementsAsync(onProgress?: CatalogBootProgressCallback): Promise<void> {
        const components = this.listCatalogComponents();
        const total = components.length;
        this.elements = [];
        reportCatalogBoot(onProgress, "elements", 0, total);

        for (let i = 0; i < components.length; i += CATALOG_BOOT_BATCH_SIZE) {
            const slice = components.slice(i, i + CATALOG_BOOT_BATCH_SIZE);
            for (const component of slice) {
                this.elements.push(new ComponentElement(component));
            }
            reportCatalogBoot(onProgress, "elements", Math.min(i + slice.length, total), total);
            await yieldToBrowser();
        }
    }

    private sideBar(): HTMLElement | null {
        const sideBar = document.querySelector(".hackCable-sideBar");
        return sideBar instanceof HTMLElement ? sideBar : null;
    }

    private usedCategories(): FritzingCategory[] {
        const categories = new Set(this.visibleElements().map((element) => element.category));
        return FRITZING_CATEGORIES
            .filter((category) => categories.has(category) && isBreadboardCatalogCategory(category));
    }

    private categoryCount(category: FritzingCategory): number {
        return this.visibleElements().filter((element) => element.category === category).length;
    }

    private visibleElements(): ComponentElement[] {
        const query = normalizeCatalogKey(this.searchQuery);
        const breadboard = this.elements.filter((element) => isBreadboardCatalogCategory(element.category));
        if (!query) return breadboard;
        return breadboard.filter((element) => this.matchesSearch(element, query));
    }

    private matchesSearch(element: ComponentElement, query: string): boolean {
        const haystack = normalizeCatalogKey(`${element.name} ${element.description}`);
        return haystack.includes(query);
    }

    private compareCatalogElements(a: ComponentElement, b: ComponentElement): number {
        const aWokwi = isWokwiComponent(a.componentInfo) ? 0 : 1;
        const bWokwi = isWokwiComponent(b.componentInfo) ? 0 : 1;
        if (aWokwi !== bWokwi) return aWokwi - bWokwi;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }

    private setActiveCategory(category: FritzingCategory | ""): void {
        this.activeCategory = category;
        if (!this.nav) return;
        for (const button of this.nav.querySelectorAll<HTMLButtonElement>(".hackCable-catalog-nav-btn")) {
            const value = button.dataset.category ?? "";
            const isActive = value === category;
            button.classList.toggle("is-active", isActive);
            if (isActive) {
                button.setAttribute("aria-current", "true");
            } else {
                button.removeAttribute("aria-current");
            }
            button.setAttribute("aria-expanded", this.listOpen && isActive ? "true" : "false");
        }
    }

    private setListOpen(open: boolean): void {
        const sideBar = this.sideBar();
        if (!sideBar || !this.catalog) return;

        if (open === this.listOpen && sideBar.classList.contains(open ? "is-catalog-expanded" : "is-catalog-collapsed")) {
            this.syncNavExpandedState();
            return;
        }

        if (open) {
            const currentWidth = sideBar.offsetWidth;
            if (currentWidth > COLLAPSED_SIDEBAR_WIDTH + 8) {
                this.lastExpandedWidth = currentWidth;
            }
            sideBar.classList.remove("is-catalog-collapsed");
            sideBar.classList.add("is-catalog-expanded");
            sideBar.style.width = `${this.lastExpandedWidth}px`;
            this.catalog.hidden = false;
            this.catalog.setAttribute("aria-hidden", "false");
            this.listOpen = true;
        } else {
            const currentWidth = sideBar.offsetWidth;
            if (currentWidth > COLLAPSED_SIDEBAR_WIDTH + 8) {
                this.lastExpandedWidth = currentWidth;
            }
            sideBar.classList.add("is-catalog-collapsed");
            sideBar.classList.remove("is-catalog-expanded");
            sideBar.style.width = "";
            this.catalog.hidden = true;
            this.catalog.setAttribute("aria-hidden", "true");
            this.listOpen = false;
        }

        this.syncNavExpandedState();
    }

    private syncNavExpandedState(): void {
        if (!this.nav) return;
        for (const button of this.nav.querySelectorAll<HTMLButtonElement>(".hackCable-catalog-nav-btn")) {
            const value = button.dataset.category ?? "";
            const isActive = value === this.activeCategory;
            button.setAttribute("aria-expanded", this.listOpen && isActive ? "true" : "false");
        }
    }

    private navButtons(): HTMLButtonElement[] {
        if (!this.nav) return [];
        return [...this.nav.querySelectorAll<HTMLButtonElement>(".hackCable-catalog-nav-btn")];
    }

    private focusNavButton(index: number): void {
        const buttons = this.navButtons();
        if (buttons.length === 0) return;
        const next = ((index % buttons.length) + buttons.length) % buttons.length;
        buttons[next].focus();
    }

    private bindNavKeyboard(): void {
        if (!this.nav || this.nav.dataset.keyboardBound === "true") return;
        this.nav.dataset.keyboardBound = "true";

        this.nav.addEventListener("keydown", (event) => {
            const buttons = this.navButtons();
            const current = buttons.indexOf(event.target as HTMLButtonElement);
            if (current < 0) return;

            let next = current;
            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                next = current + 1;
                event.preventDefault();
            } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                next = current - 1;
                event.preventDefault();
            } else if (event.key === "Home") {
                next = 0;
                event.preventDefault();
            } else if (event.key === "End") {
                next = buttons.length - 1;
                event.preventDefault();
            } else if (event.key === "Escape" && this.listOpen) {
                this.collapseFlyout();
                event.preventDefault();
                return;
            } else {
                return;
            }

            this.focusNavButton(next);
        });
    }

    private bindAutoCollapse(): void {
        if (this.autoCollapseBound) return;
        this.autoCollapseBound = true;

        const editor = document.querySelector(".hackCable-editor");
        editor?.addEventListener("pointerdown", () => this.collapseFlyout());

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.listOpen) {
                this.collapseFlyout();
            }
        });

        this.catalog?.addEventListener("dragstart", () => {
            window.requestAnimationFrame(() => this.collapseFlyout());
        });
    }

    private collapseFlyout(): void {
        if (!this.listOpen || !this.autoCollapse) return;
        this.setListOpen(false);
        this.setActiveCategory("");
    }

    private openCategory(category: FritzingCategory | ""): void {
        const sameOpen = this.listOpen && this.activeCategory === category;
        if (sameOpen && this.autoCollapse) {
            this.collapseFlyout();
            return;
        }

        this.setActiveCategory(category);
        this.setListOpen(true);
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => this.scrollToCategory(category));
        });
    }

    private syncAutoCollapseButton(): void {
        const button = this.autoCollapseButton;
        if (!button) return;
        button.setAttribute("aria-pressed", this.autoCollapse ? "true" : "false");
        button.classList.toggle("is-active", this.autoCollapse);
        if (this.autoCollapse) {
            button.textContent = tr("catalog.autoCollapseOn");
            button.title = tr("catalog.autoCollapseOnHint");
            button.setAttribute("aria-label", tr("catalog.autoCollapseOnHint"));
        } else {
            button.textContent = tr("catalog.autoCollapseOff");
            button.title = tr("catalog.autoCollapseOffHint");
            button.setAttribute("aria-label", tr("catalog.autoCollapseOffHint"));
        }
    }

    private createAutoCollapseToggle(): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hackCable-catalog-auto-collapse-btn";
        button.addEventListener("click", () => {
            this.setAutoCollapseEnabled(!this.autoCollapse);
        });
        this.autoCollapseButton = button;
        this.syncAutoCollapseButton();
        return button;
    }

    private createNavButton(
        category: FritzingCategory | "",
        label: string,
        title: string,
        controlsId: string,
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hackCable-catalog-nav-btn";
        button.dataset.category = category;
        button.textContent = label;
        button.title = title;
        button.setAttribute("aria-controls", controlsId);
        button.setAttribute("aria-label", title);
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("click", () => this.openCategory(category));
        return button;
    }

    private scrollOffsetInCatalog(element: HTMLElement): number {
        if (!this.catalog) return 0;
        const listRect = this.catalog.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        return this.catalog.scrollTop + (elementRect.top - listRect.top);
    }

    private scrollToCategory(category: FritzingCategory | ""): void {
        if (!this.catalog || this.catalog.hidden) return;
        if (!category) {
            this.catalog.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        const section = this.catalog.querySelector(`#${CSS.escape(categoryDomId(category))}`);
        if (!(section instanceof HTMLElement)) return;

        const top = this.scrollOffsetInCatalog(section);
        this.catalog.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }

    private createSearchField(): HTMLDivElement {
        const wrap = document.createElement("div");
        wrap.className = "hackCable-catalog-search";

        const input = document.createElement("input");
        input.type = "search";
        input.className = "hackCable-catalog-search-input";
        input.id = "hackCable-catalog-search";
        input.value = this.searchQuery;
        input.placeholder = tr("catalog.searchPlaceholder");
        input.setAttribute("aria-label", tr("catalog.searchLabel"));
        input.autocomplete = "off";
        input.spellcheck = false;

        input.addEventListener("input", () => {
            this.searchQuery = input.value;
            if (this.searchDebounceTimer !== undefined) {
                window.clearTimeout(this.searchDebounceTimer);
            }
            this.searchDebounceTimer = window.setTimeout(() => {
                this.searchDebounceTimer = undefined;
                this.applySearchFilter();
            }, SEARCH_DEBOUNCE_MS);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                if (input.value) {
                    input.value = "";
                    this.searchQuery = "";
                    this.applySearchFilter();
                    event.stopPropagation();
                }
                return;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                this.openCategory(this.activeCategory || "");
            }
        });

        input.addEventListener("focus", () => {
            if (!this.listOpen) {
                this.setListOpen(true);
            }
        });

        wrap.appendChild(input);
        return wrap;
    }

    private applySearchFilter(): void {
        this.rebuildNavCategoryList();
        void this.updateCatalogListAsync().then(() => {
            if (this.searchQuery.trim() && !this.listOpen) {
                this.setListOpen(true);
            }
            if (this.activeCategory) {
                this.scrollToCategory(this.activeCategory);
            } else {
                this.catalog?.scrollTo({ top: 0 });
            }
        });
    }

    private rebuildNavCategoryList(): void {
        if (!this.nav) return;
        const list = this.nav.querySelector(".hackCable-catalog-nav-list");
        if (!(list instanceof HTMLUListElement)) {
            this.buildCategoryNav();
            return;
        }

        list.innerHTML = "";
        const listId = "hackCable-catalog-list";
        const appendItem = (button: HTMLButtonElement) => {
            const item = document.createElement("li");
            item.setAttribute("role", "none");
            item.appendChild(button);
            list.appendChild(item);
        };

        appendItem(this.createNavButton(
            "",
            tr("catalog.navAll"),
            tr("catalog.filterAll"),
            listId,
        ));

        for (const category of this.usedCategories()) {
            const count = this.categoryCount(category);
            appendItem(this.createNavButton(
                category,
                tr(fritzingCategoryI18nKey(category)),
                `${tr(fritzingCategoryI18nKey(category))} (${count})`,
                categoryDomId(category),
            ));
        }

        this.setActiveCategory(this.activeCategory);
        this.syncNavExpandedState();
    }

    private buildCategoryNav(): void {
        if (!this.nav) return;
        this.nav.innerHTML = "";
        this.nav.setAttribute("aria-label", tr("catalog.navLabel"));
        this.nav.setAttribute("aria-orientation", "vertical");

        this.nav.appendChild(this.createSearchField());

        const list = document.createElement("ul");
        list.className = "hackCable-catalog-nav-list";
        list.setAttribute("role", "list");

        const listId = "hackCable-catalog-list";
        const appendItem = (button: HTMLButtonElement) => {
            const item = document.createElement("li");
            item.setAttribute("role", "none");
            item.appendChild(button);
            list.appendChild(item);
        };

        appendItem(this.createNavButton(
            "",
            tr("catalog.navAll"),
            tr("catalog.filterAll"),
            listId,
        ));

        for (const category of this.usedCategories()) {
            const count = this.categoryCount(category);
            appendItem(this.createNavButton(
                category,
                tr(fritzingCategoryI18nKey(category)),
                `${tr(fritzingCategoryI18nKey(category))} (${count})`,
                categoryDomId(category),
            ));
        }

        this.nav.appendChild(list);

        const footer = document.createElement("div");
        footer.className = "hackCable-catalog-auto-collapse";
        footer.appendChild(this.createAutoCollapseToggle());
        this.nav.appendChild(footer);

        this.bindNavKeyboard();
        this.setActiveCategory(this.activeCategory);
        this.syncNavExpandedState();
    }

    /**
     * Lance la construction nav + liste de façon asynchrone (sans attendre).
     */
    build(): void {
        void this.buildAsync();
    }

    /**
     * Construit la navigation et la liste catalogue par lots avec progression.
     * @param onProgress - Callback optionnel de progression du boot.
     */
    async buildAsync(onProgress?: CatalogBootProgressCallback): Promise<void> {
        await this.reloadElementsAsync(onProgress);
        this.buildCategoryNav();
        await this.updateCatalogListAsync(onProgress);
        reportCatalogBoot(onProgress, "ready", 1, 1);
    }

    /**
     * Reconstruit le catalogue après un changement de locale (sans attendre).
     */
    rebuildFromLocale(): void {
        void this.rebuildFromLocaleAsync();
    }

    /**
     * Reconstruit le catalogue après un changement de locale.
     * @param onProgress - Callback optionnel de progression du rebuild.
     */
    async rebuildFromLocaleAsync(onProgress?: CatalogBootProgressCallback): Promise<void> {
        await this.buildAsync(onProgress);
        this.setListOpen(this.listOpen);
    }

    /**
     * Reconstruit le catalogue après une sync Fritzing (sans attendre).
     */
    rebuildFromCatalog(): void {
        void this.rebuildFromCatalogAsync();
    }

    /**
     * Reconstruit le catalogue après une sync Fritzing.
     * @param onProgress - Callback optionnel de progression du rebuild.
     */
    async rebuildFromCatalogAsync(onProgress?: CatalogBootProgressCallback): Promise<void> {
        await this.buildAsync(onProgress);
        this.setListOpen(this.listOpen);
    }

    private mountComponentCard(element: ComponentElement, container: HTMLElement): void {
        const div = document.createElement("div");
        div.setAttribute("class", "hackCable-catalog-element");
        div.setAttribute("title", element.description);
        div.innerHTML = "<h3>" + element.name + "</h3>";
        container.appendChild(div);

        const previewNode = element.previewNode;
        previewNode.setAttribute("draggable", "true");
        previewNode.setAttribute("data-component-id", String(element.componentId));

        previewNode.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData("text/plain", String(element.componentId));
        });

        previewNode.addEventListener("dblclick", () => {
            const componentInfo = catalogComponentById[element.componentId] ?? getComponentById(element.componentId);
            if (!componentInfo) return;
            const figure = new ComponentFigure(componentInfo);
            const { x, y } = snapPointToCanvasGrid(100, 100);
            addFigureWithUndo(this.hackCable.editor.canvas, figure, x, y);
            this.collapseFlyout();
        });

        div.appendChild(previewNode);
    }

    /**
     * Met à jour la liste DOM des vignettes catalogue (sans attendre).
     */
    updateCatalogList(): void {
        void this.updateCatalogListAsync();
    }

    /**
     * Met à jour la liste DOM des vignettes catalogue par lots.
     * @param onProgress - Callback optionnel de progression du montage.
     */
    async updateCatalogListAsync(onProgress?: CatalogBootProgressCallback): Promise<void> {
        const generation = ++this.catalogListGeneration;
        if (this.catalog) this.catalog.innerHTML = "";

        const visible = this.visibleElements().sort((a, b) => this.compareCatalogElements(a, b));

        if (visible.length === 0 && this.searchQuery.trim()) {
            if (generation !== this.catalogListGeneration) return;
            const empty = document.createElement("p");
            empty.className = "hackCable-catalog-search-empty";
            empty.textContent = tr("catalog.searchEmpty");
            this.catalog?.appendChild(empty);
            reportCatalogBoot(onProgress, "mount", 0, 0);
            return;
        }

        const byCategory = new Map<FritzingCategory, ComponentElement[]>();
        for (const element of visible) {
            const bucket = byCategory.get(element.category) ?? [];
            bucket.push(element);
            byCategory.set(element.category, bucket);
        }

        const categories = [...byCategory.keys()].sort(compareFritzingCategories);
        const total = visible.length;
        let mounted = 0;
        reportCatalogBoot(onProgress, "mount", 0, total);

        const fragment = document.createDocumentFragment();

        for (const category of categories) {
            if (generation !== this.catalogListGeneration) return;
            const items = byCategory.get(category) ?? [];
            const section = document.createElement("section");
            section.className = "hackCable-catalog-section";
            section.id = categoryDomId(category);
            section.dataset.category = category;

            const header = document.createElement("h4");
            header.className = "hackCable-catalog-section-title";
            header.id = `${categoryDomId(category)}-label`;
            header.textContent = `${tr(fritzingCategoryI18nKey(category))} (${items.length})`;
            section.setAttribute("aria-labelledby", header.id);
            section.appendChild(header);

            const grid = document.createElement("div");
            grid.className = "hackCable-catalog-section-grid";

            for (let i = 0; i < items.length; i += CATALOG_BOOT_BATCH_SIZE) {
                if (generation !== this.catalogListGeneration) return;
                const slice = items.slice(i, i + CATALOG_BOOT_BATCH_SIZE);
                for (const element of slice) {
                    this.mountComponentCard(element, grid);
                }
                mounted += slice.length;
                reportCatalogBoot(onProgress, "mount", mounted, total);
                await yieldToBrowser();
            }

            section.appendChild(grid);
            fragment.appendChild(section);
        }

        if (generation !== this.catalogListGeneration) return;
        this.catalog?.appendChild(fragment);
        reportCatalogBoot(onProgress, "mount", total, total);
    }
}
