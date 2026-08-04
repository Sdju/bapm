import type { PublishApi } from "@/modules/Publish";

export async function publishCommand(argv: string[], publish: PublishApi): Promise<number> {
  const result = await publish.run({ args: argv, cwd: process.cwd() });
  return result.ok ? 0 : 1;
}
