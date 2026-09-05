const xml = await fetch("https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/bins/core.fzb").then((r) => r.text());

const moduleToCategory = new Map();
let currentCategory = null;
for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
    const ref = match[1];
    const path = match[2];
    if (ref === "__spacer__") currentCategory = path;
    else if (currentCategory) moduleToCategory.set(ref, currentCategory);
}

const tree = await fetch("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1").then((r) => r.json());
const fzps = tree.tree.filter((t) => t.path.endsWith(".fzp"));

const familyToCategory = new Map();
for (const [moduleId, category] of moduleToCategory) {
    const entry = fzps.find((f) => {
        const base = f.path.replace(/\.fzp$/, "");
        return base === moduleId || f.path.includes(moduleId);
    });
    // find by fetching - use path from core.fzb instances
}

// Better: parse path from core.fzb
const moduleToPath = new Map();
currentCategory = null;
for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
    const ref = match[1];
    const path = match[2];
    if (ref === "__spacer__") currentCategory = path;
    else if (currentCategory && !path.includes(":/")) {
        moduleToCategory.set(ref, currentCategory);
        moduleToPath.set(ref, path.replace(/^.*\//, ""));
    }
}

for (const [moduleId, fzpFile] of moduleToPath) {
    const category = moduleToCategory.get(moduleId);
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${fzpFile}`).then((r) => r.text());
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
    if (family && category) {
        if (!familyToCategory.has(family)) familyToCategory.set(family, category);
    }
}

console.log("Families from bin:", familyToCategory.size);
console.log([...familyToCategory.entries()].slice(0, 20));

let byModule = 0;
let byFamily = 0;
let none = 0;
const missing = [];

for (const entry of fzps) {
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${entry.path}`).then((r) => r.text());
    const moduleId = fzp.match(/moduleId="([^"]+)"/)?.[1];
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
    if (moduleId && moduleToCategory.has(moduleId)) byModule++;
    else if (family && familyToCategory.has(family)) byFamily++;
    else {
        none++;
        if (missing.length < 15) missing.push({ path: entry.path, moduleId, family });
    }
}

console.log(`Total: ${fzps.length}`);
console.log(`By moduleId: ${byModule}`);
console.log(`By family: ${byFamily}`);
console.log(`Unmapped: ${none}`);
console.log("Missing samples:", missing);
