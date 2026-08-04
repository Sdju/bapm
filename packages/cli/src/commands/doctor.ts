import type { DoctorApi } from "@/modules/Doctor";

export async function doctorCommand(argv: string[], doctor: DoctorApi): Promise<number> {
  const result = await doctor.run({ args: argv });
  return result.exitCode ?? (result.ok ? 0 : 1);
}
