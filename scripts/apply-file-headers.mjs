/**
 * Script : applique les en-têtes GPL développés sur src/ et web/.
 * Usage : node scripts/apply-file-headers.mjs
 *
 * Mettre à jour la carte META ci-dessous quand un fichier source est ajouté.
 */
import fs from "fs";
import path from "path";

/** @type {Record<string, { file: string, duties: string[], notes?: string[], see?: string[] }>} */
const META = {
  "src/main.ts": {
    file: "Point d’entrée bibliothèque HackCable : montage UI, catalogue et éditeur.",
    duties: [
      "Classe `HackCable` (API publique pour intégrateurs)",
      "Injection du template UI, i18n, sync Fritzing",
      "Redimensionnement de la barre latérale catalogue",
    ],
    see: ["docs/architecture.md", "docs/MAINTENANCE.md"],
  },
  "src/jquery-ui-draggable.ts": {
    file: "Imports jQuery UI minimaux requis par draw2d (droppable / draggable).",
    duties: [
      "Charger jQuery + widgets droppable/draggable (Canvas.init draw2d)",
      "Le DnD catalogue reste en HTML5 natif ; le menu contextuel est custom",
    ],
  },
  "src/editor/editor.ts": {
    file: "Éditeur de schéma : sérialisation, zoom, undo/redo, API MCU.",
    duties: [
      "Canvas draw2d (`Canvas`)",
      "Sauvegarde / chargement JSON (`EditorSaveData`)",
      "Délégation de la table des broches MCU à `mcu-pin/McuPinTableStore`",
    ],
  },
  "src/editor/canvas.ts": {
    file: "Canvas draw2d principal : viewport, zoom, overlay HTML et politiques d’édition.",
    duties: [
      "Installer pan / zoom / snap / connexions",
      "Overlay HTML des composants sous le SVG draw2d",
      "Drop catalogue → `ComponentFigure`, grille et monde extensible",
    ],
  },
  "src/editor/canvas-commands.ts": {
    file: "Commandes draw2d (undo/redo) pour l’éditeur HackCable.",
    duties: [
      "Envelopper ajout / suppression / déplacement dans le command stack",
      "Garantir l’annulation cohérente des figures et connexions",
    ],
  },
  "src/editor/canvas-context-menu.ts": {
    file: "Menu contextuel (clic droit) sur le canvas draw2d.",
    duties: [
      "Afficher actions figure / fil / plan (supprimer, label, etc.)",
      "Positionner le menu hors overflow du viewport",
    ],
  },
  "src/editor/canvas-minimap.ts": {
    file: "Minicarte du plan (aperçu, rectangle de vue, navigation clic/glisser).",
    duties: [
      "Projeter le monde canvas dans une surface réduite",
      "Déplacer la vue (pan) et recentrer au clic",
    ],
    see: ["src/editor/minimap-geometry.ts"],
  },
  "src/editor/canvas-panning-policy.ts": {
    file: "Panning du viewport sans interférer avec le tirage de fil depuis un port.",
    duties: [
      "Étendre `PanningSelectionPolicy` draw2d",
      "Ignorer le pan pendant un drag de port / connexion",
    ],
  },
  "src/editor/canvas-scale.ts": {
    file: "Échelle et grille du workspace — µcBlockly (25 px) et Wokwi (3,8 px/mm).",
    duties: [
      "Constantes grille / px-par-mm / taille monde",
      "Mise à l’échelle des vignettes catalogue",
      "Snap des points sur la grille",
    ],
  },
  "src/editor/canvas-toolbar.ts": {
    file: "Barre d’outils de zoom flottante sur le canvas.",
    duties: [
      "Boutons zoom + / − / 100 % / ajuster à la fenêtre",
      "Branchement i18n et accessibilité",
    ],
  },
  "src/editor/canvas-viewport.ts": {
    file: "Utilitaires viewport : scroll, zoom et bornes monde du canvas.",
    duties: [
      "Conversions document ↔ canvas",
      "Scroll horizontal Alt+molette",
      "Helpers de centrage / bornes visibles",
    ],
  },
  "src/editor/canvas-zoom.ts": {
    file: "Zoom du canvas (niveaux, fit-to-content, bornes des figures).",
    duties: [
      "Niveaux de zoom discrets",
      "Fit-to-content et reset",
      "Calcul de l’emprise des figures",
    ],
  },
  "src/editor/component-figure.ts": {
    file: "Figure draw2d pour un composant catalogue (overlay Wokwi ou SVG Fritzing).",
    duties: [
      "Créer ports hybrides et hit-targets",
      "Synchroniser overlay HTML (taille mm→px Wokwi, SVG Fritzing)",
      "Hit-test avec rotation ; export sérialisable",
    ],
  },
  "src/editor/connection-label.ts": {
    file: "Labels éditables sur les connexions (style draw2d connection_custom_labeld).",
    duties: [
      "Ajouter / lire / supprimer le texte au milieu d’un fil",
      "Édition au double-clic",
    ],
    see: ["https://freegroup.github.io/draw2d/#/examples/connection_custom_labeld"],
  },
  "src/editor/connection-router.ts": {
    file: "Routeur Manhattan interactif + ponts aux croisements de fils.",
    duties: [
      "Router les connexions avec sauts (bridges)",
      "Créer une connexion câblée (`createWiringConnection`)",
      "Marquer un tracé comme modifié par l’utilisateur",
    ],
    see: ["docs/wire-routers.md"],
  },
  "src/editor/connection-router-editable.ts": {
    file: "Rend un routeur draw2d « éditable » (poignées de sommets, sticky route).",
    duties: [
      "Policy de sélection des vertex (style connection_vertex)",
      "Conserver le tracé manuel après déplacement des composants",
    ],
    see: ["https://freegroup.github.io/draw2d/#/examples/connection_vertex"],
  },
  "src/editor/connection-router-ids.ts": {
    file: "Identifiants et préférence utilisateur pour les routeurs de fils.",
    duties: [
      "Énumérer les algorithmes exposés dans l’UI accessibilité",
      "Valider / normaliser l’id stocké (localStorage, URL)",
    ],
  },
  "src/editor/connection-router-preference.ts": {
    file: "Factory des routeurs de fils + application sur le canvas.",
    duties: [
      "Instancier le routeur selon la préférence courante",
      "Réappliquer le routeur à toutes les connexions existantes",
    ],
    see: ["docs/wire-routers.md"],
  },
  "src/editor/connections-policies.ts": {
    file: "Politique de création de connexions (tirage depuis un port uniquement).",
    duties: [
      "Installer la ConnectionCreatePolicy draw2d",
      "Restreindre le démarrage de fil aux pastilles hybrides",
    ],
  },
  "src/editor/coordinate-port-locator.ts": {
    file: "Locateurs de ports draw2d et échelle d’affichage des composants Fritzing.",
    duties: [
      "`CoordinatePortLocator` (Wokwi, px absolus)",
      "`PercentPortLocator` (Fritzing, % largeur/hauteur)",
      "Conversion pouces physiques → pixels canvas",
    ],
  },
  "src/editor/draw2d-patches.ts": {
    file: "Correctifs draw2d (bugs command stack / vertices).",
    duties: [
      "Patcher le command stack pour les CommandMoveVertex invalides",
      "Éviter les plantages undo/redo sur sommets de fils",
    ],
  },
  "src/editor/minimap-geometry.ts": {
    file: "Géométrie de projection monde ↔ minicarte.",
    duties: [
      "Calculer matrices / rectangles de projection",
      "Hit-test du rectangle de viewport sur la minicarte",
    ],
  },
  "src/editor/port-connection-direction.ts": {
    file: "Direction de sortie des fils depuis une pastille (bord le plus proche).",
    duties: [
      "Corriger le bug draw2d UP/DOWN pour un point intérieur au bbox",
      "Tourner la direction avec l’angle du composant",
      "Vérifier l’alignement du premier segment de fil",
    ],
  },
  "src/editor/workspace-export.ts": {
    file: "Export d’une capture PNG du plan, recadrée sur le contenu.",
    duties: [
      "Rendre le canvas (SVG + overlays) en image",
      "Recadrer sur l’emprise des figures (style io_png_crop)",
    ],
    see: [
      "https://freegroup.github.io/draw2d/#/examples/io_png_crop",
      "https://freegroup.github.io/draw2d/#/examples/io_svg_basic",
    ],
  },
  "src/editor/mcu-pin/index.ts": {
    file: "Point d’entrée du module « table des broches MCU ».",
    duties: [
      "Ré-exporter types et fonctions publics",
      "Documenter l’organisation du dossier pour un néophyte",
    ],
    notes: [
      "`types.ts` → formes de données publiques",
      "`list-pins.ts` → quelles broches existent sur une carte",
      "`port-connections.ts` → quels fils sont branchés",
      "`build-table.ts` → assemblage snapshot",
      "`query.ts` → recherches dans un snapshot",
      "`watch.ts` → cache + événements canvas",
    ],
    see: ["docs/mcu-pin-api.md"],
  },
  "src/editor/mcu-pin/types.ts": {
    file: "Types publics de la table des broches MCU.",
    duties: [
      "Définir les structures stables pour intégrateurs (µcBlockly, etc.)",
      "Documenter source Wokwi vs Fritzing",
    ],
    see: ["docs/mcu-pin-api.md"],
  },
  "src/editor/mcu-pin/list-pins.ts": {
    file: "Liste les broches d’un composant catalogue (Fritzing / Wokwi / ports live).",
    duties: [
      "Priorité : métadonnées Fritzing → pinInfo Wokwi → ports de la figure",
      "Instancier brièvement un élément Wokwi pour lire `pinInfo`",
    ],
  },
  "src/editor/mcu-pin/port-connections.ts": {
    file: "Lit les fils branchés sur un port draw2d (extrémité opposée = peer).",
    duties: [
      "Parcourir les connexions source/target d’un port",
      "Dédupliquer les peers et résoudre le libellé opposé",
    ],
  },
  "src/editor/mcu-pin/build-table.ts": {
    file: "Construit la table live « broches MCU × connexions ».",
    duties: [
      "Assembler un snapshot pour une figure carte",
      "Associer chaque broche à ses peers câblés",
    ],
  },
  "src/editor/mcu-pin/query.ts": {
    file: "Requêtes simples sur une table MCU déjà construite.",
    duties: [
      "Indexer / chercher une broche par id",
      "Savoir si une broche est connectée",
    ],
  },
  "src/editor/mcu-pin/watch.ts": {
    file: "Cache + abonnements pour la table des broches MCU.",
    duties: [
      "`McuPinTableStore` : invalidation sur add/remove/connect",
      "Notifier les listeners (µcBlockly, UI debug, etc.)",
    ],
  },
  "src/panels/catalog.ts": {
    file: "Panneau catalogue : navigation par catégories (flyout type µcBlockly) et liste.",
    duties: [
      "Nav catégories + recherche + repli automatique",
      "Monter les vignettes (Wokwi / Fritzing) et le DnD vers le canvas",
      "Rebuild progressif (boot par lots)",
    ],
  },
  "src/panels/catalog-boot.ts": {
    file: "Progression du chargement catalogue (boot / rebuild par lots).",
    duties: [
      "Découper le montage pour laisser le navigateur peindre",
      "Callback de progression (`CatalogBootProgress`)",
    ],
  },
  "src/panels/catalog-dedupe.ts": {
    file: "Dédoublonnage catalogue : masque les pièces Fritzing déjà couvertes par Wokwi.",
    duties: [
      "Normaliser titres / moduleId pour rapprochement",
      "Préférer Wokwi lorsqu’un équivalent Fritzing existe",
    ],
  },
  "src/panels/component.ts": {
    file: "Catalogue de composants Wokwi et Fritzing (types, registre, éléments UI).",
    duties: [
      "Registre Wokwi (ids, classes Lit, i18n)",
      "Fusion + dédoublonnage avec le cache Fritzing",
      "`ComponentElement` : vignette catalogue dimensionnée",
    ],
  },
  "src/panels/fritzing-types.ts": {
    file: "Types et constantes du catalogue Fritzing (broches, sync, stockage).",
    duties: [
      "Modèle `FritzingComponentInfo` / store localStorage",
      "Versions d’algo (pins, catégories, URLs SVG)",
    ],
  },
  "src/panels/fritzing-categories.ts": {
    file: "Taxonomie Fritzing : catégories, parsing core.fzb et résolution.",
    duties: [
      "Liste ordonnée des catégories breadboard",
      "Maps module/famille/fichier → catégorie",
      "Heuristiques de repli (titre, tags, chemin FZP)",
    ],
  },
  "src/panels/fritzing-catalog-storage.ts": {
    file: "Persistance locale du catalogue Fritzing (localStorage + migration).",
    duties: [
      "Charger / sauver le store JSON",
      "Migrer catégories et URLs SVG si algo obsolète",
    ],
  },
  "src/panels/fritzing-fzp-parser.ts": {
    file: "Parsing des fichiers FZP Fritzing et extraction des connecteurs / broches.",
    duties: [
      "Lire titre, famille, image breadboard, connecteurs",
      "Produire une `FritzingComponentInfo` (sans id numérique)",
    ],
  },
  "src/panels/fritzing-github.ts": {
    file: "Accès HTTP au dépôt GitHub fritzing-parts (index, FZP, SVG).",
    duties: [
      "SHA du dépôt, arbre core/, téléchargement concurrent",
      "Résolution d’URL breadboard (candidats svg/)",
    ],
  },
  "src/panels/fritzing-svg.ts": {
    file: "Géométrie SVG Fritzing : viewBox, dimensions physiques et extraction des broches.",
    duties: [
      "Convertir unités SVG → pouces (logique fritzing-app)",
      "Positions de broches en % pour `PercentPortLocator`",
    ],
  },
  "src/panels/fritzing-sync.ts": {
    file: "Synchronisation du catalogue Fritzing depuis GitHub (orchestration).",
    duties: [
      "Comparer SHA / FZP et intégrer les pièces nouvelles ou modifiées",
      "Reporter la progression (index / integrate)",
    ],
  },
  "src/ui/i18n/i18n-loader.ts": {
    file: "Initialisation i18next pour HackCable (fr / en / es / ar).",
    duties: [
      "Charger les JSON `common`",
      "Exposer `initHackCableI18n`",
    ],
  },
  "src/ui/i18n/languages.ts": {
    file: "Codes de langue HackCable et helpers document (lang / dir).",
    duties: [
      "Normaliser une valeur URL / navigateur",
      "Appliquer `lang` et `dir` sur `<html>` (RTL arabe)",
    ],
  },
  "src/ui/i18n/translate.ts": {
    file: "Helper i18n : traduction courte depuis le namespace `common`.",
    duties: ["Wrapper `i18next.t` → `tr(key)`"],
  },
  "src/utils/dom.ts": {
    file: "Utilitaires DOM (styles inline, conversion d’unités SVG).",
    duties: [
      "`css()` pour styles numériques en px",
      "`unitToPx` / `measureWokwiSvgSize` (mm Wokwi → px canvas)",
    ],
  },
  "src/types/draw2d.d.ts": {
    file: "Déclarations de types ambient pour draw2d (sous-ensemble utilisé par HackCable).",
    duties: [
      "Typer Canvas, Figure, Port, Connection, policies",
      "Éviter d’importer tout le typings amont",
    ],
  },
  "src/types/types.d.ts": {
    file: "Types ambient webpack / require (html, assets).",
    duties: ["Autoriser `require` de templates et ressources dans le bundle"],
  },
  "src/ui/css.styl": {
    file: "Feuille de styles principale de la bibliothèque HackCable (catalogue, canvas, overlays).",
    duties: [
      "Layout barre latérale / flyout catalogue",
      "Canvas, minicarte, zoom, overlays Wokwi/Fritzing",
      "Menu contextuel",
    ],
  },
  "web/index.ts": {
    file: "Boot de la démo web (HMR webpack) et montage de `HackCable`.",
    duties: [
      "Charger i18n puis démarrer `app.ts`",
      "Recharger à chaud en développement",
    ],
  },
  "web/app.ts": {
    file: "Orchestration de la démo web HackCable (toolbar, panneaux, cycle de vie).",
    duties: [
      "Créer l’instance `HackCable`",
      "Brancher sauvegarde, sync catalogue, accessibilité, à propos",
      "Appliquer les options URL",
    ],
  },
  "web/about-panel.ts": {
    file: "Dialogue « À propos » (style µcBlockly) : projet, icônes, crédits Fritzing.",
    duties: [
      "Construire le `<dialog>` et les rangées logo + texte",
      "Liens fork / upstream / Fritzing / Wokwi",
    ],
  },
  "web/a11y-panel.ts": {
    file: "Panneau d’options d’accessibilité (style µcBlockly).",
    duties: [
      "UI labels / police / interligne / focus / accent / routeur",
      "Persister via `a11y-settings`",
    ],
  },
  "web/a11y-settings.ts": {
    file: "Options d’accessibilité (labels, police, interligne, focus, couleur UI, routeur).",
    duties: [
      "Lire / écrire localStorage",
      "Appliquer les classes CSS et préférences routeur",
    ],
  },
  "web/boot-progress.ts": {
    file: "Overlay de progression au démarrage (chargement catalogue par lots).",
    duties: [
      "Afficher phases boot (éléments / montage / prêt)",
      "Masquer l’overlay une fois le catalogue prêt",
    ],
  },
  "web/demo-handlers.ts": {
    file: "Branchements UI de la démo web (catalogue, fichiers, langue, undo/redo, URL).",
    duties: [
      "Handlers boutons toolbar",
      "Sync URL ↔ état (langue, minimap, labels, etc.)",
    ],
  },
  "web/demo-utils.ts": {
    file: "Utilitaires partagés de la démo web (fichiers JSON, i18n barre latérale).",
    duties: [
      "Téléchargement / lecture de fichiers schéma",
      "Rafraîchir libellés i18n de la toolbar",
    ],
  },
  "web/load-merge-dialog.ts": {
    file: "Dialogue de fusion à l’ouverture d’un fichier (remplacer / ajouter / annuler).",
    duties: [
      "Demander le mode `EditorLoadMode`",
      "Accessibilité dialog / focus",
    ],
  },
  "web/url-options.ts": {
    file: "Options démo déclenchables par l’URL (?lang=fr&minimap&labels=icons&…).",
    duties: [
      "Parser les query params",
      "Appliquer langue, minimap, a11y, routeur au démarrage",
    ],
  },
  "web/css/main.styl": {
    file: "Styles de la page démo (toolbar, dialogue à propos, accessibilité, boot).",
    duties: [
      "Chrome autour de la bibliothèque HackCable",
      "Thème boutons, dialogs, overlay de boot",
    ],
  },
};

function makeHeader(meta) {
  const out = ["/**"];
  out.push(" * @license GPL-3.0-or-later");
  out.push(" * Copyright (c) 2021, Clément Grennerat");
  out.push(" * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable");
  out.push(" *");
  out.push(` * @file ${meta.file}`);
  out.push(" *");
  out.push(" * Responsabilités :");
  for (const d of meta.duties) out.push(` * - ${d}`);
  if (meta.notes?.length) {
    out.push(" *");
    out.push(" * Organisation :");
    for (const n of meta.notes) out.push(` * - ${n}`);
  }
  if (meta.see?.length) {
    out.push(" *");
    for (const s of meta.see) out.push(` * @see ${s}`);
  }
  out.push(" */");
  return out.join("\n") + "\n";
}

function stripExistingHeader(text) {
  const m = text.match(/^(\uFEFF)?\s*\/\*[\s\S]*?\*\/\s*/);
  if (m) return text.slice(m[0].length);
  return text.replace(/^\uFEFF/, "");
}

function applyOne(relPath) {
  const meta = META[relPath.replace(/\\/g, "/")];
  if (!meta) {
    console.warn("NO META", relPath);
    return false;
  }
  const abs = path.resolve(relPath);
  const raw = fs.readFileSync(abs, "utf8");
  const body = stripExistingHeader(raw);
  const header = makeHeader(meta);
  fs.writeFileSync(abs, header + body.replace(/^\r?\n*/, ""));
  return true;
}

const targets = Object.keys(META);
let ok = 0;
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.warn("MISSING FILE", t);
    continue;
  }
  if (applyOne(t)) ok += 1;
}
console.log(`Updated ${ok}/${targets.length} files`);
