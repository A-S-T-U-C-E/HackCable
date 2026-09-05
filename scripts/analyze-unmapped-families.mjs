const tree = await fetch("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1").then((r) => r.json());
const fzps = tree.tree.filter((t) => t.path.endsWith(".fzp"));

const xml = await fetch("https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/bins/core.fzb").then((r) => r.text());
const moduleToCategory = new Map();
const familyToCategory = new Map();
let currentCategory = null;

for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
    const ref = match[1];
    const path = match[2];
    if (ref === "__spacer__") currentCategory = path;
    else if (currentCategory && ref !== "__spacer__") moduleToCategory.set(ref, currentCategory);
}

const binPaths = new Map();
currentCategory = null;
for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
    const ref = match[1];
    const path = match[2];
    if (ref === "__spacer__") currentCategory = path;
    else if (currentCategory && !path.includes(":/")) binPaths.set(ref, path.replace(/^.*\//, ""));
}

for (const [moduleId, fzpFile] of binPaths) {
    const category = moduleToCategory.get(moduleId);
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${fzpFile}`).then((r) => r.text());
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
    if (family && category && !familyToCategory.has(family)) familyToCategory.set(family, category);
}

const unmappedFamilies = new Map();
for (const entry of fzps) {
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${entry.path}`).then((r) => r.text());
    const moduleId = fzp.match(/moduleId="([^"]+)"/)?.[1];
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
    const tags = [...fzp.matchAll(/<tag>([^<]+)<\/tag>/g)].map((m) => m[1]);
    const title = fzp.match(/<title>([^<]+)<\/title>/)?.[1] || "";

    let cat = moduleId ? moduleToCategory.get(moduleId) : undefined;
    if (!cat && family) cat = familyToCategory.get(family);
    if (!cat) {
        const key = family || "(no family)";
        if (!unmappedFamilies.has(key)) unmappedFamilies.set(key, { count: 0, sample: title, tags: tags.slice(0, 5) });
        unmappedFamilies.get(key).count++;
    }
}

console.log("Top unmapped families:");
console.log([...unmappedFamilies.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 40));
