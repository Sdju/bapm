import type { CompileApi } from "@/modules/Compile";

export async function compileCommand(argv: string[], compile: CompileApi): Promise<number> {
  const result = await compile.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
