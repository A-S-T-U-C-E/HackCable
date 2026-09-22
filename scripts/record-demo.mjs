/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Démo filmée avec souris visible (Playwright).
 *
 * Pourquoi l’ancienne vidéo avait des fils « en l’air » :
 * les gestes de câblage via souris synthétique / `dispatchEvent` ne terminent
 * pas correctement `DragConnectionCreatePolicy` (traits temporaires orphelins).
 * Ici : curseur overlay très visible + drag catalogue réel + connexions créées
 * via l’API (`?record=1` → `window.__hackCableRecord`) pendant que la souris
 * mime le geste port → port.
 *
 * Usage (serveur déjà lancé sur :9000) :
 *   npm run demo:record
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs", "demo");
const BASE_URL =
  process.env.HACKCABLE_DEMO_URL ||
  "http://localhost:9000/?lang=fr&minimap=1&autocollapse=0&labels=both&font=Rubik&fontsize=13&lineheight=1.35&align=start&focus=0&accent=e6000b&router=direct&record=1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Curseur overlay très visible (Playwright n’enregistre pas le curseur OS). */
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
  await page.mouse.click(x, y, { delay: opts.delay ?? 80 });
  await page.evaluate(() => window.__demoCursor?.up());
  await sleep(opts.after ?? 250);
}

async function clickLocator(page, locator, opts = {}) {
  await locator.waitFor({ state: "visible", timeout: opts.timeout ?? 30000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("locator without box");
  await clickAt(page, box.x + box.width / 2, box.y + box.height / 2, opts);
}

async function dragCatalogToCanvas(page, source, target) {
  const canvas = page.locator("#hackCable-canvas");
  const from = await source.boundingBox();
  const cbox = await canvas.boundingBox();
  if (!from || !cbox) throw new Error("drag boxes missing");

  const sx = from.x + from.width / 2;
  const sy = from.y + Math.min(from.height * 0.65, from.height - 8);
  await moveTo(page, sx, sy, 22, "glisser composant");
  await sleep(250);

  await source.dragTo(canvas, {
    force: true,
    targetPosition: {
      x: target.x - cbox.x,
      y: target.y - cbox.y,
    },
  });
  await moveTo(page, target.x, target.y, 6, "déposer");
  await sleep(550);
}

/**
 * Mime un geste de câblage SANS mousedown (sinon draw2d laisse des traits orphelins),
 * puis crée la vraie connexion via l’API record.
 */
async function wireWithVisibleMouse(page, fromPage, toPage, connectArgs) {
  await moveTo(page, fromPage.x, fromPage.y, 22, "port source");
  await sleep(220);
  // Anneau “clic” purement visuel — pas de page.mouse.down (évite DragConnectionCreatePolicy)
  await page.evaluate(({ x, y }) => window.__demoCursor?.down(x, y), fromPage);
  await sleep(180);
  await moveTo(page, toPage.x, toPage.y, 52, "tirer le fil");
  await sleep(200);
  await page.evaluate(({ x, y }) => {
    window.__demoCursor?.down(x, y);
    window.__demoCursor?.up();
  }, toPage);

  const ok = await page.evaluate((args) => {
    const api = window.__hackCableRecord;
    if (!api) return false;
    api.clearDanglingConnections?.();
    return !!api.connect(args.fromFigureId, args.fromPort, args.toFigureId, args.toPort);
  }, connectArgs);
  if (!ok) throw new Error(`Connexion échouée: ${JSON.stringify(connectArgs)}`);
  await syncCursor(page, toPage.x, toPage.y, "connecté");
  await sleep(550);
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rawDir = path.join(OUT_DIR, "_raw");
  fs.rmSync(rawDir, { recursive: true, force: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    slowMo: 40,
    args: ["--disable-web-security"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
    locale: "fr-FR",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(90000);

  page.on("dialog", async (d) => {
    await sleep(400);
    await d.accept();
  });

  console.log("Ouverture", BASE_URL);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#update-catalog", { state: "visible" });
  await page.waitForFunction(() => !!window.__hackCableRecord, { timeout: 30000 });
  await installVisibleCursor(page);
  await sleep(500);
  await page.keyboard.press("Escape");
  await sleep(300);

  await moveTo(page, 200, 80, 10, "démarrage");

  console.log("1) Mise à jour…");
  await clickLocator(page, page.locator("#update-catalog"), { label: "Mise à jour" });
  await page.waitForFunction(
    () => {
      const btn = document.getElementById("update-catalog");
      return btn && !btn.hasAttribute("disabled") && !btn.classList.contains("is-syncing");
    },
    { timeout: 120000 },
  );
  await sleep(900);

  const autoBtn = page.locator(".hackCable-catalog-auto-collapse-btn");
  if (await autoBtn.count()) {
    const pressed = await autoBtn.getAttribute("aria-pressed");
    if (pressed === "true") {
      await clickLocator(page, autoBtn, { label: "catalogue ouvert" });
    }
  }

  for (let i = 0; i < 25; i++) {
    const undo = page.locator("#undo");
    if (await undo.isDisabled()) break;
    await clickLocator(page, undo, { steps: 8, after: 80, label: "annuler" });
  }

  const viewport = page.locator(".hackCable-editor-viewport");
  const vbox = await viewport.boundingBox();
  if (!vbox) throw new Error("viewport missing");

  console.log("2) Recherche Arduino Uno…");
  const search = page.locator("#hackCable-catalog-search");
  await clickLocator(page, search, { label: "recherche" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.pressSequentially("arduino uno", { delay: 70 });
  await sleep(700);

  const tout = page.locator(".hackCable-catalog-nav-btn").first();
  if ((await tout.getAttribute("aria-expanded")) !== "true") {
    await clickLocator(page, tout, { label: "catégorie Tout" });
  }
  await sleep(500);

  console.log("3) Placement + câblage…");
  const arduinoPreview = await findCatalogPreview(page, "Arduino Uno");
  await dragCatalogToCanvas(page, arduinoPreview, {
    x: vbox.x + 280,
    y: vbox.y + 220,
  });

  await clickLocator(page, search, { label: "recherche" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.pressSequentially("led", { delay: 70 });
  await sleep(700);
  const ledPreview = await findCatalogPreview(page, "LED");
  await dragCatalogToCanvas(page, ledPreview, {
    x: vbox.x + 620,
    y: vbox.y + 190,
  });

  await clickLocator(page, search, { label: "recherche" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.pressSequentially("resistance", { delay: 70 });
  await sleep(700);
  const resPreview = await findCatalogPreview(page, "Résistance");
  await dragCatalogToCanvas(page, resPreview, {
    x: vbox.x + 620,
    y: vbox.y + 330,
  });

  await sleep(600);

  const figures = await page.evaluate(() => window.__hackCableRecord.listFigures());
  console.log(
    "Figures",
    figures.map((f) => ({ name: f.name, ports: f.ports.map((p) => p.name) })),
  );

  const arduino = figures.find((f) => /uno/i.test(f.name));
  const led = figures.find((f) => /^led$/i.test(f.name));
  const resistor = figures.find((f) => /r[eé]sist/i.test(f.name));
  if (!arduino || !led || !resistor) {
    throw new Error("Figures manquantes après drop");
  }

  const pin13 = pickPort(arduino, ["13", "D13", "PB5"]);
  const gnd = pickPort(arduino, ["GND.1", "GND.2", "GND", "GND.3"]);
  const resA = pickPort(resistor, ["1", "A", "left", "pin1"]);
  const resB = pickPort(resistor, ["2", "B", "right", "pin2"]);
  const ledA = pickPort(led, ["A", "1", "anode"]);
  const ledC = pickPort(led, ["C", "2", "cathode", "K"]);

  const toPage = async (port) =>
    page.evaluate(
      ({ x, y }) => window.__hackCableRecord.canvasToPage(x, y),
      { x: port.canvasX, y: port.canvasY },
    );

  // Pin 13 → résistance → LED → GND
  await wireWithVisibleMouse(page, await toPage(pin13), await toPage(resA), {
    fromFigureId: arduino.id,
    fromPort: pin13.name,
    toFigureId: resistor.id,
    toPort: resA.name,
  });
  await wireWithVisibleMouse(page, await toPage(resB), await toPage(ledA), {
    fromFigureId: resistor.id,
    fromPort: resB.name,
    toFigureId: led.id,
    toPort: ledA.name,
  });
  await wireWithVisibleMouse(page, await toPage(ledC), await toPage(gnd), {
    fromFigureId: led.id,
    fromPort: ledC.name,
    toFigureId: arduino.id,
    toPort: gnd.name,
  });

  await page.evaluate(() => window.__hackCableRecord?.clearDanglingConnections?.());

  await clickLocator(page, search, { after: 200, label: "nettoyer recherche" });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.dispatchEvent("input");
  await sleep(400);

  await clickAt(page, vbox.x + 100, vbox.y + 80, { after: 400, label: "fin" });
  await sleep(2000);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error("Vidéo Playwright introuvable");
  }

  const webmOut = path.join(OUT_DIR, "hackcable-demo.webm");
  const mp4Out = path.join(OUT_DIR, "hackcable-demo.mp4");
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

  // Nettoyage frames de debug éventuelles
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^(frame-|hackcable-demo-(end|mid))/.test(f)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }

  console.log("Vidéo enregistrée :");
  console.log(" -", path.relative(ROOT, webmOut));
  if (fs.existsSync(mp4Out)) console.log(" -", path.relative(ROOT, mp4Out));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
