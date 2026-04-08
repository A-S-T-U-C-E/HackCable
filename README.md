# HackCable

Simulateur Arduino et ESP32 (câblage des composants + exécution du code).

**Dépôt de ce fork :** [github.com/A-S-T-U-C-E/HackCable](https://github.com/A-S-T-U-C-E/HackCable)  
**Démo en ligne :** [a-s-t-u-c-e.github.io/HackCable/dist/web/](https://a-s-t-u-c-e.github.io/HackCable/dist/web/)

## Origine (projet amont)

Ce dépôt est un **fork** de **[HackCable](https://github.com/ClementGre/HackCable)** par **Clément Grennerat** ([@ClementGre](https://github.com/ClementGre)).  
Les idées, l’architecture d’origine et la licence du projet amont restent la référence ; ce fork y ajoute des évolutions et maintenance dans l’organisation [A-S-T-U-C-E](https://github.com/A-S-T-U-C-E).

- Amont / upstream : <https://github.com/ClementGre/HackCable>  
- Démo du projet d’origine : <https://clementgre.github.io/HackCable/>

## Objectifs

- Fournir une interface graphique pour câbler des composants sur une carte.
  - [Wokwi Elements](https://github.com/wokwi/wokwi-elements) pour la définition / l’affichage des composants
  - [Wokwi Boards](https://github.com/wokwi/wokwi-boards) pour la définition / l’affichage des cartes ESP32
  - [Draw2D](http://www.draw2d.org) pour le système de câblage
- Permettre d’émuler le code sur ces cartes
  - [AVR8JS](https://github.com/wokwi/avr8js) pour l’émulation sur Arduino

### Structure du projet

HackCable est écrit en TypeScript, avec Webpack et Babel.

Une seule configuration npm, deux configurations Webpack et deux dossiers principaux :

- `src` : code de la bibliothèque
- `web` : site de test et d’exemple d’utilisation (tâches `:web` avec `webpack.config.web.js`)

## Tâches npm

Vérification / génération TypeScript :

- `type-check`
- `type-check:watch`
- `build:types`

Build de la bibliothèque :

- `build:src`

Build ou serveur de dev pour la page web :

- `build:web`
- `serve:web`
