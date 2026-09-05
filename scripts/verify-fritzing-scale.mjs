/**
 * Vérifie l'échelle Fritzing (90 px/in) vs Wokwi (3.8 px/mm) sur quelques pièces.
 */
const FRITZING_DPI = 90;
const WOKWI_PX_PER_MM = 3.8;

function fritzingConvertToInches(raw, isIllustrator) {
    let text = raw.trim();
    let divisor = 1;
    let chop = 2;
    const lower = text.toLowerCase();
    if (lower.endsWith("cm")) divisor = 2.54;
    else if (lower.endsWith("mm")) divisor = 25.4;
    else if (lower.endsWith("in")) divisor = 1;
    else if (lower.endsWith("px")) divisor = isIllustrator ? 72 : 90;
    else {
        while (text.length && !/[\d.]/.test(text[text.length - 1])) text = text.slice(0, -1);
        divisor = 90;
        chop = 0;
    }
    if (chop) text = text.slice(0, -chop);
    return Number.parseFloat(text) / divisor;
}

async function analyze(name, svgUrl) {
    const svg = await fetch(svgUrl).then((r) => r.text());
    const isIllustrator = /Adobe Illustrator/i.test(svg);
    const open = svg.match(/<svg[^>]*>/)?.[0] ?? "";
    const wRaw = open.match(/\bwidth="([^"]+)"/)?.[1];
    const hRaw = open.match(/\bheight="([^"]+)"/)?.[1];
    const wIn = fritzingConvertToInches(wRaw, isIllustrator);
    const hIn = fritzingConvertToInches(hRaw, isIllustrator);
    console.log(JSON.stringify({
        part: name,
        illustrator: isIllustrator,
        inches: [wIn, hIn],
        fritzingPx: [wIn * FRITZING_DPI, hIn * FRITZING_DPI],
        wokwiPx: [wIn * 25.4 * WOKWI_PX_PER_MM, hIn * 25.4 * WOKWI_PX_PER_MM],
    }));
}

const base = "https://raw.githubusercontent.com/fritzing/fritzing-parts/develop/svg/core/breadboard";
await analyze("arduino_uno", `${base}/arduino_Uno_Rev3_breadboard.svg`);
await analyze("resistor", `${base}/resistor_220.svg`);
await analyze("led", `${base}/LED-5mm-red-leg.svg`);
