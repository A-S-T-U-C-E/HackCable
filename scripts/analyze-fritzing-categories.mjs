const samples = [
    "core/SMD_resistor_0402.fzp",
    "core/yl99_1.fzp",
    "core/74HC595.fzp",
    "core/Arduino_Uno_Rev3(fix).fzp",
    "core/LED-5mm-red.fzp",
];

for (const p of samples) {
    const fzp = await fetch(`https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/${p}`).then((r) => r.text());
    const family = fzp.match(/property name="family"[^>]*>([^<]+)/)?.[1];
    const taxonomy = fzp.match(/<taxonomy>([^<]+)<\/taxonomy>/)?.[1];
    const tags = [...fzp.matchAll(/<tag>([^<]+)<\/tag>/g)].map((m) => m[1]).slice(0, 4);
    console.log(p.split("/").pop(), { family, taxonomy, tags });
}
