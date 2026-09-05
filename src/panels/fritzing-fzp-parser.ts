/**
 * @file Parsing des fichiers FZP Fritzing et extraction des connecteurs / broches.
 */
import { resolveFritzingCategory, type FritzingCategoryMaps } from "./fritzing-categories";
import { extractConnectorPins, resolveSvgPhysicalInches } from "./fritzing-svg";
import type { FritzingComponentInfo, FritzingPin } from "./fritzing-types";
import { resolveBreadboardSvgUrl } from "./fritzing-github";

function decodeHtml(text: string): string {
    const el = document.createElement("textarea");
    el.innerHTML = text;
    return el.value;
}

function stripHtml(text: string): string {
    return decodeHtml(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function defaultPins(count: number): FritzingPin[] {
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, index) => ({
        id: `connector${index}`,
        name: `Pin ${index}`,
        x: ((index + 1) / (count + 1)) * 100,
        y: 50,
    }));
}

function parseFzpConnectors(doc: Document): { id: string; name: string; svgId: string }[] {
    return [...doc.querySelectorAll("connectors connector")].map((connector, index) => ({
        id: connector.getAttribute("id") || `connector${index}`,
        name: connector.getAttribute("name") || `Pin ${index}`,
        svgId: connector.querySelector("breadboardView p")?.getAttribute("svgId")
            || `${connector.getAttribute("id") || `connector${index}`}pin`,
    }));
}

/** Parse un FZP et retourne les métadonnées catalogue (sans identifiant numérique). */
export function parseFzp(
    xml: string,
    fzpPath: string,
    fzpSha: string,
    categoryMaps: FritzingCategoryMaps,
    options?: { svgText?: string; breadboardSvgUrl?: string },
): Omit<FritzingComponentInfo, "id"> | null {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const module = doc.querySelector("module");
    if (!module) return null;

    const moduleId = module.getAttribute("moduleId");
    if (!moduleId) return null;

    const title = doc.querySelector("title")?.textContent?.trim()
        || doc.querySelector("label")?.textContent?.trim()
        || moduleId;
    const description = stripHtml(
        doc.querySelector("description")?.textContent?.trim() || title,
    );
    const tags = [...doc.querySelectorAll("tags tag")].map((tag) => tag.textContent?.trim() || "");
    const family = doc.querySelector('property[name="family"]')?.textContent?.trim()
        || doc.querySelector("property[name='family']")?.textContent?.trim();
    const taxonomy = doc.querySelector("taxonomy")?.textContent?.trim();
    const imagePath = doc.querySelector("breadboardView layers")?.getAttribute("image");
    if (!imagePath) return null;

    const connectors = parseFzpConnectors(doc);
    const breadboardSvgUrl = options?.breadboardSvgUrl ?? resolveBreadboardSvgUrl(imagePath);
    const svgText = options?.svgText;

    let pins = connectors.length > 0
        ? connectors.map((connector, index) => ({
            id: connector.id,
            name: connector.name,
            svgId: connector.svgId,
            x: ((index + 1) / (connectors.length + 1)) * 100,
            y: 90,
        }))
        : defaultPins(1);
    let viewBoxWidth = 100;
    let viewBoxHeight = 100;
    let physicalWidthInches = viewBoxWidth / 90;
    let physicalHeightInches = viewBoxHeight / 90;

    if (svgText) {
        const physical = resolveSvgPhysicalInches(svgText);
        viewBoxWidth = physical.viewBox.width;
        viewBoxHeight = physical.viewBox.height;
        physicalWidthInches = physical.widthInches;
        physicalHeightInches = physical.heightInches;
        if (connectors.length > 0) {
            const extracted = extractConnectorPins(svgText, connectors);
            pins = extracted.pins;
        }
    }

    return {
        source: "fritzing",
        moduleId,
        name: title,
        description,
        category: resolveFritzingCategory({
            moduleId,
            family,
            tags,
            title,
            taxonomy,
            fzpPath,
        }, categoryMaps),
        family,
        fzpPath,
        fzpSha,
        breadboardSvgUrl,
        breadboardImagePath: imagePath,
        physicalWidthInches,
        physicalHeightInches,
        viewBoxWidth,
        viewBoxHeight,
        pins,
    };
}
