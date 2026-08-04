export type DoctorCheck = {
  name: string;
  ok: boolean;
  critical: boolean;
  message: string;
};

export type RunDoctorOptions = {
  cwd?: string;
  gitAvailable?: boolean;
  hasGit?: boolean;
  whichGit?: () => string | null | undefined;
  findGit?: () => string | null | undefined;
};

export type DoctorResult = {
  ok: boolean;
  exitCode: number;
  checks: DoctorCheck[];
  text: string;
};
