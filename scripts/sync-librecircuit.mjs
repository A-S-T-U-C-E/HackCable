/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Synchronise la dépendance locale LibreCircuit (install + build + re-link npm).
 *
 * Usage :
 *   npm run sync:librecircuit
 *   node scripts/sync-librecircuit.mjs
 *   LIBRECIRCUIT_PATH=D:/autre/LibreCircuit npm run sync:librecircuit
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hackCableRoot = path.resolve(__dirname, "..");

/**
 * Chemin du dépôt LibreCircuit :
 * 1. LIBRECIRCUIT_PATH
 * 2. dépendance `file:…` dans package.json
 * 3. voisin `../LibreCircuit`
 */
function resolveLibreCircuitRoot() {
    if (process.env.LIBRECIRCUIT_PATH) {
        return path.resolve(process.env.LIBRECIRCUIT_PATH);
    }

    const pkgPath = path.join(hackCableRoot, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const dep = pkg.dependencies?.librecircuit ?? pkg.devDependencies?.librecircuit;
    if (typeof dep === "string" && dep.startsWith("file:")) {
        return path.resolve(hackCableRoot, dep.slice("file:".length));
    }

    return path.resolve(hackCableRoot, "..", "LibreCircuit");
}

function runCommand(command, args, cwd, label, useShell = false) {
    console.log(`\n→ ${label}\n  ${command} ${args.join(" ")}\n  cwd: ${cwd}`);
    try {
        execFileSync(command, args, {
            cwd,
            stdio: "inherit",
            env: process.env,
            windowsHide: true,
            shell: useShell,
        });
    } catch {
        throw new Error(`${label} a échoué.`);
    }
}

function runNpm(args, cwd, label) {
    // Sur Windows, `npm` passe par le shell ; les args sont déjà contrôlés (pas d’entrée utilisateur).
    runCommand("npm", args, cwd, label, process.platform === "win32");
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensurePackageJsonPointsTo(lcRoot) {
    const pkgPath = path.join(hackCableRoot, "package.json");
    const pkg = readJson(pkgPath);
    const rel = path.relative(hackCableRoot, lcRoot).split(path.sep).join("/");
    const fileSpec = rel.startsWith(".") ? `file:${rel}` : `file:./${rel}`;
    const current = pkg.dependencies?.librecircuit;
    if (current !== fileSpec) {
        pkg.dependencies = pkg.dependencies ?? {};
        pkg.dependencies.librecircuit = fileSpec;
        fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
        console.log(`package.json : librecircuit → ${fileSpec}`);
    }
}

function main() {
    const lcRoot = resolveLibreCircuitRoot();
    const lcPkgPath = path.join(lcRoot, "package.json");

    if (!fs.existsSync(lcPkgPath)) {
        console.error(
            `LibreCircuit introuvable : ${lcRoot}\n` +
                `Place le dépôt à côté de HackCable, ou définis LIBRECIRCUIT_PATH, ` +
                `ou une dépendance "librecircuit": "file:…" dans package.json.`,
        );
        process.exit(1);
    }

    const lcPkg = readJson(lcPkgPath);
    if (lcPkg.name !== "librecircuit") {
        console.error(
            `Le package.json en ${lcRoot} s’appelle "${lcPkg.name}" (attendu : librecircuit).`,
        );
        process.exit(1);
    }

    console.log("Synchronisation LibreCircuit → HackCable");
    console.log(`  LibreCircuit : ${lcRoot} (v${lcPkg.version})`);
    console.log(`  HackCable    : ${hackCableRoot}`);

    ensurePackageJsonPointsTo(lcRoot);

    const needsInstall =
        !fs.existsSync(path.join(lcRoot, "node_modules")) ||
        !fs.existsSync(path.join(lcRoot, "node_modules", "typescript"));

    if (needsInstall) {
        runNpm(["install"], lcRoot, "npm install (LibreCircuit)");
    }

    // tsc local (évite les soucis spawn npm.cmd sur Windows)
    const tscJs = path.join(lcRoot, "node_modules", "typescript", "bin", "tsc");
    if (fs.existsSync(tscJs)) {
        runCommand(process.execPath, [tscJs, "-p", lcRoot], lcRoot, "build LibreCircuit (tsc)");
    } else {
        runNpm(["run", "build"], lcRoot, "build LibreCircuit");
    }

    const distIndex = path.join(lcRoot, "dist", "index.js");
    if (!fs.existsSync(distIndex)) {
        console.error(`Build LibreCircuit incomplet : ${distIndex} manquant.`);
        process.exit(1);
    }

    runNpm(["install", "librecircuit"], hackCableRoot, "re-lier librecircuit dans HackCable");

    const linkedDir = path.join(hackCableRoot, "node_modules", "librecircuit");
    const linkedPkgPath = path.join(linkedDir, "package.json");
    if (!fs.existsSync(linkedPkgPath)) {
        console.error("Échec : node_modules/librecircuit absent après install.");
        process.exit(1);
    }
    const linkedPkg = readJson(linkedPkgPath);
    console.log(`\nOK — HackCable utilise librecircuit@${linkedPkg.version}`);
    console.log(`    → ${fs.realpathSync(linkedDir)}`);
}

try {
    main();
} catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
}
