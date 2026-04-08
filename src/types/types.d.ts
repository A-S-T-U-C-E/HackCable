declare module "draw2d";

declare module "*.css";
declare module "*.styl";
declare module "*.json" {
    const value: Record<string, unknown>;
    export default value;
}

/** Utilisé par webpack (require de html, etc.) */
declare function require(module: string): any;