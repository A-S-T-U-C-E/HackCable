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

## Persistance

`Editor.getEditorSaveData()` / `loadEditorSaveData()` :
- `figures[]` : `componentId`, position, rotation
- `connections[]` : ports source/cible + vertices + label optionnel

Fichier utilisateur : extension `.hackcable` (JSON).

## Licence

GPL-3.0-or-later — voir `LICENSE` à la racine.
