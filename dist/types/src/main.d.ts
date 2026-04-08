import "./ui/css.styl";
import * as avr8js from 'avr8js';
import { Catalog } from "./panels/catalog";
import { EmulatorManager } from "./emulator/emulator-manager";
import { Editor } from "./editor/editor";
export { AVRRunner } from "./emulator/avr-runner";
export { EmulatorManager } from './emulator/emulator-manager';
import * as compiler from './emulator/compiler';
export type CompileResult = compiler.CompileResult;
import './jquery-ui-draggable';
export declare class HackCable {
    private readonly led;
    private readonly _emulatorManager;
    private readonly _catalog;
    private readonly _editor;
    constructor(mountDiv: HTMLElement);
    private setupResizer;
    get emulatorManager(): EmulatorManager;
    get catalog(): Catalog;
    get editor(): Editor;
    portDUpdate(portD: avr8js.AVRIOPort): void;
}
