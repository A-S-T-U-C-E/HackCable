<!--
  Licence : GPL-3.0-or-later — Copyright (c) 2021, Clément Grennerat
  Fork A-S-T-U-C-E : https://github.com/A-S-T-U-C-E/HackCable
-->

# Démo vidéo HackCable

Enregistrements automatisés (Playwright) **avec curseur visible**.

## Fichiers

| Vidéo | Contenu |
| --- | --- |
| [1.decouverte.mp4](./1.decouverte.mp4) | Mise à jour catalogue, recherche, placement Arduino / LED / résistance, câblage |
| [2.survol_de_fonctions.mp4](./2.survol_de_fonctions.mp4) | Menu contextuel : rotation, étiquettes, segments, zoom, export SVG, suppression |

Démo en ligne : [a-s-t-u-c-e.github.io/HackCable](https://a-s-t-u-c-e.github.io/HackCable/).

## Régénérer

Prérequis : `npm run serve:web` (port 9000).

```bash
npm run demo:record      # → scénario découverte (scripts/record-demo.mjs)
npm run demo:record:ctx  # → menu contextuel (scripts/record-demo-context-menu.mjs)
```

Renommer ensuite les fichiers produits (`hackcable-demo*.mp4`) vers `1.decouverte.mp4` / `2.survol_de_fonctions.mp4` si besoin.

## Notes techniques

- Playwright n’enregistre pas le curseur OS → overlay rouge + libellé.
- Le câblage fiable utilise `?record=1` (`window.__hackCableRecord`) pour éviter les fils orphelins draw2d.
