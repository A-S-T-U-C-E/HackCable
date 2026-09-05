/**
 * @file Correctifs draw2d (bugs command stack / vertices).
 */
import draw2d from "draw2d";

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
    if (!Collection?.prototype) return;

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

    const MoveVertex = draw2d.command.CommandMoveVertex;
    if (MoveVertex?.prototype) {
        const mvProto = MoveVertex.prototype as {
            redo: (this: { newPoint: { x: number; y: number } | null }) => void;
            newPoint: { x: number; y: number } | null;
        };
        const originalMvRedo = mvProto.redo;
        mvProto.redo = function (this: { newPoint: { x: number; y: number } | null }) {
            if (this.newPoint == null) return;
            originalMvRedo.call(this);
        };
    }
}
