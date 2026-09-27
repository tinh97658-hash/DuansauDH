export type SchedulingProgram = "masters" | "doctoral";

export const enabledSchedulingPrograms: readonly SchedulingProgram[] = Object.freeze(["masters"]);

export const isSchedulingProgramEnabled = (program: string) =>
  enabledSchedulingPrograms.includes(program as SchedulingProgram);
