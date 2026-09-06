/**
 * @file Correctifs draw2d (bugs command stack / vertices).
 */
import draw2d from "draw2d";
import { ensureOrthogonalPortExits, markConnectionUserRouted } from "./connection-router";

let patched = false;

type Draw2dCommand = {
    canExecute?: () => boolean;
    execute: () => void;
    redo: () => void;
};

type CommandList = {
    grep: (fn: (cmd: Draw2dCommand) => boolean) => void;
    each: (fn: (i: number, cmd: Draw2dCommand) => void) => void;
};

type CommandCollectionInstance = {
    commands: CommandList;
};

/**
 * draw2d exécute toutes les commandes d’une CommandCollection dès qu’au moins une
 * canExecute() — y compris un CommandMoveVertex sans newPoint (clic sommet sans drag),
 * ce qui provoque `Cannot read properties of null (reading 'x')`.
 */
export function patchDraw2dCommandStack(): void {
    if (patched) return;
    patched = true;

    const Collection = draw2d.command.CommandCollection;
    if (Collection?.prototype) {
        const proto = Collection.prototype as CommandCollectionInstance & {
            execute: (this: CommandCollectionInstance) => void;
            redo: (this: CommandCollectionInstance) => void;
        };

        const dropNopCommands = (collection: CommandCollectionInstance) => {
            collection.commands.grep((cmd) => {
                if (typeof cmd.canExecute !== "function") return true;
                return cmd.canExecute() !== false;
            });
        };

        const originalExecute = proto.execute;
        proto.execute = function (this: CommandCollectionInstance) {
            dropNopCommands(this);
            originalExecute.call(this);
        };

        const originalRedo = proto.redo;
        proto.redo = function (this: CommandCollectionInstance) {
            dropNopCommands(this);
            originalRedo.call(this);
        };
    }

    const MoveVertex = draw2d.command.CommandMoveVertex;
    if (MoveVertex?.prototype) {
        const mvProto = MoveVertex.prototype as {
            redo: (this: { newPoint: { x: number; y: number } | null; line?: unknown }) => void;
            newPoint: { x: number; y: number } | null;
            line?: unknown;
        };
        const originalMvRedo = mvProto.redo;
        mvProto.redo = function (this: { newPoint: { x: number; y: number } | null; line?: unknown }) {
            if (this.newPoint == null) return;
            originalMvRedo.call(this);
            if (this.line) markConnectionUserRouted(this.line);
        };
    }

    // Édition libre des sommets (VertexSelectionFeedbackPolicy) : conserver le tracé.
    const markLineAfterRedo = (Ctor: { prototype?: { redo?: (this: { line?: unknown }) => void } } | undefined) => {
        if (!Ctor?.prototype?.redo) return;
        const proto = Ctor.prototype;
        const originalRedo = proto.redo!;
        proto.redo = function (this: { line?: unknown }) {
            originalRedo.call(this);
            if (this.line) markConnectionUserRouted(this.line);
        };
    };
    markLineAfterRedo(draw2d.command.CommandAddVertex);
    markLineAfterRedo(draw2d.command.CommandRemoveVertex);

    // InteractiveManhattanConnectionRouter.route contient un `debugger` si oldVertices manque.
    const Interactive = draw2d.layout.connection.InteractiveManhattanConnectionRouter;
    if (Interactive?.prototype?.route) {
        const routeProto = Interactive.prototype as {
            route: (conn: unknown, hints: { oldVertices?: { getSize: () => number } }) => void;
        };
        const originalRoute = routeProto.route;
        routeProto.route = function (
            this: unknown,
            conn: unknown,
            routingHints: { oldVertices?: { getSize: () => number } },
        ) {
            const hints = routingHints ?? {};
            if (!hints.oldVertices) {
                hints.oldVertices = new draw2d.util.ArrayList();
            }
            return originalRoute.call(this, conn, hints);
        };
    }

    // Menu jquery-contextMenu de draw2d (andSelf / double menu) : on utilise le menu HackCable.
    const Ortho = draw2d.policy.line.OrthogonalSelectionFeedbackPolicy;
    if (Ortho?.prototype) {
        Ortho.prototype.onRightMouseDown = function onRightMouseDown() {
            // no-op — segments gérés via canvas-context-menu.ts
        };

        // Sortie non orthogonale (port latéral → segment vertical) : recalcule avant les poignées.
        const origOnSelect = Ortho.prototype.onSelect;
        Ortho.prototype.onSelect = function onSelect(
            this: unknown,
            canvas: unknown,
            connection: {
                routingRequired?: boolean;
                repaint?: () => void;
                _routingMetaData?: { routedByUserInteraction?: boolean };
            },
            isPrimarySelection: boolean,
        ) {
            if (ensureOrthogonalPortExits(connection as Parameters<typeof ensureOrthogonalPortExits>[0])) {
                connection.repaint?.();
            }
            return origOnSelect.call(this, canvas, connection, isPrimarySelection);
        };
    }
}
