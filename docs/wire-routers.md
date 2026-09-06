# Algorithmes de tracé des fils

HackCable propose plusieurs **routeurs de connexion** draw2d, sélectionnables dans le panneau **Accessibilité → Tracé des fils**.

Références draw2d :
- [connection_router](https://freegroup.github.io/draw2d/#/examples/connection_router)
- [connection_vertex](https://freegroup.github.io/draw2d/#/examples/connection_vertex) (édition des sommets)

## Édition des fils (par défaut)

Tous les modes permettent d’**éditer les fils** une fois sélectionnés :

| Famille | Interaction |
| --- | --- |
| Manhattan interactif (± ponts) | Poignées de **segments orthogonaux** (`OrthogonalSelectionFeedbackPolicy`) : déplacer un segment, découper / supprimer via le menu contextuel. |
| Autres algorithmes | Poignées de **sommets libres** (`VertexSelectionFeedbackPolicy`) : déplacer un coude, ajouter un sommet (poignée fantôme sur un segment), double-clic pour supprimer. |

Après une édition manuelle, le tracé est **conservé** au déplacement des composants (comportement type VertexRouter). Changer d’algorithme dans Accessibilité recalcule tout et annule le tracé manuel.

## Pourquoi plusieurs options semblent identiques

Plusieurs modes **partagent le même algorithme de base** (Manhattan orthogonal). La différence n’apparaît que dans des cas particuliers :

- croisements de fils ;
- édition manuelle des segments / sommets ;
- obstacles (composants) entre les ports ;
- plusieurs fils entre les mêmes ports.

Avec un seul fil, sans croisement et sans édition, les variantes Manhattan se ressemblent fortement.

## Famille Manhattan

| Option dans l’UI | Identifiant | Tracé | Différence réelle |
| --- | --- | --- | --- |
| Manhattan | `manhattan` | Coudes orthogonaux automatiques | Base. Recalcule tout à chaque déplacement (sauf après édition manuelle des sommets). |
| Manhattan avec ponts | `manhattanBridged` | Idem | Ajoute des **ponts** aux croisements de fils. Sans croisement → identique à Manhattan. |
| Manhattan interactif | `interactiveManhattan` | Idem au départ | Poignées pour **déplacer / découper** les segments ; le tracé manuel est conservé. |
| Manhattan interactif avec ponts | `interactiveManhattanBridged` | Interactif + ponts | Combinaison des deux. **Défaut HackCable.** |
| Circuit | `circuit` | Orthogonal type Manhattan | Ponts aux croisements **sans** port commun, et **points** aux croisements sur un même nœud. |

Donc : un fil, pas de croisement, pas d’édition → ces cinq modes se ressemblent.

## Autres algorithmes

| Option dans l’UI | Identifiant | Comportement | Quand ça change vraiment |
| --- | --- | --- | --- |
| Direct | `direct` | Ligne droite port → port | Toujours différent (pas de coudes). Sommets ajoutables ensuite. |
| Éventail | `fan` | Comme Direct, mais **décale** les fils s’il y en a plusieurs entre les mêmes ports | Un seul fil → identique à Direct. |
| Courbe (spline) | `spline` | Calcule des coudes Manhattan, puis **lisse** en spline | Forme arrondie ; sur un trajet simple, proche d’un Manhattan adouci. |
| Labyrinthe | `maze` | Pathfinding pour **éviter les composants** | Peu ou pas d’obstacles entre ports → trajet proche d’un Manhattan. |
| Croquis | `sketch` | Variante labyrinthe + spline + léger décalage | Aspect plus « dessiné à la main » ; sinon proche du labyrinthe. |

## Pourquoi ça paraît souvent identique dans HackCable

1. Peu de fils → pas de ponts visibles.
2. Peu de composants entre les ports → le labyrinthe ne contourne rien.
3. Sans tirer les poignées → interactif = Manhattan automatique.
4. Un seul fil entre deux ports → éventail = direct.

## Recommandations d’usage

| Besoin | Option conseillée |
| --- | --- |
| Câblage classique éditable (défaut) | Manhattan interactif avec ponts |
| Schéma avec croisements lisibles | Circuit, ou Manhattan avec ponts |
| Lignes droites simples | Direct (ou Éventail si plusieurs fils) |
| Contourner les pièces sur un plan chargé | Labyrinthe ou Croquis |
| Coudes libres type draw2d vertex | N’importe quel mode non interactif + édition des sommets |

## Implémentation

- Préférence : `src/editor/connection-router-preference.ts` (`withVertexEditing` pour les routeurs non interactifs)
- Routeur par défaut (ponts + interactif) : `src/editor/connection-router.ts` (`BridgedInteractiveManhattanRouter`)
- Marquage « tracé manuel » après Move/Add/Remove vertex : `src/editor/draw2d-patches.ts`
- Réglage UI / persistance : panneau accessibilité (`web/a11y-panel.ts`, champ `wireRouter` dans `web/a11y-settings.ts`)
- Paramètre d’URL : `?router=interactiveManhattanBridged` (ou autre identifiant du tableau ci-dessus)
