# Architecture HackCable (aperçu)

```
┌─────────────────────────────────────────────┐
│  web/  (page démo)                          │
│  app.ts → HackCable.create() + UI toolbar   │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│  src/main.ts  — classe HackCable            │
│  • catalog (panneau pièces)                 │
│  • editor  (canvas + API MCU)               │
└───────┬─────────────────────┬───────────────┘
        │                     │
┌───────▼────────┐   ┌────────▼───────────────┐
│ panels/        │   │ editor/                │
│ catalogue      │   │ canvas, figures, fils  │
│ Wokwi/Fritzing │   │ mcu-pin/, routers…     │
└────────────────┘   └────────────────────────┘
```

## Flux câblage

1. L’utilisateur tire un fil entre deux pastilles (ports draw2d).
2. `createWiringConnection()` pose un `draw2d.Connection` + routeur.
3. Sur `connect` / `disconnect`, `McuPinTableStore` invalide son cache.
4. Un logiciel tiers appelle `hackCable.getMcuPinConnectionTable()`.

## Simulation AVR

Module `src/emulator/` + façade hôte sur `HackCable` :

1. **Socle** — Compile sketch → HEX (`hexi.wokwi.com`) ou `loadBoardHex` ; un `AVRRunner` **par carte** ; exécution simultanée entrelacée
2. **Bridge** — `SimulationBridge` : GPIO/ADC → LED, RGB, buzzer, 7-seg, barre LED, servo,
   boutons, switch, pot (Uno/Nano)
3. **API hôte** — `pushSketch` / `runSimulation` / `stopSimulation` (voir [simulation-api.md](simulation-api.md)) pour BlocklyDuino / µcBlockly
4. **UI démo** — Compiler / Exécuter / Pause / Stop ; sketch par carte (menu contextuel Code)

## Persistance

`Editor.getEditorSaveData()` / `loadEditorSaveData()` :
- `figures[]` : `componentId`, position, rotation
- `connections[]` : ports source/cible + vertices + label optionnel

Fichier utilisateur : extension `.hackcable` (JSON).

## Licence

AGPL-3.0-or-later — voir `LICENSE`, `NOTICE` et [COPYLEFT.md](COPYLEFT.md).
