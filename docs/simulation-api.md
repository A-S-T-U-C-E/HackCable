# API simulation (hôte externe)

HackCable expose une API pour qu’un logiciel tiers (**µcBlockly**, **BlocklyDuino**, etc.)
envoie un sketch Arduino à une carte du plan, le compile et lance la simulation.

Licence : AGPL-3.0-or-later.

## Prérequis

1. Une instance `HackCable` montée (`HackCable.create(...)`).
2. Au moins une **carte MCU** sur le canvas (Uno / Nano Wokwi recommandés pour l’AVR).
3. Réseau pour la compile Hexi (`hexi.wokwi.com`), sauf si vous injectez déjà un HEX.

## Envoi rapide (cas nominal)

```ts
const boards = hackCable.listSimulatableBoards();
// [{ figureId, componentId, boardName, source }, ...]

const result = await hackCable.pushSketch(arduinoSource, {
  figureId: boards[0]?.figureId, // optionnel si une seule carte
  run: true,                     // compile + démarre (défaut)
});

if (!result.compile?.hex) {
  console.error(result.compile?.stderr);
} else {
  console.log("Simu sur", result.boardName, "running=", result.running);
}
```

Sans `figureId` : première carte MCU du plan.

## Méthodes

| Méthode | Rôle |
| --- | --- |
| `listSimulatableBoards()` | Cartes MCU adressables |
| `getBoardSketch(figureId)` | Lit le sketch stocké |
| `setBoardSketch(figureId, code)` | Écrit le sketch (sauvegarde `.hackcable`) |
| `pushSketch(code, options?)` | Injecte ± compile ± run |
| `compileBoard(options?)` | Compile sans forcément démarrer |
| `loadBoardHex(figureId, hex)` | Charge un HEX déjà compilé (sans Hexi) |
| `runSimulation()` | `run` + attache le bridge overlays |
| `stopSimulation()` | `stop` + détache le bridge |
| `setSimulationPaused(bool)` | Pause / reprise |
| `isSimulationPaused()` | État pause |
| `isSimulationRunning()` | Bridge attaché et CPU actif |

### Options `pushSketch`

```ts
type PushSketchOptions = {
  figureId?: string;
  saveSketch?: boolean; // défaut true
  compile?: boolean;    // défaut true
  run?: boolean;        // défaut = compile
};
```

### Accès bas niveau

- `hackCable.emulatorManager` — runners multi-cartes
- `hackCable.simulationBridge` — GPIO/ADC → LED, RGB, buzzer, 7-seg, barre LED, servo,
  boutons, switch, pot (géré par `runSimulation` / `stopSimulation`)

## Multi-cartes

```ts
for (const board of hackCable.listSimulatableBoards()) {
  await hackCable.pushSketch(codeFor(board), {
    figureId: board.figureId,
    run: false, // compile seulement
  });
}
hackCable.runSimulation(); // démarre toutes les cartes avec firmware
```

## Voir aussi

- [API table des broches MCU](mcu-pin-api.md)
- [Architecture](architecture.md)
