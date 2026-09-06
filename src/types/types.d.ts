/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Types ambient webpack / require (html, assets).
 *
 * Responsabilités :
 * - Autoriser `require` de templates et ressources dans le bundle
 */
declare module "draw2d";

declare module "*.css";
declare module "*.styl";
declare module "*.json" {
    const value: Record<string, unknown>;
    export default value;
}

/** Utilisé par webpack (require de html, etc.) */
declare function require(module: string): any;