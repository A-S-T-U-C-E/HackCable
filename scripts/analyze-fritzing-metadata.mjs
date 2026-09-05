const tree = await fetch("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1").then((r) => r.json());
const sample = tree.tree.filter((t) => t.path.endsWith(".fzp")).slice(0, 200);

const families = new Map();
const taxonomies = new Map();
let withFamily = 0;
let withTaxonomy = 0;

for (const entry of sample) {
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${entry.path}`).then((r) => r.text());
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1]?.trim();
    const taxonomy = fzp.match(/<taxonomy>([^<]+)<\/taxonomy>/)?.[1]?.trim();
    if (family) {
        withFamily++;
        families.set(family, (families.get(family) || 0) + 1);
    }
    if (taxonomy) {
        withTaxonomy++;
        const root = taxonomy.split(".")[0];
        taxonomies.set(root, (taxonomies.get(root) || 0) + 1);
    }
}

console.log("Sample 200 fzps:");
console.log("with family:", withFamily);
console.log("with taxonomy:", withTaxonomy);
console.log("\nTop families:");
console.log([...families.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25));
console.log("\nTaxonomy roots:");
console.log([...taxonomies.entries()].sort((a, b) => b[1] - a[1]));
