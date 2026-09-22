<!--
  Licence : GPL-3.0-or-later — Copyright (c) 2021, Clément Grennerat
  Fork A-S-T-U-C-E : https://github.com/A-S-T-U-C-E/HackCable
  Sources : src/editor/canvas-context-menu.ts, web/demo-handlers.ts
-->

# Raccourcis clavier

Guide utilisateur pour la démo HackCable (barre d’outils + plan de travail).

Les raccourcis **Alt+…** sont ignorés lorsque le focus est dans un champ de saisie (recherche catalogue, étiquette, etc.).  
Sous macOS, **Alt** correspond à la touche **Option**.

Les mêmes lettres apparaissent à droite des entrées du **menu contextuel** (clic droit sur le plan).

## Fichiers et historique

| Action | Raccourci |
| --- | --- |
| Ouvrir un fichier (`.hackcable` / JSON) | **Alt+O** |
| Sauvegarder le schéma | **Alt+S** |
| Annuler | **Ctrl+Z** (⌘+Z sur macOS) |
| Rétablir | **Ctrl+Y** ou **Ctrl+Shift+Z** (⌘+Y / ⌘+Shift+Z) |

## Plan de travail (toujours disponibles)

| Action | Raccourci |
| --- | --- |
| Zoom à 100 % | **Alt+Z** |
| Ajuster à la fenêtre | **Alt+A** |
| Exporter le plan en SVG | **Alt+V** |

## Composant sélectionné

Sélectionnez un composant (clic), ou utilisez le clic droit dessus.

| Action | Raccourci |
| --- | --- |
| Supprimer le composant | **Alt+K** |
| Mettre au premier plan | **Alt+P** |
| Pivoter de 90° (horaire) | **Alt+R** |
| Pivoter de 90° (antihoraire) | **Alt+T** |

## Fil sélectionné

Sélectionnez un fil, ou utilisez le clic droit dessus.

| Action | Raccourci |
| --- | --- |
| Supprimer la connexion | **Alt+K** |
| Ajouter une étiquette | **Alt+B** |
| Modifier l’étiquette | **Alt+M** |
| Supprimer l’étiquette | **Alt+U** |
| Ajouter un segment (menu contextuel, mode Manhattan interactif) | **Alt+G** |
| Supprimer un segment (idem) | **Alt+X** |

Les actions **segment** n’apparaissent que si le clic droit vise un segment éditable (routeur Manhattan interactif). Avec le menu ouvert, **Alt+G** / **Alt+X** déclenchent l’entrée correspondante.

## Notes

- **Alt+K** et **Alt+V** sont préférés à Alt+D / Alt+E, souvent réservés par le navigateur (barre d’adresse, menu).
- Escape ferme le menu contextuel.
- Molette : scroll vertical ; **Shift+molette** : zoom ; **Alt+molette** : scroll horizontal.
