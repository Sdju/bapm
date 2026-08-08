# FEOD — примеры scaffold (CLI, locked)

Scope: `packages/cli`.

## Минимальная структура

```
packages/cli/src/
  app/
    entry.ts
    registry.ts
    init/
  commands/
    help.ts
    version.ts
    install.ts
  modules/
    Install/
      types/install.types.ts
      services/installDeps.ts
      index.ts
  common/
    constants/exitCodes.ts
  globals/
```

## app/entry.ts

```ts
#!/usr/bin/env node
import { run } from "./registry";

const code = await run(process.argv.slice(2));
process.exitCode = code;
```

## app/registry.ts

```ts
import { helpCommand } from "@/commands/help";
import { versionCommand } from "@/commands/version";
import { installCommand } from "@/commands/install";

const commands: Record<string, (argv: string[]) => Promise<number>> = {
  help: helpCommand,
  version: versionCommand,
  install: installCommand,
};

export async function run(argv: string[]): Promise<number> {
  const [name = "help", ...rest] = argv;
  if (name === "-h" || name === "--help") return helpCommand(rest);
  if (name === "-V" || name === "--version") return versionCommand(rest);
  const cmd = commands[name];
  if (!cmd) {
    console.error(`unknown command "${name}"`);
    await helpCommand([]);
    return 1;
  }
  return cmd(rest);
}
```

## commands/install.ts (тонкая команда)

```ts
import { createInstall } from "@/modules/Install";

export async function installCommand(argv: string[]): Promise<number> {
  const install = createInstall();
  const result = await install.run({ args: argv });
  return result.ok ? 0 : 1;
}
```

## modules/Install

### types/install.types.ts

```ts
export interface InstallOptions {
  args: string[];
}

export interface InstallResult {
  ok: boolean;
  message?: string;
}
```

### services/installDeps.ts

```ts
import type { InstallOptions, InstallResult } from "../types/install.types";

export async function installDeps(options: InstallOptions): Promise<InstallResult> {
  // доменная логика
  void options;
  return { ok: false, message: "not implemented" };
}
```

### index.ts

```ts
import { installDeps } from "./services/installDeps";
import type { InstallOptions, InstallResult } from "./types/install.types";
import type { Logger } from "./types/logger.types";

export type { InstallOptions, InstallResult, Logger };

export function createInstall(deps?: { logger?: Logger }) {
  const log = deps?.logger ?? {
    info: (m: string) => console.log(m),
    error: (m: string) => console.error(m),
  };

  return {
    async run(options: InstallOptions): Promise<InstallResult> {
      log.info("install…");
      return installDeps(options);
    },
  };
}
```

## common/constants/exitCodes.ts

```ts
export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
```

Импорт: `import { EXIT_OK } from '@/common/constants/exitCodes'` — **не** через barrel.
