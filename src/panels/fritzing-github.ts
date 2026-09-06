/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Accès HTTP au dépôt GitHub fritzing-parts (index, FZP, SVG).
 *
 * Responsabilités :
 * - SHA du dépôt, arbre core/, téléchargement concurrent
 * - Résolution d’URL breadboard (candidats svg/)
 */
export const FRITZING_REPO = "fritzing/fritzing-parts";
export const FRITZING_BRANCH = "develop";
export const FRITZING_RAW_BASE = `https://raw.githubusercontent.com/${FRITZING_REPO}/${FRITZING_BRANCH}`;
export const FRITZING_SYNC_CONCURRENCY = 12;

export type GitTreeEntry = { path: string; sha: string; type: string };

/**
 * Extrait le nom de fichier FZP depuis un chemin de bin core.fzb.
 * @param path - Chemin relatif issu de core.fzb.
 * @returns Nom de fichier `.fzp`, ou `null` si invalide.
 */
export function fzpFileFromBinPath(path: string): string | null {
    if (path.includes(":/")) return null;
    const file = path.replace(/^.*\//, "");
    return file.endsWith(".fzp") ? file : null;
}

/**
 * Liste les URL candidates pour un chemin `image` breadboard issu d’un FZP.
 * @param imagePath - Chemin image du FZP (breadboardView).
 * @returns URLs ordonnées par préférence de résolution.
 */
export function breadboardSvgUrlCandidates(imagePath: string): string[] {
    const normalized = imagePath.replace(/^breadboard\//, "");
    const fileName = normalized.split("/").pop() ?? normalized;
    const baseName = fileName.replace(/\.svg$/i, "");
    const candidates: string[] = [];

    if (
        normalized.startsWith("icon/")
        || normalized.startsWith("pcb/")
        || normalized.startsWith("schematic/")
    ) {
        candidates.push(`${FRITZING_RAW_BASE}/svg/core/${normalized}`);
    } else {
        candidates.push(`${FRITZING_RAW_BASE}/svg/core/breadboard/${normalized}`);
        candidates.push(`${FRITZING_RAW_BASE}/svg/obsolete/breadboard/${fileName}`);
    }

    candidates.push(`${FRITZING_RAW_BASE}/svg/core/icon/${baseName}.svg`);
    candidates.push(`${FRITZING_RAW_BASE}/svg/core/icon/${baseName}_icon.svg`);

    return [...new Set(candidates)];
}

/**
 * Retourne la première URL candidate breadboard sans vérification réseau.
 * @param imagePath - Chemin image du FZP (breadboardView).
 * @returns URL la plus probable du SVG breadboard.
 */
export function resolveBreadboardSvgUrl(imagePath: string): string {
    return breadboardSvgUrlCandidates(imagePath)[0];
}

/**
 * Résout l’URL breadboard en testant les candidats jusqu’à un SVG accessible.
 * @param imagePath - Chemin image du FZP (breadboardView).
 * @returns URL retenue et contenu SVG si le téléchargement a réussi.
 */
export async function fetchBreadboardSvg(
    imagePath: string,
): Promise<{ url: string; text?: string }> {
    for (const url of breadboardSvgUrlCandidates(imagePath)) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return { url, text: await response.text() };
            }
        } catch {
            // Essayer le candidat suivant.
        }
    }
    return { url: resolveBreadboardSvgUrl(imagePath) };
}

/**
 * Exécute un worker sur une liste avec un plafond de concurrence.
 * @param items - Éléments à traiter.
 * @param limit - Nombre maximal de tâches parallèles.
 * @param worker - Fonction asynchrone appliquée à chaque élément.
 * @returns Tableau des résultats dans l’ordre d’entrée.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    async function run(): Promise<void> {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
    return results;
}

/**
 * Récupère le SHA du commit HEAD de la branche Fritzing sur GitHub.
 * @returns SHA du commit courant sur la branche develop.
 */
export async function fetchRepoHeadSha(): Promise<string> {
    const response = await fetch(`https://api.github.com/repos/${FRITZING_REPO}/commits/${FRITZING_BRANCH}`);
    if (!response.ok) {
        throw new Error(`Impossible de contacter le dépôt Fritzing (${response.status}).`);
    }
    const json = await response.json() as { sha?: string };
    if (!json.sha) throw new Error("Réponse GitHub invalide (SHA manquant).");
    return json.sha;
}

/**
 * Télécharge le fichier bins/core.fzb du dépôt Fritzing.
 * @returns Contenu XML de core.fzb.
 */
export async function fetchCoreFzb(): Promise<string> {
    const response = await fetch(`${FRITZING_RAW_BASE}/bins/core.fzb`);
    if (!response.ok) {
        throw new Error(`Impossible de lire core.fzb (${response.status}).`);
    }
    return response.text();
}

/**
 * Récupère l’index récursif des fichiers `.fzp` du dossier core.
 * @returns Entrées Git tree pour chaque blob FZP.
 */
export async function fetchCoreFzpIndex(): Promise<GitTreeEntry[]> {
    const response = await fetch(
        `https://api.github.com/repos/${FRITZING_REPO}/git/trees/${FRITZING_BRANCH}:core?recursive=1`,
    );
    if (!response.ok) {
        throw new Error(`Impossible de lire l'index Fritzing (${response.status}).`);
    }
    const json = await response.json() as { tree?: GitTreeEntry[] };
    return (json.tree ?? []).filter((entry) => entry.type === "blob" && entry.path.endsWith(".fzp"));
}
