import { Connection } from 'draw2d';
export default class HoverConnection extends Connection {
    constructor(sourcePort: any, targetPort: any);
    /**
     * required to receive dragEnter/dragLeave request.
     * This figure ignores drag/drop events if it is not a valid target
     * for the draggedFigure
     *
     * @param _draggedFigure
     * @returns {HoverConnection}
     */
    delegateTarget(_draggedFigure: any): this;
}
