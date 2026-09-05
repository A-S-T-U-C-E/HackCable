/**
 * @file Synchronisation du catalogue Fritzing depuis GitHub (orchestration).
 */
import {
    buildFamilyCategoryMap,
    parseCoreFzb,
    type FritzingCategoryMaps,
} from "./fritzing-categories";
import { loadFritzingCatalog, saveFritzingCatalog } from "./fritzing-catalog-storage";
import { parseFzp } from "./fritzing-fzp-parser";
import {
    FRITZING_RAW_BASE,
    FRITZING_SYNC_CONCURRENCY,
    fetchBreadboardSvg,
    fetchCoreFzb,
    fetchCoreFzpIndex,
    fetchRepoHeadSha,
    fzpFileFromBinPath,
    mapWithConcurrency,
    type GitTreeEntry,
} from "./fritzing-github";
import {
    FRITZING_ID_OFFSET,
    FRITZING_CATEGORY_ALGO_VERSION,
    FRITZING_PINS_ALGO_VERSION,
    FRITZING_SVG_URL_ALGO_VERSION,
    type FritzingCatalogStore,
    type FritzingComponentInfo,
    type FritzingSyncProgress,
    type FritzingSyncResult,
} from "./fritzing-types";

export { getStoredFritzingComponents, loadFritzingCatalog, saveFritzingCatalog } from "./fritzing-catalog-storage";

async function buildCategoryMaps(fzbXml: string): Promise<FritzingCategoryMaps> {
    const baseMaps = parseCoreFzb(fzbXml);
    const familyByModuleId = new Map<string, string>();

    const binJobs: { moduleId: string; fzpFile: string }[] = [];
    for (const match of fzbXml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
        const moduleId = match[1];
        const path = match[2];
        if (moduleId === "__spacer__") continue;
        const fzpFile = fzpFileFromBinPath(path);
        if (fzpFile) binJobs.push({ moduleId, fzpFile });
    }

    await mapWithConcurrency(binJobs, FRITZING_SYNC_CONCURRENCY, async (job) => {
        const response = await fetch(`${FRITZING_RAW_BASE}/core/${job.fzpFile}`);
        if (!response.ok) return;
        const xml = await response.text();
        const family = xml.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
        if (family) familyByModuleId.set(job.moduleId, family);
    });

    return {
        moduleToCategory: baseMaps.moduleToCategory,
        familyToCategory: buildFamilyCategoryMap(fzbXml, familyByModuleId),
        fzpFileToCategory: baseMaps.fzpFileToCategory,
    };
}

async function fetchFritzingPart(
    entry: GitTreeEntry,
    id: number,
    categoryMaps: FritzingCategoryMaps,
): Promise<FritzingComponentInfo | null> {
    const fzpPath = `core/${entry.path}`;
    const fzpResponse = await fetch(`${FRITZING_RAW_BASE}/${fzpPath}`);
    if (!fzpResponse.ok) return null;

    const xml = await fzpResponse.text();
    const fzpDoc = new DOMParser().parseFromString(xml, "application/xml");
    const imagePath = fzpDoc.querySelector("breadboardView layers")?.getAttribute("image");
    if (!imagePath) return null;

    const { url: breadboardSvgUrl, text: svgText } = await fetchBreadboardSvg(imagePath);
    const parsed = parseFzp(xml, fzpPath, entry.sha, categoryMaps, { svgText, breadboardSvgUrl });
    return parsed ? { ...parsed, id } : null;
}

/** Télécharge et intègre les pièces Fritzing manquantes ou modifiées. */
export async function syncFritzingCatalog(
    onProgress?: (progress: FritzingSyncProgress) => void,
): Promise<FritzingSyncResult> {
    onProgress?.({ phase: "index", done: 0, total: 1 });
    const [repoSha, remoteIndex, fzbXml] = await Promise.all([
        fetchRepoHeadSha(),
        fetchCoreFzpIndex(),
        fetchCoreFzb(),
    ]);
    const categoryMaps = await buildCategoryMaps(fzbXml);
    const stored = loadFritzingCatalog();
    const previousByPath = new Map((stored?.parts ?? []).map((part) => [part.fzpPath, part]));

    const pinsAlgoStale = stored?.pinsAlgoVersion !== FRITZING_PINS_ALGO_VERSION;
    const categoryAlgoStale = stored?.categoryAlgoVersion !== FRITZING_CATEGORY_ALGO_VERSION;
    const svgUrlAlgoStale = stored?.svgUrlAlgoVersion !== FRITZING_SVG_URL_ALGO_VERSION;

    const work = remoteIndex.filter((entry) => {
        if (pinsAlgoStale || categoryAlgoStale || svgUrlAlgoStale) return true;
        const path = `core/${entry.path}`;
        const previous = previousByPath.get(path);
        return !previous || previous.fzpSha !== entry.sha || stored?.repoSha !== repoSha || !previous.category;
    });

    let added = 0;
    let updated = 0;
    let nextId = FRITZING_ID_OFFSET;
    for (const part of previousByPath.values()) {
        nextId = Math.max(nextId, part.id + 1);
    }

    const jobs = work.map((entry) => {
        const path = `core/${entry.path}`;
        const previous = previousByPath.get(path);
        const id = previous?.id ?? nextId++;
        return { entry, path, id, previous };
    });

    const integrated = new Map<string, FritzingComponentInfo>(previousByPath);
    onProgress?.({ phase: "integrate", done: 0, total: jobs.length });

    await mapWithConcurrency(jobs, FRITZING_SYNC_CONCURRENCY, async (job, index) => {
        const part = await fetchFritzingPart(job.entry, job.id, categoryMaps);
        if (part) {
            integrated.set(job.path, part);
            if (!job.previous) added++;
            else updated++;
        }
        onProgress?.({ phase: "integrate", done: index + 1, total: jobs.length });
    });

    const remotePathSet = new Set(remoteIndex.map((entry) => `core/${entry.path}`));
    const parts: FritzingComponentInfo[] = [];

    for (const entry of remoteIndex) {
        const path = `core/${entry.path}`;
        const part = integrated.get(path);
        if (part) parts.push(part);
    }

    const removed = [...previousByPath.keys()].filter((path) => !remotePathSet.has(path)).length;
    const nextStore: FritzingCatalogStore = {
        repoSha,
        syncedAt: new Date().toISOString(),
        pinsAlgoVersion: FRITZING_PINS_ALGO_VERSION,
        categoryAlgoVersion: FRITZING_CATEGORY_ALGO_VERSION,
        svgUrlAlgoVersion: FRITZING_SVG_URL_ALGO_VERSION,
        parts,
    };
    saveFritzingCatalog(nextStore);

    return {
        upToDate: work.length === 0,
        added,
        updated,
        removed,
        total: parts.length,
        repoSha,
    };
}
