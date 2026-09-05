/**
 * @file Panneau catalogue : navigation par catégories (flyout type µcBlockly) et liste de composants.
 */
import { ComponentFigure } from "../editor/component-figure";
import { snapPointToCanvasGrid } from "../editor/canvas-scale";
import type { Editor } from "../editor/editor";
import { tr } from "../ui/i18n/translate";
import {
    ComponentElement,
    ComponentType,
    catalogComponentById,
    getCatalogComponents,
    getComponentById,
    isFritzingComponent,
} from "./component";
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

function readAutoCollapsePreference(): boolean {
    return localStorage.getItem(AUTO_COLLAPSE_STORAGE_KEY) !== "false";
}

function writeAutoCollapsePreference(enabled: boolean): void {
    localStorage.setItem(AUTO_COLLAPSE_STORAGE_KEY, enabled ? "true" : "false");
}

/** Préférence repli auto (avant montage du catalogue, ex. depuis l’URL). */
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

    constructor(hackCable: { editor: Editor }) {
        this.hackCable = hackCable;
        this.autoCollapse = readAutoCollapsePreference();
        this.reloadElements();

        const root = document.querySelector(".hackCable-catalog-list");
        const nav = document.querySelector(".hackCable-catalog-nav");
        if (root instanceof HTMLDivElement && nav instanceof HTMLElement) {
            this.catalog = root;
            this.nav = nav;
            this.build();
            this.bindAutoCollapse();
            this.setListOpen(!this.autoCollapse);
        } else {
            console.error("[HackCable] Unable to find catalog list or category nav");
        }
    }

    private onAutoCollapseChange: ((enabled: boolean) => void) | null = null;

    /** Repli auto du flyout (workspace, Escape, drag) — sinon le catalogue reste déplié. */
    isAutoCollapseEnabled(): boolean {
        return this.autoCollapse;
    }

    setAutoCollapseChangeListener(listener: ((enabled: boolean) => void) | null): void {
        this.onAutoCollapseChange = listener;
    }

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

    reloadElements(): void {
        this.elements = getCatalogComponents()
            .filter((component) => {
                if (isFritzingComponent(component)) return true;
                return component.type !== ComponentType.CARD;
            })
            .map((component) => new ComponentElement(component));
    }

    private sideBar(): HTMLElement | null {
        const sideBar = document.querySelector(".hackCable-sideBar");
        return sideBar instanceof HTMLElement ? sideBar : null;
    }

    private usedCategories(): FritzingCategory[] {
        const categories = new Set(this.elements.map((element) => element.category));
        return FRITZING_CATEGORIES
            .filter((category) => categories.has(category) && isBreadboardCatalogCategory(category));
    }

    private categoryCount(category: FritzingCategory): number {
        return this.elements.filter((element) => element.category === category).length;
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

    private buildCategoryNav(): void {
        if (!this.nav) return;
        this.nav.innerHTML = "";
        this.nav.setAttribute("aria-label", tr("catalog.navLabel"));
        this.nav.setAttribute("aria-orientation", "vertical");

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

    build(): void {
        this.buildCategoryNav();
        this.updateCatalogList();
    }

    rebuildFromLocale(): void {
        this.reloadElements();
        this.buildCategoryNav();
        this.updateCatalogList();
        this.setListOpen(this.listOpen);
    }

    rebuildFromCatalog(): void {
        this.reloadElements();
        this.buildCategoryNav();
        this.updateCatalogList();
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
            this.hackCable.editor.canvas.add(figure.setX(x).setY(y));
            this.collapseFlyout();
        });

        div.appendChild(previewNode);
    }

    updateCatalogList(): void {
        if (this.catalog) this.catalog.innerHTML = "";

        const visible = this.elements
            .filter((element) => isBreadboardCatalogCategory(element.category))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

        const byCategory = new Map<FritzingCategory, ComponentElement[]>();
        for (const element of visible) {
            const bucket = byCategory.get(element.category) ?? [];
            bucket.push(element);
            byCategory.set(element.category, bucket);
        }

        const categories = [...byCategory.keys()].sort(compareFritzingCategories);
        for (const category of categories) {
            const items = byCategory.get(category) ?? [];
            const section = document.createElement("section");
            section.className = "hackCable-catalog-section";
            section.id = categoryDomId(category);

            const header = document.createElement("h4");
            header.className = "hackCable-catalog-section-title";
            header.id = `${categoryDomId(category)}-label`;
            header.textContent = `${tr(fritzingCategoryI18nKey(category))} (${items.length})`;
            section.setAttribute("aria-labelledby", header.id);
            section.appendChild(header);

            const grid = document.createElement("div");
            grid.className = "hackCable-catalog-section-grid";
            for (const element of items) {
                this.mountComponentCard(element, grid);
            }
            section.appendChild(grid);
            this.catalog?.appendChild(section);
        }
    }
}
