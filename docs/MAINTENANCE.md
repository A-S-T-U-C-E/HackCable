# Guide de maintenance (néophyte)

Licence du projet : **GPL-3.0-or-later** (`LICENSE`).  
En-tête recommandé en tête de chaque fichier source (bibliothèque `src/` et démo `web/`) :

```ts
/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Une phrase qui dit à quoi sert ce fichier.
 *
 * Responsabilités :
 * - Point fort n°1 (API, module ou comportement)
 * - Point fort n°2
 * - Point fort n°3
 *
 * Organisation :   // optionnel — quand le fichier oriente vers d’autres modules
 * - `autre.ts` → rôle
 *
 * @see docs/….md   // optionnel — doc ou exemple amont
 */
```

Le script `scripts/apply-file-headers.mjs` régénère ces en-têtes à partir d’une carte fichier → méta (à mettre à jour si vous ajoutez un fichier).

## Documentation API

```bash
npm run docs
# ou en surveillance :
npm run docs:watch
```

Génère la référence dans `docs/api/` (Markdown par module + `index.html`), à partir des JSDoc `@param` / `@returns`.
Le dossier `docs/api/` est ignoré par git (régénérable).

## Où chercher quoi

| Besoin | Dossier / fichier |
| --- | --- |
| Monter l’app / API publique | `src/main.ts` → classe `HackCable` |
| Canvas + zoom + sauvegarde | `src/editor/editor.ts`, `src/editor/canvas.ts` |
| Composant sur le plan | `src/editor/component-figure.ts` |
| Broches MCU connectées ? | `src/editor/mcu-pin/` + [mcu-pin-api.md](mcu-pin-api.md) |
| Tracé des fils | `src/editor/connection-router*.ts` + [wire-routers.md](wire-routers.md) |
| Catalogue Wokwi / Fritzing | `src/panels/` |
| Page démo | `web/` |
| Traductions | `src/ui/i18n/*.json` |

## Règles simples

1. **Un fichier = un rôle.** Si un fichier dépasse ~300 lignes ou mélange 2 sujets, découper.
2. **JSDoc extractible** sur toute fonction / méthode publique (et helpers non triviaux) :

```ts
/**
 * Ajoute ou remplace un paramètre de requête dans une URL.
 * @param url - Chaîne URL d’entrée.
 * @param param - Nom du paramètre.
 * @param value - Valeur du paramètre.
 * @returns URL mise à jour avec le paramètre appliqué.
 */
export const addReplaceParamToUrl = (url: string, param: string, value: string): string => {
```

   - Une phrase de résumé (impératif ou descriptif, cohérent dans le fichier).
   - `@param nom - description` pour chaque argument (y compris optionnels).
   - `@returns description` si la fonction renvoie une valeur (sinon omettre, ou `@returns void` seulement si utile).
3. **Ne pas committer** de secrets (`.env`, tokens).
4. **Type-check** avant de pousser : `npm run type-check`.
5. **Démo locale** : `npm run serve:web`.

## Module `mcu-pin` (exemple de modularité)

```
src/editor/mcu-pin/
  index.ts              ← réexporte tout (importer depuis ici)
  types.ts              ← formes de données
  list-pins.ts          ← quelles broches existent
  port-connections.ts   ← quels fils sont branchés
  build-table.ts        ← snapshot
  query.ts              ← recherches
  watch.ts              ← cache + événements canvas
```

L’`Editor` ne fait que déléguer à `McuPinTableStore` : plus facile à lire et à tester.

## Module routeurs de fils

```
connection-router-ids.ts       ← ids + préférence utilisateur
connection-router-editable.ts  ← poignées de sommets (VertexSelection)
connection-router-preference.ts← factory createWireRouterInstance
connection-router.ts           ← Manhattan interactif + ponts (défaut)
```

## Documentation à jour

- [Architecture](architecture.md)
- [API broches MCU](mcu-pin-api.md)
- [Routeurs de fils](wire-routers.md)
