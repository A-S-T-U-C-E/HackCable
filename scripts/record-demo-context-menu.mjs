/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Démo filmée du menu contextuel (clic droit) — curseur visible.
 *
 * Scénario :
 * 1. Placement rapide Arduino + LED + câblage
 * 2. Menu composant : pivoter, premier plan
 * 3. Menu fil : étiquette (ajouter / modifier / supprimer), segments
 * 4. Menu plan : ajuster, zoom 100 %, export SVG
 * 5. Supprimer un composant
 *
 * Usage (serveur :9000) :
 *   npm run demo:record:ctx
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs", "demo");
const BASE_URL =
  process.env.HACKCABLE_DEMO_URL ||
  "http://localhost:9000/?lang=fr&minimap=1&autocollapse=0&labels=both&font=Rubik&fontsize=13&lineheight=1.35&align=start&focus=0&accent=e6000b&router=interactiveManhattanBridged&record=1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function installVisibleCursor(page) {
  await page.evaluate(() => {
    document.getElementById("demo-mouse-cursor")?.remove();
    document.getElementById("demo-mouse-label")?.remove();
    document.getElementById("demo-click-ring")?.remove();
    document.getElementById("demo-cursor-style")?.remove();

    const style = document.createElement("style");
    style.id = "demo-cursor-style";
    style.textContent = `
      html.demo-recording, html.demo-recording * { cursor: none !important; }
      #demo-mouse-cursor {
        position: fixed; left: 40px; top: 40px; width: 44px; height: 44px;
        pointer-events: none; z-index: 2147483647;
        transform: translate(-4px, -4px);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.65));
      }
      #demo-click-ring {
        position: fixed; width: 40px; height: 40px; margin: -20px 0 0 -20px;
        border: 3px solid #e6000b; border-radius: 50%;
        background: rgba(230,0,11,.12);
        pointer-events: none; z-index: 2147483646; opacity: 0;
        transition: opacity .12s ease, transform .12s ease;
        transform: scale(.5);
      }
      #demo-click-ring.is-on { opacity: 1; transform: scale(1); }
      #demo-mouse-label {
        position: fixed; left: 40px; top: 40px; pointer-events: none; z-index: 2147483647;
        background: #111; color: #fff; font: 600 12px/1.2 Rubik, system-ui, sans-serif;
        padding: 4px 8px; border-radius: 4px; border: 1px solid #e6000b;
        transform: translate(20px, 22px); white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,.35);
      }
    `;
    document.documentElement.appendChild(style);
    document.documentElement.classList.add("demo-recording");

    const cursor = document.createElement("div");
    cursor.id = "demo-mouse-cursor";
    cursor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24">
      <path fill="#e6000b" stroke="#fff" stroke-width="1.6"
        d="M4 3l1.2 16.5 4.2-4.1 3.6 7.2 2.2-1.1-3.6-7.1L18 12.2z"/>
    </svg>`;
    document.body.appendChild(cursor);

    const label = document.createElement("div");
    label.id = "demo-mouse-label";
    label.textContent = "souris";
    document.body.appendChild(label);

    const ring = document.createElement("div");
    ring.id = "demo-click-ring";
    document.body.appendChild(ring);

    window.__demoCursor = {
      move(x, y) {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
      },
      setLabel(text) {
        label.textContent = text || "souris";
      },
      down(x, y) {
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.classList.add("is-on");
      },
      up() {
        ring.classList.remove("is-on");
      },
    };
  });
}

async function syncCursor(page, x, y, label) {
  await page.evaluate(
    ({ x, y, label }) => {
      window.__demoCursor?.move(x, y);
      if (label) window.__demoCursor?.setLabel(label);
    },
    { x, y, label: label ?? null },
  );
}

async function moveTo(page, x, y, steps = 18, label) {
  await page.mouse.move(x, y, { steps });
  await syncCursor(page, x, y, label);
  await sleep(30);
}

async function clickAt(page, x, y, opts = {}) {
  await moveTo(page, x, y, opts.steps ?? 16, opts.label);
  await sleep(100);
  await page.evaluate(({ x, y }) => window.__demoCursor?.down(x, y), { x, y });
  await page.mouse.click(x, y, {
    delay: opts.delay ?? 80,
    button: opts.button ?? "left",
  });
  await page.evaluate(() => window.__demoCursor?.up());
  await sleep(opts.after ?? 250);
}

async function clickLocator(page, locator, opts = {}) {
  await locator.waitFor({ state: "visible", timeout: opts.timeout ?? 30000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("locator without box");
  await clickAt(page, box.x + box.width / 2, box.y + box.height / 2, opts);
}

async function rightClickAt(page, x, y, label) {
  await clickAt(page, x, y, { button: "right", label: label ?? "clic droit", after: 350 });
  await page.locator(".hackCable-ctx-menu").waitFor({ state: "visible", timeout: 5000 });
  await sleep(400);
}

async function clickCtxItem(page, labelSubstring) {
  const item = page.locator(".hackCable-ctx-menu-item").filter({
    has: page.locator(".hackCable-ctx-menu-label", { hasText: labelSubstring }),
  });
  await item.first().waitFor({ state: "visible", timeout: 5000 });
  await clickLocator(page, item.first(), { label: labelSubstring, after: 500 });
  await sleep(300);
}

async function dragCatalogToCanvas(page, source, target) {
  const canvas = page.locator("#hackCable-canvas");
  const from = await source.boundingBox();
  const cbox = await canvas.boundingBox();
  if (!from || !cbox) throw new Error("drag boxes missing");

  const sx = from.x + from.width / 2;
  const sy = from.y + Math.min(from.height * 0.65, from.height - 8);
  await moveTo(page, sx, sy, 18, "glisser");
  await sleep(180);
  await source.dragTo(canvas, {
    force: true,
    targetPosition: { x: target.x - cbox.x, y: target.y - cbox.y },
  });
  await moveTo(page, target.x, target.y, 6, "déposer");
  await sleep(450);
}

async function wireWithVisibleMouse(page, fromPage, toPage, connectArgs) {
  await moveTo(page, fromPage.x, fromPage.y, 18, "port");
  await sleep(120);
  await page.evaluate(({ x, y }) => window.__demoCursor?.down(x, y), fromPage);
  await sleep(100);
  await moveTo(page, toPage.x, toPage.y, 40, "câbler");
  await sleep(120);
  await page.evaluate(() => window.__demoCursor?.up());
  const ok = await page.evaluate((args) => {
    const api = window.__hackCableRecord;
    api.clearDanglingConnections?.();
    return !!api.connect(args.fromFigureId, args.fromPort, args.toFigureId, args.toPort);
  }, connectArgs);
  if (!ok) throw new Error(`Connexion échouée: ${JSON.stringify(connectArgs)}`);
  await sleep(400);
}

async function findCatalogPreview(page, titleExact) {
  const card = page.locator(".hackCable-catalog-element").filter({
    has: page.locator("h3", { hasText: new RegExp(`^${titleExact}$`, "i") }),
  });
  await card.first().waitFor({ state: "visible", timeout: 15000 });
  return card.first().locator("[draggable='true']").first();
}

function pickPort(figure, candidates) {
  for (const name of candidates) {
    const p = figure.ports.find((x) => x.name === name);
    if (p) return p;
  }
  return figure.ports[0] ?? null;
}

async function typeIntoLabelEditor(page, text) {
  const editor = page.locator("#inplaceeditor");
  await editor.waitFor({ state: "visible", timeout: 6000 });
  const box = await editor.boundingBox();
  if (box) await moveTo(page, box.x + Math.min(20, box.width / 2), box.y + box.height / 2, 10, "étiquette");
  await editor.click({ clickCount: 3 });
  await page.keyboard.press("Control+A");
  await page.keyboard.type(text, { delay: 70 });
  await sleep(200);
  await page.keyboard.press("Enter");
  await sleep(500);
  await page.locator("#inplaceeditor").waitFor({ state: "detached", timeout: 3000 }).catch(() => null);
}

/** Ouvre l’éditeur d’étiquette (menu ou API) puis saisit le texte. */
async function editWireLabelViaUi(page, text, { create = false } = {}) {
  if (create) {
    await clickCtxItem(page, "Ajouter une étiquette");
  } else {
    await clickCtxItem(page, "Modifier l’étiquette");
  }
  await sleep(400);

  let visible = await page.locator("#inplaceeditor").isVisible().catch(() => false);
  if (!visible) {
    // L’éditeur draw2d peut être avalé par le clic menu — relancer via API
    if (create) {
      await page.evaluate((t) => window.__hackCableRecord.setWireLabel(0, t, true), text);
    } else {
      await page.evaluate(() => window.__hackCableRecord.startWireLabelEdit(0));
    }
    await sleep(500);
    visible = await page.locator("#inplaceeditor").isVisible().catch(() => false);
  }

  if (visible) {
    await typeIntoLabelEditor(page, text);
  } else {
    // Dernier recours : poser le texte sans éditeur inline
    await page.evaluate((t) => window.__hackCableRecord.setWireLabel(0, t, false), text);
    await syncCursor(page, 640, 360, `étiquette: ${text}`);
    await sleep(600);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rawDir = path.join(OUT_DIR, "_raw-ctx");
  fs.rmSync(rawDir, { recursive: true, force: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    slowMo: 45,
    args: ["--disable-web-security"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
    locale: "fr-FR",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on("dialog", async (d) => {
    await sleep(300);
    await d.accept();
  });

  console.log("Ouverture", BASE_URL);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#hackCable-catalog-search", { state: "visible" });
  await page.waitForFunction(() => !!window.__hackCableRecord, { timeout: 30000 });
  await installVisibleCursor(page);
  await sleep(500);
  await page.keyboard.press("Escape");

  const autoBtn = page.locator(".hackCable-catalog-auto-collapse-btn");
  if (await autoBtn.count()) {
    const pressed = await autoBtn.getAttribute("aria-pressed");
    if (pressed === "true") await clickLocator(page, autoBtn, { label: "catalogue ouvert" });
  }

  for (let i = 0; i < 20; i++) {
    const undo = page.locator("#undo");
    if (await undo.isDisabled()) break;
    await clickLocator(page, undo, { steps: 6, after: 50, label: "annuler" });
  }

  const viewport = page.locator(".hackCable-editor-viewport");
  const vbox = await viewport.boundingBox();
  if (!vbox) throw new Error("viewport missing");

  console.log("1) Placement…");
  const search = page.locator("#hackCable-catalog-search");
  await clickLocator(page, search, { label: "recherche" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.pressSequentially("arduino uno", { delay: 55 });
  await sleep(500);
  const tout = page.locator(".hackCable-catalog-nav-btn").first();
  if ((await tout.getAttribute("aria-expanded")) !== "true") {
    await clickLocator(page, tout, { label: "Tout" });
  }
  await dragCatalogToCanvas(page, await findCatalogPreview(page, "Arduino Uno"), {
    x: vbox.x + 260,
    y: vbox.y + 230,
  });

  await clickLocator(page, search, { label: "recherche" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.pressSequentially("led", { delay: 55 });
  await sleep(500);
  await dragCatalogToCanvas(page, await findCatalogPreview(page, "LED"), {
    x: vbox.x + 640,
    y: vbox.y + 200,
  });

  // Nettoyer la recherche pour voir le plan
  await clickLocator(page, search, { label: "nettoyer" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.dispatchEvent("input");
  await sleep(300);

  const figures = await page.evaluate(() => window.__hackCableRecord.listFigures());
  const arduino = figures.find((f) => /uno/i.test(f.name));
  const led = figures.find((f) => /^led$/i.test(f.name));
  if (!arduino || !led) throw new Error("Figures manquantes");

  const pin13 = pickPort(arduino, ["13"]);
  const gnd = pickPort(arduino, ["GND.1", "GND.2", "GND"]);
  const ledA = pickPort(led, ["A"]);
  const ledC = pickPort(led, ["C"]);
  const toPage = async (port) =>
    page.evaluate(({ x, y }) => window.__hackCableRecord.canvasToPage(x, y), {
      x: port.canvasX,
      y: port.canvasY,
    });

  console.log("2) Câblage…");
  await wireWithVisibleMouse(page, await toPage(pin13), await toPage(ledA), {
    fromFigureId: arduino.id,
    fromPort: pin13.name,
    toFigureId: led.id,
    toPort: ledA.name,
  });
  await wireWithVisibleMouse(page, await toPage(ledC), await toPage(gnd), {
    fromFigureId: led.id,
    fromPort: ledC.name,
    toFigureId: arduino.id,
    toPort: gnd.name,
  });
  await sleep(600);

  // --- Menu composant ---
  console.log("3) Menu composant…");
  let ledPos = await page.evaluate((id) => window.__hackCableRecord.figurePageCenter(id), led.id);
  await rightClickAt(page, ledPos.x, ledPos.y, "clic droit LED");
  await sleep(700);
  await clickCtxItem(page, "Pivoter de 90° (horaire)");
  await sleep(900);

  ledPos = await page.evaluate((id) => window.__hackCableRecord.figurePageCenter(id), led.id);
  await rightClickAt(page, ledPos.x, ledPos.y, "clic droit LED");
  await sleep(600);
  await clickCtxItem(page, "Pivoter de 90° (antihoraire)");
  await sleep(800);

  const unoPos = await page.evaluate((id) => window.__hackCableRecord.figurePageCenter(id), arduino.id);
  await rightClickAt(page, unoPos.x, unoPos.y, "clic droit Uno");
  await sleep(600);
  await clickCtxItem(page, "Mettre au premier plan");
  await sleep(700);

  // --- Menu fil : étiquette ---
  console.log("4) Menu fil (étiquette)…");
  let wire = await page.evaluate(() => window.__hackCableRecord.connectionClickPage(0));
  if (!wire) throw new Error("Pas de connexion");
  await rightClickAt(page, wire.x, wire.y, "clic droit fil");
  await sleep(700);
  await editWireLabelViaUi(page, "PIN13", { create: true });
  await sleep(900);

  wire = await page.evaluate(() => window.__hackCableRecord.connectionClickPage(0));
  await rightClickAt(page, wire.x, wire.y, "clic droit fil");
  await sleep(600);
  await editWireLabelViaUi(page, "LED", { create: false });
  await sleep(900);

  wire = await page.evaluate(() => window.__hackCableRecord.connectionClickPage(0));
  await rightClickAt(page, wire.x, wire.y, "clic droit fil");
  await sleep(600);
  await clickCtxItem(page, "Supprimer l’étiquette");
  await sleep(800);

  // --- Segments (routeur interactif) ---
  console.log("5) Segments…");
  wire = await page.evaluate(() => window.__hackCableRecord.connectionClickPage(0));
  await rightClickAt(page, wire.x, wire.y, "clic droit fil");
  await sleep(700);
  const addSeg = page.locator(".hackCable-ctx-menu-item").filter({
    has: page.locator(".hackCable-ctx-menu-label", { hasText: "Ajouter un segment" }),
  });
  if (await addSeg.count()) {
    await clickCtxItem(page, "Ajouter un segment");
    await sleep(1000);
    wire = await page.evaluate(() => window.__hackCableRecord.connectionClickPage(0));
    await rightClickAt(page, wire.x, wire.y, "clic droit fil");
    await sleep(600);
    const remSeg = page.locator(".hackCable-ctx-menu-item").filter({
      has: page.locator(".hackCable-ctx-menu-label", { hasText: "Supprimer le segment" }),
    });
    if (await remSeg.count()) {
      const disabled = await remSeg.first().isDisabled();
      if (!disabled) await clickCtxItem(page, "Supprimer le segment");
      else {
        await page.keyboard.press("Escape");
        await syncCursor(page, wire.x, wire.y, "segment non supprimable");
      }
    } else {
      await page.keyboard.press("Escape");
    }
    await sleep(700);
  } else {
    console.warn("Ajouter un segment indisponible — Escape");
    await page.keyboard.press("Escape");
    await sleep(400);
  }

  // --- Menu plan ---
  console.log("6) Menu plan…");
  const emptyX = vbox.x + 120;
  const emptyY = vbox.y + 90;
  await rightClickAt(page, emptyX, emptyY, "clic droit plan");
  await sleep(700);
  await clickCtxItem(page, "Ajuster à la fenêtre");
  await sleep(1200);

  await rightClickAt(page, emptyX, emptyY, "clic droit plan");
  await sleep(600);
  await clickCtxItem(page, "Zoom à 100");
  await sleep(1000);

  await rightClickAt(page, emptyX, emptyY, "clic droit plan");
  await sleep(600);
  const downloadPromise = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  await clickCtxItem(page, "Exporter en SVG");
  const download = await downloadPromise;
  if (download) {
    const svgPath = path.join(OUT_DIR, "hackcable-ctx-export.svg");
    await download.saveAs(svgPath);
    console.log("SVG exporté:", path.relative(ROOT, svgPath));
  }
  await sleep(800);

  // --- Supprimer LED ---
  console.log("7) Supprimer…");
  ledPos = await page.evaluate((id) => window.__hackCableRecord.figurePageCenter(id), led.id);
  if (ledPos) {
    await rightClickAt(page, ledPos.x, ledPos.y, "clic droit LED");
    await sleep(600);
    await clickCtxItem(page, "Supprimer le composant");
    await sleep(1000);
  }

  await moveTo(page, emptyX, emptyY, 12, "fin");
  await sleep(1800);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error("Vidéo Playwright introuvable");
  }

  const webmOut = path.join(OUT_DIR, "hackcable-demo-context-menu.webm");
  const mp4Out = path.join(OUT_DIR, "hackcable-demo-context-menu.mp4");
  fs.copyFileSync(videoPath, webmOut);

  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", webmOut, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", mp4Out],
    { encoding: "utf8" },
  );
  if (ff.status !== 0) {
    console.warn("ffmpeg mp4 échoué");
    console.warn(ff.stderr?.slice(-400));
  }

  fs.rmSync(rawDir, { recursive: true, force: true });

  console.log("Vidéo enregistrée :");
  console.log(" -", path.relative(ROOT, webmOut));
  if (fs.existsSync(mp4Out)) console.log(" -", path.relative(ROOT, mp4Out));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
