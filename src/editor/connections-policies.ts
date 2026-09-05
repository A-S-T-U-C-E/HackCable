/**
 * @file Politique de création de connexions (tirage depuis un port uniquement).
 */
import draw2d from "draw2d";

class VertexDragConnectionPolicy extends draw2d.policy.connection.DragConnectionCreatePolicy {
    createConnection() {
        return new draw2d.Connection({ router: new draw2d.layout.connection.VertexRouter() });
    }
}

export const connectionsPolicy = new draw2d.policy.connection.ComposedConnectionCreatePolicy([
    new VertexDragConnectionPolicy(),
]);