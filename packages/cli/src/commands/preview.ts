import type { PreviewApi } from "@/modules/Run";

export async function previewCommand(argv: string[], preview: PreviewApi): Promise<number> {
  const result = await preview.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
