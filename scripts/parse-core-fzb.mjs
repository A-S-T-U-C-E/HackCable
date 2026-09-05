const xml = await fetch("https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/bins/core.fzb").then((r) => r.text());

const categories = [];
const moduleToCategory = new Map();
let currentCategory = null;

for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
    const ref = match[1];
    const path = match[2];
    if (ref === "__spacer__") {
        currentCategory = path;
        categories.push(path);
    } else if (currentCategory) {
        moduleToCategory.set(ref, currentCategory);
    }
}

console.log("Categories:", categories);
console.log("Mapped parts:", moduleToCategory.size);

// Check coverage on full core index
const tree = await fetch("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1").then((r) => r.json());
const fzps = tree.tree.filter((t) => t.path.endsWith(".fzp"));

let covered = 0;
for (const entry of fzps.slice(0, 500)) {
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${entry.path}`).then((r) => r.text());
    const moduleId = fzp.match(/moduleId="([^"]+)"/)?.[1];
    if (moduleId && moduleToCategory.has(moduleId)) covered++;
}
console.log(`Coverage in first 500 fzps: ${covered}/500`);
