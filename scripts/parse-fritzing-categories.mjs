const xml = await fetch("https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/bins/core.fzb").then((r) => r.text());

const instanceRegex = /<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"[^>]*>/g;
let currentCategory = "Uncategorized";
const moduleToCategory = new Map();
const categories = new Set();

for (const match of xml.matchAll(instanceRegex)) {
    const moduleId = match[1];
    const path = match[2];

    if (moduleId === "__spacer__") {
        currentCategory = path;
        categories.add(path);
        continue;
    }

    moduleToCategory.set(moduleId, currentCategory);
}

console.log("Fritzing core categories:");
for (const cat of [...categories].sort()) {
    const count = [...moduleToCategory.values()].filter((c) => c === cat).length;
    console.log(`- ${cat}: ${count} parts`);
}

// Test yl99
const yl99 = await fetch("https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/yl99_1.fzp").then((r) => r.text());
const moduleId = yl99.match(/moduleId="([^"]+)"/)?.[1];
console.log("\nYL99 moduleId:", moduleId, "category:", moduleToCategory.get(moduleId));

// How many core fzps map?
const tree = await fetch("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1").then((r) => r.json());
const fzps = tree.tree.filter((t) => t.path.endsWith(".fzp"));
let mapped = 0;
for (const f of fzps.slice(0, 50)) {
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${f.path}`).then((r) => r.text());
    const id = fzp.match(/moduleId="([^"]+)"/)?.[1];
    if (moduleToCategory.has(id)) mapped++;
}
console.log(`\nMapped in first 50 fzps: ${mapped}/50`);
