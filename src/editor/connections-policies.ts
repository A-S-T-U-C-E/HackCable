/**
 * @file Politique de création de connexions (tirage depuis un port uniquement).
 */
import draw2d from "draw2d";
import { createWiringConnection } from "./connection-router";

class VertexDragConnectionPolicy extends draw2d.policy.connection.DragConnectionCreatePolicy {
    createConnection() {
        return createWiringConnection();
    }
}

export const connectionsPolicy = new draw2d.policy.connection.ComposedConnectionCreatePolicy([
    new VertexDragConnectionPolicy(),
]);
