# Architecture HackCable (aperçu)

HackCable est la **couche application** (éditeur draw2d + UI). Le **noyau de simulation** vit dans le dépôt voisin [LibreCircuit](https://github.com/A-S-T-U-C-E/LibreCircuit) (`librecircuit`).

```
LibreCircuit (npm: librecircuit)
        │
        ▼
┌─────────────────────────────────────────────┐
│  HackCable (cette appli)                    │
│  web/  → HackCable.create() + UI toolbar    │
│  src/main.ts — catalogue + editor + bridge  │
└───────┬─────────────────────┬───────────────┘
        │                     │
┌───────▼────────┐   ┌────────▼───────────────┐
│ panels/        │   │ editor/                │
│ catalogue      │   │ canvas, figures, fils  │
│ Wokwi/Fritzing │   │ mcu-pin/, routers…     │
└────────────────┘   └────────────────────────┘
        │
        ▼
   eBlockly / hôtes (dépendance sur HackCable)
```

## Flux câblage

1. L’utilisateur tire un fil entre deux pastilles (ports draw2d).
2. `createWiringConnection()` pose un `draw2d.Connection` + routeur.
3. Sur `connect` / `disconnect`, `McuPinTableStore` invalide son cache.
4. Un logiciel tiers appelle `hackCable.getMcuPinConnectionTable()`.

## Simulation AVR

1. **Socle (LibreCircuit)** — `EmulatorManager`, `AVRRunner`, HEX via LibrEduc (`compileToHex`) **ou** injecté (`loadBoardHex`), snapshots GPIO
2. **Bridge (HackCable)** — `SimulationBridge` : GPIO/ADC → overlays Wokwi sur le canvas draw2d
3. **API hôte** — `pushSketch` / `runSimulation` / … (voir [simulation-api.md](simulation-api.md))
4. **UI démo** — Compiler / Exécuter / Pause / Pas / Stop ; panneau Broches

**Compile offline / flash carte** : pas dans LibreCircuit ni HackCable — rôle de **BDuino** desktop (arduino-cli). L’hôte peut aussi injecter un HEX.

## Persistance

`Editor.getEditorSaveData()` / `loadEditorSaveData()` :
- `figures[]` : `componentId`, position, rotation
- `connections[]` : ports source/cible + vertices + label optionnel

Fichier utilisateur : extension `.hackcable` (JSON).

## Licence

AGPL-3.0-or-later — voir `LICENSE`, `NOTICE` et [COPYLEFT.md](COPYLEFT.md).  
LibreCircuit est sous la même licence (dépôt séparé).
