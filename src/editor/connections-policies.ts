/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Politique de création de connexions (tirage depuis un port uniquement).
 *
 * Responsabilités :
 * - Installer la ConnectionCreatePolicy draw2d
 * - Restreindre le démarrage de fil aux pastilles hybrides
 */
import draw2d from "draw2d";
import { createWiringConnection } from "./connection-router";

class VertexDragConnectionPolicy extends draw2d.policy.connection.DragConnectionCreatePolicy {
    createConnection() {
        return createWiringConnection();
    }
}

/** Politique draw2d de création de connexions (tirage depuis un port uniquement). */
export const connectionsPolicy = new draw2d.policy.connection.ComposedConnectionCreatePolicy([
    new VertexDragConnectionPolicy(),
]);
