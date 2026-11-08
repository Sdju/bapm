# LspCanvas

Explicit diagnostics for manifest declarations that the active host set cannot deploy:

- `dependencies.lsp` / `devDependencies.lsp` on the root manifest or a dependency
  package → `LSP_UNSUPPORTED` naming the package and declared servers **only when
  no active host exposes `configureLsp`**. Claude/Copilot reconcile these entries
  through the `Lsp` module and ExecutableTrust type `lsp` instead.
- A `canvas:` manifest key or a primitive with type `canvas` →
  `CANVAS_UNSUPPORTED`. Canvas has no primitive/materialize path and stays out of
  every trust gate until implemented.

Install invokes `detectUnsupportedDeclarations` after active-target resolution and
adds the diagnostics to the install result, so the CLI emits them as warnings.
Projects without LSP/canvas declarations see no change.

## Public API

- `detectLspUnsupported(options)` — pass `lspDeployable: true` to suppress the
  warning when a supported host will deploy the entries
- `detectCanvasUnsupported(options)`
- `detectUnsupportedDeclarations(options)` / `collectUnsupportedDeclarations`
