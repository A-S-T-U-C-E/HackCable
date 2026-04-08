import { ComponentElement } from "./component";
export declare class Catalog {
    readonly elements: ComponentElement[];
    private readonly catalog;
    private readonly sorter;
    private readonly hackCable;
    constructor(hackCable: any);
    build(): void;
    updateCatalogList(): void;
}
