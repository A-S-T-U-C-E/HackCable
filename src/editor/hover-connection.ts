import { Connection } from 'draw2d';

export default class HoverConnection extends Connection {
    constructor(sourcePort: any, targetPort: any) {
        super({
            router: new Connection.layout.connection.InteractiveManhattanConnectionRouter(),
            radius: 5,
            source: sourcePort,
            target: targetPort,
            stroke: 1.35
        });

        this.on("dragEnter", (_emitter: any, _event: any) => {
            this.attr({
                outlineColor: "#303030",
                outlineStroke: 2,
                color: "#00a8f0"
            });
        });

        this.on("dragLeave", (_emitter: any, _event: any) => {
            this.attr({
                outlineColor: "#303030",
                outlineStroke: 0,
                color: "#000000"
            });
        });
    }

    /**
     * required to receive dragEnter/dragLeave request.
     * This figure ignores drag/drop events if it is not a valid target
     * for the draggedFigure
     *
     * @param _draggedFigure
     * @returns {HoverConnection}
     */
    delegateTarget(_draggedFigure: any): this {
        return this;
    }
}