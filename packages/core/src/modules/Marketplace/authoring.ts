/**
 * Parent-level implementation facade for Marketplace submodules.
 *
 * Child submodules may not import each other directly; they import this file
 * (immediate parent implementation) instead, while the parent keeps the
 * Authoring implementation private to its `modules/Authoring` submodule.
 */
export * from "./modules/Authoring/index.ts";
