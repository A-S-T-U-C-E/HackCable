const tree = await fetch(
    "https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop:core?recursive=1",
).then((r) => r.json());

const fzps = tree.tree.filter((t) => t.path.endsWith(".fzp") && /led|header|pin.*header|resistor/i.test(t.path));

function parsePhysicalLength(raw) {
    if (!raw) return null;
    const text = raw.trim();
    const match = text.match(/^([\d.]+)\s*(in|mm|px)?$/i);
    if (!match) return null;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return null;
    const unit = (match[2] || "px").toLowerCase();
    if (unit === "in") return { inches: value, unit };
    if (unit === "mm") return { inches: value / 25.4, unit };
    return { inches: null, unit: "px", px: value };
}

for (const entry of fzps.slice(0, 25)) {
    const fzp = await fetch(
        `https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/core/${entry.path}`,
    ).then((r) => r.text());
    const image = fzp.match(/breadboardView[\s\S]*?image=['"]breadboard\/([^'"]+)['"]/)?.[1];
    if (!image) continue;

    const svgRes = await fetch(
        `https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/svg/core/breadboard/${image}`,
    );
    if (!svgRes.ok) continue;

    const open = (await svgRes.text()).match(/<svg[^>]*>/)?.[0] ?? "";
    const viewBox = open.match(/viewBox="([^"]+)"/)?.[1];
    const widthRaw = open.match(/\bwidth="([^"]+)"/)?.[1];
    const heightRaw = open.match(/\bheight="([^"]+)"/)?.[1];
    const width = parsePhysicalLength(widthRaw);
    const height = parsePhysicalLength(heightRaw);
    const vb = viewBox?.trim().split(/[\s,]+/).map(Number) ?? [];
    const oldW = vb[2] * 3.8;
    const oldH = vb[3] * 3.8;
    const newW = width?.inches ? width.inches * 273 : null;
    const newH = height?.inches ? height.inches * 273 : null;

    console.log(
        JSON.stringify({
            part: entry.path.split("/").pop(),
            viewBox,
            widthRaw,
            heightRaw,
            oldPx: [oldW, oldH],
            physPx: [newW, newH],
        }),
    );
}
