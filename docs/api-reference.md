<!--
  Licence : AGPL-3.0-or-later — Copyright (c) 2021, Clément Grennerat
  Fork A-S-T-U-C-E : https://github.com/A-S-T-U-C-E/HackCable
-->

# Référence API générée

La référence HTML/Markdown des modules `src/` **n’est pas versionnée** dans git (dossier `docs/api/`, régénérable).

## Générer

```bash
npm run docs
# ou en surveillance :
npm run docs:watch
```

Sortie :

- `docs/api/index.html` — index navigable  
- `docs/api/*.md` — une page Markdown par module  
- `docs/api/README.md` — rappel local  

Ouvrir ensuite [api/index.html](./api/index.html) dans le navigateur (après génération).

## Contenu

Extraction JSDoc (`@param`, `@returns`, résumé) des exports TypeScript sous `src/` via `scripts/generate-docs.mjs`.

Voir aussi :

- [API table des broches MCU](mcu-pin-api.md) (doc manuelle, versionnée)
- [Guide de maintenance](MAINTENANCE.md)
