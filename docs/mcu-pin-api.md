# API table des broches MCU

HackCable entretient, pour chaque **microcontrôleur / carte programmable** sur le plan, un tableau de broches indiquant si elles sont reliées à un fil.

Destiné aux logiciels tiers (ex. **µcBlockly**) qui doivent savoir quelles GPIO / alimentations sont déjà câblées.

## Cartes concernées

Une pièce est traitée comme MCU si :

- Wokwi : `type === CARD` ou `category === "Microcontroller"` (ex. Arduino Uno)
- Fritzing : `category === "Microcontroller"` **ou** `"Computer"` (Arduino, ESP, STM32, PICAXE, Raspberry Pi, Beagle…)

Les résistances, capteurs, LED, etc. sont ignorés.

## Forme des données

```ts
type McuPinConnectionTable = McuBoardPinTable[];

type McuBoardPinTable = {
  figureId: string;       // instance sur le canvas
  componentId: number;    // type catalogue
  boardName: string;
  source: "wokwi" | "fritzing";
  moduleId?: string;      // Fritzing
  family?: string;
  category: string;
  portsPending: boolean;  // SVG Fritzing pas encore prêt
  pins: McuPinStatus[];
};

type McuPinStatus = {
  pinKey: string;         // id draw2d (Fritzing: connector0 ; Wokwi: "13")
  pinLabel: string;       // libellé (Fritzing: "D13" ; Wokwi: souvent = pinKey)
  connected: boolean;
  connections: Array<{
    peerFigureId: string;
    peerComponentId: number;
    peerPortKey: string;
    peerPortLabel?: string;
    wireLabel?: string;
  }>;
};
```

## API publique

Via l’instance `HackCable` (aussi sur `hackCable.editor`) :

| Méthode | Rôle |
| --- | --- |
| `getMcuPinConnectionTable()` | Snapshot de toutes les cartes MCU |
| `getMcuBoardPinTable(figureId)` | Une carte |
| `getMcuPinStatus(figureId, pinKeyOrLabel)` | Une broche (`pinKey` ou `pinLabel`) |
| `isMcuPinConnected(figureId, pinKeyOrLabel)` | booléen |
| `onMcuPinTableChange(cb)` | Abonnement ; retourne `unsubscribe` |

La table est **invalidée** sur `figure:add`, `figure:remove`, `connect`, `disconnect`, `figure:ports` (ports Fritzing prêts) et après `loadEditorSaveData`.

Exemple µcBlockly :

```ts
const unsub = hackCable.onMcuPinTableChange((table) => {
  for (const board of table) {
    for (const pin of board.pins) {
      if (pin.connected) {
        console.log(board.boardName, pin.pinLabel, "→", pin.connections);
      }
    }
  }
});

// Plus tard
unsub();

// Requête ponctuelle
if (hackCable.isMcuPinConnected(figureId, "D13")) { /* … */ }
```

Types exportés depuis le package : `McuPinConnectionTable`, `McuBoardPinTable`, `McuPinStatus`, `McuPinPeerConnection`, `isMicrocontrollerBoard`.

## Implémentation

- `src/editor/mcu-pin-table.ts` — construction / indexation
- `src/editor/editor.ts` — cache + écoute canvas
- `src/panels/component.ts` — `isMicrocontrollerBoard`
- `src/main.ts` — façade publique
