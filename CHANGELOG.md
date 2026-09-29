# Changelog

Tous les changements notables de ce fork sont documentés ici.

Le format s’inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Socle de **simulation AVR** (`src/emulator/`) : `avr8js`, compile Hexi, load HEX, run/pause/stop
  exposé via `hackCable.emulatorManager` — **un runner par carte MCU** (exécution simultanée)
- **Pont GPIO/ADC → overlays Wokwi** (`SimulationBridge`) : LED, LED13, RGB, buzzer, 7-seg,
  barre LED, servo (approx.), boutons, slide switch, potentiomètre (ADC) ; mapping
  D0–D13 / A0–A5 → PORTD/B/C + `AVRADC.channelValues`, routé par `figureId`
- UI démo **Compiler / Exécuter / Pause / Stop** ; sketch **par carte MCU** (menu contextuel Code → modale)
- **API hôte** simulation : `pushSketch`, `compileBoard`, `loadBoardHex`, `runSimulation` /
  `stopSimulation` (intégration BlocklyDuino / µcBlockly) — voir `docs/simulation-api.md`

## [1.1.0] — 2026-09-27

### Ajouté

- Export du schéma vers **Wokwi** (`diagram.json`) et **Velxio** (`.vlx`) depuis la toolbar
- **Thème clair** en complément du thème sombre, réglable dans le panneau Accessibilité
  (persisté + synchro URL `theme=`)
- Favicons officiels Wokwi / Velxio sur les boutons d’export

### Modifié

- Chrome UI (catalogue, zoom, minicarte, menus, dialogues) aligné sur le thème choisi
- Contrastes toolbar / catalogue renforcés pour le **RGAA** (placeholders, icônes, états désactivés)

## [1.0.0] — 2026-09-25

Première release stable du fork **A-S-T-U-C-E** : éditeur de câblage électronique
(Draw2D + Wokwi Elements + catalogue Fritzing), prêt pour intégration (ex. µcBlockly)
et démo en ligne.

### Breaking

- **Licence** : passage de **GPL-3.0-or-later** à **AGPL-3.0-or-later**.
  Une version modifiée proposée en service réseau (site, IDE embarqué…) doit offrir
  le *Corresponding Source* aux utilisateurs (AGPL §13). Voir `LICENSE`, `NOTICE`
  et `docs/COPYLEFT.md`.

### Ajouté

- Dialogue « À propos » avec liens AGPL, offre de source (§13) et `NOTICE`
- Documentation copyleft (`docs/COPYLEFT.md`)
- Vidéos de démo sur PeerTube (liens dans `docs/demo/README.md` et le README)
- API table des broches MCU pour intégrateurs (`docs/mcu-pin-api.md`)

### Modifié

- En-têtes source `@license AGPL-3.0-or-later` + attribution fork A-S-T-U-C-E
- README recentré sur l’éditeur de câblage (plus de promesse de simulateur intégré)

### Retiré

- Scripts Playwright de captation vidéo (`demo:record*`) et dépendance associée
- Ancienne couche d’émulation AVR (retirée plus tôt dans l’historique du fork)

[1.1.0]: https://github.com/A-S-T-U-C-E/HackCable/releases/tag/v1.1.0
[1.0.0]: https://github.com/A-S-T-U-C-E/HackCable/releases/tag/v1.0.0
