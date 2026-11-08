# LspCanvas

Explicit, non-fatal diagnostics for declarations bapm parses but cannot deploy:

- `dependencies.lsp` / `devDependencies.lsp` on the root manifest or a dependency
  package → `LSP_UNSUPPORTED` naming the package and declared servers. LSP deploy
  is not implemented, so entries are never materialized and never enter the
  executable trust ladder.
- A `canvas:` manifest key or a primitive with type `canvas` →
  `CANVAS_UNSUPPORTED`. Canvas has no primitive/materialize path and stays out of
  every trust gate until implemented.

Install invokes `detectUnsupportedDeclarations` after primitive resolution and
adds the diagnostics to the install result, so the CLI emits them as warnings.
Projects without LSP/canvas declarations see no change.

## Public API

- `detectLspUnsupported(options)`
- `detectCanvasUnsupported(options)`
- `detectUnsupportedDeclarations(options)` / `collectUnsupportedDeclarations`
