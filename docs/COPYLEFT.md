<!--
  Licence : AGPL-3.0-or-later — Copyright (c) 2021, Clément Grennerat
  Fork A-S-T-U-C-E : https://github.com/A-S-T-U-C-E/HackCable
-->

# Copyleft HackCable (AGPL-3.0-or-later)

HackCable est publié sous **GNU Affero General Public License v3 ou ultérieure**.

## Pourquoi AGPL (et plus seulement GPL) ?

La GPL v3 oblige à partager le source lors d’une **distribution** (binaire, paquet, dépôt).  
Elle ne couvre pas clairement le cas d’un **service réseau** (site web, IDE en ligne) qui exécute une version modifiée sans redistribuer de fichier.

L’**AGPL §13** comble ce trou : si des utilisateurs interagissent avec votre version modifiée via un réseau, vous devez leur offrir le **Corresponding Source** de cette version.

## Obligations pratiques

| Situation | À faire |
| --- | --- |
| Fork / redistribution du dépôt | Garder `LICENSE`, `NOTICE`, en-têtes de copyright |
| Démo ou appli web non modifiée | Lien vers https://github.com/A-S-T-U-C-E/HackCable (offre de source) |
| Version **modifiée** en SaaS / ENT / µcBlockly hébergé | Publier *votre* source correspondant et le rendre accessible aux utilisateurs du service |
| Intégration bibliothèque dans un autre logiciel | Le combiné doit respecter l’AGPL (en pratique : même copyleft) |

## Attribution

Ne pas retirer les crédits utilisateur (dialogue « À propos ») à Clément Grennerat et A-S-T-U-C-E / Sébastien Canet.  
Détails : [NOTICE](../NOTICE).

## Texte juridique

Le texte intégral est dans [`LICENSE`](../LICENSE). Résumé non officiel : [gnu.org/licenses/agpl-3.0](https://www.gnu.org/licenses/agpl-3.0.html).
