/**
 * @license AGPL-3.0-or-later
 * Copyright (c) 2024-2026 Sébastien Canet / A-S-T-U-C-E
 * https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Sketch Arduino par défaut (Blink D13) pour les cartes MCU.
 */
/** Programme Blink sur la broche 13 (LED embarquée Uno/Nano). */
export const DEFAULT_MCU_SKETCH = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
`;
