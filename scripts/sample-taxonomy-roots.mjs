const tree = await fetch("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1").then((r) => r.json());
const fzps = tree.tree.filter((t) => t.path.endsWith(".fzp"));

const taxRoots = new Map();
const families = new Map();
let n = 0;

for (const entry of fzps) {
    if (n++ % 50 !== 0) continue;
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${entry.path}`).then((r) => r.text());
    const taxonomy = fzp.match(/<taxonomy>([^<]+)<\/taxonomy>/)?.[1]?.trim();
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
    if (taxonomy) {
        const root = taxonomy.split(".")[0].toLowerCase();
        taxRoots.set(root, (taxRoots.get(root) || 0) + 1);
    }
    if (family) families.set(family, (families.get(family) || 0) + 1);
}

console.log("Taxonomy roots (sample):", [...taxRoots.entries()].sort((a, b) => b[1] - a[1]));
console.log("Top families (sample):", [...families.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
