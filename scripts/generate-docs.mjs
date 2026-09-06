/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Génère la documentation API Markdown/HTML à partir des JSDoc TypeScript.
 *
 * Responsabilités :
 * - Parcourir `src/` (fichiers `.ts`)
 * - Extraire fonctions / classes / méthodes exportées + JSDoc (@param, @returns)
 * - Écrire `docs/api/` (Markdown + index HTML)
 *
 * Compatible TypeScript 7+ (pas d’API compilateur classique).
 * Usage : npm run docs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "docs", "api");

const EMPTY_DOC = { summary: "", params: /** @type {{ name: string, text: string }[]} */ ([]), returns: "" };

/**
 * @typedef {{ kind: string, name: string, signature: string, summary: string, params: {name:string,text:string}[], returns: string }} DocEntry
 */

/**
 * Liste récursive des fichiers `.ts` sous un dossier.
 * @param {string} dir
 * @returns {string[]}
 */
function listTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "types") continue;
      out.push(...listTsFiles(full));
    } else if (name.isFile() && name.name.endsWith(".ts") && !name.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Chemin module relatif à `src/`.
 * @param {string} fileName
 * @returns {string}
 */
function moduleId(fileName) {
  return path
    .relative(SRC, fileName)
    .replace(/\\/g, "/")
    .replace(/\.tsx?$/, "");
}

/**
 * Parse un bloc JSDoc en résumé / params / returns.
 * @param {string} block
 * @returns {{ summary: string, params: { name: string, text: string }[], returns: string }}
 */
function parseJsDocBlock(block) {
  const body = block
    .replace(/^\/\*\*?/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim();

  /** @type {string[]} */
  const summaryLines = [];
  /** @type {{ name: string, text: string }[]} */
  const params = [];
  let returns = "";

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    const param = line.match(
      /^@param\s+(?:\{[^}]*\}\s+)?(?:\[)?([^\s\]=]+)(?:\])?(?:\s+[-=]?\s*)?(.*)$/,
    );
    if (param) {
      params.push({ name: param[1], text: (param[2] || "").trim() });
      continue;
    }
    const ret = line.match(/^@returns?\s+(?:\{[^}]*\}\s+)?(.*)$/);
    if (ret) {
      returns = (ret[1] || "").trim();
      continue;
    }
    if (
      /^@(license|file|see|example|deprecated|throws|template|typedef|type)\b/.test(line)
    ) {
      continue;
    }
    if (line.startsWith("@")) continue;
    summaryLines.push(line);
  }

  return {
    summary: summaryLines.join("\n").trim(),
    params,
    returns,
  };
}

/**
 * Extrait le JSDoc immédiatement avant `index` dans `source`.
 * @param {string} source
 * @param {number} index
 * @returns {{ summary: string, params: { name: string, text: string }[], returns: string }}
 */
function jsDocBefore(source, index) {
  const before = source.slice(0, index).trimEnd();
  if (!before.endsWith("*/")) return { ...EMPTY_DOC, params: [] };

  const start = before.lastIndexOf("/**");
  if (start < 0) return { ...EMPTY_DOC, params: [] };

  const block = before.slice(start);
  // Un seul bloc : pas de `*/` interne avant la fin.
  const close = block.indexOf("*/");
  if (close !== block.length - 2) return { ...EMPTY_DOC, params: [] };

  return parseJsDocBlock(block);
}

/**
 * Signature affichable à partir de la ligne de déclaration.
 * @param {string} decl
 * @returns {string}
 */
function cleanSignature(decl) {
  return decl
    .replace(/\s+/g, " ")
    .replace(/\s*\{[\s\S]*$/, "")
    .replace(/;\s*$/, "")
    .trim();
}

/**
 * Extrait le contenu entre `{` à `openIndex` et l’accolade fermante correspondante.
 * @param {string} source
 * @param {number} openIndex
 * @returns {string | null}
 */
function extractBalanced(source, openIndex) {
  if (source[openIndex] !== "{") return null;
  let depth = 0;
  let inStr = /** @type {string | null} */ (null);
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

/**
 * Collecte les méthodes / constructeurs au premier niveau d’un corps de classe.
 * @param {string} classBody
 * @param {string} className
 * @param {string} source
 * @param {number} bodyAbsStart index du 1er caractère du corps dans `source`
 * @returns {DocEntry[]}
 */
function collectClassMembers(classBody, className, source, bodyAbsStart) {
  /** @type {DocEntry[]} */
  const entries = [];
  let depth = 0;
  let inStr = /** @type {string | null} */ (null);
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < classBody.length; i++) {
    const ch = classBody[i];
    const next = classBody[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      continue;
    }

    if (depth !== 0) continue;

    // Déclarations au niveau classe uniquement.
    const slice = classBody.slice(i);
    const method = slice.match(
      /^(?:(?:public|protected|private|static|async|override|readonly|abstract)\s+)*(?:async\s+)?(constructor|\w+)\s*\(/,
    );
    if (!method) continue;
    if (method[0].includes(":") && /^\w+\s*:/.test(slice)) continue;

    const methodName = method[1];
    if (
      methodName === "if" ||
      methodName === "for" ||
      methodName === "while" ||
      methodName === "switch" ||
      methodName === "catch" ||
      methodName === "function"
    ) {
      continue;
    }

    // Ignorer champs du type `foo = (` / getters déjà couverts.
    const lineStart = classBody.lastIndexOf("\n", i - 1) + 1;
    const prefix = classBody.slice(lineStart, i);
    if (/[=;]/.test(prefix)) continue;

    const absIndex = bodyAbsStart + i;
    const doc = jsDocBefore(source, absIndex);

    const paramsStart = i + method[0].length - 1; // sur '('
    const paramsEnd = findMatchingParen(classBody, paramsStart);
    if (paramsEnd < 0) continue;
    const paramsSig = classBody
      .slice(paramsStart + 1, paramsEnd)
      .replace(/\s+/g, " ")
      .trim();

    let ret = "";
    const after = classBody.slice(paramsEnd + 1).match(/^\s*:\s*([^{;]+)/);
    if (after) ret = `: ${after[1].trim()}`;

    if (methodName === "constructor") {
      entries.push({
        kind: "constructor",
        name: `${className}.constructor`,
        signature: `new ${className}(${paramsSig})`,
        ...doc,
      });
    } else {
      const isStatic = /\bstatic\b/.test(method[0]);
      entries.push({
        kind: "method",
        name: `${className}.${methodName}`,
        signature: `${isStatic ? "static " : ""}${className}.${methodName}(${paramsSig})${ret}`,
        ...doc,
      });
    }

    i = paramsEnd;
  }

  return entries;
}

/**
 * Trouve l’index de la `)` appariée à `(` à `openIndex`.
 * @param {string} text
 * @param {number} openIndex
 * @returns {number}
 */
function findMatchingParen(text, openIndex) {
  if (text[openIndex] !== "(") return -1;
  let depth = 0;
  let inStr = /** @type {string | null} */ (null);
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Collecte les exports documentables d’un fichier source.
 * @param {string} source
 * @returns {DocEntry[]}
 */
function collectExports(source) {
  /** @type {DocEntry[]} */
  const entries = [];

  const exportFn =
    /(?:^|\n)((?:export\s+(?:async\s+)?function\s+(\w+)\s*\([^;{]*\)(?:\s*:\s*[^;{]+)?))/g;
  let m;
  while ((m = exportFn.exec(source)) !== null) {
    const name = m[2];
    const signature = cleanSignature(m[1].replace(/^export\s+/, ""));
    const start = m.index + (m[0].startsWith("\n") ? 1 : 0);
    const doc = jsDocBefore(source, start);
    entries.push({ kind: "function", name, signature, ...doc });
  }

  const exportConstFn =
    /(?:^|\n)((?:export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=>))/g;
  while ((m = exportConstFn.exec(source)) !== null) {
    const name = m[2];
    const start = m.index + (m[0].startsWith("\n") ? 1 : 0);
    const doc = jsDocBefore(source, start);
    entries.push({ kind: "function", name, signature: `${name}(…)`, ...doc });
  }

  const exportClass = /(?:^|\n)((?:export\s+(?:abstract\s+)?class\s+(\w+)[^{]*))/g;
  while ((m = exportClass.exec(source)) !== null) {
    const className = m[2];
    const classStart = m.index + (m[0].startsWith("\n") ? 1 : 0);
    const doc = jsDocBefore(source, classStart);
    entries.push({
      kind: "class",
      name: className,
      signature: cleanSignature(m[1].replace(/^export\s+/, "")),
      ...doc,
    });

    const braceOpen = source.indexOf("{", classStart);
    if (braceOpen < 0) continue;
    const classBody = extractBalanced(source, braceOpen);
    if (!classBody) continue;
    entries.push(...collectClassMembers(classBody, className, source, braceOpen + 1));
  }

  return entries;
}

/**
 * Écrit un fichier Markdown pour un module.
 * @param {string} id
 * @param {DocEntry[]} entries
 * @returns {string}
 */
function renderModuleMarkdown(id, entries) {
  const lines = [
    `<!--`,
    `  Licence : GPL-3.0-or-later — Copyright (c) 2021, Clément Grennerat`,
    `  Fork A-S-T-U-C-E : https://github.com/A-S-T-U-C-E/HackCable`,
    `  Généré par : npm run docs`,
    `-->`,
    ``,
    `# \`${id}\``,
    ``,
  ];

  if (entries.length === 0) {
    lines.push("_Aucun symbole exporté documenté._", "");
    return lines.join("\n");
  }

  for (const entry of entries) {
    const label =
      entry.kind === "class"
        ? "Classe"
        : entry.kind === "method"
          ? "Méthode"
          : entry.kind === "constructor"
            ? "Constructeur"
            : "Fonction";
    lines.push(`## ${label} \`${entry.name}\``);
    lines.push("");
    if (entry.summary) {
      lines.push(entry.summary);
      lines.push("");
    }
    lines.push("```ts");
    lines.push(entry.signature);
    lines.push("```");
    lines.push("");
    if (entry.params.length) {
      lines.push("**Paramètres**");
      lines.push("");
      for (const p of entry.params) {
        lines.push(`- \`${p.name}\` — ${p.text || "_non documenté_"}`);
      }
      lines.push("");
    }
    if (entry.returns) {
      lines.push(`**Retour** — ${entry.returns}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Index HTML listant les modules.
 * @param {{ id: string, count: number }[]} modules
 * @returns {string}
 */
function renderIndexHtml(modules) {
  const items = modules
    .map(
      (m) =>
        `<li><a href="./${m.id}.md"><code>${m.id}</code></a> <span class="count">${m.count} symbole(s)</span></li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>HackCable — Documentation API</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #1a1d24; }
    body { max-width: 52rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.6rem; }
    .meta { color: #556; font-size: 0.95rem; }
    ul { padding-left: 1.2rem; }
    li { margin: 0.35rem 0; }
    .count { color: #778; font-size: 0.85rem; }
    code { background: #f2f4f8; padding: 0.1rem 0.35rem; border-radius: 4px; }
    a { color: #2c70ff; }
  </style>
</head>
<body>
  <h1>HackCable — Documentation API</h1>
  <p class="meta">Licence <strong>GPL-3.0-or-later</strong> · générée par <code>npm run docs</code> · ${new Date().toISOString().slice(0, 10)}</p>
  <p>Documentation extraite des JSDoc TypeScript (<code>@param</code>, <code>@returns</code>).</p>
  <ul>
${items}
  </ul>
  <p class="meta">Voir aussi <a href="../MAINTENANCE.md">MAINTENANCE.md</a>, <a href="../architecture.md">architecture.md</a>.</p>
</body>
</html>
`;
}

/**
 * Point d’entrée.
 * @returns {void}
 */
function main() {
  const files = listTsFiles(SRC);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  /** @type {{ id: string, count: number }[]} */
  const modules = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const id = moduleId(file);
    const entries = collectExports(source);
    const md = renderModuleMarkdown(id, entries);
    const outFile = path.join(OUT, `${id}.md`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, md, "utf8");
    modules.push({ id, count: entries.length });
  }

  modules.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(OUT, "index.html"), renderIndexHtml(modules), "utf8");
  fs.writeFileSync(
    path.join(OUT, "README.md"),
    `# Documentation API HackCable\n\nLicence **GPL-3.0-or-later**.\n\nGénérée par \`npm run docs\`.\n\nOuvrir [index.html](./index.html).\n`,
    "utf8",
  );

  const withDocs = modules.filter((m) => m.count > 0).length;
  console.log(
    `Documentation générée : ${modules.length} modules (${withDocs} avec symboles) → ${path.relative(ROOT, OUT)}/`,
  );
}

main();
