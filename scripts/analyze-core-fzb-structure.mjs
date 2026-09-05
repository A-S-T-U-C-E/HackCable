const xml = await fetch("https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/bins/core.fzb").then((r) => r.text());

let current = null;
const pathTypes = { spacer: 0, bin: 0, fzp: 0, other: 0 };
const samples = { bin: [], other: [] };

for (const match of xml.matchAll(/<instance[^>]*moduleIdRef="([^"]+)"[^>]*path="([^"]+)"/g)) {
    const ref = match[1];
    const path = match[2];
    if (ref === "__spacer__") {
        pathTypes.spacer++;
        current = path;
        continue;
    }
    if (path.includes(":/")) {
        pathTypes.bin++;
        if (samples.bin.length < 8) samples.bin.push({ ref, path, category: current });
    } else if (path.endsWith(".fzp") || path.includes(".fzp")) {
        pathTypes.fzp++;
    } else {
        pathTypes.other++;
        if (samples.other.length < 8) samples.other.push({ ref, path, category: current });
    }
}

console.log("Instance path types:", pathTypes);
console.log("Bin samples:", samples.bin);
console.log("Other samples:", samples.other);
