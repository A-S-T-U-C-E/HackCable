const BASE = "https://raw.githubusercontent.com/fritzing/fritzing-parts/develop";
const CONCURRENCY = 24;

function resolveCurrent(imagePath) {
    const file = imagePath.replace(/^breadboard\//, "");
    return `${BASE}/svg/core/breadboard/${file}`;
}

function resolveFixed(imagePath) {
    const normalized = imagePath.replace(/^breadboard\//, "");
    if (
        normalized.startsWith("icon/")
        || normalized.startsWith("pcb/")
        || normalized.startsWith("schematic/")
    ) {
        return `${BASE}/svg/core/${normalized}`;
    }
    return `${BASE}/svg/core/breadboard/${normalized}`;
}

async function mapWithConcurrency(items, worker) {
    const results = [];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index], index);
        }
    }));
    return results;
}

const treeResponse = await fetch(
    "https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop?recursive=1",
);
const tree = (await treeResponse.json()).tree.filter(
    (entry) => entry.path.startsWith("core/") && entry.path.endsWith(".fzp"),
);

const imagePaths = new Map();

await mapWithConcurrency(tree, async (entry) => {
    const fzpResponse = await fetch(`${BASE}/${entry.path}`);
    if (!fzpResponse.ok) return;
    const xml = await fzpResponse.text();
    const match = xml.match(/<breadboardView>[\s\S]*?<layers[^>]*image="([^"]+)"/);
    if (!match) return;
    const imagePath = match[1];
    const bucket = imagePaths.get(imagePath) ?? { count: 0, samples: [] };
    bucket.count++;
    if (bucket.samples.length < 2) bucket.samples.push(entry.path);
    imagePaths.set(imagePath, bucket);
});

const urlCache = new Map();
async function headOk(url) {
    if (!urlCache.has(url)) {
        const response = await fetch(url, { method: "HEAD" });
        urlCache.set(url, response.ok);
    }
    return urlCache.get(url);
}

let brokenCurrent = 0;
let brokenFixed = 0;
const stillBroken = [];

for (const [imagePath, meta] of imagePaths) {
    const currentOk = await headOk(resolveCurrent(imagePath));
    const fixedOk = await headOk(resolveFixed(imagePath));
    if (!currentOk) brokenCurrent += meta.count;
    if (!fixedOk) {
        brokenFixed += meta.count;
        stillBroken.push({ imagePath, count: meta.count, samples: meta.samples });
    }
}

console.log(JSON.stringify({
    parts: tree.length,
    uniquePaths: imagePaths.size,
    brokenCurrent,
    brokenFixed,
    stillBroken: stillBroken.sort((a, b) => b.count - a.count).slice(0, 20),
}, null, 2));
